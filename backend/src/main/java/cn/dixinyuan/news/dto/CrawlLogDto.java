package cn.dixinyuan.news.dto;

public record CrawlLogDto(
    String sourceId,
    String sourceName,
    String startedAt,
    String finishedAt,
    String status,
    Integer fetchedCount,
    Integer publishedCount,
    Integer duplicateCount,
    String note) {}
