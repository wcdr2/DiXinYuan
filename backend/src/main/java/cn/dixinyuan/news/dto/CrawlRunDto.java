package cn.dixinyuan.news.dto;

public record CrawlRunDto(
    Long crawlRunId,
    String runType,
    String status,
    String coverageStatus,
    String windowStartAt,
    String windowEndAt,
    int sourceCount,
    int candidateCount,
    int acceptedCount,
    int rejectedCount,
    int insertedVersions,
    int duplicateVersions,
    String note) {}
