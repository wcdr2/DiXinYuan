package cn.dixinyuan.news.dto;

import java.util.List;

public record BackfillResultDto(
    int targetUniqueNews,
    int startingQualifiedCount,
    int endingQualifiedCount,
    int executedWindows,
    boolean targetReached,
    QualityAuditResultDto finalAudit,
    List<CrawlRunDto> crawlRuns) {}
