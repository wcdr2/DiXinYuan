import { notFound } from "next/navigation";
import { WordCloud } from "@/components/word-cloud";
import { getWordCloudItems, isLocale } from "@/lib/data";
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
          <WordCloud locale={lang} items={getWordCloudItems("all")} variant="light" />
        </div>
        {categoryOrder.map((category) => (
          <div key={category} className="card-panel card-panel--soft">
            <h2>{categoryLabels[lang][category]}</h2>
            <WordCloud locale={lang} items={getWordCloudItems(category)} variant="light" />
          </div>
        ))}
      </section>
    </div>
  );
}
