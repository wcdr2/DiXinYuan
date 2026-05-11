"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getArticleHref, getDictionary, withLocale } from "@/lib/site";
import type { Article, EvidenceRef, GraphDataset, GraphElementClass, Locale } from "@/lib/types";
import type { ECharts, EChartsOption } from "echarts";

interface GraphExplorerProps {
  locale: Locale;
  dataset: GraphDataset;
  articles: Article[];
  initialRegion?: string;
  initialClass?: GraphElementClass | "all";
}

type GraphEntity = GraphDataset["entities"][number];
type CityViewMode = "visual" | "text";

interface LayerGroup {
  layer: GraphElementClass;
  meta: {
    label: string;
    description: string;
  };
  nodes: GraphEntity[];
}

type ForceNodeKind = "center" | "hub" | "entity";

interface ForceNode {
  id: string;
  entity?: GraphEntity;
  kind: ForceNodeKind;
  layer?: GraphElementClass;
  label: string;
  fullName: string;
  intro?: string;
  tags: string[];
  classLabel: string;
  width: number;
  height: number;
  radius: number;
  color: string;
  glow: string;
  anchorX: number;
  anchorY: number;
}

interface ForceEdge {
  id: string;
  sourceId: string;
  targetId: string;
  layer: GraphElementClass;
  kind: "trunk" | "branch";
}

interface ForcePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
}

interface ForceRenderNode extends ForceNode {
  x: number;
  y: number;
}

interface ForceRenderEdge extends ForceEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ForceSnapshot {
  nodes: ForceRenderNode[];
  edges: ForceRenderEdge[];
}

interface EchartsKgNode {
  id: string;
  name: string;
  category: number;
  x: number;
  y: number;
  symbolSize: number;
  draggable: boolean;
  entityId?: string;
  kgKind: ForceNodeKind;
  kgLayer?: GraphElementClass;
  fullName: string;
  intro?: string;
  tags: string[];
  classLabel: string;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
    shadowBlur: number;
    shadowColor: string;
  };
  label: {
    show: boolean;
    position: "inside" | "bottom";
    distance?: number;
    color: string;
    fontSize: number;
    fontWeight: number;
    formatter: string;
  };
}

interface EchartsKgLink {
  source: string;
  target: string;
  kgLayer: GraphElementClass;
  kgKind: "trunk" | "branch";
  lineStyle: {
    color: string;
    opacity: number;
    width: number;
  };
}

interface EchartsKgGraph {
  nodes: EchartsKgNode[];
  links: EchartsKgLink[];
  categories: Array<{ name: string; itemStyle: { color: string } }>;
  counts: Record<GraphElementClass, number>;
}

const elementOrder: GraphElementClass[] = ["subject", "goal", "content", "activity", "evaluation"];

const layerTone: Record<GraphElementClass, { color: string; glow: string }> = {
  subject: { color: "#1596d4", glow: "rgba(21, 150, 212, 0.26)" },
  goal: { color: "#c9971a", glow: "rgba(201, 151, 26, 0.24)" },
  content: { color: "#12a886", glow: "rgba(18, 168, 134, 0.24)" },
  activity: { color: "#4d7cf0", glow: "rgba(77, 124, 240, 0.24)" },
  evaluation: { color: "#8a62d4", glow: "rgba(138, 98, 212, 0.24)" },
};

const forceCanvas = { width: 1280, height: 760 };
const echartsCategoryIndex: Record<GraphElementClass | "center", number> = {
  center: 0,
  subject: 1,
  goal: 2,
  content: 3,
  activity: 4,
  evaluation: 5,
};

const echartsCategoryColor: Record<GraphElementClass | "center", string> = {
  center: "#3b62ff",
  subject: "#0033cc",
  goal: "#2e7d32",
  content: "#d4a32b",
  activity: "#b71c1c",
  evaluation: "#6a1b9a",
};

const forceBounds = { minX: 18, minY: 20, maxX: 1262, maxY: 740 };
const forceNodeSize = {
  center: { width: 178, height: 74 },
  hub: { width: 116, height: 48 },
  entity: { width: 118, height: 34 },
};

const forceLayerSlots: Record<
  GraphElementClass,
  {
    hub: { x: number; y: number };
    block: { x: number; y: number; cols: number; gapX: number; gapY: number };
  }
> = {
  subject: {
    hub: { x: 482, y: 236 },
    block: { x: 30, y: 62, cols: 3, gapX: 148, gapY: 49 },
  },
  goal: {
    hub: { x: 640, y: 204 },
    block: { x: 472, y: 30, cols: 2, gapX: 150, gapY: 49 },
  },
  content: {
    hub: { x: 492, y: 530 },
    block: { x: 30, y: 424, cols: 4, gapX: 140, gapY: 51 },
  },
  activity: {
    hub: { x: 786, y: 236 },
    block: { x: 846, y: 48, cols: 3, gapX: 144, gapY: 47 },
  },
  evaluation: {
    hub: { x: 788, y: 546 },
    block: { x: 800, y: 492, cols: 3, gapX: 146, gapY: 50 },
  },
};

const uiLabels = {
  zh: {
    overview: "广西总览",
    cityFocus: "城市图谱",
    nodeCount: "节点",
    relationCount: "关系",
    evidenceCount: "证据",
    allLayers: "全部要素",
    search: "节点检索",
    searchPlaceholder: "输入城市、机构、技术或指标",
    cityGraph: "城市五类要素图谱",
    overviewIntro: "只展示广西与14个设区市；点击城市进入详细知识图谱。",
    openMap: "地图定位",
    detailTitle: "节点详情",
    evidenceTitle: "来源证据",
    relationTitle: "直接关系",
    empty: "当前条件下暂无节点",
    centerNode: "中心节点",
    enterCity: "进入城市图谱",
    linkedArticles: "关联新闻",
    sourceRefs: "来源依据",
    selectedHint: "点击任一节点查看证据与关系。",
    scorecard: "评价维度",
    visualView: "图形图谱",
    textView: "文字图谱",
    scoreLabels: {
      factorSupport: "要素保障",
      carrierCapacity: "技术承载",
      collaborationLevel: "协同水平",
      applicationOutput: "应用成效",
      comprehensiveBenefit: "综合效益",
    },
  },
  en: {
    overview: "Guangxi Overview",
    cityFocus: "City graph",
    nodeCount: "nodes",
    relationCount: "relations",
    evidenceCount: "evidence",
    allLayers: "All layers",
    search: "Search",
    searchPlaceholder: "Search city, institution, technology or metric",
    cityGraph: "Five-layer city graph",
    overviewIntro: "Only Guangxi and the 14 cities are shown here. Select a city to open the detailed graph.",
    openMap: "Open map",
    detailTitle: "Node detail",
    evidenceTitle: "Evidence",
    relationTitle: "Direct relations",
    empty: "No nodes under the current filter",
    centerNode: "Center node",
    enterCity: "Open city graph",
    linkedArticles: "linked articles",
    sourceRefs: "source refs",
    selectedHint: "Select any node to inspect evidence and relations.",
    scorecard: "Scorecard",
    visualView: "Visual graph",
    textView: "Text graph",
    scoreLabels: {
      factorSupport: "Factor support",
      carrierCapacity: "Carrier capacity",
      collaborationLevel: "Collaboration",
      applicationOutput: "Application output",
      comprehensiveBenefit: "Benefit",
    },
  },
} as const;

const forceUiLabels: Record<
  Locale,
  {
    graphControls: string;
    visibleBranches: string;
    selectAll: string;
    clearAll: string;
    resetLayout: string;
    dragHint: string;
  }
> = {
  zh: {
    graphControls: "\u56fe\u8c31\u63a7\u5236",
    visibleBranches: "\u53ef\u89c1\u5206\u652f",
    selectAll: "\u5168\u9009",
    clearAll: "\u6e05\u7a7a",
    resetLayout: "\u91cd\u7f6e\u5e03\u5c40",
    dragHint: "\u62d6\u62fd\u8282\u70b9\u53ef\u8c03\u6574\u5e03\u5c40\uff0c\u60ac\u6d6e\u67e5\u770b\u5b8c\u6574\u540d\u79f0\u3002",
  },
  en: {
    graphControls: "Graph controls",
    visibleBranches: "Visible branches",
    selectAll: "Select all",
    clearAll: "Clear",
    resetLayout: "Reset layout",
    dragHint: "Drag nodes to adjust layout. Hover for the full name.",
  },
};

function normalize(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function getLayerLabel(locale: Locale, dataset: GraphDataset, value: GraphElementClass) {
  const layer = dataset.taxonomy?.elementClasses.find((item) => item.key === value);
  if (!layer) {
    return { label: value, description: value };
  }
  return {
    label: locale === "zh" ? layer.labelZh : layer.labelEn,
    description: locale === "zh" ? layer.descriptionZh : layer.descriptionEn,
  };
}

function evidenceKey(ref: EvidenceRef, index: number) {
  return ref.kind === "article" ? `article:${ref.articleId ?? index}` : `research:${ref.id ?? ref.title}:${index}`;
}

function dedupeEvidence(refs: EvidenceRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref, index) => {
    const key = evidenceKey(ref, index);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shortLabel(value: string, maxLength = 9) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function getForceNodeShape(kind: ForceNodeKind) {
  return forceNodeSize[kind];
}

function getForceNodeRadius(kind: ForceNodeKind) {
  if (kind === "center") {
    return 76;
  }
  if (kind === "hub") {
    return 54;
  }
  return 43;
}

function getInitialForcePosition(node: ForceNode) {
  return {
    x: clamp(node.anchorX, forceBounds.minX + node.width / 2, forceBounds.maxX - node.width / 2),
    y: clamp(node.anchorY, forceBounds.minY + node.height / 2, forceBounds.maxY - node.height / 2),
    vx: 0,
    vy: 0,
  };
}

function resolveForceSnapshot(nodes: ForceNode[], edges: ForceEdge[], positions: Map<string, ForcePosition>): ForceSnapshot {
  const positioned = nodes.map((node) => {
    const fallback = getInitialForcePosition(node);
    const position = positions.get(node.id) ?? fallback;
    return { ...node, x: position.x, y: position.y };
  });
  const byId = new Map(positioned.map((node) => [node.id, node]));

  return {
    nodes: positioned,
    edges: edges
      .map((edge) => {
        const source = byId.get(edge.sourceId);
        const target = byId.get(edge.targetId);
        if (!source || !target) {
          return null;
        }
        return {
          ...edge,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
        };
      })
      .filter((edge): edge is ForceRenderEdge => Boolean(edge)),
  };
}

function buildForceGraph(
  groups: LayerGroup[],
  cityCenter: GraphEntity | null,
  visibleLayers: Set<GraphElementClass>,
  labels: typeof uiLabels[Locale],
) {
  const nodes: ForceNode[] = [];
  const edges: ForceEdge[] = [];
  const centerShape = getForceNodeShape("center");

  if (cityCenter) {
    nodes.push({
      id: cityCenter.id,
      entity: cityCenter,
      kind: "center",
      label: shortLabel(cityCenter.name, 10),
      fullName: cityCenter.name,
      intro: cityCenter.intro,
      tags: cityCenter.tags ?? [],
      classLabel: labels.centerNode,
      width: centerShape.width,
      height: centerShape.height,
      radius: getForceNodeRadius("center"),
      color: "#0d76ba",
      glow: "rgba(13, 118, 186, 0.32)",
      anchorX: forceCanvas.width / 2,
      anchorY: forceCanvas.height / 2,
    });
  }

  groups.forEach((group) => {
    if (!visibleLayers.has(group.layer)) {
      return;
    }

    const tone = layerTone[group.layer];
    const slot = forceLayerSlots[group.layer];
    const hubShape = getForceNodeShape("hub");
    const hubId = `hub-${group.layer}`;

    nodes.push({
      id: hubId,
      kind: "hub",
      layer: group.layer,
      label: group.meta.label,
      fullName: group.meta.label,
      intro: group.meta.description,
      tags: [String(group.nodes.length)],
      classLabel: group.meta.label,
      width: hubShape.width,
      height: hubShape.height,
      radius: getForceNodeRadius("hub"),
      color: tone.color,
      glow: tone.glow,
      anchorX: slot.hub.x,
      anchorY: slot.hub.y,
    });

    if (cityCenter) {
      edges.push({
        id: `${cityCenter.id}-${hubId}`,
        sourceId: cityCenter.id,
        targetId: hubId,
        layer: group.layer,
        kind: "trunk",
      });
    }

    group.nodes.forEach((entity, index) => {
      const entityShape = getForceNodeShape("entity");
      const col = index % slot.block.cols;
      const row = Math.floor(index / slot.block.cols);
      const stagger = row % 2 === 0 ? 0 : 18;
      const anchorX = slot.block.x + col * slot.block.gapX + entityShape.width / 2 + stagger;
      const anchorY = slot.block.y + row * slot.block.gapY + entityShape.height / 2;

      nodes.push({
        id: entity.id,
        entity,
        kind: "entity",
        layer: group.layer,
        label: shortLabel(entity.name),
        fullName: entity.name,
        intro: entity.intro,
        tags: entity.tags ?? [],
        classLabel: group.meta.label,
        width: entityShape.width,
        height: entityShape.height,
        radius: getForceNodeRadius("entity"),
        color: tone.color,
        glow: tone.glow,
        anchorX,
        anchorY,
      });

      edges.push({
        id: `${hubId}-${entity.id}`,
        sourceId: hubId,
        targetId: entity.id,
        layer: group.layer,
        kind: "branch",
      });
    });
  });

  return { nodes, edges };
}

function buildEchartsGraph(
  groups: LayerGroup[],
  cityCenter: GraphEntity | null,
  visibleLayers: Set<GraphElementClass>,
  labels: typeof uiLabels[Locale],
): EchartsKgGraph {
  const force = buildForceGraph(groups, cityCenter, visibleLayers, labels);
  const positions = new Map<string, ForcePosition>();
  force.nodes.forEach((node) => {
    positions.set(node.id, getInitialForcePosition(node));
  });
  const snapshot = resolveForceSnapshot(force.nodes, force.edges, positions);
  const categories = [
    { name: labels.centerNode, itemStyle: { color: echartsCategoryColor.center } },
    ...elementOrder.map((layer) => ({
      name: groups.find((group) => group.layer === layer)?.meta.label ?? layer,
      itemStyle: { color: echartsCategoryColor[layer] },
    })),
  ];
  const counts = Object.fromEntries(
    elementOrder.map((layer) => [layer, visibleLayers.has(layer) ? groups.find((group) => group.layer === layer)?.nodes.length ?? 0 : 0]),
  ) as Record<GraphElementClass, number>;

  return {
    categories,
    counts,
    nodes: snapshot.nodes.map((node) => {
      const color = node.kind === "center" ? echartsCategoryColor.center : echartsCategoryColor[node.layer ?? "content"];
      const isHub = node.kind === "hub";
      const isCenter = node.kind === "center";
      const labelText = isCenter || isHub ? node.fullName : shortLabel(node.fullName, 11);
      return {
        id: node.id,
        name: node.fullName,
        category: isCenter ? echartsCategoryIndex.center : echartsCategoryIndex[node.layer ?? "content"],
        x: node.x,
        y: node.y,
        symbolSize: isCenter ? 70 : isHub ? 48 : 22,
        draggable: true,
        entityId: node.entity?.id,
        kgKind: node.kind,
        kgLayer: node.layer,
        fullName: node.fullName,
        intro: node.intro,
        tags: node.tags,
        classLabel: node.classLabel,
        itemStyle: {
          color,
          borderColor: "#ffffff",
          borderWidth: isCenter ? 3 : isHub ? 2 : 1,
          shadowBlur: isCenter ? 24 : isHub ? 16 : 9,
          shadowColor: color,
        },
        label: {
          show: true,
          position: isCenter || isHub ? "inside" : "bottom",
          distance: 5,
          color: isCenter || isHub ? "#ffffff" : "#45566d",
          fontSize: isCenter ? 14 : isHub ? 12 : 10,
          fontWeight: isCenter || isHub ? 700 : 500,
          formatter: labelText,
        },
      };
    }),
    links: snapshot.edges.map((edge) => ({
      source: edge.sourceId,
      target: edge.targetId,
      kgLayer: edge.layer,
      kgKind: edge.kind,
      lineStyle: {
        color: "#c9ced6",
        opacity: edge.kind === "trunk" ? 0.72 : 0.54,
        width: edge.kind === "trunk" ? 1.8 : 1.2,
      },
    })),
  };
}

function getEchartsOption(graph: EchartsKgGraph, selectedId: string, locale: Locale): EChartsOption {
  return {
    animationDuration: 450,
    animationEasingUpdate: "quinticOut",
    tooltip: {
      trigger: "item",
      borderWidth: 1,
      borderColor: "#d9e4ef",
      backgroundColor: "rgba(255,255,255,0.96)",
      textStyle: { color: "#24364d" },
      extraCssText: "box-shadow:0 16px 36px rgba(31,55,88,.16);border-radius:10px;padding:10px 12px;",
      formatter(params) {
        const item = Array.isArray(params) ? params[0] : params;
        const data = item.data as Partial<EchartsKgNode>;
        if (!data?.fullName) {
          return "";
        }
        const tags = Array.isArray(data.tags) && data.tags.length ? `<div style="margin-top:6px;color:#6b7b8c;font-size:12px">${data.tags.slice(0, 3).join(" / ")}</div>` : "";
        const intro = data.intro ? `<div style="max-width:320px;margin-top:6px;line-height:1.5;color:#526273">${data.intro}</div>` : "";
        return `<div data-kg-echarts-tooltip-inner="true"><strong style="display:block;color:#1a2b3d">${data.fullName}</strong><span style="display:block;margin-top:4px;color:#2d80c7">${data.classLabel ?? ""}</span>${intro}${tags}</div>`;
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        data: graph.nodes.map((node) => ({
          ...node,
          itemStyle: {
            ...node.itemStyle,
            borderColor: selectedId && node.entityId === selectedId ? "#ffcf4a" : node.itemStyle.borderColor,
            borderWidth: selectedId && node.entityId === selectedId ? node.itemStyle.borderWidth + 2 : node.itemStyle.borderWidth,
          },
        })),
        links: graph.links,
        categories: graph.categories,
        roam: true,
        draggable: true,
        zoom: 0.94,
        left: 20,
        right: 20,
        top: 22,
        bottom: 22,
        cursor: "grab",
        label: { show: true },
        edgeSymbol: ["none", "none"],
        lineStyle: {
          color: "#c9ced6",
          width: 1.4,
          opacity: 0.58,
          curveness: 0,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: {
            width: 2.4,
            opacity: 0.9,
          },
        },
        force: {
          initLayout: "none",
          repulsion: 360,
          gravity: 0.045,
          edgeLength: [70, 145],
          friction: 0.72,
          layoutAnimation: true,
        },
      },
    ],
    aria: {
      enabled: true,
    },
  };
}

export function GraphExplorer({ locale, dataset, articles, initialRegion = "guangxi", initialClass = "all" }: GraphExplorerProps) {
  const dict = getDictionary(locale);
  const labels = uiLabels[locale];
  const forceLabels = forceUiLabels[locale];
  const articleLookup = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const entityMap = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const regionOptions = dataset.regionScopes ?? [];
  const cityScopes = regionOptions.filter((scope) => scope.spatialScope === "city");
  const initialRegionId = regionOptions.some((scope) => scope.id === initialRegion) ? initialRegion : "guangxi";
  const [activeRegion, setActiveRegion] = useState(initialRegionId);
  const [activeClass, setActiveClass] = useState<GraphElementClass | "all">(initialClass);
  const [visibleLayers, setVisibleLayers] = useState<Set<GraphElementClass>>(
    () => new Set(initialClass === "all" ? elementOrder : [initialClass]),
  );
  const [viewMode, setViewMode] = useState<CityViewMode>("visual");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [layoutVersion, setLayoutVersion] = useState(0);
  const echartsDomRef = useRef<HTMLDivElement | null>(null);
  const echartsInstanceRef = useRef<ECharts | null>(null);
  const isOverview = activeRegion === "guangxi" || activeRegion === "all";
  const normalizedQuery = normalize(query);

  const provinceEntity = entityMap.get("guangxi") ?? dataset.entities[0] ?? null;
  const cityEntities = cityScopes
    .map((scope) => entityMap.get(scope.id))
    .filter((entity): entity is GraphDataset["entities"][number] => Boolean(entity));

  const scopedEntities = useMemo(() => {
    if (isOverview) {
      return [provinceEntity, ...cityEntities].filter((entity): entity is GraphDataset["entities"][number] => Boolean(entity));
    }

    return dataset.entities.filter((entity) => {
      if (entity.id === activeRegion) {
        return true;
      }
      return entity.parentId === activeRegion || (entity.regionIds ?? []).includes(activeRegion);
    });
  }, [activeRegion, cityEntities, dataset.entities, isOverview, provinceEntity]);

  const layerGroups = useMemo(
    () =>
      elementOrder.map((layer) => ({
        layer,
        meta: getLayerLabel(locale, dataset, layer),
        nodes: scopedEntities
          .filter((entity) => entity.id !== activeRegion && entity.elementClass === layer)
          .sort(
            (left, right) =>
              (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999) ||
              left.name.localeCompare(right.name, "zh-CN"),
          ),
      })),
    [activeRegion, dataset, locale, scopedEntities],
  );

  const displayedGroups = activeClass === "all" ? layerGroups : layerGroups.filter((group) => group.layer === activeClass);
  const cityCenter = entityMap.get(activeRegion) ?? null;
  const selectedEntity = selectedId ? entityMap.get(selectedId) ?? null : null;
  const echartsGraph = useMemo(
    () => buildEchartsGraph(layerGroups, cityCenter, visibleLayers, labels),
    [cityCenter, labels, layerGroups, visibleLayers],
  );

  const cityNodeCount = isOverview ? cityEntities.length + (provinceEntity ? 1 : 0) : scopedEntities.length;
  const directEdges = useMemo(() => {
    if (!selectedEntity) {
      return [];
    }
    return dataset.edges.filter((edge) => edge.sourceEntityId === selectedEntity.id || edge.targetEntityId === selectedEntity.id);
  }, [dataset.edges, selectedEntity]);

  const evidenceRefs = useMemo(() => {
    if (!selectedEntity) {
      return [];
    }
    const articleRefs = selectedEntity.relatedArticleIds
      .map((articleId) => articleLookup.get(articleId))
      .filter((article): article is Article => Boolean(article))
      .map((article) => ({
        kind: "article" as const,
        articleId: article.id,
        title: article.title,
        sourceLabel: article.sourceName,
        url: article.originalUrl,
        publishedAt: article.publishedAt,
      }));

    return dedupeEvidence([
      ...(selectedEntity.sourceRefs ?? []),
      ...directEdges.flatMap((edge) => edge.evidenceRefs ?? []),
      ...articleRefs,
    ]).slice(0, 16);
  }, [articleLookup, directEdges, selectedEntity]);

  const visibleNodeIds = useMemo(() => new Set(scopedEntities.map((entity) => entity.id)), [scopedEntities]);
  const visibleEdges = dataset.edges.filter(
    (edge) => visibleNodeIds.has(edge.sourceEntityId) && visibleNodeIds.has(edge.targetEntityId),
  );

  const matchesQuery = (entity: GraphDataset["entities"][number]) => {
    if (!normalizedQuery) {
      return false;
    }
    return [entity.name, entity.intro, entity.region, ...(entity.tags ?? []), ...(entity.aliases ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  };

  const syncVisibleLayers = (nextLayers: Set<GraphElementClass>) => {
    setVisibleLayers(new Set(nextLayers));
    if (nextLayers.size === 1) {
      setActiveClass([...nextLayers][0]);
      return;
    }
    setActiveClass("all");
  };

  const selectAllForceLayers = () => {
    syncVisibleLayers(new Set(elementOrder));
  };

  const clearForceLayers = () => {
    syncVisibleLayers(new Set());
  };

  const selectSingleLayer = (layer: GraphElementClass | "all") => {
    if (layer === "all") {
      syncVisibleLayers(new Set(elementOrder));
      return;
    }
    syncVisibleLayers(new Set([layer]));
  };

  useEffect(() => {
    setSelectedId("");
  }, [activeRegion, activeClass]);

  useEffect(() => {
    if (isOverview || viewMode !== "visual") {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    const dom = echartsDomRef.current;
    if (!dom) {
      return;
    }

    import("echarts").then((echarts) => {
      if (disposed || !echartsDomRef.current) {
        return;
      }
      const chart = echartsInstanceRef.current ?? echarts.init(echartsDomRef.current, undefined, { renderer: "svg" });
      echartsInstanceRef.current = chart;
      chart.setOption(getEchartsOption(echartsGraph, selectedId, locale), true);
      chart.off("click");
      chart.on("click", (params) => {
        const data = params.data as Partial<EchartsKgNode> | undefined;
        if (data?.entityId) {
          setSelectedId(data.entityId);
        }
      });

      const debugState = {
        nodeCount: echartsGraph.nodes.length,
        edgeCount: echartsGraph.links.length,
        counts: echartsGraph.counts,
        visibleLayers: [...visibleLayers],
        selectedId,
        layoutVersion,
      };
      echartsDomRef.current.dataset.kgEchartsNodeCount = String(debugState.nodeCount);
      echartsDomRef.current.dataset.kgEchartsEdgeCount = String(debugState.edgeCount);
      echartsDomRef.current.dataset.kgEchartsLayers = debugState.visibleLayers.join(",");
      const debugWindow = window as Window & {
        __KG_ECHARTS_STATE__?: typeof debugState;
        __KG_ECHARTS_INSTANCE__?: ECharts;
      };
      debugWindow.__KG_ECHARTS_STATE__ = debugState;
      debugWindow.__KG_ECHARTS_INSTANCE__ = chart;

      resizeHandler = () => chart.resize();
      window.addEventListener("resize", resizeHandler);
      resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(echartsDomRef.current);
    });

    return () => {
      disposed = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      resizeObserver?.disconnect();
    };
  }, [echartsGraph, isOverview, layoutVersion, locale, selectedId, viewMode, visibleLayers]);

  useEffect(() => {
    return () => {
      echartsInstanceRef.current?.dispose();
      echartsInstanceRef.current = null;
      const debugWindow = window as Window & { __KG_ECHARTS_INSTANCE__?: ECharts; __KG_ECHARTS_STATE__?: unknown };
      delete debugWindow.__KG_ECHARTS_INSTANCE__;
      delete debugWindow.__KG_ECHARTS_STATE__;
    };
  }, []);

  return (
    <div className="kg-page kg-research">
      <section className="kg-research-shell">
        <div className="kg-research-bg" />

        <header className="kg-research-header">
          <div className="kg-research-title">
            <p className="section-kicker">{dict.nav.graph}</p>
            <h2>{isOverview ? labels.overview : `${cityCenter?.name ?? ""}${labels.cityGraph}`}</h2>
            <span>{isOverview ? labels.overviewIntro : cityCenter?.intro}</span>
          </div>

          <div className="kg-research-controls">
            {!isOverview ? (
              <div className="kg-view-switch" aria-label="knowledge graph view mode">
                <button type="button" className={viewMode === "visual" ? "is-active" : ""} onClick={() => setViewMode("visual")}>
                  {labels.visualView}
                </button>
                <button type="button" className={viewMode === "text" ? "is-active" : ""} onClick={() => setViewMode("text")}>
                  {labels.textView}
                </button>
              </div>
            ) : null}

            <label className="kg-control">
              <span>{labels.cityFocus}</span>
              <select
                value={activeRegion}
                onChange={(event) => {
                  setActiveRegion(event.target.value);
                  syncVisibleLayers(new Set(elementOrder));
                }}
                className="kg-select"
              >
                <option value="guangxi">{labels.overview}</option>
                {cityScopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {locale === "zh" ? scope.labelZh : scope.labelEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="kg-control kg-control--search">
              <span>{labels.search}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} />
            </label>
          </div>
        </header>

        <div className="kg-research-metrics" aria-label="graph metrics">
          <div>
            <strong>{cityNodeCount}</strong>
            <span>{labels.nodeCount}</span>
          </div>
          <div>
            <strong>{visibleEdges.length}</strong>
            <span>{labels.relationCount}</span>
          </div>
          <div>
            <strong>{isOverview ? 14 : 5}</strong>
            <span>{isOverview ? labels.cityFocus : labels.allLayers}</span>
          </div>
        </div>

        {isOverview ? (
          <section className="kg-overview-stage" data-kg-overview>
            <div className="kg-overview-core" data-kg-node-id="guangxi">
              <span>{labels.centerNode}</span>
              <strong>{provinceEntity?.name ?? "广西"}</strong>
              <p>{provinceEntity?.intro}</p>
            </div>

            <div className="kg-overview-cities">
              {cityEntities.map((entity, index) => (
                <button
                  key={entity.id}
                  type="button"
                  className={matchesQuery(entity) ? "kg-city-orb is-matched" : "kg-city-orb"}
                  onClick={() => {
                    setActiveRegion(entity.id);
                    syncVisibleLayers(new Set(elementOrder));
                  }}
                  data-kg-node-id={entity.id}
                  data-kg-node-class={entity.elementClass}
                  data-kg-overview-city={entity.id}
                  style={{ "--city-index": index } as CSSProperties}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{entity.name}</strong>
                  <small>{entity.intro}</small>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="kg-city-stage" data-kg-city={activeRegion}>
            <div className="kg-layer-tabs" aria-label="city graph layer filters">
              <button
                type="button"
                className={activeClass === "all" ? "filter-chip is-active" : "filter-chip"}
                onClick={() => selectSingleLayer("all")}
              >
                {labels.allLayers}
              </button>
              {elementOrder.map((layer) => {
                const meta = getLayerLabel(locale, dataset, layer);
                const count = layerGroups.find((group) => group.layer === layer)?.nodes.length ?? 0;
                return (
                  <button
                    key={layer}
                    type="button"
                    className={activeClass === layer ? "filter-chip is-active" : "filter-chip"}
                    onClick={() => selectSingleLayer(layer)}
                  >
                    {meta.label} {count}
                  </button>
                );
              })}
            </div>

            {viewMode === "visual" ? (
              <div className="kg-visual-frame kg-echarts-frame" data-kg-visual-mode={activeClass} data-kg-echarts-frame>
                <div className="kg-echarts-dashboard">
                  <header className="kg-echarts-header">
                    <div>
                      <h3>{cityCenter?.name ?? ""}{labels.visualView}</h3>
                      <span>{cityCenter?.region ?? cityCenter?.name}</span>
                    </div>
                    <div className="kg-echarts-stats" aria-label="echarts graph stats">
                      <div>
                        <span>{labels.nodeCount}</span>
                        <strong>{echartsGraph.nodes.length}</strong>
                      </div>
                      <div>
                        <span>{labels.relationCount}</span>
                        <strong>{echartsGraph.links.length}</strong>
                      </div>
                      <div>
                        <span>{forceLabels.visibleBranches}</span>
                        <strong>{visibleLayers.size}</strong>
                      </div>
                    </div>
                  </header>

                  <div
                    ref={echartsDomRef}
                    className="kg-echarts-graph"
                    role="img"
                    aria-label={`${cityCenter?.name ?? ""}${labels.visualView}`}
                    data-kg-echarts-graph
                  />
                </div>

                <aside className="kg-force-panel kg-echarts-panel" aria-label={forceLabels.graphControls} data-kg-force-panel data-kg-echarts-panel>
                  <header>
                    <span>{forceLabels.graphControls}</span>
                    <strong>{echartsGraph.nodes.length}</strong>
                  </header>
                  <p>{forceLabels.dragHint}</p>

                  <div className="kg-force-panel__actions">
                    <button type="button" onClick={selectAllForceLayers} data-kg-force-select-all>
                      {forceLabels.selectAll}
                    </button>
                    <button type="button" onClick={clearForceLayers} data-kg-force-clear>
                      {forceLabels.clearAll}
                    </button>
                    <button type="button" onClick={() => setLayoutVersion((value) => value + 1)} data-kg-force-reset>
                      {forceLabels.resetLayout}
                    </button>
                  </div>

                  <div className="kg-force-panel__filters" aria-label={forceLabels.visibleBranches}>
                    {elementOrder.map((layer) => {
                      const group = layerGroups.find((item) => item.layer === layer);
                      const meta = group?.meta ?? getLayerLabel(locale, dataset, layer);
                      const tone = layerTone[layer];
                      return (
                        <label
                          key={layer}
                          className="kg-force-filter"
                          data-kg-force-filter-layer={layer}
                          style={{ "--layer-color": tone.color, "--layer-glow": tone.glow } as CSSProperties}
                        >
                          <input
                            type="checkbox"
                            checked={visibleLayers.has(layer)}
                            onChange={(event) => {
                              const next = new Set(visibleLayers);
                              if (event.target.checked) {
                                next.add(layer);
                              } else {
                                next.delete(layer);
                              }
                              syncVisibleLayers(next);
                            }}
                          />
                          <span />
                          <strong>{meta.label}</strong>
                          <small>{group?.nodes.length ?? 0}</small>
                        </label>
                      );
                    })}
                  </div>
                </aside>
              </div>
            ) : (
              <div className="kg-city-canvas">
                {activeClass === "all" && cityCenter ? (
                  <button
                    type="button"
                    className={selectedId === cityCenter.id ? "kg-node-card kg-node-card--center is-active" : "kg-node-card kg-node-card--center"}
                    onClick={() => setSelectedId(cityCenter.id)}
                    data-kg-node-id={cityCenter.id}
                    data-kg-node-class={cityCenter.elementClass}
                  >
                    <span>{labels.centerNode}</span>
                    <strong>{cityCenter.name}</strong>
                    <small>{cityCenter.intro}</small>
                  </button>
                ) : null}

                <div className={activeClass === "all" ? "kg-lane-grid" : "kg-lane-grid kg-lane-grid--single"}>
                  {displayedGroups.map((group) => {
                    const tone = layerTone[group.layer];
                    return (
                      <section
                        key={group.layer}
                        className="kg-lane"
                        style={{ "--layer-color": tone.color, "--layer-glow": tone.glow } as CSSProperties}
                        data-kg-layer={group.layer}
                      >
                        <header className="kg-lane__head">
                          <span>{group.nodes.length}</span>
                          <div>
                            <strong>{group.meta.label}</strong>
                            <small>{group.meta.description}</small>
                          </div>
                        </header>

                        <div className="kg-lane__nodes">
                          {group.nodes.length ? (
                            group.nodes.map((entity) => {
                              const isMatched = matchesQuery(entity);
                              const isActive = selectedId === entity.id;
                              return (
                                <button
                                  key={entity.id}
                                  type="button"
                                  className={[
                                    "kg-node-card",
                                    isActive ? "is-active" : "",
                                    isMatched ? "is-matched" : "",
                                  ].filter(Boolean).join(" ")}
                                  onClick={() => setSelectedId(entity.id)}
                                  data-kg-node-id={entity.id}
                                  data-kg-node-class={entity.elementClass}
                                >
                                  <span>{entity.tags?.[0] ?? group.meta.label}</span>
                                  <strong>{entity.name}</strong>
                                  <small>{entity.intro}</small>
                                </button>
                              );
                            })
                          ) : (
                            <div className="kg-lane__empty">{labels.empty}</div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}

            <aside className="kg-detail-panel" aria-label={labels.detailTitle}>
              {selectedEntity ? (
                <>
                  <div className="kg-detail-panel__head">
                    <span>{getLayerLabel(locale, dataset, selectedEntity.elementClass ?? "content").label}</span>
                    <h3>{selectedEntity.name}</h3>
                    <p>{selectedEntity.intro}</p>
                  </div>

                  <div className="kg-detail-actions">
                    {selectedEntity.parentId && selectedEntity.parentId !== "guangxi" ? (
                      <Link href={withLocale(locale, `/map?region=${selectedEntity.parentId}`)} className="source-chip source-chip--link">
                        {labels.openMap}
                      </Link>
                    ) : null}
                    <span className="source-chip source-chip--strong">
                      {(selectedEntity.sourceRefs?.length ?? 0) + selectedEntity.relatedArticleIds.length} {labels.evidenceCount}
                    </span>
                  </div>

                  {selectedEntity.tags?.length ? (
                    <div className="kg-detail-tags">
                      {selectedEntity.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}

                  {selectedEntity.scorecard ? (
                    <section className="kg-scorecard">
                      <h4>{labels.scorecard}</h4>
                      {Object.entries(selectedEntity.scorecard).map(([key, value]) => (
                        <div key={key} className="kg-scorecard__row">
                          <span>{labels.scoreLabels[key as keyof typeof labels.scoreLabels]}</span>
                          <div className="kg-scorecard__bar">
                            <i style={{ width: `${(Number(value) / 5) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </section>
                  ) : null}

                  <section className="kg-detail-list">
                    <h4>{labels.relationTitle}</h4>
                    {directEdges.slice(0, 20).map((edge) => {
                      const targetId = edge.sourceEntityId === selectedEntity.id ? edge.targetEntityId : edge.sourceEntityId;
                      const target = entityMap.get(targetId);
                      return target ? (
                        <button key={`${edge.sourceEntityId}-${edge.targetEntityId}-${edge.relationType}`} type="button" onClick={() => setSelectedId(target.id)}>
                          <strong>{target.name}</strong>
                          <span>{target.elementClass ? getLayerLabel(locale, dataset, target.elementClass).label : edge.relationType}</span>
                        </button>
                      ) : null;
                    })}
                  </section>

                  <section className="kg-detail-list">
                    <h4>{labels.evidenceTitle}</h4>
                    {evidenceRefs.map((ref, index) =>
                      ref.kind === "article" && ref.articleId && articleLookup.get(ref.articleId) ? (
                        <Link key={evidenceKey(ref, index)} href={getArticleHref(locale, articleLookup.get(ref.articleId)!)} className="kg-evidence-link">
                          <strong>{ref.title}</strong>
                          <span>{ref.sourceLabel}</span>
                        </Link>
                      ) : ref.url ? (
                        <a key={evidenceKey(ref, index)} href={ref.url} target="_blank" rel="noreferrer" className="kg-evidence-link">
                          <strong>{ref.title}</strong>
                          <span>{ref.sourceLabel}</span>
                        </a>
                      ) : (
                        <div key={evidenceKey(ref, index)} className="kg-evidence-link">
                          <strong>{ref.title}</strong>
                          <span>{ref.sourceLabel}</span>
                        </div>
                      ),
                    )}
                  </section>
                </>
              ) : (
                <div className="kg-detail-panel__empty">{labels.selectedHint}</div>
              )}
            </aside>
          </section>
        )}
      </section>
    </div>
  );
}
