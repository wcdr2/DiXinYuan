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
  paginateArticles,
  rankRelatedArticles,
  type ArticleFilters,
} from "@/lib/data";
import type {
  Article,
  ArticleCategory,
  ArticlePage,
  CrawlLog,
  GraphDataset,
  MapDataset,
  Source,
  SummaryMetrics,
  WordCloudItem,
} from "@/lib/types";

const API_BASE_URL = process.env.JAVA_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const BACKEND_REVALIDATE_SECONDS = 300;
const DISABLE_BACKEND_FETCH =
  process.env.DISABLE_BACKEND_FETCH === "1" || process.env.NEXT_PHASE === "phase-production-build";

function hasBackendApi() {
  return !DISABLE_BACKEND_FETCH && API_BASE_URL.length > 0;
}

async function fetchFromBackend<T>(path: string, fallback: () => T): Promise<T> {
  if (!hasBackendApi()) {
    return fallback();
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: BACKEND_REVALIDATE_SECONDS },
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

export async function getRuntimeArticlePage(filters: ArticleFilters): Promise<ArticlePage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 24, 60));
  const params = new URLSearchParams();
  appendParam(params, "query", filters.query);
  appendParam(params, "category", filters.category);
  appendParam(params, "source", filters.source);
  appendParam(params, "region", filters.region);
  appendParam(params, "guangxi", filters.guangxi);
  appendParam(params, "sort", filters.sort);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return fetchFromBackend<ArticlePage>(
    `/api/v1/news/page?${params.toString()}`,
    () => paginateArticles(filterArticles(filters), page, pageSize),
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
  return rankRelatedArticles(article, articles).slice(0, 3);
}

export async function getRuntimeSources(): Promise<Source[]> {
  return fetchFromBackend<Source[]>("/api/v1/sources", getSources);
}

export async function getRuntimeMapDataset(): Promise<MapDataset> {
  return fetchFromBackend<MapDataset>("/api/v1/datasets/map", getMapDataset);
}

export async function getRuntimeGraphDataset(): Promise<GraphDataset> {
  const localGraph = getGraphDataset();

  if (!hasBackendApi()) {
    return localGraph;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/datasets/knowledge-graph`, {
      next: { revalidate: BACKEND_REVALIDATE_SECONDS },
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return localGraph;
    }

    const backendGraph = (await response.json()) as GraphDataset;
    const hasExpandedRadialGraph =
      backendGraph.entities.length >= 1000 &&
      Boolean(backendGraph.views?.radial) &&
      (backendGraph.regionScopes?.filter((scope) => scope.spatialScope === "city").length ?? 0) >= 14;

    return hasExpandedRadialGraph ? backendGraph : localGraph;
  } catch {
    return localGraph;
  }
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
