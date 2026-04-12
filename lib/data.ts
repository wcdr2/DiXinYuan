import articles from "@/datasets/generated/articles.json";
import graph from "@/datasets/generated/knowledge-graph.json";
import logs from "@/datasets/generated/logs.json";
import map from "@/datasets/generated/map.json";
import sources from "@/datasets/generated/sources.json";
import summary from "@/datasets/generated/summary.json";
import wordCloud from "@/datasets/generated/word-cloud.json";
import { getArticleRouteSegment } from "@/lib/site";
import type {
  Article,
  ArticleCategory,
  CrawlLog,
  Entity,
  GraphDataset,
  MapDataset,
  Locale,
  Source,
  SummaryMetrics,
  WordCloudItem,
} from "@/lib/types";

export const locales: Locale[] = ["zh", "en"];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getArticles(): Article[] {
  return [...(articles as Article[])].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  const normalized = decodeURIComponent(slug);

  return getArticles().find((article) => {
    if (article.slug === normalized || article.id === normalized) {
      return true;
    }

    const routeSegment = getArticleRouteSegment(article);
    return normalized === routeSegment || normalized.startsWith(`${article.id}-`);
  });
}

export function getSources(): Source[] {
  return sources as Source[];
}

export function getWordCloudItems(category?: ArticleCategory | "all"): WordCloudItem[] {
  const items = wordCloud as WordCloudItem[];
  return items.filter((item) => item.category === (category ?? "all"));
}

export function getGraphDataset(): GraphDataset {
  return graph as GraphDataset;
}

export function getGraphEntities(): Entity[] {
  return getGraphDataset().entities;
}

export function getMapDataset(): MapDataset {
  return map as MapDataset;
}

export function getLogs(): CrawlLog[] {
  return logs as CrawlLog[];
}

export function getSummaryMetrics(): SummaryMetrics {
  return summary as SummaryMetrics;
}

export interface ArticleFilters {
  query?: string;
  category?: ArticleCategory | "all";
  source?: string;
  region?: string;
  guangxi?: "all" | "only";
  sort?: "latest" | "oldest";
}

export function filterArticles(filters: ArticleFilters): Article[] {
  const normalizedQuery = filters.query?.trim().toLowerCase();
  const regionArticleIds =
    filters.region && filters.region !== "all"
      ? new Set(getMapDataset().regions.find((region) => region.id === filters.region)?.articleIds ?? [])
      : null;
  const results = getArticles().filter((article) => {
    if (filters.category && filters.category !== "all" && article.category !== filters.category) {
      return false;
    }

    if (filters.source && filters.source !== "all" && article.sourceName !== filters.source) {
      return false;
    }

    if (regionArticleIds && !regionArticleIds.has(article.id)) {
      return false;
    }

    if (filters.guangxi === "only" && !article.isGuangxiRelated) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      article.title,
      article.summary,
      article.sourceName,
      article.keywords.join(" "),
      article.regionTags.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  if (filters.sort === "oldest") {
    return results.sort((left, right) => left.publishedAt.localeCompare(right.publishedAt));
  }

  return results.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function getFeaturedArticles(): Article[] {
  return getArticles().slice(0, 3);
}

export function getLatestByCategory(category: ArticleCategory): Article[] {
  return getArticles()
    .filter((article) => article.category === category)
    .slice(0, 4);
}

export function getLatestArticleForSource(sourceName: string): Article | undefined {
  return getArticles().find((article) => article.sourceName === sourceName);
}

export function getRelatedArticles(article: Article): Article[] {
  return getArticles()
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      const keywordScore = candidate.keywords.filter((keyword) =>
        article.keywords.includes(keyword),
      ).length;
      const entityScore = candidate.entityIds.filter((entityId) =>
        article.entityIds.includes(entityId),
      ).length;

      return {
        article: candidate,
        score: keywordScore * 2 + entityScore,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.article);
}

export function formatDate(locale: Locale, value: string): string {
  const formatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return formatter.format(new Date(value));
}
