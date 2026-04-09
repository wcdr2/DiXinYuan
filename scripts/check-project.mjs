import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
const listLikeUrlPatterns = [
  /\/list(?:[_/-]|$)/i,
  /\/lists\/index\//i,
  /\/content\/index\//i,
  /\/news\/list_/i,
  /\/xyxw\.htm$/i,
  /\/Applications\/Observing_the_Earth$/i,
  /\/zfwj\/zxwj\/?$/i,
  /\/xwzx\/?$/i,
];

const blockedOriginalHosts = new Set(["gzw.gxzf.gov.cn", "gxt.gxzf.gov.cn"]);
const blockedWordCloudTerms = new Set([
  "热点新闻",
  "近日",
  "详细内容",
  "点击查看",
  "更多内容",
  "月份例行新闻发布",
  "例行新闻发布会",
  "能力提升",
  "服务能力",
  "平台能力",
  "创新研究院",
  "信息创新研究院",
  "中国科学院",
  "data",
]);

const templateArtifactPattern = /(?:title|content|time)_(?:value|vaule)|['"`]\s*\+\s*[a-z_]{2,}\s*\+\s*['"`]?/i;

function isDetailLikeUrl(value) {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(String(value));
    const currentPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (currentPath === "/") {
      return false;
    }

    return !listLikeUrlPatterns.some((pattern) => pattern.test(currentPath));
  } catch {
    return false;
  }
}

function isBlockedOriginalUrl(value) {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    const current = new URL(String(value));
    return blockedOriginalHosts.has(current.hostname);
  } catch {
    return false;
  }
}

function isSpecificUrl(value, sourceUrl) {
  if (!isHttpUrl(value) || isBlockedOriginalUrl(value)) {
    return false;
  }

  try {
    const current = new URL(String(value));
    const source = sourceUrl ? new URL(String(sourceUrl)) : null;
    const currentPath = current.pathname.replace(/\/+$/, "") || "/";
    const sourcePath = source ? source.pathname.replace(/\/+$/, "") || "/" : "/";

    if (currentPath === "/" && !current.search) {
      return false;
    }

    if (source && current.origin === source.origin && currentPath === sourcePath && !current.search) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function getArticleRouteSegment(article) {
  const normalizedSlug = String(article.slug ?? "")
    .normalize("NFKC")
    .replace(/[%]+/g, "")
    .replace(/[\\/?#]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return normalizedSlug ? `${article.id}-${normalizedSlug}` : article.id;
}

function getSourceTarget(source) {
  return (
    source.crawlRule?.entryUrl ??
    source.crawlRule?.apiUrl ??
    source.crawlRule?.feedUrls?.[0] ??
    source.crawlRule?.fallbackEntryUrls?.[0] ??
    source.siteUrl
  );
}

const articles = readJson("datasets/generated/articles.json");
const sources = readJson("datasets/generated/sources.json");
const graph = readJson("datasets/generated/knowledge-graph.json");
const wordCloud = readJson("datasets/generated/word-cloud.json");
const logs = readJson("datasets/generated/logs.json");
const summary = readJson("datasets/generated/summary.json");

const errors = [];
const warnings = [];

const articleIdSet = new Set();
const articleRouteSet = new Set();
const articleSourceNames = new Set(articles.map((article) => article.sourceName));
const sourceNameSet = new Set(sources.map((source) => source.name));
const entityIdSet = new Set(graph.entities.map((entity) => entity.id));

for (const article of articles) {
  if (!article.id || articleIdSet.has(article.id)) {
    errors.push(`Duplicate or missing article id: ${article.id}`);
  }
  articleIdSet.add(article.id);

  if (!article.title || !article.summary) {
    errors.push(`Article missing title or summary: ${article.id}`);
  }

  if (templateArtifactPattern.test(`${article.title} ${article.summary}`)) {
    errors.push(`Article contains template artifact text: ${article.id}`);
  }

  if (!sourceNameSet.has(article.sourceName)) {
    errors.push(`Article source is not registered: ${article.id} -> ${article.sourceName}`);
  }

  if (!isHttpUrl(article.originalUrl) || !isHttpUrl(article.sourceUrl)) {
    errors.push(`Article URLs are invalid: ${article.id}`);
  }

  if (isBlockedOriginalUrl(article.originalUrl)) {
    errors.push(`Article originalUrl points to a blocked or unsafe host: ${article.id} -> ${article.originalUrl}`);
  }

  if (!isSpecificUrl(article.originalUrl, article.sourceUrl)) {
    errors.push(`Article originalUrl is not specific enough: ${article.id} -> ${article.originalUrl}`);
  }

  if (!isDetailLikeUrl(article.originalUrl)) {
    errors.push(`Article originalUrl is still pointing to a list or landing page: ${article.id} -> ${article.originalUrl}`);
  }

  const routeSegment = getArticleRouteSegment(article);
  if (articleRouteSet.has(routeSegment)) {
    errors.push(`Duplicate article route segment: ${routeSegment}`);
  }
  articleRouteSet.add(routeSegment);
}

for (const source of sources) {
  if (!isHttpUrl(source.siteUrl)) {
    errors.push(`Source siteUrl is invalid: ${source.id}`);
  }

  const targetUrl = getSourceTarget(source);
  if (!isHttpUrl(targetUrl)) {
    errors.push(`Source crawl target is invalid: ${source.id}`);
  }

  if (targetUrl === source.siteUrl) {
    warnings.push(`Source target is still at site root instead of a concrete page: ${source.id}`);
  }

  if (source.isActive && !articleSourceNames.has(source.name)) {
    warnings.push(`Active source currently has no published articles: ${source.id}`);
  }
}

for (const entity of graph.entities) {
  for (const articleId of entity.relatedArticleIds) {
    if (!articleIdSet.has(articleId)) {
      errors.push(`Entity references missing article: ${entity.id} -> ${articleId}`);
    }
  }
}

for (const edge of graph.edges) {
  if (!entityIdSet.has(edge.sourceEntityId) || !entityIdSet.has(edge.targetEntityId)) {
    errors.push(`Graph edge references missing entity: ${edge.sourceEntityId} -> ${edge.targetEntityId}`);
  }

  for (const articleId of edge.evidenceArticleIds ?? []) {
    if (!articleIdSet.has(articleId)) {
      errors.push(`Graph edge references missing evidence article: ${edge.sourceEntityId} -> ${articleId}`);
    }
  }
}

for (const category of ["all", "enterprise", "technology", "policy"]) {
  const items = wordCloud.filter((item) => item.category === category);
  if (items.length === 0) {
    errors.push(`Word cloud category is empty: ${category}`);
  }

  for (const item of items) {
    if (!item.term || item.articleCount < 1 || item.weight < 1) {
      errors.push(`Invalid word cloud item in ${category}: ${JSON.stringify(item)}`);
    }

    if (blockedWordCloudTerms.has(item.term) || /^[息力化性度台链层项版观察]/.test(item.term)) {
      errors.push(`Word cloud term looks incomplete or blocked in ${category}: ${item.term}`);
    }
  }
}

const guangxiArticles = articles.filter((article) => article.isGuangxiRelated).length;

if (summary.totalArticles !== articles.length) {
  errors.push(`Summary totalArticles mismatch: ${summary.totalArticles} vs ${articles.length}`);
}
if (summary.totalSources !== sources.length) {
  errors.push(`Summary totalSources mismatch: ${summary.totalSources} vs ${sources.length}`);
}
if (summary.totalEntities !== graph.entities.length) {
  errors.push(`Summary totalEntities mismatch: ${summary.totalEntities} vs ${graph.entities.length}`);
}
if (summary.totalEdges !== graph.edges.length) {
  errors.push(`Summary totalEdges mismatch: ${summary.totalEdges} vs ${graph.edges.length}`);
}
if (summary.guangxiArticles !== guangxiArticles) {
  errors.push(`Summary guangxiArticles mismatch: ${summary.guangxiArticles} vs ${guangxiArticles}`);
}
if (Number.isNaN(Date.parse(summary.latestUpdateAt))) {
  errors.push(`Summary latestUpdateAt is not a valid date: ${summary.latestUpdateAt}`);
}

const logSourceIds = new Set();
for (const log of logs) {
  if (!sources.find((source) => source.id === log.sourceId)) {
    errors.push(`Log references missing source: ${log.sourceId}`);
  }
  if (logSourceIds.has(log.sourceId)) {
    warnings.push(`Multiple log rows found for source: ${log.sourceId}`);
  }
  logSourceIds.add(log.sourceId);
}

for (const relativePath of [
  "app/globals.css",
  "components/site-shell.tsx",
  "components/article-card.tsx",
  "components/graph-explorer.tsx",
  "components/word-cloud.tsx",
  "public/imagery/hero-field.svg",
  "public/imagery/radar-eye.svg",
  "public/imagery/geo-network.svg",
  "public/imagery/guangxi-contour.svg",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing critical file: ${relativePath}`);
  }
}

if (errors.length > 0) {
  console.error("Project audit failed.\n");
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  if (warnings.length > 0) {
    console.error("\nWarnings:");
    for (const warning of warnings) {
      console.error(`WARN: ${warning}`);
    }
  }
  process.exit(1);
}

console.log("Project audit passed.");
console.log(`Articles: ${articles.length}, Sources: ${sources.length}, Entities: ${graph.entities.length}, Edges: ${graph.edges.length}`);
if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}


