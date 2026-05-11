const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const {
  REQUIRED_SUMMARY_TERMS,
  bodyTextFromHtml,
  cleanText,
  compliance,
  coreTerms,
  datasource,
  hasRequiredSummaryTerm,
  whitelist,
} = require("./news-strict-rules.cjs");

const AUDIT_CSV = process.argv[2] || process.env.AUDIT_CSV || latestCleanupCsv();
const TARGET = Number(process.env.TARGET_UNIQUE_NEWS || 800);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 12);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const REMOVED_SOURCE_CODES = new Set(["news-cn", "people-cn", "cctv-cn", "stdaily", "chinanews", "gov-cn"]);

function latestCleanupCsv() {
  const dir = path.join("target", "audit");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir)
        .filter((file) => /^noncompliant-cleanup-\d+\.csv$/.test(file))
        .map((file) => path.join(dir, file))
        .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    : [];
  if (!files.length) throw new Error("No cleanup audit CSV found. Pass a path as the first argument.");
  return files[0];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const header = rows.shift() || [];
  return rows
    .filter((item) => item.length === header.length)
    .map((item) => Object.fromEntries(header.map((key, index) => [key, item[index]])));
}

function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function canonicalUrl(value) {
  return String(value || "").trim().replace(/#.*$/, "").replace(/\/+$/, "");
}

function limitText(value, maxLength) {
  const text = cleanText(value);
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function slugify(title, sourceCode, url) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return (slug || `${sourceCode}-${sha(url).slice(0, 8)}`).slice(0, 120).replace(/-+$/, "");
}

function mysqlDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalize(value) {
  return cleanText(value).toLowerCase();
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

function termMatches(text, terms) {
  const seen = new Set();
  for (const term of terms) {
    if (contains(text, term)) seen.add(term);
  }
  return [...seen];
}

function pickTitle(html, fallback) {
  const candidates = [
    html.match(/<meta[^>]+(?:name|property|itemprop)=["'](?:ArticleTitle|og:title|twitter:title|headline)["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property|itemprop)=["'](?:ArticleTitle|og:title|twitter:title|headline)["']/i)?.[1],
    html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    fallback,
  ];
  return cleanText(candidates.find((item) => cleanText(item).length >= 6) || fallback)
    .replace(/\s*[-_|].{0,40}$/, "")
    .trim();
}

function chooseSummary(bodyText, title) {
  const body = cleanText(bodyText);
  const sentences = body
    .split(/(?<=[。！？.!?])\s*/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12 && item.length <= 260);
  const sentence = sentences.find((item) => hasRequiredSummaryTerm(item) && normalize(item) !== normalize(title));
  if (sentence) return sentence;
  for (const term of REQUIRED_SUMMARY_TERMS) {
    const index = body.indexOf(term);
    if (index < 0) continue;
    const start = Math.max(0, index - 90);
    const end = Math.min(body.length, index + term.length + 170);
    const summary = body.slice(start, end).trim();
    if (summary.length >= 12 && hasRequiredSummaryTerm(summary) && normalize(summary) !== normalize(title)) {
      return summary;
    }
  }
  return "";
}

function categoryFor(text) {
  const lower = text.toLowerCase();
  if (/企业|产业|company|market|industry|enterprise/i.test(lower)) return "enterprise";
  if (/政策|自然资源|标准|policy|standard|regulation/i.test(lower)) return "policy";
  return "technology";
}

function regionTagsFor(text, language) {
  return /广西|南宁|柳州|桂林|梧州|北海|防城港|钦州|贵港|玉林|百色|贺州|河池|来宾|崇左|guangxi/i.test(text)
    ? ["广西"]
    : [language === "zh" ? "全国" : "国际"];
}

async function fetchPage(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/cleanup-restore" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) {
    return null;
  }
  return { finalUrl: response.url, html: await response.text() };
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function qualifiedCount(connection) {
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM news");
  return Number(rows[0].total);
}

async function insertArticle(connection, crawlRunId, source, article) {
  const title = limitText(article.title, 240);
  const summary = limitText(article.summary, 260);
  const bodyText = cleanText(article.bodyText);
  const [existing] = await connection.query("SELECT id FROM news WHERE source_id=? AND canonical_url=? LIMIT 1", [
    source.id,
    article.url,
  ]);
  if (existing.length) return "duplicate";
  const newsCode = sha(`${source.source_code}::${article.url}`).slice(0, 32);
  const contentHash = sha([
    title,
    summary,
    bodyText,
    article.url,
    mysqlDate(article.publishedAt),
    article.keywords.join("|"),
  ].join("\n"));
  const [newsResult] = await connection.query(
    "INSERT INTO news(news_code,source_id,canonical_url,slug,first_seen_at,last_seen_at) VALUES(?,?,?,?,NOW(3),NOW(3))",
    [newsCode, source.id, article.url, slugify(title, source.source_code, article.url)],
  );
  try {
    const regionTags = regionTagsFor(`${title} ${summary} ${bodyText} ${source.name}`, source.language);
    const [versionResult] = await connection.query(
      `INSERT INTO news_versions(news_id,crawl_run_id,title,summary,cover_image,source_url,original_url,published_at,language,category,keywords_json,region_tags_json,entity_ids_json,is_guangxi_related,content_hash,url_verified_at,url_status,final_url,body_text)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3),'accessible',?,?)`,
      [
        newsResult.insertId,
        crawlRunId,
        title,
        summary,
        "",
        source.site_url,
        article.url,
        mysqlDate(article.publishedAt),
        source.language || "zh",
        categoryFor(`${title} ${summary} ${bodyText}`),
        JSON.stringify(article.keywords),
        JSON.stringify(regionTags),
        JSON.stringify([source.whitelist_entity_id]),
        regionTags.includes("广西") ? 1 : 0,
        contentHash,
        article.url,
        bodyText,
      ],
    );
    await connection.query("UPDATE news SET current_version_id=?, updated_at=NOW(3) WHERE id=?", [
      versionResult.insertId,
      newsResult.insertId,
    ]);
  } catch (error) {
    await connection.query("DELETE FROM news WHERE id=?", [newsResult.insertId]);
    throw error;
  }
  return "inserted";
}

async function main() {
  const seenRows = new Set();
  const rows = parseCsv(fs.readFileSync(AUDIT_CSV, "utf8"))
    .filter((row) => row.will_delete === "true")
    .filter((row) => row.original_url && row.source_code && !REMOVED_SOURCE_CODES.has(row.source_code))
    .filter((row) => {
      const key = `${row.source_code}::${canonicalUrl(row.original_url)}`;
      if (seenRows.has(key)) return false;
      seenRows.add(key);
      return true;
    });
  const connection = await mysql.createConnection(datasource());
  const [sources] = await connection.query(
    "SELECT id,source_code,name,site_url,language,whitelist_entity_id,active,crawl_rule_json FROM sources WHERE active=1",
  );
  const sourceByCode = new Map(sources.map((source) => [source.source_code, source]));
  const context = { whitelistTerms: whitelist(), coreKeywords: coreTerms() };
  const [runResult] = await connection.query(
    "INSERT INTO crawl_runs(run_type,triggered_by,status,coverage_status,accepted_count,rejected_count,started_at,window_start_at,window_end_at,note) VALUES('cleanup-restore','manual','running','running',0,0,NOW(3),'2024-01-01 00:00:00',NOW(3),?)",
    [`Restoring candidates from ${AUDIT_CSV}`],
  );
  const crawlRunId = runResult.insertId;

  let inserted = 0;
  let duplicate = 0;
  let rejected = 0;
  const reasons = new Map();
  const orderedRows = rows.sort((left, right) => {
    const leftSource = sourceByCode.get(left.source_code);
    const rightSource = sourceByCode.get(right.source_code);
    const leftText = `${left.source_code} ${leftSource?.name || ""} ${leftSource?.site_url || ""}`;
    const rightText = `${right.source_code} ${rightSource?.name || ""} ${rightSource?.site_url || ""}`;
    const leftPriority = [/广西|guangxi|gx/i.test(leftText) ? 0 : 1, leftSource?.language === "zh" ? 0 : 1, Number(left.news_id || 0)];
    const rightPriority = [/广西|guangxi|gx/i.test(rightText) ? 0 : 1, rightSource?.language === "zh" ? 0 : 1, Number(right.news_id || 0)];
    return leftPriority[0] - rightPriority[0] || leftPriority[1] - rightPriority[1] || leftPriority[2] - rightPriority[2];
  });

  await mapLimit(orderedRows, CONCURRENCY, async (row) => {
    if ((await qualifiedCount(connection)) >= TARGET) return;
    const source = sourceByCode.get(row.source_code);
    if (!source || !source.whitelist_entity_id) {
      rejected++;
      reasons.set("source_not_whitelisted", (reasons.get("source_not_whitelisted") || 0) + 1);
      return;
    }
    let page;
    try {
      page = await fetchPage(row.original_url);
    } catch {
      rejected++;
      reasons.set("original_url_inaccessible", (reasons.get("original_url_inaccessible") || 0) + 1);
      return;
    }
    if (!page) {
      rejected++;
      reasons.set("original_url_inaccessible", (reasons.get("original_url_inaccessible") || 0) + 1);
      return;
    }
    const articleUrl = canonicalUrl(page.finalUrl || row.original_url);
    const bodyText = cleanText(bodyTextFromHtml(page.html));
    const title = pickTitle(page.html, row.title);
    const summary = chooseSummary(bodyText, title);
    const keywords = [...new Set(termMatches(`${title} ${summary} ${bodyText}`, context.coreKeywords))].slice(0, 10);
    const complianceRow = {
      source_active: source.active,
      whitelist_entity_id: source.whitelist_entity_id,
      published_at: row.published_at,
      original_url: articleUrl,
      site_url: source.site_url,
      crawl_rule_json: source.crawl_rule_json,
      summary,
      title,
      url_status: "accessible",
      body_text: bodyText,
      source_name: source.name,
      source_code: source.source_code,
      keywords_json: JSON.stringify(keywords),
    };
    const result = await compliance(complianceRow, context, { verifyUrls: false });
    if (!result.qualified) {
      rejected++;
      for (const reason of result.reasons) reasons.set(reason, (reasons.get(reason) || 0) + 1);
      return;
    }
    const status = await insertArticle(connection, crawlRunId, source, {
      title,
      summary,
      bodyText,
      url: articleUrl,
      publishedAt: row.published_at,
      keywords,
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
      `cleanup restore inserted=${inserted}, duplicates=${duplicate}, rejected=${JSON.stringify(Object.fromEntries(reasons))}`,
      crawlRunId,
    ],
  );
  console.log(JSON.stringify({
    crawlRunId,
    auditCsv: AUDIT_CSV,
    scanned: orderedRows.length,
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
