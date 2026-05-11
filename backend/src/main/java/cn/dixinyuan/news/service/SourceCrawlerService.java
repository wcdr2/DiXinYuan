package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.support.TimeSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.jsoup.Jsoup;
import org.jsoup.Connection;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

@Service
public class SourceCrawlerService {
  private static final String USER_AGENT =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  private static final HostnameVerifier TRUST_ALL_HOSTNAME_VERIFIER = (hostname, session) -> true;
  private static final SSLSocketFactory TRUST_ALL_SSL_SOCKET_FACTORY = buildTrustAllSslSocketFactory();
  private static final long MIN_HOST_INTERVAL_MILLIS = 300L;
  private static final Map<String, Object> HOST_LOCKS = new ConcurrentHashMap<>();
  private static final Map<String, Long> HOST_NEXT_REQUEST_AT = new ConcurrentHashMap<>();
  private final ObjectMapper objectMapper = new ObjectMapper();

  public SourceCrawlResult crawl(SourceEntity source, CrawlWindow window) {
    LocalDateTime earliest = null;
    LocalDateTime latest = null;
    try {
      JsonNode rule = parseRule(source);
      CrawlBundle bundle = crawlByRule(source, rule, window);
      for (CrawledArticleCandidate candidate : bundle.candidates()) {
        if (candidate.publishedAt() == null) {
          continue;
        }
        earliest = earliest == null || candidate.publishedAt().isBefore(earliest) ? candidate.publishedAt() : earliest;
        latest = latest == null || candidate.publishedAt().isAfter(latest) ? candidate.publishedAt() : latest;
      }
      String coverage = hasDeepCoverage(rule) ? "best_effort" : "partial";
      return new SourceCrawlResult(
          bundle.candidates(),
          bundle.fetchedCount(),
          bundle.pageCount(),
          bundle.candidates().isEmpty() ? "skipped" : "fetched",
          coverage,
          crawlNote(bundle),
          "",
          earliest,
          latest);
    } catch (Exception error) {
      return new SourceCrawlResult(
          List.of(),
          0,
          0,
          "failed",
          "failed",
          "来源抓取失败。",
          humanizeError(error),
          null,
          null);
    }
  }

  private CrawlBundle crawlByRule(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    if (isFeedMode(rule)) {
      return crawlFeed(source, rule, window);
    }
    if (isApiMode(rule)) {
      return crawlApi(source, rule, window);
    }
    if (isSitemapMode(rule)) {
      return crawlSitemap(source, rule, window);
    }
    return crawlHtml(source, rule, window);
  }

  private CrawlBundle crawlApi(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    String apiUrl = rule.path("apiUrl").asText("");
    if (apiUrl.isBlank()) {
      return CrawlBundle.empty();
    }
    int maxPages = rule.path("maxPages").asInt(10);
    int itemLimit = rule.path("itemLimit").asInt(30);
    List<CrawledArticleCandidate> items = new ArrayList<>();
    int fetched = 0;
    int pageCount = 0;
    int missingDate = 0;
    int outOfWindow = 0;
    int nonDetail = 0;
    for (int page = 1; page <= maxPages && items.size() < itemLimit; page++) {
      String url = appendPage(apiUrl, page);
      Document document = connect(url)
          .ignoreContentType(true)
          .get();
      pageCount++;
      JsonNode data = objectMapper.readTree(document.text());
      if (!data.isArray() || data.isEmpty()) {
        break;
      }
      boolean sawOlder = false;
      for (JsonNode post : data) {
        fetched++;
        LocalDateTime publishedAt = parseDate(post.path("date_gmt").asText(post.path("date").asText("")), source.getLanguage());
        if (publishedAt == null) {
          missingDate++;
          continue;
        }
        if (publishedAt.isBefore(window.startAt())) {
          sawOlder = true;
          outOfWindow++;
          continue;
        }
        if (!inWindow(publishedAt, window)) {
          outOfWindow++;
          continue;
        }
        String originalUrl = post.path("link").asText("");
        if (!NewsCleaningService.isDetailUrl(originalUrl)) {
          nonDetail++;
          continue;
        }
        String bodyText = NewsBodyTextSupport.extractBodyTextFromHtml(post.path("content").path("rendered").asText(""));
        String summary = NewsBodyTextSupport.chooseSummaryFromBodyText(bodyText);
        items.add(new CrawledArticleCandidate(
            text(post.path("title").path("rendered").asText("")),
            summary,
            "",
            source.getSiteUrl(),
            originalUrl,
            publishedAt,
            source.getLanguage(),
            List.of(),
            bodyText,
            Map.of(
                "apiUrl", url,
                "source", source.getSourceCode(),
                "payload", post.toString(),
                "bodyText", bodyText,
                "summarySource", "body")));
        if (items.size() >= itemLimit) {
          break;
        }
      }
      if (sawOlder) {
        break;
      }
    }
    return new CrawlBundle(items, fetched, pageCount, missingDate, outOfWindow, nonDetail);
  }

  private CrawlBundle crawlFeed(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    List<String> feedUrls = feedUrls(source, rule);
    int itemLimit = rule.path("itemLimit").asInt(50);
    List<CrawledArticleCandidate> items = new ArrayList<>();
    int fetched = 0;
    int pageCount = 0;
    int missingDate = 0;
    int outOfWindow = 0;
    int nonDetail = 0;
    for (String feedUrl : feedUrls) {
      if (items.size() >= itemLimit) {
        break;
      }
      Document document = connect(feedUrl)
          .ignoreContentType(true)
          .parser(Parser.xmlParser())
          .get();
      pageCount++;
      Elements rssItems = document.select("item");
      Elements atomItems = document.select("entry");
      Elements nodes = rssItems.isEmpty() ? atomItems : rssItems;
      for (Element node : nodes) {
        fetched++;
        LocalDateTime publishedAt = parseDate(firstText(
            childText(node, "pubDate"),
            childText(node, "published"),
            childText(node, "updated"),
            childText(node, "dc:date"),
            childText(node, "date")), source.getLanguage());
        String originalUrl = resolveUrl(feedUrl, firstText(
            childText(node, "link"),
            childAttr(node, "link[href]", "href"),
            childText(node, "guid"),
            source.getSiteUrl()));
        if (!NewsCleaningService.isDetailUrl(originalUrl)) {
          nonDetail++;
          continue;
        }
        if (publishedAt == null) {
          CrawledArticleCandidate detail = parseHtmlArticle(source, rule, originalUrl, null);
          if (detail == null || detail.publishedAt() == null) {
            missingDate++;
          } else if (inWindow(detail.publishedAt(), window)) {
            items.add(detail);
          } else {
            outOfWindow++;
          }
          if (items.size() >= itemLimit) {
            break;
          }
          continue;
        }
        if (!inWindow(publishedAt, window)) {
          outOfWindow++;
          continue;
        }
        String contentHtml = firstText(
            childText(node, "content:encoded"),
            childText(node, "content"),
            childText(node, "description"),
            childText(node, "summary"));
        String bodyText = NewsBodyTextSupport.extractBodyTextFromHtml(contentHtml);
        String summary = NewsBodyTextSupport.chooseSummaryFromBodyText(bodyText);
        items.add(new CrawledArticleCandidate(
            text(childText(node, "title")),
            summary,
            "",
            source.getSiteUrl(),
            originalUrl,
            publishedAt,
            source.getLanguage(),
            categoryKeywords(node),
            bodyText,
            Map.of(
                "feedUrl", feedUrl,
                "source", source.getSourceCode(),
                "bodyText", bodyText,
                "summarySource", "body")));
        if (items.size() >= itemLimit) {
          break;
        }
      }
    }
    return new CrawlBundle(items, fetched, pageCount, missingDate, outOfWindow, nonDetail);
  }

  private CrawlBundle crawlSitemap(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    int itemLimit = rule.path("itemLimit").asInt(50);
    int maxSitemaps = rule.path("maxSitemaps").asInt(10);
    List<String> sitemapUrls = sitemapEntryUrls(source, rule);
    Map<String, LocalDateTime> detailUrls = new LinkedHashMap<>();
    int fetched = 0;
    int pageCount = 0;
    for (String sitemapUrl : sitemapUrls) {
      if (pageCount >= maxSitemaps || detailUrls.size() >= itemLimit * 2) {
        break;
      }
      Document document = connect(sitemapUrl)
          .ignoreContentType(true)
          .parser(Parser.xmlParser())
          .get();
      pageCount++;
      List<String> nested = document.select("sitemap loc").stream().map(Element::text).filter(item -> !item.isBlank()).toList();
      if (!nested.isEmpty()) {
        for (String nestedUrl : nested.stream().limit(Math.max(0, maxSitemaps - pageCount)).toList()) {
          if (detailUrls.size() >= itemLimit * 2) {
            break;
          }
          Document nestedDoc = connect(nestedUrl)
              .ignoreContentType(true)
              .parser(Parser.xmlParser())
              .get();
          pageCount++;
          collectSitemapUrls(source, rule, nestedDoc, detailUrls, itemLimit * 2);
        }
      } else {
        collectSitemapUrls(source, rule, document, detailUrls, itemLimit * 2);
      }
    }

    List<CrawledArticleCandidate> items = new ArrayList<>();
    int missingDate = 0;
    int outOfWindow = 0;
    for (Map.Entry<String, LocalDateTime> detail : detailUrls.entrySet()) {
      fetched++;
      CrawledArticleCandidate article = parseHtmlArticle(source, rule, detail.getKey(), detail.getValue());
      if (article == null || article.publishedAt() == null) {
        missingDate++;
      } else if (inWindow(article.publishedAt(), window)) {
        items.add(article);
      } else {
        outOfWindow++;
      }
      if (items.size() >= itemLimit) {
        break;
      }
    }
    return new CrawlBundle(items, fetched, pageCount, missingDate, outOfWindow, 0);
  }

  private CrawlBundle crawlHtml(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    int defaultMaxPages = rule.hasNonNull("paginationTemplate") || rule.path("paginationTemplates").isArray() ? 20 : 1;
    int maxPages = rule.path("maxPages").asInt(defaultMaxPages);
    int itemLimit = rule.path("itemLimit").asInt(30);
    List<String> listPages = listPages(source, rule, maxPages);

    Map<String, LocalDateTime> detailUrls = new LinkedHashMap<>();
    int pageCount = 0;
    for (String pageUrl : listPages) {
      if (pageUrl == null || pageUrl.isBlank() || detailUrls.size() >= itemLimit * 3) {
        continue;
      }
      Document listDoc = connect(pageUrl).get();
      pageCount++;
      for (LinkCandidate link : selectLinks(source, rule, listDoc, pageUrl, itemLimit * 2)) {
        detailUrls.putIfAbsent(link.url(), link.publishedAt());
      }
    }

    List<CrawledArticleCandidate> items = new ArrayList<>();
    int fetched = 0;
    int missingDate = 0;
    int outOfWindow = 0;
    for (Map.Entry<String, LocalDateTime> detail : detailUrls.entrySet()) {
      fetched++;
      CrawledArticleCandidate article = parseHtmlArticle(source, rule, detail.getKey(), detail.getValue());
      if (article == null || article.publishedAt() == null) {
        missingDate++;
      } else if (inWindow(article.publishedAt(), window)) {
        items.add(article);
      } else {
        outOfWindow++;
      }
      if (items.size() >= itemLimit) {
        break;
      }
    }
    return new CrawlBundle(
        items.stream()
            .sorted(Comparator.comparing(CrawledArticleCandidate::publishedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList(),
        fetched,
        pageCount,
        missingDate,
        outOfWindow,
        0);
  }

  private CrawledArticleCandidate parseHtmlArticle(SourceEntity source, JsonNode rule, String url) {
    return parseHtmlArticle(source, rule, url, null);
  }

  private CrawledArticleCandidate parseHtmlArticle(SourceEntity source, JsonNode rule, String url, LocalDateTime dateHint) {
    try {
      Document doc = connect(url).get();
      String title = firstText(
          selectFirst(doc, rule.path("titleSelectors")),
          meta(doc, "ArticleTitle"),
          meta(doc, "og:title"),
          doc.selectFirst("h1") == null ? "" : doc.selectFirst("h1").text(),
          doc.title());
      String bodyText = NewsBodyTextSupport.extractBodyText(doc);
      String summary = NewsBodyTextSupport.chooseSummaryFromBodyText(bodyText);
      String cover = firstText(meta(doc, "og:image"), meta(doc, "Image"));
      LocalDateTime publishedAt = parseDate(firstText(
          selectFirst(doc, rule.path("dateSelectors")),
          meta(doc, "PubDate"),
          meta(doc, "article:published_time"),
          meta(doc, "article:modified_time"),
          meta(doc, "og:updated_time"),
          meta(doc, "publishdate"),
          meta(doc, "publish-date"),
          meta(doc, "publish_time"),
          meta(doc, "publication_date"),
          meta(doc, "date"),
          meta(doc, "Date"),
          meta(doc, "created"),
          meta(doc, "modified"),
          meta(doc, "dc.date"),
          meta(doc, "dcterms.date"),
          meta(doc, "dcterms.created"),
          meta(doc, "datePublished"),
          meta(doc, "dateModified"),
          meta(doc, "lastmod"),
          doc.selectFirst("time[datetime]") == null ? "" : doc.selectFirst("time[datetime]").attr("datetime"),
          doc.selectFirst("[datetime]") == null ? "" : doc.selectFirst("[datetime]").attr("datetime"),
          jsonLdDate(doc),
          selectTimeLike(doc),
          findDateHint(doc.text())), source.getLanguage());
      if (publishedAt == null) {
        publishedAt = dateHint;
      }
      return new CrawledArticleCandidate(
          title,
          summary,
          cover,
          source.getSiteUrl(),
          doc.location(),
          publishedAt,
          source.getLanguage(),
          List.of(),
          bodyText,
          rawPayload(source, url, doc.location(), title, summary, bodyText));
    } catch (Exception ignored) {
      return null;
    }
  }

  private List<LinkCandidate> selectLinks(SourceEntity source, JsonNode rule, Document doc, String pageUrl, int limit) {
    Set<String> seen = new LinkedHashSet<>();
    List<LinkCandidate> links = new ArrayList<>();
    for (Element anchor : doc.select("a[href]")) {
      String href = anchor.absUrl("href");
      String text = NewsCleaningService.cleanText(anchor.text());
      if (href.isBlank() || text.length() < 3 || seen.contains(href)) {
        continue;
      }
      if (!NewsCleaningService.isDetailUrl(href)) {
        continue;
      }
      seen.add(href);
      int score = scoreLink(source, rule, href, text, pageUrl);
      if (score > 0) {
        links.add(new LinkCandidate(href, score, parseDate(firstText(
            findDateHint(anchor.text()),
            findDateHint(anchor.parent() == null ? "" : anchor.parent().text()),
            findDateHint(anchor.parents().stream().limit(3).map(Element::text).reduce("", (left, right) -> left + " " + right)),
            findDateHint(href)), source.getLanguage())));
      }
    }
    return links.stream()
        .sorted(Comparator.comparingInt(LinkCandidate::score).reversed())
        .limit(limit)
        .toList();
  }

  private int scoreLink(SourceEntity source, JsonNode rule, String href, String text, String pageUrl) {
    String lower = (href + " " + text).toLowerCase(Locale.ROOT);
    if (matchesAny(rule.path("linkDenyPatterns"), href, lower)) {
      return -100;
    }
    if (rule.path("linkAllowPatterns").isArray() && !matchesAny(rule.path("linkAllowPatterns"), href, lower)) {
      return -100;
    }
    int score = 0;
    if (sameHost(href, source.getSiteUrl()) || sameHost(href, pageUrl)) {
      score += 4;
    }
    if (href.matches("(?i).*[/_-](20\\d{2}|\\d{6,}).*") || href.matches("(?i).*\\.(s?html|html)$")) {
      score += 6;
    }
    if (lower.contains("index") || lower.contains("list") || lower.contains("#")) {
      score -= 4;
    }
    for (JsonNode keyword : rule.path("whitelist")) {
      if (lower.contains(keyword.asText("").toLowerCase(Locale.ROOT))) {
        score += 4;
        break;
      }
    }
    return score;
  }

  private static void collectSitemapUrls(SourceEntity source, JsonNode rule, Document document, Map<String, LocalDateTime> detailUrls, int limit) {
    for (Element loc : document.getElementsByTag("loc")) {
      String href = NewsCleaningService.cleanText(loc.text());
      if (href.isBlank() || detailUrls.size() >= limit) {
        break;
      }
      String lower = href.toLowerCase(Locale.ROOT);
      if (matchesAny(rule.path("linkDenyPatterns"), href, lower)) {
        continue;
      }
      if (rule.path("linkAllowPatterns").isArray() && !matchesAny(rule.path("linkAllowPatterns"), href, lower)) {
        continue;
      }
      if (sameHost(href, source.getSiteUrl()) && NewsCleaningService.isDetailUrl(href)) {
        String lastmod = loc.parent() == null ? "" : childText(loc.parent(), "lastmod");
        detailUrls.putIfAbsent(href, parseDate(firstText(lastmod, findDateHint(lastmod), findDateHint(href)), source.getLanguage()));
      }
    }
  }

  private static boolean isFeedMode(JsonNode rule) {
    String parser = rule.path("parser").asText("");
    return "rss".equals(parser) || "atom".equals(parser) || rule.path("feedUrls").isArray();
  }

  private static boolean isApiMode(JsonNode rule) {
    return "api".equals(rule.path("mode").asText("")) || "wp-json".equals(rule.path("parser").asText(""));
  }

  private static boolean isSitemapMode(JsonNode rule) {
    return "sitemap".equals(rule.path("parser").asText(""));
  }

  private static boolean hasDeepCoverage(JsonNode rule) {
    return rule.hasNonNull("paginationTemplate")
        || rule.path("paginationTemplates").isArray()
        || rule.hasNonNull("apiUrl")
        || rule.path("feedUrls").isArray()
        || isSitemapMode(rule);
  }

  private static JsonNode parseRule(SourceEntity source) throws IOException {
    return new ObjectMapper().readTree(source.getCrawlRuleJson() == null ? "{}" : source.getCrawlRuleJson());
  }

  private static List<String> listPages(SourceEntity source, JsonNode rule, int maxPages) {
    if (rule.path("paginationTemplates").isArray()) {
      List<String> urls = new ArrayList<>();
      for (JsonNode node : rule.path("paginationTemplates")) {
        String template = node.isTextual() ? node.asText() : node.path("template").asText("");
        int start = node.isTextual() ? 1 : Math.max(1, node.path("start").asInt(1));
        int end = node.isTextual()
            ? maxPages
            : Math.max(start, node.path("end").asInt(node.path("maxPages").asInt(maxPages)));
        if (template.isBlank()) {
          continue;
        }
        for (int page = start; page <= Math.min(end, maxPages); page++) {
          urls.add(template.replace("{page}", String.valueOf(page)).replace("%d", String.valueOf(page)));
        }
      }
      if (!urls.isEmpty()) {
        return urls.stream().distinct().toList();
      }
    }
    if (rule.hasNonNull("paginationTemplate")) {
      String template = rule.path("paginationTemplate").asText();
      List<String> urls = new ArrayList<>();
      for (int page = 1; page <= maxPages; page++) {
        urls.add(template.replace("{page}", String.valueOf(page)).replace("%d", String.valueOf(page)));
      }
      return urls;
    }
    return entryUrls(source, rule);
  }

  private static List<String> feedUrls(SourceEntity source, JsonNode rule) {
    List<String> urls = jsonStringList(rule.path("feedUrls"));
    if (urls.isEmpty() && ("rss".equals(rule.path("parser").asText("")) || "atom".equals(rule.path("parser").asText("")))) {
      urls.addAll(entryUrls(source, rule));
    }
    return urls.stream().filter(item -> item != null && !item.isBlank()).distinct().toList();
  }

  private static List<String> sitemapEntryUrls(SourceEntity source, JsonNode rule) {
    List<String> urls = jsonStringList(rule.path("feedUrls"));
    if (!rule.path("entryUrl").asText("").isBlank()) {
      urls.add(rule.path("entryUrl").asText());
    }
    if (rule.path("fallbackEntryUrls").isArray()) {
      rule.path("fallbackEntryUrls").forEach(url -> urls.add(url.asText()));
    }
    if (urls.isEmpty()) {
      String site = source.getSiteUrl().replaceAll("/+$", "");
      urls.add(site + "/sitemap.xml");
      urls.add(site + "/sitemap_index.xml");
    }
    return urls.stream().filter(item -> item != null && !item.isBlank()).distinct().toList();
  }

  private static List<String> entryUrls(SourceEntity source, JsonNode rule) {
    List<String> urls = new ArrayList<>();
    if (!rule.path("entryUrl").asText("").isBlank()) {
      urls.add(rule.path("entryUrl").asText());
    }
    if (rule.path("fallbackEntryUrls").isArray()) {
      rule.path("fallbackEntryUrls").forEach(url -> urls.add(url.asText()));
    }
    if (urls.isEmpty()) {
      urls.add(source.getSiteUrl());
    }
    return urls.stream().filter(item -> item != null && !item.isBlank()).distinct().toList();
  }

  private static List<String> jsonStringList(JsonNode node) {
    List<String> values = new ArrayList<>();
    if (node != null && node.isArray()) {
      node.forEach(item -> values.add(item.asText()));
    }
    return values;
  }

  private static String appendPage(String apiUrl, int page) {
    String separator = apiUrl.contains("?") ? "&" : "?";
    if (apiUrl.matches(".*[?&]page=\\d+.*")) {
      return apiUrl.replaceAll("([?&]page=)\\d+", "$1" + page);
    }
    return apiUrl + separator + "page=" + page;
  }

  private static LocalDateTime parseDate(String value, String language) {
    String text = NewsCleaningService.cleanText(value);
    if (text.isBlank()) {
      return null;
    }
    try {
      return ZonedDateTime.parse(text, DateTimeFormatter.RFC_1123_DATE_TIME).toLocalDateTime();
    } catch (RuntimeException ignored) {
      try {
        return TimeSupport.parseToLocalDateTime(text);
      } catch (RuntimeException ignoredAgain) {
        return null;
      }
    }
  }

  private static boolean inWindow(LocalDateTime value, CrawlWindow window) {
    return value != null && !value.isBefore(window.startAt()) && !value.isAfter(window.endAt().plusMinutes(1));
  }

  private static String text(String html) {
    return NewsCleaningService.cleanText(Jsoup.parse(html == null ? "" : html).text());
  }

  private static String firstText(String... values) {
    for (String value : values) {
      String cleaned = NewsCleaningService.cleanText(value);
      if (!cleaned.isBlank()) {
        return cleaned;
      }
    }
    return "";
  }

  private static String selectFirst(Document doc, JsonNode selectors) {
    if (selectors != null && selectors.isArray()) {
      for (JsonNode selector : selectors) {
        Element element = doc.selectFirst(selector.asText());
        if (element != null) {
          return element.text();
        }
      }
    }
    return "";
  }

  private static String meta(Document doc, String name) {
    Elements matches = doc.select(
        "meta[name=\"" + name + "\"],meta[property=\"" + name + "\"],meta[itemprop=\"" + name + "\"]");
    return matches.isEmpty() ? "" : matches.first().attr("content");
  }

  private static String firstParagraph(Document doc) {
    return doc.select("p").stream()
        .map(Element::text)
        .map(NewsCleaningService::cleanText)
        .filter(text -> text.length() >= 40)
        .findFirst()
        .orElse("");
  }

  private static String articleBodySummary(String html) {
    if (html == null || html.isBlank()) {
      return "";
    }
    return NewsBodyTextSupport.chooseSummaryFromBodyText(NewsBodyTextSupport.extractBodyTextFromHtml(html));
  }

  private static String childText(Element element, String tagName) {
    Element child = tagName.contains(":") ? element.getElementsByTag(tagName).first() : element.selectFirst(tagName);
    return child == null ? "" : child.text();
  }

  private static String childAttr(Element element, String selector, String attr) {
    Element child = element.selectFirst(selector);
    return child == null ? "" : child.attr(attr);
  }

  private static String resolveUrl(String baseUrl, String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    try {
      return java.net.URI.create(baseUrl).resolve(value.trim()).toString();
    } catch (RuntimeException ignored) {
      return value.trim();
    }
  }

  private static Connection connect(String url) {
    throttleHost(url);
    return Jsoup.connect(url)
        .userAgent(USER_AGENT)
        .timeout(15000)
        .sslSocketFactory(TRUST_ALL_SSL_SOCKET_FACTORY);
  }

  private static void throttleHost(String url) {
    String host;
    try {
      host = java.net.URI.create(url).getHost();
    } catch (RuntimeException ignored) {
      return;
    }
    if (host == null || host.isBlank()) {
      return;
    }
    String normalizedHost = host.toLowerCase(Locale.ROOT);
    Object lock = HOST_LOCKS.computeIfAbsent(normalizedHost, ignored -> new Object());
    synchronized (lock) {
      long now = System.currentTimeMillis();
      long next = HOST_NEXT_REQUEST_AT.getOrDefault(normalizedHost, now);
      if (next > now) {
        try {
          Thread.sleep(next - now);
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
        }
      }
      HOST_NEXT_REQUEST_AT.put(normalizedHost, Math.max(now, next) + MIN_HOST_INTERVAL_MILLIS);
    }
  }

  private static List<String> categoryKeywords(Element element) {
    return element.select("category").stream()
        .map(Element::text)
        .map(NewsCleaningService::cleanText)
        .filter(item -> !item.isBlank())
        .limit(10)
        .toList();
  }

  private static String findDate(String text) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})(?:[日\\sT]+(\\d{1,2}:\\d{2}))?")
        .matcher(text);
    return matcher.find() ? matcher.group() : "";
  }

  private static String findDateStable(String text) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("(20\\d{2})[-/.\\u5e74](\\d{1,2})[-/.\\u6708](\\d{1,2})(?:[\\u65e5\\sT]+(\\d{1,2}:\\d{2}))?")
        .matcher(text == null ? "" : text);
    return matcher.find() ? matcher.group() : "";
  }

  private static String findEnglishDateStable(String text) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("(?i)(?:\\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b\\s+\\d{1,2},\\s+20\\d{2}(?:\\s+\\d{1,2}:\\d{2}(?:\\s*[ap]m)?)?|\\b\\d{1,2}\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+20\\d{2}(?:\\s+\\d{1,2}:\\d{2}(?:\\s*[ap]m)?)?)")
        .matcher(text == null ? "" : text);
    return matcher.find() ? matcher.group() : "";
  }

  private static String findCompactDateStable(String text) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("\\b(20\\d{2})(\\d{2})(\\d{2})\\b")
        .matcher(text == null ? "" : text);
    if (!matcher.find()) {
      return "";
    }
    return matcher.group(1) + "-" + matcher.group(2) + "-" + matcher.group(3);
  }

  private static String findDateHint(String text) {
    return firstText(findDateStable(text), findCompactDateStable(text), findEnglishDateStable(text), findDate(text));
  }

  private static String jsonLdDate(Document doc) {
    return doc.select("script[type=application/ld+json]").stream()
        .map(Element::data)
        .map(SourceCrawlerService::findDateHint)
        .filter(item -> !item.isBlank())
        .findFirst()
        .orElse("");
  }

  private static String selectTimeLike(Document doc) {
    return doc.select("time,[datetime],[class*=date],[class*=time],[id*=date],[id*=time],[class*=publish],[id*=publish],[class*=posted],[id*=posted]")
        .stream()
        .limit(30)
        .map(element -> firstText(
            element.hasAttr("datetime") ? element.attr("datetime") : "",
            element.hasAttr("content") ? element.attr("content") : "",
            findDateHint(element.text())))
        .filter(item -> !item.isBlank())
        .findFirst()
        .orElse("");
  }

  private static boolean matchesAny(JsonNode patterns, String href, String lower) {
    if (patterns == null || !patterns.isArray()) {
      return false;
    }
    for (JsonNode patternNode : patterns) {
      String pattern = patternNode.asText("");
      if (pattern.isBlank()) {
        continue;
      }
      try {
        if (Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(href).find()
            || Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(lower).find()) {
          return true;
        }
      } catch (RuntimeException ignored) {
        if (lower.contains(pattern.toLowerCase(Locale.ROOT))) {
          return true;
        }
      }
    }
    return false;
  }

  private static boolean sameHost(String left, String right) {
    try {
      String leftHost = java.net.URI.create(left).getHost();
      String rightHost = java.net.URI.create(right).getHost();
      return leftHost != null && rightHost != null && leftHost.equalsIgnoreCase(rightHost);
    } catch (Exception error) {
      return false;
    }
  }

  private static Map<String, Object> rawPayload(
      SourceEntity source, String requestedUrl, String finalUrl, String title, String summary, String bodyText) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("source", source.getSourceCode());
    payload.put("requestedUrl", requestedUrl);
    payload.put("finalUrl", finalUrl);
    payload.put("title", title);
    payload.put("summary", summary);
    payload.put("bodyText", bodyText);
    payload.put("summarySource", "body");
    return payload;
  }

  private static String crawlNote(CrawlBundle bundle) {
    if (!bundle.candidates().isEmpty()) {
      return "发现/检查 " + bundle.fetchedCount() + " 个链接或条目，形成 "
          + bundle.candidates().size() + " 条时间窗口内候选。";
    }
    if (bundle.fetchedCount() == 0) {
      return "未发现可处理的详情页链接或订阅条目。";
    }
    List<String> parts = new ArrayList<>();
    if (bundle.outOfWindowCount() > 0) {
      parts.add("日期不在本次窗口 " + bundle.outOfWindowCount() + " 条");
    }
    if (bundle.missingDateCount() > 0) {
      parts.add("缺少可解析发布日期 " + bundle.missingDateCount() + " 条");
    }
    if (bundle.nonDetailCount() > 0) {
      parts.add("非详情页 " + bundle.nonDetailCount() + " 条");
    }
    String reason = parts.isEmpty() ? "未命中详情页和日期规则" : String.join("，", parts);
    return "发现/检查 " + bundle.fetchedCount() + " 个链接或条目，但未形成入库候选；" + reason + "。";
  }

  private static String humanizeError(Throwable error) {
    String message = error.getMessage() == null ? "" : error.getMessage();
    String lower = message.toLowerCase(Locale.ROOT);
    if (message.contains("Received fatal alert: unrecognized_name")) {
      return "TLS 握手失败：来源站点不接受当前域名证书握手。";
    }
    java.util.regex.Matcher httpStatus = java.util.regex.Pattern
        .compile("(?i)HTTP error fetching URL\\. Status=(\\d+)")
        .matcher(message);
    if (httpStatus.find()) {
      return "HTTP 访问失败，状态码 " + httpStatus.group(1) + "。";
    }
    if (lower.contains("timed out")) {
      return "访问超时。";
    }
    if (lower.contains("unknownhost")) {
      return "域名解析失败。";
    }
    if (message.isBlank()) {
      return error.getClass().getSimpleName();
    }
    return message;
  }

  private record CrawlBundle(
      List<CrawledArticleCandidate> candidates,
      int fetchedCount,
      int pageCount,
      int missingDateCount,
      int outOfWindowCount,
      int nonDetailCount) {
    static CrawlBundle empty() {
      return new CrawlBundle(List.of(), 0, 0, 0, 0, 0);
    }
  }

  private record LinkCandidate(String url, int score, LocalDateTime publishedAt) {}

  private static SSLSocketFactory buildTrustAllSslSocketFactory() {
    try {
      SSLContext context = SSLContext.getInstance("TLS");
      context.init(null, new TrustManager[] {new X509TrustManager() {
        @Override
        public java.security.cert.X509Certificate[] getAcceptedIssuers() {
          return new java.security.cert.X509Certificate[0];
        }

        @Override
        public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) {
          // Internal crawler: accept client certificates when present.
        }

        @Override
        public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) {
          // Internal crawler: trust public-source certificates even when chains are incomplete.
        }
      }}, new java.security.SecureRandom());
      javax.net.ssl.HttpsURLConnection.setDefaultHostnameVerifier(TRUST_ALL_HOSTNAME_VERIFIER);
      return context.getSocketFactory();
    } catch (Exception error) {
      throw new IllegalStateException("Could not initialize crawler SSL context.", error);
    }
  }
}
