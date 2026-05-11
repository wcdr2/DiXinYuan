const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 8);
const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息",
  "实景三维", "时空智能", "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

const SOURCES = [
  { id: "nn-dnr", name: "南宁市自然资源局", url: "http://zrzyj.nanning.gov.cn/" },
  { id: "gl-dnr", name: "桂林市自然资源局", url: "http://zrzyj.guilin.gov.cn/" },
  { id: "lz-dnr", name: "柳州市自然资源和规划局", url: "http://lz.dnr.gxzf.gov.cn/" },
  { id: "wz-dnr", name: "梧州市自然资源局", url: "http://zrzyj.wuzhou.gov.cn/" },
  { id: "bh-dnr", name: "北海市自然资源局", url: "http://www.beihai.gov.cn/xxgkbm/bhszrzyj/index.shtml" },
  { id: "fcg-dnr", name: "防城港市自然资源局", url: "http://fcg.dnr.gxzf.gov.cn/" },
  { id: "gg-dnr", name: "贵港市自然资源局", url: "http://gg.dnr.gxzf.gov.cn/" },
  { id: "yl-dnr", name: "玉林市自然资源局", url: "http://zrzyj.yulin.gov.cn/" },
  { id: "bs-dnr", name: "百色市自然资源局", url: "http://zrzyj.baise.gov.cn/" },
  { id: "hz-dnr", name: "贺州市自然资源局", url: "http://hz.dnr.gxzf.gov.cn/" },
  { id: "hc-dnr", name: "河池市自然资源局", url: "http://zrzyj.hechi.gov.cn/" },
  { id: "lb-dnr", name: "来宾市自然资源局", url: "http://lb.dnr.gxzf.gov.cn/" },
  { id: "cz-dnr", name: "崇左市自然资源局", url: "http://cz.dnr.gxzf.gov.cn/" },
  { id: "gx-geo-info-center", name: "广西基础地理信息中心", url: "http://www.gxjcdlxxzx.com/" },
  { id: "gx-survey-association-old", name: "广西测绘学会旧站", url: "http://www.gxchxh.org.cn/" },
  { id: "gx-survey-association", name: "广西测绘学会", url: "https://www.gxchxh.com/" },
  { id: "digital-guangxi", name: "数字广西集团", url: "https://www.gxdig.com/news/" },
  { id: "gx-dnr-news", name: "广西自然资源厅新闻", url: "https://dnr.gxzf.gov.cn/xwzx/" },
  { id: "gx-gov-policy", name: "广西政府政策", url: "https://www.gxzf.gov.cn/zfwj/zxwj/" },
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

function attr(tag, name) {
  return decodeEntities((tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i")) || [])[1] || "");
}

function isDetailUrl(value) {
  try {
    const url = new URL(value);
    const lower = url.pathname.toLowerCase().replace(/\/+$/, "");
    if (!lower || lower === "/") return false;
    if (/\/(news|dt|list|index)$/.test(lower) || /\/(?:index|list)(?:[_-]\d+)*\.s?html?$/.test(lower)) return false;
    if (/\/(content|detail|info|article|post|story|news|xwzx|zwgk)\//.test(lower)) return true;
    const file = lower.slice(lower.lastIndexOf("/") + 1);
    if (/^t\d+(?:_\d+)?\.s?html?$/i.test(file)) return true;
    if (/^\d{5,}\.s?html?$/i.test(file)) return true;
    return /(20\d{2}|\d{6,}).*\.s?html?$/i.test(lower);
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/guangxi-probe" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
  return { text: await response.text(), finalUrl: response.url };
}

function links(html, baseUrl) {
  const out = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(match[1], "href");
    const title = cleanText(match[2]);
    if (!href || !title || title.length < 4) continue;
    try {
      const url = new URL(href, baseUrl).toString().replace(/#.*$/, "");
      if (isDetailUrl(url)) out.push({ title, url });
    } catch {
      continue;
    }
  }
  return [...new Map(out.map((item) => [item.url, item])).values()].slice(0, 80);
}

function bodySummary(html) {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .find((item) => item.length >= 12 && hasRequiredTerm(item)) || "";
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
  try {
    const list = await fetchText(source.url);
    const detailLinks = links(list.text, list.finalUrl || source.url);
    const checked = await mapLimit(detailLinks, CONCURRENCY, async (link) => {
      try {
        const page = await fetchText(link.url);
        const summary = bodySummary(page.text);
        return { ...link, ok: Boolean(summary), summary: summary.slice(0, 120) };
      } catch (error) {
        return { ...link, ok: false, error: error.message };
      }
    });
    return {
      id: source.id,
      name: source.name,
      listOk: true,
      detailLinks: detailLinks.length,
      bodySummaryHits: checked.filter((item) => item.ok).length,
      samples: checked.filter((item) => item.ok).slice(0, 5),
      firstRejected: checked.find((item) => !item.ok) || null,
    };
  } catch (error) {
    return { id: source.id, name: source.name, listOk: false, error: error.message, detailLinks: 0, bodySummaryHits: 0, samples: [] };
  }
}

(async () => {
  const results = [];
  for (const source of SOURCES) {
    const result = await probe(source);
    results.push(result);
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ results }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
