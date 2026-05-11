const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcesPath = path.join(root, "datasets", "config", "sources.json");
const whitelistPath = path.join(root, "datasets", "config", "entity-whitelist.json");

const allowedTypes = new Set([
  "government",
  "association",
  "research",
  "enterprise",
  "university",
  "international",
]);

const blockedSourceIds = new Set([
  "geofeeds-rss",
  "news-cn",
  "people-cn",
  "cctv-cn",
  "stdaily",
  "chinanews",
  "gov-cn",
]);
const blockedSourceHosts = new Set([
  "news.cn",
  "xinhuanet.com",
  "people.com.cn",
  "cctv.com",
  "stdaily.com",
  "chinanews.com.cn",
  "chinanews.com",
  "gov.cn",
]);
const requiredSummaryTerms = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息", "实景三维", "时空智能",
  "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTerm(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u3000-\u303f\uff00-\uffef]+/g, "");
}

function host(value) {
  try {
    return new URL(clean(value)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBlockedHost(source) {
  const sourceHost = host(source.siteUrl);
  if (!sourceHost) {
    return false;
  }
  return blockedSourceHosts.has(sourceHost);
}

function evidenceUrls(value) {
  return clean(value)
    .split(/[;；,，\s]+/)
    .filter((item) => item.startsWith("http://") || item.startsWith("https://"));
}

function isGuangxiSource(source) {
  const text = `${source.id} ${source.name} ${source.siteUrl}`;
  return /广西|南宁|柳州|桂林|梧州|北海|防城港|钦州|贵港|玉林|百色|贺州|河池|来宾|崇左|\bgx\b|guangxi|nanning|guilin|liuzhou/i.test(text);
}

function categoryForType(type) {
  return {
    government: "政府机构",
    association: "行业协会/学会",
    research: "科研院所",
    enterprise: "企业",
    university: "高校",
    international: "国际机构",
  }[type] ?? "机构";
}

function regionForSource(source) {
  if (isGuangxiSource(source)) {
    return "广西";
  }
  if (source.type === "international") {
    return "国际";
  }
  return "中国";
}

function sourceDerivedEntityId(source, usedIds) {
  const base = `source-${source.id}`.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  let candidate = base;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${index++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function buildIndexes(entities) {
  const byId = new Map();
  const byName = new Map();
  const byHost = new Map();
  for (const entity of entities) {
    byId.set(entity.id, entity);
    [entity.name, ...(entity.aliases ?? [])].forEach((term) => {
      const key = normalizeTerm(term);
      if (key) {
        byName.set(key, entity.id);
      }
    });
    evidenceUrls(entity.evidenceUrl).forEach((url) => {
      const key = host(url);
      if (!key) {
        return;
      }
      const matches = byHost.get(key) ?? new Set();
      matches.add(entity.id);
      byHost.set(key, matches);
    });
  }
  return { byId, byName, byHost };
}

function resolveEntityId(source, indexes) {
  if (source.whitelistEntityId && indexes.byId.has(source.whitelistEntityId)) {
    return source.whitelistEntityId;
  }
  if (source.id?.startsWith("wl-entity-")) {
    const candidate = source.id.replace(/^wl-/, "");
    if (indexes.byId.has(candidate)) {
      return candidate;
    }
  }
  const nameMatch = indexes.byName.get(normalizeTerm(source.name));
  if (nameMatch) {
    return nameMatch;
  }
  const sourceHost = host(source.siteUrl);
  const hostMatches = sourceHost ? indexes.byHost.get(sourceHost) : null;
  if (hostMatches?.size === 1) {
    return [...hostMatches][0];
  }
  return "";
}

function main() {
  const sources = readJson(sourcesPath);
  const whitelist = readJson(whitelistPath);
  const entities = whitelist.entities ?? [];
  const usedIds = new Set(entities.map((entity) => entity.id));
  const addedEntities = [];
  let indexes = buildIndexes(entities);
  let disabledSources = 0;

  for (const source of sources) {
    let entityId = resolveEntityId(source, indexes);
    const sourceIsAllowed = allowedTypes.has(source.type) && !blockedSourceIds.has(source.id) && !isBlockedHost(source);

    if (!entityId && source.isActive !== false && sourceIsAllowed) {
      const entity = {
        id: sourceDerivedEntityId(source, usedIds),
        name: source.name,
        aliases: [],
        country: source.type === "international" ? "国际" : "中国",
        region: regionForSource(source),
        category: categoryForType(source.type),
        subcategory: "新闻来源准入机构",
        verificationLevel: source.trustLevel === "high" ? "A" : "B",
        relevance: "直接相关",
        evidenceUrl: source.siteUrl,
        sourceKeyword: "source-whitelist-normalization",
        verifiedAt: "2026-05-02",
      };
      entities.push(entity);
      addedEntities.push(entity);
      indexes = buildIndexes(entities);
      entityId = entity.id;
    }

    source.whitelistEntityId = entityId;
    source.isActive = Boolean(source.isActive !== false && sourceIsAllowed && entityId);
    if (!source.isActive) {
      disabledSources++;
    }
    source.crawlRule = source.crawlRule ?? {};
    const whitelist = new Set([...(source.crawlRule.whitelist ?? []), ...requiredSummaryTerms]);
    source.crawlRule.whitelist = [...whitelist];
    source.crawlRule.requireKeywordMatch = true;
  }

  whitelist.entities = entities;
  whitelist.count = entities.length;
  whitelist.sourceWhitelistNormalizedAt = "2026-05-02T00:00:00+08:00";
  whitelist.sourceWhitelistAdded = addedEntities.length;
  whitelist.sourceWhitelistReason =
    "Ensured every active news source has a whitelist institution binding.";

  writeJson(sourcesPath, sources);
  writeJson(whitelistPath, whitelist);

  console.log(`Sources: ${sources.length}`);
  console.log(`Active sources: ${sources.filter((source) => source.isActive !== false).length}`);
  console.log(`Disabled sources: ${disabledSources}`);
  console.log(`Whitelist entities: ${entities.length}`);
  console.log(`Added whitelist entities: ${addedEntities.length}`);
}

main();
