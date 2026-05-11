package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.SourceEntity;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NewsReviewService {
  private final UrlVerificationService urlVerificationService;
  private final StrictRelevanceChecker strictRelevanceChecker;
  private final EntityWhitelistService entityWhitelistService;
  private final LocalDateTime minimumPublishedAt;

  @Autowired
  public NewsReviewService(
      UrlVerificationService urlVerificationService,
      StrictRelevanceChecker strictRelevanceChecker,
      EntityWhitelistService entityWhitelistService,
      @Value("${app.news-min-published-at:2024-01-01T00:00:00}") String minimumPublishedAt) {
    this.urlVerificationService = urlVerificationService;
    this.strictRelevanceChecker = strictRelevanceChecker;
    this.entityWhitelistService = entityWhitelistService;
    this.minimumPublishedAt = LocalDateTime.parse(minimumPublishedAt);
  }


  public ReviewResult review(SourceEntity source, CleanedNewsArticle article, CrawlWindow window) {
    if (!Boolean.TRUE.equals(source.getActive())) {
      return new ReviewResult(false, "source_inactive");
    }
    if (!entityWhitelistService.hasEntityId(source.getWhitelistEntityId())) {
      return new ReviewResult(false, "source_not_whitelisted");
    }
    if (article.publishedAt() == null) {
      return new ReviewResult(false, "missing_published_at");
    }
    if (article.publishedAt().isBefore(minimumPublishedAt)) {
      return new ReviewResult(false, "published_at_before_minimum");
    }
    if (article.publishedAt().isAfter(LocalDateTime.now())) {
      return new ReviewResult(false, "published_at_in_future");
    }
    if (article.publishedAt().isBefore(window.startAt()) || article.publishedAt().isAfter(window.endAt().plusMinutes(1))) {
      return new ReviewResult(false, "published_at_out_of_window");
    }
    if (article.title().length() < 6) {
      return new ReviewResult(false, "title_too_short");
    }
    if (article.summary().length() < 12) {
      return new ReviewResult(false, "summary_too_short");
    }
    if (NewsCleaningService.isTitleOnlySummary(article.title(), article.summary())) {
      return new ReviewResult(false, "summary_from_title");
    }
    if (!NewsCleaningService.hasRequiredSummaryTerm(article.summary())) {
      return new ReviewResult(false, "summary_required_term_missing");
    }
    if (article.bodyText().isBlank()) {
      return new ReviewResult(false, "body_missing");
    }
    if (!NewsBodyTextSupport.isSummaryFromBody(article.summary(), article.bodyText())) {
      return new ReviewResult(false, "summary_not_from_body");
    }
    if (!NewsCleaningService.isDetailUrl(article.originalUrl())) {
      return new ReviewResult(false, "not_detail_url");
    }
    if (!SourceUrlPolicy.isAllowedArticleUrl(source, article.originalUrl())) {
      return new ReviewResult(false, "source_url_domain_mismatch");
    }
    UrlVerificationResult verification = urlVerificationService.verify(article.originalUrl());
    if (!verification.accessible()) {
      return new ReviewResult(false, "original_url_inaccessible");
    }
    if (!isRelevant(source, article)) {
      return new ReviewResult(false, "body_relevance_failed");
    }
    return new ReviewResult(true, "", verification.finalUrl());
  }

  private boolean isRelevant(SourceEntity source, CleanedNewsArticle article) {
    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    RelevanceCheckResult result = strictRelevanceChecker.check(
        article.title(),
        article.summary(),
        article.bodyText(),
        article.keywords(),
        criteria,
        entityWhitelistService.termsForEntityIdOrSource(source.getWhitelistEntityId(), source.getName())
    );

    return result.passed();
  }
}
