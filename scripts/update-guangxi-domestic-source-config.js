const fs = require("fs");

const sourcesPath = "datasets/config/sources.json";
const whitelistPath = "datasets/config/entity-whitelist.json";

const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
const whitelist = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));

const COMMON_TERMS = [
  "自然资源",
  "测绘",
  "地理信息",
  "国土空间",
  "实景三维",
  "遥感",
  "北斗",
  "低空",
  "空间信息",
  "GIS",
  "surveying",
  "mapping",
  "geospatial",
  "remote sensing",
];

const LINK_DENY_PATTERNS = [
  "javascript",
  "#",
  "/index",
  "/list",
  "/map.shtml",
];

function hostPattern(host) {
  return host.replace(/\./g, "\\.");
}

function governmentSource(id, name, siteUrl, entryUrl, fallbackEntryUrls = [], itemLimit = 120) {
  const host = new URL(siteUrl).hostname;
  return {
    id,
    name,
    type: "government",
    siteUrl,
    language: "zh",
    trustLevel: "high",
    isActive: true,
    crawlRule: {
      mode: "homepage-monitor",
      entryUrl,
      fallbackEntryUrls,
      parser: "html-list",
      whitelist: COMMON_TERMS,
      itemLimit,
      linkDenyPatterns: LINK_DENY_PATTERNS,
      linkAllowPatterns: [
        `${hostPattern(host)}/.+/(t\\d+|\\d{6,})\\.(s?html?)$`,
      ],
      notes: "广西官方自然资源来源；仅抓取同域具体详情页，入库仍需正文段落天然包含硬词。",
      requireKeywordMatch: true,
    },
    whitelistEntityId: `source-${id}`,
  };
}

const updates = [
  governmentSource("gx-dnr", "广西壮族自治区自然资源厅", "https://dnr.gxzf.gov.cn", "https://dnr.gxzf.gov.cn/xwzx/zrzx/", [
    "https://dnr.gxzf.gov.cn/xwzx/",
    "https://dnr.gxzf.gov.cn/zfxxgk/fdzdgknr/btgk/",
  ], 120),
  governmentSource("nn-dnr", "南宁市自然资源局", "http://zrzyj.nanning.gov.cn", "http://zrzyj.nanning.gov.cn/xwdt_57/nndt/", [
    "http://zrzyj.nanning.gov.cn/zwgk_57/tzgg/bjtz/",
    "http://zrzyj.nanning.gov.cn/zwgk_57/xxgk/tdgl/",
    "http://zrzyj.nanning.gov.cn/",
  ], 180),
  governmentSource("gl-dnr", "桂林市自然资源局", "http://zrzyj.guilin.gov.cn", "http://zrzyj.guilin.gov.cn/zrzyzx/dtyw/", [
    "http://zrzyj.guilin.gov.cn/zcfg/",
    "http://zrzyj.guilin.gov.cn/zcwjjd/",
    "http://zrzyj.guilin.gov.cn/",
  ], 120),
  governmentSource("lz-dnr", "柳州市自然资源和规划局", "http://lz.dnr.gxzf.gov.cn", "http://lz.dnr.gxzf.gov.cn/"),
  governmentSource("wz-dnr", "梧州市自然资源局", "http://zrzyj.wuzhou.gov.cn", "http://zrzyj.wuzhou.gov.cn/"),
  governmentSource("bh-dnr", "北海市自然资源局", "http://www.beihai.gov.cn", "http://www.beihai.gov.cn/xxgkbm/bhszrzyj/index.shtml", [], 90),
  governmentSource("fcg-dnr", "防城港市自然资源局", "http://fcg.dnr.gxzf.gov.cn", "http://fcg.dnr.gxzf.gov.cn/", [], 100),
  governmentSource("gg-dnr", "贵港市自然资源局", "http://gg.dnr.gxzf.gov.cn", "http://gg.dnr.gxzf.gov.cn/", [], 100),
  governmentSource("yl-dnr", "玉林市自然资源局", "http://zrzyj.yulin.gov.cn", "http://zrzyj.yulin.gov.cn/", [], 100),
  governmentSource("bs-dnr", "百色市自然资源局", "http://zrzyj.baise.gov.cn", "http://zrzyj.baise.gov.cn/", [], 100),
  governmentSource("hz-dnr", "贺州市自然资源局", "http://hz.dnr.gxzf.gov.cn", "http://hz.dnr.gxzf.gov.cn/", [], 100),
  governmentSource("hc-dnr", "河池市自然资源局", "http://zrzyj.hechi.gov.cn", "http://zrzyj.hechi.gov.cn/", [], 100),
  governmentSource("lb-dnr", "来宾市自然资源局", "http://lb.dnr.gxzf.gov.cn", "http://lb.dnr.gxzf.gov.cn/", [], 100),
  governmentSource("cz-dnr", "崇左市自然资源局", "http://cz.dnr.gxzf.gov.cn", "http://cz.dnr.gxzf.gov.cn/", [], 100),
];

const sourceIndexes = new Map(sources.map((source, index) => [source.id, index]));
for (const update of updates) {
  if (sourceIndexes.has(update.id)) {
    sources[sourceIndexes.get(update.id)] = update;
  } else {
    sources.push(update);
  }
}

const entityIds = new Set((whitelist.entities || []).map((entity) => entity.id));
let addedEntities = 0;
for (const source of updates) {
  const id = `source-${source.id}`;
  if (entityIds.has(id)) continue;
  whitelist.entities.push({
    id,
    name: source.name,
    aliases: [],
    country: "中国",
    region: "广西",
    category: "官方来源",
    subcategory: "自然资源主管部门",
    verificationLevel: "A",
    relevance: "直接相关",
    evidenceUrl: source.siteUrl,
    sourceKeyword: "广西官方/高校/企业优先补抓来源",
    verifiedAt: "2026-05-07",
  });
  entityIds.add(id);
  addedEntities += 1;
}

whitelist.count = whitelist.entities.length;
whitelist.sourceWhitelistAdded = Number(whitelist.sourceWhitelistAdded || 0) + addedEntities;
whitelist.sourceWhitelistNormalizedAt = "2026-05-07T00:00:00+08:00";

fs.writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
fs.writeFileSync(whitelistPath, `${JSON.stringify(whitelist, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  updatedSources: updates.map((source) => source.id),
  addedWhitelistEntities: addedEntities,
  totalSources: sources.length,
  totalWhitelistEntities: whitelist.entities.length,
}, null, 2));
