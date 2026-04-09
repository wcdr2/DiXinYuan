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
  const guideCards =
    lang === "zh"
      ? [
          { title: "节点类型", body: "政策、企业、机构、高校、园区、项目、技术与地区按颜色区分。" },
          { title: "关系来源", body: "每条关系都由新闻证据支撑，并在右侧面板中可追溯。" },
          { title: "交互方式", body: "点击节点切换焦点，使用顶部类型筛选快速缩小图谱范围。" },
        ]
      : [
          { title: "Entity types", body: "Policies, enterprises, institutions, universities, parks, projects, technologies and regions use distinct colors." },
          { title: "Evidence", body: "Every relation is backed by article evidence and can be traced from the side panel." },
          { title: "Interaction", body: "Select a node to focus it, then use the type filter to narrow the graph." },
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

      <section className="graph-page__overview">
        <div className="card-panel graph-page__legend card-panel--soft">
          <p className="section-kicker">Legend</p>
          <h2>{lang === "zh" ? "图谱图例" : "Graph legend"}</h2>
          <div className="graph-page__legend-grid">
            {legendTypes.map((type) => (
              <div key={type} className={`graph-page__legend-item graph-page__legend-item--${type}`}>
                <span className="graph-page__legend-dot" aria-hidden="true" />
                <strong>{entityTypeLabels[lang][type]}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="graph-page__guides">
          {guideCards.map((card) => (
            <article key={card.title} className="card-panel card-panel--soft graph-page__guide-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <GraphExplorer locale={lang} dataset={graph} articles={articles} />
    </div>
  );
}
