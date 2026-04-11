import { notFound } from "next/navigation";
import { GraphExplorer } from "@/components/graph-explorer";
import { getArticles, getGraphDataset, isLocale } from "@/lib/data";
import { getDictionary } from "@/lib/site";

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
  const regionScopes = graph.regionScopes ?? [];
  const elementClasses = graph.taxonomy?.elementClasses ?? [];
  const metricLabels =
    lang === "zh"
      ? { entities: "图谱节点", edges: "关系边", evidence: "证据来源" }
      : { entities: "Nodes", edges: "Relations", evidence: "Evidence items" };

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

      <section className="graph-page__overview-grid">
        <article className="card-panel card-panel--soft">
          <p className="section-kicker">{lang === "zh" ? "五类要素" : "Five layers"}</p>
          <div className="graph-page__taxonomy-grid">
            {elementClasses.map((item, index) => (
              <div key={item.key} className="graph-page__taxonomy-card">
                <span>0{index + 1}</span>
                <strong>{lang === "zh" ? item.labelZh : item.labelEn}</strong>
                <p>{lang === "zh" ? item.descriptionZh : item.descriptionEn}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card-panel card-panel--soft">
          <p className="section-kicker">{lang === "zh" ? "区域范围" : "Region scopes"}</p>
          <div className="graph-page__scope-list">
            {regionScopes.map((scope) => (
              <span key={scope.id} className="source-chip">
                {lang === "zh" ? scope.labelZh : scope.labelEn}
              </span>
            ))}
          </div>
          <p className="panel-note">
            {lang === "zh"
              ? "默认以广西为总范围，支持切换到重点城市和北部湾专题，查看空间要素与应用活动的差异。"
              : "The graph starts from Guangxi and can be filtered to major cities and the Beibu Gulf topic."}
          </p>
        </article>
      </section>

      <GraphExplorer locale={lang} dataset={graph} articles={articles} />
    </div>
  );
}
