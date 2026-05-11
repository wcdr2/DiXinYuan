const fs = require("fs");
const mysql = require("mysql2/promise");

const SOURCE_CODES = (process.env.SOURCE_CODES || process.argv.slice(2).join(","))
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (SOURCE_CODES.length === 0) {
  console.error("Usage: SOURCE_CODES=code1,code2 node scripts/delete-source-news.js");
  process.exit(1);
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, index), value];
      }),
  );
}

function datasource() {
  const env = { ...readEnv(".env.example"), ...readEnv(".env.local"), ...process.env };
  const jdbc = env.SPRING_DATASOURCE_URL || "jdbc:mysql://localhost:3306/gx_geo_news";
  const matched = jdbc.match(/jdbc:mysql:\/\/([^:/?]+)(?::(\d+))?\/([^?]+)/);
  if (!matched) throw new Error(`Unsupported SPRING_DATASOURCE_URL: ${jdbc}`);
  return {
    host: matched[1],
    port: matched[2] ? Number(matched[2]) : 3306,
    user: env.SPRING_DATASOURCE_USERNAME || "root",
    password: env.SPRING_DATASOURCE_PASSWORD || "",
    database: matched[3],
    charset: "utf8mb4",
  };
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [sources] = await connection.query(
    "SELECT id, source_code FROM sources WHERE source_code IN (?)",
    [SOURCE_CODES],
  );
  const sourceIds = sources.map((source) => source.id);
  if (sourceIds.length === 0) {
    console.log(JSON.stringify({ sourceCodes: SOURCE_CODES, deletedNews: 0, deletedVersions: 0, deletedCandidates: 0, deactivatedSources: 0 }, null, 2));
    await connection.end();
    return;
  }

  await connection.beginTransaction();
  try {
    const [newsRows] = await connection.query("SELECT id FROM news WHERE source_id IN (?)", [sourceIds]);
    const newsIds = newsRows.map((row) => row.id);
    let deletedVersions = 0;
    let deletedNews = 0;
    if (newsIds.length > 0) {
      const [versionResult] = await connection.query("DELETE FROM news_versions WHERE news_id IN (?)", [newsIds]);
      deletedVersions = versionResult.affectedRows || 0;
      const [newsResult] = await connection.query("DELETE FROM news WHERE id IN (?)", [newsIds]);
      deletedNews = newsResult.affectedRows || 0;
    }
    const [candidateResult] = await connection.query("DELETE FROM news_candidates WHERE source_id IN (?)", [sourceIds]);
    const [sourceResult] = await connection.query(
      "UPDATE sources SET active=0, whitelist_entity_id='', updated_at=NOW(3) WHERE id IN (?)",
      [sourceIds],
    );
    await connection.commit();
    console.log(JSON.stringify({
      sourceCodes: sources.map((source) => source.source_code),
      deletedNews,
      deletedVersions,
      deletedCandidates: candidateResult.affectedRows || 0,
      deactivatedSources: sourceResult.affectedRows || 0,
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
