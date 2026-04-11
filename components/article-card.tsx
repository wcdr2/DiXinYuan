import Link from "next/link";
import { formatDate } from "@/lib/data";
import { categoryLabels, getArticleHref, getCoverSurface, getDictionary, getSourceAccessUrls } from "@/lib/site";
import type { Article, Locale } from "@/lib/types";

interface ArticleCardProps {
  article: Article;
  locale: Locale;
  variant?: "feature" | "default" | "compact";
}

export function ArticleCard({ article, locale, variant = "default" }: ArticleCardProps) {
  const dict = getDictionary(locale);
  const href = getArticleHref(locale, article);
  const cover = getCoverSurface(article.coverImage);
  const sourceAccess = getSourceAccessUrls(article.originalUrl, article.sourceUrl);
  const backupLabel = locale === "zh" ? "镜像访问" : "Mirror";

  return (
    <article className={`article-card article-card--${variant}`}>
      <div className={`article-cover ${cover.className}`} style={cover.style} aria-hidden="true" />
      <div className="article-card__body">
        <div className="article-meta-row">
          <span className={`category-pill category-pill--${article.category}`}>
            {categoryLabels[locale][article.category]}
          </span>
          <span>{formatDate(locale, article.publishedAt)}</span>
          {article.isGuangxiRelated ? <span className="article-flag">GX</span> : null}
        </div>
        <h3 className="article-card__title">
          <Link href={href}>{article.title}</Link>
        </h3>
        <p className="article-card__summary">{article.summary}</p>
        <div className="article-card__footer">
          <span className="article-source">{article.sourceName}</span>
          <div className="article-actions">
            <Link href={href} className="text-link">
              {dict.cards.readMore}
            </Link>
            <a href={sourceAccess.primaryUrl} className="text-link text-link--muted" target="_blank" rel="noreferrer noopener">
              {dict.cards.sourceLink}
            </a>
            {sourceAccess.backupUrl ? (
              <a href={sourceAccess.backupUrl} className="text-link text-link--muted" target="_blank" rel="noreferrer noopener">
                {backupLabel}
              </a>
            ) : null}
          </div>
        </div>
        <div className="keyword-row">
          {article.keywords.slice(0, variant === "compact" ? 2 : 4).map((keyword) => (
            <span key={keyword} className="keyword-pill">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
