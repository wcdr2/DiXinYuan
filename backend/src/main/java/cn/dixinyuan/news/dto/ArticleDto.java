package cn.dixinyuan.news.dto;

import java.util.List;

public record ArticleDto(
    String id,
    String slug,
    String title,
    String summary,
    String coverImage,
    String sourceName,
    String sourceUrl,
    String originalUrl,
    String publishedAt,
    String language,
    String category,
    List<String> keywords,
    List<String> regionTags,
    Boolean isGuangxiRelated,
    List<String> entityIds) {}
