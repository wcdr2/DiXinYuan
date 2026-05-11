const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");

const TARGET = Number(process.env.TARGET_UNIQUE_NEWS || 1100);
const SCAN_LIMIT = Number(process.env.REPLAY_SCAN_LIMIT || 12000);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 16);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const MIN_DATE = new Date("2024-01-01T00:00:00+08:00");
const MAX_DATE = new Date(process.env.MAX_PUBLISHED_AT || new Date().toISOString());
const SOURCE_CODES = (process.env.SOURCE_CODES || process.env.REPLAY_SOURCE_CODES || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const LANGUAGES = (process.env.REPLAY_LANGUAGES || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const INCLUDE_ACCEPTED_CANDIDATES = process.env.INCLUDE_ACCEPTED_CANDIDATES === "1";

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
const LOW_RELEVANCE_TERMS = [
  "党委", "党支部", "党建", "理论学习", "民主生活会", "巡视", "干部", "任职", "任免",
  "统战", "工会", "团委", "学生会", "本科教学", "教学指导", "招生", "招聘会", "篮球",
  "足球", "运动会", "慰问", "职工代表大会", "年度工作会议",
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
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
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

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contains(text, term) {
  const left = String(text || "").toLowerCase();
  const right = String(term || "").toLowerCase();
  if (!right) return false;
  if (/[\u4e00-\u9fa5]/.test(right)) return left.includes(right);
  return new RegExp(`\\b${escapeRegExp(right)}\\b`, "i").test(left);
}

function hasRequiredSummaryTerm(summary) {
  return REQUIRED_SUMMARY_TERMS.some((term) => String(summary || "").includes(term));
}

function firstRequiredSummary(...values) {
  const cleaned = values.map(cleanText).filter(Boolean);
  return cleaned.find(hasRequiredSummaryTerm) || cleaned[0] || "";
}

function requiredSummaryTermFor(title, summary, keywords = []) {
  const text = `${title || ""} ${summary || ""} ${keywords.join(" ")}`;
  for (const term of REQUIRED_SUMMARY_TERMS) {
    for (const alias of REQUIRED_TERM_ALIASES.get(term) || [term]) {
      if (contains(text, alias)) return term;
    }
  }
  return "";
}

function ensureRequiredSummaryTerm(summary, title, keywords = []) {
  return cleanText(summary);
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function coreTerms() {
  const yaml = fs.readFileSync("backend/src/main/resources/application.yml", "utf8");
  const match = yaml.match(/core-keywords:\s*>\s*\n([\s\S]*?)\n\s*min-core-keyword-matches:/);
  if (!match) throw new Error("Cannot read app.strict-relevance.core-keywords.");
  return [...new Set(match[1].split(",").map((item) => item.replace(/\r?\n/g, " ").trim()).filter(Boolean))];
}
const CORE_TERMS = coreTerms();

function matches(text, terms) {
  const seen = new Set();
  for (const term of terms) {
    if (contains(text, term)) seen.add(term);
  }
  return [...seen];
}

function isRelevant(title, summary, keywords, sourceName) {
  const bodyText = `${title} ${summary}`;
  const text = `${bodyText} ${keywords.join(" ")}`;
  const coreMatches = matches(text, CORE_TERMS);
  if (coreMatches.length >= 2) return { ok: true, matches: coreMatches };
  const lowContext = LOW_RELEVANCE_TERMS.some((term) => bodyText.includes(term));
  return {
    ok: coreMatches.length >= 1 && !lowContext && Boolean(sourceName),
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
  if (/^\/20\d{6}\/[0-9a-f]{16,}\/[ac]\.html$/i.test(lower)) return true;
  const file = lower.slice(lower.lastIndexOf("/") + 1);
  if (/^t\d+(?:_\d+)?\.s?html?$/i.test(file)) return true;
  if (/^\d{5,}\.s?html?$/i.test(file)) return !lower.includes("/list/");
  if (!file.includes(".") && file.length >= 12 && (file.match(/-/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  if (!file.includes(".") && file.length >= 12 && (file.match(/_/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  return /(20\d{2}|\d{6,}).*\.s?html?$/i.test(lower) && !/\/(category|tag|special)\//.test(lower);
}

function parseDate(value) {
  const text = String(value || "");
  let match = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:[日\sT]+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const [, y, m, d, h = "00", min = "00"] = match;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min.padStart(2, "0")}:00+08:00`);
  }
  match = text.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/);
  if (match) return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`);
  match = text.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+20\d{2}/i);
  if (match) {
    const parsed = new Date(match[0]);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inRange(date) {
  return date && date >= MIN_DATE && date <= MAX_DATE;
}

function canonicalUrl(value) {
  return String(value || "").trim().replace(/#.*$/, "").replace(/\/+$/, "");
}

function host(value) {
  try {
    return new URL(String(value || "").trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceUrlAllowed(source, articleUrl) {
  const articleHost = host(articleUrl);
  if (!articleHost) return false;
  const allowed = new Set([host(source.site_url)].filter(Boolean));
  let rule = {};
  try {
    rule = typeof source.crawl_rule_json === "string" ? JSON.parse(source.crawl_rule_json || "{}") : source.crawl_rule_json || {};
  } catch {
    rule = {};
  }
  for (const field of ["allowedDomains", "allowedHosts"]) {
    for (const value of Array.isArray(rule[field]) ? rule[field] : []) {
      const item = String(value || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
      if (item) allowed.add(item);
    }
  }
  if ([...allowed].some((item) => articleHost === item || articleHost.endsWith(`.${item}`))) return true;
  return (Array.isArray(rule.allowedHostPatterns) ? rule.allowedHostPatterns : [])
    .some((pattern) => new RegExp(pattern, "i").test(articleHost));
}

function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function slugify(title, sourceCode, url) {
  const slug = String(title || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/(^-+|-+$)/g, "");
  return (slug || `${sourceCode}-${sha(url).slice(0, 8)}`).slice(0, 120).replace(/-+$/, "");
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchPage(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/candidate-replay" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) return null;
  const html = await response.text();
  return { finalUrl: response.url, html };
}

function meta(html, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const found = html.match(pattern)?.[1];
      if (found) return cleanText(found);
    }
  }
  return "";
}

function requiredBodyParagraph(html) {
  const paragraph = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .find((item) => item.length >= 12 && hasRequiredSummaryTerm(item));
  if (paragraph) return snippetAroundRequiredTerm(paragraph);
  return snippetAroundRequiredTerm(bodyText(html));
}

function snippetAroundRequiredTerm(value) {
  const text = cleanText(value);
  if (!hasRequiredSummaryTerm(text)) return "";
  if (text.length <= 260) return text;
  const indexes = REQUIRED_SUMMARY_TERMS
    .map((term) => text.indexOf(term))
    .filter((index) => index >= 0);
  const start = Math.max(0, Math.min(...indexes) - 90);
  return text.slice(start, start + 260).trim();
}

function bodyText(html) {
  const paragraphs = [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((item) => item.length >= 20);
  return (paragraphs.length ? [...new Set(paragraphs)].join(" ") : cleanText(html)).slice(0, 20000);
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      results.push(await worker(item));
    }
  });
  await Promise.all(workers);
  return results;
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

async function insertArticle(connection, crawlRunId, source, candidate, article) {
  const [existing] = await connection.query(
    "SELECT id FROM news WHERE source_id=? AND canonical_url=? LIMIT 1",
    [source.id, article.canonicalUrl],
  );
  if (existing.length) return "duplicate";

  const contentHash = sha([article.title, article.summary, article.bodyText, article.canonicalUrl, article.publishedAt.toISOString(), article.keywords.join("|")].join("\n"));
  const newsCode = sha(`${source.source_code}::${article.canonicalUrl}`).slice(0, 32);
  const [newsResult] = await connection.query(
    "INSERT INTO news(news_code,source_id,canonical_url,slug,first_seen_at,last_seen_at) VALUES(?,?,?,?,NOW(3),NOW(3))",
    [newsCode, source.id, article.canonicalUrl, slugify(article.title, source.source_code, article.canonicalUrl)],
  );
  const newsId = newsResult.insertId;
  const text = `${article.title} ${article.summary} ${source.name}`;
  const guangxi = /广西|南宁|桂林|柳州|北海|钦州|贵港|玉林|百色|贺州|河池|来宾|崇左|防城港|梧州|guangxi/i.test(text);
  const regionTags = guangxi ? ["广西"] : [source.language === "zh" ? "全国" : "国际"];
  const [versionResult] = await connection.query(
    `INSERT INTO news_versions(news_id,crawl_run_id,title,summary,cover_image,source_url,original_url,published_at,language,category,keywords_json,region_tags_json,entity_ids_json,is_guangxi_related,content_hash,url_verified_at,url_status,final_url,body_text)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3),'accessible',?,?)`,
    [
      newsId,
      crawlRunId,
      article.title,
      article.summary,
      "",
      source.site_url,
      article.canonicalUrl,
      mysqlDate(article.publishedAt),
      source.language || "zh",
      article.category,
      JSON.stringify(article.keywords),
      JSON.stringify(regionTags),
      JSON.stringify([source.whitelist_entity_id]),
      guangxi ? 1 : 0,
      contentHash,
      article.canonicalUrl,
      article.bodyText,
    ],
  );
  await connection.query("UPDATE news SET current_version_id=?, updated_at=NOW(3) WHERE id=?", [versionResult.insertId, newsId]);
  const replayReason = candidate.review_status === "accepted"
    ? "replayed_from_accepted_candidate"
    : `replayed_from_${candidate.reject_reason || "candidate"}`;
  await connection.query("UPDATE news_candidates SET review_status='accepted', reject_reason=? WHERE id=?", [replayReason, candidate.id]);
  return "inserted";
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [runResult] = await connection.query(
    "INSERT INTO crawl_runs(run_type,triggered_by,status,coverage_status,accepted_count,rejected_count,started_at,window_start_at,window_end_at,note) VALUES('candidate-replay','manual','running','running',0,0,NOW(3),?,?,'Strict replay of rejected candidates')",
    [mysqlDate(MIN_DATE), mysqlDate(MAX_DATE)],
  );
  const crawlRunId = runResult.insertId;
  const [rows] = await connection.query(
    `SELECT nc.*, s.id source_id_value, s.source_code source_code_value, s.name source_name, s.site_url, s.language source_language, s.whitelist_entity_id, s.active source_active, s.crawl_rule_json
     FROM news_candidates nc
     JOIN sources s ON nc.source_id = s.id
     WHERE ((nc.review_status='rejected'
AND nc.reject_reason IN ('missing_published_at','keyword_not_matched','summary_too_short','title_too_short','original_url_inaccessible','summary_required_term_missing','not_detail_url'))
       OR (? = 1 AND nc.review_status='accepted'))
       AND s.active = 1
       AND s.whitelist_entity_id IS NOT NULL
       AND s.whitelist_entity_id <> ''
       AND s.source_code NOT IN ('gisuser','spatialsource','geoawesome','digital-geography','news-cn','people-cn','cctv-cn','stdaily','chinanews','gov-cn')
       AND (? = 0 OR s.source_code IN (?))
       AND (? = 0 OR s.language IN (?))
     ORDER BY
       CASE WHEN s.language='zh' THEN 0 ELSE 1 END,
       CASE WHEN CONCAT(s.source_code, s.name, s.site_url) REGEXP '广西|guangxi|gx' THEN 0 ELSE 1 END,
       CASE s.source_code
         WHEN 'glut-cgg' THEN 0
         WHEN 'gxu-zyhjcl' THEN 1
         WHEN 'csgpc' THEN 2
         WHEN 'whu' THEN 3
         WHEN 'piesat' THEN 4
         WHEN 'supermap' THEN 5
         ELSE 20
       END,
       nc.id
     LIMIT ?`,
    [INCLUDE_ACCEPTED_CANDIDATES ? 1 : 0, SOURCE_CODES.length, SOURCE_CODES.length ? SOURCE_CODES : [""], LANGUAGES.length, LANGUAGES.length ? LANGUAGES : [""], SCAN_LIMIT],
  );

  let inserted = 0;
  let duplicate = 0;
  let rejected = 0;
  const reasons = new Map();
  const sourceById = new Map();

  await mapLimit(rows, CONCURRENCY, async (candidate) => {
    if ((await qualifiedCount(connection)) >= TARGET) return;
    const source = sourceById.get(candidate.source_id_value) || {
      id: candidate.source_id_value,
      source_code: candidate.source_code_value,
      name: candidate.source_name,
      site_url: candidate.site_url,
      language: candidate.source_language,
      whitelist_entity_id: candidate.whitelist_entity_id,
      crawl_rule_json: candidate.crawl_rule_json,
    };
    sourceById.set(source.id, source);
    const url = canonicalUrl(candidate.canonical_url || candidate.original_url);
    if (!isDetailUrl(url)) {
      rejected++; reasons.set("not_detail_url", (reasons.get("not_detail_url") || 0) + 1); return;
    }
    if (!sourceUrlAllowed(source, url)) {
      rejected++; reasons.set("source_url_domain_mismatch", (reasons.get("source_url_domain_mismatch") || 0) + 1); return;
    }
    let page;
    try {
      page = await fetchPage(url);
    } catch {
      rejected++; reasons.set("original_url_inaccessible", (reasons.get("original_url_inaccessible") || 0) + 1); return;
    }
    if (!page) {
      rejected++; reasons.set("original_url_inaccessible", (reasons.get("original_url_inaccessible") || 0) + 1); return;
    }
    const canonicalFinalUrl = canonicalUrl(page.finalUrl || url);
    if (!sourceUrlAllowed(source, canonicalFinalUrl)) {
      rejected++; reasons.set("source_url_domain_mismatch", (reasons.get("source_url_domain_mismatch") || 0) + 1); return;
    }
    const title = cleanText(meta(page.html, ["ArticleTitle", "og:title", "twitter:title"]) || candidate.cleaned_title || candidate.raw_title);
    const pageBodyText = bodyText(page.html);
    const rawSummary = firstRequiredSummary(requiredBodyParagraph(page.html));
    const keywords = [...new Set([...parseList(candidate.keywords_json), ...matches(pageBodyText, CORE_TERMS)].filter(Boolean))].slice(0, 10);
    const summary = ensureRequiredSummaryTerm(rawSummary, title, keywords);
    const publishedAt = parseDate([
      candidate.published_at,
      meta(page.html, ["PubDate", "article:published_time", "publishdate", "publish-date", "dc.date", "date", "Date"]),
      page.html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1],
      page.finalUrl,
      url,
      title,
      rawSummary,
    ].filter(Boolean).join(" "));
    if (!title || title.length < 6) {
      rejected++; reasons.set("title_too_short", (reasons.get("title_too_short") || 0) + 1); return;
    }
    if (!summary || summary.length < 12) {
      rejected++; reasons.set("summary_too_short", (reasons.get("summary_too_short") || 0) + 1); return;
    }
    if (!hasRequiredSummaryTerm(summary)) {
      rejected++; reasons.set("summary_required_term_missing", (reasons.get("summary_required_term_missing") || 0) + 1); return;
    }
    if (!inRange(publishedAt)) {
      rejected++; reasons.set("published_at_out_of_range", (reasons.get("published_at_out_of_range") || 0) + 1); return;
    }
    const relevance = isRelevant(title, pageBodyText, keywords, source.name);
    if (!relevance.ok) {
      rejected++; reasons.set("keyword_not_matched", (reasons.get("keyword_not_matched") || 0) + 1); return;
    }
    const status = await insertArticle(connection, crawlRunId, source, candidate, {
      title,
      summary,
      bodyText: pageBodyText,
      canonicalUrl: canonicalFinalUrl,
      publishedAt,
      keywords: [...new Set([...keywords, ...relevance.matches])].slice(0, 10),
      category: /企业|产业|company|market|industry/i.test(`${title} ${summary} ${pageBodyText}`) ? "enterprise" : /政策|自然资源|标准|policy|standard/i.test(`${title} ${summary} ${pageBodyText}`) ? "policy" : "technology",
    });
    if (status === "inserted") inserted++;
    if (status === "duplicate") duplicate++;
  });

  await connection.query(
    "UPDATE crawl_runs SET status=?,coverage_status=?,accepted_count=?,rejected_count=?,finished_at=NOW(3),note=? WHERE id=?",
    [
      inserted > 0 ? "succeeded" : "failed",
      "best_effort",
      inserted,
      rejected,
      `Candidate replay inserted=${inserted}, duplicates=${duplicate}, rejects=${JSON.stringify(Object.fromEntries(reasons))}`,
      crawlRunId,
    ],
  );
  console.log(JSON.stringify({
    crawlRunId,
    scanned: rows.length,
    inserted,
    duplicate,
    rejected,
    qualifiedTotal: await qualifiedCount(connection),
    rejectReasons: Object.fromEntries(reasons),
  }, null, 2));
  await connection.end();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
