package cn.dixinyuan.news.dto;

public record NewsCleanupResultDto(
    int outOfRangeVersions,
    int updatedNews,
    int deletedNews,
    String auditPath,
    boolean deleted) {}
