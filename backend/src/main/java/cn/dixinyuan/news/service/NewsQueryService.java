package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.ArticleDto;
import cn.dixinyuan.news.dto.ArticlePageDto;
import cn.dixinyuan.news.dto.ArticleRowDto;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.support.JsonSupport;
import cn.dixinyuan.news.support.TimeSupport;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NewsQueryService {
  private static final Map<String, String> REGION_TAGS = Map.ofEntries(
      Map.entry("guangxi", "广西"),
      Map.entry("nanning", "南宁"),
      Map.entry("liuzhou", "柳州"),
      Map.entry("guilin", "桂林"),
      Map.entry("wuzhou", "梧州"),
      Map.entry("beihai", "北海"),
      Map.entry("fangchenggang", "防城港"),
      Map.entry("qinzhou", "钦州"),
      Map.entry("guigang", "贵港"),
      Map.entry("yulin", "玉林"),
      Map.entry("baise", "百色"),
      Map.entry("hezhou", "贺州"),
      Map.entry("hechi", "河池"),
      Map.entry("laibin", "来宾"),
      Map.entry("chongzuo", "崇左"));
  private final NewsMapper newsMapper;
  private final JsonSupport jsonSupport;
  private final LocalDateTime minimumPublishedAt;

  public NewsQueryService(
      NewsMapper newsMapper,
      JsonSupport jsonSupport,
      @Value("${app.news-min-published-at:2024-01-01T00:00:00}") String minimumPublishedAt) {
    this.newsMapper = newsMapper;
    this.jsonSupport = jsonSupport;
    this.minimumPublishedAt = LocalDateTime.parse(minimumPublishedAt);
  }

  public List<ArticleDto> list(
      String query,
      String category,
      String source,
      String region,
      String guangxi,
      String sort,
      int limit) {
    String normalizedQuery = normalize(query);
    String direction = "oldest".equals(sort) ? "ASC" : "DESC";
    int safeLimit = Math.max(1, Math.min(limit, 2000));
    return newsMapper.selectCurrentArticleRows(
            normalizedQuery,
            category,
            source,
            normalizeRegion(region),
            guangxi,
            direction,
            safeLimit,
            0,
            minimumPublishedAt,
            LocalDateTime.now().plusMinutes(1))
        .stream()
        .map(this::toArticle)
        .toList();
  }

  public ArticlePageDto page(
      String query,
      String category,
      String source,
      String region,
      String guangxi,
      String sort,
      int page,
      int pageSize) {
    int requestedPage = Math.max(1, page);
    int safePageSize = Math.max(1, Math.min(pageSize, 60));
    String normalizedQuery = normalize(query);
    String direction = "oldest".equals(sort) ? "ASC" : "DESC";
    LocalDateTime maxPublishedAt = LocalDateTime.now().plusMinutes(1);
    long total = newsMapper.countCurrentArticleRows(
        normalizedQuery,
        category,
        source,
        normalizeRegion(region),
        guangxi,
        minimumPublishedAt,
        maxPublishedAt);
    int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safePageSize);
    int safePage = totalPages == 0 ? 1 : Math.min(requestedPage, totalPages);
    int offset = (safePage - 1) * safePageSize;
    List<ArticleDto> content = newsMapper.selectCurrentArticleRows(
            normalizedQuery,
            category,
            source,
            normalizeRegion(region),
            guangxi,
            direction,
            safePageSize,
            offset,
            minimumPublishedAt,
            maxPublishedAt)
        .stream()
        .map(this::toArticle)
        .toList();
    return new ArticlePageDto(
        content,
        safePage,
        safePageSize,
        total,
        totalPages,
        safePage > 1 && totalPages > 0,
        totalPages > 0 && safePage < totalPages);
  }

  public ArticleDto findBySlugOrId(String rawValue) {
    String value = rawValue == null ? "" : rawValue.trim();
    if (value.isBlank()) {
      return null;
    }
    return toArticle(newsMapper.selectCurrentArticleRowBySlugOrId(
        value,
        minimumPublishedAt,
        LocalDateTime.now().plusMinutes(1)));
  }

  public List<ArticleDto> loadCurrentArticles() {
    return list(null, null, null, null, null, "latest", 2000);
  }

  private ArticleDto toArticle(ArticleRowDto row) {
    if (row == null) {
      return null;
    }
    return new ArticleDto(
        row.getId(),
        row.getSlug(),
        row.getTitle(),
        row.getSummary(),
        row.getCoverImage(),
        row.getSourceName(),
        row.getSourceUrl(),
        row.getOriginalUrl(),
        TimeSupport.toIsoString(row.getPublishedAt()),
        row.getLanguage(),
        row.getCategory(),
        jsonSupport.parseStringList(row.getKeywordsJson()),
        jsonSupport.parseStringList(row.getRegionTagsJson()),
        row.getIsGuangxiRelated(),
        jsonSupport.parseStringList(row.getEntityIdsJson()));
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private static String normalizeRegion(String value) {
    String normalized = normalize(value);
    return REGION_TAGS.getOrDefault(normalized, value);
  }

}
