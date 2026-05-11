package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.entity.SourceEntity;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SourceCrawlerServiceTest {
  private HttpServer server;
  private String baseUrl;
  private final SourceCrawlerService crawler = new SourceCrawlerService();
  private final CrawlWindow window = new CrawlWindow(
      LocalDateTime.of(2024, 1, 1, 0, 0),
      LocalDateTime.of(2024, 12, 31, 23, 59),
      false);

  @BeforeEach
  void startServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    baseUrl = "http://localhost:" + server.getAddress().getPort();
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void parsesRssFeedCandidates() {
    route("/feed.xml", """
        <rss><channel>
          <item>
            <title>Remote sensing data platform released</title>
            <description>Earth observation data services support geospatial applications.</description>
            <link>%s/news/20240212/rss-article.html</link>
            <pubDate>Mon, 12 Feb 2024 10:00:00 GMT</pubDate>
            <category>remote sensing</category>
          </item>
        </channel></rss>
        """.formatted(baseUrl));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"rss","feedUrls":["%s/feed.xml"],"itemLimit":10,"whitelist":["remote sensing"]}
        """.formatted(baseUrl)), window);

    assertThat(result.candidates()).hasSize(1);
    assertThat(result.pageCount()).isEqualTo(1);
    assertThat(result.candidates().getFirst().title()).contains("Remote sensing");
  }

  @Test
  void followsHtmlPaginationTemplate() {
    route("/list/1", """
        <a href="/news/20240310/article-1.html">遥感监测平台发布</a>
        """);
    route("/list/2", """
        <a href="/news/20240311/article-2.html">测绘地理信息技术进展</a>
        """);
    route("/news/20240310/article-1.html", article("遥感监测平台发布", "2024-03-10", "遥感监测平台面向地球观测和地理信息业务提供持续服务能力。"));
    route("/news/20240311/article-2.html", article("测绘地理信息技术进展", "2024-03-11", "测绘地理信息技术进展支撑时空数据治理和实景三维应用。"));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","paginationTemplate":"%s/list/{page}","maxPages":2,"itemLimit":10,"whitelist":["遥感","测绘"],"linkAllowPatterns":["article"]}
        """.formatted(baseUrl)), window);

    assertThat(result.candidates()).hasSize(2);
    assertThat(result.pageCount()).isEqualTo(2);
  }

  @Test
  void discoversArticlesFromSitemap() {
    route("/sitemap.xml", """
        <urlset>
          <url><loc>%s/news/2024/sitemap-article.html</loc><lastmod>2024-04-01</lastmod></url>
        </urlset>
        """.formatted(baseUrl));
    route("/news/2024/sitemap-article.html", article("Earth observation benchmark published", "2024-04-01", "Earth observation and geospatial benchmarks support remote sensing applications."));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"sitemap","entryUrl":"%s/sitemap.xml","itemLimit":10,"whitelist":["earth observation"],"linkAllowPatterns":["/news/2024/sitemap-article"]}
        """.formatted(baseUrl)), window);

    assertThat(result.candidates()).hasSize(1);
    assertThat(result.fetchedCount()).isEqualTo(1);
  }

  @Test
  void parsesEnglishDatesFromJsonLdArticlePages() {
    route("/feed-list", """
        <a href="/news/2024/earth-observation-mission-update.html">Earth observation mission update</a>
        """);
    route("/news/2024/earth-observation-mission-update.html", """
        <html><head>
          <meta name="description" content="Earth observation mission update for remote sensing programs.">
          <script type="application/ld+json">
            {"@type":"NewsArticle","datePublished":"April 3, 2024 09:15"}
          </script>
        </head><body><h1>Earth observation mission update</h1><p>Earth observation mission update for remote sensing programs.</p></body></html>
        """);

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","entryUrl":"%s/feed-list","itemLimit":10,"whitelist":["earth observation"],"linkAllowPatterns":["earth-observation"]}
        """.formatted(baseUrl)), window);

    assertThat(result.candidates()).hasSize(1);
    assertThat(result.candidates().getFirst().publishedAt()).isEqualTo(LocalDateTime.of(2024, 4, 3, 9, 15));
  }

  @Test
  void entryUrlDoesNotAlsoFetchSiteRoot() {
    route("/", """
        <a href="/distractor.html">General campus overview</a>
        """);
    route("/news-list", """
        <a href="/news/20240601/news-article.html">Geospatial lab releases new dataset</a>
        """);
    route("/news/20240601/news-article.html", article("Geospatial lab releases new dataset", "2024-06-01", "Geospatial lab releases a new remote sensing dataset for research."));
    route("/distractor.html", article("General campus overview", "2024-06-02", "General campus overview page that should not be crawled as news."));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","entryUrl":"%s/news-list","itemLimit":10,"whitelist":["geospatial"],"linkAllowPatterns":["news-article"]}
        """.formatted(baseUrl)), window);

    assertThat(result.pageCount()).isEqualTo(1);
    assertThat(result.candidates()).hasSize(1);
    assertThat(result.candidates().getFirst().originalUrl()).endsWith("/news/20240601/news-article.html");
  }

  @Test
  void skipsLinksThatAreNotStrictDetailUrls() {
    route("/list-nondetail", """
        <a href="/about.html">Remote sensing center overview</a>
        """);
    route("/about.html", article("Remote sensing center overview", "2024-06-02", "Remote sensing center overview for geospatial services."));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","entryUrl":"%s/list-nondetail","itemLimit":10,"whitelist":["remote sensing"]}
        """.formatted(baseUrl)), window);

    assertThat(result.pageCount()).isEqualTo(1);
    assertThat(result.fetchedCount()).isEqualTo(0);
    assertThat(result.candidates()).isEmpty();
  }

  @Test
  void skipsHtmlArticleWhenPublishedDateCannotBeFound() {
    route("/list-no-date", """
        <a href="/news/2024/no-date-article.html">Remote sensing article without a date</a>
        """);
    route("/news/2024/no-date-article.html", """
        <html><body>
          <h1>Remote sensing article without a date</h1>
          <p>Remote sensing services support geospatial and smart city operations.</p>
        </body></html>
        """);

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","entryUrl":"%s/list-no-date","itemLimit":10,"whitelist":["remote sensing"],"linkAllowPatterns":["no-date-article"]}
        """.formatted(baseUrl)), window);

    assertThat(result.fetchedCount()).isEqualTo(1);
    assertThat(result.candidates()).isEmpty();
  }

  @Test
  void followsHtmlPaginationTemplatesArray() {
    route("/multi/1", """
        <a href="/news/20240701/multi-one.html">Remote sensing platform one</a>
        """);
    route("/multi/2", """
        <a href="/news/20240702/multi-two.html">Smart city platform two</a>
        """);
    route("/news/20240701/multi-one.html", article("Remote sensing platform one", "2024-07-01", "Remote sensing platform supports geospatial data operations."));
    route("/news/20240702/multi-two.html", article("Smart city platform two", "2024-07-02", "Smart city platform supports geospatial data operations."));

    SourceCrawlResult result = crawler.crawl(source("""
        {"parser":"html-list","paginationTemplates":[{"template":"%s/multi/{page}","start":1,"end":2}],"itemLimit":10,"whitelist":["remote sensing","smart city"],"linkAllowPatterns":["multi"]}
        """.formatted(baseUrl)), window);

    assertThat(result.pageCount()).isEqualTo(2);
    assertThat(result.candidates()).hasSize(2);
  }

  private SourceEntity source(String crawlRuleJson) {
    SourceEntity source = new SourceEntity();
    source.setSourceCode("fixture");
    source.setName("Fixture");
    source.setType("test");
    source.setSiteUrl(baseUrl);
    source.setLanguage("zh");
    source.setTrustLevel("high");
    source.setActive(true);
    source.setCrawlRuleJson(crawlRuleJson);
    return source;
  }

  private void route(String path, String body) {
    server.createContext(path, exchange -> {
      byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "text/html; charset=utf-8");
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
  }

  private static String article(String title, String date, String summary) {
    return """
        <html><head>
          <meta name="PubDate" content="%s">
          <meta name="description" content="%s">
        </head><body><h1>%s</h1><p>%s</p></body></html>
        """.formatted(date, summary, title, summary);
  }
}
