const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 12);
const MIN_DATE = new Date("2024-01-01T00:00:00+08:00");
const MAX_DATE = new Date();
const REQUIRED_SUMMARY_TERMS = [
  "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息",
  "实景三维", "时空智能", "自然资源数字化", "低空遥感", "数字孪生", "智慧城市",
];

const SOURCES = [
  { id: "gpsworld", name: "GPS World", siteUrl: "https://www.gpsworld.com", apiUrl: "https://www.gpsworld.com/wp-json/wp/v2/posts?per_page=100", maxPages: 10 },
  { id: "geojobe", name: "GEO Jobe", siteUrl: "https://geo-jobe.com", apiUrl: "https://geo-jobe.com/wp-json/wp/v2/posts?per_page=100", maxPages: 12 },
  { id: "qgis-blog", name: "QGIS Blog", siteUrl: "https://blog.qgis.org", feedUrl: "https://blog.qgis.org/feed/", maxPages: 8 },
  { id: "carto-blog", name: "CARTO Blog", siteUrl: "https://carto.com", feedUrl: "https://carto.com/blog/rss.xml", maxPages: 8 },
  { id: "maptiler", name: "MapTiler", siteUrl: "https://www.maptiler.com", feedUrl: "https://www.maptiler.com/news/feed.xml", maxPages: 8 },
  { id: "maplibre", name: "MapLibre", siteUrl: "https://maplibre.org", feedUrl: "https://maplibre.org/news/index.xml", maxPages: 8 },
  { id: "osgeo", name: "OSGeo", siteUrl: "https://www.osgeo.org", feedUrl: "https://www.osgeo.org/foundation-news/feed/", maxPages: 8 },
  { id: "opengisch", name: "OPENGIS.ch", siteUrl: "https://www.opengis.ch", feedUrl: "https://www.opengis.ch/feed/", maxPages: 8 },
  { id: "north-road", name: "North Road", siteUrl: "https://north-road.com", feedUrl: "https://north-road.com/feed/", maxPages: 8 },
  { id: "mergin-maps", name: "Mergin Maps", siteUrl: "https://merginmaps.com", feedUrl: "https://merginmaps.com/blog/feed.xml", maxPages: 8 },
  { id: "vgis", name: "vGIS", siteUrl: "https://www.vgis.io", feedUrl: "https://www.vgis.io/feed.xml", maxPages: 8 },
  { id: "iqgeo", name: "IQGeo", siteUrl: "https://www.iqgeo.com", feedUrl: "https://www.iqgeo.com/blog/rss.xml", maxPages: 8 },
  { id: "vertigis", name: "VertiGIS", siteUrl: "https://www.vertigis.com", feedUrl: "https://www.vertigis.com/feed", maxPages: 8 },
  { id: "overture-maps", name: "Overture Maps Foundation", siteUrl: "https://overturemaps.org", feedUrl: "https://overturemaps.org/feed/", maxPages: 8 },
  { id: "crunchydata", name: "Crunchy Data", siteUrl: "https://www.crunchydata.com", feedUrl: "https://www.crunchydata.com/blog/rss.xml", maxPages: 8 },
  { id: "openstreetmap-us", name: "OpenStreetMap US", siteUrl: "https://openstreetmap.us", feedUrl: "https://openstreetmap.us/news/rss.xml", maxPages: 8 },
  { id: "mappitall", name: "Mappitall", siteUrl: "https://www.mappitall.com", feedUrl: "https://www.mappitall.com/feed/", maxPages: 8 },
  { id: "bostongis", name: "BostonGIS", siteUrl: "https://www.bostongis.com", feedUrl: "https://www.bostongis.com/blog/index.php?/feeds/index.rss2", maxPages: 8 },
  { id: "geography-realm", name: "Geography Realm", siteUrl: "https://www.geographyrealm.com", apiUrl: "https://www.geographyrealm.com/wp-json/wp/v2/posts?per_page=100", maxPages: 10 },
  { id: "pob", name: "Point of Beginning", siteUrl: "https://www.pobonline.com", feedUrl: "https://www.pobonline.com/rss/articles", maxPages: 8 },
  { id: "sensors-systems", name: "Sensors & Systems", siteUrl: "https://sensorsandsystems.com", feedUrl: "https://sensorsandsystems.com/feed/", maxPages: 8 },
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
    .replace(/\s+/g, " ")
    .trim();
}

function hasRequiredTerm(value) {
  return REQUIRED_SUMMARY_TERMS.some((term) => String(value || "").includes(term));
}

function paragraphs(html) {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((item) => item.length >= 12);
}

function chooseSummary(html) {
  return paragraphs(html).find(hasRequiredTerm) || "";
}

function parseDate(value) {
  const text = cleanText(value);
  let date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;
  const match = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) return new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00+08:00`);
  return null;
}

function inRange(date) {
  return date && date >= MIN_DATE && date <= MAX_DATE;
}

function canonicalUrl(value) {
  return String(value || "").trim().replace(/#.*$/, "").replace(/\/+$/, "");
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
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/source-probe" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
  return { text: await response.text(), finalUrl: response.url };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gx-geo-news/source-probe", accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function apiCandidates(source) {
  const candidates = [];
  for (let page = 1; page <= source.maxPages; page++) {
    let posts;
    try {
      const url = new URL(source.apiUrl);
      url.searchParams.set("page", String(page));
      posts = await fetchJson(url.toString());
    } catch {
      break;
    }
    if (!Array.isArray(posts) || posts.length === 0) break;
    for (const post of posts) {
      const date = parseDate(post.date_gmt ? `${post.date_gmt}Z` : post.date || "");
      if (!inRange(date)) continue;
      candidates.push({ title: cleanText(post.title?.rendered || ""), url: canonicalUrl(post.link || ""), date });
    }
  }
  return candidates;
}

async function feedCandidates(source) {
  const candidates = [];
  try {
    const feed = await fetchText(source.feedUrl);
    const nodes = [...feed.text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0])
      .concat([...feed.text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]));
    for (const node of nodes) {
      const linkTag = node.match(/<link\b([^>]*)\/?>/i)?.[1] || "";
      const url = canonicalUrl(field(node, ["link"]) || attr(linkTag, "href") || field(node, ["guid"]));
      const date = parseDate(field(node, ["pubDate", "published", "updated", "dc:date"]));
      if (!url || !inRange(date)) continue;
      candidates.push({ title: cleanText(field(node, ["title"])), url, date });
    }
  } catch {
    return candidates;
  }
  return candidates;
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function probe(source) {
  const candidates = source.apiUrl ? await apiCandidates(source) : await feedCandidates(source);
  const limited = candidates.slice(0, Number(process.env.PROBE_LIMIT || 160));
  const checked = await mapLimit(limited, CONCURRENCY, async (candidate) => {
    try {
      const page = await fetchText(candidate.url);
      const summary = chooseSummary(page.text);
      return { ok: Boolean(summary), url: candidate.url };
    } catch {
      return { ok: false, url: candidate.url };
    }
  });
  return {
    id: source.id,
    name: source.name,
    candidates: candidates.length,
    checked: limited.length,
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
