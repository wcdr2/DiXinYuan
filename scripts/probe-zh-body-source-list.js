const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 10);
const MIN_DATE = new Date("2024-01-01T00:00:00+08:00");
const MAX_DATE = new Date();
const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息",
  "实景三维", "时空智能", "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

const SOURCES = [
  { id: "chintergeo", name: "中国测绘地理信息技术装备展", siteUrl: "https://www.chintergeo.com", feedUrl: "https://www.chintergeo.com/feed/" },
  { id: "3snews", name: "泰伯网", siteUrl: "https://www.3snews.net", feedUrl: "https://www.3snews.net/feed" },
  { id: "d1cm", name: "第一工程机械网", siteUrl: "https://news.d1cm.com", feedUrl: "https://news.d1cm.com/rss.xml" },
  { id: "smartcitychina", name: "中国智慧城市网", siteUrl: "http://www.cnscn.com.cn", feedUrl: "http://www.cnscn.com.cn/rss.xml" },
  { id: "digitalelite", name: "数字精英", siteUrl: "https://www.digitalelite.cn", feedUrl: "https://www.digitalelite.cn/feed/" },
  { id: "cctime", name: "飞象网", siteUrl: "http://www.cctime.com", feedUrl: "http://www.cctime.com/rss.xml" },
  { id: "eeo", name: "经济观察网", siteUrl: "https://www.eeo.com.cn", feedUrl: "https://www.eeo.com.cn/rss.xml" },
  { id: "ofweek", name: "OFweek", siteUrl: "https://www.ofweek.com", feedUrl: "https://www.ofweek.com/rss.xml" },
  { id: "iyiou", name: "亿欧", siteUrl: "https://www.iyiou.com", feedUrl: "https://www.iyiou.com/rss" },
  { id: "leiphone", name: "雷峰网", siteUrl: "https://www.leiphone.com", feedUrl: "https://www.leiphone.com/rss" },
  { id: "36kr", name: "36氪", siteUrl: "https://36kr.com", feedUrl: "https://36kr.com/feed" },
];

function cleanText(value) {
  return decodeEntities(String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .trim();
}

function hasRequiredTerm(value) {
  return REQUIRED_SUMMARY_TERMS.some((term) => String(value || "").includes(term));
}

function bodySummary(html) {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .find((item) => item.length >= 12 && hasRequiredTerm(item)) || "";
}

function parseDate(value) {
  const text = cleanText(value);
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) return new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00+08:00`);
  return null;
}

function inRange(date) {
  return date && date >= MIN_DATE && date <= MAX_DATE;
}

function field(node, names) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = node.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match) return decodeEntities(match[1]);
  }
  return "";
}

function attr(tag, name) {
  return decodeEntities((tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i")) || [])[1] || "");
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/zh-source-probe" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
  return { text: await response.text(), finalUrl: response.url };
}

async function feedCandidates(source) {
  try {
    const feed = await fetchText(source.feedUrl);
    const nodes = [...feed.text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0])
      .concat([...feed.text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]));
    return nodes.map((node) => {
      const linkTag = node.match(/<link\b([^>]*)\/?>/i)?.[1] || "";
      return {
        title: cleanText(field(node, ["title"])),
        url: cleanText(field(node, ["link"]) || attr(linkTag, "href") || field(node, ["guid"])).replace(/#.*$/, ""),
        date: parseDate(field(node, ["pubDate", "published", "updated", "dc:date"])),
      };
    }).filter((item) => item.url && inRange(item.date));
  } catch {
    return [];
  }
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) results[index] = await worker(items[index++]);
  });
  await Promise.all(workers);
  return results;
}

async function probe(source) {
  const candidates = await feedCandidates(source);
  const checked = await mapLimit(candidates.slice(0, Number(process.env.PROBE_LIMIT || 80)), CONCURRENCY, async (candidate) => {
    try {
      const page = await fetchText(candidate.url);
      return { ok: Boolean(bodySummary(page.text)), url: candidate.url };
    } catch {
      return { ok: false, url: candidate.url };
    }
  });
  return {
    id: source.id,
    name: source.name,
    candidates: candidates.length,
    checked: checked.length,
    bodySummaryHits: checked.filter((item) => item.ok).length,
    sample: checked.find((item) => item.ok)?.url || "",
  };
}

(async () => {
  const results = [];
  for (const source of SOURCES) {
    const result = await probe(source);
    results.push(result);
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ results: results.sort((a, b) => b.bodySummaryHits - a.bodySummaryHits) }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
