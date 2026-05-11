package cn.dixinyuan.news.dto;

import java.util.List;

public record StrictRelevanceCriteria(
    List<String> coreKeywords,
    List<String> entityNames,
    int minCoreKeywordMatches,
    boolean allowEntitySubstitution,
    boolean useWordBoundary
) {
  public static StrictRelevanceCriteria defaultCriteria(List<String> coreKeywords, List<String> entityNames) {
    return new StrictRelevanceCriteria(coreKeywords, entityNames, 2, true, true);
  }
}
