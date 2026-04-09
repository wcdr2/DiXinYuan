import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { formatDate, getArticleBySlug, getArticles, getRelatedArticles, isLocale } from "@/lib/data";
import { categoryLabels, getCoverSurface, getDictionary, withLocale } from "@/lib/site";

interface NewsDetailProps {
  params: Promise<{ lang: string; slug: string }>;
}

function getReadableUrl(value: string) {
  try {
    const parsed = new URL(value);
    const label = `${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/\/+$/, "");
    return label.length > 72 ? `${label.slice(0, 69)}…` : label;
  } catch {
    return value;
  }
}

export function generateStaticParams() {
  return getArticles().flatMap((article) => [
    { lang: "zh", slug: article.id },
    { lang: "en", slug: article.id },
    { lang: "zh", slug: article.slug },
    { lang: "en", slug: article.slug },
  ]);
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { lang, slug } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const article = getArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const dict = getDictionary(lang);
  const related = getRelatedArticles(article);
  const cover = getCoverSurface(article.coverImage);
  const detailLabels =
    lang === "zh"
      ? {
          source: "来源机构",
          language: "语言",
          region: "地区",
          original: "原始网页",
          site: "来源站点",
          published: "发布时间",
          evidence: "来源说明",
        }
      : {
          source: "Source",
          language: "Language",
          region: "Region",
          original: "Original page",
          site: "Source site",
          published: "Published",
          evidence: "Evidence",
        };

  return (
    <div className="shell page-stack">
      <article className="detail-hero card-panel detail-hero--polished">
        <div className={`detail-cover ${cover.className}`} style={cover.style}>
          <div className="detail-cover__wash" aria-hidden="true" />
          <div className="detail-cover__caption">
            <span className={`category-pill category-pill--${article.category}`}>
              {categoryLabels[lang][article.category]}
            </span>
            <strong>{article.sourceName}</strong>
            <small>{formatDate(lang, article.publishedAt)}</small>
          </div>
        </div>
        <div className="detail-copy">
          <div className="article-meta-row article-meta-row--detail">
            <span className={`category-pill category-pill--${article.category}`}>
              {categoryLabels[lang][article.category]}
            </span>
            <span>{formatDate(lang, article.publishedAt)}</span>
            <span>{article.language.toUpperCase()}</span>
          </div>
          <h1>{article.title}</h1>
          <p className="detail-summary">{article.summary}</p>
          <div className="detail-link-ribbon">
            <div className="detail-link-ribbon__item">
              <span className="detail-label">{detailLabels.original}</span>
              <Link href={article.originalUrl} className="detail-source-link" target="_blank" rel="noreferrer">
                {getReadableUrl(article.originalUrl)}
              </Link>
            </div>
            <div className="detail-link-ribbon__item">
              <span className="detail-label">{detailLabels.site}</span>
              <Link href={article.sourceUrl} className="detail-source-site" target="_blank" rel="noreferrer">
                {getReadableUrl(article.sourceUrl)}
              </Link>
            </div>
          </div>
          <div className="detail-meta-grid">
            <div>
              <span className="detail-label">{detailLabels.source}</span>
              <strong>{article.sourceName}</strong>
            </div>
            <div>
              <span className="detail-label">{detailLabels.language}</span>
              <strong>{article.language.toUpperCase()}</strong>
            </div>
            <div>
              <span className="detail-label">{detailLabels.region}</span>
              <strong>{article.regionTags.join(" / ")}</strong>
            </div>
            <div>
              <span className="detail-label">{detailLabels.published}</span>
              <strong>{formatDate(lang, article.publishedAt)}</strong>
            </div>
          </div>
          <div className="hero-actions hero-actions--detail">
            <Link href={article.originalUrl} className="button-primary" target="_blank" rel="noreferrer">
              {dict.cards.sourceLink}
            </Link>
            <Link href={withLocale(lang, "/news")} className="button-secondary">
              {dict.cards.allNews}
            </Link>
          </div>
        </div>
      </article>

      <section className="detail-grid">
        <div className="card-panel rich-panel card-panel--soft detail-evidence-panel">
          <p className="section-kicker">{detailLabels.evidence}</p>
          <h2>{dict.sections.evidence}</h2>
          <p className="detail-panel-note">{article.summary}</p>
          <ul className="detail-points">
            <li>{article.sourceName}</li>
            <li>{formatDate(lang, article.publishedAt)}</li>
            <li>{categoryLabels[lang][article.category]}</li>
            <li>{article.regionTags.join(" / ")}</li>
          </ul>
        </div>
        <aside className="sidebar-stack">
          <section className="card-panel card-panel--soft detail-source-card">
            <p className="section-kicker">{detailLabels.original}</p>
            <strong>{article.sourceName}</strong>
            <Link href={article.originalUrl} className="detail-source-link" target="_blank" rel="noreferrer">
              {getReadableUrl(article.originalUrl)}
            </Link>
            <Link href={article.sourceUrl} className="text-link text-link--muted" target="_blank" rel="noreferrer">
              {detailLabels.site}
            </Link>
          </section>
          <section className="card-panel card-panel--soft">
            <p className="section-kicker">{dict.sections.keywordInsight}</p>
            <div className="keyword-row keyword-row--stacked">
              {article.keywords.map((keyword) => (
                <Link key={keyword} href={withLocale(lang, `/news?query=${encodeURIComponent(keyword)}`)} className="keyword-pill">
                  {keyword}
                </Link>
              ))}
            </div>
          </section>
          <section className="card-panel card-panel--soft">
            <p className="section-kicker">{detailLabels.region}</p>
            <div className="keyword-row keyword-row--stacked">
              {article.regionTags.map((region) => (
                <span key={region} className="keyword-pill keyword-pill--region">
                  {region}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{dict.sections.related}</p>
            <h2>{dict.sections.related}</h2>
          </div>
        </div>
        {related.length > 0 ? (
          <div className="news-grid">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} locale={lang} />
            ))}
          </div>
        ) : (
          <div className="card-panel empty-panel">{dict.empty.related}</div>
        )}
      </section>
    </div>
  );
}
