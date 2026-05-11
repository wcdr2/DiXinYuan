package cn.dixinyuan.news.service;

import java.time.LocalDateTime;
import java.util.List;

public record SourceCrawlResult(
    List<CrawledArticleCandidate> candidates,
    int fetchedCount,
    int pageCount,
    String status,
    String coverageStatus,
    String note,
    String error,
    LocalDateTime earliestPublishedAt,
    LocalDateTime latestPublishedAt) {}
