import { guangxiCityProfiles, guangxiProvince, guangxiRegionScopes } from "./guangxi-regions-base.mjs";

const elementOrder = ["subject", "goal", "content", "activity", "evaluation"];

const citySourceMeta = {
  nanning: ["南宁市自然资源局", "http://zrzyj.nanning.gov.cn"],
  liuzhou: ["柳州市自然资源和规划局", "http://lz.dnr.gxzf.gov.cn"],
  guilin: ["桂林市自然资源局", "http://zrzyj.guilin.gov.cn"],
  beihai: ["北海市自然资源局", "http://www.beihai.gov.cn"],
  qinzhou: ["钦州市自然资源局", "https://www.qinzhou.gov.cn"],
  fangchenggang: ["防城港市自然资源局", "http://fcg.dnr.gxzf.gov.cn"],
  wuzhou: ["梧州市自然资源局", "http://zrzyj.wuzhou.gov.cn"],
  guigang: ["贵港市自然资源局", "http://gg.dnr.gxzf.gov.cn"],
  yulin: ["玉林市自然资源局", "http://zrzyj.yulin.gov.cn"],
  baise: ["百色市自然资源局", "http://zrzyj.baise.gov.cn"],
  hezhou: ["贺州市自然资源局", "http://hz.dnr.gxzf.gov.cn"],
  hechi: ["河池市自然资源局", "http://zrzyj.hechi.gov.cn"],
  laibin: ["来宾市自然资源局", "http://lb.dnr.gxzf.gov.cn"],
  chongzuo: ["崇左市自然资源局", "http://cz.dnr.gxzf.gov.cn"],
};

const cityPlans = {
  nanning: {
    dnrName: "南宁市自然资源局",
    specialSubjects: ["中国—东盟地理信息与卫星应用产业园", "南宁·中关村创新示范基地", "广西大学", "广西自然资源集团"],
    themes: ["产业总部", "平台研发", "跨境服务", "智慧城市", "北斗规模应用", "低空遥感", "时空大数据", "东盟合作"],
    scenes: ["中国—东盟地理信息产业合作", "南宁北斗规模应用试点", "智慧城市时空底座", "跨境数据服务", "产业园平台研发", "低空遥感作业"],
  },
  liuzhou: {
    dnrName: "柳州市自然资源和规划局",
    specialSubjects: ["柳东新区管理委员会", "柳州高新技术产业开发区管理委员会", "上汽通用五菱汽车股份有限公司", "广西柳工机械股份有限公司"],
    themes: ["工业级应用", "智慧交通", "智能制造配套", "工业数字孪生", "汽车产业协同", "工业互联网", "园区测绘", "物流调度"],
    scenes: ["汽车产业数字孪生", "智能制造空间监测", "工业互联网地图服务", "智慧交通路网感知", "园区三维建模", "设备定位管理"],
  },
  guilin: {
    dnrName: "桂林市自然资源局",
    specialSubjects: ["桂林理工大学", "桂林电子科技大学", "桂林国家高新技术产业开发区管理委员会", "漓江风景名胜区管理机构"],
    themes: ["无人机研发", "测绘装备", "遥感应用", "文旅数字孪生", "绿色保护", "喀斯特监测", "北斗时空基准", "三维建模"],
    scenes: ["漓江流域绿色保护", "喀斯特生态遥感", "文旅数字孪生", "无人机航测装备", "高校遥感解译", "自然资源数据建库"],
  },
  beihai: {
    dnrName: "北海市自然资源局",
    specialSubjects: ["北海电子信息产业园", "北海综合保税区管理委员会", "北海市海洋产业科技园", "北海港股份有限公司"],
    themes: ["海洋地理信息", "电子信息配套", "东盟跨境服务", "海岸带治理", "卫星导航终端", "港航保障", "海岛监测", "海洋数据"],
    scenes: ["海洋地理信息应用", "海岸带遥感监测", "卫星导航终端配套", "东盟跨境数据服务", "北海港航调度", "海岛资源调查"],
  },
  qinzhou: {
    dnrName: "钦州市自然资源局",
    specialSubjects: ["中国（广西）自由贸易试验区钦州港片区管理委员会", "钦州港经济技术开发区管理委员会", "广西北部湾国际港务集团钦州港区", "钦州综合保税区管理委员会"],
    themes: ["港航调度", "西部陆海新通道", "跨境物流", "临港产业协同", "港口时空服务", "保税区治理", "海铁联运", "海洋开发"],
    scenes: ["钦州港航调度", "西部陆海新通道物流", "临港产业空间协同", "海铁联运位置服务", "保税区数据建库", "港口岸线监测"],
  },
  fangchenggang: {
    dnrName: "防城港市自然资源局",
    specialSubjects: ["东兴国家重点开发开放试验区管理委员会", "防城港经济技术开发区管理委员会", "防城港边境经济合作区管理委员会", "广西北部湾国际港务集团防城港港区"],
    themes: ["口岸联动", "海洋监测", "沿海安全", "边海协同", "港口治理", "跨境通道", "岸线保护", "应急监测"],
    scenes: ["东兴口岸联动", "边海协同时空服务", "防城港海洋监测", "沿海安全预警", "港区三维建模", "跨境通道遥感"],
  },
  baise: {
    dnrName: "百色市自然资源局",
    specialSubjects: ["百色重点开发开放试验区管理委员会", "百色学院", "百色铝产业开发区管理委员会", "百色水利枢纽管理机构"],
    themes: ["西部资源治理", "矿产遥感", "交通通道", "农业遥感", "生态修复", "边境协同", "水利监测", "园区承载"],
    scenes: ["铝产业资源遥感", "西部陆路通道监测", "右江流域水利感知", "山区农业遥感", "生态修复评估", "边境开放空间分析"],
  },
  hechi: {
    dnrName: "河池市自然资源局",
    specialSubjects: ["河池学院", "河池大任产业园管理委员会", "河池有色金属新材料产业园管理委员会", "环江喀斯特世界自然遗产地保护管理机构"],
    themes: ["山地生态监测", "矿产资源治理", "喀斯特保护", "地灾预警", "农业遥感", "交通通道", "园区承载", "水源涵养"],
    scenes: ["喀斯特山地生态监测", "有色金属资源治理", "地质灾害预警", "水源涵养区遥感", "山地农业调查", "园区空间承载评估"],
  },
  hezhou: {
    dnrName: "贺州市自然资源局",
    specialSubjects: ["贺州高新技术产业开发区管理委员会", "广西东融产业园管理委员会", "贺州学院", "贺州生态产业园管理委员会"],
    themes: ["粤桂东融", "生态监测", "园区承载", "交通衔接", "文旅遥感", "矿山修复", "农业场景", "空间治理"],
    scenes: ["粤桂东融空间协同", "生态产业园承载", "矿山修复遥感", "文旅资源三维建模", "交通衔接评估", "农业场景开发"],
  },
  laibin: {
    dnrName: "来宾市自然资源局",
    specialSubjects: ["来宾高新技术产业开发区管理委员会", "广西来宾工业园区管理委员会", "来宾市河南工业园区管理委员会", "来宾市象州县工业园区管理委员会"],
    themes: ["中部园区承载", "能源空间保障", "农业遥感", "产业协同", "交通组织", "生态监测", "数据建库", "平台应用"],
    scenes: ["中部园区空间承载", "能源设施空间保障", "蔗糖农业遥感", "产业协同地图服务", "交通组织监测", "生态红线核查"],
  },
  guigang: {
    dnrName: "贵港市自然资源局",
    specialSubjects: ["贵港国家生态工业示范园区管理委员会", "贵港市港北区产业园区管理委员会", "西江航运贵港枢纽运营单位", "贵港市港南区产业园区管理委员会"],
    themes: ["西江物流", "园区承载", "交通组织", "农业遥感", "生态工业", "港口调度", "时空服务", "资源治理"],
    scenes: ["西江航运物流定位", "生态工业园区监测", "港口调度时空服务", "农业遥感调查", "交通组织优化", "园区数据建库"],
  },
  wuzhou: {
    dnrName: "梧州市自然资源局",
    specialSubjects: ["粤桂合作特别试验区管理委员会", "梧州循环经济产业园区管理委员会", "梧州临港经济区管理委员会", "梧州学院"],
    themes: ["东向通道", "粤桂协同", "物流联系", "园区承载", "生态监测", "产业转移", "水运遥感", "空间要素对接"],
    scenes: ["粤桂合作空间对接", "东向通道物流监测", "临港经济区三维建模", "循环经济园区承载", "西江水运遥感", "产业转移用地评估"],
  },
  yulin: {
    dnrName: "玉林市自然资源局",
    specialSubjects: ["玉林中医药健康产业园管理委员会", "玉柴工业园管理委员会", "玉林师范学院", "玉林龙潭产业园区管理委员会"],
    themes: ["产业承接", "交通联系", "农业遥感", "智能制造", "园区承载", "南向通道", "生态监测", "场景扩散"],
    scenes: ["玉柴智能制造空间服务", "中医药产业园承载", "南向通道交通感知", "农业遥感调查", "龙潭产业园数据建库", "产业承接用地评估"],
  },
  chongzuo: {
    dnrName: "崇左市自然资源局",
    specialSubjects: ["中国（广西）自由贸易试验区崇左片区管理委员会", "凭祥综合保税区管理委员会", "广西民族师范学院", "崇左边境经济合作区管理委员会"],
    themes: ["边境跨境协同", "口岸物流", "农业遥感", "生态保护", "东盟通道", "国土空间治理", "园区承载", "北斗定位"],
    scenes: ["凭祥口岸物流定位", "边境跨境时空服务", "甘蔗农业遥感", "石漠化生态监测", "东盟通道数据交换", "综合保税区三维建模"],
  },
};

const createSourceRef = (id, title, url, sourceLabel) => ({
  id,
  kind: "research",
  title,
  sourceLabel,
  url,
});

const researchEvidence = [
  createSourceRef("gx-kg-major-update", "地球信息产业链的知识图谱重大更新", "https://dnr.gxzf.gov.cn/", "项目更新文档"),
  createSourceRef("gx-dnr-public-bulletin", "广西自然资源厅测绘资质与自然资源公报", "https://dnr.gxzf.gov.cn/zfxxgk/fdzdgknr/zzgl/chzz/", "广西壮族自治区自然资源厅"),
  createSourceRef("gx-statistics-yearbook", "广西统计公报与产业规模数据", "https://tjj.gxzf.gov.cn/tjsj/tjgb/", "广西壮族自治区统计局"),
  createSourceRef("gx-government-policy", "广西地球空间信息产业与数字广西公开资料", "https://www.gxzf.gov.cn/", "广西壮族自治区人民政府"),
  ...Object.entries(citySourceMeta).map(([cityId, [label, url]]) =>
    createSourceRef(`${cityId}-dnr-source`, `${label}公开信息`, url, label),
  ),
];

const evidenceById = new Map(researchEvidence.map((item) => [item.id, item]));

const evidenceRefs = (cityId, extraIds = []) =>
  ["gx-kg-major-update", "gx-dnr-public-bulletin", "gx-statistics-yearbook", `${cityId}-dnr-source`, ...extraIds]
    .map((id) => evidenceById.get(id))
    .filter(Boolean);

const createScorecard = (seed) => ({
  factorSupport: 3.7 + (seed % 7) * 0.18,
  carrierCapacity: 3.6 + (seed % 6) * 0.2,
  collaborationLevel: 3.5 + (seed % 5) * 0.22,
  applicationOutput: 3.6 + (seed % 8) * 0.16,
  comprehensiveBenefit: 3.7 + (seed % 6) * 0.18,
});

const baseEntity = (elementClass, type, config) => ({
  aliases: [],
  intro: "",
  region: guangxiProvince.labelZh,
  relatedArticleIds: [],
  regionIds: [guangxiProvince.id],
  tags: [],
  spatialScope: "province",
  knowledgeKind: "official",
  ...config,
  elementClass,
  type,
});

const provinceEntity = baseEntity("content", "region", {
  id: guangxiProvince.id,
  name: "广西地球信息产业总览",
  aliases: ["广西", "广西壮族自治区"],
  intro: "总览节点只连接广西14个设区市，用于进入各城市的详细知识图谱。",
  sourceRefs: evidenceRefs("nanning", ["gx-government-policy"]),
  displayOrder: 1,
  radialPriority: 1,
});

const cityEntity = (city, index) =>
  baseEntity("content", "region", {
    id: city.id,
    name: city.labelZh,
    aliases: [city.bdDistrictName, ...(city.aliases ?? [])],
    intro: city.graphIntroZh || `${city.labelZh}市地球信息产业城市图谱节点。`,
    region: city.labelZh,
    regionIds: [guangxiProvince.id, city.id],
    parentId: guangxiProvince.id,
    spatialScope: "city",
    sourceRefs: evidenceRefs(city.id),
    displayOrder: 10 + index,
    radialPriority: 10 + index,
  });

const subjectItems = (city, plan) => {
  const label = city.labelZh;
  return [
    ["government-subject", "institution", `${label}市人民政府`, `${label}市政府统筹地球信息产业发展、场景开放和跨部门数据协同。`, ["政府统筹", "场景开放"]],
    ["industry-subject", "park", plan.specialSubjects[0], `${plan.specialSubjects[0]}承担${plan.scenes[0]}相关产业承载和场景组织。`, [plan.themes[0], "产业承载"]],
    ["innovation-subject", "institution", plan.specialSubjects[1], `${plan.specialSubjects[1]}承担${plan.themes[1]}与技术转化支撑。`, [plan.themes[1], "创新载体"]],
    ["natural-resource-subject", "institution", plan.dnrName, `${plan.dnrName}负责自然资源、测绘地理信息、国土空间和数据成果管理。`, ["自然资源", "测绘管理"]],
    ["development-reform-subject", "institution", `${label}市发展和改革委员会`, `围绕${plan.themes[2]}和重大项目组织产业政策、投资和通道建设。`, ["重大项目", "产业政策"]],
    ["industry-it-subject", "institution", `${label}市工业和信息化局`, `支撑${plan.themes[3]}、软件平台和工业场景应用。`, ["工信场景", "数字产业"]],
    ["transport-subject", "institution", `${label}市交通运输局`, `承接${plan.scenes[3]}、交通通道和位置服务应用。`, ["交通运输", "位置服务"]],
    ["emergency-subject", "institution", `${label}市应急管理局`, `负责地质灾害、城市安全和应急遥感监测场景协同。`, ["应急管理", "灾害监测"]],
    ["agri-rural-subject", "institution", `${label}市农业农村局`, `负责农业遥感、耕地保护和农村空间治理场景。`, ["农业遥感", "农村治理"]],
    ["ecology-subject", "institution", `${label}市生态环境局`, `围绕生态红线、污染源监管和生态保护成效评估使用空间数据。`, ["生态环境", "绿色保护"]],
    ["housing-urban-subject", "institution", `${label}市住房和城乡建设局`, `承接实景三维、城市体检和市政设施数字孪生应用。`, ["城市建设", "实景三维"]],
    ["water-subject", "institution", `${label}市水利局`, `面向流域治理、水资源监测和防汛调度使用遥感与时空数据。`, ["水利治理", "防汛调度"]],
    ["forestry-subject", "institution", `${label}市林业局`, `面向森林资源调查、生态保护和自然保护地监管使用遥感数据。`, ["林业资源", "生态监测"]],
    ["statistics-subject", "institution", `${label}市统计局`, `提供产业规模、结构优化和应用成效评价的数据口径。`, ["统计监测", "评价口径"]],
    ["park-platform-subject", "park", plan.specialSubjects[2], `${plan.specialSubjects[2]}承担${plan.scenes[4]}的空间载体与试验场景。`, [plan.themes[4], "平台载体"]],
    ["scenario-operator-subject", "institution", plan.specialSubjects[3], `${plan.specialSubjects[3]}提供${plan.scenes[5]}相关行业场景和应用落地条件。`, [plan.themes[5], "应用场景"]],
  ];
};

const goalItems = (city, plan) => {
  const label = city.labelZh;
  return [
    ["asean-goal", `${label}${plan.themes[2]}协同目标`, `面向中国—东盟合作高地建设，形成${plan.scenes[0]}的城市分工。`],
    ["corridor-goal", `${label}${plan.themes[0]}枢纽目标`, `支撑西部陆海新通道和广西“一核三极多点”空间格局。`],
    ["karst-demo-goal", `${label}${plan.themes[4]}示范目标`, `对接全国喀斯特地区时空智能应用示范区建设要求。`],
    ["industry-scale-goal", `${label}530亿元产业规模支撑目标`, `围绕2025年广西地球空间信息产业规模突破530亿元形成城市支撑。`],
    ["chain-enterprise-goal", `${label}200家链上企业培育目标`, `服务全区培育200家以上链上企业的产业组织目标。`],
    ["scenario-30-goal", `${label}30余个应用场景落地目标`, `推动政务治理、产业升级、跨境合作场景从10余个扩展到30余个。`],
    ["smart-city-goal", `${label}${plan.themes[3]}建设目标`, `围绕${plan.scenes[2]}形成可复用的城市空间治理能力。`],
    ["green-protection-goal", `${label}绿色保护目标`, `以生态红线、自然保护地和资源承载约束支撑绿色发展。`],
    ["cost-efficiency-goal", `${label}降本增效目标`, `通过测绘资质改革、数据共享和遥感分发降低治理成本。`],
    ["data-value-goal", `${label}数据价值释放目标`, `推动空间数据从供给型成果转向价值赋能型应用。`],
  ];
};

const contentItems = (city, plan) => {
  const label = city.labelZh;
  return [
    ["satellite-quarter-content", `${label}${plan.scenes[0]}卫星遥感季度覆盖数据`, "优于1米影像季度覆盖用于城市资源监测和场景更新。"],
    ["sub-meter-image-content", `${label}优于1米遥感影像目录`, "承接全区亚米级遥感影像目录和城市级检索。"],
    ["beidou-base-content", `${label}北斗高精度定位基准接入`, "接入广西389座北斗高精度基准站的时空基准能力。"],
    ["beidou-online-content", `${label}北斗基准站94%在线率数据`, "以94%在线率作为定位服务连续性和可靠性指标。"],
    ["beidou-10s-content", `${label}10秒内定位时长能力`, "面向交通、园区和应急场景提供10秒内定位能力。"],
    ["real-3d-content", `${label}实景三维建成区数据`, "使用设区市建成区实景三维成果组织城市底座。"],
    ["three-national-cases-content", `${label}实景三维国家级典型案例经验`, "对接广西3个国家级实景三维典型案例经验。"],
    ["spatial-10pb-content", `${label}10PB时空大数据资源`, "接入全区超过10PB的时空大数据平台资源。"],
    ["api-2000-content", `${label}2000个以上时空接口目录`, "以2000个以上接口支撑应用开发和数据调用。"],
    ["daily-access-content", `${label}日均3447万次访问指标`, "把天地图与平台访问量纳入城市应用承载依据。"],
    ["basic-10000-content", `${label}1:1万基础地理信息成果`, "承接全域3轮更新的基础地理信息成果。"],
    ["village-2000-content", `${label}1:2000行政村地形数据`, "覆盖行政村尺度的地形数据支撑乡村治理。"],
    ["remote-76372-content", `${label}2024年76372景遥感影像分发记录`, "使用2024年全区76372景影像分发记录作为数据供给证据。"],
    ["remote-18030-content", `${label}年接收18030景遥感数据`, "承接遥感影像年接收能力并服务城市专题监测。"],
    ["catalog-80-content", `${label}自然资源80余项数据目录`, "对接广西自然资源数据分类与公开目录成果。"],
    ["karst-content", `${label}${plan.scenes[1]}专题数据`, `组织${plan.scenes[1]}所需地形、遥感、生态和调查监测数据。`],
    ["land-space-content", `${label}国土空间规划“一张图”数据`, "将国土空间规划、用地审批和监管数据纳入城市图谱。"],
    ["uav-content", `${label}${plan.scenes[4]}无人机航测数据`, "以低空航测影像、点云和正射成果补充地面数据。"],
    ["geoai-content", `${label}GeoAI遥感解译样本库`, "沉淀地物识别、变化检测和风险识别样本。"],
    ["digital-twin-content", `${label}${plan.scenes[2]}数字孪生底座`, "连接实景三维、物联感知和业务数据形成数字孪生底座。"],
    ["cross-border-content", `${label}${plan.themes[2]}数据交换目录`, "面向跨区域或东盟方向组织可共享的数据目录。"],
    ["qualification-content", `${label}测绘资质单位公告数据`, "使用自然资源厅测绘资质公告支撑主体和产能判断。"],
  ];
};

const activityItems = (city, plan) => {
  const label = city.labelZh;
  return [
    ["satellite-collection-activity", `${label}${plan.scenes[0]}卫星遥感采集`, "组织卫星遥感影像接收、筛选和季度更新。"],
    ["aerial-photo-activity", `${label}航空摄影任务组织`, "围绕重点城区、园区和通道开展航空摄影。"],
    ["uav-survey-activity", `${label}${plan.scenes[4]}无人机航测`, "开展低空航测、倾斜摄影和正射影像生产。"],
    ["ground-survey-activity", `${label}地面控制测量`, "提供控制点、地面核查和精度校验。"],
    ["ai-interpretation-activity", `${label}${plan.scenes[1]}AI遥感解译`, "使用AI模型识别地物变化、生态风险和建设动态。"],
    ["three-model-activity", `${label}三维建模生产`, "生产建筑、地形、设施和园区三维模型。"],
    ["point-cloud-activity", `${label}点云处理与质检`, "对激光雷达或倾斜摄影点云进行分类和质检。"],
    ["data-warehouse-activity", `${label}自然资源数据建库`, "把调查监测、遥感、审批和规划成果入库管理。"],
    ["platform-operation-activity", `${label}时空大数据平台运营`, "维护平台接口、访问、权限和数据服务。"],
    ["tianditu-support-activity", `${label}天地图·广西应用开发支撑`, "承接天地图·广西超过4万个应用开发支撑经验。"],
    ["image-distribution-activity", `${label}遥感影像分发服务`, "面向政府部门和项目单位分发遥感影像。"],
    ["geohazard-activity", `${label}地质灾害监测预警`, "对接自然资源监测预警点开展风险识别。"],
    ["agri-monitor-activity", `${label}农业遥感监测`, "开展耕地、作物长势和农业设施遥感监测。"],
    ["ecology-redline-activity", `${label}生态红线核查`, "对生态保护红线、自然保护地和用地扰动进行核查。"],
    ["land-approval-activity", `${label}用地审批空间核验`, "支撑项目用地、规划许可和批后监管。"],
    ["city-cim-activity", `${label}CIM与实景三维融合`, "把实景三维成果接入城市信息模型业务。"],
    ["transport-dispatch-activity", `${label}${plan.scenes[3]}调度应用`, "用北斗定位和路网数据服务交通调度。"],
    ["park-map-activity", `${label}${plan.scenes[5]}园区图层更新`, "对园区用地、企业地块和设施图层进行更新。"],
    ["emergency-map-activity", `${label}应急专题图生产`, "在灾害、汛情和安全事件中生产专题图。"],
    ["cross-border-activity", `${label}${plan.themes[2]}技术服务`, "面向跨区域协作提供数据处理、地图和接口服务。"],
    ["qualification-review-activity", `${label}测绘资质复审支撑`, "按资质改革口径支撑单位复审和能力核验。"],
    ["standardization-activity", `${label}数据标准化整编`, "统一坐标、编码、元数据和质量规则。"],
    ["public-api-activity", `${label}公共接口发布`, "将可共享数据以接口、服务和目录方式发布。"],
    ["feedback-loop-activity", `${label}效能反馈更新`, "根据应用成效和评价指标回写图谱节点。"],
  ];
};

const evaluationItems = (city, plan) => {
  const label = city.labelZh;
  return [
    ["scale-442-evaluation", `${label}442.3亿元产业规模贡献指标`, "对接2024年广西地球空间信息产业规模442.3亿元。"],
    ["growth-233-evaluation", `${label}23.3%增长贡献指标`, "用23.3%增长率评价城市场景扩展和应用转化。"],
    ["structure-evaluation", `${label}18.2:30.5:51.3结构优化指标`, "对应上中下游结构优化评价口径。"],
    ["ai-model-evaluation", `${label}30余个AI解译模型应用指标`, "评价GeoAI模型在城市专题中的承载能力。"],
    ["asean-28-evaluation", `${label}东盟6国28站协同指标`, "对接东盟6国28个基准站的国际协作评价。"],
    ["image-30000-evaluation", `${label}3万余景影像推送指标`, "评价面向东盟与区域协作的影像推送能力。"],
    ["contract-20b-evaluation", `${label}20亿元合同转化指标`, "以合同金额超过20亿元评价市场化转化。"],
    ["saving-1103-evaluation", `${label}11.03亿元财政节约指标`, "以遥感影像共享节约财政资金11.03亿元评价公共效能。"],
    ["warning-3470-evaluation", `${label}3470处预警点支撑指标`, "评价监测预警点对安全治理的支撑。"],
    ["village-map-evaluation", `${label}2220个行政村地图覆盖指标`, "评价行政村地图在基层治理中的覆盖成效。"],
  ];
};

const typeByClass = {
  subject: "institution",
  goal: "policy",
  content: "technology",
  activity: "project",
  evaluation: "project",
};

const buildNode = (city, plan, elementClass, item, index) => {
  const [slug, rawTypeOrName, rawNameOrIntro, rawIntroOrTags, maybeTags] = item;
  const hasExplicitType = ["institution", "enterprise", "university", "park", "project", "technology", "policy"].includes(rawTypeOrName);
  const type = hasExplicitType ? rawTypeOrName : typeByClass[elementClass];
  const name = hasExplicitType ? rawNameOrIntro : rawTypeOrName;
  const intro = hasExplicitType ? rawIntroOrTags : rawNameOrIntro;
  const tags = hasExplicitType ? maybeTags ?? [] : [plan.themes[index % plan.themes.length], elementClass];
  return baseEntity(elementClass, type, {
    id: `${city.id}-${slug}`,
    name,
    intro,
    region: city.labelZh,
    regionIds: [guangxiProvince.id, city.id],
    parentId: city.id,
    spatialScope: type === "park" ? "park" : "project",
    tags,
    sourceRefs: evidenceRefs(city.id),
    scorecard: elementClass === "evaluation" ? createScorecard(index + city.id.length) : undefined,
    displayOrder: index + 1,
    radialPriority: index + 1,
  });
};

const createEdge = (sourceEntityId, targetEntityId, relationType, researchEvidenceIds) => ({
  sourceEntityId,
  targetEntityId,
  relationType,
  viewModes: ["layered"],
  keywords: [],
  researchEvidenceIds,
});

const cityBundles = guangxiCityProfiles.map((city, cityIndex) => {
  const plan = cityPlans[city.id];
  if (!plan) {
    throw new Error(`Missing graph plan for city: ${city.id}`);
  }

  const cityCenter = cityEntity(city, cityIndex);
  const layerItems = {
    subject: subjectItems(city, plan),
    goal: goalItems(city, plan),
    content: contentItems(city, plan),
    activity: activityItems(city, plan),
    evaluation: evaluationItems(city, plan),
  };

  const layerEntities = elementOrder.flatMap((elementClass) =>
    layerItems[elementClass].map((item, index) => buildNode(city, plan, elementClass, item, index)),
  );

  const evidenceIds = ["gx-kg-major-update", "gx-dnr-public-bulletin", "gx-statistics-yearbook", `${city.id}-dnr-source`];
  const cityEdges = [
    createEdge(guangxiProvince.id, city.id, "related", evidenceIds),
    ...layerEntities.map((entity) => {
      const relationType =
        entity.elementClass === "subject"
          ? "organizes"
          : entity.elementClass === "goal"
            ? "pursues"
            : entity.elementClass === "content"
              ? "focuses_on"
              : entity.elementClass === "activity"
                ? "enables"
                : "assesses";
      return createEdge(city.id, entity.id, relationType, evidenceIds);
    }),
  ];

  return {
    entities: [cityCenter, ...layerEntities],
    edges: cityEdges,
  };
});

const cityEntities = cityBundles.flatMap((bundle) => bundle.entities);
const cityEdges = cityBundles.flatMap((bundle) => bundle.edges);

export const graphResearchBase = {
  researchEvidence,
  regionScopes: guangxiRegionScopes,
  taxonomy: {
    elementClasses: [
      {
        key: "subject",
        labelZh: "主体",
        labelEn: "Subject",
        descriptionZh: "政府部门、园区平台、高校科研机构和行业运营主体。",
        descriptionEn: "Government departments, parks, universities, research institutions and operators.",
      },
      {
        key: "goal",
        labelZh: "目标",
        labelEn: "Goal",
        descriptionZh: "战略目标、产业规模目标、应用场景目标和绿色保护目标。",
        descriptionEn: "Strategic, industrial, application and green-protection goals.",
      },
      {
        key: "content",
        labelZh: "内容",
        labelEn: "Content",
        descriptionZh: "卫星遥感、北斗时空基准、实景三维、基础地理信息和数据目录。",
        descriptionEn: "Remote sensing, Beidou spatiotemporal reference, 3D reality data and data catalogs.",
      },
      {
        key: "activity",
        labelZh: "活动",
        labelEn: "Activity",
        descriptionZh: "数据采集、AI解译、三维建模、数据建库、平台运营和行业应用。",
        descriptionEn: "Collection, AI interpretation, 3D modeling, warehousing, platform operations and applications.",
      },
      {
        key: "evaluation",
        labelZh: "评价",
        labelEn: "Evaluation",
        descriptionZh: "产业规模、结构优化、创新转化、公共效能和国际协同指标。",
        descriptionEn: "Scale, structure, innovation, public efficiency and international collaboration indicators.",
      },
    ],
  },
  entities: [provinceEntity, ...cityEntities],
  edges: cityEdges,
  views: {
    layered: {
      columns: elementOrder.map((elementClass) => ({ elementClass })),
    },
  },
};
