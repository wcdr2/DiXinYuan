package cn.dixinyuan.news.dto;

import java.util.List;

public record QualityAuditResultDto(
    int targetUniqueNews,
    int totalUniqueNews,
    int qualifiedUniqueNews,
    int missingToTarget,
    int sourceNotWhitelistedCount,
    int dateOutOfRangeCount,
    int notDetailUrlCount,
    int sourceUrlDomainMismatchCount,
    int inaccessibleUrlCount,
    int bodyMissingCount,
    int summaryNotFromBodyCount,
    int summaryRequiredTermMissingCount,
    int relevanceFailedCount,
    int bodyRelevanceFailedCount,
    int duplicateCanonicalUrlCount,
    int zhCount,
    int guangxiRelatedCount,
    int verifiedAccessibleCurrentCount,
    int urlCheckedCount,
    int urlAccessibleCount,
    double urlAccessibilityRate,
    double sourceWhitelistCoverageRate,
    String auditReportPath,
    List<String> topRejectReasons) {}
