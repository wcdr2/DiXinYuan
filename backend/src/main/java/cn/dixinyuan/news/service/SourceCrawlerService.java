package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.support.TimeSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

@Service
public class SourceCrawlerService {
  private static final String USER_AGENT =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  private final ObjectMapper objectMapper = new ObjectMapper();

  public SourceCrawlResult crawl(SourceEntity source, CrawlWindow window) {
    LocalDateTime earliest = null;
    LocalDateTime latest = null;
    try {
      JsonNode rule = parseRule(source);
      List<CrawledArticleCandidate> candidates = isApiMode(rule)
          ? crawlApi(source, rule, window)
          : crawlHtml(source, rule, window);
      for (CrawledArticleCandidate candidate : candidates) {
        if (candidate.publishedAt() == null) {
          continue;
        }
        earliest = earliest == null || candidate.publishedAt().isBefore(earliest) ? candidate.publishedAt() : earliest;
        latest = latest == null || candidate.publishedAt().isAfter(latest) ? candidate.publishedAt() : latest;
      }
      String coverage = hasPagination(rule) || isApiMode(rule) ? "best_effort" : "partial";
      return new SourceCrawlResult(
          candidates,
          candidates.size(),
          candidates.isEmpty() ? "skipped" : "fetched",
          coverage,
          candidates.isEmpty() ? "未抓取到时间窗口内的合规候选。" : "抓取到候选 " + candidates.size() + " 条。",
          "",
          earliest,
          latest);
    } catch (Exception error) {
      return new SourceCrawlResult(
          List.of(),
          0,
          "failed",
          "failed",
          "来源抓取失败。",
          error.getMessage(),
          null,
          null);
    }
  }

  private List<CrawledArticleCandidate> crawlApi(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    String apiUrl = rule.path("apiUrl").asText("");
    if (apiUrl.isBlank()) {
      return List.of();
    }
    int maxPages = rule.path("maxPages").asInt(8);
    int itemLimit = rule.path("itemLimit").asInt(8);
    List<CrawledArticleCandidate> items = new ArrayList<>();
    for (int page = 1; page <= maxPages; page++) {
      String url = appendPage(apiUrl, page);
      Document document = Jsoup.connect(url)
          .ignoreContentType(true)
          .userAgent(USER_AGENT)
          .timeout(15000)
          .get();
      JsonNode data = objectMapper.readTree(document.text());
      if (!data.isArray() || data.isEmpty()) {
        break;
      }
      boolean sawOlder = false;
      for (JsonNode post : data) {
        LocalDateTime publishedAt = parseDate(post.path("date_gmt").asText(post.path("date").asText("")), source.getLanguage());
        if (publishedAt != null && publishedAt.isBefore(window.startAt())) {
          sawOlder = true;
          continue;
        }
        if (!inWindow(publishedAt, window)) {
          continue;
        }
        items.add(new CrawledArticleCandidate(
            text(post.path("title").path("rendered").asText("")),
            text(post.path("excerpt").path("rendered").asText(post.path("content").path("rendered").asText(""))),
            "",
            source.getSiteUrl(),
            post.path("link").asText(""),
            publishedAt,
            source.getLanguage(),
            List.of(),
            Map.of("apiUrl", url, "source", source.getSourceCode(), "payload", post.toString())));
      }
      if (sawOlder || items.size() >= itemLimit * maxPages) {
        break;
      }
    }
    return items;
  }

  private List<CrawledArticleCandidate> crawlHtml(SourceEntity source, JsonNode rule, CrawlWindow window) throws IOException {
    List<String> entryUrls = entryUrls(source, rule);
    int maxPages = rule.path("maxPages").asInt(rule.hasNonNull("paginationTemplate") ? 8 : 1);
    int itemLimit = rule.path("itemLimit").asInt(8);
    List<String> listPages = new ArrayList<>();
    if (rule.hasNonNull("paginationTemplate")) {
      String template = rule.path("paginationTemplate").asText();
      for (int page = 1; page <= maxPages; page++) {
        listPages.add(template.replace("{page}", String.valueOf(page)).replace("%d", String.valueOf(page)));
      }
    } else {
      listPages.addAll(entryUrls);
    }

    Set<String> detailUrls = new LinkedHashSet<>();
    for (String pageUrl : listPages) {
      if (pageUrl == null || pageUrl.isBlank()) {
        continue;
      }
      Document listDoc = Jsoup.connect(pageUrl).userAgent(USER_AGENT).timeout(15000).get();
      for (String url : selectLinks(source, rule, listDoc, pageUrl, itemLimit * 2)) {
        detailUrls.add(url);
      }
      if (detailUrls.size() >= itemLimit * maxPages) {
        break;
      }
    }

    List<CrawledArticleCandidate> items = new ArrayList<>();
    for (String detailUrl : detailUrls) {
      CrawledArticleCandidate article = parseHtmlArticle(source, rule, detailUrl);
      if (article != null && inWindow(article.publishedAt(), window)) {
        items.add(article);
      }
    }
    return items.stream()
        .sorted(Comparator.comparing(CrawledArticleCandidate::publishedAt, Comparator.nullsLast(Comparator.reverseOrder())))
        .toList();
  }

  private CrawledArticleCandidate parseHtmlArticle(SourceEntity source, JsonNode rule, String url) {
    try {
      Document doc = Jsoup.connect(url).userAgent(USER_AGENT).timeout(15000).get();
      String title = firstText(
          selectFirst(doc, rule.path("titleSelectors")),
          meta(doc, "ArticleTitle"),
          meta(doc, "og:title"),
          doc.selectFirst("h1") == null ? "" : doc.selectFirst("h1").text(),
          doc.title());
      String summary = firstText(
          selectFirst(doc, rule.path("summarySelectors")),
          meta(doc, "description"),
          meta(doc, "og:description"),
          firstParagraph(doc),
          title);
      String cover = firstText(meta(doc, "og:image"), meta(doc, "Image"));
      LocalDateTime publishedAt = parseDate(firstText(
          selectFirst(doc, rule.path("dateSelectors")),
          meta(doc, "PubDate"),
          meta(doc, "article:published_time"),
          meta(doc, "publishdate"),
          doc.selectFirst("time[datetime]") == null ? "" : doc.selectFirst("time[datetime]").attr("datetime"),
          findDate(doc.text())), source.getLanguage());
      if (publishedAt == null) {
        return null;
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
          rawPayload(source, url, doc.location(), title, summary));
    } catch (Exception ignored) {
      return null;
    }
  }

  private List<String> selectLinks(SourceEntity source, JsonNode rule, Document doc, String pageUrl, int limit) {
    Set<String> seen = new LinkedHashSet<>();
    List<LinkScore> links = new ArrayList<>();
    for (Element anchor : doc.select("a[href]")) {
      String href = anchor.absUrl("href");
      String text = NewsCleaningService.cleanText(anchor.text());
      if (href.isBlank() || text.length() < 6 || seen.contains(href)) {
        continue;
      }
      seen.add(href);
      int score = scoreLink(source, rule, href, text, pageUrl);
      if (score > 0) {
        links.add(new LinkScore(href, score));
      }
    }
    return links.stream()
        .sorted(Comparator.comparingInt(LinkScore::score).reversed())
        .limit(limit)
        .map(LinkScore::url)
        .toList();
  }

  private int scoreLink(SourceEntity source, JsonNode rule, String href, String text, String pageUrl) {
    String lower = (href + " " + text).toLowerCase(Locale.ROOT);
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

  private static boolean isApiMode(JsonNode rule) {
    return "api".equals(rule.path("mode").asText("")) || "wp-json".equals(rule.path("parser").asText(""));
  }

  private static boolean hasPagination(JsonNode rule) {
    return rule.hasNonNull("paginationTemplate") || rule.hasNonNull("apiUrl");
  }

  private static JsonNode parseRule(SourceEntity source) throws IOException {
    return new ObjectMapper().readTree(source.getCrawlRuleJson() == null ? "{}" : source.getCrawlRuleJson());
  }

  private static List<String> entryUrls(SourceEntity source, JsonNode rule) {
    List<String> urls = new ArrayList<>();
    if (!rule.path("entryUrl").asText("").isBlank()) {
      urls.add(rule.path("entryUrl").asText());
    }
    if (rule.path("fallbackEntryUrls").isArray()) {
      rule.path("fallbackEntryUrls").forEach(url -> urls.add(url.asText()));
    }
    urls.add(source.getSiteUrl());
    return urls.stream().filter(item -> item != null && !item.isBlank()).distinct().toList();
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
      return TimeSupport.parseToLocalDateTime(text);
    } catch (RuntimeException ignored) {
      return null;
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
    Elements matches = doc.select("meta[name=\"" + name + "\"],meta[property=\"" + name + "\"]");
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

  private static String findDate(String text) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})(?:[日\\sT]+(\\d{1,2}:\\d{2}))?")
        .matcher(text);
    return matcher.find() ? matcher.group() : "";
  }

  private static boolean sameHost(String left, String right) {
    try {
      return java.net.URI.create(left).getHost().equalsIgnoreCase(java.net.URI.create(right).getHost());
    } catch (Exception error) {
      return false;
    }
  }

  private static Map<String, Object> rawPayload(SourceEntity source, String requestedUrl, String finalUrl, String title, String summary) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("source", source.getSourceCode());
    payload.put("requestedUrl", requestedUrl);
    payload.put("finalUrl", finalUrl);
    payload.put("title", title);
    payload.put("summary", summary);
    return payload;
  }

  private record LinkScore(String url, int score) {}
}
