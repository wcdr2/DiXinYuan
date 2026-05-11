package cn.dixinyuan.news.dto;

import java.util.List;

public record RelevanceCheckResult(
    boolean passed,
    String reason,
    List<String> matchedCoreKeywords,
    List<String> matchedEntities
) {}
