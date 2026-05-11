const fs = require("fs");
const mysql = require("mysql2/promise");

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
  const [rejects] = await connection.query(
    `SELECT s.source_code AS sourceCode, s.name, nc.reject_reason AS rejectReason, COUNT(*) AS total
     FROM news_candidates nc
     JOIN sources s ON nc.source_id = s.id
     WHERE nc.review_status = 'rejected'
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
     GROUP BY s.id, nc.reject_reason
     ORDER BY total DESC
     LIMIT 50`,
  );
  const [detailLike] = await connection.query(
    `SELECT s.source_code AS sourceCode, nc.reject_reason AS rejectReason, COUNT(*) AS total
     FROM news_candidates nc
     JOIN sources s ON nc.source_id = s.id
     WHERE nc.review_status = 'rejected'
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND (nc.original_url REGEXP '/(news|content|detail|info|article|post|story|blog|press|events?)/'
         OR nc.original_url REGEXP '20[0-9]{2}[-/][0-9]{2}'
         OR nc.original_url REGEXP 't20[0-9]{6}'
         OR nc.original_url REGEXP '20[0-9]{6}')
     GROUP BY s.id, nc.reject_reason
     ORDER BY total DESC
     LIMIT 50`,
  );
  const [currentBySource] = await connection.query(
    `SELECT s.source_code AS sourceCode, s.name, COUNT(*) AS total, MIN(v.published_at) AS minDate, MAX(v.published_at) AS maxDate
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     GROUP BY s.id
     ORDER BY total DESC
     LIMIT 50`,
  );
  const [missingSummarySamples] = await connection.query(
    `SELECT s.source_code AS sourceCode, v.title, LEFT(v.summary, 220) AS summary, v.original_url AS originalUrl
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     WHERE NOT (
       v.summary LIKE '%地球信息科学%'
       OR v.summary LIKE '%遥感%'
       OR v.summary LIKE '%测绘%'
       OR v.summary LIKE '%GIS%'
       OR v.summary LIKE '%北斗%'
       OR v.summary LIKE '%空天信息%'
       OR v.summary LIKE '%实景三维%'
       OR v.summary LIKE '%时空智能%'
       OR v.summary LIKE '%自然资源数字化%'
       OR v.summary LIKE '%低空遥感%'
       OR v.summary LIKE '%数字孪生%'
       OR v.summary LIKE '%智慧城市%'
     )
     ORDER BY CASE WHEN s.source_code = 'mapscaping' THEN 0 ELSE 1 END, v.published_at DESC
     LIMIT 30`,
  );
  await connection.end();
  console.log(JSON.stringify({ rejects, detailLike, currentBySource, missingSummarySamples }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
