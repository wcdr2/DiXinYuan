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
  public static final List<String> REQUIRED_SUMMARY_TERMS = List.of(
      "地球信息科学", "遥感", "测绘", "GIS", "北斗", "空天信息", "实景三维", "时空智能",
      "自然资源数字化", "低空遥感", "数字孪生", "智慧城市");
  private static final List<String> DOMAIN_TERMS = List.of(
      "地球信息科学", "地理信息", "测绘", "遥感", "北斗", "GIS", "空天信息", "实景三维",
      "时空智能", "自然资源数字化", "自然资源", "低空遥感", "低空", "时空", "数字孪生",
      "智慧城市", "geospatial", "remote sensing", "earth observation", "satellite",
      "digital twin", "interoperability", "smart city", "spatiotemporal intelligence");
  private static final List<String> GUANGXI_TERMS = List.of(
      "广西", "南宁", "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林",
      "百色", "贺州", "河池", "来宾", "崇左");

  private final JsonSupport jsonSupport;

  public NewsCleaningService(JsonSupport jsonSupport) {
    this.jsonSupport = jsonSupport;
  }

  public CleanedNewsArticle clean(SourceEntity source, CrawledArticleCandidate raw) {
    String title = cleanTitle(raw.title(), source.getName());
    String bodyText = cleanText(raw.bodyText());
    String summary = cleanSummary(raw.summary());
    if (summary.isBlank() && !bodyText.isBlank()) {
      summary = cleanSummary(NewsBodyTextSupport.chooseSummaryFromBodyText(bodyText));
    }
    String originalUrl = canonicalUrl(raw.originalUrl());
    String sourceUrl = raw.sourceUrl() == null || raw.sourceUrl().isBlank() ? source.getSiteUrl() : raw.sourceUrl();
    LocalDateTime publishedAt = raw.publishedAt();
    List<String> keywords = keywords(source, title, summary, bodyText, raw.keywords());
    List<String> regionTags = regionTags(title + " " + summary + " " + bodyText + " " + String.join(" ", keywords));
    boolean guangxi = regionTags.stream().anyMatch(GUANGXI_TERMS::contains);
    String category = classify(title + " " + summary + " " + bodyText + " " + String.join(" ", keywords));
    String slug = slugify(title, source.getSourceCode(), originalUrl);
    String contentHash = contentHash(title, summary, bodyText, originalUrl, publishedAt, category, keywords, regionTags);
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
        bodyText,
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

  private static String cleanSummary(String value) {
    String summary = cleanText(value);
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

  private static List<String> keywords(SourceEntity source, String title, String summary, String bodyText, List<String> rawKeywords) {
    Set<String> terms = new LinkedHashSet<>();
    if (rawKeywords != null) {
      rawKeywords.stream().map(NewsCleaningService::cleanText).filter(item -> item.length() >= 2).forEach(terms::add);
    }
    String haystack = (title + " " + summary + " " + bodyText).toLowerCase(Locale.ROOT);
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
    return new ArrayList<>(terms).stream().limit(10).toList();
  }

  public static boolean hasRequiredSummaryTerm(String summary) {
    String text = summary == null ? "" : summary;
    return REQUIRED_SUMMARY_TERMS.stream().anyMatch(text::contains);
  }

  public static boolean isTitleOnlySummary(String title, String summary) {
    String cleanTitle = cleanText(title);
    String cleanSummary = cleanText(summary);
    return !cleanTitle.isBlank() && cleanTitle.equals(cleanSummary);
  }

  public static String ensureRequiredSummaryTerm(String summary, String title, List<String> keywords) {
    return cleanText(summary);
  }

  public static String requiredSummaryTermFor(String title, String summary, List<String> keywords) {
    return "";
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
    int enterpriseScore = score(lower,
        "企业", "产业", "公司", "产品", "解决方案", "市场", "签约", "中标", "上市", "客户",
        "company", "market", "customer", "contract", "commercial", "business");
    int policyScore = score(lower,
        "政策", "规划", "标准", "规范", "指南", "通知", "公告", "公示", "征求意见", "办法", "自然资源",
        "policy", "standard", "regulation", "guideline", "plan", "program");
    int technologyScore = score(lower,
        "技术", "系统", "平台", "模型", "算法", "数据", "遥感", "测绘", "北斗", "GIS", "实景三维", "数字孪生",
        "technology", "system", "platform", "model", "data", "remote sensing", "geospatial", "mapping", "digital twin");

    if (enterpriseScore > policyScore && enterpriseScore >= technologyScore) {
      return "enterprise";
    }
    if (policyScore >= enterpriseScore && policyScore >= technologyScore) {
      return "policy";
    }
    return "technology";
  }

  private static int score(String text, String... terms) {
    int score = 0;
    for (String term : terms) {
      if (text.contains(term.toLowerCase(Locale.ROOT))) {
        score++;
      }
    }
    return score;
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
      String bodyText,
      String originalUrl,
      LocalDateTime publishedAt,
      String category,
      List<String> keywords,
      List<String> regionTags) {
    return HashSupport.sha256(jsonSupport.stringify(List.of(
        safe(title), safe(summary), safe(bodyText), safe(originalUrl), String.valueOf(publishedAt), safe(category), keywords, regionTags)));
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
      String lower = path.toLowerCase(Locale.ROOT).replaceAll("/+$", "");
      if (lower.isBlank() || "/".equals(lower)) {
        return false;
      }
      String query = uri.getQuery() == null ? "" : uri.getQuery().toLowerCase(Locale.ROOT);
      if (query.matches("(^|.*&)id=\\d+.*")
          && lower.matches(".*(?:news|show|detail|view|index\\.php|\\.aspx?)$")) {
        return true;
      }
      if (lower.endsWith("/news")
          || lower.endsWith("/dt")
          || lower.endsWith("/list")
          || lower.endsWith("/index")
          || lower.matches(".*/(?:index|list)(?:[_-]\\d+)*\\.(?:s?html?)$")) {
        return false;
      }
      if (lower.matches(".*/(?:informationdetail|news_view|solution_view|products_view|case_view|shows)(?:/.*)?$")) {
        return true;
      }
      if (lower.contains("/content/")
          || lower.contains("/detail/")
          || lower.contains("/info/")
          || lower.contains("/article/")
          || lower.contains("/blog-article/")
          || lower.contains("/announcement/")
          || lower.contains("/post/")
          || lower.contains("/story/")
          || lower.contains("/blog/")
          || lower.contains("/press/")
          || lower.contains("/press_releases/")
          || lower.contains("/press-releases/")
          || lower.contains("/event/")
          || lower.contains("/events/")
          || lower.contains("/id/")
          || lower.contains("/art/")
          || lower.contains("/news/")) {
        return true;
      }
      if (lower.matches("(?i)^/20\\d{6}/[0-9a-f]{16,}/[ac]\\.html$")) {
        return true;
      }
      String fileName = lower.substring(lower.lastIndexOf('/') + 1);
      if (fileName.matches("(?i)[a-z]\\d{4,}\\.(?:s?html?)$")) {
        return true;
      }
      if (fileName.matches("(?i)t\\d+(?:_\\d+)?\\.(?:s?html?)$")) {
        return true;
      }
      if (fileName.matches("(?i)\\d{5,}\\.(?:s?html?)$")) {
        return !lower.contains("/list/");
      }
      String normalized = lower.replaceFirst("^/+", "");
      String[] segments = normalized.isBlank() ? new String[0] : normalized.split("/");
      if (segments.length >= 1
          && !fileName.contains(".")
          && fileName.length() >= 12
          && fileName.chars().filter(ch -> ch == '-').count() >= 2
          && !lower.contains("/category/")
          && !lower.contains("/tag/")
          && !lower.contains("/author/")
          && !lower.contains("/topic/")
          && !lower.contains("/page/")) {
        return true;
      }
      if (segments.length >= 2
          && !fileName.contains(".")
          && fileName.length() >= 12
          && fileName.chars().filter(ch -> ch == '_').count() >= 2
          && !lower.contains("/category/")
          && !lower.contains("/tag/")
          && !lower.contains("/author/")
          && !lower.contains("/topic/")
          && !lower.contains("/page/")) {
        return true;
      }
      return lower.matches("(?i).*(20\\d{2}|\\d{6,}).*\\.(?:s?html?)$")
          && !lower.contains("/category/")
          && !lower.contains("/tag/")
          && !lower.contains("/special/");
    } catch (IllegalArgumentException error) {
      return false;
    }
  }
}
