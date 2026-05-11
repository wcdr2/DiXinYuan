const fs = require("fs");

const sourcesPath = "datasets/config/sources.json";
const whitelistPath = "datasets/config/entity-whitelist.json";

const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
const whitelist = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));

const REQUIRED_TERMS = [
  "地球信息科学",
  "遥感",
  "测绘",
  "GIS",
  "北斗",
  "空天信息",
  "实景三维",
  "时空智能",
  "自然资源数字化",
  "低空遥感",
  "数字孪生",
  "智慧城市",
];

const DOMAIN_TERMS = [
  ...REQUIRED_TERMS,
  "地理信息",
  "自然资源",
  "国土空间",
  "空间信息",
  "低空经济",
  "卫星导航",
  "高精度定位",
  "三维",
  "时空",
  "geospatial",
  "remote sensing",
  "digital twin",
  "smart city",
];

const BASE_DENY = [
  "javascript",
  "#",
  "login|signup|subscribe|privacy|terms|cookie",
  "job|zhaopin|recruit|gbook|download",
  "mp\\.weixin\\.qq\\.com",
  "beian\\.miit\\.gov\\.cn",
  "beian\\.gov\\.cn",
];

function upsert(source) {
  const index = sources.findIndex((item) => item.id === source.id);
  if (index >= 0) {
    sources[index] = { ...sources[index], ...source, crawlRule: { ...(sources[index].crawlRule || {}), ...source.crawlRule } };
  } else {
    sources.push(source);
  }
}

function ensureWhitelistEntity(id, name, evidenceUrl, region = "全国", category = "企业/协会来源") {
  whitelist.entities = whitelist.entities || [];
  if (whitelist.entities.some((entity) => entity.id === id)) return false;
  whitelist.entities.push({
    id,
    name,
    aliases: [],
    country: "中国",
    region,
    category,
    subcategory: "地球信息科学/遥感/测绘/GIS/北斗/空天信息相关来源",
    verificationLevel: "A",
    relevance: "直接相关",
    evidenceUrl,
    sourceKeyword: "广西和国内优先补源",
    verifiedAt: "2026-05-08",
  });
  return true;
}

const updates = [
  {
    id: "cagis",
    name: "中国地理信息产业协会",
    type: "association",
    siteUrl: "https://www.cagis.org.cn",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-cagis",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.cagis.org.cn/Lists/index/cid/8.html",
      fallbackEntryUrls: [
        "https://www.cagis.org.cn/Lists/index/cid/9.html",
        "https://www.cagis.org.cn/Lists/index/cid/76.html",
      ],
      paginationTemplates: [
        { template: "https://www.cagis.org.cn/Lists/index/cid/8/p/{page}.html", start: 1, end: 79 },
        { template: "https://www.cagis.org.cn/Lists/index/cid/9/p/{page}.html", start: 1, end: 30 },
        { template: "https://www.cagis.org.cn/Lists/index/cid/76/p/{page}.html", start: 1, end: 30 },
      ],
      whitelist: DOMAIN_TERMS,
      itemLimit: 700,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.cagis\\.org\\.cn/Lists/content/id/\\d+\\.html"],
      requireKeywordMatch: true,
    },
  },
  {
    id: "wl-entity-068",
    name: "中国卫星导航定位协会",
    type: "association",
    siteUrl: "https://www.glac.org.cn",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "entity-068",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.glac.org.cn/c234",
      fallbackEntryUrls: [
        "https://www.glac.org.cn/c233",
        "https://www.glac.org.cn/c170",
        "https://www.glac.org.cn/c150",
        "https://www.glac.org.cn/c151",
        "https://www.glac.org.cn/c152",
        "https://www.glac.org.cn/c154",
        "https://www.glac.org.cn/c185",
      ],
      whitelist: DOMAIN_TERMS,
      itemLimit: 300,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.glac\\.org\\.cn/a\\d+\\.html"],
      requireKeywordMatch: true,
    },
  },
  {
    id: "supermap",
    name: "超图软件",
    type: "enterprise",
    siteUrl: "https://www.supermap.com",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-supermap",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.supermap.com/zh-cn/a/news/list_2_1.html",
      fallbackEntryUrls: [
        "https://www.supermap.com/zh-cn/a/news/list_6_1.html",
        "https://www.supermap.com/zh-cn/a/news/list_7_1.html",
        "https://www.supermap.com/zh-cn/a/news/list_76_1.html",
        "https://www.supermap.com/zh-cn/a/news/list_8_1.html",
        "https://www.supermap.com/zh-cn/a/news/list_11_1.html",
      ],
      paginationTemplates: [
        { template: "https://www.supermap.com/zh-cn/a/news/list_2_{page}.html", start: 1, end: 20 },
        { template: "https://www.supermap.com/zh-cn/a/news/list_6_{page}.html", start: 1, end: 20 },
        { template: "https://www.supermap.com/zh-cn/a/news/list_7_{page}.html", start: 1, end: 20 },
        { template: "https://www.supermap.com/zh-cn/a/news/list_8_{page}.html", start: 1, end: 20 },
      ],
      whitelist: DOMAIN_TERMS,
      itemLimit: 300,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: [
        "supermap\\.com/.+/(?:a/news|sdc|news).*(?:20\\d{2}|\\d{3,}|\\.html)",
        "sdc\\.supermap\\.com/(?:20\\d{2}|[^/]+)",
      ],
      requireKeywordMatch: true,
    },
  },
  {
    id: "southsurvey",
    name: "南方测绘",
    type: "enterprise",
    siteUrl: "https://www.southsurvey.com",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-southsurvey",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.southsurvey.com/",
      fallbackEntryUrls: [
        "https://www.southsurvey.com/news.html",
        "https://www.southsurvey.com/news/cid/1.html",
        "https://www.southsurvey.com/news/cid/2.html",
        "https://www.southsurvey.com/news/cid/3.html",
      ],
      whitelist: DOMAIN_TERMS,
      itemLimit: 120,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.southsurvey\\.com/news_view/id/\\d+\\.html"],
      requireKeywordMatch: true,
    },
  },
  {
    id: "huace-nav",
    name: "华测导航",
    type: "enterprise",
    siteUrl: "https://www.huace.cn",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-huace-nav",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.huace.cn/",
      whitelist: DOMAIN_TERMS,
      itemLimit: 120,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.huace\\.cn/informationDetail/\\d+"],
      requireKeywordMatch: true,
    },
  },
  {
    id: "bdstar",
    name: "北斗星通",
    type: "enterprise",
    siteUrl: "https://www.bdstar.com",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-bdstar",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.bdstar.com/",
      whitelist: DOMAIN_TERMS,
      itemLimit: 80,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.bdstar\\.com/news\\.aspx\\?.*id=\\d+"],
      requireKeywordMatch: true,
    },
  },
  {
    id: "mapgis",
    name: "中地数码 MapGIS",
    type: "enterprise",
    siteUrl: "https://www.mapgis.com",
    language: "zh",
    trustLevel: "high",
    isActive: true,
    whitelistEntityId: "source-mapgis",
    crawlRule: {
      domestic: true,
      parser: "html-list",
      mode: "homepage-monitor",
      entryUrl: "https://www.mapgis.com/index.php?a=lists&catid=33",
      fallbackEntryUrls: [
        "https://www.mapgis.com/index.php?a=lists&catid=32",
        "https://www.mapgis.com/index.php?a=lists&catid=34",
        "https://www.mapgis.com/index.php?a=lists&catid=239",
        "https://www.mapgis.com/index.php?a=lists&catid=273",
      ],
      whitelist: DOMAIN_TERMS,
      itemLimit: 120,
      linkDenyPatterns: BASE_DENY,
      linkAllowPatterns: ["www\\.mapgis\\.com/index\\.php\\?a=shows&.*id=\\d+"],
      requireKeywordMatch: true,
    },
  },
];

for (const source of updates) {
  upsert(source);
}

let addedWhitelistEntities = 0;
for (const source of updates) {
  if (source.whitelistEntityId?.startsWith("source-")) {
    addedWhitelistEntities += ensureWhitelistEntity(
      source.whitelistEntityId,
      source.name,
      source.siteUrl,
      source.id.includes("gx") ? "广西" : "全国",
      source.type === "association" ? "行业协会来源" : "企业来源",
    ) ? 1 : 0;
  }
}

whitelist.count = whitelist.entities.length;
whitelist.sourceWhitelistAdded = Number(whitelist.sourceWhitelistAdded || 0) + addedWhitelistEntities;
whitelist.sourceWhitelistNormalizedAt = "2026-05-08T00:00:00+08:00";

fs.writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
fs.writeFileSync(whitelistPath, `${JSON.stringify(whitelist, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  updatedSources: updates.map((source) => source.id),
  addedWhitelistEntities,
  totalSources: sources.length,
  totalWhitelistEntities: whitelist.entities.length,
}, null, 2));
