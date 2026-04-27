package cn.dixinyuan.news.dto;

public record ImportResultDto(
    Long crawlRunId,
    int sourceCount,
    int articleCount,
    int insertedVersions,
    int duplicateVersions,
    int snapshotCount) {}
