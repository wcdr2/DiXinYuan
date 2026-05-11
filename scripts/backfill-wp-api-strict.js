const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");

const TARGET = Number(process.env.TARGET_UNIQUE_NEWS || 1000);
const MIN_DATE = new Date("2024-01-01T00:00:00+08:00");
const MAX_DATE = new Date(process.env.MAX_PUBLISHED_AT || new Date().toISOString());
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 20);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

const SOURCES = [
  {
    code: "gogeomatics",
    apiUrl: "https://gogeomatics.ca/wp-json/wp/v2/posts?per_page=100",
    maxPages: 60,
  },
  {
    code: "gis-lounge",
    apiUrl: "https://www.gislounge.com/wp-json/wp/v2/posts?per_page=100",
    maxPages: 30,
  },
  {
    code: "mapscaping",
    apiUrl: "https://mapscaping.com/wp-json/wp/v2/posts?per_page=100",
    maxPages: 18,
  },
  {
    code: "ogc",
    apiUrl: "https://www.ogc.org/wp-json/wp/v2/posts?per_page=100",
    maxPages: 3,
  },
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
        if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
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

function coreTerms() {
  const yaml = fs.readFileSync("backend/src/main/resources/application.yml", "utf8");
  const match = yaml.match(/core-keywords:\s*>\s*\n([\s\S]*?)\n\s*min-core-keyword-matches:/);
  if (!match) throw new Error("Cannot read app.strict-relevance.core-keywords.");
  return [...new Set(match[1].split(",").map((item) => item.replace(/\r?\n/g, " ").trim()).filter(Boolean))];
}

function whitelistTerms() {
  const whitelist = JSON.parse(fs.readFileSync("datasets/config/entity-whitelist.json", "utf8"));
  const terms = [];
  for (const entity of whitelist.entities || []) {
    terms.push(entity.name, ...(entity.aliases || []));
  }
  return terms.map((item) => String(item || "").trim()).filter(Boolean);
}

const CORE_TERMS = coreTerms();
const ENTITY_TERMS = whitelistTerms();
const LOW_RELEVANCE_TERMS = [
  "党委", "党支部", "党建", "理论学习", "民主生活会", "巡视", "干部", "任职", "任免",
  "统战", "工会", "团委", "学生会", "本科教学", "教学指导", "招生", "招聘会", "篮球",
  "足球", "运动会", "慰问", "职工代表大会", "年度工作会议",
];
const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息", "实景三维", "时空智能",
  "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];
const REQUIRED_TERM_ALIASES = new Map([
  ["地球信息科学", ["地球信息科学", "geoinformatics", "earth information science", "geographic information science"]],
  ["遥感", ["遥感", "remote sensing", "earth observation", "earth observing", "卫星遥感", "satellite imagery", "satellite image", "landsat", "sentinel", "copernicus", "synthetic aperture radar", "sar"]],
  ["测绘", ["测绘", "surveying", "mapping", "mapped", "maps", "geomatics", "geodesy", "cartography"]],
  ["GIS", ["GIS", "地理信息系统", "geospatial", "spatial data", "spatial analysis", "location intelligence", "location data", "interactive map", "web mapping", "web gis", "mobile gis", "arcgis", "qgis"]],
  ["北斗", ["北斗", "beidou", "bds", "卫星导航", "导航定位", "高精度定位"]],
  ["空天信息", ["空天信息", "aerospace information", "space information", "space-based information", "space data", "satellite", "space technology"]],
  ["实景三维", ["实景三维", "3d reality", "reality mesh", "三维建模", "三维模型", "倾斜摄影", "点云", "lidar", "激光雷达"]],
  ["时空智能", ["时空智能", "spatiotemporal intelligence", "spatial-temporal intelligence", "空间智能", "地理空间智能", "geoai", "时空数据", "空间数据"]],
  ["自然资源数字化", ["自然资源数字化", "自然资源", "natural resources", "国土空间", "调查监测"]],
  ["低空遥感", ["低空遥感", "低空", "无人机遥感", "uav remote sensing", "航测", "航空摄影", "photogrammetry"]],
  ["数字孪生", ["数字孪生", "digital twin", "城市信息模型", "cim"]],
  ["智慧城市", ["智慧城市", "smart city", "smart cities"]],
]);

function cleanHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function bodySummary(html) {
  return ([...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanHtml(match[1]))
    .filter((item) => item.length >= 12)
    .find(hasRequiredSummaryTerm) || "").slice(0, 260);
}

function bodyText(html) {
  const paragraphs = [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanHtml(match[1]))
    .filter((item) => item.length >= 20);
  return (paragraphs.length ? [...new Set(paragraphs)].join(" ") : cleanHtml(html)).slice(0, 20000);
}

function hasNonAscii(value) {
  return [...value].some((char) => char.charCodeAt(0) > 127);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contains(text, term) {
  const left = String(text || "").toLowerCase();
  const right = String(term || "").toLowerCase();
  if (!right) return false;
  if (hasNonAscii(right)) return left.includes(right);
  return new RegExp(`\\b${escapeRegExp(right)}\\b`, "i").test(left);
}

function matches(text, terms) {
  const seen = new Set();
  for (const term of terms) {
    if (contains(text, term)) seen.add(term);
  }
  return [...seen];
}

function hasRequiredSummaryTerm(summary) {
  return REQUIRED_SUMMARY_TERMS.some((term) => String(summary || "").includes(term));
}

function requiredSummaryTermFor(title, summary, keywords = []) {
  const text = `${title || ""} ${summary || ""} ${keywords.join(" ")}`.toLowerCase();
  for (const term of REQUIRED_SUMMARY_TERMS) {
    for (const alias of REQUIRED_TERM_ALIASES.get(term) || [term]) {
      if (contains(text, alias)) return term;
    }
  }
  return "";
}

function ensureRequiredSummaryTerm(summary, title, keywords = []) {
  return String(summary || "").trim();
}

function isRelevant(title, summary, entityEvidenceTerms = []) {
  const text = `${title} ${summary}`;
  const coreMatches = matches(text, CORE_TERMS);
  if (coreMatches.length >= 2) {
    return { ok: true, matches: coreMatches };
  }
  const entityMatches = [
    ...matches(text, ENTITY_TERMS),
    ...entityEvidenceTerms.filter((term) => term && !LOW_RELEVANCE_TERMS.includes(term)),
  ];
  const lowContext = LOW_RELEVANCE_TERMS.some((term) => text.includes(term));
  return {
    ok: coreMatches.length >= 1 && entityMatches.length >= 1 && !lowContext,
    matches: coreMatches,
  };
}

function isDetailUrl(value) {
  if (!value) return false;
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    return false;
  }
  const lower = (url.pathname || "/").toLowerCase().replace(/\/+$/, "");
  if (!lower || lower === "/") return false;
  if (/\/(news|dt|list|index)$/.test(lower) || /\/(?:index|list)(?:[_-]\d+)*\.s?html?$/.test(lower)) return false;
  if (/\/(content|detail|info|article|blog-article|announcement|post|story|blog|press|press_releases|press-releases|event|events|id|art|news)\//.test(lower)) return true;
  const file = lower.slice(lower.lastIndexOf("/") + 1);
  if (/^t\d+(?:_\d+)?\.s?html?$/i.test(file)) return true;
  if (/^\d{5,}\.s?html?$/i.test(file)) return !lower.includes("/list/");
  if (!file.includes(".") && file.length >= 12 && (file.match(/-/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  if (!file.includes(".") && file.length >= 12 && (file.match(/_/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  return /(20\d{2}|\d{6,}).*\.s?html?$/i.test(lower) && !/\/(category|tag|special)\//.test(lower);
}

function canonicalUrl(value) {
  return String(value || "").trim().replace(/#.*$/, "").replace(/\/+$/, "");
}

function slugify(title, sourceCode, url) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return (slug || `${sourceCode}-${sha(url).slice(0, 8)}`).slice(0, 120).replace(/-+$/, "");
}

function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/strict-backfill" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
}

async function verifyUrl(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 gx-geo-news/strict-backfill" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.status >= 200 && response.status < 400 ? response.url : "";
  } catch {
    return "";
  }
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      results.push(await worker(current));
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchCandidates(source) {
  const candidates = [];
  for (let page = 1; page <= source.maxPages; page++) {
    const separator = source.apiUrl.includes("?") ? "&" : "?";
    let posts;
    try {
      posts = await fetchJson(`${source.apiUrl}${separator}page=${page}`);
    } catch (error) {
      if (page === 1) console.error(`[${source.code}] ${error.message}`);
      break;
    }
    if (!Array.isArray(posts) || posts.length === 0) break;
    let sawOlder = false;
    for (const post of posts) {
      const publishedAt = new Date(post.date_gmt || post.date || "");
      if (!(publishedAt instanceof Date) || Number.isNaN(publishedAt.getTime())) continue;
      if (publishedAt < MIN_DATE) {
        sawOlder = true;
        continue;
      }
      if (publishedAt > MAX_DATE) continue;
      const title = cleanHtml(post.title?.rendered || "");
      const body = bodyText(post.content?.rendered || "");
      const summary = bodySummary(post.content?.rendered || "");
      const url = canonicalUrl(post.link || "");
      if (!title || !summary || !url) continue;
      candidates.push({ sourceCode: source.code, title, summary, bodyText: body, url, publishedAt });
    }
    if (sawOlder) break;
  }
  return candidates;
}

async function currentCount(connection) {
  const [rows] = await connection.query("SELECT COUNT(*) total FROM news");
  return Number(rows[0].total);
}

async function qualifiedCount(connection) {
  const summaryWhere = REQUIRED_SUMMARY_TERMS.map(() => "v.summary LIKE ?").join(" OR ");
  const [rows] = await connection.query(
    `SELECT COUNT(*) total
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     WHERE s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND v.published_at >= '2024-01-01'
       AND v.published_at <= NOW()
       AND v.url_status = 'accessible'
       AND v.body_text IS NOT NULL
       AND v.body_text <> ''
       AND INSTR(v.body_text, v.summary) > 0
       AND (${summaryWhere})`,
    REQUIRED_SUMMARY_TERMS.map((term) => `%${term}%`),
  );
  return Number(rows[0].total);
}

async function insertCurrentVersion(connection, crawlRunId, source, candidate, canonical, keywords, summary, newsId) {
  const contentHash = sha([candidate.title, summary, candidate.bodyText || "", canonical, candidate.publishedAt.toISOString(), keywords.join("|")].join("\n"));
  let targetNewsId = newsId;
  if (!targetNewsId) {
    const newsCode = sha(`${source.source_code}::${canonical}`).slice(0, 32);
    const [newsResult] = await connection.query(
      "INSERT INTO news(news_code,source_id,canonical_url,slug,first_seen_at,last_seen_at) VALUES(?,?,?,?,NOW(3),NOW(3))",
      [newsCode, source.id, canonical, slugify(candidate.title, source.source_code, canonical)],
    );
    targetNewsId = newsResult.insertId;
  }

  let versionId;
  try {
    const [versionResult] = await connection.query(
      `INSERT INTO news_versions(news_id,crawl_run_id,title,summary,cover_image,source_url,original_url,published_at,language,category,keywords_json,region_tags_json,entity_ids_json,is_guangxi_related,content_hash,url_verified_at,url_status,final_url,body_text)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3),'accessible',?,?)`,
      [
        targetNewsId,
        crawlRunId,
        candidate.title,
        summary,
        "",
        source.site_url,
        canonical,
        mysqlDate(candidate.publishedAt),
        source.language || "en",
        "technology",
        JSON.stringify(keywords),
        JSON.stringify([source.language === "zh" ? "全国" : "国际"]),
        JSON.stringify([source.whitelist_entity_id]),
        0,
        contentHash,
        canonical,
        candidate.bodyText || summary,
      ],
    );
    versionId = versionResult.insertId;
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      const [versions] = await connection.query(
        "SELECT id FROM news_versions WHERE news_id=? AND content_hash=? LIMIT 1",
        [targetNewsId, contentHash],
      );
      versionId = versions[0]?.id;
    } else {
      throw error;
    }
  }
  if (!versionId) throw new Error(`Could not resolve inserted version for ${canonical}`);
  await connection.query(
    "UPDATE news SET current_version_id=?, last_seen_at=NOW(3), updated_at=NOW(3) WHERE id=?",
    [versionId, targetNewsId],
  );
  return targetNewsId;
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [sources] = await connection.query(
    "SELECT id, source_code, name, site_url, language, whitelist_entity_id FROM sources WHERE active=1 AND source_code IN (?)",
    [SOURCES.map((source) => source.code)],
  );
  const sourceByCode = new Map(sources.map((source) => [source.source_code, source]));
  const [runResult] = await connection.query(
    "INSERT INTO crawl_runs(run_type,triggered_by,status,coverage_status,accepted_count,rejected_count,started_at,window_start_at,window_end_at,note) VALUES('manual-wp-api-backfill','manual','running','running',0,0,NOW(3),?,?,'Strict WordPress API backfill')",
    [mysqlDate(MIN_DATE), mysqlDate(MAX_DATE)],
  );
  const crawlRunId = runResult.insertId;

  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  let inserted = 0;
  let refreshed = 0;
  const reasonCounts = new Map();

  try {
    for (const sourceConfig of SOURCES) {
      const source = sourceByCode.get(sourceConfig.code);
      if (!source || !source.whitelist_entity_id) continue;
      const candidates = await fetchCandidates(sourceConfig);
      const sourceReasonCounts = new Map();
      const verified = await mapLimit(candidates, CONCURRENCY, async (candidate) => {
        const relevance = isRelevant(candidate.title, candidate.bodyText || candidate.summary, [source.name]);
        if (!relevance.ok) return { ...candidate, rejected: "keyword_not_matched" };
        if (!isDetailUrl(candidate.url)) return { ...candidate, rejected: "not_detail_url" };
        const finalUrl = await verifyUrl(candidate.url);
        if (!finalUrl) return { ...candidate, rejected: "original_url_inaccessible" };
        return { ...candidate, finalUrl, matches: relevance.matches };
      });

      for (const candidate of verified) {
        if (candidate.rejected) {
          rejected++;
          reasonCounts.set(candidate.rejected, (reasonCounts.get(candidate.rejected) || 0) + 1);
          sourceReasonCounts.set(candidate.rejected, (sourceReasonCounts.get(candidate.rejected) || 0) + 1);
          continue;
        }

        const canonical = canonicalUrl(candidate.finalUrl || candidate.url);
        const keywords = candidate.matches || [];
        const summary = ensureRequiredSummaryTerm(candidate.summary, candidate.title, keywords);
        if (!hasRequiredSummaryTerm(summary)) {
          rejected++;
          reasonCounts.set("summary_required_term_missing", (reasonCounts.get("summary_required_term_missing") || 0) + 1);
          continue;
        }
        const [existing] = await connection.query(
          `SELECT n.id, v.summary AS current_summary
           FROM news n
           LEFT JOIN news_versions v ON n.current_version_id = v.id
           WHERE n.source_id=? AND n.canonical_url=? LIMIT 1`,
          [source.id, canonical],
        );
        if (existing.length && hasRequiredSummaryTerm(existing[0].current_summary || "")) {
          duplicates++;
          continue;
        }

        await insertCurrentVersion(
          connection,
          crawlRunId,
          source,
          candidate,
          canonical,
          keywords,
          summary,
          existing[0]?.id,
        );
        accepted++;
        if (existing.length) refreshed++;
        else inserted++;
        if ((await qualifiedCount(connection)) >= TARGET) break;
      }

      console.log(`[${sourceConfig.code}] candidates=${candidates.length} inserted=${inserted} refreshed=${refreshed} accepted=${accepted} rejected=${rejected} duplicates=${duplicates} sourceRejects=${JSON.stringify(Object.fromEntries(sourceReasonCounts))}`);
      if ((await qualifiedCount(connection)) >= TARGET) break;
    }

    await connection.query(
      "UPDATE crawl_runs SET status=?,coverage_status=?,accepted_count=?,rejected_count=?,finished_at=NOW(3),note=? WHERE id=?",
      [
        accepted > 0 ? "succeeded" : "failed",
        "best_effort",
        accepted,
        rejected,
        `Strict WP API backfill inserted=${inserted}, refreshed=${refreshed}, duplicates=${duplicates}, rejects=${JSON.stringify(Object.fromEntries(reasonCounts))}`,
        crawlRunId,
      ],
    );

    console.log(JSON.stringify({
      crawlRunId,
      inserted,
      refreshed,
      accepted,
      rejected,
      duplicates,
      currentTotal: await currentCount(connection),
      qualifiedTotal: await qualifiedCount(connection),
      rejectReasons: Object.fromEntries(reasonCounts),
    }, null, 2));
  } catch (error) {
    await connection.query("UPDATE crawl_runs SET status='failed',coverage_status='partial',finished_at=NOW(3),note=? WHERE id=?", [error.stack || error.message, crawlRunId]);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
