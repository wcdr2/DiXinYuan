package cn.dixinyuan.news.dto;

public record CandidateReplayResultDto(
    int scannedCount,
    int acceptedCount,
    int insertedVersions,
    int duplicateVersions,
    int skippedCount) {}
