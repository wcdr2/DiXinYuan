export const guangxiProvince = {
  id: "guangxi",
  labelZh: "广西",
  labelEn: "Guangxi",
  aliases: ["广西壮族自治区", "桂"],
};

export const beibuGulfTheme = {
  id: "beibu-gulf",
  labelZh: "北部湾",
  labelEn: "Beibu Gulf",
  aliases: ["广西北部湾", "北部湾城市群", "北部湾经济区"],
  memberCityIds: ["nanning", "beihai", "qinzhou", "fangchenggang"],
};

export const guangxiCityProfiles = [
  {
    id: "nanning",
    labelZh: "南宁",
    labelEn: "Nanning",
    aliases: ["邕城", "首府南宁"],
    matchTerms: ["南宁"],
    center: [108.3669, 22.817],
    zoom: 9,
    bdDistrictName: "南宁市",
    isPriorityRegion: true,
    mapSummaryZh: "南宁承担平台集聚、北斗应用、低空场景与数据协同，是广西地球信息产业的综合枢纽城市。",
    mapSummaryEn:
      "Nanning concentrates platform aggregation, Beidou applications, low-altitude scenarios and data coordination for Guangxi.",
    graphIntroZh: "南宁是广西地球空间信息平台、园区与数据底座的重要集聚城市。",
  },
  {
    id: "liuzhou",
    labelZh: "柳州",
    labelEn: "Liuzhou",
    aliases: ["柳州"],
    matchTerms: ["柳州"],
    center: [109.4281, 24.326],
    zoom: 9,
    bdDistrictName: "柳州市",
    isPriorityRegion: true,
    mapSummaryZh: "柳州侧重工业时空底座、数字孪生与低空服务，承接制造业场景中的空间智能应用。",
    mapSummaryEn:
      "Liuzhou focuses on industrial spatiotemporal platforms, digital twins and low-altitude services for manufacturing scenarios.",
    graphIntroZh: "柳州具备制造业协同、园区数字化和低空场景扩展的综合承载能力。",
  },
  {
    id: "guilin",
    labelZh: "桂林",
    labelEn: "Guilin",
    aliases: ["桂林"],
    matchTerms: ["桂林"],
    center: [110.29, 25.2736],
    zoom: 9,
    bdDistrictName: "桂林市",
    isPriorityRegion: true,
    mapSummaryZh: "桂林围绕生态保护、灾害监测和遥感治理展开，适合展示绿色保护导向的空间信息应用。",
    mapSummaryEn:
      "Guilin emphasizes ecological protection, hazard monitoring and remote-sensing governance with a green-protection profile.",
    graphIntroZh: "桂林在生态保护、文旅空间治理和遥感监测方面具备明显场景优势。",
  },
  {
    id: "beihai",
    labelZh: "北海",
    labelEn: "Beihai",
    aliases: ["北海"],
    matchTerms: ["北海"],
    center: [109.12, 21.4811],
    zoom: 10,
    bdDistrictName: "北海市",
    isPriorityRegion: true,
    mapSummaryZh: "北海聚焦海洋地理信息、海岸带治理与港航服务，是沿海场景的重要承载城市。",
    mapSummaryEn:
      "Beihai concentrates marine geospatial services, coastal governance and maritime support across Guangxi's coastal corridor.",
    graphIntroZh: "北海是海洋地理信息、海岸带治理和沿海服务的重要承载城市。",
  },
  {
    id: "qinzhou",
    labelZh: "钦州",
    labelEn: "Qinzhou",
    aliases: ["钦州"],
    matchTerms: ["钦州"],
    center: [108.6544, 21.9802],
    zoom: 10,
    bdDistrictName: "钦州市",
    isPriorityRegion: true,
    mapSummaryZh: "钦州以港航调度、跨境物流和时空协同平台为重点，体现海洋开发与通道协同价值。",
    mapSummaryEn:
      "Qinzhou highlights port scheduling, cross-border logistics and spatiotemporal coordination for marine development.",
    graphIntroZh: "钦州连接港口、物流与临港产业，是陆海通道和港航服务的重要节点。",
  },
  {
    id: "fangchenggang",
    labelZh: "防城港",
    labelEn: "Fangchenggang",
    aliases: ["防城港"],
    matchTerms: ["防城港"],
    center: [108.3535, 21.6867],
    zoom: 10,
    bdDistrictName: "防城港市",
    isPriorityRegion: true,
    mapSummaryZh: "防城港面向口岸联动、海洋监测和沿海安全协同，连接港口治理与边疆开放场景。",
    mapSummaryEn:
      "Fangchenggang links port-border coordination, marine monitoring and coastal safety operations.",
    graphIntroZh: "防城港承接口岸联动、海洋监测与边疆协同，是沿海开放的重要节点。",
  },
  {
    id: "baise",
    labelZh: "百色",
    labelEn: "Baise",
    aliases: ["百色"],
    matchTerms: ["百色"],
    center: [106.6163, 23.8977],
    zoom: 8.8,
    bdDistrictName: "百色市",
    isPriorityRegion: false,
    mapSummaryZh: "百色适合作为西部资源开发、交通通道延伸和空间治理服务的观察单元。",
    mapSummaryEn:
      "Baise serves as a western observation unit for resource development, corridor extension and spatial governance.",
    graphIntroZh: "百色适合作为西部资源开发、交通通道和空间治理服务的观察单元。",
  },
  {
    id: "hechi",
    labelZh: "河池",
    labelEn: "Hechi",
    aliases: ["河池"],
    matchTerms: ["河池"],
    center: [108.0854, 24.6929],
    zoom: 8.8,
    bdDistrictName: "河池市",
    isPriorityRegion: false,
    mapSummaryZh: "河池可承接山地生态红线、资源监测与遥感治理等山地空间要素分析。",
    mapSummaryEn:
      "Hechi supports mountain ecology, resource monitoring and remote-sensing governance analysis.",
    graphIntroZh: "河池适合作为山地生态、资源监测和遥感治理场景的重点观察单元。",
  },
  {
    id: "hezhou",
    labelZh: "贺州",
    labelEn: "Hezhou",
    aliases: ["贺州"],
    matchTerms: ["贺州"],
    center: [111.5666, 24.4128],
    zoom: 9,
    bdDistrictName: "贺州市",
    isPriorityRegion: false,
    mapSummaryZh: "贺州适合观察东部衔接区在交通条件、土地承载和产业协同上的空间潜力。",
    mapSummaryEn:
      "Hezhou is suitable for observing eastern corridor potential in transport, land capacity and industrial collaboration.",
    graphIntroZh: "贺州适合作为东部通道、土地承载和产业协同潜力的观察节点。",
  },
  {
    id: "laibin",
    labelZh: "来宾",
    labelEn: "Laibin",
    aliases: ["来宾"],
    matchTerms: ["来宾"],
    center: [109.2212, 23.7518],
    zoom: 9,
    bdDistrictName: "来宾市",
    isPriorityRegion: false,
    mapSummaryZh: "来宾位于中部连接带，可用于承接园区空间、能源供给与产业协同的比较分析。",
    mapSummaryEn:
      "Laibin acts as a central connector for comparing park space, energy supply and industrial coordination.",
    graphIntroZh: "来宾位于广西中部连接带，适合承接园区空间与能源供给类场景。",
  },
  {
    id: "guigang",
    labelZh: "贵港",
    labelEn: "Guigang",
    aliases: ["贵港"],
    matchTerms: ["贵港"],
    center: [109.6021, 23.1115],
    zoom: 9,
    bdDistrictName: "贵港市",
    isPriorityRegion: false,
    mapSummaryZh: "贵港适合补充东中部交通组织、园区承载和物流型时空服务的专题观察。",
    mapSummaryEn:
      "Guigang helps observe transport organization, park capacity and logistics-oriented geospatial services.",
    graphIntroZh: "贵港适合承接交通组织、园区承载和物流型时空服务的专题分析。",
  },
  {
    id: "wuzhou",
    labelZh: "梧州",
    labelEn: "Wuzhou",
    aliases: ["梧州"],
    matchTerms: ["梧州"],
    center: [111.279, 23.4769],
    zoom: 9,
    bdDistrictName: "梧州市",
    isPriorityRegion: false,
    mapSummaryZh: "梧州位于东向通道节点，可承接跨区域协同、物流联系和空间要素对接的专题展示。",
    mapSummaryEn:
      "Wuzhou sits on the eastern corridor and supports cross-regional coordination and logistics-oriented map analysis.",
    graphIntroZh: "梧州位于东向通道节点，适合承接跨区域协同与物流联动分析。",
  },
  {
    id: "yulin",
    labelZh: "玉林",
    labelEn: "Yulin",
    aliases: ["玉林"],
    matchTerms: ["玉林"],
    center: [110.1812, 22.6545],
    zoom: 9,
    bdDistrictName: "玉林市",
    isPriorityRegion: false,
    mapSummaryZh: "玉林可用于观察东南部产业承接、交通联系与空间应用扩散路径。",
    mapSummaryEn:
      "Yulin is suitable for observing southeastern industrial transfer, transport links and application diffusion.",
    graphIntroZh: "玉林适合作为产业承接、交通联系和应用扩散的观察城市。",
  },
  {
    id: "chongzuo",
    labelZh: "崇左",
    labelEn: "Chongzuo",
    aliases: ["崇左"],
    matchTerms: ["崇左"],
    center: [107.365, 22.3777],
    zoom: 8.8,
    bdDistrictName: "崇左市",
    isPriorityRegion: false,
    mapSummaryZh: "崇左承接口岸开放、跨境通道和边疆协同的空间观察，适合拓展跨境物流场景。",
    mapSummaryEn:
      "Chongzuo connects border opening, cross-border corridors and frontier coordination for logistics-oriented analysis.",
    graphIntroZh: "崇左承接口岸开放、跨境通道和边疆协同，是跨境场景扩展的重要观察城市。",
  },
];

export const guangxiCityIds = guangxiCityProfiles.map((city) => city.id);

export const guangxiRegionScopes = [
  {
    id: guangxiProvince.id,
    labelZh: guangxiProvince.labelZh,
    labelEn: guangxiProvince.labelEn,
    spatialScope: "province",
  },
  ...guangxiCityProfiles.map((city) => ({
    id: city.id,
    labelZh: city.labelZh,
    labelEn: city.labelEn,
    spatialScope: "city",
    parentId: guangxiProvince.id,
  })),
];

export const guangxiRegionNameToId = Object.fromEntries([
  [guangxiProvince.labelZh, guangxiProvince.id],
  ...guangxiProvince.aliases.map((alias) => [alias, guangxiProvince.id]),
  ...guangxiCityProfiles.flatMap((city) => [
    [city.labelZh, city.id],
    ...city.aliases.map((alias) => [alias, city.id]),
    ...city.matchTerms.map((term) => [term, city.id]),
  ]),
]);

export const guangxiRegionLabelById = Object.fromEntries([
  [guangxiProvince.id, guangxiProvince.labelZh],
  ...guangxiCityProfiles.map((city) => [city.id, city.labelZh]),
]);

export const guangxiRegionSearchTerms = [
  guangxiProvince.labelZh,
  ...guangxiProvince.aliases,
  ...guangxiCityProfiles.flatMap((city) => [city.labelZh, ...city.aliases, ...city.matchTerms]),
  beibuGulfTheme.labelZh,
  ...beibuGulfTheme.aliases,
];
