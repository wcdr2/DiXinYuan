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
const map = readJson("datasets/generated/map.json");
const summary = readJson("datasets/generated/summary.json");

const errors = [];
const warnings = [];

const articleIdSet = new Set();
const articleRouteSet = new Set();
const articleSourceNames = new Set(articles.map((article) => article.sourceName));
const sourceNameSet = new Set(sources.map((source) => source.name));
const entityIdSet = new Set(graph.entities.map((entity) => entity.id));
const elementCounts = new Map();
const graphRegionScopeIds = new Set((graph.regionScopes ?? []).map((scope) => scope.id));
const mapRegionIdSet = new Set((map.regions ?? []).map((region) => region.id));
const geometryIdSet = new Set((map.geometryAssets ?? []).map((asset) => asset.id));

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
  if (!entity.elementClass) {
    errors.push(`Entity missing elementClass: ${entity.id}`);
  } else {
    elementCounts.set(entity.elementClass, (elementCounts.get(entity.elementClass) ?? 0) + 1);
  }

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

  if ((!edge.evidenceArticleIds || edge.evidenceArticleIds.length === 0) && (!edge.evidenceRefs || edge.evidenceRefs.length === 0)) {
    errors.push(`Graph edge has no evidence: ${edge.sourceEntityId} -> ${edge.targetEntityId}`);
  }

  for (const articleId of edge.evidenceArticleIds ?? []) {
    if (!articleIdSet.has(articleId)) {
      errors.push(`Graph edge references missing evidence article: ${edge.sourceEntityId} -> ${articleId}`);
    }
  }
}

for (const requiredClass of ["subject", "goal", "content", "activity", "evaluation"]) {
  if (!elementCounts.get(requiredClass)) {
    errors.push(`Knowledge graph layer is empty: ${requiredClass}`);
  }
}

if ((graph.entities?.length ?? 0) < 60) {
  errors.push(`Knowledge graph entity count is too small: ${graph.entities.length}`);
}

if ((graph.edges?.length ?? 0) < 100) {
  errors.push(`Knowledge graph edge count is too small: ${graph.edges.length}`);
}

if (!Array.isArray(graph.regionScopes) || graph.regionScopes.length < 6) {
  errors.push("Knowledge graph regionScopes are missing or incomplete.");
}

if (!graph.views?.layered?.columns || graph.views.layered.columns.length !== 5) {
  errors.push("Knowledge graph layered view columns are missing or incomplete.");
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

if (!Array.isArray(map.regions) || map.regions.length !== 15) {
  errors.push(`Map region count is invalid: ${map.regions?.length ?? 0}`);
}

if (!Array.isArray(map.geometryAssets) || map.geometryAssets.length < 15) {
  errors.push(`Map geometry asset count is invalid: ${map.geometryAssets?.length ?? 0}`);
}

if (!map.viewBox || typeof map.viewBox !== "string") {
  errors.push("Map viewBox is missing or invalid.");
}

const mapCityCount = map.regions.filter((region) => region.type === "city").length;
const mapSpecialRegionCount = map.regions.filter((region) => region.type === "special-region").length;

if (mapCityCount !== 14) {
  errors.push(`Map city count is invalid: ${mapCityCount}`);
}

if (mapSpecialRegionCount !== 1) {
  errors.push(`Map special-region count is invalid: ${mapSpecialRegionCount}`);
}

for (const region of map.regions) {
  if (!region.id || !region.name || !region.nameEn || !region.summary || !region.summaryEn) {
    errors.push(`Map region metadata is incomplete: ${region.id}`);
  }

  if (!Array.isArray(region.center) || region.center.length !== 2 || region.center.some((value) => typeof value !== "number")) {
    errors.push(`Map region center is invalid: ${region.id}`);
  }

  if (region.zoom != null && typeof region.zoom !== "number") {
    errors.push(`Map region zoom is invalid: ${region.id}`);
  }

  if (!region.bdDistrictName || typeof region.bdDistrictName !== "string") {
    errors.push(`Map region bdDistrictName is missing: ${region.id}`);
  }

  if (!geometryIdSet.has(region.geometryKey)) {
    errors.push(`Map region references missing geometry asset: ${region.id} -> ${region.geometryKey}`);
  }

  if ((region.articleIds?.length ?? 0) !== region.articleCount) {
    errors.push(`Map region articleCount mismatch: ${region.id} -> ${region.articleCount} vs ${region.articleIds?.length ?? 0}`);
  }

  const categoryTotal =
    (region.categoryCounts?.enterprise ?? 0) +
    (region.categoryCounts?.technology ?? 0) +
    (region.categoryCounts?.policy ?? 0);
  if (categoryTotal !== region.articleCount) {
    errors.push(`Map region category count mismatch: ${region.id} -> ${categoryTotal} vs ${region.articleCount}`);
  }

  if ((region.keywordHighlights?.length ?? 0) > 8) {
    errors.push(`Map region keywordHighlights exceed limit: ${region.id}`);
  }

  for (const articleId of region.articleIds ?? []) {
    if (!articleIdSet.has(articleId)) {
      errors.push(`Map region references missing article: ${region.id} -> ${articleId}`);
    }
  }

  for (const articleId of region.latestArticleIds ?? []) {
    if (!articleIdSet.has(articleId)) {
      errors.push(`Map region references missing latest article: ${region.id} -> ${articleId}`);
    }
  }

  for (const entityId of region.entityIds ?? []) {
    if (!entityIdSet.has(entityId)) {
      errors.push(`Map region references missing entity: ${region.id} -> ${entityId}`);
    }
  }

  const subjectEntityCount = (region.entityIds ?? []).filter(
    (entityId) => graph.entities.find((entity) => entity.id === entityId)?.elementClass === "subject",
  ).length;

  if (subjectEntityCount !== region.subjectEntityCount) {
    errors.push(`Map region subjectEntityCount mismatch: ${region.id} -> ${region.subjectEntityCount} vs ${subjectEntityCount}`);
  }

  if (region.graphRegionId && !graphRegionScopeIds.has(region.graphRegionId)) {
    errors.push(`Map region graphRegionId is invalid: ${region.id} -> ${region.graphRegionId}`);
  }

  if (region.type === "city" && region.memberRegionIds?.length) {
    errors.push(`City region should not contain memberRegionIds: ${region.id}`);
  }

  if (region.type === "special-region") {
    if (!Array.isArray(region.memberRegionIds) || region.memberRegionIds.length === 0) {
      errors.push(`Special map region missing memberRegionIds: ${region.id}`);
    }

    for (const memberRegionId of region.memberRegionIds ?? []) {
      if (!mapRegionIdSet.has(memberRegionId)) {
        errors.push(`Special map region references missing member region: ${region.id} -> ${memberRegionId}`);
      }
    }
  }
}

const legendModes = new Set((map.legend ?? []).map((item) => item.mode));
for (const mode of ["all", "enterprise", "technology", "policy"]) {
  if (!legendModes.has(mode)) {
    errors.push(`Map legend is missing mode: ${mode}`);
  }
}

for (const item of map.legend ?? []) {
  if (!Array.isArray(item.ranges) || item.ranges.length === 0) {
    errors.push(`Map legend ranges are missing: ${item.mode}`);
  }
}

if (map.metrics?.regionCount !== map.regions.length) {
  errors.push(`Map metrics regionCount mismatch: ${map.metrics?.regionCount} vs ${map.regions.length}`);
}

if (map.metrics?.cityCount !== mapCityCount) {
  errors.push(`Map metrics cityCount mismatch: ${map.metrics?.cityCount} vs ${mapCityCount}`);
}

if (map.metrics?.specialRegionCount !== mapSpecialRegionCount) {
  errors.push(`Map metrics specialRegionCount mismatch: ${map.metrics?.specialRegionCount} vs ${mapSpecialRegionCount}`);
}

if (map.metrics?.totalArticles !== articles.length) {
  errors.push(`Map metrics totalArticles mismatch: ${map.metrics?.totalArticles} vs ${articles.length}`);
}

if (map.metrics?.totalGraphEntities !== graph.entities.length) {
  errors.push(`Map metrics totalGraphEntities mismatch: ${map.metrics?.totalGraphEntities} vs ${graph.entities.length}`);
}

if (Number.isNaN(Date.parse(map.updatedAt))) {
  errors.push(`Map updatedAt is not a valid date: ${map.updatedAt}`);
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
  "components/map-explorer.tsx",
  "components/map-preview.tsx",
  "components/word-cloud.tsx",
  "app/[lang]/map/page.tsx",
  "datasets/seed/map-region-base.mjs",
  "lib/baidu-map.ts",
  ".env.example",
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


