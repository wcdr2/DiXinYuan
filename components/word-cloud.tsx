import Link from "next/link";
import { getDictionary, withLocale } from "@/lib/site";
import type { Locale, WordCloudItem } from "@/lib/types";

interface WordCloudProps {
  locale: Locale;
  items: WordCloudItem[];
  variant?: "light" | "dark";
}

export function WordCloud({ locale, items, variant = "light" }: WordCloudProps) {
  const dict = getDictionary(locale);

  if (items.length === 0) {
    return (
      <div className="word-cloud-panel">
        <p className="panel-note">{dict.wordCloud.prompt}</p>
        <div className="empty-inline">{dict.wordCloud.empty}</div>
      </div>
    );
  }

  return (
    <div className="word-cloud-panel">
      <p className="panel-note">{dict.wordCloud.prompt}</p>
      <div className="word-cloud">
        {items.map((item) => {
          const fontSize = 0.96 + item.weight * 0.14;
          return (
            <Link
              key={`${item.category}-${item.term}`}
              href={withLocale(locale, `/news?query=${encodeURIComponent(item.term)}`)}
              className={`word-chip word-chip--${variant}`}
              style={{ fontSize: `${fontSize}rem` }}
            >
              <span>{item.term}</span>
              <small>{item.articleCount}</small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
