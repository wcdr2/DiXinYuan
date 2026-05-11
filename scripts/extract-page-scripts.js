const url = process.argv[2];

fetch(url, { headers: { "user-agent": "Mozilla/5.0 gx-geo-news/script-probe" } })
  .then((response) => response.text())
  .then((text) => {
    for (const match of text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      try {
        console.log(new URL(match[1], url).toString());
      } catch {
        console.log(match[1]);
      }
    }
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
