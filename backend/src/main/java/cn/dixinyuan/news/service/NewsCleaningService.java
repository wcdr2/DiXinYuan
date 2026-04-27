package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.support.HashSupport;
import cn.dixinyuan.news.support.JsonSupport;
import java.net.URI;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class NewsCleaningService {
  private static final List<String> DOMAIN_TERMS = List.of(
      "地理信息", "测绘", "遥感", "北斗", "GIS", "实景三维", "自然资源", "低空", "时空",
      "geospatial", "remote sensing", "earth observation", "satellite", "digital twin", "interoperability");
  private static final List<String> GUANGXI_TERMS = List.of(
      "广西", "南宁", "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林",
      "百色", "贺州", "河池", "来宾", "崇左");

  private final JsonSupport jsonSupport;

  public NewsCleaningService(JsonSupport jsonSupport) {
    this.jsonSupport = jsonSupport;
  }

  public CleanedNewsArticle clean(SourceEntity source, CrawledArticleCandidate raw) {
    String title = cleanTitle(raw.title(), source.getName());
    String summary = cleanSummary(raw.summary(), title);
    String originalUrl = canonicalUrl(raw.originalUrl());
    String sourceUrl = raw.sourceUrl() == null || raw.sourceUrl().isBlank() ? source.getSiteUrl() : raw.sourceUrl();
    LocalDateTime publishedAt = raw.publishedAt();
    List<String> keywords = keywords(source, title, summary, raw.keywords());
    List<String> regionTags = regionTags(title + " " + summary + " " + String.join(" ", keywords));
    boolean guangxi = regionTags.stream().anyMatch(tag -> !"全国".equals(tag));
    String category = classify(title + " " + summary + " " + String.join(" ", keywords));
    String slug = slugify(title, source.getSourceCode(), originalUrl);
    String contentHash = contentHash(title, summary, originalUrl, publishedAt, category, keywords, regionTags);
    return new CleanedNewsArticle(
        HashSupport.sha256(source.getSourceCode() + "::" + originalUrl).substring(0, 16),
        slug,
        title,
        summary,
        raw.coverImage(),
        sourceUrl,
        originalUrl,
        originalUrl,
        publishedAt,
        source.getLanguage() == null || source.getLanguage().isBlank() ? raw.language() : source.getLanguage(),
        category,
        keywords,
        regionTags,
        guangxi,
        List.of(),
        contentHash,
        raw.rawPayload());
  }

  private static String cleanTitle(String value, String sourceName) {
    String title = cleanText(value);
    if (!sourceName.isBlank()) {
      title = title.replaceAll("\\s*[-|_].*" + java.util.regex.Pattern.quote(sourceName) + ".*$", "");
    }
    title = title.replaceAll("\\s*[-|_].*$", "").trim();
    return hasTemplateArtifact(title) ? "" : title;
  }

  private static String cleanSummary(String value, String fallback) {
    String summary = cleanText(value);
    if (summary.isBlank()) {
      summary = fallback;
    }
    if (summary.length() > 260) {
      summary = summary.substring(0, 260);
    }
    return hasTemplateArtifact(summary) ? "" : summary;
  }

  public static String cleanText(String value) {
    if (value == null) {
      return "";
    }
    return value
        .replace('\u00a0', ' ')
        .replaceAll("\\s+", " ")
        .trim();
  }

  private static boolean hasTemplateArtifact(String value) {
    String text = value == null ? "" : value.toLowerCase(Locale.ROOT);
    return text.contains("javascript") || text.contains("window.") || text.contains("function(") || text.length() > 1024;
  }

  private static String canonicalUrl(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    return value.trim().replaceAll("#.*$", "").replaceAll("/+$", "");
  }

  private static List<String> keywords(SourceEntity source, String title, String summary, List<String> rawKeywords) {
    Set<String> terms = new LinkedHashSet<>();
    if (rawKeywords != null) {
      rawKeywords.stream().map(NewsCleaningService::cleanText).filter(item -> item.length() >= 2).forEach(terms::add);
    }
    String haystack = (title + " " + summary).toLowerCase(Locale.ROOT);
    DOMAIN_TERMS.stream()
        .filter(term -> haystack.contains(term.toLowerCase(Locale.ROOT)))
        .forEach(terms::add);
    try {
      List<String> whitelist = source.getCrawlRuleJson() == null
          ? List.of()
          : jsonList(source.getCrawlRuleJson(), "whitelist");
      whitelist.stream()
          .map(NewsCleaningService::cleanText)
          .filter(term -> !term.isBlank() && haystack.contains(term.toLowerCase(Locale.ROOT)))
          .forEach(terms::add);
    } catch (RuntimeException ignored) {
      // Bad source metadata should not block cleaning.
    }
    if (terms.isEmpty()) {
      DOMAIN_TERMS.stream().limit(2).forEach(terms::add);
    }
    return new ArrayList<>(terms).stream().limit(10).toList();
  }

  private static List<String> jsonList(String json, String field) {
    try {
      com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(json).path(field);
      if (!node.isArray()) {
        return List.of();
      }
      List<String> items = new ArrayList<>();
      node.forEach(item -> items.add(item.asText()));
      return items;
    } catch (Exception error) {
      return List.of();
    }
  }

  private static List<String> regionTags(String text) {
    List<String> tags = GUANGXI_TERMS.stream().filter(text::contains).distinct().limit(3).toList();
    return tags.isEmpty() ? List.of("全国") : tags;
  }

  private static String classify(String text) {
    String lower = text.toLowerCase(Locale.ROOT);
    if (lower.contains("企业") || lower.contains("产业") || lower.contains("company") || lower.contains("market")) {
      return "enterprise";
    }
    if (lower.contains("政策") || lower.contains("自然资源") || lower.contains("标准") || lower.contains("policy") || lower.contains("standard")) {
      return "policy";
    }
    return "technology";
  }

  private static String slugify(String title, String sourceCode, String originalUrl) {
    String normalized = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFKD)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9\\u4e00-\\u9fa5]+", "-")
        .replaceAll("(^-+|-+$)", "");
    if (!normalized.isBlank()) {
      return normalized.length() > 120 ? normalized.substring(0, 120).replaceAll("-+$", "") : normalized;
    }
    return sourceCode + "-" + HashSupport.sha256(originalUrl).substring(0, 8);
  }

  private String contentHash(
      String title,
      String summary,
      String originalUrl,
      LocalDateTime publishedAt,
      String category,
      List<String> keywords,
      List<String> regionTags) {
    return HashSupport.sha256(jsonSupport.stringify(List.of(
        safe(title), safe(summary), safe(originalUrl), String.valueOf(publishedAt), safe(category), keywords, regionTags)));
  }

  private static String safe(String value) {
    return value == null ? "" : value;
  }

  public static boolean isDetailUrl(String value) {
    if (value == null || value.isBlank()) {
      return false;
    }
    try {
      URI uri = URI.create(value);
      String path = uri.getPath() == null ? "/" : uri.getPath();
      if ("/".equals(path) || path.isBlank()) {
        return false;
      }
      String lower = path.toLowerCase(Locale.ROOT);
      return !(lower.contains("index") || lower.contains("list") || lower.endsWith("/news") || lower.endsWith("/dt"));
    } catch (IllegalArgumentException error) {
      return false;
    }
  }
}
