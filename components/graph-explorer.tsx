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
  lines: string[];
  textX: number;
  textStartY: number;
  connectorX: number;
  connectorY: number;
}

interface PositionedNode {
  x: number;
  y: number;
  r: number;
  type: EntityType;
  label: LabelLayout;
}

const VIEWPORT = {
  width: 1480,
  height: 940,
  centerX: 740,
  centerY: 460,
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

const laneLayout: Record<EntityType, { x: number; startY: number; step: number; side: "left" | "right" | "top" }> = {
  policy: { x: 740, startY: 132, step: 90, side: "top" },
  enterprise: { x: 1190, startY: 170, step: 84, side: "right" },
  institution: { x: 1030, startY: 230, step: 84, side: "right" },
  university: { x: 1080, startY: 760, step: 84, side: "right" },
  park: { x: 760, startY: 772, step: 84, side: "top" },
  project: { x: 560, startY: 620, step: 88, side: "left" },
  technology: { x: 400, startY: 260, step: 88, side: "left" },
  region: { x: 250, startY: 170, step: 86, side: "left" },
};

const palette: Record<EntityType, { fill: string; stroke: string; halo: string }> = {
  policy: { fill: "#d4bf7a", stroke: "#f4e1a6", halo: "rgba(212, 191, 122, 0.3)" },
  enterprise: { fill: "#4aa9de", stroke: "#97dcff", halo: "rgba(74, 169, 222, 0.28)" },
  institution: { fill: "#45b8d1", stroke: "#9ae9ff", halo: "rgba(69, 184, 209, 0.28)" },
  university: { fill: "#7c92e8", stroke: "#c8d4ff", halo: "rgba(124, 146, 232, 0.3)" },
  park: { fill: "#63cdbd", stroke: "#aff7ee", halo: "rgba(99, 205, 189, 0.3)" },
  project: { fill: "#2dd2d9", stroke: "#9cfdff", halo: "rgba(45, 210, 217, 0.3)" },
  technology: { fill: "#59d0a2", stroke: "#b9ffe3", halo: "rgba(89, 208, 162, 0.3)" },
  region: { fill: "#5c83d6", stroke: "#bfd2ff", halo: "rgba(92, 131, 214, 0.3)" },
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
    if (normalized.length <= 10) {
      return [normalized];
    }

    if (normalized.length <= 18) {
      return [normalized.slice(0, 9), normalized.slice(9)];
    }

    return [normalized.slice(0, 9), `${normalized.slice(9, 17)}…`];
  }

  const words = compact.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 20) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
    if (lines.length >= 1) {
      break;
    }
  }

  if (current) {
    lines.push(current);
  }

  const trimmed = lines.slice(0, 2);
  if (words.join(" ").length > trimmed.join(" ").length) {
    trimmed[trimmed.length - 1] = `${trimmed[trimmed.length - 1].slice(0, 17)}…`;
  }

  return trimmed;
}

function createLabelLayout(name: string, point: { x: number; y: number }, side: "left" | "right" | "top") {
  const lines = formatLabelLines(name);
  const hasCjk = /[\u4e00-\u9fa5]/.test(lines.join(""));
  const longest = Math.max(...lines.map((line) => line.length), 4);
  const width = clamp(longest * (hasCjk ? 13 : 8.4) + 30, 124, 230);
  const height = 22 + lines.length * 18;

  let x = side === "left" ? point.x - width - 24 : side === "right" ? point.x + 24 : point.x - width / 2;
  let y = side === "top" ? point.y - height - 34 : point.y - height / 2;

  x = clamp(x, 24, VIEWPORT.width - width - 24);
  y = clamp(y, 20, VIEWPORT.height - height - 20);

  const textX = x + 14;
  const textStartY = y + (height - (lines.length * 16 - 2)) / 2 + 11;

  return {
    x,
    y,
    width,
    height,
    lines,
    textX,
    textStartY,
    connectorX: side === "left" ? x + width : side === "right" ? x : x + width / 2,
    connectorY: side === "top" ? y + height : y + height / 2,
  };
}

function getPositions(entities: GraphDataset["entities"]) {
  const positions: Record<string, PositionedNode> = {};

  typeOrder.forEach((type) => {
    const lane = laneLayout[type];
    const list = entities
      .filter((entity) => entity.type === type)
      .slice()
      .sort(
        (left, right) =>
          right.relatedArticleIds.length - left.relatedArticleIds.length || left.name.localeCompare(right.name, "zh-CN"),
      );

    list.forEach((entity, index) => {
      const x = clamp(lane.x + (index % 2 === 0 ? 0 : 8), 160, VIEWPORT.width - 160);
      const y = clamp(lane.startY + index * lane.step, 90, VIEWPORT.height - 90);
      const r = clamp(14 + entity.relatedArticleIds.length * 1.15, 14, 24);

      positions[entity.id] = {
        x,
        y,
        r,
        type,
        label: createLabelLayout(entity.name, { x, y }, lane.side),
      };
    });
  });

  return positions;
}

export function GraphExplorer({ locale, dataset, articles }: GraphExplorerProps) {
  const dict = getDictionary(locale);
  const [activeType, setActiveType] = useState<EntityType | "all">("all");
  const [selectedId, setSelectedId] = useState(
    dataset.entities.find((entity) => entity.id === "gis-platform")?.id ?? dataset.entities[0]?.id ?? "",
  );
  const [showAllEdges, setShowAllEdges] = useState(false);

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

  const relationEdges = selectedEntity
    ? visibleEdges.filter(
        (edge) => edge.sourceEntityId === selectedEntity.id || edge.targetEntityId === selectedEntity.id,
      )
    : [];

  const displayedEdges = showAllEdges || !selectedEntity ? visibleEdges : relationEdges;
  const relationNodeIds = new Set<string>();
  relationEdges.forEach((edge) => {
    relationNodeIds.add(edge.sourceEntityId);
    relationNodeIds.add(edge.targetEntityId);
  });

  const evidenceArticles = selectedEntity
    ? articles.filter((article) => selectedEntity.relatedArticleIds.includes(article.id)).slice(0, 6)
    : [];

  const relationLabels: Record<string, string> = {
    related: locale === "zh" ? "协同连接" : "Related",
    guides: locale === "zh" ? "政策引导" : "Guides",
    drives: locale === "zh" ? "产业驱动" : "Drives",
    supports: locale === "zh" ? "技术支撑" : "Supports",
    located_in: locale === "zh" ? "空间落位" : "Located in",
  };

  const legendTypes = typeOrder.filter((type) => filteredEntities.some((entity) => entity.type === type));
  const detailLabels =
    locale === "zh"
      ? {
          hint: "默认只显示当前节点关系；可切换为显示全部关系。",
          overview: "实体概览",
          relations: "关联关系",
          evidence: "证据文章",
          articles: "关联文章",
          edges: "直接关系",
          focus: "仅看当前关联",
          allEdges: "显示全部关系",
        }
      : {
          hint: "By default only relations of the selected node are rendered. You can switch to all edges.",
          overview: "Entity overview",
          relations: "Relations",
          evidence: "Evidence",
          articles: "Linked articles",
          edges: "Direct relations",
          focus: "Focus selected",
          allEdges: "Show all edges",
        };

  return (
    <div className="graph-layout graph-layout--stacked">
      <section className="graph-stage card-panel graph-stage--enhanced graph-stage--stacked">
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
          <div className="graph-toolbar__controls">
            <button
              type="button"
              onClick={() => setShowAllEdges((previous) => !previous)}
              className={showAllEdges ? "filter-chip is-active" : "filter-chip"}
            >
              {showAllEdges ? detailLabels.allEdges : detailLabels.focus}
            </button>
          </div>
          <div className="graph-stats">
            <span>{filteredEntities.length}</span>
            <small>{locale === "zh" ? "个节点" : "nodes"}</small>
            <span>{displayedEdges.length}</span>
            <small>{locale === "zh" ? "条关系" : "edges"}</small>
          </div>
        </div>

        <p className="graph-hint">{detailLabels.hint}</p>

        <div className="graph-canvas-frame">
          <svg
            viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
            className="graph-canvas graph-canvas--enhanced graph-canvas--wide"
            role="img"
            aria-label={dict.pageIntro.graphTitle}
          >
            <defs>
              <radialGradient id="graphCenterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(93, 229, 249, 0.34)" />
                <stop offset="100%" stopColor="rgba(93, 229, 249, 0)" />
              </radialGradient>
              <filter
                id="graphGlow"
                x="0"
                y="0"
                width={VIEWPORT.width}
                height={VIEWPORT.height}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g className="graph-rings" aria-hidden="true">
              <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="118" />
              <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="238" />
              <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="352" />
              <circle cx={VIEWPORT.centerX} cy={VIEWPORT.centerY} r="8" fill="url(#graphCenterGlow)" />
            </g>

            {displayedEdges.map((edge) => {
              const source = positions[edge.sourceEntityId];
              const target = positions[edge.targetEntityId];
              if (!source || !target) {
                return null;
              }

              const isActive =
                edge.sourceEntityId === selectedEntity?.id || edge.targetEntityId === selectedEntity?.id;
              const ctrlX = (source.x + target.x) / 2;
              const bend = Math.abs(source.x - target.x) > 320 ? 64 : 34;
              const c1y = source.y + (source.y < target.y ? bend : -bend);
              const c2y = target.y + (source.y < target.y ? -bend : bend);

              return (
                <path
                  key={`${edge.sourceEntityId}-${edge.targetEntityId}`}
                  d={`M ${source.x} ${source.y} C ${ctrlX} ${c1y} ${ctrlX} ${c2y} ${target.x} ${target.y}`}
                  className={
                    showAllEdges && selectedEntity && !isActive ? "graph-edge is-muted" : isActive ? "graph-edge is-active" : "graph-edge"
                  }
                  filter={isActive ? "url(#graphGlow)" : undefined}
                />
              );
            })}

            {filteredEntities.map((entity) => {
              const point = positions[entity.id];
              if (!point) {
                return null;
              }

              const active = entity.id === selectedEntity?.id;
              const typePalette = palette[entity.type];
              const dimmed = selectedEntity && !showAllEdges && !relationNodeIds.has(entity.id);

              return (
                <g
                  key={entity.id}
                  onClick={() => setSelectedId(entity.id)}
                  className={dimmed ? "graph-node-group is-dimmed" : "graph-node-group"}
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
                    rx="14"
                    className={active ? "graph-label-card is-active" : "graph-label-card"}
                  />
                  <text x={point.label.textX} y={point.label.textStartY} textAnchor="start" className="graph-label-text">
                    {point.label.lines.map((line, lineIndex) => (
                      <tspan key={`${entity.id}-${lineIndex}`} x={point.label.textX} dy={lineIndex === 0 ? 0 : 16}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={point.r + (active ? 13 : 9)}
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
                  <circle cx={point.x} cy={point.y} r={Math.max(point.r - 7, 7)} className="graph-node-core" />
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
      </section>

      {selectedEntity ? (
        <div className="graph-detail-stack">
          <section className="card-panel graph-focus-card">
            <div className="graph-focus-card__head">
              <span className={`entity-badge entity-badge--${selectedEntity.type}`}>
                {entityTypeLabels[locale][selectedEntity.type]}
              </span>
              <h3>{selectedEntity.name}</h3>
            </div>
            <p className="graph-focus-card__intro">{selectedEntity.intro}</p>
            <div className="entity-metrics entity-metrics--light">
              <div className="entity-metrics__item entity-metrics__item--light">
                <strong>{selectedEntity.relatedArticleIds.length}</strong>
                <span>{detailLabels.articles}</span>
              </div>
              <div className="entity-metrics__item entity-metrics__item--light">
                <strong>{relationEdges.length}</strong>
                <span>{detailLabels.edges}</span>
              </div>
            </div>
          </section>

          <div className="graph-detail-grid">
            <section className="card-panel graph-detail-card graph-detail-card--light">
              <p className="section-kicker">{detailLabels.overview}</p>
              <h4>{detailLabels.relations}</h4>
              <div className="relation-list relation-list--light">
                {relationEdges.map((edge) => {
                  const targetId = edge.sourceEntityId === selectedEntity.id ? edge.targetEntityId : edge.sourceEntityId;
                  const targetEntity = dataset.entities.find((entity) => entity.id === targetId);
                  if (!targetEntity) {
                    return null;
                  }

                  return (
                    <div key={`${edge.sourceEntityId}-${edge.targetEntityId}`} className="relation-item relation-item--light">
                      <strong>{targetEntity.name}</strong>
                      <span>{relationLabels[edge.relationType]}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card-panel graph-detail-card graph-detail-card--light">
              <p className="section-kicker">{detailLabels.evidence}</p>
              <h4>{dict.graph.evidence}</h4>
              <div className="evidence-list evidence-list--light">
                {evidenceArticles.map((article) => (
                  <Link key={article.id} href={getArticleHref(locale, article)} className="evidence-link evidence-link--light">
                    <span>{article.title}</span>
                    <small>{article.sourceName}</small>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
