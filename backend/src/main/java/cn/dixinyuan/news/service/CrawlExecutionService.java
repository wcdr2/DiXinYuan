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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class CrawlExecutionService {
  private static final Logger LOGGER = LoggerFactory.getLogger(CrawlExecutionService.class);
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
  private final int crawlParallelism;

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
      TransactionTemplate transactionTemplate,
      @Value("${app.crawl-parallelism:20}") int crawlParallelism) {
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
    this.crawlParallelism = Math.max(1, Math.min(crawlParallelism, 50));
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
    if (run == null) {
      return null;
    }
    List<CrawlRunSourceEntity> rows = crawlRunSourceMapper.selectList(
        new LambdaQueryWrapper<CrawlRunSourceEntity>().eq(CrawlRunSourceEntity::getCrawlRunId, run.getId()));
    int candidateCount = rows.stream().mapToInt(row -> safe(row.getCandidateCount())).sum();
    int insertedVersions = rows.stream().mapToInt(row -> safe(row.getPublishedCount())).sum();
    int duplicateVersions = rows.stream().mapToInt(row -> safe(row.getDuplicateCount())).sum();
    return toDto(run, rows.size(), candidateCount, insertedVersions, duplicateVersions);
  }

  private CrawlRunDto run(String runType, String triggeredBy, LocalDateTime requestedStart, LocalDateTime requestedEnd) {
    CrawlWindow window = crawlWindowService.resolve(requestedStart, requestedEnd);
    List<SourceEntity> sources = sourceBootstrapService.ensureSources();
    CrawlRunEntity run = createRun(runType, triggeredBy, window);

    Stats total = new Stats();
    AtomicInteger failedSources = new AtomicInteger(0);
    AtomicInteger partialSources = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(crawlParallelism);

    try {
      for (SourceEntity source : sources) {
        executor.submit(() -> {
          try {
            SourceCrawlResult result = sourceCrawlerService.crawl(source, window);
            SourceStats sourceStats = handleSource(run.getId(), source, result, window);

            synchronized (total) {
              total.add(sourceStats);
            }

            if ("failed".equals(result.status())) {
              failedSources.incrementAndGet();
            }
            if ("partial".equals(result.coverageStatus())) {
              partialSources.incrementAndGet();
            }

            recordSource(run.getId(), source, result, sourceStats, window);
          } catch (Exception e) {
            failedSources.incrementAndGet();
            LOGGER.error(
                "抓取来源失败，已跳过该来源并继续处理其他来源。sourceId={}, sourceCode={}, sourceName={}",
                source.getId(),
                source.getSourceCode(),
                source.getName(),
                e);
          }
        });
      }

      executor.shutdown();
      executor.awaitTermination(2, TimeUnit.HOURS);

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      executor.shutdownNow();
    }

    int failedCount = failedSources.get();
    int partialCount = partialSources.get();
    String status = sources.isEmpty()
        ? "succeeded"
        : total.acceptedCount > 0
        ? (failedCount > 0 ? "partial_succeeded" : "succeeded")
        : failedCount == sources.size() ? "failed" : "succeeded";
    String coverage = failedCount > 0 ? "partial" : partialCount > 0 ? "partial" : "best_effort";

    transactionTemplate.executeWithoutResult(ignored -> {
      run.setStatus(status);
      run.setCoverageStatus(coverage);
      run.setAcceptedCount(total.acceptedCount);
      run.setRejectedCount(total.rejectedCount);
      run.setFinishedAt(LocalDateTime.now());
      run.setNote("Java 原生抓取完成（并行度=" + crawlParallelism + "）。候选 " + total.candidateCount + " 条，入库版本 " + total.insertedVersions + " 条。");
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
          PersistResult persisted = newsPersistenceService.persistAccepted(crawlRunId, source, cleaned, review);
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
        stats.rejectReasons.merge(review.reason(), 1, Integer::sum);
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
      row.setNote(sourceNote(result, stats));
      row.setStartedAt(LocalDateTime.now());
      row.setFinishedAt(LocalDateTime.now());
      crawlRunSourceMapper.insert(row);
    });
  }

  private static String sourceNote(SourceCrawlResult result, SourceStats stats) {
    StringBuilder builder = new StringBuilder();
    appendNote(builder, result.note());
    if (result.pageCount() > 0 && !builder.toString().contains("页面/订阅")) {
      appendNote(builder, "页面/订阅数=" + result.pageCount());
    }
    if (!stats.rejectReasons.isEmpty()) {
      appendNote(builder, "拒绝原因：" + rejectReasonSummary(stats.rejectReasons));
    }
    return builder.toString();
  }

  private static void appendNote(StringBuilder builder, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    if (builder.length() > 0) {
      builder.append("；");
    }
    builder.append(value);
  }

  private static String rejectReasonSummary(Map<String, Integer> reasons) {
    return reasons.entrySet().stream()
        .map(entry -> rejectReasonLabel(entry.getKey()) + " " + entry.getValue() + " 条")
        .reduce((left, right) -> left + "，" + right)
        .orElse("");
  }

  private static String rejectReasonLabel(String reason) {
    return switch (reason == null ? "" : reason) {
      case "title_too_short" -> "标题过短";
      case "summary_too_short" -> "摘要过短或没有正文摘要";
      case "missing_published_at" -> "缺少发布时间";
      case "published_at_out_of_range" -> "发布时间不在范围内";
      case "summary_not_from_body" -> "摘要不是正文子串";
      case "summary_required_term_missing" -> "摘要缺少必需硬词";
      case "body_missing" -> "缺少正文";
      case "body_relevance_failed" -> "正文强相关不足";
      case "source_not_whitelisted" -> "来源不在白名单";
      case "source_url_domain_mismatch" -> "新闻 URL 不属于来源域名";
      case "not_detail_url" -> "不是具体新闻详情页";
      case "url_inaccessible" -> "URL 不可访问";
      case "keyword_not_matched" -> "关键词规则未命中";
      default -> reason == null || reason.isBlank() ? "未知原因" : reason;
    };
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

  private static int safe(Integer value) {
    return value == null ? 0 : value;
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

  private static final class SourceStats extends Stats {
    final Map<String, Integer> rejectReasons = new LinkedHashMap<>();
  }
}
