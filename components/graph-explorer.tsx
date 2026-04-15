"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getArticleHref, getDictionary } from "@/lib/site";
import type {
  Article,
  EvidenceRef,
  GraphDataset,
  GraphElementClass,
  GraphRelationType,
  Locale,
} from "@/lib/types";

interface GraphExplorerProps {
  locale: Locale;
  dataset: GraphDataset;
  articles: Article[];
  initialRegion?: string;
}

const elementOrder: GraphElementClass[] = ["subject", "goal", "content", "activity", "evaluation"];
const palette: Record<GraphElementClass, string> = {
  subject: "#7bd2ff",
  goal: "#f4d67f",
  content: "#8de1c4",
  activity: "#89b8ff",
  evaluation: "#c8a7ff",
};

const defaultTaxonomy = {
  zh: {
    subject: { label: "主体", description: "赋能主体" },
    goal: { label: "目标", description: "目标价值" },
    content: { label: "内容", description: "空间要素" },
    activity: { label: "活动", description: "技术载体与协同活动" },
    evaluation: { label: "评价", description: "效能评价" },
  },
  en: {
    subject: { label: "Subject", description: "Actors" },
    goal: { label: "Goal", description: "Value goals" },
    content: { label: "Content", description: "Spatial factors" },
    activity: { label: "Activity", description: "Carriers and actions" },
    evaluation: { label: "Evaluation", description: "Score and effect" },
  },
} as const;

const relationLabels: Record<Locale, Record<GraphRelationType, string>> = {
  zh: {
    related: "相关",
    guides: "引导",
    drives: "驱动",
    supports: "支撑",
    located_in: "位于",
    pursues: "面向",
    organizes: "组织",
    focuses_on: "聚焦",
    enables: "赋能",
    constrains: "约束",
    collaborates_with: "协同",
    assesses: "评价",
  },
  en: {
    related: "Related",
    guides: "Guides",
    drives: "Drives",
    supports: "Supports",
    located_in: "Located in",
    pursues: "Pursues",
    organizes: "Organizes",
    focuses_on: "Focuses on",
    enables: "Enables",
    constrains: "Constrains",
    collaborates_with: "Collaborates with",
    assesses: "Assesses",
  },
};

const runtimeTaxonomy = {
  zh: {
    subject: { label: "主体", description: "赋能主体" },
    goal: { label: "目标", description: "目标价值" },
    content: { label: "内容", description: "空间要素" },
    activity: { label: "活动", description: "技术载体与协同活动" },
    evaluation: { label: "评价", description: "效能评价" },
  },
  en: {
    subject: { label: "Subject", description: "Actors" },
    goal: { label: "Goal", description: "Value goals" },
    content: { label: "Content", description: "Spatial factors" },
    activity: { label: "Activity", description: "Carriers and actions" },
    evaluation: { label: "Evaluation", description: "Score and effect" },
  },
} as const;

const runtimeRelationLabels: Record<Locale, Record<GraphRelationType, string>> = {
  zh: {
    related: "相关",
    guides: "引导",
    drives: "驱动",
    supports: "支撑",
    located_in: "位于",
    pursues: "面向",
    organizes: "组织",
    focuses_on: "聚焦",
    enables: "赋能",
    constrains: "约束",
    collaborates_with: "协同",
    assesses: "评估",
  },
  en: relationLabels.en,
};

const runtimeUiLabels = {
  zh: {
    nodeCount: "个节点",
    edgeCount: "条关系",
    linkedArticles: "相关文章",
    directRelations: "直接关系",
    allEvidence: "证据与依据",
    emptyColumn: "当前筛选下暂无节点",
    scoreLabels: {
      factorSupport: "要素保障",
      carrierCapacity: "技术承载",
      collaborationLevel: "协同水平",
      applicationOutput: "应用成效",
      comprehensiveBenefit: "综合效益",
    },
  },
  en: {
    nodeCount: "nodes",
    edgeCount: "relations",
    linkedArticles: "linked articles",
    directRelations: "direct relations",
    allEvidence: "Evidence and notes",
    emptyColumn: "No nodes in this column",
    scoreLabels: {
      factorSupport: "Factor support",
      carrierCapacity: "Carrier capacity",
      collaborationLevel: "Collaboration",
      applicationOutput: "Application output",
      comprehensiveBenefit: "Benefit",
    },
  },
} as const;

function wrapLabel(value: string, size = 8) {
  const normalized = String(value ?? "").replace(/\s+/g, "");
  if (!normalized) {
    return [""];
  }
  if (!/[\u4e00-\u9fa5]/.test(normalized)) {
    const words = normalized.split("-");
    if (words.length <= 2 && normalized.length <= 18) {
      return [normalized];
    }
    return [normalized.slice(0, 14), `${normalized.slice(14, 26)}${normalized.length > 26 ? "..." : ""}`];
  }
  if (normalized.length <= size) {
    return [normalized];
  }
  return [normalized.slice(0, size), `${normalized.slice(size, size * 2)}${normalized.length > size * 2 ? "..." : ""}`];
}

function estimateLabelWidth(lines: string[]) {
  const widest = lines.reduce((max, line) => {
    const visualLength = line.replace(/[^\x00-\xff]/g, "aa").length;
    return Math.max(max, visualLength);
  }, 0);
  return Math.max(86, Math.min(186, widest * 7.2 + 26));
}

function dedupeEvidence(refs: EvidenceRef[]) {
  const seen = new Set();
  return refs.filter((ref) => {
    const key = ref.kind === "article" ? `article:${ref.articleId}` : `research:${ref.id ?? ref.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getLayerLabel(locale: Locale, dataset: GraphDataset, value: GraphElementClass) {
  const current = dataset.taxonomy?.elementClasses.find((item) => item.key === value);
  if (current) {
    return {
      label: locale === "zh" ? current.labelZh : current.labelEn,
      description: locale === "zh" ? current.descriptionZh : current.descriptionEn,
    };
  }
  return runtimeTaxonomy[locale][value] ?? defaultTaxonomy[locale][value];
}

function getNetworkPositions(entities: GraphDataset["entities"], selectedId: string) {
  const center = { x: 700, y: 420 };
  const laneByClass: Record<
    GraphElementClass,
    {
      centerX: number;
      centerY: number;
      columns: number;
      dx: number;
      dy: number;
      labelPosition: "top" | "bottom" | "left" | "right";
    }
  > = {
    subject: { centerX: 365, centerY: 230, columns: 2, dx: 150, dy: 92, labelPosition: "left" },
    goal: { centerX: 1065, centerY: 250, columns: 2, dx: 150, dy: 108, labelPosition: "right" },
    content: { centerX: 365, centerY: 640, columns: 2, dx: 150, dy: 92, labelPosition: "left" },
    activity: { centerX: 700, centerY: 155, columns: 4, dx: 172, dy: 94, labelPosition: "top" },
    evaluation: { centerX: 1065, centerY: 630, columns: 2, dx: 150, dy: 104, labelPosition: "right" },
  };
  const grouped = Object.fromEntries(
    elementOrder.map((value) => [value, entities.filter((entity) => entity.id !== selectedId && entity.elementClass === value)]),
  ) as Record<GraphElementClass, GraphDataset["entities"]>;
  const positions: Record<string, { x: number; y: number; r: number; labelPosition: "top" | "bottom" | "left" | "right" }> = {
    [selectedId]: { ...center, r: 42, labelPosition: "top" },
  };

  elementOrder.forEach((value) => {
    const lane = laneByClass[value];
    const current = grouped[value];
    const columns = Math.max(1, Math.min(lane.columns, current.length));
    const rows = Math.max(1, Math.ceil(current.length / columns));
    const startY = lane.centerY - ((rows - 1) * lane.dy) / 2;
    current.forEach((entity, index) => {
      const columnIndex = index % columns;
      const rowIndex = Math.floor(index / columns);
      const columnOffset = (columnIndex - (columns - 1) / 2) * lane.dx;
      const rowOffset = rowIndex * lane.dy;
      positions[entity.id] = {
        x: lane.centerX + columnOffset,
        y: startY + rowOffset,
        r: entity.id === selectedId ? 42 : Math.max(18, Math.min(26, 16 + entity.relatedArticleIds.length * 1.1)),
        labelPosition: lane.labelPosition,
      };
    });
  });

  return positions;
}

function getPreferredSelectionId(
  entities: GraphDataset["entities"],
  activeRegion: string,
  activeClass: GraphElementClass | "all",
) {
  if (!entities.length) {
    return "";
  }
  if (activeRegion === "all") {
    return entities[0]?.id ?? "";
  }

  if (activeClass === "all") {
    return entities.find((entity) => entity.id === activeRegion)?.id ?? entities[0]?.id ?? "";
  }

  const candidates = entities.filter((entity) => entity.elementClass === activeClass);
  if (!candidates.length) {
    return entities[0]?.id ?? "";
  }

  const ranked = [...candidates].sort((left, right) => {
    const score = (entity: GraphDataset["entities"][number]) => {
      if (entity.id === activeRegion) {
        return 500;
      }

      let value = 0;
      if (entity.parentId === activeRegion) {
        value += 240;
      }
      if (entity.regionIds?.includes(activeRegion)) {
        value += 120;
      }
      if ((entity.regionIds?.length ?? 0) <= 2) {
        value += 36;
      }
      if (entity.spatialScope === "project" || entity.spatialScope === "park") {
        value += 24;
      }
      if (entity.spatialScope === "province") {
        value -= 40;
      }
      return value;
    };

    const diff = score(right) - score(left);
    if (diff !== 0) {
      return diff;
    }
    return (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999) || left.name.localeCompare(right.name, "zh-CN");
  });

  return ranked[0]?.id ?? entities[0]?.id ?? "";
}

export function GraphExplorer({ locale, dataset, articles, initialRegion = "all" }: GraphExplorerProps) {
  const dict = getDictionary(locale);
  const articleLookup = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const regionOptions = dataset.regionScopes ?? [];
  const [viewMode, setViewMode] = useState<"layered" | "network">("layered");
  const [activeClass, setActiveClass] = useState<GraphElementClass | "all">("all");
  const [activeRegion, setActiveRegion] = useState<string>(
    initialRegion === "all" || regionOptions.some((option) => option.id === initialRegion)
      ? initialRegion
      : "all",
  );
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [selectedId, setSelectedId] = useState(dataset.views?.network?.featuredEntityId ?? dataset.entities[0]?.id ?? "");

  const regionScopedEntities = useMemo(() => {
    const scoped = dataset.entities.filter((entity) => {
      if (activeRegion === "all") {
        return true;
      }
      return entity.id === activeRegion || entity.regionIds?.includes(activeRegion) || entity.parentId === activeRegion;
    });

    if (activeRegion === "all" || activeRegion === "guangxi") {
      return scoped;
    }

    return scoped.filter((entity) => {
      const isOtherRegionNode =
        entity.elementClass === "content" &&
        entity.type === "region" &&
        entity.id !== activeRegion;
      return !isOtherRegionNode;
    });
  }, [activeRegion, dataset.entities]);

  const filteredEntities = useMemo(() => {
    if (activeClass === "all") {
      return regionScopedEntities;
    }
    return regionScopedEntities.filter((entity) => entity.elementClass === activeClass);
  }, [activeClass, regionScopedEntities]);

  useEffect(() => {
    const preferredId = getPreferredSelectionId(filteredEntities, activeRegion, activeClass);
    if (preferredId && preferredId !== selectedId) {
      setSelectedId(preferredId);
    }
  }, [activeClass, activeRegion, filteredEntities]);

  useEffect(() => {
    if (!filteredEntities.some((entity) => entity.id === selectedId)) {
      setSelectedId(getPreferredSelectionId(filteredEntities, activeRegion, activeClass));
    }
  }, [activeClass, activeRegion, filteredEntities, selectedId]);

  useEffect(() => {
    setShowAllEdges(false);
  }, [activeRegion, activeClass]);

  const entityMap = useMemo(
    () => new Map(dataset.entities.map((entity) => [entity.id, entity])),
    [dataset.entities],
  );
  const regionVisibleIds = useMemo(
    () => new Set(regionScopedEntities.map((entity) => entity.id)),
    [regionScopedEntities],
  );
  const eligibleEdges = useMemo(
    () =>
      dataset.edges.filter((edge) => {
        const modeHit = !edge.viewModes || edge.viewModes.includes(viewMode);
        return modeHit && regionVisibleIds.has(edge.sourceEntityId) && regionVisibleIds.has(edge.targetEntityId);
      }),
    [dataset.edges, regionVisibleIds, viewMode],
  );
  const selectedEdges = eligibleEdges.filter(
    (edge) => edge.sourceEntityId === selectedId || edge.targetEntityId === selectedId,
  );
  const networkCenterId = activeRegion !== "all" ? activeRegion : selectedId;
  const networkCenterEntity = entityMap.get(networkCenterId) ?? null;

  const rankEntityForRegion = (entity: GraphDataset["entities"][number]) => {
    let score = entity.relatedArticleIds.length + (entity.displayOrder != null ? Math.max(0, 20 - entity.displayOrder) : 0);
    if (activeRegion !== "all") {
      if (entity.parentId === activeRegion) {
        score += 240;
      }
      if (entity.regionIds?.includes(activeRegion)) {
        score += 120;
      }
      if ((entity.regionIds?.length ?? 0) <= 2) {
        score += 40;
      }
      if (entity.spatialScope === "project" || entity.spatialScope === "park") {
        score += 30;
      }
      if (entity.spatialScope === "province") {
        score -= 50;
      }
    }
    return score;
  };

  const baseNetworkPool = useMemo(() => {
    const pool = regionScopedEntities.filter((entity) => entity.id !== networkCenterId);
    if (activeClass === "all") {
      return pool;
    }
    return pool.filter((entity) => entity.elementClass === activeClass);
  }, [activeClass, networkCenterId, regionScopedEntities]);

  const directNeighborIds = useMemo(() => {
    const ids = new Set<string>();
    eligibleEdges.forEach((edge) => {
      if (edge.sourceEntityId === networkCenterId) {
        ids.add(edge.targetEntityId);
      }
      if (edge.targetEntityId === networkCenterId) {
        ids.add(edge.sourceEntityId);
      }
    });
    return ids;
  }, [eligibleEdges, networkCenterId]);

  const expandedNeighborIds = useMemo(() => {
    const ids = new Set<string>(directNeighborIds);
    if (!showAllEdges) {
      return ids;
    }

    eligibleEdges.forEach((edge) => {
      if (directNeighborIds.has(edge.sourceEntityId)) {
        ids.add(edge.targetEntityId);
      }
      if (directNeighborIds.has(edge.targetEntityId)) {
        ids.add(edge.sourceEntityId);
      }
    });
    ids.delete(networkCenterId);
    return ids;
  }, [directNeighborIds, eligibleEdges, networkCenterId, showAllEdges]);

  const networkEntities = useMemo(() => {
    const sortPool = (pool: GraphDataset["entities"]) =>
      [...pool].sort(
        (left, right) =>
          rankEntityForRegion(right) - rankEntityForRegion(left) || left.name.localeCompare(right.name, "zh-CN"),
      );

    const selected: GraphDataset["entities"] = [];
    if (networkCenterEntity) {
      selected.push(networkCenterEntity);
    }

    const reachableIds = showAllEdges ? expandedNeighborIds : directNeighborIds;
    const reachablePool = baseNetworkPool.filter((entity) => reachableIds.has(entity.id));

    if (activeClass === "all") {
      elementOrder.forEach((elementClass) => {
        const pool = reachablePool.filter((entity) => entity.elementClass === elementClass);
        selected.push(...sortPool(pool));
      });
    } else {
      selected.push(...sortPool(reachablePool));
    }

    const seen = new Set<string>();
    return selected.filter((entity) => {
      if (seen.has(entity.id)) {
        return false;
      }
      seen.add(entity.id);
      return true;
    });
  }, [activeClass, baseNetworkPool, directNeighborIds, expandedNeighborIds, networkCenterEntity, showAllEdges]);

  const activeNodeIds = useMemo(
    () => new Set(networkEntities.map((entity) => entity.id)),
    [networkEntities],
  );
  const displayedEdges = useMemo(() => {
    if (!networkCenterEntity) {
      return [];
    }

    return eligibleEdges.filter((edge) => {
      const visible = activeNodeIds.has(edge.sourceEntityId) && activeNodeIds.has(edge.targetEntityId);
      if (!visible) {
        return false;
      }
      if (showAllEdges) {
        return true;
      }
      return edge.sourceEntityId === networkCenterId || edge.targetEntityId === networkCenterId;
    });
  }, [activeNodeIds, eligibleEdges, networkCenterEntity, networkCenterId, networkEntities, showAllEdges]);

  const canExpandNetwork = useMemo(() => {
    const reachableIds = expandedNeighborIds;
    const reachablePool = baseNetworkPool.filter((entity) => reachableIds.has(entity.id));
    return reachablePool.length + (networkCenterEntity ? 1 : 0) > networkEntities.length;
  }, [baseNetworkPool, expandedNeighborIds, networkCenterEntity, networkEntities.length]);
  const highlightedIds = new Set<string>([selectedId]);
  displayedEdges.forEach((edge) => {
    highlightedIds.add(edge.sourceEntityId);
    highlightedIds.add(edge.targetEntityId);
  });

  const selectedEntity = entityMap.get(selectedId) ?? null;
  const networkPositions = useMemo(
    () => getNetworkPositions(networkEntities, networkCenterId),
    [networkCenterId, networkEntities],
  );

  const groupedColumns = elementOrder.map((value) => ({
    value,
    meta: getLayerLabel(locale, dataset, value),
    entities: filteredEntities
      .filter((entity) => entity.elementClass === value)
      .sort(
        (left, right) =>
          (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999) ||
          right.relatedArticleIds.length - left.relatedArticleIds.length ||
          left.name.localeCompare(right.name, "zh-CN"),
      ),
  }));

  const evidenceRefs = useMemo(() => {
    if (!selectedEntity) {
      return [];
    }
    const articleRefs = selectedEntity.relatedArticleIds
      .map((articleId) => articles.find((article) => article.id === articleId))
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
      ...selectedEdges.flatMap((edge) => edge.evidenceRefs ?? []),
      ...articleRefs,
    ]).slice(0, 12);
  }, [articles, selectedEdges, selectedEntity]);

  const groupedRelations = useMemo(() => {
    if (!selectedEntity) {
      return [];
    }
    return elementOrder
      .map((value) => {
        const items = selectedEdges
          .map((edge) => {
            const targetId = edge.sourceEntityId === selectedEntity.id ? edge.targetEntityId : edge.sourceEntityId;
            const target = entityMap.get(targetId);
            if (!target) {
              return null;
            }
            return {
              target,
              label: runtimeRelationLabels[locale][edge.relationType],
              edge,
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .filter((item) => item.target.elementClass === value);
        return { value, label: getLayerLabel(locale, dataset, value).label, items };
      })
      .filter((group) => group.items.length > 0);
  }, [dataset, entityMap, locale, selectedEdges, selectedEntity]);

  const labels = runtimeUiLabels[locale];

  return (
    <div className="kg-page">
      <section className="card-panel kg-toolbar">
        <div className="kg-toolbar__row">
          <div className="filter-row">
            <button type="button" onClick={() => setActiveClass("all")} className={activeClass === "all" ? "filter-chip is-active" : "filter-chip"}>
              {dict.graph.filterAll}
            </button>
            {elementOrder.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveClass(value)}
                className={activeClass === value ? "filter-chip is-active" : "filter-chip"}
              >
                {getLayerLabel(locale, dataset, value).label}
              </button>
            ))}
          </div>
          <div className="kg-toolbar__modes">
            <button type="button" onClick={() => setViewMode("layered")} className={viewMode === "layered" ? "filter-chip is-active" : "filter-chip"}>
              {dict.graph.viewLayered}
            </button>
            <button type="button" onClick={() => setViewMode("network")} className={viewMode === "network" ? "filter-chip is-active" : "filter-chip"}>
              {dict.graph.viewNetwork}
            </button>
            <button
              type="button"
              onClick={() => setShowAllEdges((value) => !value)}
              className={showAllEdges ? "filter-chip is-active" : "filter-chip"}
              disabled={!showAllEdges && !canExpandNetwork}
            >
              {showAllEdges ? dict.graph.focusSelected : dict.graph.showAllEdges}
            </button>
          </div>
        </div>

        <div className="kg-toolbar__row kg-toolbar__row--compact">
          <div className="kg-region-filter">
            <label htmlFor="graph-region">{dict.graph.filterRegionAll}</label>
            <select id="graph-region" value={activeRegion} onChange={(event) => setActiveRegion(event.target.value)} className="kg-select">
              <option value="all">{dict.graph.filterRegionAll}</option>
              {regionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {locale === "zh" ? option.labelZh : option.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div className="graph-stats">
            <span>{viewMode === "network" ? networkEntities.length : filteredEntities.length}</span>
            <small>{labels.nodeCount}</small>
            <span>{displayedEdges.length}</span>
            <small>{labels.edgeCount}</small>
          </div>
        </div>
      </section>

      {viewMode === "layered" ? (
        <section className="card-panel kg-layered-board">
          <div className="kg-layered-grid">
            {groupedColumns.map((column, columnIndex) => (
              <div key={column.value} className="kg-column">
                <div className="kg-column__head">
                  <span className="kg-column__index">0{columnIndex + 1}</span>
                  <div>
                    <strong>{column.meta.label}</strong>
                    <small>{column.meta.description}</small>
                  </div>
                </div>
                <div className="kg-column__list">
                  {column.entities.length > 0 ? (
                    column.entities.map((entity) => {
                      const isActive = entity.id === selectedId;
                      const isLinked = !isActive && highlightedIds.has(entity.id);
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          onClick={() => setSelectedId(entity.id)}
                          className={isActive ? "kg-card is-active" : isLinked ? "kg-card is-linked" : "kg-card"}
                        >
                          <span className="kg-card__meta">{entity.subtype ?? column.meta.label}</span>
                          <strong>{entity.name}</strong>
                          <small>{entity.relatedArticleIds.length} {labels.linkedArticles}</small>
                        </button>
                      );
                    })
                  ) : (
                    <div className="kg-column__empty">{labels.emptyColumn}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card-panel kg-network">
          <svg viewBox="0 0 1400 860" className="kg-network__svg" role="img" aria-label={dict.pageIntro.graphTitle}>
            <defs>
              <radialGradient id="kgCenterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(120, 235, 255, 0.45)" />
                <stop offset="100%" stopColor="rgba(120, 235, 255, 0)" />
              </radialGradient>
            </defs>
            <circle cx="700" cy="420" r="82" fill="url(#kgCenterGlow)" />
            {displayedEdges.map((edge) => {
              const source = networkPositions[edge.sourceEntityId];
              const target = networkPositions[edge.targetEntityId];
              if (!source || !target) {
                return null;
              }
              const isCenterEdge = edge.sourceEntityId === networkCenterId || edge.targetEntityId === networkCenterId;
              const isSelectedEdge = edge.sourceEntityId === selectedId || edge.targetEntityId === selectedId;
              return (
                <path
                  key={`${edge.sourceEntityId}-${edge.targetEntityId}-${edge.relationType}`}
                  d={`M ${source.x} ${source.y} Q ${(source.x + target.x) / 2} ${(source.y + target.y) / 2 - 18} ${target.x} ${target.y}`}
                  className={isCenterEdge ? "kg-network__edge is-center" : isSelectedEdge ? "kg-network__edge is-active" : "kg-network__edge"}
                />
              );
            })}
            {networkEntities.map((entity) => {
              const point = networkPositions[entity.id];
              if (!point) {
                return null;
              }
              const lines = wrapLabel(entity.name, 7);
              const isCenter = entity.id === networkCenterId;
              const isActive = entity.id === selectedId;
              const labelWidth = estimateLabelWidth(lines);
              const labelHeight = 18 + Math.max(lines.length - 1, 0) * 16;
              const boxHeight = labelHeight + 12;
              const gap = 18;
              let labelCenterX = point.x;
              let labelCenterY = point.y;

              if (point.labelPosition === "left") {
                labelCenterX = point.x - point.r - gap - labelWidth / 2;
              } else if (point.labelPosition === "right") {
                labelCenterX = point.x + point.r + gap + labelWidth / 2;
              } else if (point.labelPosition === "top") {
                labelCenterY = point.y - point.r - gap - boxHeight / 2;
              } else {
                labelCenterY = point.y + point.r + gap + boxHeight / 2;
              }

              const labelRectX = labelCenterX - labelWidth / 2;
              const labelRectY = labelCenterY - boxHeight / 2;
              const labelY = labelRectY + Math.max(24, (boxHeight - (lines.length - 1) * 16) / 2);
              return (
                <g key={entity.id} className="kg-network__node" onClick={() => setSelectedId(entity.id)}>
                  <circle cx={point.x} cy={point.y} r={point.r + 8} fill={`${palette[entity.elementClass ?? "content"]}22`} />
                  <circle cx={point.x} cy={point.y} r={point.r} fill={palette[entity.elementClass ?? "content"]} className={isActive || isCenter ? "is-active" : ""} />
                  <rect
                    x={labelRectX}
                    y={labelRectY}
                    width={labelWidth}
                    height={boxHeight}
                    rx={18}
                    className={isActive || isCenter ? "kg-network__label-box is-active" : "kg-network__label-box"}
                  />
                  <text x={labelCenterX} y={labelY} textAnchor="middle" className="kg-network__label">
                    {lines.map((line, index) => (
                      <tspan key={`${entity.id}-${index}`} x={labelCenterX} dy={index === 0 ? 0 : 16}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>
      )}

      {selectedEntity ? (
        <div className="graph-detail-stack">
          <section className="card-panel graph-focus-card">
            <div className="graph-focus-card__head">
              <span className="entity-badge">{getLayerLabel(locale, dataset, selectedEntity.elementClass ?? "content").label}</span>
              <h3>{selectedEntity.name}</h3>
            </div>
            <p className="graph-focus-card__intro">{selectedEntity.intro}</p>
            {selectedEntity.tags?.length ? (
              <div className="tag-row">
                {selectedEntity.tags.map((tag) => (
                  <span key={tag} className="source-chip">{tag}</span>
                ))}
              </div>
            ) : null}
            <div className="entity-metrics entity-metrics--light">
              <div className="entity-metrics__item entity-metrics__item--light">
                <strong>{selectedEntity.relatedArticleIds.length}</strong>
                <span>{labels.linkedArticles}</span>
              </div>
              <div className="entity-metrics__item entity-metrics__item--light">
                <strong>{selectedEdges.length}</strong>
                <span>{labels.directRelations}</span>
              </div>
              <div className="entity-metrics__item entity-metrics__item--light">
                <strong>{evidenceRefs.length}</strong>
                <span>{labels.allEvidence}</span>
              </div>
            </div>
          </section>

          <div className="graph-detail-grid">
            <section className="card-panel graph-detail-card graph-detail-card--light">
              <p className="section-kicker">{dict.graph.detailTitle}</p>
              <h4>{dict.graph.relations}</h4>
              <div className="kg-relation-groups">
                {groupedRelations.map((group) => (
                  <div key={group.value} className="kg-relation-group">
                    <strong>{group.label}</strong>
                    <div className="relation-list relation-list--light">
                      {group.items.map((item) => (
                        <div key={`${item.edge.sourceEntityId}-${item.edge.targetEntityId}-${item.edge.relationType}`} className="relation-item relation-item--light">
                          <strong>{item.target.name}</strong>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-panel graph-detail-card graph-detail-card--light">
              <p className="section-kicker">{dict.graph.scorecard}</p>
              <h4>{dict.graph.evidenceMixed}</h4>
              {selectedEntity.scorecard ? (
                <div className="kg-scorecard">
                  {Object.entries(selectedEntity.scorecard).map(([key, value]) => (
                    <div key={key} className="kg-scorecard__row">
                      <span>{labels.scoreLabels[key as keyof typeof labels.scoreLabels]}</span>
                      <div className="kg-scorecard__bar"><i style={{ width: `${(Number(value) / 5) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="evidence-list evidence-list--light">
                {evidenceRefs.map((ref, index) =>
                  ref.kind === "article" && ref.articleId && articleLookup.get(ref.articleId) ? (
                    <Link key={`${ref.kind}-${ref.articleId}-${index}`} href={getArticleHref(locale, articleLookup.get(ref.articleId)!)} className="evidence-link evidence-link--light">
                      <span>{ref.title}</span>
                      <small>{ref.sourceLabel}</small>
                    </Link>
                  ) : ref.url ? (
                    <a key={`${ref.kind}-${ref.title}-${index}`} href={ref.url} target="_blank" rel="noreferrer" className="evidence-link evidence-link--light">
                      <span>{ref.title}</span>
                      <small>{ref.sourceLabel}</small>
                    </a>
                  ) : (
                    <div key={`${ref.kind}-${ref.title}-${index}`} className="evidence-link evidence-link--light">
                      <span>{ref.title}</span>
                      <small>{ref.sourceLabel}</small>
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
