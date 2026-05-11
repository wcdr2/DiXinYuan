const fs = require("fs");
const mysql = require("mysql2/promise");

const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息", "实景三维", "时空智能",
  "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        let value = line.slice(index + 1);
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, index), value];
      }),
  );
}

function datasource() {
  const env = { ...readEnv(".env.example"), ...readEnv(".env.local"), ...process.env };
  const url = env.SPRING_DATASOURCE_URL || "jdbc:mysql://localhost:3306/gx_geo_news";
  const match = url.match(/jdbc:mysql:\/\/([^:/?]+)(?::(\d+))?\/([^?]+)/);
  if (!match) throw new Error(`Unsupported datasource URL: ${url}`);
  return {
    host: match[1],
    port: match[2] ? Number(match[2]) : 3306,
    database: match[3],
    user: env.SPRING_DATASOURCE_USERNAME || "root",
    password: env.SPRING_DATASOURCE_PASSWORD || "",
    charset: "utf8mb4",
  };
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const summaryWhere = REQUIRED_SUMMARY_TERMS
    .map(() => "(nc.cleaned_summary LIKE ? OR nc.raw_summary LIKE ?)")
    .join(" OR ");
  const params = REQUIRED_SUMMARY_TERMS.flatMap((term) => [`%${term}%`, `%${term}%`]);
  const [rows] = await connection.query(
    `SELECT
       s.source_code AS sourceCode,
       s.name,
       s.language,
       nc.reject_reason AS rejectReason,
       COUNT(*) AS total
     FROM news_candidates nc
     JOIN sources s ON nc.source_id = s.id
     WHERE nc.review_status = 'rejected'
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND (${summaryWhere})
     GROUP BY s.id, nc.reject_reason
     ORDER BY
       CASE WHEN s.language='zh' THEN 0 ELSE 1 END,
       CASE WHEN CONCAT(s.source_code, s.name, s.site_url) REGEXP '广西|guangxi|gx' THEN 0 ELSE 1 END,
       total DESC
     LIMIT 100`,
    params,
  );
  const [samples] = await connection.query(
    `SELECT
       s.source_code AS sourceCode,
       s.name,
       nc.reject_reason AS rejectReason,
       nc.raw_title AS rawTitle,
       nc.cleaned_title AS cleanedTitle,
       LEFT(COALESCE(NULLIF(nc.cleaned_summary, ''), nc.raw_summary), 180) AS summary,
       nc.original_url AS originalUrl
     FROM news_candidates nc
     JOIN sources s ON nc.source_id = s.id
     WHERE nc.review_status = 'rejected'
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND (${summaryWhere})
     ORDER BY
       CASE WHEN s.language='zh' THEN 0 ELSE 1 END,
       CASE WHEN CONCAT(s.source_code, s.name, s.site_url) REGEXP '广西|guangxi|gx' THEN 0 ELSE 1 END,
       nc.id
     LIMIT 80`,
    params,
  );
  await connection.end();
  console.log(JSON.stringify({ counts: rows, samples }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
