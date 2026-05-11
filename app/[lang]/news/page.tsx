import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { formatDate, isLocale } from "@/lib/data";
import { getRuntimeArticlePage, getRuntimeMapDataset, getRuntimeSources, getRuntimeWordCloudItems } from "@/lib/backend-data";
import {
  categoryLabels,
  categoryOrder,
  getArticleHref,
  getCoverSurface,
  getDictionary,
  getSourceAccessUrls,
  withLocale,
} from "@/lib/site";
import type { Locale } from "@/lib/types";

interface NewsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number.parseInt(firstValue(value) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getNewsHref(
  lang: Locale,
  filters: {
    query?: string;
    category?: string;
    source?: string;
    region?: string;
    guangxi?: string;
    sort?: string;
    pageSize?: number;
  },
  overrides: {
    query?: string;
    category?: string;
    source?: string;
    region?: string;
    guangxi?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  const append = (key: string, value: string | number | undefined) => {
    if (value == null || value === "" || value === "all") {
      return;
    }
    if (key === "page" && Number(value) <= 1) {
      return;
    }
    if (key === "pageSize" && Number(value) === 24) {
      return;
    }
    params.set(key, String(value));
  };

  append("query", merged.query);
  append("category", merged.category);
  append("source", merged.source);
  append("region", merged.region);
  append("guangxi", merged.guangxi);
  append("sort", merged.sort === "latest" ? undefined : merged.sort);
  append("page", overrides.page);
  append("pageSize", merged.pageSize);

  const query = params.toString();
  return `${withLocale(lang, "/news")}${query ? `?${query}` : ""}`;
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
    region: firstValue(rawSearchParams.region) ?? "all",
    guangxi: (firstValue(rawSearchParams.guangxi) as "all" | "only" | undefined) ?? "all",
    sort: (firstValue(rawSearchParams.sort) as "latest" | "oldest" | undefined) ?? "latest",
    page: positiveInt(rawSearchParams.page, 1),
    pageSize: Math.min(positiveInt(rawSearchParams.pageSize, 24), 60),
  };

  const [articlePage, sources, mapDataset, wordCloudItems] = await Promise.all([
    getRuntimeArticlePage(filters),
    getRuntimeSources(),
    getRuntimeMapDataset(),
    getRuntimeWordCloudItems("all"),
  ]);
  const articles = articlePage.content;
  const regionOptions = mapDataset.regions;
  const showSpotlight = articlePage.page <= 1;
  const leadArticle = showSpotlight ? articles[0] : undefined;
  const leadCover = getCoverSurface(leadArticle?.coverImage);
  const leadSourceAccess = leadArticle ? getSourceAccessUrls(leadArticle.originalUrl, leadArticle.sourceUrl) : null;
  const railArticles = showSpotlight ? articles.slice(1, 5) : [];
  const listArticles = showSpotlight ? articles.slice(1) : articles;
  const hasArticles = articles.length > 0;
  const pageStart = articlePage.totalElements === 0 ? 0 : (articlePage.page - 1) * articlePage.pageSize + 1;
  const pageEnd = Math.min(articlePage.totalElements, (articlePage.page - 1) * articlePage.pageSize + articles.length);
  const baseFilters = {
    query: filters.query,
    category: filters.category,
    source: filters.source,
    region: filters.region,
    guangxi: filters.guangxi,
    sort: filters.sort,
    pageSize: filters.pageSize,
  };
  const suggestionTerms = wordCloudItems
    .map((item) => item.term)
    .filter((term, index, terms) => terms.indexOf(term) === index)
    .filter((term) => term.toLowerCase() !== (filters.query ?? "").trim().toLowerCase())
    .slice(0, 8);
  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.category !== "all" ||
    filters.source !== "all" ||
    filters.region !== "all" ||
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
            <h2>{articlePage.totalElements}</h2>
            <p>{hasActiveFilters ? dict.filters.submit : dict.pageIntro.newsSummary}</p>
          </div>
          <form className="filter-grid filter-grid--stacked" action={withLocale(lang, "/news")} method="get">
            <label>
              <span>{dict.filters.query}</span>
              <input name="query" defaultValue={filters.query} placeholder={dict.filters.queryPlaceholder} />
            </label>
            <input type="hidden" name="pageSize" value={filters.pageSize} />
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
              <span>{dict.filters.region}</span>
              <select name="region" defaultValue={filters.region}>
                <option value="all">{dict.filters.all}</option>
                {regionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {lang === "zh" ? region.name : region.nameEn}
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
          {suggestionTerms.length > 0 ? (
            <div className="news-suggestion-block">
              <span>{lang === "zh" ? "热词检索" : "Suggested searches"}</span>
              <div className="keyword-row keyword-row--stacked">
                {suggestionTerms.map((term) => (
                  <Link
                    key={term}
                    href={getNewsHref(lang, baseFilters, { query: term, page: 1 })}
                    className="keyword-pill"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
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
                      {leadSourceAccess?.primaryUrl ? (
                        <a href={leadSourceAccess.primaryUrl} className="text-link text-link--muted" target="_blank" rel="noreferrer noopener">
                          {dict.cards.sourceLink}
                        </a>
                      ) : null}
                      {leadSourceAccess?.backupUrl ? (
                        <a href={leadSourceAccess.backupUrl} className="text-link text-link--muted" target="_blank" rel="noreferrer noopener">
                          {lang === "zh" ? "备用网址" : "Backup"}
                        </a>
                      ) : null}
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
                <h2>{articlePage.totalElements}</h2>
                <p className="section-subnote">
                  {articlePage.totalElements > 0
                    ? lang === "zh"
                      ? `第 ${articlePage.page} / ${articlePage.totalPages} 页，当前显示 ${pageStart}-${pageEnd} 条`
                      : `Page ${articlePage.page} of ${articlePage.totalPages}, showing ${pageStart}-${pageEnd}`
                    : lang === "zh"
                      ? "没有匹配结果"
                      : "No matches"}
                </p>
              </div>
            </div>
            {hasArticles ? (
              <div className="news-grid news-grid--editorial">
                {(listArticles.length > 0 ? listArticles : articles).map((article) => (
                  <ArticleCard key={article.id} article={article} locale={lang} highlight={filters.query} />
                ))}
              </div>
            ) : (
              <div className="card-panel empty-panel">{dict.empty.news}</div>
            )}
            {articlePage.totalPages > 1 ? (
              <nav className="pagination-bar" aria-label={lang === "zh" ? "新闻分页" : "News pagination"}>
                <Link
                  href={getNewsHref(lang, baseFilters, { page: articlePage.page - 1 })}
                  className={`pagination-button ${articlePage.hasPrevious ? "" : "is-disabled"}`}
                  aria-disabled={!articlePage.hasPrevious}
                >
                  {lang === "zh" ? "上一页" : "Previous"}
                </Link>
                <div className="pagination-pages">
                  {Array.from({ length: articlePage.totalPages }, (_, index) => index + 1)
                    .filter((page) =>
                      page === 1 ||
                      page === articlePage.totalPages ||
                      Math.abs(page - articlePage.page) <= 2,
                    )
                    .map((page, index, pages) => {
                      const previous = pages[index - 1];
                      const needsGap = previous != null && page - previous > 1;

                      return (
                        <span key={page} className="pagination-page-wrap">
                          {needsGap ? <span className="pagination-gap">…</span> : null}
                          <Link
                            href={getNewsHref(lang, baseFilters, { page })}
                            className={`pagination-page ${page === articlePage.page ? "is-active" : ""}`}
                            aria-current={page === articlePage.page ? "page" : undefined}
                          >
                            {page}
                          </Link>
                        </span>
                      );
                    })}
                </div>
                <Link
                  href={getNewsHref(lang, baseFilters, { page: articlePage.page + 1 })}
                  className={`pagination-button ${articlePage.hasNext ? "" : "is-disabled"}`}
                  aria-disabled={!articlePage.hasNext}
                >
                  {lang === "zh" ? "下一页" : "Next"}
                </Link>
              </nav>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
