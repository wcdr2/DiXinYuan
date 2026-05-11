import Link from "next/link";
import { notFound } from "next/navigation";
import entityWhitelist from "@/datasets/config/entity-whitelist.json";
import { getRuntimeArticles, getRuntimeLogs, getRuntimeSources } from "@/lib/backend-data";
import { formatDate, isLocale } from "@/lib/data";
import { getArticleHref, getDictionary, sourceTypeLabels } from "@/lib/site";
import type { Article, Source } from "@/lib/types";

interface SourcesPageProps {
  params: Promise<{ lang: string }>;
}

interface WhitelistEntity {
  country?: string;
}

interface EntityWhitelistDataset {
  count?: number;
  entities?: WhitelistEntity[];
}

const whitelistDataset = entityWhitelist as EntityWhitelistDataset;

function getSourceTarget(source: Source) {
  return (
    source.crawlRule.entryUrl ??
    source.crawlRule.apiUrl ??
    source.crawlRule.feedUrls?.[0] ??
    source.crawlRule.fallbackEntryUrls?.[0] ??
    source.siteUrl
  );
}

function getLatestArticleForSource(sourceName: string, articles: Article[]) {
  return articles.find((article) => article.sourceName === sourceName);
}

function isDomesticWhitelistEntity(entity: WhitelistEntity) {
  const country = entity.country?.trim().toLowerCase();
  return country === "中国" || country === "china";
}

function isInternationalSource(source: Source) {
  return source.type === "international";
}

function getLogStatusLabel(lang: string, status: string) {
  if (lang !== "zh") {
    return status;
  }
  const labels: Record<string, string> = {
    fetched: "已抓取",
    skipped: "已跳过",
    failed: "失败",
    seeded: "种子数据",
    running: "运行中",
    已抓取: "已抓取",
    已跳过: "已跳过",
    失败: "失败",
    种子数据: "种子数据",
    运行中: "运行中",
  };
  return labels[status] ?? status;
}

function getRejectReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    title_too_short: "标题过短",
    summary_too_short: "摘要过短或没有正文摘要",
    missing_published_at: "缺少发布时间",
    published_at_out_of_range: "发布时间不在范围内",
    summary_not_from_body: "摘要不是正文子串",
    summary_required_term_missing: "摘要缺少必需硬词",
    body_missing: "缺少正文",
    body_relevance_failed: "正文强相关不足",
    source_not_whitelisted: "来源不在白名单",
    source_url_domain_mismatch: "新闻 URL 不属于来源域名",
    not_detail_url: "不是具体新闻详情页",
    url_inaccessible: "URL 不可访问",
    keyword_not_matched: "关键词规则未命中",
  };
  return labels[reason] ?? reason;
}

function translateRejectReasons(value: string) {
  return value.replace(/rejectReasons=\{([^}]*)}/g, (_, content: string) => {
    const summary = content
      .split(/,\s*/)
      .map((item) => {
        const [reason, count] = item.split("=");
        return reason && count ? `${getRejectReasonLabel(reason.trim())} ${count.trim()} 条` : "";
      })
      .filter(Boolean)
      .join("，");
    return summary ? `拒绝原因：${summary}` : "拒绝原因：未知";
  });
}

function getLogDiagnosticLabel(lang: string, value?: string) {
  const raw = value?.trim();
  if (!raw) {
    return "-";
  }
  if (lang !== "zh") {
    return raw;
  }
  let text = raw
    .replace(
      "No in-window candidates were fetched.",
      "发现了链接/条目，但没有发布日期落在本次抓取时间窗口内的详情页候选。",
    )
    .replace(/Fetched (\d+) candidates from (\d+) pages\/feeds\./g, "找到 $1 条时间窗口内候选，检查了 $2 个页面/订阅。")
    .replace("Source crawl failed.", "来源抓取失败。")
    .replace(/HTTP error fetching URL\. Status=(\d+)/gi, "HTTP 访问失败，状态码 $1")
    .replace(/pages=/g, "页面/订阅数=");
  text = translateRejectReasons(text);
  if (text.includes("Received fatal alert: unrecognized_name")) {
    return "TLS 握手失败：来源站点不接受当前域名证书握手。";
  }
  if (text.toLowerCase().includes("timed out")) {
    return "访问超时。";
  }
  return text;
}

export default async function SourcesPage({ params }: SourcesPageProps) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const dict = getDictionary(lang);
  const [sources, logs, articles] = await Promise.all([
    getRuntimeSources(),
    getRuntimeLogs(),
    getRuntimeArticles(),
  ]);
  const labels =
    lang === "zh"
      ? {
          target: "采集入口",
          latest: "最近一条内容",
          status: "状态",
          fetched: "发现链接",
          candidates: "候选",
          accepted: "通过",
          rejected: "拒绝",
          published: "入库",
          finished: "完成时间",
          diagnostics: "诊断",
          source: "来源",
        }
      : {
          target: "Crawl target",
          latest: "Latest item",
          status: "Status",
          fetched: "Fetched",
          candidates: "Candidates",
          accepted: "Accepted",
          rejected: "Rejected",
          published: "Published",
          finished: "Finished",
          diagnostics: "Diagnostics",
          source: "Source",
        };
  const whitelistEntities = whitelistDataset.entities ?? [];
  const whitelistTotal = whitelistDataset.count ?? whitelistEntities.length;
  const whitelistDomestic = whitelistEntities.filter(isDomesticWhitelistEntity).length;
  const whitelistForeign = Math.max(0, whitelistTotal - whitelistDomestic);
  const sourceTotal = sources.length;
  const sourceForeign = sources.filter(isInternationalSource).length;
  const sourceDomestic = Math.max(0, sourceTotal - sourceForeign);
  const sourceStats =
    lang === "zh"
      ? [
          { label: "白名单总数", value: whitelistTotal },
          { label: "国内白名单", value: whitelistDomestic },
          { label: "国外白名单", value: whitelistForeign },
          { label: "新闻来源总数", value: sourceTotal },
          { label: "国内来源", value: sourceDomestic },
          { label: "国外来源", value: sourceForeign },
        ]
      : [
          { label: "Whitelist total", value: whitelistTotal },
          { label: "Domestic whitelist", value: whitelistDomestic },
          { label: "International whitelist", value: whitelistForeign },
          { label: "News sources", value: sourceTotal },
          { label: "Domestic sources", value: sourceDomestic },
          { label: "International sources", value: sourceForeign },
        ];

  return (
    <div className="shell page-stack">
      <section className="page-intro card-panel">
        <p className="section-kicker">{dict.nav.sources}</p>
        <h1>{dict.pageIntro.sourcesTitle}</h1>
        <p>{dict.pageIntro.sourcesSummary}</p>
      </section>

      <section className="section-block">
        <div className="source-metric-grid">
          {sourceStats.map((stat) => (
            <div key={stat.label} className="source-metric-card">
              <span>{stat.label}</span>
              <strong>{stat.value.toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{dict.sources.whitelistTitle}</p>
            <h2>{dict.sources.whitelistTitle}</h2>
          </div>
        </div>
        <div className="source-grid">
          {sources.map((source) => {
            const targetUrl = getSourceTarget(source);
            const latestArticle = getLatestArticleForSource(source.name, articles);

            return (
              <article key={source.id} className="card-panel source-card card-panel--soft">
                <div className="article-meta-row">
                  <span className="category-pill category-pill--policy">
                    {sourceTypeLabels[lang][source.type]}
                  </span>
                  <span>{source.trustLevel.toUpperCase()}</span>
                </div>
                <h3>{source.name}</h3>
                <p>{source.crawlRule.notes}</p>
                <div className="source-card__meta">
                  <div>
                    <span className="detail-label">{labels.target}</span>
                    <a href={targetUrl} target="_blank" rel="noreferrer noopener" className="text-link source-card__link">
                      {targetUrl}
                    </a>
                  </div>
                  {latestArticle ? (
                    <div>
                      <span className="detail-label">{labels.latest}</span>
                      <Link href={getArticleHref(lang, latestArticle)} className="text-link source-card__link">
                        {latestArticle.title}
                      </Link>
                      <p>{formatDate(lang, latestArticle.publishedAt)}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">{dict.sources.logsTitle}</p>
            <h2>{dict.sources.logsTitle}</h2>
          </div>
        </div>
        <div className="card-panel table-panel card-panel--soft">
          <p className="panel-note">{dict.sources.logsSummary}</p>
          <div className="log-table">
            <div className="log-table__header">
              <span>{labels.source}</span>
              <span>{labels.status}</span>
              <span>{labels.fetched}</span>
              <span>{labels.candidates}</span>
              <span>{labels.accepted}</span>
              <span>{labels.rejected}</span>
              <span>{labels.published}</span>
              <span>{labels.finished}</span>
              <span>{labels.diagnostics}</span>
            </div>
            {logs.map((log) => {
              const diagnostic = getLogDiagnosticLabel(lang, log.errorMessage || log.note);

              return (
                <div key={log.sourceId} className="log-table__row">
                  <span>{log.sourceName}</span>
                  <span>{getLogStatusLabel(lang, log.status)}</span>
                  <span>{log.fetchedCount}</span>
                  <span>{log.candidateCount ?? "-"}</span>
                  <span>{log.acceptedCount ?? "-"}</span>
                  <span>{log.rejectedCount ?? "-"}</span>
                  <span>{log.publishedCount}</span>
                  <span>{formatDate(lang, log.finishedAt)}</span>
                  <span title={diagnostic}>{diagnostic}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
