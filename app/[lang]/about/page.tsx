import { notFound } from "next/navigation";
import { getSummaryMetrics, isLocale } from "@/lib/data";
import { getDictionary } from "@/lib/site";

interface AboutPageProps {
  params: Promise<{ lang: string }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const metrics = getSummaryMetrics();

  return (
    <div className="shell page-stack">
      <section className="page-intro card-panel">
        <p className="section-kicker">{dict.nav.about}</p>
        <h1>{dict.pageIntro.aboutTitle}</h1>
        <p>{dict.pageIntro.aboutSummary}</p>
      </section>
      <section className="about-grid">
        <article className="card-panel">
          <h2>{dict.about.audienceTitle}</h2>
          <p>{dict.about.audienceBody}</p>
        </article>
        <article className="card-panel">
          <h2>{dict.about.pipelineTitle}</h2>
          <p>{dict.about.pipelineBody}</p>
        </article>
        <article className="card-panel">
          <h2>{dict.about.v1Title}</h2>
          <p>{dict.about.v1Body}</p>
        </article>
      </section>
      <section className="card-panel metric-ribbon">
        <div className="metric-box">
          <span>Articles</span>
          <strong>{metrics.totalArticles}</strong>
        </div>
        <div className="metric-box">
          <span>Sources</span>
          <strong>{metrics.totalSources}</strong>
        </div>
        <div className="metric-box">
          <span>Guangxi-related</span>
          <strong>{metrics.guangxiArticles}</strong>
        </div>
        <div className="metric-box">
          <span>Graph edges</span>
          <strong>{metrics.totalEdges}</strong>
        </div>
      </section>
    </div>
  );
}
