import fs from "node:fs";
import path from "node:path";
import { guangxiCityIds, guangxiCityProfiles, guangxiProvince } from "../datasets/seed/guangxi-regions-base.mjs";

const root = process.cwd();
const expectedGraphRegionIds = [guangxiProvince.id, ...guangxiCityIds];
const expectedRegionLabels = new Set(["全国", guangxiProvince.labelZh, ...guangxiCityProfiles.map((city) => city.labelZh)]);
const suspiciousTextPattern = /(?:�|锟|鈥|骞胯タ|鍖楅儴婀|涓讳綋|鍥捐氨|绌洪棿淇℃伅)/;
const templateArtifactPattern = /(?:title|content|time)_(?:value|vaule)|['"`]\s*\+\s*[a-z_]{2,}\s*\+\s*['"`]?/i;
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isBlockedOriginalUrl(value) {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    return blockedOriginalHosts.has(new URL(String(value)).hostname);
  } catch {
    return false;
  }
}

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

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
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

const sourceNameSet = new Set(sources.map((source) => source.name));
const articleIdSet = new Set();
const articleRouteSet = new Set();
const entityMap = new Map(graph.entities.map((entity) => [entity.id, entity]));
const graphRegionScopeIds = (graph.regionScopes ?? []).map((scope) => scope.id);
const graphRegionScopeSet = new Set(graphRegionScopeIds);
const mapRegionIds = map.regions.map((region) => region.id);
const mapRegionIdSet = new Set(mapRegionIds);
const geometryIdSet = new Set((map.geometryAssets ?? []).map((asset) => asset.id));
const graphLayerKeys = ["subject", "goal", "content", "activity", "evaluation"];
const abstractCitySubjectPattern = /协同主体|承载主体|创新人才主体/;

for (const article of articles) {
  assert(Boolean(article.id) && !articleIdSet.has(article.id), `Duplicate or missing article id: ${article.id}`, errors);
  articleIdSet.add(article.id);
  assert(Boolean(article.title && article.summary), `Article missing title or summary: ${article.id}`, errors);
  assert(!templateArtifactPattern.test(`${article.title} ${article.summary}`), `Article contains template artifact text: ${article.id}`, errors);
  assert(sourceNameSet.has(article.sourceName), `Article source is not registered: ${article.id} -> ${article.sourceName}`, errors);
  assert(isHttpUrl(article.originalUrl) && isHttpUrl(article.sourceUrl), `Article URLs are invalid: ${article.id}`, errors);
  assert(!isBlockedOriginalUrl(article.originalUrl), `Article originalUrl points to a blocked host: ${article.id}`, errors);
  assert(isDetailLikeUrl(article.originalUrl), `Article originalUrl is not a detail page: ${article.id}`, errors);
  assert(Array.isArray(article.regionTags) && article.regionTags.length > 0, `Article regionTags are missing: ${article.id}`, errors);
  assert(!(article.regionTags ?? []).includes("北部湾"), `Article still contains 北部湾 region tag: ${article.id}`, errors);
  assert((article.regionTags ?? []).every((tag) => expectedRegionLabels.has(tag)), `Article regionTags contain unsupported values: ${article.id}`, errors);
  if (article.isGuangxiRelated) {
    assert((article.regionTags ?? []).some((tag) => tag !== "全国"), `Guangxi-related article lacks Guangxi region tag: ${article.id}`, errors);
  }

  const routeSegment = getArticleRouteSegment(article);
  assert(!articleRouteSet.has(routeSegment), `Duplicate article route segment: ${routeSegment}`, errors);
  articleRouteSet.add(routeSegment);
}

for (const source of sources) {
  assert(isHttpUrl(source.siteUrl), `Source siteUrl is invalid: ${source.id}`, errors);
}

const elementCounts = new Map();
for (const entity of graph.entities) {
  assert(Boolean(entity.elementClass), `Entity missing elementClass: ${entity.id}`, errors);
  if (entity.elementClass) {
    elementCounts.set(entity.elementClass, (elementCounts.get(entity.elementClass) ?? 0) + 1);
  }
}

for (const requiredClass of ["subject", "goal", "content", "activity", "evaluation"]) {
  assert((elementCounts.get(requiredClass) ?? 0) > 0, `Knowledge graph layer is empty: ${requiredClass}`, errors);
}

assert(graph.entities.length >= 90, `Knowledge graph entity count is too small: ${graph.entities.length}`, errors);
assert(graph.edges.length >= 180, `Knowledge graph edge count is too small: ${graph.edges.length}`, errors);
assert(JSON.stringify(graphRegionScopeIds) === JSON.stringify(expectedGraphRegionIds), `Knowledge graph regionScopes mismatch: ${graphRegionScopeIds.join(",")}`, errors);
assert(!graphRegionScopeSet.has("beibu-gulf"), "Knowledge graph regionScopes still contain beibu-gulf.", errors);
assert(!(graph.entities ?? []).some((entity) => entity.id === "beibu-gulf"), "Knowledge graph entities still contain beibu-gulf.", errors);
assert(graph.views?.layered?.columns?.length === 5, "Knowledge graph layered view columns are missing or incomplete.", errors);

for (const edge of graph.edges) {
  assert(entityMap.has(edge.sourceEntityId) && entityMap.has(edge.targetEntityId), `Graph edge references missing entity: ${edge.sourceEntityId} -> ${edge.targetEntityId}`, errors);
  assert(
    (edge.evidenceArticleIds?.length ?? 0) > 0 || (edge.evidenceRefs?.length ?? 0) > 0,
    `Graph edge has no evidence: ${edge.sourceEntityId} -> ${edge.targetEntityId}`,
    errors,
  );
  (edge.evidenceRefs ?? [])
    .filter((ref) => ref.kind === "research")
    .forEach((ref) => {
      assert(isHttpUrl(ref.url), `Graph research evidence is missing a source URL: ${edge.sourceEntityId} -> ${edge.targetEntityId} (${ref.title})`, errors);
    });
}

for (const cityId of guangxiCityIds) {
  const cityNode = entityMap.get(cityId);
  assert(Boolean(cityNode), `City region node is missing from graph: ${cityId}`, errors);
  assert(cityNode?.elementClass === "content" && cityNode?.type === "region", `City region node type is invalid: ${cityId}`, errors);
  assert((cityNode?.sourceRefs ?? []).some((ref) => isHttpUrl(ref.url)), `City region node lacks source refs: ${cityId}`, errors);

  const expectedSubjects = [
    `${cityId}-government-subject`,
    `${cityId}-industry-subject`,
    `${cityId}-innovation-subject`,
  ];

  expectedSubjects.forEach((subjectId) => {
    const entity = entityMap.get(subjectId);
    assert(Boolean(entity), `City subject is missing: ${subjectId}`, errors);
    assert(entity?.elementClass === "subject", `City subject elementClass is invalid: ${subjectId}`, errors);
    assert((entity?.regionIds ?? []).includes(cityId), `City subject is not scoped to its city: ${subjectId}`, errors);
    assert(!abstractCitySubjectPattern.test(entity?.name ?? ""), `City subject still uses an abstract name: ${subjectId} -> ${entity?.name}`, errors);
    assert((entity?.sourceRefs ?? []).length > 0, `City subject is missing source refs: ${subjectId}`, errors);
    (entity?.sourceRefs ?? []).forEach((ref) => {
      assert(isHttpUrl(ref.url), `City subject source URL is invalid: ${subjectId} -> ${ref.title}`, errors);
    });
  });

  graphLayerKeys.forEach((layerKey) => {
    const scopedEntities = graph.entities.filter((entity) => {
      if (entity.id === cityId || entity.elementClass !== layerKey) {
        return false;
      }
      return entity.parentId === cityId || (entity.regionIds ?? []).includes(cityId);
    });
    assert(scopedEntities.length > 0, `City layer is empty after generation: ${cityId} -> ${layerKey}`, errors);

    scopedEntities.forEach((entity) => {
      const hasDirectCityRelation = graph.edges.some(
        (edge) =>
          (edge.sourceEntityId === cityId && edge.targetEntityId === entity.id) ||
          (edge.targetEntityId === cityId && edge.sourceEntityId === entity.id),
      );
      assert(hasDirectCityRelation, `City network center is missing direct ${layerKey} relation: ${cityId} -> ${entity.id}`, errors);
    });
  });
}

for (const item of wordCloud) {
  assert(Boolean(item.term) && item.articleCount >= 1 && item.weight >= 1, `Invalid word cloud item: ${JSON.stringify(item)}`, errors);
  assert(!blockedWordCloudTerms.has(item.term), `Blocked word cloud term detected: ${item.term}`, errors);
}

assert(Array.isArray(map.regions) && map.regions.length === guangxiCityIds.length, `Map region count is invalid: ${map.regions?.length ?? 0}`, errors);
assert(Array.isArray(map.geometryAssets) && map.geometryAssets.length === guangxiCityIds.length, `Map geometry asset count is invalid: ${map.geometryAssets?.length ?? 0}`, errors);
assert(!mapRegionIdSet.has("beibu-gulf"), "Map regions still contain beibu-gulf.", errors);
assert(!geometryIdSet.has("beibu-gulf"), "Map geometry assets still contain beibu-gulf.", errors);
assert(guangxiCityIds.every((cityId) => mapRegionIdSet.has(cityId)), "Map regions are missing one or more Guangxi cities.", errors);
assert(guangxiCityIds.every((cityId) => geometryIdSet.has(cityId)), "Map geometry assets are missing one or more Guangxi cities.", errors);

for (const region of map.regions) {
  assert(region.type === "city", `Map region type must be city: ${region.id}`, errors);
  assert(region.graphRegionId === region.id, `Map region graphRegionId mismatch: ${region.id} -> ${region.graphRegionId}`, errors);
  assert(!("memberRegionIds" in region) || region.memberRegionIds == null, `Map region should not contain memberRegionIds: ${region.id}`, errors);
  assert(guangxiCityIds.includes(region.id), `Unexpected map region id: ${region.id}`, errors);
  assert(geometryIdSet.has(region.geometryKey), `Map region references missing geometry asset: ${region.id} -> ${region.geometryKey}`, errors);
  assert(region.bdDistrictName && typeof region.bdDistrictName === "string", `Map region bdDistrictName is missing: ${region.id}`, errors);
  assert((region.articleIds?.length ?? 0) === region.articleCount, `Map region articleCount mismatch: ${region.id}`, errors);
  assert((region.keywordHighlights?.length ?? 0) <= 8, `Map region keywordHighlights exceed limit: ${region.id}`, errors);

  const entityIds = region.entityIds ?? [];
  entityIds.forEach((entityId) => {
    assert(entityMap.has(entityId), `Map region references missing entity: ${region.id} -> ${entityId}`, errors);
  });

  const subjectEntityCount = entityIds.filter((entityId) => entityMap.get(entityId)?.elementClass === "subject").length;
  assert(subjectEntityCount === region.subjectEntityCount, `Map region subjectEntityCount mismatch: ${region.id}`, errors);
  assert(subjectEntityCount >= 3, `Map region subjectEntityCount is too small: ${region.id}`, errors);

  [`${region.id}-government-subject`, `${region.id}-industry-subject`, `${region.id}-innovation-subject`].forEach((entityId) => {
    assert(entityIds.includes(entityId), `Map region is missing required subject coverage: ${region.id} -> ${entityId}`, errors);
  });
}

assert(map.metrics?.regionCount === map.regions.length, `Map metrics regionCount mismatch: ${map.metrics?.regionCount} vs ${map.regions.length}`, errors);
assert(map.metrics?.cityCount === map.regions.length, `Map metrics cityCount mismatch: ${map.metrics?.cityCount} vs ${map.regions.length}`, errors);
assert(map.metrics?.priorityRegionCount === map.regions.filter((region) => region.isPriorityRegion).length, "Map metrics priorityRegionCount mismatch.", errors);
assert(map.metrics?.totalArticles === articles.length, `Map metrics totalArticles mismatch: ${map.metrics?.totalArticles} vs ${articles.length}`, errors);
assert(map.metrics?.totalGraphEntities === graph.entities.length, `Map metrics totalGraphEntities mismatch: ${map.metrics?.totalGraphEntities} vs ${graph.entities.length}`, errors);

assert(summary.totalArticles === articles.length, `Summary totalArticles mismatch: ${summary.totalArticles} vs ${articles.length}`, errors);
assert(summary.totalSources === sources.filter((source) => source.isActive).length, `Summary totalSources mismatch: ${summary.totalSources}`, errors);
assert(summary.totalEntities === graph.entities.length, `Summary totalEntities mismatch: ${summary.totalEntities} vs ${graph.entities.length}`, errors);
assert(summary.totalEdges === graph.edges.length, `Summary totalEdges mismatch: ${summary.totalEdges} vs ${graph.edges.length}`, errors);
assert(summary.guangxiArticles === articles.filter((article) => article.isGuangxiRelated).length, `Summary guangxiArticles mismatch: ${summary.guangxiArticles}`, errors);

for (const log of logs) {
  if (!sources.find((source) => source.id === log.sourceId)) {
    warnings.push(`Log references missing source: ${log.sourceId}`);
  }
}

for (const relativePath of [
  "datasets/seed/guangxi-regions-base.mjs",
  "datasets/seed/map-region-base.mjs",
  "datasets/seed/graph-research-base.mjs",
  "components/graph-explorer.tsx",
  "components/map-explorer.tsx",
  "components/map-preview.tsx",
  "app/[lang]/map/page.tsx",
  "app/[lang]/knowledge-graph/page.tsx",
  "lib/site.ts",
  "datasets/generated/knowledge-graph.json",
  "datasets/generated/map.json",
]) {
  const text = readText(relativePath);
  assert(!suspiciousTextPattern.test(text), `Suspicious mojibake text detected in ${relativePath}`, errors);
}

if (errors.length > 0) {
  console.error("Project audit failed.\n");
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  if (warnings.length > 0) {
    console.error("\nWarnings:");
    warnings.forEach((warning) => console.error(`WARN: ${warning}`));
  }
  process.exit(1);
}

console.log("Project audit passed.");
console.log(`Articles: ${articles.length}, Sources: ${sources.length}, Entities: ${graph.entities.length}, Edges: ${graph.edges.length}`);
if (warnings.length > 0) {
  console.log("Warnings:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
