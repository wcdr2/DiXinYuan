const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");

const TARGET = Number(process.env.TARGET_UNIQUE_NEWS || 1000);
const MIN_DATE = new Date(process.env.MIN_PUBLISHED_AT || "2024-01-01T00:00:00+08:00");
const MAX_DATE = new Date(process.env.MAX_PUBLISHED_AT || new Date().toISOString());
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 16);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const RSS_MAX_PAGES = Number(process.env.RSS_MAX_PAGES || 8);
const API_MAX_PAGES = Number(process.env.API_MAX_PAGES || 20);
const HTML_SOURCE_LIMIT = Number(process.env.HTML_SOURCE_LIMIT || 45);
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dryRun");
const SOURCE_CODES = (process.env.SOURCE_CODES || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const SOURCE_SCOPE = String(process.env.SOURCE_SCOPE || "all").trim().toLowerCase();

const REQUIRED_SUMMARY_TERMS = [
  "\u5730\u7403\u4fe1\u606f\u79d1\u5b66",
  "\u9065\u611f",
  "\u6d4b\u7ed8",
  "GIS",
  "\u5317\u6597",
  "\u7a7a\u5929\u4fe1\u606f",
  "\u5b9e\u666f\u4e09\u7ef4",
  "\u65f6\u7a7a\u667a\u80fd",
  "\u81ea\u7136\u8d44\u6e90\u6570\u5b57\u5316",
  "\u4f4e\u7a7a\u9065\u611f",
  "\u6570\u5b6a\u751f",
  "\u667a\u6167\u57ce\u5e02",
];

const DOMAIN_HINT_TERMS = [
  ...REQUIRED_SUMMARY_TERMS,
  "\u5730\u7406\u4fe1\u606f",
  "\u5730\u7406\u7a7a\u95f4",
  "\u81ea\u7136\u8d44\u6e90",
  "\u56fd\u571f\u7a7a\u95f4",
  "\u536b\u661f",
  "\u5bfc\u822a",
  "\u5b9a\u4f4d",
  "\u65e0\u4eba\u673a",
  "\u4f4e\u7a7a",
  "\u5730\u56fe",
  "ArcGIS",
  "QGIS",
  "geospatial",
  "remote sensing",
  "earth observation",
  "satellite",
  "mapping",
  "surveying",
  "digital twin",
  "smart city",
  "spatiotemporal",
  "location intelligence",
  "LiDAR",
  "photogrammetry",
];

const LOW_RELEVANCE_TERMS = [
  "\u515a\u59d4",
  "\u515a\u5efa",
  "\u515a\u652f\u90e8",
  "\u7406\u8bba\u5b66\u4e60",
  "\u6c11\u4e3b\u751f\u6d3b\u4f1a",
  "\u5de5\u4f1a",
  "\u5e72\u90e8\u4efb\u514d",
  "\u62db\u751f",
  "\u62db\u8058",
  "\u7bee\u7403",
  "\u8db3\u7403",
  "\u8fd0\u52a8\u4f1a",
  "\u6170\u95ee",
];

const GUANGXI_TERMS = [
  "\u5e7f\u897f",
  "\u5357\u5b81",
  "\u6842\u6797",
  "\u67f3\u5dde",
  "\u5317\u6d77",
  "\u9632\u57ce\u6e2f",
  "\u94a6\u5dde",
  "\u8d35\u6e2f",
  "\u7389\u6797",
  "\u767e\u8272",
  "\u8d3a\u5dde",
  "\u6cb3\u6c60",
  "\u6765\u5bbe",
  "\u5d07\u5de6",
  "Guangxi",
];

const SOURCE_PRIORITY = [
  "gx-dnr",
  "gx-gov",
  "lz-dnr",
  "wz-dnr",
  "fcg-dnr",
  "gg-dnr",
  "yl-dnr",
  "bs-dnr",
  "hz-dnr",
  "hc-dnr",
  "lb-dnr",
  "cz-dnr",
  "wl-entity-001",
  "digital-guangxi",
  "glut-cgg",
  "gxu-zyhjcl",
  "cagis",
  "csgpc",
  "mnr",
  "ngcc",
  "aircas",
  "radi-cas",
  "supermap",
  "whu",
  "beidou-gov",
  "nrscc",
  "geovis",
  "piesat",
  "unistrong",
  "southsurvey",
  "huace-nav",
  "bdstar",
  "mapgis",
  "esri-china",
  "gisuni",
  "geospatial-world",
  "directions-mag",
  "directions-mag-articles",
  "arcgis-blog",
  "esri-newsroom",
  "geo-week-news",
  "gis-lounge",
  "gis-geography",
  "geoinformatics",
  "gogeomatics",
  "earth-observation-news",
  "opengeospatial-blog",
  "ogc",
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

function loadSourcesConfig() {
  const configured = JSON.parse(fs.readFileSync("datasets/config/sources.json", "utf8"));
  return configured
    .filter((source) => source.isActive && source.whitelistEntityId && source.crawlRule)
    .filter((source) => SOURCE_CODES.length === 0 || SOURCE_CODES.includes(source.id))
    .filter((source) => {
      if (SOURCE_SCOPE === "guangxi") return isGuangxiText(`${source.id} ${source.name} ${source.siteUrl}`);
      if (SOURCE_SCOPE === "domestic" || SOURCE_SCOPE === "zh") {
        return source.language === "zh" || source.crawlRule?.domestic === true;
      }
      return true;
    })
    .filter((source) => source.crawlRule.apiUrl || source.crawlRule.feedUrls || source.crawlRule.parser === "html-list" || source.crawlRule.parser === "sitemap")
    .sort(sourceSort);
}

function sourceSort(a, b) {
  const priorityA = SOURCE_PRIORITY.indexOf(a.id);
  const priorityB = SOURCE_PRIORITY.indexOf(b.id);
  const rankA = priorityA === -1 ? 1000 : priorityA;
  const rankB = priorityB === -1 ? 1000 : priorityB;
  if (rankA !== rankB) return rankA - rankB;
  const gxA = isGuangxiText(`${a.id} ${a.name} ${a.siteUrl}`) ? 0 : 1;
  const gxB = isGuangxiText(`${b.id} ${b.name} ${b.siteUrl}`) ? 0 : 1;
  if (gxA !== gxB) return gxA - gxB;
  if (a.language !== b.language) return a.language === "zh" ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

function whitelistEntityIds() {
  const whitelist = JSON.parse(fs.readFileSync("datasets/config/entity-whitelist.json", "utf8"));
  return new Set((whitelist.entities || []).map((entity) => entity.id));
}

async function upsertSources(connection, configs) {
  for (const source of configs) {
    await connection.query(
      `INSERT INTO sources(source_code,name,type,site_url,language,trust_level,active,crawl_rule_json,whitelist_entity_id)
       VALUES(?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         type=VALUES(type),
         site_url=VALUES(site_url),
         language=VALUES(language),
         trust_level=VALUES(trust_level),
         active=VALUES(active),
         crawl_rule_json=VALUES(crawl_rule_json),
         whitelist_entity_id=VALUES(whitelist_entity_id)`,
      [
        source.id,
        source.name,
        source.type || "news",
        source.siteUrl,
        source.language || "zh",
        source.trustLevel || "medium",
        source.isActive ? 1 : 0,
        JSON.stringify(source.crawlRule || {}),
        source.whitelistEntityId || "",
      ],
    );
  }
}

async function getDbSources(connection, configs, entityIds) {
  await upsertSources(connection, configs);
  const codes = configs.map((source) => source.id);
  if (codes.length === 0) return new Map();
  const [rows] = await connection.query(
    "SELECT id,source_code,name,site_url,language,whitelist_entity_id,active FROM sources WHERE source_code IN (?)",
    [codes],
  );
  return new Map(rows
    .filter((source) => Number(source.active) === 1)
    .filter((source) => source.whitelist_entity_id && entityIds.has(source.whitelist_entity_id))
    .map((source) => [source.source_code, source]));
}

function cleanHtml(value) {
  return decodeEntities(String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
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
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function hasRequiredSummaryTerm(value) {
  const text = String(value || "");
  return REQUIRED_SUMMARY_TERMS.some((term) => text.includes(term));
}

function requiredTermCount(value) {
  const text = String(value || "");
  return REQUIRED_SUMMARY_TERMS.filter((term) => text.includes(term)).length;
}

function hasDomainHint(value) {
  const lower = String(value || "").toLowerCase();
  return DOMAIN_HINT_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

function isLowRelevance(value) {
  const text = String(value || "");
  return LOW_RELEVANCE_TERMS.some((term) => text.includes(term));
}

function isGuangxiText(value) {
  const lower = String(value || "").toLowerCase();
  return GUANGXI_TERMS.some((term) => lower.includes(term.toLowerCase()));
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

function canonicalUrl(value) {
  return String(value || "").trim().replace(/#.*$/, "").replace(/\/+$/, "");
}

function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function slugify(title, sourceCode, url) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return (slug || `${sourceCode}-${sha(url).slice(0, 8)}`).slice(0, 120).replace(/-+$/, "");
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function inRange(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) && date >= MIN_DATE && date <= MAX_DATE;
}

function parseDate(value) {
  const text = cleanHtml(value);
  if (!text) return null;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  let match = text.match(/(20\d{2})\s*[\u5e74./-]\s*(\d{1,2})\s*[\u6708./-]\s*(\d{1,2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00+08:00`);
  }
  match = text.match(/(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`);
  }
  return null;
}

function parseDateFromMany(values) {
  for (const value of values) {
    const date = parseDate(value);
    if (inRange(date)) return date;
  }
  return null;
}

function xmlField(node, names) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const pattern = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
    const match = node.match(pattern);
    if (match) return decodeEntities(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, ""));
  }
  return "";
}

function xmlAttr(node, tagName, attrName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
  const tag = node.match(pattern)?.[1] || "";
  return attr(tag, attrName);
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return decodeEntities(tag.match(pattern)?.[1] || "");
}

function extractMeta(html, names) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const meta of metas) {
    const attrs = Object.create(null);
    for (const match of meta.matchAll(/([:\w-]+)=["']([^"']*)["']/g)) {
      attrs[match[1].toLowerCase()] = decodeEntities(match[2]);
    }
    const key = (attrs.name || attrs.property || "").toLowerCase();
    if (names.map((item) => item.toLowerCase()).includes(key) && attrs.content) {
      return cleanHtml(attrs.content);
    }
  }
  return "";
}

function extractTitle(html) {
  return firstNonBlank(
    extractMeta(html, ["og:title", "twitter:title", "article:title"]),
    cleanHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""),
    cleanHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
  ).replace(/\s*[-_|].{0,60}$/u, "").trim();
}

function extractParagraphs(html) {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanHtml(match[1]))
    .filter((item) => item.length >= 20);
  if (paragraphs.length > 0) return paragraphs;
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  return cleanHtml(body)
    .split(/(?<=[.!?\u3002\uff01\uff1f])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 40)
    .slice(0, 20);
}

function firstNonBlank(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function summarySnippet(value) {
  const text = cleanHtml(value);
  if (!hasRequiredSummaryTerm(text)) return "";
  if (text.length < 12) return "";
  if (text.length <= 260) return text;
  const indexes = REQUIRED_SUMMARY_TERMS
    .map((term) => text.indexOf(term))
    .filter((index) => index >= 0);
  const first = Math.min(...indexes);
  const start = Math.max(0, first - 90);
  return text.slice(start, start + 260).trim();
}

function chooseNaturalSummary(candidates) {
  for (const candidate of candidates) {
    const summary = summarySnippet(candidate);
    if (summary && hasRequiredSummaryTerm(summary)) return summary;
  }
  return "";
}

function chooseBodySummary(paragraphs, bodyText) {
  return chooseNaturalSummary([...paragraphs, bodyText]);
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 gx-geo-news/natural-summary-backfill",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`HTTP ${response.status}`);
  }
  return { text: await response.text(), finalUrl: response.url, contentType: response.headers.get("content-type") || "" };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 gx-geo-news/natural-summary-backfill",
      "accept": "application/json,text/plain,*/*",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function appendPage(url, page) {
  const parsed = new URL(url);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function rssPageUrl(url, page) {
  if (page <= 1) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("paged", String(page));
  return parsed.toString();
}

async function fetchApiCandidates(source) {
  const rule = source.crawlRule || {};
  if (!rule.apiUrl) return [];
  const maxPages = Math.min(Number(rule.maxPages || API_MAX_PAGES), API_MAX_PAGES);
  const itemLimit = Number(rule.itemLimit || maxPages * 100);
  const candidates = [];
  for (let page = 1; page <= maxPages && candidates.length < itemLimit; page++) {
    let posts;
    try {
      posts = await fetchJson(appendPage(rule.apiUrl, page));
    } catch (error) {
      if (page === 1) console.error(`[${source.id}] api ${error.message}`);
      break;
    }
    if (!Array.isArray(posts) || posts.length === 0) break;
    let sawOlder = false;
    for (const post of posts) {
      const publishedAt = parseDate(post.date_gmt ? `${post.date_gmt}Z` : post.date || "");
      if (publishedAt && publishedAt < MIN_DATE) {
        sawOlder = true;
        continue;
      }
      if (publishedAt && publishedAt > MAX_DATE) continue;
      const title = cleanHtml(post.title?.rendered || post.title || "");
      const url = canonicalUrl(post.link || post.guid?.rendered || "");
      const excerpt = cleanHtml(post.excerpt?.rendered || post.yoast_head_json?.description || "");
      const content = post.content?.rendered || "";
      const paragraphs = extractParagraphs(content);
      if (!title || !url) continue;
      candidates.push({
        sourceCode: source.id,
        title,
        url,
        publishedAt,
        summaryCandidates: [excerpt, ...paragraphs],
        keywords: [],
      });
      if (candidates.length >= itemLimit) break;
    }
    if (sawOlder) break;
  }
  return candidates;
}

async function fetchFeedCandidates(source) {
  const rule = source.crawlRule || {};
  const feedUrls = rule.feedUrls || [];
  const itemLimit = Number(rule.itemLimit || 100);
  const candidates = [];
  const seen = new Set();
  for (const feedUrl of feedUrls) {
    for (let page = 1; page <= RSS_MAX_PAGES && candidates.length < itemLimit; page++) {
      let feed;
      try {
        feed = await fetchText(rssPageUrl(feedUrl, page));
      } catch (error) {
        if (page === 1) console.error(`[${source.id}] feed ${error.message}`);
        break;
      }
      const before = seen.size;
      const nodes = [
        ...(feed.text.match(/<item\b[\s\S]*?<\/item>/gi) || []),
        ...(feed.text.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
      ];
      if (nodes.length === 0) break;
      let sawOlder = false;
      for (const node of nodes) {
        const title = cleanHtml(xmlField(node, ["title"]));
        const link = canonicalUrl(firstNonBlank(
          xmlField(node, ["link"]),
          xmlAttr(node, "link", "href"),
          xmlField(node, ["guid"]),
        ));
        if (!title || !link || seen.has(link)) continue;
        seen.add(link);
        const publishedAt = parseDate(firstNonBlank(
          xmlField(node, ["pubDate"]),
          xmlField(node, ["published"]),
          xmlField(node, ["updated"]),
          xmlField(node, ["dc:date"]),
          xmlField(node, ["date"]),
        ));
        if (publishedAt && publishedAt < MIN_DATE) {
          sawOlder = true;
          continue;
        }
        if (publishedAt && publishedAt > MAX_DATE) continue;
        candidates.push({
          sourceCode: source.id,
          title,
          url: link,
          publishedAt,
          summaryCandidates: [
            xmlField(node, ["description"]),
            xmlField(node, ["summary"]),
            ...extractParagraphs(xmlField(node, ["content:encoded", "content"])),
          ],
          keywords: [],
        });
        if (candidates.length >= itemLimit) break;
      }
      if (page > 1 && seen.size === before) break;
      if (sawOlder) break;
    }
  }
  return candidates;
}

async function fetchHtmlCandidates(source) {
  const rule = source.crawlRule || {};
  const entryUrls = expandHtmlEntryUrls(rule);
  const itemLimit = Math.min(Number(rule.itemLimit || 20), HTML_SOURCE_LIMIT);
  const collectLimit = Math.max(itemLimit, Math.min(itemLimit * 8, HTML_SOURCE_LIMIT * 8));
  const candidates = [];
  const seen = new Set();
  for (const entryUrl of entryUrls) {
    if (candidates.length >= collectLimit) break;
    if (isDetailUrl(entryUrl) && sameHost(entryUrl, source.siteUrl || entryUrl) && linkAllowed(entryUrl, rule)) {
      const url = canonicalUrl(entryUrl);
      if (!seen.has(url)) {
        seen.add(url);
        candidates.push({
          sourceCode: source.id,
          title: "",
          url,
          publishedAt: parseDate(url),
          summaryCandidates: [],
          keywords: [],
        });
      }
      if (candidates.length >= collectLimit) break;
    }
    let page;
    try {
      page = await fetchText(entryUrl);
    } catch (error) {
      console.error(`[${source.id}] html-list ${error.message}`);
      continue;
    }
    const base = page.finalUrl || entryUrl;
    const anchors = [...page.text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    for (const match of anchors) {
      const href = attr(match[1], "href");
      const title = cleanHtml(match[2]);
      if (!href || !title || title.length < 4) continue;
      if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
      let url;
      try {
        url = canonicalUrl(new URL(href, base).toString());
      } catch {
        continue;
      }
      if (seen.has(url)) continue;
      if (!sameHost(url, source.siteUrl || base)) continue;
      if (!linkAllowed(url, rule)) continue;
      if (!isDetailUrl(url)) continue;
      seen.add(url);
      const context = cleanHtml(page.text.slice(Math.max(0, match.index - 180), match.index + match[0].length + 180));
      candidates.push({
        sourceCode: source.id,
        title,
        url,
        publishedAt: parseDate(context) || parseDate(url),
        summaryCandidates: [context],
        keywords: [],
      });
      if (candidates.length >= collectLimit) break;
    }
  }
  return candidates.sort(candidateSort).slice(0, itemLimit);
}

function candidateSort(a, b) {
  const scoreDiff = candidateScore(b) - candidateScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  const dateA = a.publishedAt instanceof Date && !Number.isNaN(a.publishedAt.getTime()) ? a.publishedAt.getTime() : 0;
  const dateB = b.publishedAt instanceof Date && !Number.isNaN(b.publishedAt.getTime()) ? b.publishedAt.getTime() : 0;
  if (dateA !== dateB) return dateB - dateA;
  return String(a.url).localeCompare(String(b.url));
}

function candidateScore(candidate) {
  const text = `${candidate.title || ""} ${(candidate.summaryCandidates || []).join(" ")} ${candidate.url || ""}`;
  let score = 0;
  if (hasRequiredSummaryTerm(text)) score += 80;
  if (hasDomainHint(text)) score += 40;
  if (inRange(candidate.publishedAt)) score += 30;
  if (isLowRelevance(text)) score -= 60;
  if (String(candidate.title || "").length < 6) score -= 80;
  return score;
}

async function fetchSitemapCandidates(source) {
  const rule = source.crawlRule || {};
  const itemLimit = Math.min(Number(rule.itemLimit || 50), Number(process.env.SITEMAP_SOURCE_LIMIT || 200));
  const maxSitemaps = Math.max(1, Number(rule.maxSitemaps || 10));
  const site = String(source.siteUrl || "").replace(/\/+$/, "");
  const queue = [...new Set([
    rule.entryUrl,
    ...(rule.feedUrls || []),
    site ? `${site}/sitemap.xml` : "",
    site ? `${site}/sitemap_index.xml` : "",
  ].map(canonicalUrl).filter(Boolean))];
  const seenSitemaps = new Set();
  const seenUrls = new Set();
  const candidates = [];

  while (queue.length && seenSitemaps.size < maxSitemaps && candidates.length < itemLimit * 4) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    let page;
    try {
      page = await fetchText(sitemapUrl);
    } catch (error) {
      if (seenSitemaps.size === 1) console.error(`[${source.id}] sitemap ${error.message}`);
      continue;
    }
    const locs = [...page.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
      .map((match) => decodeEntities(match[1]).trim())
      .filter(Boolean);
    for (const loc of locs) {
      const url = canonicalUrl(loc);
      if (!url) continue;
      if (/sitemap/i.test(url) && queue.length < maxSitemaps * 3) {
        queue.push(url);
        continue;
      }
      if (seenUrls.has(url)) continue;
      if (!sameHost(url, source.siteUrl || sitemapUrl)) continue;
      if (!linkAllowed(url, rule)) continue;
      if (!isDetailUrl(url)) continue;
      seenUrls.add(url);
      candidates.push({
        sourceCode: source.id,
        title: "",
        url,
        publishedAt: parseDate(url),
        summaryCandidates: [],
        keywords: [],
      });
      if (candidates.length >= itemLimit * 4) break;
    }
  }
  return candidates.sort(candidateSort).slice(0, itemLimit);
}

function expandHtmlEntryUrls(rule) {
  const urls = [rule.entryUrl, ...(rule.fallbackEntryUrls || []), ...(rule.paginationUrls || [])].filter(Boolean);
  for (const templateConfig of normalizePaginationTemplates(rule.paginationTemplate || rule.paginationTemplates)) {
    for (let page = templateConfig.start; page <= templateConfig.end; page++) {
      urls.push(templateConfig.template.replace(/\{page\}/g, String(page)));
    }
  }
  return [...new Set(urls.map(canonicalUrl).filter(Boolean))];
}

function normalizePaginationTemplates(value) {
  const templates = Array.isArray(value) ? value : (value ? [value] : []);
  return templates
    .map((item) => {
      if (typeof item === "string") {
        return { template: item, start: 1, end: 5 };
      }
      return {
        template: String(item.template || ""),
        start: Math.max(1, Number(item.start || 1)),
        end: Math.max(1, Number(item.end || item.maxPages || 5)),
      };
    })
    .filter((item) => item.template.includes("{page}") && item.start <= item.end)
    .map((item) => ({ ...item, end: Math.min(item.end, HTML_SOURCE_LIMIT) }));
}

function linkAllowed(url, rule) {
  const text = String(url || "");
  const deny = rule.linkDenyPatterns || [];
  if (deny.some((pattern) => new RegExp(pattern, "i").test(text))) return false;
  const allow = rule.linkAllowPatterns || [];
  return allow.length === 0 || allow.some((pattern) => new RegExp(pattern, "i").test(text));
}

function sameHost(left, right) {
  try {
    const leftHost = new URL(left).hostname.replace(/^www\./, "");
    const rightHost = new URL(right).hostname.replace(/^www\./, "");
    return leftHost === rightHost || leftHost.endsWith(`.${rightHost}`);
  } catch {
    return false;
  }
}

async function fetchCandidates(source) {
  const candidates = [];
  if (source.crawlRule?.apiUrl) candidates.push(...await fetchApiCandidates(source));
  if (source.crawlRule?.feedUrls) candidates.push(...await fetchFeedCandidates(source));
  if (source.crawlRule?.parser === "html-list") candidates.push(...await fetchHtmlCandidates(source));
  if (source.crawlRule?.parser === "sitemap") candidates.push(...await fetchSitemapCandidates(source));
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = canonicalUrl(candidate.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildArticle(source, candidate) {
  if (!isDetailUrl(candidate.url)) return { rejected: "not_detail_url" };
  let detail;
  try {
    detail = await fetchText(candidate.url);
  } catch {
    return { rejected: "original_url_inaccessible" };
  }
  const finalUrl = canonicalUrl(detail.finalUrl || candidate.url);
  if (!isDetailUrl(finalUrl)) return { rejected: "not_detail_url" };
  const detailTitle = extractTitle(detail.text);
  const title = firstNonBlank(candidate.title, detailTitle);
  if (!title || title.length < 6) return { rejected: "title_too_short" };
  const metaSummary = firstNonBlank(
    extractMeta(detail.text, ["description", "og:description", "twitter:description"]),
    extractMeta(detail.text, ["dc.description", "article:description"]),
  );
  const paragraphs = extractParagraphs(detail.text);
  const bodyText = paragraphs.join(" ");
  const summary = chooseBodySummary(paragraphs, bodyText);
  if (!summary || summary.length < 12) return { rejected: "summary_too_short" };
  if (!hasRequiredSummaryTerm(summary)) return { rejected: "summary_required_term_missing" };
  const publishedAt = candidate.publishedAt || parseDateFromMany([
    extractMeta(detail.text, ["article:published_time", "date", "dc.date", "pubdate", "publishdate", "publish-date"]),
    detail.text.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1] || "",
    detail.text,
    finalUrl,
  ]);
  if (!inRange(publishedAt)) return { rejected: "published_at_out_of_range" };
  const relevanceText = `${bodyText} ${source.name}`;
  if (!hasDomainHint(relevanceText)) return { rejected: "keyword_not_matched" };
  if (isLowRelevance(relevanceText) && requiredTermCount(summary) < 2) return { rejected: "low_relevance_context" };
  return {
    title,
    summary,
    bodyText,
    canonicalUrl: finalUrl,
    publishedAt,
    keywords: keywordMatches(bodyText),
    category: classify(`${title} ${summary} ${bodyText}`),
  };
}

function keywordMatches(text) {
  const lower = String(text || "").toLowerCase();
  return [...new Set(DOMAIN_HINT_TERMS
    .filter((term) => lower.includes(term.toLowerCase()))
    .slice(0, 10))];
}

function classify(text) {
  const lower = String(text || "").toLowerCase();
  if (/company|market|industry|enterprise/.test(lower) || /[\u4ea7\u4e1a\u4f01\u4e1a]/u.test(text)) return "enterprise";
  if (/policy|standard|regulation/.test(lower) || /[\u653f\u7b56\u6807\u51c6]/u.test(text)) return "policy";
  return "technology";
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

async function currentQualifiedCount(connection) {
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

async function existingCanonical(connection, canonicalUrl) {
  const [rows] = await connection.query("SELECT id FROM news WHERE canonical_url=? LIMIT 1", [canonicalUrl]);
  return rows.length > 0;
}

async function insertArticle(connection, crawlRunId, dbSource, article) {
  if (await existingCanonical(connection, article.canonicalUrl)) return "duplicate";
  if (DRY_RUN) return "inserted";
  const contentHash = sha([article.title, article.summary, article.bodyText, article.canonicalUrl, article.publishedAt.toISOString(), article.keywords.join("|")].join("\n"));
  const newsCode = sha(`${dbSource.source_code}::${article.canonicalUrl}`).slice(0, 32);
  const [newsResult] = await connection.query(
    "INSERT INTO news(news_code,source_id,canonical_url,slug,first_seen_at,last_seen_at) VALUES(?,?,?,?,NOW(3),NOW(3))",
    [newsCode, dbSource.id, article.canonicalUrl, slugify(article.title, dbSource.source_code, article.canonicalUrl)],
  );
  const newsId = newsResult.insertId;
  const guangxi = isGuangxiText(`${article.title} ${article.summary} ${dbSource.name}`);
  const regionTags = guangxi ? ["\u5e7f\u897f"] : [dbSource.language === "zh" ? "\u5168\u56fd" : "\u56fd\u9645"];
  const [versionResult] = await connection.query(
    `INSERT INTO news_versions(news_id,crawl_run_id,title,summary,cover_image,source_url,original_url,published_at,language,category,keywords_json,region_tags_json,entity_ids_json,is_guangxi_related,content_hash,url_verified_at,url_status,final_url,body_text)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3),'accessible',?,?)`,
    [
      newsId,
      crawlRunId,
      article.title,
      article.summary,
      "",
      dbSource.site_url,
      article.canonicalUrl,
      mysqlDate(article.publishedAt),
      dbSource.language || "zh",
      article.category,
      JSON.stringify(article.keywords),
      JSON.stringify(regionTags),
      JSON.stringify([dbSource.whitelist_entity_id]),
      guangxi ? 1 : 0,
      contentHash,
      article.canonicalUrl,
      article.bodyText,
    ],
  );
  await connection.query("UPDATE news SET current_version_id=?, updated_at=NOW(3) WHERE id=?", [versionResult.insertId, newsId]);
  return "inserted";
}

async function main() {
  const configs = loadSourcesConfig();
  const entityIds = whitelistEntityIds();
  const connection = await mysql.createConnection(datasource());
  const dbSources = await getDbSources(connection, configs, entityIds);
  const [runResult] = DRY_RUN
    ? [{ insertId: null }]
    : await connection.query(
      "INSERT INTO crawl_runs(run_type,triggered_by,status,coverage_status,accepted_count,rejected_count,started_at,window_start_at,window_end_at,note) VALUES('natural-summary-backfill','manual','running','running',0,0,NOW(3),?,?,'Natural summary strict backfill')",
      [mysqlDate(MIN_DATE), mysqlDate(MAX_DATE)],
    );
  const crawlRunId = runResult.insertId;
  const totals = {
    scannedSources: 0,
    scannedCandidates: 0,
    inserted: 0,
    duplicates: 0,
    rejected: 0,
    rejectReasons: new Map(),
    sourceStats: [],
  };
  const seenRunUrls = new Set();

  try {
    for (const sourceConfig of configs) {
      const dbSource = dbSources.get(sourceConfig.id);
      if (!dbSource) continue;
      if (!DRY_RUN && await currentQualifiedCount(connection) >= TARGET) break;
      totals.scannedSources++;
      const candidates = (await fetchCandidates(sourceConfig))
        .filter((candidate) => {
          const key = canonicalUrl(candidate.url);
          if (!key || seenRunUrls.has(key)) return false;
          seenRunUrls.add(key);
          return true;
        });
      totals.scannedCandidates += candidates.length;
      const sourceReasons = new Map();
      const articles = await mapLimit(candidates, CONCURRENCY, async (candidate) => {
        const article = await buildArticle(dbSource, candidate);
        return { candidate, article };
      });
      let sourceInserted = 0;
      let sourceDuplicate = 0;
      let sourceRejected = 0;
      for (const item of articles) {
        if (!DRY_RUN && await currentQualifiedCount(connection) >= TARGET) break;
        if (item.article.rejected) {
          totals.rejected++;
          sourceRejected++;
          totals.rejectReasons.set(item.article.rejected, (totals.rejectReasons.get(item.article.rejected) || 0) + 1);
          sourceReasons.set(item.article.rejected, (sourceReasons.get(item.article.rejected) || 0) + 1);
          continue;
        }
        const status = await insertArticle(connection, crawlRunId, dbSource, item.article);
        if (status === "duplicate") {
          totals.duplicates++;
          sourceDuplicate++;
        } else {
          totals.inserted++;
          sourceInserted++;
        }
      }
      const stat = {
        sourceCode: sourceConfig.id,
        candidates: candidates.length,
        inserted: sourceInserted,
        duplicates: sourceDuplicate,
        rejected: sourceRejected,
        reasons: Object.fromEntries(sourceReasons),
      };
      totals.sourceStats.push(stat);
      console.log(`[${sourceConfig.id}] candidates=${stat.candidates} inserted=${stat.inserted} duplicates=${stat.duplicates} rejected=${stat.rejected} reasons=${JSON.stringify(stat.reasons)}`);
    }

    if (!DRY_RUN) {
      await connection.query(
        "UPDATE crawl_runs SET status=?,coverage_status=?,accepted_count=?,rejected_count=?,finished_at=NOW(3),note=? WHERE id=?",
        [
          totals.inserted > 0 ? "succeeded" : "failed",
          "best_effort",
          totals.inserted,
          totals.rejected,
          `Natural summary strict backfill inserted=${totals.inserted}, duplicates=${totals.duplicates}, rejects=${JSON.stringify(Object.fromEntries(totals.rejectReasons))}`,
          crawlRunId,
        ],
      );
    }

    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      crawlRunId,
      scannedSources: totals.scannedSources,
      scannedCandidates: totals.scannedCandidates,
      inserted: totals.inserted,
      duplicates: totals.duplicates,
      rejected: totals.rejected,
      qualifiedTotal: DRY_RUN ? await currentQualifiedCount(connection) : await currentQualifiedCount(connection),
      rejectReasons: Object.fromEntries(totals.rejectReasons),
      topSources: totals.sourceStats.filter((item) => item.inserted > 0).slice(0, 30),
    }, null, 2));
  } catch (error) {
    if (!DRY_RUN && crawlRunId) {
      await connection.query("UPDATE crawl_runs SET status='failed',coverage_status='partial',finished_at=NOW(3),note=? WHERE id=?", [error.stack || error.message, crawlRunId]);
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
