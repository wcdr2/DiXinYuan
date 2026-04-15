import { guangxiCityProfiles, guangxiProvince, guangxiRegionScopes } from "./guangxi-regions-base.mjs";

const cityById = new Map(guangxiCityProfiles.map((city) => [city.id, city]));

const createSourceRef = (title, url, sourceLabel = "官方资料") => ({
  kind: "research",
  title,
  sourceLabel,
  url,
});

const createEvidence = (id, title, url, sourceLabel = "官方资料") => ({
  id,
  kind: "research",
  title,
  sourceLabel,
  url,
});
const createEntity = (elementClass, type, config) => ({
  aliases: [],
  intro: "",
  region: guangxiProvince.labelZh,
  relatedArticleIds: [],
  regionIds: [guangxiProvince.id],
  tags: [],
  spatialScope: "province",
  ...config,
  elementClass,
  type,
});
const subject = (type, config) => createEntity("subject", type, config);
const goal = (config) => createEntity("goal", "policy", config);
const content = (type, config) => createEntity("content", type, config);
const activity = (type, config) => createEntity("activity", type, config);
const evaluation = (config) => createEntity("evaluation", "project", config);
const createEdge = (sourceEntityId, targetEntityId, relationType, options = {}) => ({
  sourceEntityId,
  targetEntityId,
  relationType,
  viewModes: ["layered", "network"],
  keywords: [],
  researchEvidenceIds: [],
  ...options,
});
const createScorecard = (factorSupport, carrierCapacity, collaborationLevel, applicationOutput, comprehensiveBenefit) => ({
  factorSupport,
  carrierCapacity,
  collaborationLevel,
  applicationOutput,
  comprehensiveBenefit,
});
const mergeRegionIds = (...groups) => [...new Set([guangxiProvince.id, ...groups.flatMap((group) => group ?? [])].filter(Boolean))];
const createUsageMap = (ids) => new Map(ids.map((id) => [id, new Set([guangxiProvince.id])]));
const uniqueEdges = (edges) => {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = `${edge.sourceEntityId}:${edge.targetEntityId}:${edge.relationType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
const expandMap = (mapping, relationType, evidenceIds) =>
  Object.entries(mapping).flatMap(([sourceEntityId, targetEntityIds]) =>
    targetEntityIds.map((targetEntityId) =>
      createEdge(sourceEntityId, targetEntityId, relationType, { researchEvidenceIds: evidenceIds }),
    ),
  );

const createProvinceSubject = (id, type, name, intro, tags, displayOrder, extra = {}) =>
  subject(type, {
    id,
    name,
    intro,
    tags,
    displayOrder,
    region: guangxiProvince.labelZh,
    regionIds: [guangxiProvince.id],
    spatialScope: "province",
    ...extra,
  });

const createCityPlatform = (id, cityId, name, intro, tags, displayOrder, extra = {}) => {
  const city = cityById.get(cityId);
  return subject("park", {
    id,
    name,
    intro,
    tags,
    displayOrder,
    region: city?.labelZh ?? guangxiProvince.labelZh,
    regionIds: mergeRegionIds([cityId]),
    parentId: cityId,
    spatialScope: "city",
    ...extra,
  });
};

const createCitySubject = (city, role, type, name, intro, tags, displayOrder, extra = {}) =>
  subject(type, {
    id: `${city.id}-${role}-subject`,
    name,
    intro,
    tags,
    displayOrder,
    region: city.labelZh,
    regionIds: mergeRegionIds([city.id]),
    parentId: city.id,
    spatialScope: "city",
    ...extra,
  });

const researchEvidence = [
  createEvidence("gx-research-framework", "广西自然资源与地理信息公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-subject-survey", "广西地理信息主体公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-goal-value-study", "广西区域协同与数字治理公开资料汇编", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  createEvidence("gx-spatial-factor-study", "广西空间要素与国土空间治理公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-transport-energy-study", "广西交通枢纽与能源保障公开资料汇编", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  createEvidence("gx-ecology-study", "广西生态保护与资源环境公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-tech-carrier-study", "广西地理信息技术载体公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-industry-collab-study", "广西地理信息产业协同公开资料汇编", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  createEvidence("gx-marine-study", "广西沿海海洋治理公开资料汇编", "https://www.beihai.gov.cn/", "北海市人民政府"),
  createEvidence("gx-low-altitude-study", "广西低空经济公开资料汇编", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  createEvidence("gx-governance-study", "广西自然资源数字治理公开资料汇编", "https://dnr.gxzf.gov.cn/", "广西壮族自治区自然资源厅"),
  createEvidence("gx-evaluation-model", "广西地理信息效能评估公开资料汇编", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  createEvidence("gx-corridor-study", "广西通道节点与陆海协同公开资料汇编", "https://www.qinzhou.gov.cn/", "钦州市人民政府"),
  createEvidence("gx-border-open-study", "广西口岸开放与跨境协同公开资料汇编", "https://www.chongzuo.gov.cn/", "崇左市人民政府"),
  createEvidence("gx-resource-study", "广西西部资源开发公开资料汇编", "https://www.baise.gov.cn/", "百色市人民政府"),
];

const goalMeta = [
  ["industry-upgrade-goal", "产业升级", "value-goal", "带动平台、软件和服务体系升级。"],
  ["resource-governance-goal", "资源治理", "value-goal", "支撑国土空间、资源监管和调查监测。"],
  ["regional-collab-goal", "区域协同", "value-goal", "强化城市、园区和通道之间的联动。"],
  ["green-protection-goal", "绿色保护", "value-goal", "在生态约束下推进高质量发展。"],
  ["cost-efficiency-goal", "降本增效", "value-goal", "利用时空数据降低治理与调度成本。"],
  ["marine-development-goal", "海洋开发与港航保障", "value-goal", "面向沿海空间利用、港航保障和海洋治理。"],
  ["low-altitude-goal", "低空新业态培育", "value-goal", "围绕低空遥感、无人机作业和时空服务培育场景。"],
  ["digital-governance-goal", "数字治理能力提升", "value-goal", "以时空底座与数据共享增强治理能力。"],
];

const contentMeta = [
  ["surveying-industry-content", "project", "测绘地理信息产业基础", "industry-type", "承接基础测绘、数据生产和服务交付能力。"],
  ["remote-sensing-industry-content", "project", "遥感与空天信息方向", "industry-type", "承接卫星数据、遥感解译与空天应用。"],
  ["beidou-industry-content", "project", "北斗与高精度定位方向", "industry-type", "围绕定位、授时和轨迹服务形成供给。"],
  ["geoai-industry-content", "project", "空间智能与 GeoAI 方向", "industry-type", "通过 AI 与空间分析融合提升决策能力。"],
  ["digital-twin-industry-content", "project", "数字孪生与时空底座方向", "industry-type", "连接数据、平台和业务流程形成映射能力。"],
  ["marine-industry-content", "project", "海洋地理信息应用方向", "industry-type", "面向海域监管、港航调度和沿海治理。"],
  ["low-altitude-industry-content", "project", "低空时空服务方向", "industry-type", "以低空遥感、飞行管理和位置服务为主。"],
  ["natural-resource-content", "project", "自然资源与国土空间治理方向", "industry-type", "面向资源调查、规划和用地服务。"],
  ["transport-factor", "project", "交通枢纽条件", "transport", "覆盖铁路、公路、港口和机场等通道条件。"],
  ["port-factor", "project", "港口航运条件", "transport", "决定沿海场景和物流调度的应用深度。"],
  ["airport-factor", "project", "机场与低空空域条件", "transport", "承载低空产业试验和无人机应用。"],
  ["land-factor", "project", "土地资源承载", "land-resource", "关注园区建设和产业集聚所需土地条件。"],
  ["park-space-factor", "project", "园区空间载体", "land-resource", "面向园区和产业空间的载体条件。"],
  ["energy-factor", "project", "能源供给保障", "energy", "为数据处理和平台运行提供基础能源保障。"],
  ["data-compute-factor", "project", "算力与数据基础设施", "energy", "承接数据共享、模型训练和算法调度。"],
  ["ecology-redline-factor", "project", "生态红线约束", "ecology", "体现资源开发和产业布局的生态边界。"],
  ["coastline-factor", "project", "海岸带与海洋空间资源", "ecology", "支撑沿海监测、港航服务和海洋应用。"],
  ["asean-location-factor", "project", "面向东盟区位优势", "location-advantage", "体现连接东盟市场的区位优势。"],
  ["talent-factor", "project", "人才与高校资源", "location-advantage", "围绕高校、科研机构和企业形成创新供给。"],
  ["corridor-factor", "project", "通道节点支撑", "location-advantage", "为跨境物流和跨区域协同提供空间连接。"],
];

const activityMeta = [
  ["remote-sensing", "technology", "遥感与卫星数据获取", "technology-carrier", "提供卫星观测、灾害监测和变化识别能力。"],
  ["beidou-application", "technology", "北斗定位与时空服务", "technology-carrier", "为物流、园区和城市治理提供时空基础能力。"],
  ["real-scene-3d", "technology", "实景三维建模", "technology-carrier", "将测绘成果转化为空间底座。"],
  ["gis-platform", "technology", "GIS 时空平台", "technology-carrier", "承接空间数据汇聚、服务发布和应用开发。"],
  ["geo-ai", "technology", "GeoAI 与空间智能", "technology-carrier", "提升遥感解译、生产和决策能力。"],
  ["digital-twin", "technology", "数字孪生应用", "technology-carrier", "连接平台能力与行业场景形成虚实映射。"],
  ["natural-resource-governance", "project", "自然资源数字治理", "application", "支撑国土空间规划、资源监管和用地服务。"],
  ["marine-service-scenarios", "project", "海洋与港航服务场景", "application", "面向海洋管理、港航调度和海岸带监测。"],
  ["low-altitude-economy", "project", "低空经济场景", "application", "以低空遥感、无人机作业和底座能力为支撑。"],
  ["land-space-planning-activity", "project", "国土空间规划服务", "policy-action", "围绕规划编制、评估和用地服务展开。"],
  ["disaster-monitoring-activity", "project", "灾害监测预警", "application", "支撑灾害识别、响应与评估。"],
  ["smart-port-activity", "project", "智慧港航调度", "application", "提升港口运行、航道感知和海上协同效率。"],
  ["smart-agriculture-activity", "project", "智慧农业遥感监测", "application", "将遥感监测与地块治理、产量评估等结合。"],
  ["cross-border-logistics-activity", "project", "跨境物流时空服务", "collaboration", "为口岸、港口和物流线路提供感知与调度服务。"],
  ["park-digital-base-activity", "project", "园区数字底座建设", "collaboration", "建设统一数据底座、业务平台和可视分析能力。"],
  ["ecological-restoration-activity", "project", "生态修复监测", "application", "监测生态变化与修复进展。"],
  ["satellite-data-sharing-activity", "project", "卫星数据共享服务", "collaboration", "提升多源遥感数据共享接入和复用能力。"],
  ["industry-collaboration-activity", "project", "产学研协同创新", "collaboration", "连接政府、协会、高校、科研机构和企业。"],
  ["standards-governance-activity", "project", "标准规范协同治理", "policy-action", "推动数据标准、接口规范和治理流程协同。"],
];

const evaluationMeta = [
  ["factor-support-eval", "要素保障度", "evaluation-dimension", "评估土地、交通、能源和算力等要素支撑度。", createScorecard(5, 4, 3, 3, 4)],
  ["tech-capacity-eval", "技术承载力", "evaluation-dimension", "评估遥感、北斗、时空平台和数字孪生等链条完备度。", createScorecard(4, 5, 3, 4, 4)],
  ["collaboration-eval", "产业协同度", "evaluation-dimension", "评估政产学研用协同的稳定性与转化效率。", createScorecard(4, 4, 5, 3, 4)],
  ["application-output-eval", "应用成效", "evaluation-dimension", "衡量场景应用落地强度和业务支撑水平。", createScorecard(3, 4, 4, 5, 4)],
  ["benefit-eval", "综合效益", "evaluation-dimension", "综合研判产业增长、治理改善和区域协同效果。", createScorecard(4, 4, 4, 4, 5)],
  ["marine-eval", "海洋服务成效", "evaluation-dimension", "评估沿海监测、港航保障和海洋服务效果。", createScorecard(4, 4, 4, 5, 4)],
  ["low-altitude-eval", "低空场景成熟度", "evaluation-dimension", "评估低空遥感、飞行服务和场景复制成熟度。", createScorecard(3, 4, 3, 4, 4)],
  ["ecology-eval", "生态约束匹配度", "evaluation-dimension", "评估产业布局与生态保护约束的匹配程度。", createScorecard(4, 3, 3, 4, 4)],
  ["land-efficiency-eval", "土地利用效率", "evaluation-dimension", "评估园区与项目用地的集约化水平。", createScorecard(4, 4, 3, 4, 4)],
  ["innovation-eval", "创新转化活跃度", "evaluation-dimension", "评估科研成果、平台能力和产业需求的转化活跃度。", createScorecard(3, 4, 5, 3, 4)],
];

const provinceSubjects = [
  createProvinceSubject("gx-gov-org", "institution", "广西壮族自治区人民政府", "自治区级综合政务主体，负责推动数字治理、产业组织和跨市协同部署。", ["政府", "统筹", "协同"], 10, {
    aliases: ["广西政府", "自治区人民政府"],
    sourceRefs: [createSourceRef("广西壮族自治区人民政府门户网站", "https://www.gxzf.gov.cn/", "政府门户网站")],
  }),
  createProvinceSubject("gx-dnr-org", "institution", "广西壮族自治区自然资源厅", "承担广西测绘地理信息、实景三维、国土空间治理与自然资源数字化推进任务。", ["自然资源", "治理"], 11, {
    aliases: ["广西自然资源厅"],
    sourceRefs: [createSourceRef("广西壮族自治区自然资源厅", "https://dnr.gxzf.gov.cn/", "政府部门网站")],
  }),
  createProvinceSubject("mnr-org", "institution", "中华人民共和国自然资源部", "国家层面的自然资源、测绘与地理信息主管部门，是产业政策与行业标准的重要来源。", ["标准", "治理"], 12, {
    aliases: ["自然资源部"],
    sourceRefs: [createSourceRef("中华人民共和国自然资源部", "https://www.mnr.gov.cn/", "部委官网")],
  }),
  createProvinceSubject("cagis-org", "institution", "中国地理信息产业协会", "连接产业企业、市场需求与行业观察的重要协会组织。", ["产业", "协会"], 13, {
    aliases: ["地信协会"],
  }),
  createProvinceSubject("csgpc-org", "institution", "中国测绘学会", "围绕测绘科技、空间智能与时空信息应用进行学术组织和行业交流。", ["技术", "服务"], 14, {
    aliases: ["测绘学会"],
  }),
  createProvinceSubject("aircas-org", "institution", "中国科学院空天信息创新研究院", "围绕遥感、卫星数据和空天应用形成科研支撑。", ["科研", "遥感"], 15, {
    aliases: ["空天院", "AIRCAS"],
    sourceRefs: [createSourceRef("中国科学院空天信息创新研究院", "https://aircas.cas.cn/", "科研机构官网")],
  }),
  createProvinceSubject("whu-org", "university", "武汉大学测绘学院", "在测绘遥感、空间智能和人才培养领域持续输出科研能力。", ["高校", "人才"], 16, {
    aliases: ["武大测绘"],
  }),
  createProvinceSubject("supermap-org", "enterprise", "北京超图软件股份有限公司", "国内头部 GIS 平台企业，连接时空平台、数字孪生与行业场景落地。", ["企业", "平台"], 17, {
    aliases: ["超图软件", "SuperMap", "超图"],
    sourceRefs: [createSourceRef("北京超图软件股份有限公司", "https://www.supermap.com/cn/", "企业官网")],
  }),
  createProvinceSubject("guangxi-enterprise-cluster", "enterprise", "广西地球信息企业集群", "聚合广西本地地球信息企业、服务商与解决方案供给能力的产业主体集合。", ["企业", "产业"], 18),
];

const preservedPlatforms = [
  createCityPlatform("gx-beidou-park", "nanning", "广西北斗应用产业园", "承接北斗、时空服务和应用集成能力。", ["园区", "北斗"], 40),
  createCityPlatform("nanning-high-tech-zone", "nanning", "南宁高新区空间载体", "承接平台部署、企业集聚和数字底座建设。", ["园区", "平台"], 41),
  createCityPlatform("guangxi-big-data-center", "nanning", "广西数据底座协同平台", "支撑算力、共享交换和数据协同治理。", ["数据", "算力"], 42),
  createCityPlatform("liuzhou-industrial-spatial-platform", "liuzhou", "柳州工业时空平台", "面向制造业园区和工业协同提供底座能力。", ["工业", "平台"], 43),
  createCityPlatform("guilin-eco-monitoring-platform", "guilin", "桂林生态监测平台", "承接山地生态、文旅空间和灾害监测应用。", ["生态", "监测"], 44),
  createCityPlatform("beihai-marine-service-platform", "beihai", "北海海洋服务平台", "连接海域监测、海岸带治理和港航服务。", ["海洋", "港航"], 45),
  createCityPlatform("qinzhou-port-space-platform", "qinzhou", "钦州港航时空平台", "面向港口调度、临港产业和物流协同。", ["港口", "物流"], 46),
  createCityPlatform("fangchenggang-port-monitoring-platform", "fangchenggang", "防城港口岸监测平台", "承接口岸联动、海洋监测和沿海安全协同。", ["口岸", "监测"], 47),
];

const citySubjectProfiles = {
  nanning: {
    government: {
      name: "南宁市人民政府",
      intro: "作为首府综合政务主体，统筹南宁数字治理、中国—东盟信息港建设和跨部门协同落地。",
      aliases: ["南宁市政府", "南宁政府"],
      sourceRefs: [createSourceRef("南宁市人民政府门户网站", "https://www.nanning.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "中国—东盟信息港股份有限公司",
      intro: "总部位于南宁，是中国—东盟信息港建设运营的重要平台型企业，承接数字丝路、平台协同和数据服务任务。",
      aliases: ["中国东信", "中国-东盟信息港股份有限公司"],
      sourceRefs: [createSourceRef("中国—东盟信息港股份有限公司", "https://www.caihcom.com/", "企业官网")],
    },
    innovation: {
      name: "广西大学",
      intro: "广西大学位于南宁，具备区域创新、信息技术与人才培养能力，是首府创新供给的重要高校主体。",
      aliases: ["西大"],
      sourceRefs: [createSourceRef("广西大学", "https://www.gxu.edu.cn/", "学校官网")],
    },
  },
  liuzhou: {
    government: {
      name: "柳州市人民政府",
      intro: "作为柳州综合政务主体，统筹先进制造、工业数字化和园区协同建设。",
      aliases: ["柳州市政府", "柳州政府"],
      sourceRefs: [createSourceRef("柳州市人民政府门户网站", "https://www.liuzhou.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "上汽通用五菱汽车股份有限公司",
      intro: "柳州龙头制造企业，持续推动智能制造、新能源汽车与工业数字化场景建设。",
      aliases: ["上汽通用五菱", "五菱"],
      sourceRefs: [createSourceRef("上汽通用五菱汽车股份有限公司", "https://www.sgmw.com.cn/", "企业官网")],
    },
    innovation: {
      name: "广西科技大学",
      intro: "柳州本地重点高校，在装备制造、信息技术与工程人才培养方面具备持续供给能力。",
      aliases: ["广科大"],
      sourceRefs: [createSourceRef("广西科技大学", "https://www.gxust.edu.cn/", "学校官网")],
    },
  },
  guilin: {
    government: {
      name: "桂林市人民政府",
      intro: "作为桂林综合政务主体，统筹生态保护、文旅空间治理和遥感监测应用。",
      aliases: ["桂林市政府", "桂林政府"],
      sourceRefs: [createSourceRef("桂林市人民政府门户网站", "https://www.guilin.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "桂林旅游股份有限公司",
      intro: "桂林重要上市文旅企业，连接景区景点、交通客运和文旅场景数字化应用。",
      aliases: ["桂林旅游"],
      sourceRefs: [createSourceRef("桂林旅游股份有限公司", "http://www.guilintravel.com/", "企业官网")],
    },
    innovation: {
      name: "桂林理工大学",
      intro: "桂林理工大学在地学、资源环境与信息工程方向具备持续的人才与科研支撑能力。",
      aliases: ["桂林理工", "桂工"],
      sourceRefs: [createSourceRef("桂林理工大学", "https://www.glut.edu.cn/", "学校官网")],
    },
  },
  beihai: {
    government: {
      name: "北海市人民政府",
      intro: "作为北海综合政务主体，统筹海洋治理、临港产业和沿海空间利用协同。",
      aliases: ["北海市政府", "北海政府"],
      sourceRefs: [createSourceRef("北海市人民政府门户网站", "https://www.beihai.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西北港新材料有限公司",
      intro: "北海铁山港重点工业企业，承接临港制造、产业链协同和沿海工业数字化能力。",
      aliases: ["北港新材料"],
      sourceRefs: [createSourceRef("广西北港新材料有限公司", "http://www.bgxcl.com/", "企业官网")],
    },
    innovation: {
      name: "北海艺术设计学院",
      intro: "北海本地高校，具备设计、数字创意与应用型人才培养能力。",
      aliases: ["北艺"],
      sourceRefs: [createSourceRef("北海艺术设计学院", "https://webplus.sszss.com/", "学校官网")],
    },
  },
  qinzhou: {
    government: {
      name: "钦州市人民政府",
      intro: "作为钦州综合政务主体，统筹港航调度、临港产业、陆海新通道和跨境协同场景。",
      aliases: ["钦州市政府", "钦州政府"],
      sourceRefs: [createSourceRef("钦州市人民政府门户网站", "https://www.qinzhou.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西华谊能源化工有限公司",
      intro: "钦州港片区重点化工企业，承接临港工业、数字化工厂和绿色低碳制造场景。",
      aliases: ["广西华谊能化", "华谊能化"],
      sourceRefs: [createSourceRef("钦州：华谊能化“硬核”科技领跑绿色低碳化工", "https://yqb.gxzf.gov.cn/zwdt123/dszx/t23407695.shtml", "政府公开报道")],
    },
    innovation: {
      name: "北部湾大学",
      intro: "北部湾大学位于钦州，在海洋、港航、信息技术与区域协同人才培养方面具备支撑能力。",
      aliases: ["湾大"],
      sourceRefs: [createSourceRef("北部湾大学", "https://www.bbgu.edu.cn/", "学校官网")],
    },
  },
  fangchenggang: {
    government: {
      name: "防城港市人民政府",
      intro: "作为防城港综合政务主体，统筹口岸联动、沿海开放和海洋安全协同。",
      aliases: ["防城港市政府", "防城港政府"],
      sourceRefs: [createSourceRef("防城港市人民政府门户网站", "https://www.fcgs.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西防城港核电有限公司",
      intro: "防城港重大能源企业，连接临港工业、清洁能源保障与重大工程场景。",
      aliases: ["防城港核电"],
      sourceRefs: [createSourceRef("广西防城港核电项目", "https://www.cgnpc.com.cn/cgn/hngy08/lm_tt_two_hngy.shtml", "集团官方介绍")],
    },
    innovation: {
      name: "防城港职业技术学院",
      intro: "防城港本地高校，在智能制造、物流、海洋渔业与应用型人才培养上具备供给能力。",
      aliases: ["防城港职院"],
      sourceRefs: [createSourceRef("防城港职业技术学院", "https://www.fcgzy.edu.cn/overview/", "学校官网")],
    },
  },
  baise: {
    government: {
      name: "百色市人民政府",
      intro: "作为百色综合政务主体，统筹西部资源开发、交通通道和空间治理服务。",
      aliases: ["百色市政府", "百色政府"],
      sourceRefs: [createSourceRef("百色市人民政府门户网站", "https://www.baise.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "吉利百矿集团有限公司",
      intro: "百色重要工业企业，承接煤电铝一体化、资源开发和工业园区协同发展。",
      aliases: ["百矿集团", "吉利百矿"],
      sourceRefs: [createSourceRef("吉利百矿集团有限公司", "https://www.gxind.com/company/1183/companyinfo.htm", "广西新产品推介和交易平台")],
    },
    innovation: {
      name: "百色学院",
      intro: "百色学院是本地本科高校，在区域发展、资源环境和应用型人才培养方面提供支撑。",
      aliases: [],
      sourceRefs: [createSourceRef("百色学院", "https://www.bsuc.cn/", "学校官网")],
    },
  },
  hechi: {
    government: {
      name: "河池市人民政府",
      intro: "作为河池综合政务主体，统筹山地生态保护、资源监测和遥感治理场景。",
      aliases: ["河池市政府", "河池政府"],
      sourceRefs: [createSourceRef("河池市人民政府门户网站", "https://www.hechi.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西南丹南方金属有限公司",
      intro: "河池重点工业企业，连接有色金属、资源开发和绿色制造能力。",
      aliases: ["南丹南方金属"],
      sourceRefs: [createSourceRef("南方有色集团简介", "https://www.nanfangmetal.com/about/index.html", "企业官网")],
    },
    innovation: {
      name: "河池学院",
      intro: "河池学院具备山地生态、区域教育与应用型人才培养能力，是当地创新供给的重要高校主体。",
      aliases: [],
      sourceRefs: [createSourceRef("河池学院", "https://www.hcnu.edu.cn/", "学校官网")],
    },
  },
  hezhou: {
    government: {
      name: "贺州市人民政府",
      intro: "作为贺州综合政务主体，统筹东部通道、碳酸钙产业与土地资源承载协同。",
      aliases: ["贺州市政府", "贺州政府"],
      sourceRefs: [createSourceRef("贺州市人民政府门户网站", "https://www.gxhz.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西贺州市科隆粉体有限公司",
      intro: "贺州重点新材料企业，依托碳酸钙资源形成材料加工与产业协同能力。",
      aliases: ["科隆粉体"],
      sourceRefs: [createSourceRef("广西贺州市科隆粉体有限公司", "http://www.kelong-powder.com/", "企业官网")],
    },
    innovation: {
      name: "贺州学院",
      intro: "贺州学院在区域产业转型、信息化和应用型人才培养方面具备本地支撑能力。",
      aliases: [],
      sourceRefs: [createSourceRef("贺州学院", "https://www.hzxy.edu.cn/", "学校官网")],
    },
  },
  laibin: {
    government: {
      name: "来宾市人民政府",
      intro: "作为来宾综合政务主体，统筹中部连接带园区空间、能源保障与产业协同布局。",
      aliases: ["来宾市政府", "来宾政府"],
      sourceRefs: [createSourceRef("来宾市人民政府门户网站", "https://www.laibin.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西来宾银海铝业有限责任公司",
      intro: "来宾重点工业企业，承接铝产业链延伸、园区布局与能源要素协同。",
      aliases: ["来宾银海铝业", "广投银海铝业"],
      sourceRefs: [createSourceRef("广西来宾银海铝业有限责任公司", "https://www.gxind.com/company/1279/companyinfo.htm", "广西新产品推介和交易平台")],
    },
    innovation: {
      name: "广西科技师范学院",
      intro: "广西科技师范学院在来宾布局应用技术、师范教育与校地合作人才培养，是区域创新供给的重要高校主体。",
      aliases: ["广西科师"],
      sourceRefs: [createSourceRef("广西科技师范学院", "https://www.gxstnu.edu.cn/", "学校官网")],
    },
  },
  guigang: {
    government: {
      name: "贵港市人民政府",
      intro: "作为贵港综合政务主体，统筹交通组织、物流服务和园区承载建设。",
      aliases: ["贵港市政府", "贵港政府"],
      sourceRefs: [createSourceRef("贵港市人民政府门户网站", "https://www.gxgg.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西贵港钢铁集团有限公司",
      intro: "贵港龙头工业企业，连接冶炼制造、物流通道和园区产业协同。",
      aliases: ["贵钢集团", "贵港钢铁"],
      sourceRefs: [createSourceRef("广西贵港钢铁集团有限公司", "http://www.guisteel.com/", "企业官网")],
    },
    innovation: {
      name: "广西物流职业技术学院",
      intro: "广西物流职业技术学院位于贵港，围绕现代物流、智慧交通和应用型人才培养持续供给能力。",
      aliases: ["广西物流职院"],
      sourceRefs: [createSourceRef("广西物流职业技术学院", "https://www.gxlvtc.edu.cn/", "学校官网")],
    },
  },
  wuzhou: {
    government: {
      name: "梧州市人民政府",
      intro: "作为梧州综合政务主体，统筹东向开放、物流联动与跨区域协同场景。",
      aliases: ["梧州市政府", "梧州政府"],
      sourceRefs: [createSourceRef("梧州市人民政府门户网站", "https://www.wuzhou.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西梧州中恒集团股份有限公司",
      intro: "梧州重要上市企业，连接医药健康、工业园区和区域产业协同发展。",
      aliases: ["中恒集团"],
      sourceRefs: [createSourceRef("广西梧州中恒集团股份有限公司", "http://www.wz-zhongheng.com/", "企业官网")],
    },
    innovation: {
      name: "梧州学院",
      intro: "梧州学院具备面向东融发展的应用型人才培养和区域产业服务能力。",
      aliases: [],
      sourceRefs: [createSourceRef("梧州学院", "https://www.gxuwz.edu.cn/", "学校官网")],
    },
  },
  yulin: {
    government: {
      name: "玉林市人民政府",
      intro: "作为玉林综合政务主体，统筹产业承接、交通联系和应用扩散布局。",
      aliases: ["玉林市政府", "玉林政府"],
      sourceRefs: [createSourceRef("玉林市人民政府门户网站", "https://www.yulin.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西玉柴机器集团有限公司",
      intro: "玉林龙头制造企业，在动力系统、装备制造和工业创新方面形成强劲带动效应。",
      aliases: ["玉柴集团", "玉柴"],
      sourceRefs: [createSourceRef("广西玉柴机器集团有限公司", "https://www.yuchai.com/about/our-company.htm", "企业官网")],
    },
    innovation: {
      name: "玉林师范学院",
      intro: "玉林师范学院是玉林本地重要高校，在教育、信息技术与区域应用型人才培养方面持续发力。",
      aliases: [],
      sourceRefs: [createSourceRef("玉林师范学院", "https://www.ylu.edu.cn/", "学校官网")],
    },
  },
  chongzuo: {
    government: {
      name: "崇左市人民政府",
      intro: "作为崇左综合政务主体，统筹边境开放、跨境通道和口岸协同发展。",
      aliases: ["崇左市政府", "崇左政府"],
      sourceRefs: [createSourceRef("崇左市人民政府门户网站", "https://www.chongzuo.gov.cn/", "政府门户网站")],
    },
    industry: {
      name: "广西南国铜业有限责任公司",
      intro: "崇左重点工业企业，承接边境园区制造、铜冶炼和跨区域产业协同任务。",
      aliases: ["南国铜业"],
      sourceRefs: [createSourceRef("广西南国铜业有限责任公司", "https://www.nanfangmetal.com/about/base4.html", "企业官网")],
    },
    innovation: {
      name: "广西民族师范学院",
      intro: "广西民族师范学院位于崇左，在边疆教育、区域文化和应用型人才培养方面具备明显支撑能力。",
      aliases: [],
      sourceRefs: [createSourceRef("广西民族师范学院", "https://www.gxnun.edu.cn/", "学校官网")],
    },
  },
};

const cityStrategyConfig = {
  nanning: {
    goalIds: ["industry-upgrade-goal", "digital-governance-goal", "low-altitude-goal", "regional-collab-goal"],
    contentIds: ["beidou-industry-content", "digital-twin-industry-content", "data-compute-factor", "park-space-factor", "talent-factor", "airport-factor"],
    activityIds: ["park-digital-base-activity", "beidou-application", "digital-twin", "low-altitude-economy", "satellite-data-sharing-activity", "industry-collaboration-activity", "standards-governance-activity"],
    evaluationIds: ["tech-capacity-eval", "collaboration-eval", "low-altitude-eval", "innovation-eval", "benefit-eval"],
    platformIds: ["gx-beidou-park", "nanning-high-tech-zone", "guangxi-big-data-center"],
    evidenceIds: ["gx-subject-survey", "gx-governance-study", "gx-low-altitude-study", "gx-tech-carrier-study"],
    linkedCityIds: ["qinzhou", "fangchenggang", "chongzuo"],
  },
  liuzhou: {
    goalIds: ["industry-upgrade-goal", "cost-efficiency-goal", "regional-collab-goal"],
    contentIds: ["surveying-industry-content", "digital-twin-industry-content", "park-space-factor", "transport-factor", "talent-factor"],
    activityIds: ["park-digital-base-activity", "digital-twin", "low-altitude-economy", "industry-collaboration-activity"],
    evaluationIds: ["tech-capacity-eval", "land-efficiency-eval", "application-output-eval", "benefit-eval"],
    platformIds: ["liuzhou-industrial-spatial-platform"],
    evidenceIds: ["gx-industry-collab-study", "gx-tech-carrier-study", "gx-low-altitude-study"],
    linkedCityIds: ["nanning", "laibin"],
  },
  guilin: {
    goalIds: ["green-protection-goal", "resource-governance-goal", "digital-governance-goal"],
    contentIds: ["remote-sensing-industry-content", "natural-resource-content", "ecology-redline-factor", "talent-factor"],
    activityIds: ["disaster-monitoring-activity", "remote-sensing", "ecological-restoration-activity", "satellite-data-sharing-activity"],
    evaluationIds: ["ecology-eval", "application-output-eval", "innovation-eval", "benefit-eval"],
    platformIds: ["guilin-eco-monitoring-platform"],
    evidenceIds: ["gx-ecology-study", "gx-governance-study", "gx-tech-carrier-study"],
    linkedCityIds: ["hechi", "hezhou"],
  },
  beihai: {
    goalIds: ["marine-development-goal", "green-protection-goal", "regional-collab-goal"],
    contentIds: ["marine-industry-content", "coastline-factor", "port-factor", "corridor-factor"],
    activityIds: ["marine-service-scenarios", "smart-port-activity", "disaster-monitoring-activity"],
    evaluationIds: ["marine-eval", "application-output-eval", "ecology-eval", "benefit-eval"],
    platformIds: ["beihai-marine-service-platform"],
    evidenceIds: ["gx-marine-study", "gx-corridor-study", "gx-ecology-study"],
    linkedCityIds: ["qinzhou", "fangchenggang", "nanning"],
  },
  qinzhou: {
    goalIds: ["marine-development-goal", "regional-collab-goal", "digital-governance-goal"],
    contentIds: ["marine-industry-content", "port-factor", "asean-location-factor", "corridor-factor", "coastline-factor"],
    activityIds: ["smart-port-activity", "cross-border-logistics-activity", "marine-service-scenarios", "standards-governance-activity"],
    evaluationIds: ["marine-eval", "collaboration-eval", "application-output-eval", "benefit-eval"],
    platformIds: ["qinzhou-port-space-platform"],
    evidenceIds: ["gx-marine-study", "gx-border-open-study", "gx-corridor-study"],
    linkedCityIds: ["nanning", "beihai", "fangchenggang", "chongzuo"],
  },
  fangchenggang: {
    goalIds: ["marine-development-goal", "regional-collab-goal", "green-protection-goal"],
    contentIds: ["marine-industry-content", "coastline-factor", "corridor-factor", "asean-location-factor"],
    activityIds: ["cross-border-logistics-activity", "marine-service-scenarios", "disaster-monitoring-activity"],
    evaluationIds: ["marine-eval", "collaboration-eval", "ecology-eval", "benefit-eval"],
    platformIds: ["fangchenggang-port-monitoring-platform"],
    evidenceIds: ["gx-marine-study", "gx-border-open-study", "gx-ecology-study"],
    linkedCityIds: ["nanning", "beihai", "qinzhou", "chongzuo"],
  },
  baise: {
    goalIds: ["resource-governance-goal", "regional-collab-goal", "industry-upgrade-goal"],
    contentIds: ["natural-resource-content", "corridor-factor", "transport-factor", "land-factor"],
    activityIds: ["land-space-planning-activity", "satellite-data-sharing-activity", "industry-collaboration-activity"],
    evaluationIds: ["factor-support-eval", "land-efficiency-eval", "application-output-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-resource-study", "gx-corridor-study", "gx-governance-study"],
    linkedCityIds: ["hechi", "chongzuo"],
  },
  hechi: {
    goalIds: ["green-protection-goal", "resource-governance-goal", "digital-governance-goal"],
    contentIds: ["remote-sensing-industry-content", "ecology-redline-factor", "natural-resource-content", "land-factor"],
    activityIds: ["remote-sensing", "disaster-monitoring-activity", "ecological-restoration-activity", "satellite-data-sharing-activity"],
    evaluationIds: ["ecology-eval", "factor-support-eval", "application-output-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-ecology-study", "gx-resource-study", "gx-tech-carrier-study"],
    linkedCityIds: ["guilin", "baise"],
  },
  hezhou: {
    goalIds: ["regional-collab-goal", "industry-upgrade-goal", "cost-efficiency-goal"],
    contentIds: ["transport-factor", "land-factor", "park-space-factor", "corridor-factor"],
    activityIds: ["park-digital-base-activity", "industry-collaboration-activity", "land-space-planning-activity"],
    evaluationIds: ["land-efficiency-eval", "factor-support-eval", "collaboration-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-corridor-study", "gx-transport-energy-study", "gx-industry-collab-study"],
    linkedCityIds: ["guilin", "wuzhou"],
  },
  laibin: {
    goalIds: ["industry-upgrade-goal", "cost-efficiency-goal", "regional-collab-goal"],
    contentIds: ["park-space-factor", "energy-factor", "transport-factor", "land-factor"],
    activityIds: ["park-digital-base-activity", "industry-collaboration-activity", "standards-governance-activity"],
    evaluationIds: ["factor-support-eval", "land-efficiency-eval", "application-output-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-transport-energy-study", "gx-industry-collab-study", "gx-governance-study"],
    linkedCityIds: ["liuzhou", "nanning", "guigang"],
  },
  guigang: {
    goalIds: ["regional-collab-goal", "cost-efficiency-goal", "industry-upgrade-goal"],
    contentIds: ["transport-factor", "park-space-factor", "corridor-factor", "land-factor"],
    activityIds: ["park-digital-base-activity", "beidou-application", "industry-collaboration-activity"],
    evaluationIds: ["factor-support-eval", "collaboration-eval", "application-output-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-corridor-study", "gx-transport-energy-study", "gx-industry-collab-study"],
    linkedCityIds: ["laibin", "wuzhou", "yulin"],
  },
  wuzhou: {
    goalIds: ["regional-collab-goal", "industry-upgrade-goal", "digital-governance-goal"],
    contentIds: ["transport-factor", "corridor-factor", "park-space-factor", "data-compute-factor"],
    activityIds: ["cross-border-logistics-activity", "standards-governance-activity", "park-digital-base-activity"],
    evaluationIds: ["collaboration-eval", "application-output-eval", "tech-capacity-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-corridor-study", "gx-governance-study", "gx-transport-energy-study"],
    linkedCityIds: ["hezhou", "guigang", "yulin"],
  },
  yulin: {
    goalIds: ["industry-upgrade-goal", "regional-collab-goal", "digital-governance-goal"],
    contentIds: ["transport-factor", "park-space-factor", "talent-factor", "digital-twin-industry-content"],
    activityIds: ["industry-collaboration-activity", "park-digital-base-activity", "digital-twin", "beidou-application"],
    evaluationIds: ["innovation-eval", "collaboration-eval", "application-output-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-industry-collab-study", "gx-tech-carrier-study", "gx-corridor-study"],
    linkedCityIds: ["guigang", "wuzhou", "chongzuo"],
  },
  chongzuo: {
    goalIds: ["regional-collab-goal", "digital-governance-goal", "cost-efficiency-goal"],
    contentIds: ["corridor-factor", "asean-location-factor", "transport-factor", "natural-resource-content"],
    activityIds: ["cross-border-logistics-activity", "standards-governance-activity", "beidou-application", "park-digital-base-activity"],
    evaluationIds: ["collaboration-eval", "application-output-eval", "factor-support-eval", "benefit-eval"],
    platformIds: [],
    evidenceIds: ["gx-border-open-study", "gx-corridor-study", "gx-governance-study"],
    linkedCityIds: ["nanning", "qinzhou", "fangchenggang", "baise", "yulin"],
  },
};

const cityStrategies = guangxiCityProfiles.map((city) => ({
  ...city,
  ...cityStrategyConfig[city.id],
  subjectIds: {
    government: `${city.id}-government-subject`,
    industry: `${city.id}-industry-subject`,
    innovation: `${city.id}-innovation-subject`,
  },
}));

const goalUsage = createUsageMap(goalMeta.map(([id]) => id));
const contentUsage = createUsageMap(contentMeta.map(([id]) => id));
const activityUsage = createUsageMap(activityMeta.map(([id]) => id));
const evaluationUsage = createUsageMap(evaluationMeta.map(([id]) => id));

cityStrategies.forEach((city) => {
  city.goalIds?.forEach((id) => goalUsage.get(id)?.add(city.id));
  city.contentIds?.forEach((id) => contentUsage.get(id)?.add(city.id));
  city.activityIds?.forEach((id) => activityUsage.get(id)?.add(city.id));
  city.evaluationIds?.forEach((id) => evaluationUsage.get(id)?.add(city.id));
});

const goals = goalMeta.map(([id, name, subtype, intro], index) =>
  goal({
    id,
    name,
    subtype,
    intro,
    regionIds: [...goalUsage.get(id)],
    displayOrder: 100 + index,
  }),
);

const contents = contentMeta.map(([id, type, name, subtype, intro], index) =>
  content(type, {
    id,
    name,
    subtype,
    intro,
    regionIds: [...contentUsage.get(id)],
    displayOrder: 140 + index,
  }),
);

const activities = activityMeta.map(([id, type, name, subtype, intro], index) =>
  activity(type, {
    id,
    name,
    subtype,
    intro,
    regionIds: [...activityUsage.get(id)],
    displayOrder: 220 + index,
  }),
);

const evaluations = evaluationMeta.map(([id, name, subtype, intro, scorecard], index) =>
  evaluation({
    id,
    name,
    subtype,
    intro,
    scorecard,
    regionIds: [...evaluationUsage.get(id)],
    displayOrder: 280 + index,
  }),
);

const regionContents = [
  content("region", {
    id: guangxiProvince.id,
    name: guangxiProvince.labelZh,
    intro: "广西作为全域研究范围，承接城市协同、平台布局和空间治理主线。",
    subtype: "province-region",
    region: guangxiProvince.labelZh,
    regionIds: [guangxiProvince.id],
    spatialScope: "province",
    displayOrder: 180,
    sourceRefs: [createSourceRef("广西壮族自治区人民政府门户网站", "https://www.gxzf.gov.cn/", "政府门户网站")],
  }),
  ...cityStrategies.map((city, index) =>
    content("region", {
      id: city.id,
      name: city.labelZh,
      intro: city.graphIntroZh,
      subtype: "city-region",
      region: city.labelZh,
      regionIds: mergeRegionIds([city.id]),
      parentId: guangxiProvince.id,
      spatialScope: "city",
      displayOrder: 181 + index,
      sourceRefs: citySubjectProfiles[city.id]?.government?.sourceRefs ?? [],
    }),
  ),
];

const citySubjects = cityStrategies.flatMap((city, index) => {
  const profiles = citySubjectProfiles[city.id];
  return [
    createCitySubject(
      city,
      "government",
      "institution",
      profiles.government.name,
      profiles.government.intro,
      ["政府", "协同"],
      320 + index * 3,
      {
        aliases: profiles.government.aliases,
        sourceRefs: profiles.government.sourceRefs,
      },
    ),
    createCitySubject(
      city,
      "industry",
      "enterprise",
      profiles.industry.name,
      profiles.industry.intro,
      ["企业", "产业"],
      321 + index * 3,
      {
        aliases: profiles.industry.aliases,
        sourceRefs: profiles.industry.sourceRefs,
      },
    ),
    createCitySubject(
      city,
      "innovation",
      "university",
      profiles.innovation.name,
      profiles.innovation.intro,
      ["创新", "人才"],
      322 + index * 3,
      {
        aliases: profiles.innovation.aliases,
        sourceRefs: profiles.innovation.sourceRefs,
      },
    ),
  ];
});

const entities = [...provinceSubjects, ...citySubjects, ...preservedPlatforms, ...goals, ...contents, ...regionContents, ...activities, ...evaluations];

const provinceSubjectGoalMap = {
  "gx-gov-org": ["industry-upgrade-goal", "regional-collab-goal", "digital-governance-goal"],
  "gx-dnr-org": ["resource-governance-goal", "green-protection-goal", "digital-governance-goal"],
  "mnr-org": ["resource-governance-goal", "green-protection-goal"],
  "cagis-org": ["industry-upgrade-goal", "regional-collab-goal"],
  "csgpc-org": ["digital-governance-goal", "cost-efficiency-goal"],
  "aircas-org": ["green-protection-goal", "resource-governance-goal", "low-altitude-goal"],
  "whu-org": ["industry-upgrade-goal", "digital-governance-goal", "green-protection-goal"],
  "supermap-org": ["digital-governance-goal", "cost-efficiency-goal", "industry-upgrade-goal"],
  "guangxi-enterprise-cluster": ["industry-upgrade-goal", "cost-efficiency-goal", "regional-collab-goal"],
};

const globalGoalContentMap = {
  "industry-upgrade-goal": ["surveying-industry-content", "beidou-industry-content", "digital-twin-industry-content", "geoai-industry-content", "park-space-factor", "talent-factor"],
  "resource-governance-goal": ["natural-resource-content", "remote-sensing-industry-content", "ecology-redline-factor", "land-factor", "data-compute-factor"],
  "regional-collab-goal": ["corridor-factor", "transport-factor", "park-space-factor", "asean-location-factor", "port-factor"],
  "green-protection-goal": ["ecology-redline-factor", "coastline-factor", "remote-sensing-industry-content", "natural-resource-content"],
  "cost-efficiency-goal": ["data-compute-factor", "digital-twin-industry-content", "park-space-factor", "transport-factor"],
  "marine-development-goal": ["marine-industry-content", "coastline-factor", "port-factor", "corridor-factor"],
  "low-altitude-goal": ["low-altitude-industry-content", "airport-factor", "beidou-industry-content", "data-compute-factor"],
  "digital-governance-goal": ["digital-twin-industry-content", "data-compute-factor", "talent-factor", "natural-resource-content", "park-space-factor"],
};

const globalContentActivityMap = {
  "surveying-industry-content": ["real-scene-3d", "gis-platform", "park-digital-base-activity"],
  "remote-sensing-industry-content": ["remote-sensing", "disaster-monitoring-activity", "ecological-restoration-activity", "satellite-data-sharing-activity"],
  "beidou-industry-content": ["beidou-application", "low-altitude-economy"],
  "geoai-industry-content": ["geo-ai", "digital-twin", "standards-governance-activity"],
  "digital-twin-industry-content": ["digital-twin", "park-digital-base-activity", "gis-platform"],
  "marine-industry-content": ["marine-service-scenarios", "smart-port-activity", "cross-border-logistics-activity"],
  "low-altitude-industry-content": ["low-altitude-economy", "beidou-application"],
  "natural-resource-content": ["natural-resource-governance", "land-space-planning-activity", "disaster-monitoring-activity"],
  "transport-factor": ["cross-border-logistics-activity", "beidou-application", "park-digital-base-activity"],
  "port-factor": ["smart-port-activity", "cross-border-logistics-activity", "marine-service-scenarios"],
  "airport-factor": ["low-altitude-economy", "beidou-application"],
  "land-factor": ["land-space-planning-activity", "park-digital-base-activity"],
  "park-space-factor": ["park-digital-base-activity", "industry-collaboration-activity"],
  "energy-factor": ["park-digital-base-activity", "digital-twin"],
  "data-compute-factor": ["gis-platform", "digital-twin", "satellite-data-sharing-activity"],
  "ecology-redline-factor": ["ecological-restoration-activity", "disaster-monitoring-activity", "natural-resource-governance"],
  "coastline-factor": ["marine-service-scenarios", "smart-port-activity", "disaster-monitoring-activity"],
  "asean-location-factor": ["cross-border-logistics-activity", "standards-governance-activity"],
  "talent-factor": ["industry-collaboration-activity", "geo-ai", "standards-governance-activity"],
  "corridor-factor": ["cross-border-logistics-activity", "smart-port-activity", "beidou-application"],
};

const globalActivityEvaluationMap = {
  "remote-sensing": ["tech-capacity-eval", "application-output-eval", "ecology-eval"],
  "beidou-application": ["tech-capacity-eval", "application-output-eval", "factor-support-eval"],
  "real-scene-3d": ["tech-capacity-eval", "application-output-eval"],
  "gis-platform": ["tech-capacity-eval", "collaboration-eval", "benefit-eval"],
  "geo-ai": ["innovation-eval", "tech-capacity-eval", "benefit-eval"],
  "digital-twin": ["tech-capacity-eval", "application-output-eval", "benefit-eval"],
  "natural-resource-governance": ["application-output-eval", "ecology-eval", "benefit-eval"],
  "marine-service-scenarios": ["marine-eval", "application-output-eval", "benefit-eval"],
  "low-altitude-economy": ["low-altitude-eval", "application-output-eval", "innovation-eval"],
  "land-space-planning-activity": ["land-efficiency-eval", "factor-support-eval", "benefit-eval"],
  "disaster-monitoring-activity": ["application-output-eval", "ecology-eval", "benefit-eval"],
  "smart-port-activity": ["marine-eval", "collaboration-eval", "application-output-eval"],
  "smart-agriculture-activity": ["application-output-eval", "benefit-eval"],
  "cross-border-logistics-activity": ["collaboration-eval", "application-output-eval", "benefit-eval"],
  "park-digital-base-activity": ["factor-support-eval", "tech-capacity-eval", "land-efficiency-eval"],
  "ecological-restoration-activity": ["ecology-eval", "application-output-eval", "benefit-eval"],
  "satellite-data-sharing-activity": ["collaboration-eval", "tech-capacity-eval", "innovation-eval"],
  "industry-collaboration-activity": ["collaboration-eval", "innovation-eval", "benefit-eval"],
  "standards-governance-activity": ["collaboration-eval", "factor-support-eval", "benefit-eval"],
};

const structuralEdges = [
  ...expandMap(provinceSubjectGoalMap, "pursues", ["gx-subject-survey", "gx-goal-value-study"]),
  ...expandMap(globalGoalContentMap, "focuses_on", ["gx-goal-value-study", "gx-spatial-factor-study"]),
  ...expandMap(globalContentActivityMap, "enables", ["gx-spatial-factor-study", "gx-tech-carrier-study"]),
  ...expandMap(globalActivityEvaluationMap, "assesses", ["gx-evaluation-model"]),
  ...cityStrategies.flatMap((city) => {
    const evidenceIds = city.evidenceIds ?? ["gx-research-framework"];
    const leadGoalId = city.goalIds[0];
    const secondaryGoalId = city.goalIds[1] ?? leadGoalId;
    const innovationGoalId = city.goalIds[2] ?? leadGoalId;
    const primaryActivityId = city.activityIds[0];
    const supportingActivities = city.activityIds.slice(1, 4);

      return [
        ...city.goalIds.map((goalId) => createEdge(city.subjectIds.government, goalId, "pursues", { researchEvidenceIds: evidenceIds })),
        createEdge(city.subjectIds.industry, leadGoalId, "pursues", { researchEvidenceIds: evidenceIds }),
        createEdge(city.subjectIds.industry, secondaryGoalId, "pursues", { researchEvidenceIds: evidenceIds }),
        createEdge(city.subjectIds.innovation, leadGoalId, "pursues", { researchEvidenceIds: evidenceIds }),
        createEdge(city.subjectIds.innovation, innovationGoalId, "pursues", { researchEvidenceIds: evidenceIds }),
        ...city.goalIds.flatMap((goalId) => [
          createEdge(goalId, city.id, "focuses_on", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
          ...city.contentIds.map((contentId) =>
            createEdge(goalId, contentId, "focuses_on", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
          ),
        ]),
        ...city.contentIds.map((contentId) =>
          createEdge(city.id, contentId, "focuses_on", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
        ),
        createEdge(city.id, primaryActivityId, "enables", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
        ...supportingActivities.map((activityId) =>
          createEdge(city.id, activityId, "enables", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
        ),
        ...city.evaluationIds.map((evaluationId) =>
          createEdge(evaluationId, city.id, "assesses", { researchEvidenceIds: evidenceIds, keywords: [city.labelZh] }),
        ),
      ];
    }),
  ];

const collaborationEdges = [
  createEdge("gx-gov-org", "gx-dnr-org", "collaborates_with", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("gx-gov-org", "guangxi-enterprise-cluster", "organizes", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("gx-dnr-org", "natural-resource-governance", "supports", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("mnr-org", "standards-governance-activity", "guides", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("cagis-org", "industry-collaboration-activity", "organizes", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("csgpc-org", "gis-platform", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("csgpc-org", "digital-twin", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("aircas-org", "remote-sensing", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("aircas-org", "low-altitude-economy", "supports", { researchEvidenceIds: ["gx-low-altitude-study"] }),
  createEdge("whu-org", "geo-ai", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("whu-org", "real-scene-3d", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("supermap-org", "gis-platform", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("supermap-org", "digital-twin", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("guangxi-enterprise-cluster", "park-digital-base-activity", "supports", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("guangxi-enterprise-cluster", "industry-collaboration-activity", "supports", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("gx-beidou-park", "beidou-application", "supports", { researchEvidenceIds: ["gx-tech-carrier-study", "gx-low-altitude-study"] }),
  createEdge("gx-beidou-park", "low-altitude-economy", "supports", { researchEvidenceIds: ["gx-low-altitude-study"] }),
  createEdge("nanning-high-tech-zone", "park-digital-base-activity", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("nanning-high-tech-zone", "digital-twin", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("guangxi-big-data-center", "gis-platform", "supports", { researchEvidenceIds: ["gx-governance-study", "gx-tech-carrier-study"] }),
  createEdge("guangxi-big-data-center", "satellite-data-sharing-activity", "supports", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("liuzhou-industrial-spatial-platform", "digital-twin", "supports", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  createEdge("liuzhou-industrial-spatial-platform", "park-digital-base-activity", "supports", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("guilin-eco-monitoring-platform", "disaster-monitoring-activity", "supports", { researchEvidenceIds: ["gx-ecology-study"] }),
  createEdge("guilin-eco-monitoring-platform", "ecological-restoration-activity", "supports", { researchEvidenceIds: ["gx-ecology-study"] }),
  createEdge("beihai-marine-service-platform", "marine-service-scenarios", "supports", { researchEvidenceIds: ["gx-marine-study"] }),
  createEdge("beihai-marine-service-platform", "smart-port-activity", "supports", { researchEvidenceIds: ["gx-marine-study"] }),
  createEdge("qinzhou-port-space-platform", "smart-port-activity", "supports", { researchEvidenceIds: ["gx-marine-study", "gx-corridor-study"] }),
  createEdge("qinzhou-port-space-platform", "cross-border-logistics-activity", "supports", { researchEvidenceIds: ["gx-border-open-study", "gx-corridor-study"] }),
  createEdge("fangchenggang-port-monitoring-platform", "cross-border-logistics-activity", "supports", { researchEvidenceIds: ["gx-border-open-study"] }),
  createEdge("fangchenggang-port-monitoring-platform", "marine-service-scenarios", "supports", { researchEvidenceIds: ["gx-marine-study"] }),
  ...cityStrategies.flatMap((city) => {
    const evidenceIds = city.evidenceIds ?? ["gx-research-framework"];
    const primaryActivityId = city.activityIds[0];
    const secondaryActivityId = city.activityIds[1] ?? primaryActivityId;

    return [
      createEdge(city.subjectIds.government, city.subjectIds.industry, "organizes", { researchEvidenceIds: evidenceIds }),
      createEdge(city.subjectIds.government, city.subjectIds.innovation, "organizes", { researchEvidenceIds: evidenceIds }),
      createEdge(city.subjectIds.industry, city.subjectIds.innovation, "collaborates_with", { researchEvidenceIds: evidenceIds }),
      createEdge(city.subjectIds.industry, primaryActivityId, "supports", { researchEvidenceIds: evidenceIds }),
      createEdge(city.subjectIds.innovation, secondaryActivityId, "organizes", { researchEvidenceIds: evidenceIds }),
      ...city.platformIds.map((platformId) =>
        createEdge(platformId, primaryActivityId, "organizes", { researchEvidenceIds: evidenceIds }),
      ),
      ...city.linkedCityIds.map((linkedCityId) =>
        createEdge(city.subjectIds.government, `${linkedCityId}-government-subject`, "collaborates_with", {
          researchEvidenceIds: evidenceIds,
          keywords: [city.labelZh, cityById.get(linkedCityId)?.labelZh ?? ""],
        }),
      ),
    ];
  }),
];

const locationEdges = [
  ...provinceSubjects.map((entity) => createEdge(entity.id, guangxiProvince.id, "located_in", { researchEvidenceIds: ["gx-research-framework"] })),
  ...preservedPlatforms.map((entity) =>
    createEdge(entity.id, entity.parentId ?? guangxiProvince.id, "located_in", { researchEvidenceIds: ["gx-tech-carrier-study"] }),
  ),
  ...citySubjects.map((entity) =>
    createEdge(entity.id, entity.parentId ?? guangxiProvince.id, "located_in", { researchEvidenceIds: ["gx-subject-survey"] }),
  ),
  ...cityStrategies.flatMap((city) =>
    city.activityIds.map((activityId) =>
      createEdge(activityId, city.id, "located_in", { researchEvidenceIds: city.evidenceIds ?? ["gx-research-framework"], keywords: [city.labelZh] }),
    ),
  ),
];

const constraintEdges = [
  createEdge("ecology-redline-factor", "industry-upgrade-goal", "constrains", { researchEvidenceIds: ["gx-ecology-study"] }),
  createEdge("ecology-redline-factor", "resource-governance-goal", "constrains", { researchEvidenceIds: ["gx-ecology-study"] }),
  createEdge("coastline-factor", "marine-development-goal", "constrains", { researchEvidenceIds: ["gx-marine-study", "gx-ecology-study"] }),
  createEdge("land-factor", "park-digital-base-activity", "constrains", { researchEvidenceIds: ["gx-transport-energy-study"] }),
  createEdge("energy-factor", "digital-twin", "constrains", { researchEvidenceIds: ["gx-transport-energy-study"] }),
  createEdge("airport-factor", "low-altitude-economy", "constrains", { researchEvidenceIds: ["gx-low-altitude-study"] }),
];

const goalActivityEvaluationBridges = [
  createEdge("digital-governance-goal", "standards-governance-activity", "guides", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("resource-governance-goal", "natural-resource-governance", "guides", { researchEvidenceIds: ["gx-governance-study"] }),
  createEdge("marine-development-goal", "marine-service-scenarios", "guides", { researchEvidenceIds: ["gx-marine-study"] }),
  createEdge("low-altitude-goal", "low-altitude-economy", "guides", { researchEvidenceIds: ["gx-low-altitude-study"] }),
  createEdge("regional-collab-goal", "cross-border-logistics-activity", "guides", { researchEvidenceIds: ["gx-corridor-study", "gx-border-open-study"] }),
  createEdge("industry-upgrade-goal", "industry-collaboration-activity", "guides", { researchEvidenceIds: ["gx-industry-collab-study"] }),
  createEdge("cost-efficiency-goal", "park-digital-base-activity", "guides", { researchEvidenceIds: ["gx-tech-carrier-study", "gx-transport-energy-study"] }),
  createEdge("green-protection-goal", "ecological-restoration-activity", "guides", { researchEvidenceIds: ["gx-ecology-study"] }),
  createEdge("benefit-eval", "industry-upgrade-goal", "assesses", { researchEvidenceIds: ["gx-evaluation-model"] }),
  createEdge("collaboration-eval", "regional-collab-goal", "assesses", { researchEvidenceIds: ["gx-evaluation-model"] }),
  createEdge("marine-eval", "marine-development-goal", "assesses", { researchEvidenceIds: ["gx-evaluation-model"] }),
  createEdge("low-altitude-eval", "low-altitude-goal", "assesses", { researchEvidenceIds: ["gx-evaluation-model"] }),
];

const edges = uniqueEdges([
  ...structuralEdges,
  ...collaborationEdges,
  ...locationEdges,
  ...constraintEdges,
  ...goalActivityEvaluationBridges,
]);

const taxonomy = {
  elementClasses: [
    { key: "subject", labelZh: "主体", labelEn: "Subject", descriptionZh: "政府、企业、高校、科研机构、平台和园区等赋能主体。", descriptionEn: "Government, enterprise, university, research and platform actors." },
    { key: "goal", labelZh: "目标", labelEn: "Goal", descriptionZh: "产业升级、资源治理、区域协同、绿色保护等价值目标。", descriptionEn: "Value targets such as upgrading, governance and coordination." },
    { key: "content", labelZh: "内容", labelEn: "Content", descriptionZh: "产业方向、空间要素、资源约束和城市锚点等内容层。", descriptionEn: "Industry directions, spatial factors, constraints and city anchors." },
    { key: "activity", labelZh: "活动", labelEn: "Activity", descriptionZh: "技术载体、项目建设、协同机制和场景应用。", descriptionEn: "Technology carriers, projects, coordination mechanisms and scenarios." },
    { key: "evaluation", labelZh: "评价", labelEn: "Evaluation", descriptionZh: "从要素保障、技术承载、协同水平和应用成效等维度评估。", descriptionEn: "Evaluation across support, capacity, coordination and outcomes." },
  ],
};

export const graphResearchBase = {
  regionScopes: guangxiRegionScopes,
  taxonomy,
  researchEvidence,
  entities,
  edges,
  views: {
    layered: {
      columns: taxonomy.elementClasses.map((item) => ({ elementClass: item.key })),
    },
    network: {
      featuredEntityId: "industry-upgrade-goal",
    },
  },
};
