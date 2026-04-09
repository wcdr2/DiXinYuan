"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { entityTypeLabels, getArticleHref, getDictionary } from "@/lib/site";
import type { Article, EntityType, GraphDataset, Locale } from "@/lib/types";

interface GraphExplorerProps {
  locale: Locale;
  dataset: GraphDataset;
  articles: Article[];
}

interface LabelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: "start" | "middle" | "end";
  lines: string[];
  connectorX: number;
  connectorY: number;
}

interface PositionedNode {
  x: number;
  y: number;
  r: number;
  angle: number;
  type: EntityType;
  label: LabelLayout;
}

const VIEWPORT = {
  width: 1080,
  height: 760,
  centerX: 540,
  centerY: 360,
};

const typeOrder: EntityType[] = [
  "policy",
  "enterprise",
  "institution",
  "university",
  "park",
  "project",
  "technology",
  "region",
];

const palette: Record<EntityType, { fill: string; stroke: string; halo: string }> = {
  policy: { fill: "#d4bf7a", stroke: "#f4e1a6", halo: "rgba(212, 191, 122, 0.28)" },
  enterprise: { fill: "#4aa9de", stroke: "#97dcff", halo: "rgba(74, 169, 222, 0.28)" },
  institution: { fill: "#45b8d1", stroke: "#9ae9ff", halo: "rgba(69, 184, 209, 0.26)" },
  university: { fill: "#7c92e8", stroke: "#c8d4ff", halo: "rgba(124, 146, 232, 0.28)" },
  park: { fill: "#63cdbd", stroke: "#aff7ee", halo: "rgba(99, 205, 189, 0.26)" },
  project: { fill: "#2dd2d9", stroke: "#9cfdff", halo: "rgba(45, 210, 217, 0.28)" },
  technology: { fill: "#59d0a2", stroke: "#b9ffe3", halo: "rgba(89, 208, 162, 0.28)" },
  region: { fill: "#5c83d6", stroke: "#bfd2ff", halo: "rgba(92, 131, 214, 0.28)" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatLabelLines(value: string) {
  const compact = String(value ?? "").trim();
  if (!compact) {
    return [""];
  }

  if (/[\u4e00-\u9fa5]/.test(compact)) {
    const normalized = compact.replace(/\s+/g, "");
    if (normalized.length <= 7) {
      return [normalized];
    }

    if (normalized.length <= 12) {
      return [normalized.slice(0, 6), normalized.slice(6)];
    }

    return [normalized.slice(0, 6), `${normalized.slice(6, 11)}…`];
  }

  const words = compact.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 16) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
    if (lines.length === 1) {
      break;
    }
  }

  if (current) {
    lines.push(current);
  }

  const trimmed = lines.slice(0, 2);
  if (trimmed.length === 1 && trimmed[0].length > 18) {
    return [`${trimmed[0].slice(0, 15)}…`];
  }

  if (words.join(" ").length > trimmed.join(" ").length) {
    trimmed[trimmed.length - 1] = `${trimmed[trimmed.length - 1].slice(0, 14)}…`;
  }

  return trimmed;
}

function createLabelLayout(name: string, angle: number, point: { x: number; y: number; r: number }, index: number): LabelLayout {
  const lines = formatLabelLines(name);
  const hasCjk = /[\u4e00-\u9fa5]/.test(lines.join(""));
  const longest = Math.max(...lines.map((line) => line.length), 4);
  const width = clamp(longest * (hasCjk ? 13 : 8.5) + 34, 116, 196);
  const height = 24 + lines.length * 18;
  const outward = point.r + 56 + (Math.abs(index) % 2 === 1 ? 8 : 0);
  const labelX = point.x + Math.cos(angle) * outward;
  const labelY = point.y + Math.sin(angle) * outward;
  const horizontalBias = Math.cos(angle);
  const verticalBias = Math.sin(angle);
  const anchor: LabelLayout["anchor"] = horizontalBias > 0.26 ? "start" : horizontalBias < -0.26 ? "end" : "middle";

  let x =
    anchor === "start" ? labelX + 12 : anchor === "end" ? labelX - width - 12 : labelX - width / 2;
  let y = verticalBias > 0.45 ? labelY + 12 : verticalBias < -0.45 ? labelY - height - 12 : labelY - height / 2;

  x = clamp(x, 28, VIEWPORT.width - width - 28);
  y = clamp(y, 28, VIEWPORT.height - height - 28);

  return {
    x,
    y,
    width,
    height,
    anchor,
    lines,
    connectorX: anchor === "start" ? x : anchor === "end" ? x + width : x + width / 2,
    connectorY: y + height / 2,
  };
}

function getPositions(entities: GraphDataset["entities"]) {
  const grouped = typeOrder
    .map((type) => ({
      type,
      entities: entities
        .filter((entity) => entity.type === type)
        .slice()
        .sort(
          (left, right) =>
            right.relatedArticleIds.length - left.relatedArticleIds.length || left.name.localeCompare(right.name, "zh-CN"),
        ),
    }))
    .filter((group) => group.entities.length > 0);

  const positions: Record<string, PositionedNode> = {};
  const angleStep = (Math.PI * 2) / Math.max(grouped.length, 1);

  grouped.forEach((group, groupIndex) => {
    const baseAngle = -Math.PI / 2 + angleStep * groupIndex;
    const baseRadius = group.entities.length > 2 ? 250 : 290;
    const tangentStep = group.entities.length > 3 ? 72 : 86;

    group.entities.forEach((entity, entityIndex) => {
      const offsetIndex = entityIndex - (group.entities.length - 1) / 2;
      const tangentOffset = offsetIndex * tangentStep;
      const ringOffset = Math.abs(offsetIndex) % 2 === 1 ? 40 : 0;
      const radius = baseRadius + ringOffset + (groupIndex % 2 === 0 ? 0 : 28);
      const x = clamp(
        VIEWPORT.centerX + Math.cos(baseAngle) * radius - Math.sin(baseAngle) * tangentOffset,
        132,
        VIEWPORT.width - 132,
      );
      const y = clamp(
        VIEWPORT.centerY + Math.sin(baseAngle) * radius + Math.cos(baseAngle) * tangentOffset,
        118,
        VIEWPORT.height - 118,
      );
      const r = clamp(22 + entity.relatedArticleIds.length * 2.4, 20, 34);

      positions[entity.id] = {
        x,
        y,
        r,
        angle: baseAngle,
        type: entity.type,
        label: createLabelLayout(entity.name, baseAngle, { x, y, r }, offsetIndex),
      };
    });
  });

  return positions;
}

export function GraphExplorer({ locale, dataset, articles }: GraphExplorerProps) {
  const dict = getDictionary(locale);
  const [activeType, setActiveType] = useState<EntityType | "all">("all");
  const [selectedId, setSelectedId] = useState(dataset.entities[0]?.id ?? "");

  const filteredEntities = useMemo(
    () => dataset.entities.filter((entity) => activeType === "all" || entity.type === activeType),
    [activeType, dataset.entities],
  );

  useEffect(() => {
    if (!filteredEntities.some((entity) => entity.id === selectedId)) {
      setSelectedId(filteredEntities[0]?.id ?? "");
    }
  }, [filteredEntities, selectedId]);

  const selectedEntity =
    filteredEntities.find((entity) => entity.id === selectedId) ?? filteredEntities[0] ?? null;

  const positions = useMemo(() => getPositions(filteredEntities), [filteredEntities]);
  const visibleIds = new Set(filteredEntities.map((entity) => entity.id));
  const visibleEdges = dataset.edges.filter(
    (edge) => visibleIds.has(edge.sourceEntityId) && visibleIds.has(edge.targetEntityId),
  );

  const evidenceArticles = selectedEntity
    ? articles.filter((article) => selectedEntity.relatedArticleIds.includes(article.id)).slice(0, 4)
    : [];

  const relationEdges = selectedEntity
    ? visibleEdges.filter(
        (edge) => edge.sourceEntityId === selectedEntity.id || edge.targetEntityId === selectedEntity.id,
      )
    : [];

  const relationLabels: Record<string, string> = {
    related: locale === "zh" ? "相关联" : "Related",
    guides: locale === "zh" ? "指导" : "Guides",
    drives: locale === "zh" ? "驱动" : "Drives",
    supports: locale === "zh" ? "支撑" : "Supports",
    located_in: locale === "zh" ? "位于" : "Located in",
  };

  const legendTypes = typeOrder.filter((type) => filteredEntities.some((entity) => entity.type === type));
  const statLabels =
    locale === "zh"
      ? { articles: "相关文章", relations: "直接关系", hint: "较窄屏幕下可左右滚动查看完整图谱。" }
      : {
          articles: "Linked articles",
          relations: "Direct relations",
          hint: "Scroll horizontally on narrow screens to inspect the full graph.",
        };

  return (
    <div className="graph-layout graph-layout--enhanced">
      <div className="graph-stage card-panel graph-stage--enhanced">
        <div className="graph-toolbar">
          <div className="filter-row">
            {(["all", ...typeOrder] as Array<EntityType | "all">).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActiveType(option)}
                className={option === activeType ? "filter-chip is-active" : "filter-chip"}
              >
                {option === "all" ? dict.graph.filterAll : entityTypeLabels[locale][option]}
              </button>
            ))}
          </div>
          <div className="graph-stats">
            <span>{filteredEntities.length}</span>
            <small>{locale === "zh" ? "个节点" : "nodes"}</small>
            <span>{visibleEdges.length}</span>
            <small>{locale === "zh" ? "条关系" : "edges"}</small>
          </div>
        </div>
        <p className="graph-hint">{statLabels.hint}</p>
        {filteredEntities.length === 0 ? (
          <p className="empty-state">{dict.graph.empty}</p>
        ) : (
          <>
            <div className="graph-canvas-frame">
              <svg viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`} className="graph-canvas graph-canvas--enhanced graph-canvas--wide" role="img" aria-label={dict.pageIntro.graphTitle}>
                <defs>
                  <radialGradient id="graphCenterGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(93, 229, 249, 0.38)" />
                    <stop offset="100%" stopColor="rgba(93, 229, 249, 0)" />
                  </radialGradient>
                  <filter id="graphGlow" x="0" y="0" width={VIEWPORT.width} height={VIEWPORT.height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <g className="graph-rings" aria-hidden="true">
                  <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="96" />
                  <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="188" />
                  <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="284" />
                  <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="6" fill="url(#graphCenterGlow)" />
                </g>
                {visibleEdges.map((edge) => {
                  const source = positions[edge.sourceEntityId];
                  const target = positions[edge.targetEntityId];
                  if (!source || !target) {
                    return null;
                  }

                  const isActive =
                    edge.sourceEntityId === selectedEntity?.id || edge.targetEntityId === selectedEntity?.id;
                  const controlX = (source.x + target.x) / 2;
                  const controlY = (source.y + target.y) / 2 - (isActive ? 34 : 18);

                  return (
                    <path
                      key={`${edge.sourceEntityId}-${edge.targetEntityId}`}
                      d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
                      className={isActive ? "graph-edge is-active" : "graph-edge"}
                      filter={isActive ? "url(#graphGlow)" : undefined}
                    />
                  );
                })}
                {filteredEntities.map((entity) => {
                  const point = positions[entity.id];
                  const active = entity.id === selectedEntity?.id;
                  const typePalette = palette[entity.type];
                  const labelX =
                    point.label.anchor === "start"
                      ? point.label.x + 16
                      : point.label.anchor === "end"
                        ? point.label.x + point.label.width - 16
                        : point.label.x + point.label.width / 2;
                  const lineStartY = point.label.y + (point.label.height - (point.label.lines.length - 1) * 16) / 2 + 1;

                  return (
                    <g
                      key={entity.id}
                      onClick={() => setSelectedId(entity.id)}
                      className="graph-node-group"
                      role="button"
                      aria-label={entity.name}
                    >
                      <title>{entity.name}</title>
                      <line
                        x1={point.x}
                        y1={point.y}
                        x2={point.label.connectorX}
                        y2={point.label.connectorY}
                        className={active ? "graph-label-guide is-active" : "graph-label-guide"}
                      />
                      <rect
                        x={point.label.x}
                        y={point.label.y}
                        width={point.label.width}
                        height={point.label.height}
                        rx="16"
                        className={active ? "graph-label-card is-active" : "graph-label-card"}
                      />
                      <text x={labelX} y={lineStartY} textAnchor={point.label.anchor} className="graph-label-text">
                        {point.label.lines.map((line, lineIndex) => (
                          <tspan key={`${entity.id}-${lineIndex}`} x={labelX} dy={lineIndex === 0 ? 0 : 16}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.r + (active ? 15 : 11)}
                        fill={typePalette.halo}
                        className={active ? "graph-node-halo is-active" : "graph-node-halo"}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.r}
                        fill={typePalette.fill}
                        stroke={typePalette.stroke}
                        className={active ? "graph-node is-active" : "graph-node"}
                        filter="url(#graphGlow)"
                      />
                      <circle cx={point.x} cy={point.y} r={Math.max(point.r - 8, 8)} className="graph-node-core" />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="graph-legend">
              {legendTypes.map((type) => (
                <span key={type} className={`graph-legend__item graph-legend__item--${type}`}>
                  <i style={{ backgroundColor: palette[type].fill }} aria-hidden="true" />
                  {entityTypeLabels[locale][type]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <aside className="graph-sidebar card-panel graph-sidebar--enhanced">
        {selectedEntity ? (
          <>
            <div className="entity-header entity-header--enhanced">
              <span className={`entity-badge entity-badge--${selectedEntity.type}`}>
                {entityTypeLabels[locale][selectedEntity.type]}
              </span>
              <h3>{selectedEntity.name}</h3>
              <p>{selectedEntity.intro}</p>
            </div>
            <div className="entity-metrics">
              <div className="entity-metrics__item">
                <strong>{selectedEntity.relatedArticleIds.length}</strong>
                <span>{statLabels.articles}</span>
              </div>
              <div className="entity-metrics__item">
                <strong>{relationEdges.length}</strong>
                <span>{statLabels.relations}</span>
              </div>
            </div>
            <section>
              <h4>{dict.graph.relations}</h4>
              <div className="relation-list">
                {relationEdges.map((edge) => {
                  const targetId =
                    edge.sourceEntityId === selectedEntity.id ? edge.targetEntityId : edge.sourceEntityId;
                  const targetEntity = dataset.entities.find((entity) => entity.id === targetId);
                  if (!targetEntity) {
                    return null;
                  }
                  return (
                    <div key={`${edge.sourceEntityId}-${edge.targetEntityId}`} className="relation-item relation-item--enhanced">
                      <strong>{targetEntity.name}</strong>
                      <span>{relationLabels[edge.relationType]}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h4>{dict.graph.evidence}</h4>
              <div className="evidence-list">
                {evidenceArticles.map((article) => (
                  <Link key={article.id} href={getArticleHref(locale, article)} className="evidence-link evidence-link--enhanced">
                    <span>{article.title}</span>
                    <small>{article.sourceName}</small>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p className="empty-state">{dict.graph.empty}</p>
        )}
      </aside>
    </div>
  );
}
