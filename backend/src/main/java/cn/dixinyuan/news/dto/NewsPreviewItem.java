package cn.dixinyuan.news.dto;

import java.time.LocalDateTime;
import java.util.List;

public record NewsPreviewItem(
    Long newsId,
    String newsCode,
    String title,
    String summary,
    LocalDateTime publishedAt,
    String sourceName,
    List<String> matchedKeywords,
    String rejectReason
) {}
