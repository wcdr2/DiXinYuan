package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.CrawlRunDto;
import cn.dixinyuan.news.entity.CrawlRunEntity;
import cn.dixinyuan.news.entity.CrawlRunSourceEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.CrawlRunMapper;
import cn.dixinyuan.news.mapper.CrawlRunSourceMapper;
import cn.dixinyuan.news.support.TimeSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class CrawlExecutionService {
  private final SourceBootstrapService sourceBootstrapService;
  private final CrawlWindowService crawlWindowService;
  private final SourceCrawlerService sourceCrawlerService;
  private final NewsCleaningService newsCleaningService;
  private final NewsReviewService newsReviewService;
  private final NewsPersistenceService newsPersistenceService;
  private final DatasetSnapshotRefreshService datasetSnapshotRefreshService;
  private final CrawlRunMapper crawlRunMapper;
  private final CrawlRunSourceMapper crawlRunSourceMapper;
  private final TransactionTemplate transactionTemplate;

  public CrawlExecutionService(
      SourceBootstrapService sourceBootstrapService,
      CrawlWindowService crawlWindowService,
      SourceCrawlerService sourceCrawlerService,
      NewsCleaningService newsCleaningService,
      NewsReviewService newsReviewService,
      NewsPersistenceService newsPersistenceService,
      DatasetSnapshotRefreshService datasetSnapshotRefreshService,
      CrawlRunMapper crawlRunMapper,
      CrawlRunSourceMapper crawlRunSourceMapper,
      TransactionTemplate transactionTemplate) {
    this.sourceBootstrapService = sourceBootstrapService;
    this.crawlWindowService = crawlWindowService;
    this.sourceCrawlerService = sourceCrawlerService;
    this.newsCleaningService = newsCleaningService;
    this.newsReviewService = newsReviewService;
    this.newsPersistenceService = newsPersistenceService;
    this.datasetSnapshotRefreshService = datasetSnapshotRefreshService;
    this.crawlRunMapper = crawlRunMapper;
    this.crawlRunSourceMapper = crawlRunSourceMapper;
    this.transactionTemplate = transactionTemplate;
  }

  public CrawlRunDto runAutoStartupCrawl() {
    return run("startup-auto", "startup", null, null);
  }

  public CrawlRunDto runManualCrawl(LocalDateTime requestedStart, LocalDateTime requestedEnd) {
    return run("manual-crawl", "manual", requestedStart, requestedEnd);
  }

  public CrawlRunDto latest() {
    CrawlRunEntity run = crawlRunMapper.selectList(
            new LambdaQueryWrapper<CrawlRunEntity>()
                .in(CrawlRunEntity::getRunType, "startup-auto", "manual-crawl")
                .orderByDesc(CrawlRunEntity::getStartedAt)
                .last("LIMIT 1"))
        .stream()
        .findFirst()
        .orElse(null);
    return run == null ? null : toDto(run, 0, 0, 0, 0);
  }

  private CrawlRunDto run(String runType, String triggeredBy, LocalDateTime requestedStart, LocalDateTime requestedEnd) {
    CrawlWindow window = crawlWindowService.resolve(requestedStart, requestedEnd);
    List<SourceEntity> sources = sourceBootstrapService.ensureSources();
    CrawlRunEntity run = createRun(runType, triggeredBy, window);
    Stats total = new Stats();
    int failedSources = 0;
    int partialSources = 0;

    for (SourceEntity source : sources) {
      SourceCrawlResult result = sourceCrawlerService.crawl(source, window);
      SourceStats sourceStats = handleSource(run.getId(), source, result, window);
      total.add(sourceStats);
      if ("failed".equals(result.status())) {
        failedSources++;
      }
      if ("partial".equals(result.coverageStatus())) {
        partialSources++;
      }
      recordSource(run.getId(), source, result, sourceStats, window);
    }

    String status = total.acceptedCount > 0
        ? (failedSources > 0 ? "partial_succeeded" : "succeeded")
        : failedSources == sources.size() ? "failed" : "succeeded";
    String coverage = failedSources > 0 ? "partial" : partialSources > 0 ? "partial" : "best_effort";
    transactionTemplate.executeWithoutResult(ignored -> {
      run.setStatus(status);
      run.setCoverageStatus(coverage);
      run.setAcceptedCount(total.acceptedCount);
      run.setRejectedCount(total.rejectedCount);
      run.setFinishedAt(LocalDateTime.now());
      run.setNote("Java 原生抓取完成。候选 " + total.candidateCount + " 条，入库版本 " + total.insertedVersions + " 条。");
      crawlRunMapper.updateById(run);
      if (total.acceptedCount > 0) {
        datasetSnapshotRefreshService.refreshDerivedSnapshots(run.getId());
      }
    });
    return toDto(run, sources.size(), total.candidateCount, total.insertedVersions, total.duplicateVersions);
  }

  private CrawlRunEntity createRun(String runType, String triggeredBy, CrawlWindow window) {
    CrawlRunEntity run = new CrawlRunEntity();
    run.setRunType(runType);
    run.setTriggeredBy(triggeredBy);
    run.setStatus("running");
    run.setCoverageStatus("running");
    run.setAcceptedCount(0);
    run.setRejectedCount(0);
    run.setStartedAt(LocalDateTime.now());
    run.setWindowStartAt(window.startAt());
    run.setWindowEndAt(window.endAt());
    run.setNote(window.firstRun() ? "首次自动抓取。" : "增量自动抓取。");
    crawlRunMapper.insert(run);
    return run;
  }

  private SourceStats handleSource(Long crawlRunId, SourceEntity source, SourceCrawlResult result, CrawlWindow window) {
    SourceStats stats = new SourceStats();
    stats.candidateCount = result.candidates().size();
    for (CrawledArticleCandidate raw : result.candidates()) {
      CleanedNewsArticle cleaned = newsCleaningService.clean(source, raw);
      ReviewResult review = newsReviewService.review(source, cleaned, window);
      transactionTemplate.executeWithoutResult(ignored -> {
        newsPersistenceService.recordCandidate(crawlRunId, source, raw, cleaned, review);
        if (review.accepted()) {
          PersistResult persisted = newsPersistenceService.persistAccepted(crawlRunId, source, cleaned);
          if (persisted.insertedVersion()) {
            stats.insertedVersions++;
          }
          if (persisted.duplicateVersion()) {
            stats.duplicateVersions++;
          }
        }
      });
      if (review.accepted()) {
        stats.acceptedCount++;
      } else {
        stats.rejectedCount++;
      }
    }
    return stats;
  }

  private void recordSource(
      Long crawlRunId,
      SourceEntity source,
      SourceCrawlResult result,
      SourceStats stats,
      CrawlWindow window) {
    transactionTemplate.executeWithoutResult(ignored -> {
      CrawlRunSourceEntity row = new CrawlRunSourceEntity();
      row.setCrawlRunId(crawlRunId);
      row.setSourceId(source.getId());
      row.setWindowStartAt(window.startAt());
      row.setWindowEndAt(window.endAt());
      row.setStatus(result.status());
      row.setFetchedCount(result.fetchedCount());
      row.setCandidateCount(stats.candidateCount);
      row.setAcceptedCount(stats.acceptedCount);
      row.setRejectedCount(stats.rejectedCount);
      row.setPublishedCount(stats.insertedVersions);
      row.setDuplicateCount(stats.duplicateVersions);
      row.setEarliestPublishedAt(result.earliestPublishedAt());
      row.setLatestPublishedAt(result.latestPublishedAt());
      row.setCoverageStatus(result.coverageStatus());
      row.setErrorMessage(result.error());
      row.setNote(result.note());
      row.setStartedAt(LocalDateTime.now());
      row.setFinishedAt(LocalDateTime.now());
      crawlRunSourceMapper.insert(row);
    });
  }

  private CrawlRunDto toDto(CrawlRunEntity run, int sourceCount, int candidateCount, int insertedVersions, int duplicateVersions) {
    return new CrawlRunDto(
        run.getId(),
        run.getRunType(),
        run.getStatus(),
        run.getCoverageStatus(),
        TimeSupport.toIsoString(run.getWindowStartAt()),
        TimeSupport.toIsoString(run.getWindowEndAt()),
        sourceCount,
        candidateCount,
        run.getAcceptedCount() == null ? 0 : run.getAcceptedCount(),
        run.getRejectedCount() == null ? 0 : run.getRejectedCount(),
        insertedVersions,
        duplicateVersions,
        run.getNote());
  }

  private static class Stats {
    int candidateCount;
    int acceptedCount;
    int rejectedCount;
    int insertedVersions;
    int duplicateVersions;

    void add(SourceStats stats) {
      candidateCount += stats.candidateCount;
      acceptedCount += stats.acceptedCount;
      rejectedCount += stats.rejectedCount;
      insertedVersions += stats.insertedVersions;
      duplicateVersions += stats.duplicateVersions;
    }
  }

  private static final class SourceStats extends Stats {}
}
