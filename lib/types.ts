export type Locale = "zh" | "en";

export type ArticleCategory = "enterprise" | "technology" | "policy";

export type SourceType =
  | "government"
  | "association"
  | "research"
  | "university"
  | "enterprise"
  | "international";

export type TrustLevel = "high" | "medium";

export type EntityType =
  | "policy"
  | "enterprise"
  | "institution"
  | "university"
  | "park"
  | "project"
  | "technology"
  | "region";

export interface CrawlRule {
  mode: "seed" | "seed-or-rss" | "rss" | "homepage-monitor" | "api";
  entryUrl?: string;
  feedUrls?: string[];
  fallbackEntryUrls?: string[];
  parser?: "rss" | "html-list" | "wp-json";
  apiUrl?: string;
  whitelist?: string[];
  itemLimit?: number;
  notes?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  publishedAt: string;
  language: "zh" | "en";
  category: ArticleCategory;
  keywords: string[];
  regionTags: string[];
  isGuangxiRelated: boolean;
  entityIds: string[];
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  siteUrl: string;
  language: "zh" | "en" | "mixed";
  trustLevel: TrustLevel;
  isActive: boolean;
  crawlRule: CrawlRule;
}

export interface WordCloudItem {
  term: string;
  weight: number;
  category: ArticleCategory | "all";
  period: "30d";
  articleCount: number;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  intro: string;
  region: string;
  relatedArticleIds: string[];
}

export interface GraphEdge {
  sourceEntityId: string;
  targetEntityId: string;
  relationType:
    | "related"
    | "guides"
    | "drives"
    | "supports"
    | "located_in";
  evidenceArticleIds: string[];
  weight: number;
}

export interface GraphDataset {
  entities: Entity[];
  edges: GraphEdge[];
}

export interface CrawlLog {
  sourceId: string;
  sourceName: string;
  startedAt: string;
  finishedAt: string;
  status: "seeded" | "fetched" | "skipped" | "failed";
  fetchedCount: number;
  publishedCount: number;
  duplicateCount: number;
  note: string;
}

export interface SummaryMetrics {
  totalArticles: number;
  totalSources: number;
  guangxiArticles: number;
  latestUpdateAt: string;
  totalEntities: number;
  totalEdges: number;
}

