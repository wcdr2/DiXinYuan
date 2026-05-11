package cn.dixinyuan.news.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record CrawledArticleCandidate(
    String title,
    String summary,
    String coverImage,
    String sourceUrl,
    String originalUrl,
    LocalDateTime publishedAt,
    String language,
    List<String> keywords,
    String bodyText,
    Map<String, Object> rawPayload) {
  public CrawledArticleCandidate(
      String title,
      String summary,
      String coverImage,
      String sourceUrl,
      String originalUrl,
      LocalDateTime publishedAt,
      String language,
      List<String> keywords,
      Map<String, Object> rawPayload) {
    this(
        title,
        summary,
        coverImage,
        sourceUrl,
        originalUrl,
        publishedAt,
        language,
        keywords,
        NewsBodyTextSupport.bodyTextFromPayload(rawPayload),
        rawPayload);
  }
}
