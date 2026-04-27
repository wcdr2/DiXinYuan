package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.ArticleDto;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import cn.dixinyuan.news.support.TimeSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class NewsQueryService {
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final SourceMapper sourceMapper;
  private final JsonSupport jsonSupport;

  public NewsQueryService(
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      SourceMapper sourceMapper,
      JsonSupport jsonSupport) {
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.sourceMapper = sourceMapper;
    this.jsonSupport = jsonSupport;
  }

  public List<ArticleDto> list(
      String query,
      String category,
      String source,
      String region,
      String guangxi,
      String sort,
      int limit) {
    List<ArticleDto> items = loadCurrentArticles();
    String normalizedQuery = normalize(query);
    return items.stream()
        .filter(article -> category == null || category.isBlank() || "all".equals(category) || category.equals(article.category()))
        .filter(article -> source == null || source.isBlank() || "all".equals(source) || source.equals(article.sourceName()))
        .filter(article -> region == null || region.isBlank() || "all".equals(region) || article.regionTags().contains(region))
        .filter(article -> !"only".equals(guangxi) || Boolean.TRUE.equals(article.isGuangxiRelated()))
        .filter(article -> normalizedQuery.isBlank() || searchableText(article).contains(normalizedQuery))
        .sorted("oldest".equals(sort)
            ? Comparator.comparing(ArticleDto::publishedAt)
            : Comparator.comparing(ArticleDto::publishedAt).reversed())
        .limit(Math.max(1, Math.min(limit, 500)))
        .toList();
  }

  public ArticleDto findBySlugOrId(String rawValue) {
    String value = rawValue == null ? "" : rawValue.trim();
    if (value.isBlank()) {
      return null;
    }
    return loadCurrentArticles().stream()
        .filter(article ->
            value.equals(article.id())
                || value.equals(article.slug())
                || value.equals(article.id() + "-" + article.slug())
                || value.startsWith(article.id() + "-"))
        .findFirst()
        .orElse(null);
  }

  public List<ArticleDto> loadCurrentArticles() {
    List<NewsEntity> newsItems = newsMapper.selectList(
        new LambdaQueryWrapper<NewsEntity>().isNotNull(NewsEntity::getCurrentVersionId));
    if (newsItems.isEmpty()) {
      return List.of();
    }
    Set<Long> versionIds = newsItems.stream()
        .map(NewsEntity::getCurrentVersionId)
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());
    Map<Long, NewsVersionEntity> versions = newsVersionMapper.selectBatchIds(versionIds).stream()
        .collect(Collectors.toMap(NewsVersionEntity::getId, Function.identity()));
    Map<Long, SourceEntity> sources = sourceMapper.selectBatchIds(
            newsItems.stream().map(NewsEntity::getSourceId).collect(Collectors.toSet()))
        .stream()
        .collect(Collectors.toMap(SourceEntity::getId, Function.identity()));
    return newsItems.stream()
        .map(news -> toArticle(news, versions.get(news.getCurrentVersionId()), sources.get(news.getSourceId())))
        .filter(Objects::nonNull)
        .toList();
  }

  private ArticleDto toArticle(NewsEntity news, NewsVersionEntity version, SourceEntity source) {
    if (version == null || source == null) {
      return null;
    }
    return new ArticleDto(
        news.getNewsCode(),
        news.getSlug(),
        version.getTitle(),
        version.getSummary(),
        version.getCoverImage(),
        source.getName(),
        version.getSourceUrl(),
        version.getOriginalUrl(),
        TimeSupport.toIsoString(version.getPublishedAt()),
        version.getLanguage(),
        version.getCategory(),
        jsonSupport.parseStringList(version.getKeywordsJson()),
        jsonSupport.parseStringList(version.getRegionTagsJson()),
        version.getIsGuangxiRelated(),
        jsonSupport.parseStringList(version.getEntityIdsJson()));
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private static String searchableText(ArticleDto article) {
    return String.join(
            " ",
            article.title(),
            article.summary(),
            article.sourceName(),
            String.join(" ", article.keywords()),
            String.join(" ", article.regionTags()))
        .toLowerCase();
  }
}
