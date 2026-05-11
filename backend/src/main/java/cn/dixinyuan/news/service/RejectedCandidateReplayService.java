package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.CandidateReplayResultDto;
import cn.dixinyuan.news.entity.NewsCandidateEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsCandidateMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.HashSupport;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RejectedCandidateReplayService {
  private final NewsCandidateMapper newsCandidateMapper;
  private final SourceMapper sourceMapper;
  private final NewsPersistenceService newsPersistenceService;
  private final DatasetSnapshotRefreshService datasetSnapshotRefreshService;
  private final JsonSupport jsonSupport;
  private final TransactionTemplate transactionTemplate;
  private final NewsReviewService newsReviewService;

  public RejectedCandidateReplayService(
      NewsCandidateMapper newsCandidateMapper,
      SourceMapper sourceMapper,
      NewsPersistenceService newsPersistenceService,
      DatasetSnapshotRefreshService datasetSnapshotRefreshService,
      JsonSupport jsonSupport,
      TransactionTemplate transactionTemplate,
      NewsReviewService newsReviewService) {
    this.newsCandidateMapper = newsCandidateMapper;
    this.sourceMapper = sourceMapper;
    this.newsPersistenceService = newsPersistenceService;
    this.datasetSnapshotRefreshService = datasetSnapshotRefreshService;
    this.jsonSupport = jsonSupport;
    this.transactionTemplate = transactionTemplate;
    this.newsReviewService = newsReviewService;
  }

  public CandidateReplayResultDto replayNotDetailUrlCandidates() {
    List<NewsCandidateEntity> candidates = newsCandidateMapper.selectList(
        new LambdaQueryWrapper<NewsCandidateEntity>()
            .eq(NewsCandidateEntity::getReviewStatus, "rejected")
            .eq(NewsCandidateEntity::getRejectReason, "not_detail_url")
            .orderByAsc(NewsCandidateEntity::getId));
    Stats stats = new Stats();
    Map<Long, SourceEntity> sources = new LinkedHashMap<>();
    for (NewsCandidateEntity candidate : candidates) {
      stats.scannedCount++;
      String candidateUrl = firstNonBlank(candidate.getCanonicalUrl(), candidate.getOriginalUrl());
      if (!NewsCleaningService.isDetailUrl(candidateUrl)) {
        stats.skippedCount++;
        continue;
      }
      SourceEntity source = sources.computeIfAbsent(candidate.getSourceId(), sourceMapper::selectById);
      if (source == null || !Boolean.TRUE.equals(source.getActive())) {
        stats.skippedCount++;
        continue;
      }
      CleanedNewsArticle article = toArticle(source, candidate);
      ReviewResult review = newsReviewService.review(source, article, replayWindow());
      if (!review.accepted()) {
        stats.skippedCount++;
        continue;
      }
      transactionTemplate.executeWithoutResult(ignored -> {
        PersistResult persisted = newsPersistenceService.persistAccepted(
            candidate.getCrawlRunId(), source, article, review);
        candidate.setReviewStatus("accepted");
        candidate.setRejectReason("replayed_from_not_detail_url");
        newsCandidateMapper.updateById(candidate);
        if (persisted.insertedVersion()) {
          stats.insertedVersions++;
        }
        if (persisted.duplicateVersion()) {
          stats.duplicateVersions++;
        }
        stats.acceptedCount++;
        stats.refreshCrawlRunId = candidate.getCrawlRunId();
      });
    }
    refreshSnapshots(stats);
    return new CandidateReplayResultDto(
        stats.scannedCount,
        stats.acceptedCount,
        stats.insertedVersions,
        stats.duplicateVersions,
        stats.skippedCount);
  }

  public CandidateReplayResultDto replayTitleTooShortCandidates() {
    List<NewsCandidateEntity> candidates = newsCandidateMapper.selectList(
        new LambdaQueryWrapper<NewsCandidateEntity>()
            .eq(NewsCandidateEntity::getReviewStatus, "rejected")
            .eq(NewsCandidateEntity::getRejectReason, "title_too_short")
            .orderByAsc(NewsCandidateEntity::getId));
    Stats stats = new Stats();
    Map<Long, SourceEntity> sources = new LinkedHashMap<>();
    for (NewsCandidateEntity candidate : candidates) {
      stats.scannedCount++;
      String candidateUrl = firstNonBlank(candidate.getCanonicalUrl(), candidate.getOriginalUrl());
      if (!NewsCleaningService.isDetailUrl(candidateUrl)) {
        stats.skippedCount++;
        continue;
      }
      SourceEntity source = sources.computeIfAbsent(candidate.getSourceId(), sourceMapper::selectById);
      if (source == null || !Boolean.TRUE.equals(source.getActive())) {
        stats.skippedCount++;
        continue;
      }
      String replayTitle = replayTitle(candidate.getRawTitle(), candidate.getCleanedTitle(), source.getName());
      if (replayTitle.length() < 6) {
        stats.skippedCount++;
        continue;
      }
      CleanedNewsArticle article = toArticle(source, candidate, replayTitle);
      ReviewResult review = newsReviewService.review(source, article, replayWindow());
      if (!review.accepted()) {
        stats.skippedCount++;
        continue;
      }
      transactionTemplate.executeWithoutResult(ignored -> {
        PersistResult persisted = newsPersistenceService.persistAccepted(
            candidate.getCrawlRunId(), source, article, review);
        candidate.setReviewStatus("accepted");
        candidate.setRejectReason("replayed_from_title_too_short");
        newsCandidateMapper.updateById(candidate);
        if (persisted.insertedVersion()) {
          stats.insertedVersions++;
        }
        if (persisted.duplicateVersion()) {
          stats.duplicateVersions++;
        }
        stats.acceptedCount++;
        stats.refreshCrawlRunId = candidate.getCrawlRunId();
      });
    }
    refreshSnapshots(stats);
    return new CandidateReplayResultDto(
        stats.scannedCount,
        stats.acceptedCount,
        stats.insertedVersions,
        stats.duplicateVersions,
        stats.skippedCount);
  }

  private CleanedNewsArticle toArticle(SourceEntity source, NewsCandidateEntity candidate) {
    return toArticle(source, candidate, firstNonBlank(candidate.getCleanedTitle(), candidate.getRawTitle()));
  }

  private CleanedNewsArticle toArticle(SourceEntity source, NewsCandidateEntity candidate, String title) {
    String canonicalUrl = firstNonBlank(candidate.getCanonicalUrl(), candidate.getOriginalUrl());
    List<String> keywords = parseList(candidate.getKeywordsJson());
    String summary = firstNonBlank(candidate.getCleanedSummary(), candidate.getRawSummary());
    String bodyText = bodyText(candidate);
    return new CleanedNewsArticle(
        HashSupport.sha256(source.getSourceCode() + "::" + canonicalUrl).substring(0, 16),
        slugify(title, source.getSourceCode(), canonicalUrl),
        title,
        summary,
        "",
        source.getSiteUrl(),
        firstNonBlank(candidate.getOriginalUrl(), canonicalUrl),
        canonicalUrl,
        candidate.getPublishedAt(),
        firstNonBlank(candidate.getLanguage(), source.getLanguage()),
        firstNonBlank(candidate.getCategory(), "technology"),
        keywords,
        parseList(candidate.getRegionTagsJson()),
        Boolean.TRUE.equals(candidate.getIsGuangxiRelated()),
        List.of(),
        candidate.getContentHash(),
        bodyText,
        Map.of(
            "replayedCandidateId", candidate.getId(),
            "source", source.getSourceCode(),
            "bodyText", bodyText));
  }

  private String bodyText(NewsCandidateEntity candidate) {
    try {
      String bodyText = jsonSupport.parse(candidate.getRawPayloadJson()).path("bodyText").asText("");
      return NewsCleaningService.cleanText(bodyText);
    } catch (RuntimeException error) {
      return "";
    }
  }

  private List<String> parseList(String json) {
    try {
      return json == null || json.isBlank() ? List.of() : jsonSupport.parseStringList(json);
    } catch (RuntimeException error) {
      return List.of();
    }
  }

  private static String slugify(String title, String sourceCode, String originalUrl) {
    String normalized = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFKD)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9\\u4e00-\\u9fa5]+", "-")
        .replaceAll("(^-+|-+$)", "");
    if (!normalized.isBlank()) {
      return normalized.length() > 120 ? normalized.substring(0, 120).replaceAll("-+$", "") : normalized;
    }
    return sourceCode + "-" + HashSupport.sha256(originalUrl).substring(0, 8);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private static String replayTitle(String rawTitle, String cleanedTitle, String sourceName) {
    String fallback = firstNonBlank(cleanedTitle, rawTitle);
    if (fallback.length() >= 6) {
      return fallback;
    }
    String raw = firstNonBlank(rawTitle).replace('\u00a0', ' ').trim();
    if (!sourceName.isBlank()) {
      raw = raw.replaceAll("\\s*[-|_|｜].*" + java.util.regex.Pattern.quote(sourceName) + ".*$", "").trim();
    }
    String[] segments = raw.split("\\s*[|｜]\\s*");
    String best = raw;
    for (String segment : segments) {
      String candidate = segment == null ? "" : segment.trim();
      if (candidate.length() > best.length()) {
        best = candidate;
      }
    }
    if (best.length() < 6 && raw.contains("-")) {
      for (String segment : raw.split("\\s*-\\s*")) {
        String candidate = segment == null ? "" : segment.trim();
        if (candidate.length() > best.length()) {
          best = candidate;
        }
      }
    }
    return best;
  }

  private static CrawlWindow replayWindow() {
    return new CrawlWindow(
        java.time.LocalDateTime.of(2024, 1, 1, 0, 0),
        java.time.LocalDateTime.now().plusMinutes(1),
        false);
  }

  public int refreshDerivedSnapshots(Long crawlRunId) {
    return datasetSnapshotRefreshService.refreshDerivedSnapshots(crawlRunId);
  }

  private void refreshSnapshots(Stats stats) {
    if (stats.acceptedCount <= 0 || stats.refreshCrawlRunId == null) {
      return;
    }
    datasetSnapshotRefreshService.refreshDerivedSnapshots(stats.refreshCrawlRunId);
  }

  private static final class Stats {
    int scannedCount;
    int acceptedCount;
    int insertedVersions;
    int duplicateVersions;
    int skippedCount;
    Long refreshCrawlRunId;
  }
}
