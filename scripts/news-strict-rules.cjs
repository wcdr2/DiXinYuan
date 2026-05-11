const fs = require("fs");

const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息", "实景三维", "时空智能",
  "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

const LOW_RELEVANCE_TERMS = [
  "党委", "党支部", "党建", "理论学习", "民主生活会", "巡视", "干部", "任职", "任免",
  "统战", "工会", "团委", "学生会", "本科教学", "教学指导", "招生", "招聘会", "篮球",
  "足球", "运动会", "慰问", "职工代表大会", "年度工作会议", "会议通知",
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

function coreTerms() {
  const yaml = fs.readFileSync("backend/src/main/resources/application.yml", "utf8");
  const match = yaml.match(/core-keywords:\s*>\s*\n([\s\S]*?)\n\s*min-core-keyword-matches:/);
  if (!match) throw new Error("Cannot read app.strict-relevance.core-keywords.");
  return [...new Set(match[1].split(",").map((item) => item.replace(/\r?\n/g, " ").trim()).filter(Boolean))];
}

function whitelist() {
  const parsed = JSON.parse(fs.readFileSync("datasets/config/entity-whitelist.json", "utf8"));
  const byId = new Map();
  const terms = [];
  for (const entity of parsed.entities || []) {
    const values = [entity.name, ...(entity.aliases || [])].map((item) => String(item || "").trim()).filter(Boolean);
    byId.set(entity.id, values);
    terms.push(...values);
  }
  return { byId, terms: [...new Set(terms)] };
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(value) {
  return decodeEntities(String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function bodyTextFromHtml(html) {
  const paragraphs = [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((item) => item.length >= 20);
  const text = paragraphs.length > 0
    ? [...new Set(paragraphs)].join(" ")
    : cleanText(String(html || "").match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html);
  return text.length > 20000 ? text.slice(0, 20000) : text;
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function hasRequiredSummaryTerm(value) {
  return REQUIRED_SUMMARY_TERMS.some((term) => String(value || "").includes(term));
}

function summaryFromBody(summary, bodyText) {
  const left = normalize(summary);
  const right = normalize(bodyText);
  return Boolean(left && right && right.includes(left));
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

function matches(text, terms) {
  const seen = new Set();
  for (const term of terms) {
    if (contains(text, term)) seen.add(term);
  }
  return [...seen];
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

function host(value) {
  try {
    return new URL(String(value || "").trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceUrlAllowed(row) {
  const articleHost = host(row.original_url);
  if (!articleHost) return false;
  const allowed = new Set([host(row.site_url)].filter(Boolean));
  let rule = {};
  try {
    rule = typeof row.crawl_rule_json === "string" ? JSON.parse(row.crawl_rule_json || "{}") : row.crawl_rule_json || {};
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

function isDetailUrl(value) {
  if (!value) return false;
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    return false;
  }
  if (!/^https?:$/i.test(url.protocol)) return false;
  const lower = (url.pathname || "/").toLowerCase().replace(/\/+$/, "");
  if (!lower || lower === "/") return false;
  const search = url.searchParams;
  if (search.has("id") && /(news|show|detail|view|index\.php|\.aspx?)$/i.test(lower)) return true;
  if (/\/(news|dt|list|index|category|tag|author|search)$/.test(lower)) return false;
  if (/\/(?:index|list)(?:[_-]\d+)*\.s?html?$/.test(lower)) return false;
  if (/\/(informationdetail|news_view|solution_view|products_view|case_view|shows)(?:\/|$)/.test(lower)) return true;
  if (/\/(content|detail|details|info|article|blog-article|announcement|post|story|blog|press|press_releases|press-releases|event|events|id|art|show|news)\//.test(lower)) return true;
  if (/^\/20\d{6}\/[0-9a-f]{16,}\/[ac]\.html$/i.test(lower)) return true;
  const file = lower.slice(lower.lastIndexOf("/") + 1);
  if (/^[a-z]\d{4,}\.s?html?$/i.test(file)) return true;
  if (/^t\d+(?:_\d+)?\.s?html?$/i.test(file)) return true;
  if (/^\d{5,}\.s?html?$/i.test(file)) return !lower.includes("/list/");
  if (!file.includes(".") && file.length >= 12 && (file.match(/-/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  if (!file.includes(".") && file.length >= 12 && (file.match(/_/g) || []).length >= 2 && !/\/(category|tag|author|topic|page)\//.test(lower)) return true;
  return /(20\d{2}|\d{6,}).*\.s?html?$/i.test(lower) && !/\/(category|tag|special)\//.test(lower);
}

function inRange(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= new Date("2024-01-01T00:00:00+08:00") && date <= new Date(Date.now() + 60000);
}

function checkBodyRelevance(row, whitelistTerms, keywordsConfig, bodyText) {
  const text = String(bodyText || "");
  const keywords = parseJsonList(row.keywords_json).filter((keyword) => contains(text, keyword));
  const coreMatches = matches(`${text} ${keywords.join(" ")}`, keywordsConfig);
  const entityEvidence = [
    row.source_name,
    ...(whitelistTerms.byId.get(row.whitelist_entity_id) || []),
  ].filter(Boolean);
  const entityMatches = [...matches(text, whitelistTerms.terms), ...entityEvidence];
  const lowContext = LOW_RELEVANCE_TERMS.some((term) => text.includes(term));
  return {
    ok: coreMatches.length >= 2 || (coreMatches.length >= 1 && entityMatches.length >= 1 && !lowContext),
    coreMatches,
    entityMatches,
  };
}

async function verifyUrlWithBody(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 gx-geo-news/strict-rules" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await response.text();
    return {
      accessible: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      finalUrl: response.url,
      bodyText: bodyTextFromHtml(html),
      error: "",
    };
  } catch (error) {
    return { accessible: false, statusCode: 0, finalUrl: "", bodyText: "", error: error.message };
  }
}

async function compliance(row, context, options = {}) {
  const reasons = [];
  if (!row.source_active || !row.whitelist_entity_id || !context.whitelistTerms.byId.has(row.whitelist_entity_id)) {
    reasons.push("source_not_whitelisted");
  }
  if (!inRange(row.published_at)) {
    reasons.push(row.published_at ? "date_out_of_range" : "missing_published_at");
  }
  const detailUrl = isDetailUrl(row.original_url);
  if (!detailUrl) reasons.push("not_detail_url");
  const sourceAllowed = sourceUrlAllowed(row);
  if (!sourceAllowed) reasons.push("source_url_domain_mismatch");
  if (!hasRequiredSummaryTerm(row.summary)) reasons.push("summary_required_term_missing");
  if (normalize(row.title) && normalize(row.title) === normalize(row.summary)) reasons.push("summary_from_title");

  let verification = null;
  let bodyText = cleanText(row.body_text);
  let urlAccessible = row.url_status === "accessible";
  if (options.verifyUrls && detailUrl && sourceAllowed) {
    verification = await verifyUrlWithBody(row.original_url, options.timeoutMs || 15000);
    urlAccessible = verification.accessible;
    if (!bodyText) bodyText = verification.bodyText;
  }
  if (!urlAccessible) reasons.push("original_url_inaccessible");
  if (!bodyText) reasons.push("body_missing");
  if (!summaryFromBody(row.summary, bodyText)) reasons.push("summary_not_from_body");
  const relevance = checkBodyRelevance(row, context.whitelistTerms, context.coreKeywords, bodyText);
  if (!bodyText || !relevance.ok) reasons.push("body_relevance_failed");
  return { qualified: reasons.length === 0, reasons, relevance, verification, bodyText };
}

module.exports = {
  REQUIRED_SUMMARY_TERMS,
  bodyTextFromHtml,
  checkBodyRelevance,
  cleanText,
  compliance,
  coreTerms,
  datasource,
  hasRequiredSummaryTerm,
  inRange,
  isDetailUrl,
  parseJsonList,
  sourceUrlAllowed,
  summaryFromBody,
  verifyUrlWithBody,
  whitelist,
};
