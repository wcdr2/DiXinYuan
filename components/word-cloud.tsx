import Link from "next/link";
import { getDictionary, withLocale } from "@/lib/site";
import type { Locale, WordCloudItem } from "@/lib/types";

interface WordCloudProps {
  locale: Locale;
  items: WordCloudItem[];
  variant?: "light" | "dark";
  mode?: "preview" | "insight";
  maxItems?: number;
  showPrompt?: boolean;
}

type WordChipLevel = "featured" | "strong" | "medium" | "normal" | "small";

function getChipLevel(index: number, total: number): WordChipLevel {
  if (index === 0) {
    return "featured";
  }

  if (index < Math.min(3, total)) {
    return "strong";
  }

  if (index < Math.min(7, total)) {
    return "medium";
  }

  if (index < Math.min(14, total)) {
    return "normal";
  }

  return "small";
}

export function WordCloud({
  locale,
  items,
  variant = "light",
  mode = "insight",
  maxItems,
  showPrompt = true,
}: WordCloudProps) {
  const dict = getDictionary(locale);
  const visibleItems = items
    .slice()
    .sort((left, right) => right.weight - left.weight || right.articleCount - left.articleCount)
    .slice(0, maxItems ?? (mode === "preview" ? 14 : 20));

  if (visibleItems.length === 0) {
    return (
      <div className={`word-cloud-panel word-cloud-panel--${mode}`}>
        {showPrompt ? <p className="panel-note">{dict.wordCloud.prompt}</p> : null}
        <div className="empty-inline">{dict.wordCloud.empty}</div>
      </div>
    );
  }

  return (
    <div className={`word-cloud-panel word-cloud-panel--${mode}`}>
      {showPrompt ? <p className="panel-note">{dict.wordCloud.prompt}</p> : null}
      <div className={`word-cloud word-cloud--${mode}`} aria-label={dict.pageIntro.cloudTitle}>
        {visibleItems.map((item, index) => {
          const level = getChipLevel(index, visibleItems.length);
          return (
            <Link
              key={`${item.category}-${item.term}`}
              href={withLocale(locale, `/news?query=${encodeURIComponent(item.term)}`)}
              className={`word-chip word-chip--${variant} word-chip--${level}`}
              title={`${item.term} · ${item.articleCount} ${dict.wordCloud.articleCount}`}
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
