import Link from "next/link";
import { notFound } from "next/navigation";
import { WordCloud } from "@/components/word-cloud";
import {
  formatDate,
  getArticles,
  getFeaturedArticles,
  getGraphDataset,
  getLatestByCategory,
  getSources,
  getWordCloudItems,
  isLocale,
} from "@/lib/data";
import {
  categoryLabels,
  categoryOrder,
  getArticleHref,
  getCoverSurface,
  getDictionary,
  withLocale,
} from "@/lib/site";

interface HomePageProps {
  params: Promise<{ lang: string }>;
}

function getDateBadge(lang: string, value: string) {
  const date = new Date(value);

  if (lang === "zh") {
    return {
      month: `${date.getMonth() + 1}月`,
      day: String(date.getDate()).padStart(2, "0"),
    };
  }

  return {
    month: date.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const articles = getArticles();
  const featured = getFeaturedArticles();
  const graph = getGraphDataset();
  const wordCloud = getWordCloudItems("all").slice(0, 14);
  const highlightedSources = getSources().slice(0, 6);
  const latestByCategory = categoryOrder.map((category) => ({
    category,
    items: getLatestByCategory(category),
  }));

  const leadStory = featured[0];
  const leadCover = getCoverSurface(leadStory?.coverImage);
  const supportStories = featured.slice(1, 4);
  const latestFeed = articles.slice(0, 5);
  const moreLabel = lang === "zh" ? "更多" : "More";

  return (
    <div className="page-stack page-stack--home">
      <section className="home-hero home-hero--reference">
        <div className="shell home-hero__inner home-hero__inner--reference">
          <div className="home-hero__orb" aria-hidden="true" />
          <div className="home-hero__center home-hero__center--reference">
            <div className="home-hero__rule" aria-hidden="true" />
            <p className="section-kicker">{dict.hero.eyebrow}</p>
            <h1 className="home-hero__title">
              <span className="home-hero__title-line">
                <span>{dict.hero.titleTop}</span>
              </span>
              <span className="home-hero__title-line home-hero__title-line--bottom">
                <span>{dict.hero.titleBottom}</span>
              </span>
            </h1>
            <div className="home-hero__rule home-hero__rule--lower" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="home-section home-section--lead">
        <div className="shell home-lead-grid">
          <article className="card-panel home-spotlight home-spotlight--featured">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{dict.home.spotlight}</p>
                <h2>{dict.sections.latest}</h2>
              </div>
              <Link href={withLocale(lang, "/news")} className="text-link">
                {dict.cards.allNews}
              </Link>
            </div>
            {leadStory ? (
              <>
                <div className={`home-spotlight__media ${leadCover.className}`} style={leadCover.style} aria-hidden="true" />
                <div className="home-spotlight__content">
                  <div className="article-meta-row">
                    <span className={`category-pill category-pill--${leadStory.category}`}>
                      {categoryLabels[lang][leadStory.category]}
                    </span>
                    <span>{formatDate(lang, leadStory.publishedAt)}</span>
                  </div>
                  <h3 className="home-spotlight__title">
                    <Link href={getArticleHref(lang, leadStory)}>{leadStory.title}</Link>
                  </h3>
                  <p className="panel-note">{leadStory.summary}</p>
                  <div className="article-card__footer article-card__footer--wide">
                    <span className="article-source">{leadStory.sourceName}</span>
                    <Link href={getArticleHref(lang, leadStory)} className="text-link">
                      {dict.cards.readMore}
                    </Link>
                  </div>
                </div>
                {supportStories.length > 0 ? (
                  <div className="home-spotlight__support">
                    {supportStories.map((article) => (
                      <Link key={article.id} href={getArticleHref(lang, article)} className="home-spotlight__support-item">
                        <strong>{article.title}</strong>
                        <small>
                          {formatDate(lang, article.publishedAt)} · {article.sourceName}
                        </small>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </article>

          <aside className="card-panel home-latest">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{dict.home.latestRail}</p>
                <h2>{dict.home.latestRail}</h2>
              </div>
            </div>
            <div className="latest-feed">
              {latestFeed.map((article) => {
                const badge = getDateBadge(lang, article.publishedAt);
                return (
                  <Link key={article.id} href={getArticleHref(lang, article)} className="latest-feed__item">
                    <span className="latest-feed__date">
                      <small>{badge.month}</small>
                      <strong>{badge.day}</strong>
                    </span>
                    <span className="latest-feed__copy">
                      <strong>{article.title}</strong>
                      <small>{article.sourceName}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="home-section home-section--editorial">
        <div className="shell section-block section-block--editorial">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">{dict.home.taxonomy}</p>
              <h2>{dict.sections.taxonomy}</h2>
            </div>
          </div>
          <div className="editorial-columns">
            {latestByCategory.map((group) => {
              const leadItem = group.items[0];
              const tailItems = group.items.slice(1, 4);
              const columnCover = getCoverSurface(leadItem?.coverImage);

              return (
                <article key={group.category} className="editorial-column">
                  <div
                    className={`editorial-column__visual editorial-column__visual--photo ${columnCover.className}`}
                    style={columnCover.style}
                    aria-hidden="true"
                  >
                    <div className="editorial-column__visual-mask" />
                    <span className={`category-pill category-pill--${group.category}`}>
                      {categoryLabels[lang][group.category]}
                    </span>
                  </div>
                  <div className="editorial-column__inner">
                    <div className="editorial-column__header">
                      <h3>{categoryLabels[lang][group.category]}</h3>
                      <Link href={withLocale(lang, `/news?category=${group.category}`)} className="text-link text-link--muted">
                        {dict.cards.allNews}
                      </Link>
                    </div>
                    {leadItem ? (
                      <Link href={getArticleHref(lang, leadItem)} className="editorial-column__lead">
                        <strong>{leadItem.title}</strong>
                        <p>{leadItem.summary}</p>
                      </Link>
                    ) : null}
                    <div className="editorial-column__list">
                      {tailItems.map((article) => (
                        <Link key={article.id} href={getArticleHref(lang, article)} className="editorial-column__item">
                          <strong>{article.title}</strong>
                          <small>{formatDate(lang, article.publishedAt)}</small>
                        </Link>
                      ))}
                    </div>
                    <Link href={withLocale(lang, `/news?category=${group.category}`)} className="editorial-column__more">
                      {moreLabel}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section home-section--contrast">
        <div className="shell analytics-grid">
          <div className="card-panel analytics-panel analytics-panel--heroic">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{dict.home.analytics}</p>
                <h2>{dict.pageIntro.cloudTitle}</h2>
              </div>
              <Link href={withLocale(lang, "/word-cloud")} className="text-link text-link--light">
                {dict.cards.allCloud}
              </Link>
            </div>
            <WordCloud locale={lang} items={wordCloud} variant="dark" />
          </div>
          <div className="card-panel analytics-panel analytics-panel--heroic">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{dict.home.analytics}</p>
                <h2>{dict.pageIntro.graphTitle}</h2>
              </div>
              <Link href={withLocale(lang, "/knowledge-graph")} className="text-link text-link--light">
                {dict.cards.allGraph}
              </Link>
            </div>
            <p className="panel-note panel-note--light">{dict.graph.selectPrompt}</p>
            <div className="insight-list insight-list--light">
              {graph.entities.slice(0, 6).map((entity) => (
                <div key={entity.id} className="insight-item insight-item--light">
                  <strong>{entity.name}</strong>
                  <span>{entity.relatedArticleIds.length} articles</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section--tail">
        <div className="shell trust-grid">
          <div className="card-panel trust-panel">
            <p className="section-kicker">{dict.home.trust}</p>
            <h2>{dict.sources.whitelistTitle}</h2>
            <p className="panel-note">{dict.sources.trustRule}</p>
            <div className="source-pill-grid">
              {highlightedSources.map((source) => (
                <span key={source.id} className="source-chip">
                  {source.name}
                </span>
              ))}
            </div>
            <Link href={withLocale(lang, "/sources")} className="text-link">
              {dict.cards.allSources}
            </Link>
          </div>
          <div className="card-panel project-panel">
            <p className="section-kicker">{dict.home.method}</p>
            <h2>{dict.pageIntro.aboutTitle}</h2>
            <div className="project-points">
              <div>
                <strong>{dict.about.audienceTitle}</strong>
                <p>{dict.about.audienceBody}</p>
              </div>
              <div>
                <strong>{dict.about.pipelineTitle}</strong>
                <p>{dict.about.pipelineBody}</p>
              </div>
              <div>
                <strong>{dict.about.v1Title}</strong>
                <p>{dict.about.v1Body}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
