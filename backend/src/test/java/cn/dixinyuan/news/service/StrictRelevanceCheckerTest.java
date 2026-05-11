package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class StrictRelevanceCheckerTest {

  @Autowired
  private StrictRelevanceChecker checker;

  private StrictRelevanceCriteria criteria;

  @BeforeEach
  void setUp() {
    criteria = checker.getDefaultCriteria();
  }

  @Test
  void shouldPassWithTwoCoreKeywords() {
    RelevanceCheckResult result = checker.check(
        "遥感技术在测绘领域的应用",
        "本文介绍了遥感和测绘的结合",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).hasSize(2);
    assertThat(result.matchedCoreKeywords()).contains("遥感", "测绘");
    assertThat(result.reason()).contains("匹配2个核心关键词");
  }

  @Test
  void shouldPassWithOneCoreKeywordAndOneEntity() {
    RelevanceCheckResult result = checker.check(
        "广西测绘学会举办技术研讨会",
        "会议邀请了多位专家讨论行业发展",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).hasSizeGreaterThanOrEqualTo(1);
    assertThat(result.matchedEntities()).hasSizeGreaterThanOrEqualTo(1);
  }

  @Test
  void shouldRejectLowRelevanceAdministrativeNewsEvenWithEntityName() {
    RelevanceCheckResult result = checker.check(
        "广西测绘学会党委召开干部任职会议",
        "会议围绕组织建设和干部任免事项展开。",
        List.of(),
        criteria);

    assertThat(result.passed()).isFalse();
    assertThat(result.matchedCoreKeywords()).hasSizeGreaterThanOrEqualTo(1);
    assertThat(result.matchedEntities()).hasSizeGreaterThanOrEqualTo(1);
  }

  @Test
  void shouldFailWithOnlyOneCoreKeyword() {
    RelevanceCheckResult result = checker.check(
        "学院召开年度学术会议，讨论遥感课程建设",
        "会议围绕教学改革展开",
        List.of(),
        criteria);

    assertThat(result.passed()).isFalse();
    assertThat(result.matchedCoreKeywords()).hasSize(1);
    assertThat(result.reason()).contains("不满足最低要求");
  }

  @Test
  void shouldUseWordBoundaryMatchingForEnglish() {
    RelevanceCheckResult result = checker.check(
        "Register for the GIS conference on Remote Sensing",
        "Registration details available",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).contains("GIS", "Remote Sensing");
    assertThat(result.matchedCoreKeywords()).doesNotContain("register");
  }

  @Test
  void shouldMatchChineseKeywordsWithoutWordBoundary() {
    RelevanceCheckResult result = checker.check(
        "数字孪生技术在智慧城市中的应用研究",
        "探讨数字孪生和智慧城市的结合",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).contains("数字孪生", "智慧城市");
  }

  @Test
  void shouldMatchKeywordsInSummary() {
    RelevanceCheckResult result = checker.check(
        "学术会议通知",
        "本次会议将重点讨论遥感技术和测绘方法的最新进展",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).contains("遥感", "测绘");
  }

  @Test
  void shouldIgnoreKeywordsNotBackedByTitleOrSummaryEvidence() {
    RelevanceCheckResult result = checker.check(
        "学术研讨会",
        "会议通知",
        List.of("GIS", "北斗"),
        criteria);

    assertThat(result.passed()).isFalse();
    assertThat(result.matchedCoreKeywords()).isEmpty();
  }

  @Test
  void shouldFailWithNoRelevantKeywords() {
    RelevanceCheckResult result = checker.check(
        "学院举办篮球比赛",
        "比赛将于下周举行",
        List.of(),
        criteria);

    assertThat(result.passed()).isFalse();
    assertThat(result.matchedCoreKeywords()).isEmpty();
  }

  @Test
  void shouldHandleMixedChineseAndEnglishKeywords() {
    RelevanceCheckResult result = checker.check(
        "GIS技术在实景三维建模中的应用",
        "Exploring GIS and 3D Reality Modeling integration",
        List.of(),
        criteria);

    assertThat(result.passed()).isTrue();
    assertThat(result.matchedCoreKeywords()).hasSizeGreaterThanOrEqualTo(2);
  }
}
