package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.SourceEntity;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NewsReviewServiceTest {
  private final StrictRelevanceChecker mockChecker = mock(StrictRelevanceChecker.class);
  private final EntityWhitelistService mockWhitelist = mock(EntityWhitelistService.class);
  private final StrictRelevanceCriteria criteria =
      new StrictRelevanceCriteria(List.of("遥感", "测绘", "GIS"), List.of("广西测绘学会"), 2, true, true);

  @BeforeEach
  void setUp() {
    when(mockChecker.getDefaultCriteria()).thenReturn(criteria);
    when(mockWhitelist.hasEntityId("entity-001")).thenReturn(true);
  }

  @Test
  void requireKeywordMatchFalseCannotBypassStrictRelevance() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false,\"whitelist\":[\"遥感\"]}");
    when(mockChecker.check(any(), any(), any(), any(), any(), any()))
        .thenReturn(new RelevanceCheckResult(false, "not enough domain keywords", List.of(), List.of()));

    ReviewResult result = reviewService.review(source, article(
        "学院召开年度会议",
        "会议围绕遥感课程建设、人才培养和科研合作展开交流。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("body_relevance_failed");
  }

  @Test
  void acceptsOnlyWhitelistedAccessibleRelevantDetailNews() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");
    when(mockChecker.check(any(), any(), any(), any(), any(), any()))
        .thenReturn(new RelevanceCheckResult(true, "matched", List.of("遥感", "测绘"), List.of()));

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isTrue();
    assertThat(result.verifiedUrl()).isEqualTo("https://example.test/info/123.htm");
  }

  @Test
  void rejectsArticlesBeforeConfiguredMinimumDate() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of(),
        LocalDateTime.of(2023, 12, 31, 23, 59),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("published_at_before_minimum");
  }

  @Test
  void rejectsInaccessibleOriginalUrls() {
    NewsReviewService reviewService = new NewsReviewService(new UrlVerificationService() {
      @Override
      public UrlVerificationResult verify(String url) {
        return UrlVerificationResult.inaccessible(url, 404, "http_404");
      }
    }, mockChecker, mockWhitelist, "2024-01-01T00:00:00");
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("original_url_inaccessible");
  }

  @Test
  void rejectsWhenSummaryCannotProvideRequiredDomainTerm() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "学院召开年度会议",
        "会议围绕学科建设、人才培养和科研合作展开交流。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("summary_required_term_missing");
  }

  @Test
  void rejectsTitleOnlySummary() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "GIS platform released",
        "GIS platform released",
        List.of("GIS"),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("summary_from_title");
  }

  @Test
  void rejectsSummaryThatIsNotFromBody() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, articleWithBody(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        "正文只介绍组织建设和人才培养，没有包含摘要原文。",
        List.of("遥感", "测绘"),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("summary_not_from_body");
  }

  @Test
  void rejectsUrlsOutsideSourceDomain() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of("遥感", "测绘"),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://outside.invalid.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("source_url_domain_mismatch");
  }

  @Test
  void rejectsAliasEvidenceWhenSummaryLacksRequiredTerm() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");
    when(mockChecker.check(any(), any(), any(), any(), any(), any()))
        .thenReturn(new RelevanceCheckResult(true, "matched", List.of("Remote Sensing", "GIS"), List.of()));

    ReviewResult result = reviewService.review(source, article(
        "Remote Sensing GIS platform released",
        "The platform improves spatial data services for cities.",
        List.of("Remote Sensing", "GIS"),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("summary_required_term_missing");
  }

  @Test
  void rejectsHomepageOrListUrlBeforeUrlVerification() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("not_detail_url");
  }

  @Test
  void rejectsNonWhitelistedSourcesEvenWhenRelevant() {
    NewsReviewService reviewService = serviceWithAccessibleUrls();
    SourceEntity source = activeSource("{\"requireKeywordMatch\":false}");
    source.setWhitelistEntityId("missing-entity");
    when(mockChecker.check(any(), any(), any(), any(), any(), any()))
        .thenReturn(new RelevanceCheckResult(true, "matched", List.of("遥感", "测绘"), List.of()));

    ReviewResult result = reviewService.review(source, article(
        "遥感测绘平台发布",
        "平台面向地理信息和自然资源数字化业务提供遥感测绘能力。",
        List.of(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "https://example.test/info/123.htm"), window());

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).isEqualTo("source_not_whitelisted");
  }

  private NewsReviewService serviceWithAccessibleUrls() {
    return new NewsReviewService(new UrlVerificationService() {
      @Override
      public UrlVerificationResult verify(String url) {
        return UrlVerificationResult.accessible(url, 200);
      }
    }, mockChecker, mockWhitelist, "2024-01-01T00:00:00");
  }

  private static SourceEntity activeSource(String crawlRuleJson) {
    SourceEntity source = new SourceEntity();
    source.setActive(true);
    source.setWhitelistEntityId("entity-001");
    source.setSourceCode("test-source");
    source.setName("广西测绘学会");
    source.setSiteUrl("https://example.test");
    source.setCrawlRuleJson(crawlRuleJson);
    return source;
  }

  private static CrawlWindow window() {
    return new CrawlWindow(
        LocalDateTime.of(2024, 1, 1, 0, 0),
        LocalDateTime.of(2024, 12, 31, 23, 59),
        false);
  }

  private static CleanedNewsArticle article(
      String title,
      String summary,
      List<String> keywords,
      LocalDateTime publishedAt,
      String originalUrl) {
    return articleWithBody(title, summary, summary, keywords, publishedAt, originalUrl);
  }

  private static CleanedNewsArticle articleWithBody(
      String title,
      String summary,
      String bodyText,
      List<String> keywords,
      LocalDateTime publishedAt,
      String originalUrl) {
    return new CleanedNewsArticle(
        "id",
        "slug",
        title,
        summary,
        "",
        "https://example.test",
        originalUrl,
        originalUrl,
        publishedAt,
        "zh",
        "technology",
        keywords,
        List.of("全国"),
        false,
        List.of(),
        "hash",
        bodyText,
        Map.of());
  }
}
