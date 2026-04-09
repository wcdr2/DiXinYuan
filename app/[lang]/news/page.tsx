import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { filterArticles, formatDate, getSources, isLocale } from "@/lib/data";
import {
  categoryLabels,
  categoryOrder,
  getArticleHref,
  getCoverSurface,
  getDictionary,
  withLocale,
} from "@/lib/site";

interface NewsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewsPage({ params, searchParams }: NewsPageProps) {
  const [{ lang }, rawSearchParams] = await Promise.all([params, searchParams]);

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const filters = {
    query: firstValue(rawSearchParams.query),
    category: (firstValue(rawSearchParams.category) as "enterprise" | "technology" | "policy" | "all" | undefined) ?? "all",
    source: firstValue(rawSearchParams.source) ?? "all",
    guangxi: (firstValue(rawSearchParams.guangxi) as "all" | "only" | undefined) ?? "all",
    sort: (firstValue(rawSearchParams.sort) as "latest" | "oldest" | undefined) ?? "latest",
  };

  const articles = filterArticles(filters);
  const sources = getSources();
  const leadArticle = articles[0];
  const leadCover = getCoverSurface(leadArticle?.coverImage);
  const railArticles = articles.slice(1, 5);
  const listArticles = articles.slice(1);
  const hasArticles = articles.length > 0;
  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.category !== "all" ||
    filters.source !== "all" ||
    filters.guangxi !== "all" ||
    filters.sort !== "latest";

  return (
    <div className="shell page-stack news-page">
      <section className="page-intro card-panel page-intro--news">
        <p className="section-kicker">{dict.nav.news}</p>
        <h1>{dict.pageIntro.newsTitle}</h1>
        <p>{dict.pageIntro.newsSummary}</p>
      </section>

      <div className="news-page-grid">
        <aside className="card-panel filter-panel card-panel--soft news-sidebar">
          <div className="news-sidebar__intro">
            <p className="section-kicker">{dict.filters.results}</p>
            <h2>{articles.length}</h2>
            <p>{hasActiveFilters ? dict.filters.submit : dict.pageIntro.newsSummary}</p>
          </div>
          <form className="filter-grid filter-grid--stacked" action={withLocale(lang, "/news")} method="get">
            <label>
              <span>{dict.filters.query}</span>
              <input name="query" defaultValue={filters.query} placeholder={dict.filters.queryPlaceholder} />
            </label>
            <label>
              <span>{dict.filters.category}</span>
              <select name="category" defaultValue={filters.category}>
                <option value="all">{dict.filters.all}</option>
                {categoryOrder.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[lang][category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{dict.filters.source}</span>
              <select name="source" defaultValue={filters.source}>
                <option value="all">{dict.filters.all}</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.name}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{dict.filters.guangxi}</span>
              <select name="guangxi" defaultValue={filters.guangxi}>
                <option value="all">{dict.filters.all}</option>
                <option value="only">{dict.filters.guangxiOnly}</option>
              </select>
            </label>
            <label>
              <span>{dict.filters.sort}</span>
              <select name="sort" defaultValue={filters.sort}>
                <option value="latest">{dict.filters.latest}</option>
                <option value="oldest">{dict.filters.oldest}</option>
              </select>
            </label>
            <div className="filter-actions">
              <button type="submit" className="button-primary">
                {dict.filters.submit}
              </button>
              <Link href={withLocale(lang, "/news")} className="button-secondary">
                {dict.filters.reset}
              </Link>
            </div>
          </form>
        </aside>

        <div className="news-main">
          {leadArticle ? (
            <section className="card-panel news-spotlight">
              <div className="news-spotlight__main">
                <div className={`news-spotlight__cover ${leadCover.className}`} style={leadCover.style} aria-hidden="true" />
                <div className="news-spotlight__body">
                  <div className="article-meta-row">
                    <span className={`category-pill category-pill--${leadArticle.category}`}>
                      {categoryLabels[lang][leadArticle.category]}
                    </span>
                    <span>{formatDate(lang, leadArticle.publishedAt)}</span>
                  </div>
                  <h2>
                    <Link href={getArticleHref(lang, leadArticle)}>{leadArticle.title}</Link>
                  </h2>
                  <p className="panel-note">{leadArticle.summary}</p>
                  <div className="article-card__footer article-card__footer--wide">
                    <span className="article-source">{leadArticle.sourceName}</span>
                    <div className="article-actions">
                      <Link href={getArticleHref(lang, leadArticle)} className="text-link">
                        {dict.cards.readMore}
                      </Link>
                      <Link href={leadArticle.originalUrl} className="text-link text-link--muted" target="_blank">
                        {dict.cards.sourceLink}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              {railArticles.length > 0 ? (
                <div className="news-spotlight__rail">
                  {railArticles.map((article) => (
                    <Link key={article.id} href={getArticleHref(lang, article)} className="news-spotlight__rail-item">
                      <strong>{article.title}</strong>
                      <small>
                        {formatDate(lang, article.publishedAt)} · {article.sourceName}
                      </small>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="section-block">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">{dict.filters.results}</p>
                <h2>{hasArticles ? articles.length : 0}</h2>
              </div>
            </div>
            {hasArticles ? (
              <div className="news-grid news-grid--editorial">
                {(listArticles.length > 0 ? listArticles : articles).map((article) => (
                  <ArticleCard key={article.id} article={article} locale={lang} />
                ))}
              </div>
            ) : (
              <div className="card-panel empty-panel">{dict.empty.news}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
