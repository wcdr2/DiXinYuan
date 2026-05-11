package cn.dixinyuan.news.dto;

public record CrawlLogDto(
    String sourceId,
    String sourceName,
    String startedAt,
    String finishedAt,
    String status,
    Integer fetchedCount,
    Integer candidateCount,
    Integer acceptedCount,
    Integer rejectedCount,
    Integer publishedCount,
    Integer duplicateCount,
    String coverageStatus,
    String errorMessage,
    String note) {}
