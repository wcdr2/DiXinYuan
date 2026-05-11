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

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildSummary(articles) {
  return {
    totalArticles: articles.length,
    totalSources: new Set(articles.map((article) => article.sourceName)).size,
    guangxiArticles: articles.filter((article) => article.isGuangxiRelated).length,
    latestUpdateAt: new Date().toISOString(),
    totalEntities: new Set(articles.flatMap((article) => article.entityIds)).size,
    totalEdges: 0,
  };
}

function buildWordCloud(articles) {
  const categories = new Map([
    ["all", new Map()],
    ["enterprise", new Map()],
    ["technology", new Map()],
    ["policy", new Map()],
  ]);
  const addWord = (category, term, article) => {
    if (!term) return;
    const bucket = categories.get(category) || categories.get("technology");
    const entry = bucket.get(term) || {
      term,
      weight: 0,
      category,
      period: "30d",
      articleIds: new Set(),
    };
    entry.weight += article.isGuangxiRelated ? 2 : 1;
    entry.articleIds.add(article.id);
    bucket.set(term, entry);
  };

  for (const article of articles) {
    for (const keyword of article.keywords) {
      addWord("all", keyword, article);
      addWord(article.category || "technology", keyword, article);
    }
  }

  return [...categories.values()].flatMap((bucket) =>
    [...bucket.values()]
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 20)
      .map((entry) => ({
        term: entry.term,
        weight: entry.weight,
        category: entry.category,
        period: entry.period,
        articleCount: entry.articleIds.size,
      })),
  );
}

async function upsertSnapshot(connection, crawlRunId, datasetType, payload) {
  await connection.query("UPDATE dataset_snapshots SET active=0 WHERE dataset_type=?", [datasetType]);
  await connection.query(
    "INSERT INTO dataset_snapshots(crawl_run_id,dataset_type,payload_json,active) VALUES(?,?,?,1)",
    [crawlRunId, datasetType, JSON.stringify(payload)],
  );
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [runRows] = await connection.query("SELECT MAX(id) AS crawlRunId FROM crawl_runs");
  const crawlRunId = runRows[0]?.crawlRunId || null;
  const summaryWhere = REQUIRED_SUMMARY_TERMS.map(() => "v.summary LIKE ?").join(" OR ");
  const [rows] = await connection.query(
    `SELECT
       n.news_code AS id,
       s.name AS sourceName,
       v.category,
       v.keywords_json,
       v.entity_ids_json,
       v.is_guangxi_related AS isGuangxiRelated
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     WHERE v.published_at >= '2024-01-01'
       AND v.published_at <= NOW()
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND v.url_status = 'accessible'
       AND (${summaryWhere})`,
    REQUIRED_SUMMARY_TERMS.map((term) => `%${term}%`),
  );
  const articles = rows.map((row) => ({
    id: row.id,
    sourceName: row.sourceName,
    category: row.category || "technology",
    keywords: parseJsonList(row.keywords_json),
    entityIds: parseJsonList(row.entity_ids_json),
    isGuangxiRelated: Boolean(row.isGuangxiRelated),
  }));
  await connection.beginTransaction();
  try {
    await upsertSnapshot(connection, crawlRunId, "summary", buildSummary(articles));
    await upsertSnapshot(connection, crawlRunId, "word-cloud", buildWordCloud(articles));
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
  console.log(JSON.stringify({
    crawlRunId,
    refreshedSnapshots: ["summary", "word-cloud"],
    totalArticles: articles.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
