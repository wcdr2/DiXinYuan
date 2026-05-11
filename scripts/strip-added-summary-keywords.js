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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const suffixPattern = new RegExp(
  `(?:[。\\s]+关键词：(?:${REQUIRED_SUMMARY_TERMS.map(escapeRegExp).join("|")}))+$`,
  "u",
);

function stripAddedSuffix(summary) {
  return String(summary || "").replace(suffixPattern, "").trim();
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [rows] = await connection.query(
    "SELECT id, summary FROM news_versions WHERE summary LIKE '%关键词：%'",
  );
  let changed = 0;
  await connection.beginTransaction();
  try {
    for (const row of rows) {
      const stripped = stripAddedSuffix(row.summary);
      if (stripped && stripped !== row.summary) {
        await connection.query(
          "UPDATE news_versions SET summary=? WHERE id=?",
          [stripped, row.id],
        );
        changed++;
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
  console.log(JSON.stringify({
    scannedVersionsWithKeywordLabel: rows.length,
    strippedVersions: changed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
