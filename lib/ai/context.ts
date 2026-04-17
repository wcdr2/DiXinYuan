import "server-only";

import { getArticleBySlug, getArticles, getGraphDataset, getMapDataset, getSources } from "@/lib/data";
import { getArticleHref, withLocale } from "@/lib/site";
import type { AIChatRequestMessage, ReferenceItem } from "@/lib/ai/types";
import type { Article, Entity, Locale, MapRegion, Source } from "@/lib/types";

type PageKind = "home" | "news" | "news-detail" | "map" | "knowledge-graph" | "sources" | "about" | "other";

interface Signal {
  value: string;
  weight: number;
}

interface ChatContextInput {
  locale: Locale;
  messages: AIChatRequestMessage[];
  pathname: string;
  search: string;
}

interface ContextHit<T> {
  item: T;
  score: number;
}

export interface ChatContextResult {
  currentPageLabel: string;
  promptContext: string;
  references: ReferenceItem[];
  meta: {
    contextHitCount: number;
  };
}

const MAX_CONTEXT_LENGTH = 6200;
const ZH_PAGE_LABELS = {
  home: "\u9996\u9875",
  news: "\u65b0\u95fb\u5217\u8868\u9875",
  "news-detail": "\u65b0\u95fb\u8be6\u60c5\u9875",
  map: "\u4e13\u9898\u5730\u56fe\u9875",
  "knowledge-graph": "\u77e5\u8bc6\u56fe\u8c31\u9875",
  sources: "\u6765\u6e90\u8bf4\u660e\u9875",
  about: "\u9879\u76ee\u4ecb\u7ecd\u9875",
  other: "\u7ad9\u5185\u9875\u9762",
} as const;
const EN_PAGE_LABELS = {
  home: "home page",
  news: "news index page",
  "news-detail": "news detail page",
  map: "map page",
  "knowledge-graph": "knowledge graph page",
  sources: "source notes page",
  about: "about page",
  other: "site page",
} as const;
const ARTICLE_ANCHOR_TEXT = [
  "\u65b0\u95fb",
  "\u6587\u7ae0",
  "\u4f01\u4e1a",
  "\u52a8\u6001",
  "article",
  "news",
  "enterprise",
  "update",
].join(" ");
const REGION_ANCHOR_TEXT = [
  "\u5730\u56fe",
  "\u533a\u57df",
  "\u57ce\u5e02",
  "map",
  "region",
  "city",
].join(" ");
const ENTITY_ANCHOR_TEXT = [
  "\u77e5\u8bc6\u56fe\u8c31",
  "\u56fe\u8c31",
  "\u5b9e\u4f53",
  "\u4e3b\u4f53",
  "graph",
  "entity",
  "subject",
].join(" ");
const SOURCE_ANCHOR_TEXT = [
  "\u6765\u6e90",
  "\u767d\u540d\u5355",
  "\u53ef\u4fe1",
  "source",
  "trusted",
  "whitelist",
].join(" ");
const CATEGORY_LABELS = {
  enterprise: ["\u4f01\u4e1a", "\u4f01\u4e1a\u52a8\u6001", "enterprise"],
  technology: ["\u6280\u672f", "\u6280\u672f\u8fdb\u5c55", "technology"],
  policy: ["\u653f\u7b56", "\u653f\u7b56\u89c2\u5bdf", "policy"],
} as const;
const PAGE_BIAS: Record<PageKind, { article: number; region: number; entity: number; source: number }> = {
  home: { article: 4, region: 2, entity: 2, source: 1 },
  news: { article: 12, region: 3, entity: 2, source: 2 },
  "news-detail": { article: 16, region: 4, entity: 3, source: 4 },
  map: { article: 6, region: 12, entity: 5, source: 1 },
  "knowledge-graph": { article: 4, region: 5, entity: 12, source: 1 },
  sources: { article: 3, region: 1, entity: 1, source: 12 },
  about: { article: 1, region: 1, entity: 1, source: 1 },
  other: { article: 2, region: 2, entity: 2, source: 2 },
};

function clampText(value: string, maxLength: number) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function isLocaleSegment(value: string | undefined): value is Locale {
  return value === "zh" || value === "en";
}

function normalizePathname(pathname: string) {
  const segments = String(pathname ?? "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);

  const locale = isLocaleSegment(segments[0]) ? segments.shift() : undefined;
  return {
    locale,
    segments,
    normalizedPath: `/${segments.join("/")}`.replace(/\/+$/, "") || "/",
  };
}

function getPageKind(normalizedPath: string): PageKind {
  if (normalizedPath === "/") return "home";
  if (normalizedPath === "/news") return "news";
  if (normalizedPath.startsWith("/news/")) return "news-detail";
  if (normalizedPath === "/map") return "map";
  if (normalizedPath === "/knowledge-graph") return "knowledge-graph";
  if (normalizedPath === "/sources") return "sources";
  if (normalizedPath === "/about") return "about";
  return "other";
}

function addSignal(target: Map<string, number>, rawValue: string, weight: number) {
  const value = rawValue.trim().toLowerCase();
  if (value.length < 2) {
    return;
  }

  const current = target.get(value) ?? 0;
  if (weight > current) {
    target.set(value, weight);
  }
}

function collectChineseGrams(target: Map<string, number>, value: string) {
  const segments = value.match(/[\u4e00-\u9fff]{2,24}/g) ?? [];

  segments.forEach((segment) => {
    addSignal(target, segment, 4);

    const maxGramSize = Math.min(4, segment.length);
    for (let gramSize = 2; gramSize <= maxGramSize; gramSize += 1) {
      for (let index = 0; index <= segment.length - gramSize; index += 1) {
        addSignal(target, segment.slice(index, index + gramSize), gramSize === 4 ? 2 : 3);
      }
    }
  });
}

function extractSignals(texts: string[]) {
  const signalMap = new Map<string, number>();

  texts.forEach((text, index) => {
    const normalized = String(text ?? "").trim();
    if (!normalized) {
      return;
    }

    addSignal(signalMap, normalized, index === texts.length - 1 ? 5 : 3);
    collectChineseGrams(signalMap, normalized);

    const englishTokens = normalized.toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) ?? [];
    englishTokens.forEach((token) => addSignal(signalMap, token, token.length >= 6 ? 4 : 3));
  });

  return [...signalMap.entries()]
    .map(([value, weight]) => ({ value, weight }))
    .sort((left, right) => right.weight - left.weight || right.value.length - left.value.length)
    .slice(0, 80);
}

function scoreText(haystack: string, signals: Signal[], multiplier = 1) {
  if (!haystack) {
    return 0;
  }

  const normalized = haystack.toLowerCase();
  return signals.reduce((score, signal) => {
    if (!normalized.includes(signal.value)) {
      return score;
    }

    const lengthWeight = signal.value.length >= 6 ? 2 : 1;
    return score + signal.weight * lengthWeight * multiplier;
  }, 0);
}

function pushReference(target: ReferenceItem[], item: ReferenceItem) {
  if (!item.href && !item.label) {
    return;
  }

  const exists = target.some((candidate) => candidate.type === item.type && candidate.label === item.label && candidate.href === item.href);
  if (!exists) {
    target.push(item);
  }
}

function pickTopHits<T>(items: ContextHit<T>[], limit: number) {
  return items
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function getSearchParams(search: string) {
  const raw = String(search ?? "");
  return new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
}

function describePage(locale: Locale, pageKind: PageKind, normalizedPath: string) {
  const label = locale === "zh" ? ZH_PAGE_LABELS[pageKind] : EN_PAGE_LABELS[pageKind];
  return `${label} (${normalizedPath})`;
}

function buildArticleReference(locale: Locale, article: Article): ReferenceItem {
  return {
    type: "article",
    label: article.title,
    href: getArticleHref(locale, article),
  };
}

function buildRegionReference(locale: Locale, region: MapRegion): ReferenceItem {
  return {
    type: "region",
    label: locale === "zh" ? region.name : region.nameEn,
    href: withLocale(locale, `/map?region=${region.id}`),
  };
}

function buildEntityReference(locale: Locale, entity: Entity): ReferenceItem {
  const regionId = entity.regionIds?.[0];
  const href = regionId ? withLocale(locale, `/knowledge-graph?region=${regionId}`) : withLocale(locale, "/knowledge-graph");

  return {
    type: "entity",
    label: entity.name,
    href,
  };
}

function buildSourceReference(locale: Locale, source: Source): ReferenceItem {
  return {
    type: "source",
    label: source.name,
    href: withLocale(locale, "/sources"),
  };
}

function buildContextSection(title: string, lines: string[]) {
  if (lines.length === 0) {
    return "";
  }

  return `${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export function buildChatContext({ locale, messages, pathname, search }: ChatContextInput): ChatContextResult {
  const articles = getArticles();
  const graph = getGraphDataset();
  const regions = getMapDataset().regions;
  const sources = getSources();
  const parsedPath = normalizePathname(pathname);
  const pageKind = getPageKind(parsedPath.normalizedPath);
  const pageBias = PAGE_BIAS[pageKind];
  const searchParams = getSearchParams(search);
  const currentArticleSlug = pageKind === "news-detail" ? parsedPath.segments[1] ?? "" : "";
  const currentArticle = currentArticleSlug ? getArticleBySlug(currentArticleSlug) : undefined;
  const activeQuery = searchParams.get("query") ?? "";
  const activeRegionId = searchParams.get("region") ?? "";
  const activeCategory = searchParams.get("category") ?? "";
  const activeSource = searchParams.get("source") ?? currentArticle?.sourceName ?? "";
  const recentMessages = messages.slice(-6).map((message) => message.content);
  const latestQuestion = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
  const signals = extractSignals([...recentMessages, activeQuery, activeRegionId, activeCategory, activeSource].filter(Boolean));
  const currentPageLabel = currentArticle
    ? `${describePage(locale, pageKind, parsedPath.normalizedPath)}: ${currentArticle.title}`
    : describePage(locale, pageKind, parsedPath.normalizedPath);

  const regionArticleIdSet = activeRegionId
    ? new Set(regions.find((region) => region.id === activeRegionId)?.articleIds ?? [])
    : null;

  const articleHits = pickTopHits(
    articles.map((article) => {
      const baseScore =
        scoreText(article.title, signals, 6) +
        scoreText(article.summary, signals, 3) +
        scoreText(article.keywords.join(" "), signals, 4) +
        scoreText(article.regionTags.join(" "), signals, 3) +
        scoreText(article.sourceName, signals, 2) +
        scoreText(ARTICLE_ANCHOR_TEXT, signals, 2) +
        scoreText(CATEGORY_LABELS[article.category].join(" "), signals, 4);

      let score = baseScore > 0 ? baseScore + pageBias.article : 0;

      if (activeCategory && article.category === activeCategory) {
        score += 20;
      }

      if (activeSource && article.sourceName === activeSource) {
        score += 20;
      }

      if (currentArticle && article.id === currentArticle.id) {
        score += 240;
      } else if (currentArticle) {
        const sharedKeywords = article.keywords.filter((keyword) => currentArticle.keywords.includes(keyword)).length;
        score += sharedKeywords * 5;
      }

      if (regionArticleIdSet?.has(article.id)) {
        score += 28;
      }

      return { item: article, score };
    }),
    6,
  );

  const regionHits = pickTopHits(
    regions.map((region) => {
      const baseScore =
        scoreText(region.name, signals, 6) +
        scoreText(region.nameEn, signals, 4) +
        scoreText(region.summary, signals, 2) +
        scoreText(region.summaryEn, signals, 2) +
        scoreText(region.keywordHighlights.join(" "), signals, 4) +
        scoreText(REGION_ANCHOR_TEXT, signals, 2);

      let score = baseScore > 0 ? baseScore + pageBias.region : 0;

      if (region.id === activeRegionId) {
        score += 240;
      }

      if (currentArticle && region.articleIds.includes(currentArticle.id)) {
        score += 24;
      }

      return { item: region, score };
    }),
    3,
  );

  const entityHits = pickTopHits(
    graph.entities.map((entity) => {
      const baseScore =
        scoreText(entity.name, signals, 6) +
        scoreText(entity.aliases.join(" "), signals, 5) +
        scoreText(entity.intro, signals, 2) +
        scoreText(entity.region, signals, 3) +
        scoreText((entity.tags ?? []).join(" "), signals, 2) +
        scoreText(ENTITY_ANCHOR_TEXT, signals, 2);

      let score = baseScore > 0 ? baseScore + pageBias.entity : 0;

      if (activeRegionId && (entity.regionIds?.includes(activeRegionId) || entity.parentId === activeRegionId || entity.id === activeRegionId)) {
        score += 22;
      }

      if (currentArticle && entity.relatedArticleIds.includes(currentArticle.id)) {
        score += 18;
      }

      return { item: entity, score };
    }),
    5,
  );

  const sourceHits = pickTopHits(
    sources.map((source) => {
      const targetText = [
        source.name,
        source.type,
        source.siteUrl,
        SOURCE_ANCHOR_TEXT,
        source.crawlRule.notes ?? "",
        ...(source.crawlRule.whitelist ?? []),
      ].join(" ");

      const baseScore = scoreText(targetText, signals, 4);
      let score = baseScore > 0 ? baseScore + pageBias.source : 0;

      if (activeSource && source.name === activeSource) {
        score += 240;
      }

      if (currentArticle && source.name === currentArticle.sourceName) {
        score += 30;
      }

      return { item: source, score };
    }),
    3,
  );

  const references: ReferenceItem[] = [];
  articleHits.forEach((hit) => pushReference(references, buildArticleReference(locale, hit.item)));
  regionHits.forEach((hit) => pushReference(references, buildRegionReference(locale, hit.item)));
  entityHits.forEach((hit) => pushReference(references, buildEntityReference(locale, hit.item)));
  sourceHits.forEach((hit) => pushReference(references, buildSourceReference(locale, hit.item)));

  const sections = [
    buildContextSection(
      locale === "zh" ? "Current page" : "Current page",
      [
        currentPageLabel,
        latestQuestion
          ? `Current user question: ${clampText(latestQuestion, 180)}`
          : "",
      ].filter(Boolean),
    ),
    buildContextSection(
      "Relevant articles",
      articleHits.map(({ item }) =>
        [
          item.title,
          `Source: ${item.sourceName}`,
          `Date: ${item.publishedAt.slice(0, 10)}`,
          `Summary: ${clampText(item.summary, 110)}`,
          `Site link: ${getArticleHref(locale, item)}`,
        ].join(" | "),
      ),
    ),
    buildContextSection(
      "Relevant regions",
      regionHits.map(({ item }) =>
        [
          locale === "zh" ? item.name : item.nameEn,
          `Summary: ${clampText(locale === "zh" ? item.summary : item.summaryEn, 90)}`,
          `Articles: ${item.articleCount}`,
          `Link: ${withLocale(locale, `/map?region=${item.id}`)}`,
        ].join(" | "),
      ),
    ),
    buildContextSection(
      "Relevant graph entities",
      entityHits.map(({ item }) =>
        [
          item.name,
          item.subtype ? `Subtype: ${item.subtype}` : "",
          `Intro: ${clampText(item.intro, 90)}`,
          `Linked articles: ${item.relatedArticleIds.length}`,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    ),
    buildContextSection(
      "Trusted sources",
      sourceHits.map(({ item }) =>
        [
          item.name,
          `Type: ${item.type}`,
          item.crawlRule.notes ? `Notes: ${clampText(item.crawlRule.notes, 90)}` : "",
          `Link: ${withLocale(locale, "/sources")}`,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    ),
  ].filter(Boolean);

  const promptContext = sections.reduce((result, section) => {
    const next = result ? `${result}\n\n${section}` : section;
    if (next.length > MAX_CONTEXT_LENGTH) {
      return result;
    }
    return next;
  }, "");

  return {
    currentPageLabel,
    promptContext,
    references: references.slice(0, 10),
    meta: {
      contextHitCount: articleHits.length + regionHits.length + entityHits.length + sourceHits.length,
    },
  };
}
