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
  ArticlePage,
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
  page?: number;
  pageSize?: number;
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

export function paginateArticles(results: Article[], page = 1, pageSize = 24): ArticlePage {
  const safePageSize = Math.max(1, Math.min(pageSize, 60));
  const totalElements = results.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / safePageSize);
  const requestedPage = Math.max(1, page);
  const safePage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    content: results.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalElements,
    totalPages,
    hasPrevious: safePage > 1 && totalPages > 0,
    hasNext: totalPages > 0 && safePage < totalPages,
  };
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
  return rankRelatedArticles(article, getArticles()).slice(0, 3);
}

export function rankRelatedArticles(article: Article, pool: Article[]): Article[] {
  const baseTime = new Date(article.publishedAt).getTime();

  return pool
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      const keywordScore = candidate.keywords.filter((keyword) =>
        article.keywords.includes(keyword),
      ).length;
      const entityScore = candidate.entityIds.filter((entityId) =>
        article.entityIds.includes(entityId),
      ).length;
      const sameCategoryScore = candidate.category === article.category ? 1.5 : 0;
      const guangxiScore = article.isGuangxiRelated && candidate.isGuangxiRelated ? 1.2 : 0;
      const sameLanguageScore = candidate.language === article.language ? 0.5 : 0;
      const candidateTime = new Date(candidate.publishedAt).getTime();
      const dayGap = Number.isFinite(baseTime) && Number.isFinite(candidateTime)
          ? Math.abs(baseTime - candidateTime) / 86_400_000
          : 365;
      const timeScore = Math.max(0, 2 - dayGap / 45);

      return {
        article: candidate,
        score: keywordScore * 2.4 + entityScore * 3 + sameCategoryScore + guangxiScore + sameLanguageScore + timeScore,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      right.article.publishedAt.localeCompare(left.article.publishedAt),
    )
    .map((entry) => entry.article);
}

export function formatDate(locale: Locale, value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  const formatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return formatter.format(date);
}
