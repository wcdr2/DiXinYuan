import { notFound } from "next/navigation";
import { MapExplorer } from "@/components/map-explorer";
import { formatDate, getArticles, getMapDataset, isLocale } from "@/lib/data";
import type { MapMode } from "@/lib/types";
import { getDictionary } from "@/lib/site";

interface MapPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const [{ lang }, rawSearchParams] = await Promise.all([params, searchParams]);

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const dataset = getMapDataset();
  const articles = getArticles();
  const initialRegionId = firstValue(rawSearchParams.region);
  const rawMode = firstValue(rawSearchParams.mode);
  const initialMode: MapMode =
    rawMode === "enterprise" || rawMode === "technology" || rawMode === "policy" ? rawMode : "all";

  const metricLabels =
    lang === "zh"
      ? {
          regions: "覆盖区域",
          articles: "关联新闻",
          entities: "关联图谱实体",
          focus: "重点城市",
          modes: "专题模式",
          coverage: "区域覆盖",
        }
      : {
          regions: "Regions",
          articles: "Linked articles",
          entities: "Graph entities",
          focus: "Priority cities",
          modes: "Views",
          coverage: "Coverage",
        };

  return (
    <div className="shell page-stack map-page">
      <section className="page-intro card-panel page-intro--map">
        <p className="section-kicker">{dict.nav.map}</p>
        <h1>{dict.pageIntro.mapTitle}</h1>
        <p>{dict.pageIntro.mapSummary}</p>
        <div className="graph-page__metrics">
          <div className="graph-page__metric">
            <strong>{dataset.metrics.regionCount}</strong>
            <span>{metricLabels.regions}</span>
          </div>
          <div className="graph-page__metric">
            <strong>{dataset.metrics.totalArticles}</strong>
            <span>{metricLabels.articles}</span>
          </div>
          <div className="graph-page__metric">
            <strong>{dataset.metrics.totalGraphEntities}</strong>
            <span>{metricLabels.entities}</span>
          </div>
        </div>
      </section>

      <section className="map-page__overview-grid">
        <article className="card-panel card-panel--soft">
          <p className="section-kicker">{metricLabels.modes}</p>
          <div className="map-page__mode-grid">
            {[
              { key: "all", label: lang === "zh" ? "综合热度" : "Overall intensity" },
              { key: "enterprise", label: lang === "zh" ? "企业动态" : "Enterprise track" },
              { key: "technology", label: lang === "zh" ? "技术进展" : "Technology track" },
              { key: "policy", label: lang === "zh" ? "政策观察" : "Policy track" },
            ].map((mode) => (
              <div key={mode.key} className="map-page__mode-card">
                <strong>{mode.label}</strong>
                <span>{mode.key === initialMode ? (lang === "zh" ? "当前默认" : "Default") : lang === "zh" ? "可切换" : "Switchable"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card-panel card-panel--soft">
          <p className="section-kicker">{metricLabels.coverage}</p>
          <div className="graph-page__scope-list">
            {dataset.regions.map((region) => (
              <span key={region.id} className="source-chip">
                {lang === "zh" ? region.name : region.nameEn}
              </span>
            ))}
          </div>
          <p className="panel-note">
            {lang === "zh"
              ? `最新一次地图数据刷新时间：${formatDate(lang, dataset.updatedAt)}；地图仅保留广西 14 市真实城市单元，不再单列北部湾专题区域。`
              : `Latest map refresh: ${formatDate(lang, dataset.updatedAt)}. The map now keeps only Guangxi's 14 city units and no longer exposes Beibu Gulf as a separate region.`}
          </p>
          <div className="map-page__mini-metrics">
            <div>
              <strong>{dataset.metrics.priorityRegionCount}</strong>
              <span>{metricLabels.focus}</span>
            </div>
            <div>
              <strong>{articles.filter((article) => article.isGuangxiRelated).length}</strong>
              <span>{lang === "zh" ? "广西相关" : "Guangxi-related"}</span>
            </div>
          </div>
        </article>
      </section>

      <MapExplorer
        locale={lang}
        dataset={dataset}
        articles={articles}
        initialRegionId={initialRegionId}
        initialMode={initialMode}
      />
    </div>
  );
}
