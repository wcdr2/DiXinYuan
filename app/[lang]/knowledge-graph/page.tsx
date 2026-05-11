import { notFound } from "next/navigation";
import { GraphExplorer } from "@/components/graph-explorer";
import { getRuntimeArticles, getRuntimeGraphDataset } from "@/lib/backend-data";
import { isLocale } from "@/lib/data";
import type { GraphElementClass } from "@/lib/types";

interface GraphPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveInitialClass(value: string | undefined): GraphElementClass | "all" {
  if (value === "subject" || value === "goal" || value === "content" || value === "activity" || value === "evaluation") {
    return value;
  }
  return "all";
}

export default async function GraphPage({ params, searchParams }: GraphPageProps) {
  const [{ lang }, rawSearchParams] = await Promise.all([params, searchParams]);

  if (!isLocale(lang)) {
    notFound();
  }

  const [graph, articles] = await Promise.all([getRuntimeGraphDataset(), getRuntimeArticles()]);
  const initialRegion = firstValue(rawSearchParams.region) ?? "all";
  const initialClass = resolveInitialClass(firstValue(rawSearchParams.class));

  return (
    <div className="graph-page graph-page--fullscreen">
      <GraphExplorer locale={lang} dataset={graph} articles={articles} initialRegion={initialRegion} initialClass={initialClass} />
    </div>
  );
}
