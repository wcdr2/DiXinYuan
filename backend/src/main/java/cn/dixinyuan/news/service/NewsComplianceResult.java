package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import java.util.List;

public record NewsComplianceResult(
    boolean qualified,
    List<String> reasons,
    boolean sourceWhitelisted,
    boolean dateInRange,
    boolean detailUrl,
    boolean sourceUrlAllowed,
    boolean urlAccessible,
    boolean bodyPresent,
    boolean summaryFromBody,
    boolean summaryHasRequiredTerm,
    boolean relevant,
    boolean bodyRelevant,
    RelevanceCheckResult relevance,
    UrlVerificationResult urlVerification,
    String verifiedBodyText) {}
