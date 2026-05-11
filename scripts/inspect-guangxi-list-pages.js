const urls = [
  "https://dnr.gxzf.gov.cn/xwzx/zrzx/",
  "https://dnr.gxzf.gov.cn/xwzx/zrzx/index.shtml",
  "http://zrzyj.nanning.gov.cn/xwdt_57/nndt/",
  "http://zrzyj.nanning.gov.cn/zwgk_57/tzgg/bjtz/",
  "http://zrzyj.guilin.gov.cn/zrzyzx/dtyw/",
];

async function main() {
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 gx-geo-news/list-inspector" } });
      const text = await response.text();
      const links = [...text.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => ({
          href: match[1],
          text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        }))
        .slice(0, 80);
      console.log(JSON.stringify({
        url,
        status: response.status,
        finalUrl: response.url,
        length: text.length,
        pageTokens: [...new Set((text.match(/(?:index|list|page|default)_?\d+|_\d+\.s?html/g) || []).slice(0, 50))],
        links,
      }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({ url, error: error.message }, null, 2));
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
