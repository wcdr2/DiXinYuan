import Link from "next/link";
import { getDictionary, withLocale } from "@/lib/site";
import type { Locale } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { ReactNode } from "react";

interface SiteShellProps {
  locale: Locale;
  children: ReactNode;
}

export function SiteShell({ locale, children }: SiteShellProps) {
  const dict = getDictionary(locale);
  const navItems = [
    { label: dict.nav.home, href: withLocale(locale) },
    { label: dict.nav.news, href: withLocale(locale, "/news") },
    { label: dict.nav.wordCloud, href: withLocale(locale, "/word-cloud") },
    { label: dict.nav.map, href: withLocale(locale, "/map") },
    { label: dict.nav.graph, href: withLocale(locale, "/knowledge-graph") },
    { label: dict.nav.sources, href: withLocale(locale, "/sources") },
    { label: dict.nav.about, href: withLocale(locale, "/about") },
  ];

  return (
    <div className="site-frame">
      <header className="site-header">
        <div className="shell header-topline">
          <div className="header-line" aria-hidden="true" />
          <div className="header-utility">
            <LanguageSwitcher locale={locale} />
            <form action={withLocale(locale, "/news")} className="site-search" role="search">
              <label htmlFor={`site-search-${locale}`} className="sr-only">
                {dict.search.label}
              </label>
              <input
                id={`site-search-${locale}`}
                name="query"
                type="search"
                placeholder={dict.search.placeholder}
              />
              <button type="submit">{dict.search.button}</button>
            </form>
          </div>
        </div>
        <div className="shell header-main">
          <Link href={withLocale(locale)} className="brand-mark">
            <span className="brand-wordmark" aria-hidden="true">
              <span className="brand-wordmark__lead">GX</span>
              <span className="brand-wordmark__accent">GEO</span>
            </span>
            <span className="brand-copy">
              <strong>{dict.siteName}</strong>
              <small>{dict.siteTagline}</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="site-nav__link">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-grid">
          <div>
            <p className="footer-kicker">{dict.siteName}</p>
            <p className="footer-summary">{dict.footer.summary}</p>
          </div>
          <div className="footer-links">
            {navItems.map((item) => (
              <Link key={`footer-${item.href}`} href={item.href} className="text-link text-link--footer">
                {item.label}
              </Link>
            ))}
          </div>
          <div>
            <p className="footer-note">{dict.footer.note}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
