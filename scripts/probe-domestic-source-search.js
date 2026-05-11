const urls = process.argv.slice(2);

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function cleanText(value) {
  return decodeEntities(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 gx-geo-news/domestic-probe",
      "accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type") || "",
    text: await response.text(),
  };
}

function links(html, baseUrl) {
  const out = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = (match[1].match(/\bhref=["']([^"']+)["']/i) || [])[1] || "";
    const title = cleanText(match[2]);
    if (!href || !title) continue;
    try {
      out.push({ title, url: new URL(decodeEntities(href), baseUrl).toString() });
    } catch {
      continue;
    }
  }
  return out;
}

(async () => {
  for (const url of urls) {
    try {
      const page = await fetchText(url);
      const found = links(page.text, page.finalUrl || url)
        .filter((item) => /2026|20\d{2}|content|article|news|shipin|xinwen|c\.html|shtml|html/i.test(item.url + " " + item.title))
        .slice(0, 60);
      console.log(JSON.stringify({
        url,
        status: page.status,
        finalUrl: page.finalUrl,
        contentType: page.contentType,
        length: page.text.length,
        textStart: cleanText(page.text).slice(0, 300),
        links: found,
        apiLike: [...new Set((page.text.match(/https?:\/\/[^"'<>\\\s]+|[A-Za-z0-9_./:-]{0,80}(?:api|search|sou|so|json|ajax)[A-Za-z0-9_./:-]{0,120}/gi) || []).slice(0, 80))],
      }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({ url, error: error.message }, null, 2));
    }
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
