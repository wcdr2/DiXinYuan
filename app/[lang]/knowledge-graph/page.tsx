import { notFound } from "next/navigation";
import { GraphExplorer } from "@/components/graph-explorer";
import { getArticles, getGraphDataset, isLocale } from "@/lib/data";
import { entityTypeLabels, getDictionary } from "@/lib/site";
import type { EntityType } from "@/lib/types";

interface GraphPageProps {
  params: Promise<{ lang: string }>;
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const graph = getGraphDataset();
  const articles = getArticles();
  const legendTypes = (["policy", "enterprise", "institution", "university", "park", "project", "technology", "region"] as EntityType[])
    .filter((type) => graph.entities.some((entity) => entity.type === type));
  const chainCards =
    lang === "zh"
      ? [
          { title: "上游数据与感知", body: "以遥感、北斗、测绘和低空感知为代表，承担产业链的数据获取与基础感知能力。" },
          { title: "中游平台与智能", body: "以 GIS 时空平台、实景三维、GeoAI 和数字孪生为核心，形成平台化与智能化能力层。" },
          { title: "下游场景与产业", body: "围绕自然资源治理、海洋港航、低空经济和园区企业集群，构成广西落地应用场景。" },
        ]
      : [
          { title: "Upstream sensing", body: "Remote sensing, Beidou, surveying and low-altitude sensing provide the primary data-acquisition layer." },
          { title: "Midstream platforms", body: "GIS platforms, real-scene 3D, GeoAI and digital twins form the core capability layer." },
          { title: "Downstream scenarios", body: "Natural-resource governance, marine services, low-altitude economy and regional industry clusters make up the application layer." },
        ];
  const metricLabels =
    lang === "zh"
      ? { entities: "实体节点", edges: "关系边", evidence: "证据文章" }
      : { entities: "Entities", edges: "Edges", evidence: "Evidence" };

  return (
    <div className="shell page-stack graph-page">
      <section className="page-intro card-panel page-intro--graph">
        <p className="section-kicker">{dict.nav.graph}</p>
        <h1>{dict.pageIntro.graphTitle}</h1>
        <p>{dict.pageIntro.graphSummary}</p>
        <div className="graph-page__metrics">
          <div className="graph-page__metric">
            <strong>{graph.entities.length}</strong>
            <span>{metricLabels.entities}</span>
          </div>
          <div className="graph-page__metric">
            <strong>{graph.edges.length}</strong>
            <span>{metricLabels.edges}</span>
          </div>
          <div className="graph-page__metric">
            <strong>{articles.length}</strong>
            <span>{metricLabels.evidence}</span>
          </div>
        </div>
      </section>

      <section className="graph-page__chain">
        <div className="graph-page__chain-grid">
          {chainCards.map((card) => (
            <article key={card.title} className="card-panel card-panel--soft graph-page__chain-card">
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="graph-page__legend-strip card-panel card-panel--soft">
        <p className="section-kicker">{lang === "zh" ? "图例" : "Legend"}</p>
        <div className="graph-page__legend-grid graph-page__legend-grid--inline">
          {legendTypes.map((type) => (
            <div key={type} className={`graph-page__legend-item graph-page__legend-item--${type}`}>
              <span className="graph-page__legend-dot" aria-hidden="true" />
              <strong>{entityTypeLabels[lang][type]}</strong>
            </div>
          ))}
        </div>
      </section>

      <GraphExplorer locale={lang} dataset={graph} articles={articles} />
    </div>
  );
}
