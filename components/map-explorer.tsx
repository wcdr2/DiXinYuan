"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArticleCard } from "@/components/article-card";
import {
  buildBMapPoint,
  fetchDistrictBoundaries,
  loadBaiduMapGL,
  type BMapGLNamespace,
  type BMapLabelLike,
  type BMapMapLike,
  type BMapPolygonLike,
} from "@/lib/baidu-map";
import { withLocale } from "@/lib/site";
import type { Article, Locale, MapDataset, MapMode, MapRegion } from "@/lib/types";

interface MapExplorerProps {
  locale: Locale;
  dataset: MapDataset;
  articles: Article[];
  initialRegionId?: string;
  initialMode?: MapMode;
}

interface RegionOverlayEntry {
  polygons: BMapPolygonLike[];
  label: BMapLabelLike | null;
  focusCenter: [number, number];
}

const modeOrder: MapMode[] = ["all", "enterprise", "technology", "policy"];
const modePalette = {
  all: {
    fill: "#6ce5f1",
    stroke: "#bfe6ff",
    chip: "map-mode-chip--all",
    glow: "rgba(108, 229, 241, 0.24)",
  },
  enterprise: {
    fill: "#7bd2ff",
    stroke: "#cfeeff",
    chip: "map-mode-chip--enterprise",
    glow: "rgba(123, 210, 255, 0.22)",
  },
  technology: {
    fill: "#7aecd3",
    stroke: "#d6fff2",
    chip: "map-mode-chip--technology",
    glow: "rgba(122, 236, 211, 0.22)",
  },
  policy: {
    fill: "#ecd79d",
    stroke: "#fff1ba",
    chip: "map-mode-chip--policy",
    glow: "rgba(236, 215, 157, 0.2)",
  },
} as const;

const runtimeLabels = {
  zh: {
    all: "综合",
    enterprise: "企业",
    technology: "技术",
    policy: "政策",
    regionCoverage: "覆盖区域",
    reset: "返回广西总览",
    trend: "当前观察",
    ranking: "重点区域排序",
    legend: "热度分级",
    totalArticles: "关联文章",
    subjectCount: "主体节点",
    latestArticles: "最新相关文章",
    keywords: "高频关键词",
    noKeywords: "当前区域暂无稳定关键词。",
    noArticles: "当前区域暂无可展示的相关文章。",
    openNews: "查看该城市新闻",
    openGraph: "查看该城市图谱",
    cityRegion: "城市单元",
    mapTip: "悬停查看核心指标，点击锁定区域详情。",
    coverage: "百度真实矢量底图 + 广西 14 市联动分析",
    total: "总量",
    enterpriseShort: "企业",
    technologyShort: "技术",
    policyShort: "政策",
    loading: "正在加载百度真实地图与行政区边界...",
    setupTitle: "地图尚未完成本地接入",
    setupBody: "请在 `.env.local` 中填写 `NEXT_PUBLIC_BAIDU_MAP_AK`，并在百度地图控制台的 Referer 白名单中写入 `localhost,127.0.0.1`。",
    setupReferer: "Referer 白名单建议：localhost,127.0.0.1",
    errorTitle: "地图加载失败",
    errorBody: "请检查 AK 是否为浏览器端 JavaScript API AK，并确认 Referer 白名单已包含 localhost 或 127.0.0.1。",
    liveMap: "百度真实地图",
    noBoundary: "部分城市边界未成功返回，已跳过对应高亮。",
    baseLayer: "真实底图",
    overview: "广西总览",
  },
  en: {
    all: "All",
    enterprise: "Enterprise",
    technology: "Technology",
    policy: "Policy",
    regionCoverage: "Coverage",
    reset: "Back to Guangxi overview",
    trend: "Current spotlight",
    ranking: "Priority regions",
    legend: "Legend",
    totalArticles: "Articles",
    subjectCount: "Subject nodes",
    latestArticles: "Latest linked articles",
    keywords: "Keyword highlights",
    noKeywords: "No stable keywords yet for this region.",
    noArticles: "No related articles are available for this region yet.",
    openNews: "Open city news",
    openGraph: "Open city graph",
    cityRegion: "City unit",
    mapTip: "Hover to inspect metrics and click to lock the region detail.",
    coverage: "Baidu vector basemap + Guangxi's 14 city-level analytical view",
    total: "Total",
    enterpriseShort: "Enterprise",
    technologyShort: "Technology",
    policyShort: "Policy",
    loading: "Loading the Baidu basemap and district boundaries...",
    setupTitle: "The live map is not configured yet",
    setupBody: "Add `NEXT_PUBLIC_BAIDU_MAP_AK` to `.env.local`, then set the Baidu Map Referer whitelist to `localhost,127.0.0.1`.",
    setupReferer: "Recommended Referer whitelist: localhost,127.0.0.1",
    errorTitle: "Map failed to load",
    errorBody: "Check whether the AK is a browser JavaScript API key and whether the Referer whitelist contains localhost or 127.0.0.1.",
    liveMap: "Baidu live map",
    noBoundary: "Some city boundaries were not returned and were skipped.",
    baseLayer: "Live basemap",
    overview: "Guangxi overview",
  },
} as const;

const labels = {
  zh: {
    all: "综合",
    enterprise: "企业",
    technology: "技术",
    policy: "政策",
    regionCoverage: "覆盖区域",
    reset: "返回广西总览",
    trend: "当前观察",
    ranking: "重点区域排序",
    legend: "热度分级",
    totalArticles: "关联文章",
    subjectCount: "主体节点",
    latestArticles: "最新相关新闻",
    keywords: "高频关键词",
    noKeywords: "当前区域暂无稳定关键词。",
    noArticles: "当前区域暂无可展示的相关新闻。",
    openNews: "查看该城市新闻",
    openGraph: "查看该城市图谱",
    specialRegion: "专题区域",
    cityRegion: "城市单元",
    mapTip: "悬停查看核心指标，点击锁定区域详情。",
    coverage: "百度真实矢量底图 + 广西 14 市 + 北部湾专题联动",
    total: "总量",
    enterpriseShort: "企业",
    technologyShort: "技术",
    policyShort: "政策",
    beibuFocus: "北部湾专题",
    loading: "正在加载百度真实地图与行政区边界…",
    setupTitle: "地图尚未完成本地接入",
    setupBody: "请在 `.env.local` 中填写 `NEXT_PUBLIC_BAIDU_MAP_AK`，并在百度地图控制台的 Referer 白名单中填写 `localhost,127.0.0.1`。",
    setupReferer: "Referer 白名单建议：localhost,127.0.0.1",
    errorTitle: "地图加载失败",
    errorBody: "请检查 AK 是否为浏览器端 JavaScript API AK，并确认 Referer 白名单已包含 localhost 或 127.0.0.1。",
    liveMap: "百度真实地图",
    noBoundary: "部分城市边界未成功返回，已跳过对应高亮。",
    baseLayer: "真实底图",
    overview: "广西总览",
  },
  en: {
    all: "All",
    enterprise: "Enterprise",
    technology: "Technology",
    policy: "Policy",
    regionCoverage: "Coverage",
    reset: "Back to Guangxi overview",
    trend: "Current spotlight",
    ranking: "Priority regions",
    legend: "Legend",
    totalArticles: "Articles",
    subjectCount: "Subject nodes",
    latestArticles: "Latest linked articles",
    keywords: "Keyword highlights",
    noKeywords: "No stable keywords yet for this region.",
    noArticles: "No related articles are available for this region yet.",
    openNews: "Open city news",
    openGraph: "Open city graph",
    specialRegion: "Special region",
    cityRegion: "City unit",
    mapTip: "Hover to inspect metrics and click to lock the region detail.",
    coverage: "Baidu vector basemap + 14 Guangxi cities + Beibu Gulf thematic linkage",
    total: "Total",
    enterpriseShort: "Enterprise",
    technologyShort: "Technology",
    policyShort: "Policy",
    beibuFocus: "Beibu Gulf",
    loading: "Loading the Baidu basemap and district boundaries…",
    setupTitle: "The live map is not configured yet",
    setupBody: "Add `NEXT_PUBLIC_BAIDU_MAP_AK` to `.env.local`, then set the Baidu Map Referer whitelist to `localhost,127.0.0.1`.",
    setupReferer: "Recommended Referer whitelist: localhost,127.0.0.1",
    errorTitle: "Map failed to load",
    errorBody: "Check whether the AK is a browser JavaScript API key and whether the Referer whitelist contains localhost or 127.0.0.1.",
    liveMap: "Baidu live map",
    noBoundary: "Some city boundaries were not returned and were skipped.",
    baseLayer: "Live basemap",
    overview: "Guangxi overview",
  },
} as const;

const baseCityOpacity = 0.2;
const provinceCenter: [number, number] = [108.8, 23.6];
const provinceZoom = 8;

function parseBoundaryPath(boundary: string) {
  return boundary
    .split(";")
    .map((point) => point.trim())
    .filter(Boolean)
    .map((point) => point.split(","))
    .map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function getBoundaryCenter(boundaries: string[]) {
  const points = boundaries.flatMap(parseBoundaryPath);
  if (points.length === 0) {
    return null;
  }

  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number];
}

function getRegionLabel(locale: Locale, region: MapRegion) {
  return locale === "zh" ? region.name : region.nameEn;
}

function getModeLabel(locale: Locale, mode: MapMode) {
  return labels[locale][mode];
}

function getMetric(region: MapRegion, mode: MapMode) {
  if (mode === "all") {
    return region.articleCount;
  }
  return region.categoryCounts[mode];
}

function buildNewsHref(locale: Locale, region: MapRegion) {
  return withLocale(locale, `/news?region=${region.id}&guangxi=only`);
}

function buildGraphHref(locale: Locale, region: MapRegion) {
  return region.graphRegionId
    ? withLocale(locale, `/knowledge-graph?region=${region.graphRegionId}`)
    : withLocale(locale, "/knowledge-graph");
}

function getRegionFillOpacity(region: MapRegion, mode: MapMode, maxValue: number, emphasized: boolean) {
  const current = getMetric(region, mode);
  if (maxValue <= 0 || current <= 0) {
    return emphasized ? 0.44 : baseCityOpacity;
  }

  const ratio = Math.min(1, current / maxValue);
  const opacity = baseCityOpacity + ratio * 0.42 + (emphasized ? 0.16 : 0);
  return Math.max(baseCityOpacity, Math.min(0.82, opacity));
}

function getPolygonStyle(region: MapRegion, mode: MapMode, maxValue: number, emphasized: boolean) {
  const palette = modePalette[mode];
  return {
    fillColor: palette.fill,
    fillOpacity: getRegionFillOpacity(region, mode, maxValue, emphasized),
    strokeColor: emphasized ? "#ffffff" : palette.stroke,
    strokeOpacity: emphasized ? 0.96 : 0.74,
    strokeWeight: emphasized ? 4 : 2,
  };
}

function getLabelStyles(emphasized: boolean) {
  return {
    color: emphasized ? "#ffffff" : "rgba(244, 250, 255, 0.92)",
    fontSize: emphasized ? "14px" : "13px",
    fontWeight: emphasized ? "800" : "700",
    padding: emphasized ? "8px 14px" : "7px 12px",
    borderRadius: "999px",
    border: emphasized ? "1px solid rgba(255, 255, 255, 0.82)" : "1px solid rgba(120, 210, 255, 0.46)",
    background: emphasized ? "rgba(8, 18, 36, 0.9)" : "rgba(8, 18, 36, 0.78)",
    boxShadow: emphasized ? "0 0 24px rgba(108, 229, 241, 0.18)" : "none",
    whiteSpace: "nowrap",
    lineHeight: "1.2",
    fontFamily: "inherit",
    textAlign: "center",
    transform: "translate(-50%, -50%)",
    transformOrigin: "center",
  };
}

export function MapExplorer({
  locale,
  dataset,
  articles,
  initialRegionId,
  initialMode = "all",
}: MapExplorerProps) {
  if (dataset.regions.length === 0) {
    return null;
  }

  const copy = runtimeLabels[locale];
  const ak = process.env.NEXT_PUBLIC_BAIDU_MAP_AK ?? "";
  const styleId = process.env.NEXT_PUBLIC_BAIDU_MAP_STYLE_ID ?? "";
  const cityRegions = useMemo(() => dataset.regions, [dataset.regions]);
  const articleLookup = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const regionLookup = useMemo(() => new Map(dataset.regions.map((region) => [region.id, region])), [dataset.regions]);
  const defaultRegionId = useMemo(() => {
    const ranked = [...dataset.regions].sort(
      (left, right) =>
        Number(right.isPriorityRegion) - Number(left.isPriorityRegion) ||
        right.articleCount - left.articleCount ||
        left.name.localeCompare(right.name, "zh-CN"),
    );
    return ranked[0]?.id ?? dataset.regions[0]?.id ?? "";
  }, [dataset.regions]);

  const initialSelectedRegion =
    (initialRegionId && regionLookup.has(initialRegionId) ? initialRegionId : "") || defaultRegionId;

  const [mode, setMode] = useState<MapMode>(modeOrder.includes(initialMode) ? initialMode : "all");
  const [selectedRegionId, setSelectedRegionId] = useState(initialSelectedRegion);
  const [hoveredRegionId, setHoveredRegionId] = useState("");
  const [isOverviewMode, setIsOverviewMode] = useState(!Boolean(initialRegionId && regionLookup.has(initialRegionId)));
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState("");
  const [boundaryFailureCount, setBoundaryFailureCount] = useState(0);
  const [focusNonce, setFocusNonce] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<BMapMapLike | null>(null);
  const bmapRef = useRef<BMapGLNamespace | null>(null);
  const overlayRegistryRef = useRef<Map<string, RegionOverlayEntry>>(new Map());

  const selectedRegion = regionLookup.get(selectedRegionId) ?? dataset.regions[0];
  const hoveredRegion = hoveredRegionId ? regionLookup.get(hoveredRegionId) ?? null : null;
  const spotlightRegion = hoveredRegion ?? selectedRegion;
  const activeLegend = dataset.legend.find((item) => item.mode === mode);
  const maxValue = Math.max(...dataset.regions.map((region) => getMetric(region, mode)), 0);
  const relatedArticles = (selectedRegion.latestArticleIds ?? [])
    .map((articleId) => articleLookup.get(articleId))
    .filter((article): article is Article => Boolean(article));
  const topRegions = useMemo(
    () =>
      [...dataset.regions].sort(
        (left, right) =>
          Number(right.isPriorityRegion) - Number(left.isPriorityRegion) ||
          getMetric(right, mode) - getMetric(left, mode) ||
          right.articleCount - left.articleCount ||
          left.name.localeCompare(right.name, "zh-CN"),
      ),
    [dataset.regions, mode],
  );
  const overviewMetric = useMemo(
    () => cityRegions.reduce((total, region) => total + getMetric(region, mode), 0),
    [cityRegions, mode],
  );
  const stageTitle = hoveredRegion
    ? getRegionLabel(locale, hoveredRegion)
    : isOverviewMode
      ? copy.overview
      : getRegionLabel(locale, selectedRegion);
  const stageMetric = hoveredRegion ? getMetric(hoveredRegion, mode) : isOverviewMode ? overviewMetric : getMetric(selectedRegion, mode);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!ak) {
      setMapReady(false);
      setMapLoadError("");
      return;
    }

    let disposed = false;
    setMapLoadError("");
    setBoundaryFailureCount(0);

    const initializeMap = async () => {
      try {
        const BMapGL = await loadBaiduMapGL(ak);
        if (disposed || !mapContainerRef.current) {
          return;
        }

        bmapRef.current = BMapGL;
        const map = new BMapGL.Map(mapContainerRef.current);
        mapRef.current = map;
        map.centerAndZoom(buildBMapPoint(BMapGL, provinceCenter), provinceZoom);
        map.enableScrollWheelZoom(false);
        map.setMinZoom?.(7);
        map.setMaxZoom?.(12);
        map.setCurrentCity?.("南宁");
        map.addControl(new BMapGL.ScaleControl());
        map.addControl(new BMapGL.ZoomControl());
        if (styleId) {
          map.setMapStyleV2?.({ styleId });
        }

        overlayRegistryRef.current.clear();
        let failures = 0;

        const boundaryResults = await Promise.all(
          cityRegions.map(async (region) => {
            try {
              const candidateNames = [...new Set([region.bdDistrictName, region.name].filter((value): value is string => Boolean(value)))];
              let boundaries: string[] = [];

              for (const districtName of candidateNames) {
                try {
                  boundaries = await fetchDistrictBoundaries(BMapGL, districtName);
                  if (boundaries.length > 0) {
                    break;
                  }
                } catch {
                  continue;
                }
              }

              if (boundaries.length === 0) {
                throw new Error(`No boundaries found for ${region.name}`);
              }

              return { region, boundaries };
            } catch {
              failures += 1;
              return { region, boundaries: [] as string[] };
            }
          }),
        );

        if (disposed) {
          return;
        }

        boundaryResults.forEach(({ region, boundaries }) => {
          if (boundaries.length === 0) {
            return;
          }

          const polygons = boundaries.map((boundary) => {
            const polygon = new BMapGL.Polygon(boundary, {
              strokeColor: modePalette.all.stroke,
              strokeWeight: 2,
              strokeOpacity: 0.74,
              fillColor: modePalette.all.fill,
              fillOpacity: 0.24,
            });

            polygon.addEventListener("mouseover", () => setHoveredRegionId(region.id));
            polygon.addEventListener("mouseout", () => setHoveredRegionId(""));
            polygon.addEventListener("click", () => {
              setSelectedRegionId(region.id);
              setIsOverviewMode(false);
              setFocusNonce((value) => value + 1);
            });
            map.addOverlay(polygon);
            return polygon;
          });

          const focusCenter = getBoundaryCenter(boundaries) ?? region.center;

          const label = new BMapGL.Label(getRegionLabel(locale, region), {
            position: buildBMapPoint(BMapGL, focusCenter),
            offset: new BMapGL.Size(0, 0),
          });
          label.setStyle?.(getLabelStyles(false));
          label.addEventListener("mouseover", () => setHoveredRegionId(region.id));
          label.addEventListener("mouseout", () => setHoveredRegionId(""));
          label.addEventListener("click", () => {
            setSelectedRegionId(region.id);
            setIsOverviewMode(false);
            setFocusNonce((value) => value + 1);
          });
          map.addOverlay(label);

          overlayRegistryRef.current.set(region.id, { polygons, label, focusCenter });
        });

        setBoundaryFailureCount(failures);
        setMapReady(true);
      } catch {
        if (!disposed) {
          setMapReady(false);
          setMapLoadError(copy.errorBody);
        }
      }
    };

    void initializeMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        overlayRegistryRef.current.forEach((entry) => {
          entry.polygons.forEach((polygon) => mapRef.current?.removeOverlay(polygon));
          if (entry.label) {
            mapRef.current?.removeOverlay(entry.label);
          }
        });
        mapRef.current.clearOverlays?.();
      }

      overlayRegistryRef.current.clear();
      mapRef.current = null;
      bmapRef.current = null;
      setMapReady(false);
    };
  }, [ak, cityRegions, copy.errorBody, copy.setupBody, locale, regionLookup, styleId]);

  useEffect(() => {
    overlayRegistryRef.current.forEach((entry, regionId) => {
      const region = regionLookup.get(regionId);
      if (!region) {
        return;
      }

      const isHovered = hoveredRegionId === regionId;
      const isSelected = !isOverviewMode && selectedRegionId === regionId;
      const emphasized = isHovered || isSelected;
      const polygonStyle = getPolygonStyle(region, mode, maxValue, emphasized);

      entry.polygons.forEach((polygon) => {
        polygon.setFillColor?.(polygonStyle.fillColor);
        polygon.setFillOpacity?.(polygonStyle.fillOpacity);
        polygon.setStrokeColor?.(polygonStyle.strokeColor);
        polygon.setStrokeWeight?.(polygonStyle.strokeWeight);
        polygon.setStrokeOpacity?.(polygonStyle.strokeOpacity);
      });

      entry.label?.setStyle?.(getLabelStyles(emphasized));
    });
  }, [hoveredRegionId, isOverviewMode, maxValue, mode, regionLookup, selectedRegionId]);

  useEffect(() => {
    const map = mapRef.current;
    const BMapGL = bmapRef.current;

    if (!map || !BMapGL) {
      return;
    }

    if (isOverviewMode) {
      map.centerAndZoom(buildBMapPoint(BMapGL, provinceCenter), provinceZoom);
      return;
    }

    const focusCenter = overlayRegistryRef.current.get(selectedRegion.id)?.focusCenter ?? selectedRegion.center;
    map.centerAndZoom(buildBMapPoint(BMapGL, focusCenter), selectedRegion.zoom ?? provinceZoom);
  }, [focusNonce, isOverviewMode, selectedRegion]);

  return (
    <div className="map-module">
      <section className="card-panel map-toolbar">
        <div className="map-toolbar__row">
          <div>
            <p className="section-kicker">{copy.trend}</p>
            <h2>{stageTitle}</h2>
            <p className="panel-note">
              {isOverviewMode && !hoveredRegion ? copy.regionCoverage : copy.cityRegion}
            </p>
          </div>
          <div className="map-toolbar__actions">
            <div className="filter-row">
              {modeOrder.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    mode === value
                      ? `filter-chip is-active ${modePalette[value].chip}`
                      : `filter-chip ${modePalette[value].chip}`
                  }
                  onClick={() => setMode(value)}
                >
                  {getModeLabel(locale, value)}
                </button>
              ))}
            </div>
            <div className="map-toolbar__secondary">
              <button
                type="button"
                className="button-secondary button-secondary--ghost"
                onClick={() => {
                  setHoveredRegionId("");
                  setIsOverviewMode(true);
                  setFocusNonce((value) => value + 1);
                }}
              >
                {copy.reset}
              </button>
            </div>
          </div>
        </div>
        <div className="map-toolbar__meta">
          <p>{copy.mapTip}</p>
          <span>{copy.coverage}</span>
        </div>
      </section>

      <div className="map-layout">
        <section className="card-panel map-stage">
          <div className="map-stage__topline">
            <div>
              <p className="section-kicker">{copy.regionCoverage}</p>
              <h3>{stageTitle}</h3>
            </div>
            <div className="map-stage__spotlight">
              <strong>{stageMetric}</strong>
              <span>{getModeLabel(locale, mode)}</span>
            </div>
          </div>

          <div className="map-stage__frame map-stage__frame--live">
            <div className="map-stage__live-badge">
              <span>{copy.liveMap}</span>
              <small>{copy.baseLayer}</small>
            </div>
            <div ref={mapContainerRef} className="gx-map__canvas" aria-label={locale === "zh" ? "广西真实地图" : "Guangxi live map"} />

            {!ak ? (
              <div className="map-stage__status">
                <strong>{copy.setupTitle}</strong>
                <p>{copy.setupBody}</p>
                <span>{copy.setupReferer}</span>
              </div>
            ) : null}

            {ak && !mapReady && !mapLoadError ? (
              <div className="map-stage__status">
                <strong>{copy.loading}</strong>
              </div>
            ) : null}

            {mapLoadError ? (
              <div className="map-stage__status map-stage__status--error">
                <strong>{copy.errorTitle}</strong>
                <p>{mapLoadError}</p>
                <span>{copy.setupReferer}</span>
              </div>
            ) : null}
          </div>

          {boundaryFailureCount > 0 ? <p className="map-stage__note">{copy.noBoundary}</p> : null}

          <div className="map-legend">
            <p className="section-kicker">{copy.legend}</p>
            <div className="map-legend__items">
              {activeLegend?.ranges.map((range) => (
                <div key={`${range.min}-${range.max}`} className="map-legend__item">
                  <i style={{ background: range.color }} />
                  <span>{locale === "zh" ? range.labelZh : range.labelEn}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="map-ranking">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{copy.ranking}</p>
                <h3>{getModeLabel(locale, mode)}</h3>
              </div>
            </div>
            <div className="map-ranking__list">
              {topRegions.slice(0, 8).map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className={!isOverviewMode && region.id === selectedRegion.id ? "map-ranking__item is-active" : "map-ranking__item"}
                  onClick={() => {
                    setSelectedRegionId(region.id);
                    setIsOverviewMode(false);
                    setFocusNonce((value) => value + 1);
                  }}
                >
                  <strong>{getRegionLabel(locale, region)}</strong>
                  <span>{getMetric(region, mode)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="card-panel map-detail">
          <div className="map-detail__header">
            <span className="entity-badge">{copy.cityRegion}</span>
            <h3>{getRegionLabel(locale, selectedRegion)}</h3>
            <p>{locale === "zh" ? selectedRegion.summary : selectedRegion.summaryEn}</p>
          </div>

          <div className="map-detail__metrics">
            <div className="map-stat-card">
              <span>{copy.total}</span>
              <strong>{selectedRegion.articleCount}</strong>
            </div>
            <div className="map-stat-card">
              <span>{copy.enterpriseShort}</span>
              <strong>{selectedRegion.categoryCounts.enterprise}</strong>
            </div>
            <div className="map-stat-card">
              <span>{copy.technologyShort}</span>
              <strong>{selectedRegion.categoryCounts.technology}</strong>
            </div>
            <div className="map-stat-card">
              <span>{copy.policyShort}</span>
              <strong>{selectedRegion.categoryCounts.policy}</strong>
            </div>
          </div>

          <div className="map-detail__metric-line">
            <span>{copy.subjectCount}</span>
            <strong>{selectedRegion.subjectEntityCount}</strong>
          </div>

          <div className="map-detail__actions">
            <Link href={buildNewsHref(locale, selectedRegion)} className="button-primary">
              {copy.openNews}
            </Link>
            <Link href={buildGraphHref(locale, selectedRegion)} className="button-secondary">
              {copy.openGraph}
            </Link>
          </div>

          <div className="map-keyword-panel">
            <p className="section-kicker">{copy.keywords}</p>
            {selectedRegion.keywordHighlights.length > 0 ? (
              <div className="keyword-row keyword-row--stacked">
                {selectedRegion.keywordHighlights.map((keyword) => (
                  <Link
                    key={keyword}
                    href={withLocale(locale, `/news?region=${selectedRegion.id}&query=${encodeURIComponent(keyword)}&guangxi=only`)}
                    className="keyword-pill"
                  >
                    {keyword}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="map-inline-empty">{copy.noKeywords}</div>
            )}
          </div>
        </aside>
      </div>

      <section className="card-panel map-related">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{copy.latestArticles}</p>
            <h3>{getRegionLabel(locale, selectedRegion)}</h3>
          </div>
        </div>
        {relatedArticles.length > 0 ? (
          <div className="map-related__grid">
            {relatedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} variant="compact" />
            ))}
          </div>
        ) : (
          <div className="map-inline-empty">{copy.noArticles}</div>
        )}
      </section>
    </div>
  );
}
