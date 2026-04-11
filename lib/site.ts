import type { CSSProperties } from "react";
import type { Article, ArticleCategory, EntityType, Locale, SourceType } from "@/lib/types";

export const localeLabels: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

export const categoryOrder: ArticleCategory[] = ["enterprise", "technology", "policy"];

export const categoryLabels: Record<Locale, Record<ArticleCategory, string>> = {
  zh: {
    enterprise: "企业动态",
    technology: "技术进展",
    policy: "政策观察",
  },
  en: {
    enterprise: "Enterprise",
    technology: "Technology",
    policy: "Policy",
  },
};

export const sourceTypeLabels: Record<Locale, Record<SourceType, string>> = {
  zh: {
    government: "政府机构",
    association: "行业协会",
    research: "科研机构",
    university: "高校",
    enterprise: "企业官网",
    international: "国际机构",
  },
  en: {
    government: "Government",
    association: "Association",
    research: "Research",
    university: "University",
    enterprise: "Enterprise",
    international: "International",
  },
};

export const entityTypeLabels: Record<Locale, Record<EntityType, string>> = {
  zh: {
    policy: "政策",
    enterprise: "企业",
    institution: "机构",
    university: "高校",
    park: "园区",
    project: "项目",
    technology: "技术",
    region: "地区",
  },
  en: {
    policy: "Policy",
    enterprise: "Enterprise",
    institution: "Institution",
    university: "University",
    park: "Park",
    project: "Project",
    technology: "Technology",
    region: "Region",
  },
};

export const dictionaries = {
  zh: {
    siteName: "广西地球信息产业发展研究",
    siteTagline: "面向公众传播的广西地球信息产业研究门户",
    search: {
      label: "站内搜索",
      placeholder: "搜索新闻、来源或关键词",
      button: "搜索",
    },
    nav: {
      home: "首页",
      news: "新闻",
      wordCloud: "词云",
      graph: "知识图谱",
      sources: "来源说明",
      about: "项目介绍",
    },
    hero: {
      eyebrow: "Guangxi Geo-Industry Intelligence",
      titleTop: "广西地球信息",
      titleHighlight: "",
      titleBottom: "产业发展研究",
      title: "聚焦广西地球信息产业的可信观察与可视分析",
      summary:
        "围绕企业、技术与政策三条主线，网站通过权威来源白名单、结构化数据加工和双语界面呈现，形成更接近研究机构门户的信息服务体验。",
      primaryCta: "浏览最新新闻",
      secondaryCta: "查看赋能知识图谱",
      statArticles: "已整理新闻",
      statSources: "白名单来源",
      statGraph: "图谱节点",
      statUpdate: "最近更新",
    },
    home: {
      spotlight: "重点专题",
      latestRail: "最新内容",
      taxonomy: "专题栏目",
      analytics: "分析视图",
      trust: "可信来源",
      method: "项目方法",
    },
    sections: {
      latest: "最新关注",
      taxonomy: "栏目速览",
      analytics: "分析视图",
      trust: "可信来源机制",
      project: "项目方法",
      related: "相关推荐",
      evidence: "来源与证据",
      keywordInsight: "关键词与地域标签",
    },
    pageIntro: {
      newsTitle: "新闻索引",
      newsSummary: "浏览来自白名单来源的新闻摘要，可按栏目、来源、时间和广西相关性筛选。",
      cloudTitle: "产业词云",
      cloudSummary: "基于最近 30 天已发布新闻提取关键词，支持按栏目查看并跳转至对应结果。",
      graphTitle: "地球空间信息赋能知识图谱",
      graphSummary:
        "围绕主体、目标、内容、活动、评价五类要素构建广西地球空间信息赋能知识图谱，并用新闻证据与调研依据共同支撑结构化展示。",
      sourcesTitle: "数据来源与自动更新说明",
      sourcesSummary: "仅允许进入白名单的权威来源参与自动发布链路，并保留抓取日志、原文链接和来源说明。",
      aboutTitle: "项目介绍",
      aboutSummary: "说明网站定位、适用对象、数据链路与首版验收口径。",
    },
    filters: {
      query: "关键词搜索",
      queryPlaceholder: "搜索标题、摘要、来源或关键词",
      category: "栏目",
      source: "来源",
      guangxi: "广西相关",
      sort: "排序",
      all: "全部",
      guangxiOnly: "仅看广西",
      latest: "最新优先",
      oldest: "最早优先",
      submit: "应用筛选",
      reset: "重置",
      results: "筛选结果",
    },
    cards: {
      readMore: "查看摘要页",
      sourceLink: "访问原始来源",
      allNews: "查看全部新闻",
      allSources: "查看来源说明",
      allGraph: "进入知识图谱",
      allCloud: "进入词云页面",
    },
    wordCloud: {
      all: "综合热词",
      prompt: "点击词项后进入新闻筛选结果。",
      articleCount: "相关文章",
      empty: "当前暂无可展示的热词。",
    },
    graph: {
      selectPrompt: "默认展示五类要素分层图谱，可切换关系网络图并查看节点详情、评价维度与证据。",
      empty: "当前筛选条件下暂无节点。",
      evidence: "证据新闻",
      relations: "关联关系",
      filterAll: "全部要素",
      filterRegionAll: "全部区域",
      viewLayered: "分层图谱",
      viewNetwork: "关系网络图",
      focusSelected: "聚焦当前节点",
      showAllEdges: "显示全部关系",
      detailTitle: "节点详情",
      evidenceMixed: "证据与依据",
      scorecard: "评价雷达",
    },
    sources: {
      whitelistTitle: "白名单来源",
      whitelistSummary: "默认优先覆盖政府、协会、科研机构、高校、国际机构和重点企业官网。",
      logsTitle: "最近一次更新日志",
      logsSummary: "系统会优先尝试联网抓取白名单来源；若来源不可达或结构异常，则自动回退到内置种子数据，并在日志中说明。",
      trustRule: "所有新闻都必须展示来源名、原文链接、发布时间和分类。",
    },
    about: {
      audienceTitle: "适用对象",
      audienceBody: "面向公众传播，同时兼顾研究机构、地方产业观察者和项目型用户的快速浏览需求。",
      pipelineTitle: "数据链路",
      pipelineBody: "白名单抓取、清洗标准化、去重分类、关键词抽取、详情页生成、词云与图谱刷新。",
      v1Title: "V1 范围",
      v1Body: "首版不包含后台、评论、用户体系和全文机器翻译，重点验证可信内容呈现与分析视图。",
    },
    empty: {
      news: "当前筛选条件下暂无新闻，请调整筛选条件后重试。",
      related: "暂无相关推荐。",
    },
    footer: {
      summary: "研究机构门户风格的信息站点，聚焦广西地球信息产业的公开信息整合、可视分析与双语展示。",
      note: "前台仅展示结构化结果，数据来源以白名单和原始链接为准。",
    },
  },
  en: {
    siteName: "Guangxi Geospatial Industry Development Research",
    siteTagline: "A public-facing portal for Guangxi geospatial industry intelligence",
    search: {
      label: "Site search",
      placeholder: "Search news, sources, or keywords",
      button: "Search",
    },
    nav: {
      home: "Home",
      news: "News",
      wordCloud: "Word Cloud",
      graph: "Knowledge Graph",
      sources: "Sources",
      about: "About",
    },
    hero: {
      eyebrow: "Guangxi Geo-Industry Intelligence",
      titleTop: "Guangxi Geospatial",
      titleHighlight: "",
      titleBottom: "Industry Development Research",
      title: "Trusted observation and visual analysis for Guangxi's geospatial industry",
      summary:
        "The portal organizes enterprise, technology and policy signals from curated sources, then presents them through a bilingual research-portal experience.",
      primaryCta: "Browse latest news",
      secondaryCta: "Open the enablement graph",
      statArticles: "Curated articles",
      statSources: "Trusted sources",
      statGraph: "Graph entities",
      statUpdate: "Last update",
    },
    home: {
      spotlight: "Spotlight",
      latestRail: "Latest updates",
      taxonomy: "Editorial tracks",
      analytics: "Analytical views",
      trust: "Trust framework",
      method: "Project method",
    },
    sections: {
      latest: "Latest focus",
      taxonomy: "Editorial tracks",
      analytics: "Analytical views",
      trust: "Trust framework",
      project: "Project method",
      related: "Related items",
      evidence: "Source and evidence",
      keywordInsight: "Keywords and regional tags",
    },
    pageIntro: {
      newsTitle: "News Index",
      newsSummary: "Browse structured article summaries from trusted sources with filtering by category, source, time and Guangxi relevance.",
      cloudTitle: "Industry Word Cloud",
      cloudSummary: "Keywords are generated from the latest 30-day article set and can route into filtered news results.",
      graphTitle: "Geospatial Enablement Knowledge Graph",
      graphSummary:
        "The graph organizes Guangxi geospatial enablement through five layers: subject, goal, content, activity and evaluation, backed by news evidence and research notes.",
      sourcesTitle: "Source Policy and Update Notes",
      sourcesSummary: "Only trusted sources can enter the auto-publication chain, and each item keeps its source link and update log record.",
      aboutTitle: "About the Project",
      aboutSummary: "A concise overview of positioning, audience, data pipeline and V1 acceptance boundaries.",
    },
    filters: {
      query: "Keyword",
      queryPlaceholder: "Search title, summary, source or keywords",
      category: "Category",
      source: "Source",
      guangxi: "Guangxi",
      sort: "Sort",
      all: "All",
      guangxiOnly: "Guangxi only",
      latest: "Latest first",
      oldest: "Oldest first",
      submit: "Apply",
      reset: "Reset",
      results: "Results",
    },
    cards: {
      readMore: "Open summary page",
      sourceLink: "Visit original source",
      allNews: "View all news",
      allSources: "View source notes",
      allGraph: "Open graph",
      allCloud: "Open word cloud",
    },
    wordCloud: {
      all: "Combined terms",
      prompt: "Select a term to open matching news results.",
      articleCount: "linked articles",
      empty: "No terms are available right now.",
    },
    graph: {
      selectPrompt: "The default view is a layered five-element graph. You can switch to the network view and inspect node details, scorecards and evidence.",
      empty: "No nodes under the current filter.",
      evidence: "Evidence articles",
      relations: "Relations",
      filterAll: "All layers",
      filterRegionAll: "All regions",
      viewLayered: "Layered graph",
      viewNetwork: "Network view",
      focusSelected: "Focus selected",
      showAllEdges: "Show all relations",
      detailTitle: "Node detail",
      evidenceMixed: "Evidence and notes",
      scorecard: "Scorecard",
    },
    sources: {
      whitelistTitle: "Trusted sources",
      whitelistSummary: "Government, association, research, university, international and enterprise sources are prioritized in the whitelist.",
      logsTitle: "Latest refresh log",
      logsSummary: "The refresh job first attempts live crawling from trusted sources; if a source is unavailable or structurally unstable, it falls back to bundled seed data and records that in the log.",
      trustRule: "Every published item must show source name, original link, publication time and category.",
    },
    about: {
      audienceTitle: "Audience",
      audienceBody: "The V1 site is public-facing while still being useful to researchers, local observers and project stakeholders.",
      pipelineTitle: "Data pipeline",
      pipelineBody: "Whitelist crawling, normalization, dedupe, categorization, keyword extraction, summary page generation, then word-cloud and graph refresh.",
      v1Title: "V1 scope",
      v1Body: "No back office, comments, user accounts or full-machine translation are included in the first release.",
    },
    empty: {
      news: "No articles match the current filters.",
      related: "No related items yet.",
    },
    footer: {
      summary: "A research-style portal for public information aggregation, visual analysis and bilingual presentation around Guangxi's geospatial industry.",
      note: "The frontend is read-only and every item points back to its trusted original source.",
    },
  },
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function withLocale(locale: Locale, path = "") {
  if (!path || path === "/") {
    return `/${locale}`;
  }

  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getArticleRouteSegment(article: Pick<Article, "id" | "slug">) {
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

export function getArticleHref(locale: Locale, article: Pick<Article, "id" | "slug">) {
  return withLocale(locale, `/news/${getArticleRouteSegment(article)}`);
}

export function getCoverSurface(coverImage: string | undefined): {
  className: string;
  style?: CSSProperties;
} {
  const normalized = (coverImage ?? "").trim();

  if (/^https?:\/\//i.test(normalized)) {
    return {
      className: "cover-surface cover-surface--remote",
      style: {
        backgroundImage: `linear-gradient(180deg, rgba(11, 33, 57, 0.08), rgba(11, 33, 57, 0.62)), url("${normalized}")`,
      },
    };
  }

  const safeTone = /^[a-z0-9-]+$/i.test(normalized) ? normalized : "marine-signal";
  return {
    className: `cover-surface tone-${safeTone}`,
  };
}

const preferredMirrorHosts = new Set(["www.ogc.org", "ogc.org", "www.esa.int", "esa.int"]);
const forceMirrorHosts = new Set([
  "www.gxzf.gov.cn",
  "dnr.gxzf.gov.cn",
  "gzw.gxzf.gov.cn",
  "gxt.gxzf.gov.cn",
  "www.mnr.gov.cn",
  "www.cagis.org.cn",
  "www.csgpc.org",
  "aircas.cas.cn",
  "www.aircas.ac.cn",
  "www.supermap.com",
  "www.sgg.whu.edu.cn",
]);

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildWebArchiveMirrorUrl(url: string) {
  if (!isHttpUrl(url)) {
    return "";
  }
  try {
    return `https://web.archive.org/web/${url}`;
  } catch {
    return "";
  }
}

function buildGoogleSearchUrl(url: string) {
  if (!isHttpUrl(url)) {
    return "";
  }
  try {
    const parsed = new URL(url);
    return `https://www.google.com/search?q=site:${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function buildMirrorUrl(url: string) {
  const archive = buildWebArchiveMirrorUrl(url);
  if (archive) return archive;
  return buildGoogleSearchUrl(url);
}

function uniqueUrls(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter((value) => isHttpUrl(value)))];
}

export function getSourceAccessUrls(originalUrl: string, sourceUrl: string) {
  const urls = uniqueUrls([originalUrl, sourceUrl]);
  let primaryUrl = urls[0] ?? "";
  let backupUrl = urls[1] ?? "";
  let usedMirror = false;

  if (!primaryUrl) {
    return {
      primaryUrl: "",
      backupUrl: "",
      usedMirror: false,
    };
  }

  try {
    const host = new URL(primaryUrl).hostname.toLowerCase();

    if (forceMirrorHosts.has(host) || preferredMirrorHosts.has(host)) {
      const mirrorUrl = buildMirrorUrl(primaryUrl);
      if (mirrorUrl) {
        usedMirror = true;
        backupUrl = mirrorUrl;
        return {
          primaryUrl,
          backupUrl,
          usedMirror,
        };
      }
    }

    if (!backupUrl) {
      const mirrorUrl = buildMirrorUrl(primaryUrl);
      if (mirrorUrl && mirrorUrl !== primaryUrl) {
        backupUrl = mirrorUrl;
        usedMirror = true;
      }
    }
  } catch {
    return {
      primaryUrl,
      backupUrl,
      usedMirror,
    };
  }

  return {
    primaryUrl,
    backupUrl,
    usedMirror,
  };
}
