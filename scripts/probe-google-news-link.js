const link = process.argv[2];

fetch(link, { headers: { "user-agent": "Mozilla/5.0" } })
  .then((response) => response.text())
  .then((text) => {
    for (const marker of ["data-n-au", "data-n-a-sg", "data-n-a-ts", "https://www.news.cn", "news.cn", "href="]) {
      console.log(marker, text.indexOf(marker));
    }
    const urls = text.match(/https?:\/\/[^"'<> ]+/g) || [];
    console.log(urls.slice(0, 50).join("\n"));
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
