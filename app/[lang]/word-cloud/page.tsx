import { notFound } from "next/navigation";
import { WordCloud } from "@/components/word-cloud";
import { getRuntimeWordCloudItems } from "@/lib/backend-data";
import { isLocale } from "@/lib/data";
import { categoryLabels, categoryOrder, getDictionary } from "@/lib/site";
import type { ArticleCategory, WordCloudItem } from "@/lib/types";

interface WordCloudPageProps {
  params: Promise<{ lang: string }>;
}

const cloudCardMeta: Array<{
  key: ArticleCategory | "all";
  icon: string;
  tone: string;
}> = [
  { key: "all", icon: "火", tone: "all" },
  { key: "enterprise", icon: "企", tone: "enterprise" },
  { key: "technology", icon: "芯", tone: "technology" },
  { key: "policy", icon: "策", tone: "policy" },
];

export default async function WordCloudPage({ params }: WordCloudPageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const [allItems, ...categoryItems] = await Promise.all([
    getRuntimeWordCloudItems("all"),
    ...categoryOrder.map((category) => getRuntimeWordCloudItems(category)),
  ]);
  const categoryItemMap = new Map<ArticleCategory | "all", WordCloudItem[]>([
    ["all", allItems],
    ...categoryOrder.map((category, index) => [category, categoryItems[index]] as const),
  ]);
  const eyebrow = "WORD CLOUD INSIGHTS";
  const cloudTitle = lang === "zh" ? "词云洞察" : "Word Cloud Insights";

  return (
    <div className="shell page-stack cloud-page">
      <section className="cloud-hero" aria-labelledby="word-cloud-title">
        <div className="cloud-hero__mark" aria-hidden="true">
          <span />
        </div>
        <h1 id="word-cloud-title">{cloudTitle}</h1>
        <p className="cloud-hero__eyebrow">{eyebrow}</p>
        <p className="cloud-hero__summary">{dict.pageIntro.cloudSummary}</p>
      </section>
      <section className="cloud-insight-grid">
        {cloudCardMeta.map((meta) => {
          const title = meta.key === "all" ? dict.wordCloud.all : categoryLabels[lang][meta.key];
          const items = categoryItemMap.get(meta.key) ?? [];

          return (
            <article key={meta.key} className={`cloud-card cloud-card--${meta.tone}`}>
              <header className="cloud-card__header">
                <span className="cloud-card__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <div>
                  <h2>{title}</h2>
                  <span aria-hidden="true" />
                </div>
                <span className="cloud-card__menu" aria-hidden="true">
                  ···
                </span>
              </header>
              <WordCloud locale={lang} items={items} variant="light" mode="insight" maxItems={18} showPrompt={false} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
