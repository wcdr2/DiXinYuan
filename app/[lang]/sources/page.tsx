import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getLatestArticleForSource, getLogs, getSources, isLocale } from "@/lib/data";
import { getArticleHref, getDictionary, sourceTypeLabels } from "@/lib/site";
import type { Source } from "@/lib/types";

interface SourcesPageProps {
  params: Promise<{ lang: string }>;
}

function getSourceTarget(source: Source) {
  return (
    source.crawlRule.entryUrl ??
    source.crawlRule.apiUrl ??
    source.crawlRule.feedUrls?.[0] ??
    source.crawlRule.fallbackEntryUrls?.[0] ??
    source.siteUrl
  );
}

export default async function SourcesPage({ params }: SourcesPageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const sources = getSources();
  const logs = getLogs();
  const labels =
    lang === "zh"
      ? {
          target: "采集入口",
          latest: "最近一条内容",
          keywords: "关键词范围",
          status: "状态",
          fetched: "抓取",
          published: "发布",
          finished: "完成时间",
          source: "来源",
        }
      : {
          target: "Crawl target",
          latest: "Latest item",
          keywords: "Keyword scope",
          status: "Status",
          fetched: "Fetched",
          published: "Published",
          finished: "Finished",
          source: "Source",
        };

  return (
    <div className="shell page-stack">
      <section className="page-intro card-panel">
        <p className="section-kicker">{dict.nav.sources}</p>
        <h1>{dict.pageIntro.sourcesTitle}</h1>
        <p>{dict.pageIntro.sourcesSummary}</p>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{dict.sources.whitelistTitle}</p>
            <h2>{dict.sources.whitelistTitle}</h2>
          </div>
        </div>
        <div className="source-grid">
          {sources.map((source) => {
            const targetUrl = getSourceTarget(source);
            const latestArticle = getLatestArticleForSource(source.name);

            return (
              <article key={source.id} className="card-panel source-card card-panel--soft">
                <div className="article-meta-row">
                  <span className="category-pill category-pill--policy">
                    {sourceTypeLabels[lang][source.type]}
                  </span>
                  <span>{source.trustLevel.toUpperCase()}</span>
                </div>
                <h3>{source.name}</h3>
                <p>{source.crawlRule.notes}</p>
                <div className="source-card__meta">
                  <div>
                    <span className="detail-label">{labels.target}</span>
                    <a href={targetUrl} target="_blank" rel="noreferrer noopener" className="text-link source-card__link">
                      {targetUrl}
                    </a>
                  </div>
                  <div>
                    <span className="detail-label">{labels.keywords}</span>
                    <p>{source.crawlRule.whitelist?.join(" / ") || "-"}</p>
                  </div>
                  {latestArticle ? (
                    <div>
                      <span className="detail-label">{labels.latest}</span>
                      <Link href={getArticleHref(lang, latestArticle)} className="text-link source-card__link">
                        {latestArticle.title}
                      </Link>
                      <p>{formatDate(lang, latestArticle.publishedAt)}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{dict.sources.logsTitle}</p>
            <h2>{dict.sources.logsTitle}</h2>
          </div>
        </div>
        <div className="card-panel table-panel card-panel--soft">
          <p className="panel-note">{dict.sources.logsSummary}</p>
          <div className="log-table">
            <div className="log-table__header">
              <span>{labels.source}</span>
              <span>{labels.status}</span>
              <span>{labels.fetched}</span>
              <span>{labels.published}</span>
              <span>{labels.finished}</span>
            </div>
            {logs.map((log) => (
              <div key={log.sourceId} className="log-table__row">
                <span>{log.sourceName}</span>
                <span>{log.status}</span>
                <span>{log.fetchedCount}</span>
                <span>{log.publishedCount}</span>
                <span>{formatDate(lang, log.finishedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
