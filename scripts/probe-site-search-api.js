const url = process.argv[2];

fetch(url, { headers: { "user-agent": "Mozilla/5.0 gx-geo-news/site-api-probe" } })
  .then((response) => response.text())
  .then((text) => {
    console.log(`status textLength=${text.length}`);
    const urls = [...text.matchAll(/https?:\/\/[^"'<>\\\s]+/g)].map((match) => match[0]);
    console.log([...new Set(urls)].slice(0, 100).join("\n"));
    const apiMatches = [...text.matchAll(/[A-Za-z0-9_./:-]{0,80}(?:api|search|Search|solr|graphql|ajax|json)[A-Za-z0-9_./:-]{0,120}/g)]
      .map((match) => match[0])
      .filter((item) => item.length > 4);
    console.log("--- api-like ---");
    console.log([...new Set(apiMatches)].slice(0, 200).join("\n"));
    console.log("--- base-like ---");
    for (const pattern of [/yr=([^,;]+)/g, /const yr=([^,;]+)/g, /baseURL:([^,}]+)/g]) {
      let match;
      while ((match = pattern.exec(text)) && match.index < 850000) {
        console.log(match.index, match[0].slice(0, 240));
      }
    }
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
