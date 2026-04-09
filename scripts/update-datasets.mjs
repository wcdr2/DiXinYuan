import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const configDir = path.join(rootDir, "datasets", "config");
const seedDir = path.join(rootDir, "datasets", "seed");
const generatedDir = path.join(rootDir, "datasets", "generated");

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) CodexCrawler/1.0 Safari/537.36";

const zhStopwords = new Set([
  "广西",
  "推进",
  "能力",
  "应用",
  "相关",
  "工作",
  "领域",
  "发展",
  "建设",
  "服务",
  "持续",
  "成为",
  "年度",
  "重点",
  "围绕",
]);

const enStopwords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "work",
  "support",
  "services",
  "service",
  "driven",
  "continue",
  "continues",
]);

const domainPhrases = [
  "地理信息",
  "实景三维",
  "低空经济",
  "北斗应用",
  "海洋地理信息",
  "遥感",
  "灾害监测",
  "调查监测",
  "智能测绘",
  "时空信息",
  "数字孪生",
  "GeoAI",
  "geospatial",
  "digital twin",
  "remote sensing",
  "Earth observation",
  "satellite",
  "测绘",
  "空间智能",
  "北斗",
];

const categoryHints = {
  policy: ["政策", "部署", "行动", "工作要点", "monitoring", "survey", "public service"],
  enterprise: ["企业", "产业园", "platform", "enterprise", "industry", "供给"],
  technology: ["技术", "遥感", "digital twin", "GeoAI", "智能测绘", "空间智能"],
};

const guangxiTokens = ["广西", "南宁", "北部湾", "桂林", "柳州", "防城港", "北海"];

const coverThemes = [
  "teal-grid",
  "deep-ocean",
  "satellite-night",
  "copper-lines",
  "emerald-topo",
  "marine-signal",
  "navy-pulse",
  "aurora-mesh",
  "polar-orbit",
  "lagoon-grid",
  "graphite-shore",
  "scholar-blueprint",
];

const noisePatterns = [
  /\.css(?:\?|$)/i,
  /\.js(?:\?|$)/i,
  /\.png(?:\?|$)/i,
  /\.jpe?g(?:\?|$)/i,
  /\.svg(?:\?|$)/i,
  /\.gif(?:\?|$)/i,
  /mailto:/i,
  /javascript:/i,
  /#$/,
  /\/index(?:\.s?html)?$/i,
  /\/list[_-]/i,
  /\/lists\/index\//i,
  /\/content\/index\//i,
  /\/search/i,
  /\/login/i,
  /\/download/i,
];

const detailUrlPatterns = [
  /\/detail\/\d+\.html$/i,
  /\/content\/id\/\d+\.html$/i,
  /\/info\/\d+\/\d+\.htm$/i,
  /\/a\/news\/\d+_\d+\.html$/i,
  /\/announcement\//i,
  /\/blog-article\//i,
  /\/Applications\/Observing_the_Earth\/.+/i,
  /\/dtxw\/.+t\d+_\d+\.html$/i,
  /\/t\d+\.(?:s?html)$/i,
];

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

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, ""));
}

function cleanWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return cleanWhitespace(String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function slugify(value) {
  return cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitKeywords(value) {
  return unique(
    decodeHtmlEntities(value)
      .split(/[;,，、|]/)
      .map((item) => cleanWhitespace(item))
      .filter((item) => item.length >= 2 && item.length <= 24),
  );
}

function createArticleId(sourceId, originalUrl, title) {
  return createHash("sha1")
    .update(`${sourceId}::${originalUrl || title}`)
    .digest("hex")
    .slice(0, 16);
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTitle(rawTitle, sourceName) {
  let title = decodeHtmlEntities(stripTags(rawTitle));
  if (!title) {
    return "";
  }

  const escapedSource = escapeRegExp(sourceName);
  title = title.replace(new RegExp(`\\s*[-|｜_].*${escapedSource}.*$`, "i"), "");
  title = title.replace(/\s*[-|｜_].*$/, "");
  return cleanWhitespace(title);
}

function pickFirst(...values) {
  return values.find((value) => cleanWhitespace(value));
}

function getMetaContent(html, names) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+property=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapeRegExp(name)}["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapeRegExp(name)}["']`, "i"),
    ];

    for (const pattern of patterns) {
      const matched = html.match(pattern)?.[1];
      if (matched) {
        return cleanWhitespace(decodeHtmlEntities(matched));
      }
    }
  }

  return "";
}

function extractParagraphs(html) {
  return unique(
    [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => decodeHtmlEntities(stripTags(match[1])))
      .filter((paragraph) => paragraph.length >= 40),
  );
}

function parsePublishedAt(value, language) {
  const input = cleanWhitespace(value);
  if (!input) {
    return null;
  }

  const withTime = input.match(/(20\d{2})[-\/.年](\d{1,2})[-\/.月](\d{1,2})(?:[日\sT]+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (withTime) {
    const [, year, month, day, hour = "00", minute = "00"] = withTime;
    const offset = language === "en" ? "+00:00" : "+08:00";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00${offset}`;
  }

  const slashFormat = input.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (slashFormat) {
    const [, day, month, year] = slashFormat;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+00:00`;
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

function classifyArticle(article) {
  if (article.category) {
    return article.category;
  }

  const text = `${article.title} ${article.summary}`.toLowerCase();
  let matchedCategory = "technology";
  let matchedScore = -1;

  for (const [category, hints] of Object.entries(categoryHints)) {
    const score = hints.reduce(
      (count, hint) => count + (text.includes(hint.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > matchedScore) {
      matchedCategory = category;
      matchedScore = score;
    }
  }

  return matchedCategory;
}

function detectGuangxi(article) {
  if (typeof article.isGuangxiRelated === "boolean") {
    return article.isGuangxiRelated;
  }

  const text = `${article.title} ${article.summary} ${(article.regionTags ?? []).join(" ")}`;
  return guangxiTokens.some((token) => text.includes(token));
}

function extractKeywordCandidates(article) {
  const bag = new Map();
  const rawKeywords = article.keywords ?? [];
  rawKeywords.forEach((keyword) => {
    bag.set(keyword, (bag.get(keyword) ?? 0) + 3);
  });

  const fullText = `${article.title} ${article.summary}`;

  domainPhrases.forEach((phrase) => {
    if (fullText.toLowerCase().includes(phrase.toLowerCase())) {
      bag.set(phrase, (bag.get(phrase) ?? 0) + 2);
    }
  });

  const zhParts = fullText.match(/[\u4e00-\u9fa5]{2,8}/g) ?? [];
  zhParts.forEach((token) => {
    if (!zhStopwords.has(token) && token.length <= 8) {
      bag.set(token, (bag.get(token) ?? 0) + 1);
    }
  });

  const enParts = fullText.match(/[A-Za-z][A-Za-z-]{2,}/g) ?? [];
  enParts.forEach((token) => {
    const normalized = token.toLowerCase();
    if (!enStopwords.has(normalized)) {
      bag.set(token, (bag.get(token) ?? 0) + 1);
    }
  });

  return [...bag.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([term]) => term)
    .slice(0, 8);
}

function resolveEntities(article, baseEntities) {
  const text = `${article.title} ${article.summary} ${(article.keywords ?? []).join(" ")}`;
  const matched = new Set(article.entityIds ?? []);

  baseEntities.forEach((entity) => {
    const candidates = [entity.name, ...(entity.aliases ?? [])];
    if (candidates.some((candidate) => text.includes(candidate))) {
      matched.add(entity.id);
    }
  });

  return [...matched];
}

function isSpecificSourceUrl(originalUrl, sourceUrl) {
  if (!originalUrl) {
    return false;
  }

  try {
    const original = new URL(originalUrl);
    const source = sourceUrl ? new URL(sourceUrl) : null;
    const originalPath = original.pathname.replace(/\/+$/, "") || "/";
    const sourcePath = source ? source.pathname.replace(/\/+$/, "") || "/" : "/";

    if (originalPath === "/" && !original.search) {
      return false;
    }

    if (source && original.origin === source.origin && originalPath === sourcePath && !original.search) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isDetailLikeUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const currentPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (currentPath === "/") {
      return false;
    }

    return !listLikeUrlPatterns.some((pattern) => pattern.test(currentPath));
  } catch {
    return false;
  }
}

function scoreSourceTarget(candidateUrl, sourceUrl) {
  if (!candidateUrl || !isSpecificSourceUrl(candidateUrl, sourceUrl)) {
    return -100;
  }

  try {
    const candidate = new URL(candidateUrl);
    const currentPath = candidate.pathname.replace(/\/+$/, "") || "/";
    let score = currentPath.split("/").filter(Boolean).length;

    if (detailUrlPatterns.some((pattern) => pattern.test(currentPath))) {
      score += 10;
    }

    if (listLikeUrlPatterns.some((pattern) => pattern.test(currentPath))) {
      score -= 8;
    }

    if (candidate.search) {
      score += 1;
    }

    if (sourceUrl && candidate.origin === new URL(sourceUrl).origin) {
      score += 2;
    }

    return score;
  } catch {
    return -100;
  }
}

function getSourceTarget(source) {
  const candidates = unique([
    ...(source?.crawlRule?.fallbackEntryUrls ?? []),
    source?.crawlRule?.entryUrl,
    source?.crawlRule?.apiUrl,
    source?.crawlRule?.feedUrls?.[0],
    source?.siteUrl,
  ]);

  return (
    candidates
      .map((candidateUrl) => ({
        candidateUrl,
        score: scoreSourceTarget(candidateUrl, source?.siteUrl),
      }))
      .sort((left, right) => right.score - left.score)[0]?.candidateUrl ??
    source?.siteUrl ??
    ""
  );
}

function resolveOriginalUrl(article, source) {
  if (
    isSpecificSourceUrl(article.originalUrl, source?.siteUrl ?? article.sourceUrl) &&
    isDetailLikeUrl(article.originalUrl)
  ) {
    return article.originalUrl;
  }

  const sourceTarget = getSourceTarget(source);
  if (
    isSpecificSourceUrl(sourceTarget, source?.siteUrl ?? article.sourceUrl) &&
    isDetailLikeUrl(sourceTarget)
  ) {
    return sourceTarget;
  }

  return source?.siteUrl ?? article.sourceUrl ?? article.originalUrl;
}

function normalizeArticle(article, index, baseEntities, sourceLookup) {
  const source = sourceLookup.get(article.sourceName);
  const keywords = unique(extractKeywordCandidates(article));
  const entityIds = unique(resolveEntities(article, baseEntities));
  const regionTags = unique(article.regionTags ?? (detectGuangxi(article) ? ["广西"] : ["全国"]));
  const category = classifyArticle(article);

  return {
    id: article.id ?? `article-${index + 1}`,
    slug: article.slug ?? slugify(article.title ?? `article-${index + 1}`),
    title: article.title,
    summary: article.summary,
    coverImage: article.coverImage ?? coverThemes[index % coverThemes.length],
    sourceName: article.sourceName,
    sourceUrl: source?.siteUrl ?? article.sourceUrl,
    originalUrl: resolveOriginalUrl(article, source),
    publishedAt: article.publishedAt,
    language: article.language === "en" ? "en" : "zh",
    category,
    keywords,
    regionTags,
    isGuangxiRelated: detectGuangxi(article),
    entityIds,
  };
}

function dedupeArticles(articles) {
  const seen = new Set();
  const deduped = [];

  for (const article of articles) {
    const key = `${article.originalUrl || article.title}::${article.sourceName}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(article);
  }

  return deduped;
}

function buildWordCloud(articles) {
  const byCategory = {
    all: new Map(),
    enterprise: new Map(),
    technology: new Map(),
    policy: new Map(),
  };

  articles.forEach((article) => {
    article.keywords.forEach((keyword) => {
      const targetMaps = [byCategory.all, byCategory[article.category]];
      targetMaps.forEach((map) => {
        const entry = map.get(keyword) ?? {
          term: keyword,
          weight: 0,
          category: "all",
          period: "30d",
          articleIds: new Set(),
        };
        entry.weight += 1 + (article.isGuangxiRelated ? 1 : 0);
        entry.articleIds.add(article.id);
        entry.category = map === byCategory.all ? "all" : article.category;
        map.set(keyword, entry);
      });
    });
  });

  return Object.values(byCategory).flatMap((map) =>
    [...map.values()]
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 20)
      .map((entry) => ({
        term: entry.term,
        weight: entry.weight,
        category: entry.category,
        period: "30d",
        articleCount: entry.articleIds.size,
      })),
  );
}

function inferRelation(sourceEntity, targetEntity) {
  if (sourceEntity.type === "region" || targetEntity.type === "region") {
    return "located_in";
  }

  if (sourceEntity.type === "policy" || targetEntity.type === "policy") {
    return "guides";
  }

  if (sourceEntity.type === "technology" || targetEntity.type === "technology") {
    return "supports";
  }

  if (sourceEntity.type === "enterprise" || targetEntity.type === "enterprise") {
    return "drives";
  }

  return "related";
}

function buildKnowledgeGraph(articles, baseEntities) {
  const entityMap = new Map(baseEntities.map((entity) => [entity.id, { ...entity, relatedArticleIds: [] }]));
  const edgeMap = new Map();

  articles.forEach((article) => {
    article.entityIds.forEach((entityId) => {
      if (!entityMap.has(entityId)) {
        return;
      }

      const current = entityMap.get(entityId);
      current.relatedArticleIds = unique([...current.relatedArticleIds, article.id]);
      entityMap.set(entityId, current);
    });

    const relatedIds = unique(article.entityIds).filter((entityId) => entityMap.has(entityId));

    for (let i = 0; i < relatedIds.length; i += 1) {
      for (let j = i + 1; j < relatedIds.length; j += 1) {
        const leftId = relatedIds[i];
        const rightId = relatedIds[j];
        const pairKey = [leftId, rightId].sort().join("::");
        const leftEntity = entityMap.get(leftId);
        const rightEntity = entityMap.get(rightId);
        const existing = edgeMap.get(pairKey) ?? {
          sourceEntityId: leftId,
          targetEntityId: rightId,
          relationType: inferRelation(leftEntity, rightEntity),
          evidenceArticleIds: [],
          weight: 0,
        };
        existing.weight += article.isGuangxiRelated ? 2 : 1;
        existing.evidenceArticleIds = unique([...existing.evidenceArticleIds, article.id]);
        edgeMap.set(pairKey, existing);
      }
    }
  });

  const entities = [...entityMap.values()]
    .filter((entity) => entity.relatedArticleIds.length > 0 || entity.region === "广西")
    .sort((left, right) => right.relatedArticleIds.length - left.relatedArticleIds.length);

  const edges = [...edgeMap.values()]
    .filter((edge) => edge.evidenceArticleIds.length > 0)
    .sort((left, right) => right.weight - left.weight);

  return { entities, edges };
}

function buildSummary(articles, sources, graph) {
  return {
    totalArticles: articles.length,
    totalSources: sources.filter((source) => source.isActive).length,
    guangxiArticles: articles.filter((article) => article.isGuangxiRelated).length,
    latestUpdateAt: new Date().toISOString(),
    totalEntities: graph.entities.length,
    totalEdges: graph.edges.length,
  };
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text,
      contentType: response.headers.get("content-type") ?? "",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      text: "",
      contentType: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json,text/plain,*/*",
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      data: JSON.parse(text),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      data: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function shouldSkipHref(href) {
  return noisePatterns.some((pattern) => pattern.test(href));
}

function isSameHost(candidateUrl, sourceUrl) {
  try {
    return new URL(candidateUrl).hostname === new URL(sourceUrl).hostname;
  } catch {
    return false;
  }
}

function extractAnchors(html, pageUrl) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const href = toAbsoluteUrl(decodeHtmlEntities(match[1]), pageUrl);
      return {
        href,
        text: decodeHtmlEntities(stripTags(match[2])),
      };
    })
    .filter((item) => item.href && item.text);
}

function articlePathPatternsForSource(source) {
  const defaults = [/t\d+\.(?:s?html)$/i, /\/content\/id\/\d+\.html$/i, /\/\d{6,}\//, /\/blog-article\//i];
  const sourceSpecific = {
    "gx-dnr": [/\/xwzx\//i],
    "gx-gov": [/\/sydt\//i, /\/zfwj\//i],
    mnr: [/\/dt\//i, /\/ywbb\//i],
    cagis: [/\/Lists\/content\/id\//i],
    aircas: [/\/dtxw\//i],
    ogc: [/\/blog-article\//i],
    esa: [/\/Applications\/Observing_the_Earth\//i, /\/Newsroom\/Press_Releases\//i],
  };

  return [...defaults, ...(sourceSpecific[source.id] ?? [])];
}

function scoreCandidateLink(source, link) {
  const href = link.href;
  const text = cleanWhitespace(link.text);
  if (!href || !text || shouldSkipHref(href)) {
    return -100;
  }

  let score = 0;
  if (isSameHost(href, source.siteUrl)) {
    score += 4;
  }

  if (articlePathPatternsForSource(source).some((pattern) => pattern.test(href))) {
    score += 8;
  }

  if (text.length >= 8 && text.length <= 120) {
    score += 2;
  }

  if (text.length > 120) {
    score -= 3;
  }

  const lowerText = `${text} ${href}`.toLowerCase();
  for (const keyword of source.crawlRule.whitelist ?? []) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 3;
      break;
    }
  }

  if (domainPhrases.some((phrase) => lowerText.includes(phrase.toLowerCase()))) {
    score += 2;
  }

  if (/list_|index\.html|index\.shtml|lists\/index|content\/index|categories|tag\/|#/.test(lowerText)) {
    score -= 5;
  }

  if (source.id === "esa" && !/earth|climate|satellite|mission|observation/i.test(lowerText)) {
    score -= 4;
  }

  if (source.id === "ogc" && !/geospatial|ogc|standard|api|integration|interoperability/i.test(lowerText)) {
    score -= 4;
  }

  return score;
}

function selectCandidateLinks(source, html, pageUrl) {
  const itemLimit = source.crawlRule.itemLimit ?? 6;
  const seen = new Set();

  return extractAnchors(html, pageUrl)
    .map((link) => ({ ...link, score: scoreCandidateLink(source, link) }))
    .filter((link) => link.score > 0)
    .sort((left, right) => right.score - left.score)
    .filter((link) => {
      if (seen.has(link.href)) {
        return false;
      }
      seen.add(link.href);
      return true;
    })
    .slice(0, itemLimit * 2);
}

function buildSummaryFromParagraphs(paragraphs) {
  const matched = paragraphs.find((paragraph) => paragraph.length >= 60);
  if (matched) {
    return matched.slice(0, 220);
  }
  return paragraphs[0]?.slice(0, 220) ?? "";
}

function isRelevantArticle(source, title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const domainHit = [...(source.crawlRule.whitelist ?? []), ...domainPhrases].some((keyword) =>
    text.includes(keyword.toLowerCase()),
  );
  const guangxiHit = guangxiTokens.some((keyword) => text.includes(keyword.toLowerCase()));

  if (source.id === "ogc") {
    return domainHit || /geospatial|ogc|standard|api|interoperability|integration/i.test(text);
  }

  if (source.id === "esa") {
    return domainHit || /earth observation|satellite|climate|copernicus|mission|meteorological|remote sensing/i.test(text);
  }

  if (["gx-gov", "mnr", "supermap", "whu"].includes(source.id)) {
    return domainHit;
  }

  if (source.id === "cagis") {
    return domainHit || /地理信息|北斗|遥感|测绘|时空/i.test(text);
  }

  return domainHit || guangxiHit;
}

async function parseHtmlArticle(source, link) {
  const response = await fetchText(link.href);
  if (!response.ok) {
    return null;
  }

  const html = response.text;
  const paragraphs = extractParagraphs(html);
  const title = cleanTitle(
    pickFirst(
      getMetaContent(html, ["ArticleTitle", "og:title", "twitter:title"]),
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      link.text,
    ),
    source.name,
  );

  const summary = cleanWhitespace(
    pickFirst(
      getMetaContent(html, ["description", "Description", "og:description", "twitter:description"]),
      buildSummaryFromParagraphs(paragraphs),
      link.text,
    ),
  ).slice(0, 260);

  if (!title || title.length < 6 || !summary || !isRelevantArticle(source, title, summary)) {
    return null;
  }

  const rawPublishedAt = pickFirst(
    getMetaContent(html, ["PubDate", "article:published_time", "publishdate", "publish-date", "dc.date"]),
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1],
    html.match(/(20\d{2}[-\/.年]\d{1,2}[-\/.月]\d{1,2}(?:\s+\d{1,2}:\d{2})?)/)?.[1],
    html.match(/(\d{2}\/\d{2}\/20\d{2})/)?.[1],
  );
  const publishedAt = parsePublishedAt(rawPublishedAt, source.language);
  if (!publishedAt) {
    return null;
  }

  return {
    id: createArticleId(source.id, response.url, title),
    slug: slugify(title),
    title,
    summary,
    coverImage: getMetaContent(html, ["Image", "og:image"]) || undefined,
    sourceName: source.name,
    sourceUrl: source.siteUrl,
    originalUrl: response.url,
    publishedAt,
    language: source.language === "en" ? "en" : "zh",
    category: undefined,
    keywords: splitKeywords(getMetaContent(html, ["Keywords", "keywords"])),
    regionTags: undefined,
    isGuangxiRelated: undefined,
    entityIds: [],
  };
}

async function crawlHtmlSource(source) {
  const itemLimit = source.crawlRule.itemLimit ?? 6;
  const entryUrls = unique([
    source.crawlRule.entryUrl,
    ...(source.crawlRule.fallbackEntryUrls ?? []),
    source.siteUrl,
  ]);

  let selectedLinks = [];
  let lastError = "";

  for (const entryUrl of entryUrls) {
    const response = await fetchText(entryUrl);
    if (!response.ok) {
      lastError = response.error || `HTTP ${response.status}`;
      continue;
    }

    const candidates = selectCandidateLinks(source, response.text, response.url);
    if (candidates.length > 0) {
      selectedLinks = candidates;
      break;
    }
  }

  const detailCandidates = selectedLinks.slice(0, itemLimit);
  const articles = [];

  for (const link of detailCandidates) {
    const article = await parseHtmlArticle(source, link);
    if (article) {
      articles.push(article);
    }
  }

  return {
    articles,
    fetchedCount: detailCandidates.length,
    note:
      articles.length > 0
        ? `实时抓取 ${articles.length} 篇，候选链接 ${detailCandidates.length} 条。`
        : `未抓取到符合规则的文章${lastError ? `：${lastError}` : ""}`,
    error: articles.length > 0 ? "" : lastError,
  };
}

function pickExcerptFromWp(post) {
  return cleanWhitespace(
    decodeHtmlEntities(
      stripTags(post.excerpt?.rendered || post.content?.rendered || ""),
    ),
  ).slice(0, 260);
}

async function crawlWpJsonSource(source) {
  const apiUrl = source.crawlRule.apiUrl;
  if (!apiUrl) {
    return {
      articles: [],
      fetchedCount: 0,
      note: "缺少 API 地址，已跳过。",
      error: "Missing apiUrl",
    };
  }

  const response = await fetchJson(apiUrl);
  if (!response.ok || !Array.isArray(response.data)) {
    return {
      articles: [],
      fetchedCount: 0,
      note: `API 抓取失败${response.error ? `：${response.error}` : ""}`,
      error: response.error || `HTTP ${response.status}`,
    };
  }

  const articles = response.data
    .map((post) => {
      const title = cleanTitle(post.title?.rendered, source.name);
      const summary = pickExcerptFromWp(post);
      if (!title || title.length < 6 || !summary || !isRelevantArticle(source, title, summary)) {
        return null;
      }

      return {
        id: createArticleId(source.id, post.link, title),
        slug: slugify(post.slug || title),
        title,
        summary,
        coverImage: undefined,
        sourceName: source.name,
        sourceUrl: source.siteUrl,
        originalUrl: post.link,
        publishedAt: parsePublishedAt(post.date_gmt || post.date, source.language) ?? new Date().toISOString(),
        language: source.language === "en" ? "en" : "zh",
        category: undefined,
        keywords: splitKeywords(stripTags(post.title?.rendered || "")),
        regionTags: undefined,
        isGuangxiRelated: undefined,
        entityIds: [],
      };
    })
    .filter(Boolean)
    .slice(0, source.crawlRule.itemLimit ?? 8);

  return {
    articles,
    fetchedCount: Array.isArray(response.data) ? response.data.length : 0,
    note: articles.length > 0 ? `通过 API 抓取 ${articles.length} 篇。` : "API 返回成功，但没有匹配到合规文章。",
    error: articles.length > 0 ? "" : "No matched articles",
  };
}

async function crawlSource(source) {
  const startedAt = new Date().toISOString();
  let result;

  if (!source.isActive) {
    result = { articles: [], fetchedCount: 0, note: "来源已停用。", error: "" };
  } else if (source.crawlRule.parser === "wp-json" || source.crawlRule.mode === "api") {
    result = await crawlWpJsonSource(source);
  } else {
    result = await crawlHtmlSource(source);
  }

  const finishedAt = new Date().toISOString();
  return {
    sourceId: source.id,
    sourceName: source.name,
    startedAt,
    finishedAt,
    status: result.articles.length > 0 ? "fetched" : result.error ? "failed" : "skipped",
    fetchedCount: result.fetchedCount,
    articles: result.articles,
    note: result.note,
    error: result.error,
  };
}

function finalizeLogs(sources, crawlResults, dedupedArticles, fallbackSeedArticles) {
  const finalCounts = new Map();
  dedupedArticles.forEach((article) => {
    finalCounts.set(article.sourceName, (finalCounts.get(article.sourceName) ?? 0) + 1);
  });

  const fallbackCounts = new Map();
  fallbackSeedArticles.forEach((article) => {
    fallbackCounts.set(article.sourceName, (fallbackCounts.get(article.sourceName) ?? 0) + 1);
  });

  const resultMap = new Map(crawlResults.map((result) => [result.sourceId, result]));

  return sources.map((source) => {
    const result = resultMap.get(source.id);
    const fallbackCount = fallbackCounts.get(source.name) ?? 0;
    const publishedCount = finalCounts.get(source.name) ?? 0;

    if (result && result.articles.length > 0) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        status: "fetched",
        fetchedCount: result.fetchedCount,
        publishedCount,
        duplicateCount: Math.max(result.articles.length - publishedCount, 0),
        note: result.note,
      };
    }

    if (fallbackCount > 0) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        startedAt: result?.startedAt ?? new Date().toISOString(),
        finishedAt: result?.finishedAt ?? new Date().toISOString(),
        status: "seeded",
        fetchedCount: result?.fetchedCount ?? 0,
        publishedCount,
        duplicateCount: Math.max(fallbackCount - publishedCount, 0),
        note: result?.note ? `${result.note} 已自动回退为内置种子数据。` : "实时抓取失败，已自动回退为内置种子数据。",
      };
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      startedAt: result?.startedAt ?? new Date().toISOString(),
      finishedAt: result?.finishedAt ?? new Date().toISOString(),
      status: result?.status ?? "skipped",
      fetchedCount: result?.fetchedCount ?? 0,
      publishedCount,
      duplicateCount: 0,
      note: result?.note ?? "当前无可用文章。",
    };
  });
}

async function main() {
  await mkdir(generatedDir, { recursive: true });

  const [sources, seedArticles, baseEntities] = await Promise.all([
    readJson(path.join(configDir, "sources.json")),
    readJson(path.join(seedDir, "articles.json")),
    readJson(path.join(seedDir, "entities.json")),
  ]);

  const crawlResults = [];
  for (const source of sources.filter((item) => item.isActive)) {
    crawlResults.push(await crawlSource(source));
  }

  const liveArticles = crawlResults.flatMap((result) => result.articles);
  const liveSourceNames = new Set(liveArticles.map((article) => article.sourceName));
  const fallbackSeedArticles = seedArticles.filter((article) => !liveSourceNames.has(article.sourceName));

  const sourceLookup = new Map(sources.map((source) => [source.name, source]));

  const normalizedArticles = [...liveArticles, ...fallbackSeedArticles]
    .map((article, index) => normalizeArticle(article, index, baseEntities, sourceLookup))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  const dedupedArticles = dedupeArticles(normalizedArticles);
  const graph = buildKnowledgeGraph(dedupedArticles, baseEntities);
  const wordCloud = buildWordCloud(dedupedArticles);
  const logs = finalizeLogs(sources, crawlResults, dedupedArticles, fallbackSeedArticles);
  const summary = buildSummary(dedupedArticles, sources, graph);

  await Promise.all([
    writeFile(path.join(generatedDir, "articles.json"), JSON.stringify(dedupedArticles, null, 2)),
    writeFile(path.join(generatedDir, "sources.json"), JSON.stringify(sources, null, 2)),
    writeFile(path.join(generatedDir, "word-cloud.json"), JSON.stringify(wordCloud, null, 2)),
    writeFile(path.join(generatedDir, "knowledge-graph.json"), JSON.stringify(graph, null, 2)),
    writeFile(path.join(generatedDir, "logs.json"), JSON.stringify(logs, null, 2)),
    writeFile(path.join(generatedDir, "summary.json"), JSON.stringify(summary, null, 2)),
  ]);

  console.log(
    `Generated ${dedupedArticles.length} articles, ${graph.entities.length} entities and ${graph.edges.length} graph edges.`,
  );
  console.log(`Live articles: ${liveArticles.length}; seed fallback articles: ${fallbackSeedArticles.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});




