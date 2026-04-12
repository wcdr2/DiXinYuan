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

export type GraphElementClass =
  | "subject"
  | "goal"
  | "content"
  | "activity"
  | "evaluation";

export type GraphRelationType =
  | "related"
  | "guides"
  | "drives"
  | "supports"
  | "located_in"
  | "pursues"
  | "organizes"
  | "focuses_on"
  | "enables"
  | "constrains"
  | "collaborates_with"
  | "assesses";

export interface Scorecard {
  factorSupport: number;
  carrierCapacity: number;
  collaborationLevel: number;
  applicationOutput: number;
  comprehensiveBenefit: number;
}

export interface EvidenceRef {
  id?: string;
  kind: "article" | "research";
  title: string;
  articleId?: string;
  sourceLabel: string;
  url?: string;
  publishedAt?: string;
}

export interface GraphTaxonomyItem {
  key: GraphElementClass;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
}

export interface GraphRegionScope {
  id: string;
  labelZh: string;
  labelEn: string;
  spatialScope: "province" | "city" | "park" | "project";
  parentId?: string;
}

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
  elementClass?: GraphElementClass;
  subtype?: string;
  spatialScope?: "province" | "city" | "park" | "project";
  parentId?: string;
  regionIds?: string[];
  tags?: string[];
  scorecard?: Scorecard;
  displayOrder?: number;
}

export interface GraphEdge {
  sourceEntityId: string;
  targetEntityId: string;
  relationType: GraphRelationType;
  evidenceArticleIds: string[];
  evidenceRefs?: EvidenceRef[];
  weight: number;
  viewModes?: Array<"layered" | "network">;
}

export interface GraphDataset {
  entities: Entity[];
  edges: GraphEdge[];
  regionScopes?: GraphRegionScope[];
  taxonomy?: {
    elementClasses: GraphTaxonomyItem[];
  };
  views?: {
    layered?: {
      columns: Array<{
        elementClass: GraphElementClass;
        entityIds?: string[];
      }>;
    };
    network?: {
      featuredEntityId?: string;
    };
  };
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

export type MapMode = "all" | ArticleCategory;

export interface MapCategoryCounts {
  enterprise: number;
  technology: number;
  policy: number;
}

export interface MapLegendRange {
  min: number;
  max: number;
  labelZh: string;
  labelEn: string;
  color: string;
}

export interface MapLegend {
  mode: MapMode;
  ranges: MapLegendRange[];
}

export interface MapGeometryAsset {
  id: string;
  path: string;
  labelX: number;
  labelY: number;
  labelAlign?: "start" | "middle" | "end";
}

export interface MapRegion {
  id: string;
  name: string;
  nameEn: string;
  type: "city" | "special-region";
  geometryKey: string;
  center: [number, number];
  zoom?: number;
  bdDistrictName?: string;
  summary: string;
  summaryEn: string;
  articleCount: number;
  articleIds: string[];
  categoryCounts: MapCategoryCounts;
  keywordHighlights: string[];
  entityIds: string[];
  latestArticleIds: string[];
  subjectEntityCount: number;
  isPriorityRegion: boolean;
  graphRegionId?: string;
  memberRegionIds?: string[];
}

export interface MapDatasetMetrics {
  regionCount: number;
  cityCount: number;
  specialRegionCount: number;
  priorityRegionCount: number;
  totalArticles: number;
  totalGraphEntities: number;
}

export interface MapDataset {
  updatedAt: string;
  viewBox: string;
  geometryAssets: MapGeometryAsset[];
  regions: MapRegion[];
  metrics: MapDatasetMetrics;
  legend: MapLegend[];
}

