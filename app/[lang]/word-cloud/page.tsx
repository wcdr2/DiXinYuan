import { notFound } from "next/navigation";
import { WordCloud } from "@/components/word-cloud";
import { getRuntimeWordCloudItems } from "@/lib/backend-data";
import { isLocale } from "@/lib/data";
import { categoryLabels, categoryOrder, getDictionary } from "@/lib/site";

interface WordCloudPageProps {
  params: Promise<{ lang: string }>;
}

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

  return (
    <div className="shell page-stack">
      <section className="page-intro card-panel">
        <p className="section-kicker">{dict.nav.wordCloud}</p>
        <h1>{dict.pageIntro.cloudTitle}</h1>
        <p>{dict.pageIntro.cloudSummary}</p>
      </section>
      <section className="cloud-grid">
        <div className="card-panel card-panel--soft">
          <h2>{dict.wordCloud.all}</h2>
          <WordCloud locale={lang} items={allItems} variant="light" />
        </div>
        {categoryOrder.map((category, index) => (
          <div key={category} className="card-panel card-panel--soft">
            <h2>{categoryLabels[lang][category]}</h2>
            <WordCloud locale={lang} items={categoryItems[index]} variant="light" />
          </div>
        ))}
      </section>
    </div>
  );
}
