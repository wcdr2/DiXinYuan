package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NewsComplianceService {
  private final EntityWhitelistService entityWhitelistService;
  private final StrictRelevanceChecker strictRelevanceChecker;
  private final UrlVerificationService urlVerificationService;
  private final LocalDateTime minimumPublishedAt;

  public NewsComplianceService(
      EntityWhitelistService entityWhitelistService,
      StrictRelevanceChecker strictRelevanceChecker,
      UrlVerificationService urlVerificationService,
      @Value("${app.news-min-published-at:2024-01-01T00:00:00}") String minimumPublishedAt) {
    this.entityWhitelistService = entityWhitelistService;
    this.strictRelevanceChecker = strictRelevanceChecker;
    this.urlVerificationService = urlVerificationService;
    this.minimumPublishedAt = LocalDateTime.parse(minimumPublishedAt);
  }

  public LocalDateTime minimumPublishedAt() {
    return minimumPublishedAt;
  }

  public LocalDateTime maximumPublishedAt() {
    return LocalDateTime.now().plusMinutes(1);
  }

  public boolean isSourceWhitelisted(SourceEntity source) {
    return source != null
        && Boolean.TRUE.equals(source.getActive())
        && entityWhitelistService.hasEntityId(source.getWhitelistEntityId());
  }

  public boolean isDateInRange(LocalDateTime publishedAt) {
    return publishedAt != null
        && !publishedAt.isBefore(minimumPublishedAt)
        && !publishedAt.isAfter(maximumPublishedAt());
  }

  public boolean hasRequiredSummaryTerm(String summary) {
    return NewsCleaningService.hasRequiredSummaryTerm(summary);
  }

  public boolean canDeriveRequiredSummaryTerm(String title, String summary, List<String> keywords) {
    return false;
  }

  public RelevanceCheckResult checkRelevance(SourceEntity source, String title, String summary, List<String> keywords) {
    return checkRelevance(source, title, summary, title + " " + summary, keywords);
  }

  public RelevanceCheckResult checkRelevance(
      SourceEntity source, String title, String summary, String bodyText, List<String> keywords) {
    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    return strictRelevanceChecker.check(
        title,
        summary,
        bodyText,
        keywords,
        criteria,
        entityWhitelistService.termsForEntityIdOrSource(
            source == null ? "" : source.getWhitelistEntityId(),
            source == null ? "" : source.getName()));
  }

  public NewsComplianceResult checkCurrentVersion(
      SourceEntity source,
      NewsVersionEntity version,
      List<String> keywords,
      boolean verifyUrl) {
    List<String> reasons = new ArrayList<>();

    boolean sourceWhitelisted = isSourceWhitelisted(source);
    if (!sourceWhitelisted) {
      reasons.add("source_not_whitelisted");
    }

    LocalDateTime publishedAt = version == null ? null : version.getPublishedAt();
    boolean dateInRange = isDateInRange(publishedAt);
    if (!dateInRange) {
      reasons.add(publishedAt == null ? "missing_published_at" : "date_out_of_range");
    }

    String originalUrl = version == null ? "" : version.getOriginalUrl();
    boolean detailUrl = NewsCleaningService.isDetailUrl(originalUrl);
    if (!detailUrl) {
      reasons.add("not_detail_url");
    }
    boolean sourceUrlAllowed = SourceUrlPolicy.isAllowedArticleUrl(source, originalUrl);
    if (!sourceUrlAllowed) {
      reasons.add("source_url_domain_mismatch");
    }

    String title = version == null ? "" : version.getTitle();
    String summary = version == null ? "" : version.getSummary();
    boolean summaryHasRequiredTerm = hasRequiredSummaryTerm(summary);
    if (!summaryHasRequiredTerm) {
      reasons.add("summary_required_term_missing");
    }
    if (NewsCleaningService.isTitleOnlySummary(title, summary)) {
      reasons.add("summary_from_title");
    }

    UrlVerificationResult verification = null;
    boolean urlAccessible = version != null && "accessible".equalsIgnoreCase(version.getUrlStatus());
    String bodyText = version == null ? "" : NewsCleaningService.cleanText(version.getBodyText());
    String verifiedBodyText = "";
    if (verifyUrl && detailUrl && sourceUrlAllowed) {
      verification = urlVerificationService.verify(originalUrl);
      urlAccessible = verification.accessible();
      verifiedBodyText = verification.bodyText();
      if (bodyText.isBlank()) {
        bodyText = verifiedBodyText;
      }
    }
    if (!urlAccessible) {
      reasons.add("original_url_inaccessible");
    }

    boolean bodyPresent = !NewsCleaningService.cleanText(bodyText).isBlank();
    if (!bodyPresent) {
      reasons.add("body_missing");
    }
    boolean summaryFromBody = bodyPresent && NewsBodyTextSupport.isSummaryFromBody(summary, bodyText);
    if (!summaryFromBody) {
      reasons.add("summary_not_from_body");
    }

    RelevanceCheckResult relevance = checkRelevance(source, title, summary, bodyText, keywords);
    boolean bodyRelevant = bodyPresent && relevance.passed();
    if (!bodyRelevant) {
      reasons.add("body_relevance_failed");
    }

    return new NewsComplianceResult(
        reasons.isEmpty(),
        List.copyOf(reasons),
        sourceWhitelisted,
        dateInRange,
        detailUrl,
        sourceUrlAllowed,
        urlAccessible,
        bodyPresent,
        summaryFromBody,
        summaryHasRequiredTerm,
        bodyRelevant,
        bodyRelevant,
        relevance,
        verification,
        verifiedBodyText);
  }
}
