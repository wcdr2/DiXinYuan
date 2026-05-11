package cn.dixinyuan.news.dto;

public record StrictCleanupResult(
    int deletedNewsCount,
    int deletedVersionsCount,
    int updatedNewsCount,
    String auditReportPath,
    boolean dryRun,
    String message
) {}
