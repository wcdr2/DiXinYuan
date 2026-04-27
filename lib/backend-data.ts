import "server-only";

import {
  filterArticles,
  getArticleBySlug,
  getArticles,
  getGraphDataset,
  getLogs,
  getMapDataset,
  getRelatedArticles,
  getSources,
  getSummaryMetrics,
  getWordCloudItems,
  type ArticleFilters,
} from "@/lib/data";
import type {
  Article,
  ArticleCategory,
  CrawlLog,
  GraphDataset,
  MapDataset,
  Source,
  SummaryMetrics,
  WordCloudItem,
} from "@/lib/types";

const API_BASE_URL = process.env.JAVA_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function hasBackendApi() {
  return API_BASE_URL.length > 0;
}

async function fetchFromBackend<T>(path: string, fallback: () => T): Promise<T> {
  if (!hasBackendApi()) {
    return fallback();
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return fallback();
    }
    return (await response.json()) as T;
  } catch {
    return fallback();
  }
}

function appendParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value && value !== "all") {
    params.set(key, value);
  }
}

export async function getRuntimeArticles(filters?: ArticleFilters): Promise<Article[]> {
  if (!filters) {
    return fetchFromBackend<Article[]>("/api/v1/news", getArticles);
  }

  const params = new URLSearchParams();
  appendParam(params, "query", filters.query);
  appendParam(params, "category", filters.category);
  appendParam(params, "source", filters.source);
  appendParam(params, "region", filters.region);
  appendParam(params, "guangxi", filters.guangxi);
  appendParam(params, "sort", filters.sort);
  const query = params.toString();
  return fetchFromBackend<Article[]>(
    `/api/v1/news${query ? `?${query}` : ""}`,
    () => filterArticles(filters),
  );
}

export async function getRuntimeArticleBySlug(slug: string): Promise<Article | undefined> {
  return fetchFromBackend<Article | undefined>(
    `/api/v1/news/${encodeURIComponent(slug)}`,
    () => getArticleBySlug(slug),
  );
}

export async function getRuntimeRelatedArticles(article: Article): Promise<Article[]> {
  if (!hasBackendApi()) {
    return getRelatedArticles(article);
  }
  const articles = await getRuntimeArticles();
  return articles
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

export async function getRuntimeSources(): Promise<Source[]> {
  return fetchFromBackend<Source[]>("/api/v1/sources", getSources);
}

export async function getRuntimeMapDataset(): Promise<MapDataset> {
  return fetchFromBackend<MapDataset>("/api/v1/datasets/map", getMapDataset);
}

export async function getRuntimeGraphDataset(): Promise<GraphDataset> {
  return fetchFromBackend<GraphDataset>("/api/v1/datasets/knowledge-graph", getGraphDataset);
}

export async function getRuntimeLogs(): Promise<CrawlLog[]> {
  return fetchFromBackend<CrawlLog[]>("/api/v1/logs/latest", getLogs);
}

export async function getRuntimeSummaryMetrics(): Promise<SummaryMetrics> {
  return fetchFromBackend<SummaryMetrics>("/api/v1/datasets/summary", getSummaryMetrics);
}

export async function getRuntimeWordCloudItems(category?: ArticleCategory | "all"): Promise<WordCloudItem[]> {
  const items = await fetchFromBackend<WordCloudItem[]>("/api/v1/datasets/word-cloud", () =>
    getWordCloudItems(category),
  );
  return items.filter((item) => item.category === (category ?? "all"));
}
