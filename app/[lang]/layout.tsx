import { SiteShell } from "@/components/site-shell";
import { isLocale, locales } from "@/lib/data";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

interface LangLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  return <SiteShell locale={lang}>{children}</SiteShell>;
}
