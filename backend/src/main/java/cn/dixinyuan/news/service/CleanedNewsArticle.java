package cn.dixinyuan.news.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record CleanedNewsArticle(
    String id,
    String slug,
    String title,
    String summary,
    String coverImage,
    String sourceUrl,
    String originalUrl,
    String canonicalUrl,
    LocalDateTime publishedAt,
    String language,
    String category,
    List<String> keywords,
    List<String> regionTags,
    boolean guangxiRelated,
    List<String> entityIds,
    String contentHash,
    Map<String, Object> rawPayload) {}
