"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeLabels } from "@/lib/site";
import type { Locale } from "@/lib/types";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const pathname = usePathname();

  return (
    <div className="language-switcher" aria-label="Language switcher">
      {(["zh", "en"] as Locale[]).map((targetLocale) => {
        const segments = pathname.split("/");
        segments[1] = targetLocale;
        const href = segments.join("/") || `/${targetLocale}`;

        return (
          <Link
            key={targetLocale}
            href={href}
            className={targetLocale === locale ? "language-pill is-active" : "language-pill"}
          >
            {localeLabels[targetLocale]}
          </Link>
        );
      })}
    </div>
  );
}
