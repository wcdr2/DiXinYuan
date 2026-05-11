package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class StrictRelevanceChecker {
  private static final List<String> LOW_RELEVANCE_CONTEXT_TERMS = List.of(
      "党委", "党支部", "党建", "理论学习", "民主生活会", "巡视", "干部", "任职", "任免",
      "统战", "工会", "团委", "学生会", "本科教学", "教学指导", "招生", "招聘会", "篮球",
      "足球", "运动会", "慰问", "职工代表大会", "年度工作会议");

  private final List<String> coreKeywords;
  private final EntityWhitelistService entityWhitelistService;
  private final Map<String, Pattern> keywordPatterns;
  private final int minCoreKeywordMatches;
  private final boolean allowEntitySubstitution;
  private final boolean useWordBoundary;

  @Autowired
  public StrictRelevanceChecker(
      @Value("${app.strict-relevance.core-keywords}") String coreKeywordsConfig,
      @Value("${app.strict-relevance.min-core-keyword-matches:2}") int minCoreKeywordMatches,
      @Value("${app.strict-relevance.allow-entity-substitution:true}") boolean allowEntitySubstitution,
      @Value("${app.strict-relevance.use-word-boundary:true}") boolean useWordBoundary,
      EntityWhitelistService entityWhitelistService) {
    this.coreKeywords = parseCoreKeywords(coreKeywordsConfig);
    this.entityWhitelistService = entityWhitelistService;
    this.minCoreKeywordMatches = minCoreKeywordMatches;
    this.allowEntitySubstitution = allowEntitySubstitution;
    this.useWordBoundary = useWordBoundary;
    this.keywordPatterns = new ConcurrentHashMap<>(buildWordBoundaryPatterns(this.coreKeywords));
  }

  public RelevanceCheckResult check(
      String title, String summary, List<String> keywords, StrictRelevanceCriteria criteria) {
    return check(title, summary, (title == null ? "" : title) + " " + (summary == null ? "" : summary), keywords, criteria, List.of());
  }

  public RelevanceCheckResult check(
      String title,
      String summary,
      List<String> keywords,
      StrictRelevanceCriteria criteria,
      List<String> entityEvidenceTerms) {
    return check(title, summary, (title == null ? "" : title) + " " + (summary == null ? "" : summary), keywords, criteria, entityEvidenceTerms);
  }

  public RelevanceCheckResult check(
      String title,
      String summary,
      String bodyText,
      List<String> keywords,
      StrictRelevanceCriteria criteria,
      List<String> entityEvidenceTerms) {
    String cleanBodyText = NewsCleaningService.cleanText(bodyText);
    String evidenceText = cleanBodyText.isBlank()
        ? ((title == null ? "" : title) + " " + (summary == null ? "" : summary)).trim()
        : cleanBodyText;
    String text = (evidenceText + " " + String.join(" ", evidenceKeywords(evidenceText, keywords)));

    List<String> matchedCoreKeywords =
        matchKeywords(text, criteria.coreKeywords(), criteria.useWordBoundary());

    List<String> matchedEntities =
        matchKeywords(text, criteria.entityNames(), criteria.useWordBoundary());
    for (String entityEvidenceTerm : entityEvidenceTerms == null ? List.<String>of() : entityEvidenceTerms) {
      String term = entityEvidenceTerm == null ? "" : entityEvidenceTerm.trim();
      if (!term.isBlank() && matchedEntities.stream().noneMatch(existing -> existing.equalsIgnoreCase(term))) {
        matchedEntities.add(term);
      }
    }

    boolean passed = false;
    String reason = "";

    boolean lowRelevanceContext = matchedCoreKeywords.size() < criteria.minCoreKeywordMatches()
        && containsLowRelevanceContext(evidenceText);

    if (matchedCoreKeywords.size() >= criteria.minCoreKeywordMatches()) {
      passed = true;
      reason = String.format("匹配%d个核心关键词", matchedCoreKeywords.size());
    } else if (criteria.allowEntitySubstitution()
        && matchedCoreKeywords.size() >= 1
        && matchedEntities.size() >= 1
        && !lowRelevanceContext) {
      passed = true;
      reason = "匹配1个核心关键词+1个实体名称";
    } else {
      reason =
          String.format(
              "仅匹配%d个核心关键词和%d个实体名称，不满足最低要求",
              matchedCoreKeywords.size(), matchedEntities.size());
    }

    return new RelevanceCheckResult(passed, reason, matchedCoreKeywords, matchedEntities);
  }

  public StrictRelevanceCriteria getDefaultCriteria() {
    List<String> entityNames = entityWhitelistService.terms();
    return new StrictRelevanceCriteria(
        coreKeywords, entityNames, minCoreKeywordMatches, allowEntitySubstitution, useWordBoundary);
  }

  private List<String> matchKeywords(String text, List<String> keywords, boolean useWordBoundary) {
    List<String> matched = new ArrayList<>();
    String lowerText = text.toLowerCase(Locale.ROOT);

    for (String keyword : keywords) {
      String lowerKeyword = keyword.toLowerCase(Locale.ROOT);

      if (useWordBoundary) {
        if (hasChinese(lowerKeyword)) {
          if (lowerText.contains(lowerKeyword)) {
            matched.add(keyword);
          }
        } else {
          Pattern pattern = keywordPatterns.computeIfAbsent(
              lowerKeyword,
              key -> Pattern.compile(buildWordBoundaryRegex(key), Pattern.CASE_INSENSITIVE));
          if (pattern.matcher(lowerText).find()) {
            matched.add(keyword);
          }
        }
      } else {
        if (lowerText.contains(lowerKeyword)) {
          matched.add(keyword);
        }
      }
    }

    return matched;
  }

  private List<String> evidenceKeywords(String bodyText, List<String> keywords) {
    if (keywords == null || keywords.isEmpty()) {
      return List.of();
    }
    String lowerBody = bodyText.toLowerCase(Locale.ROOT);
    return keywords.stream()
        .map(keyword -> keyword == null ? "" : keyword.trim())
        .filter(keyword -> !keyword.isBlank())
        .filter(keyword -> lowerBody.contains(keyword.toLowerCase(Locale.ROOT)))
        .toList();
  }

  private boolean containsLowRelevanceContext(String bodyText) {
    return LOW_RELEVANCE_CONTEXT_TERMS.stream().anyMatch(bodyText::contains);
  }

  private Map<String, Pattern> buildWordBoundaryPatterns(List<String> keywords) {
    Map<String, Pattern> patterns = new HashMap<>();

    for (String keyword : keywords) {
      String lowerKeyword = keyword.toLowerCase(Locale.ROOT);
      String regex = buildWordBoundaryRegex(lowerKeyword);
      patterns.put(lowerKeyword, Pattern.compile(regex, Pattern.CASE_INSENSITIVE));
    }

    return patterns;
  }

  private String buildWordBoundaryRegex(String keyword) {
    if (hasChinese(keyword)) {
      return Pattern.quote(keyword);
    } else {
      return "\\b" + Pattern.quote(keyword) + "\\b";
    }
  }

  private static boolean hasChinese(String value) {
    return value.matches(".*[\\u4e00-\\u9fa5].*");
  }

  private List<String> parseCoreKeywords(String config) {
    if (config == null || config.isBlank()) {
      return List.of();
    }
    return Arrays.stream(config.split(","))
        .map(String::trim)
        .filter(s -> !s.isBlank())
        .distinct()
        .toList();
  }
}
