package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.dto.CandidateReplayResultDto;
import cn.dixinyuan.news.dto.BackfillResultDto;
import cn.dixinyuan.news.dto.CrawlRunDto;
import cn.dixinyuan.news.dto.NewsCleanupResultDto;
import cn.dixinyuan.news.dto.QualityAuditResultDto;
import cn.dixinyuan.news.dto.StrictCleanupResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.service.CrawlBackfillService;
import cn.dixinyuan.news.service.CrawlExecutionService;
import cn.dixinyuan.news.service.NewsCleanupService;
import cn.dixinyuan.news.service.NewsDateCleanupService;
import cn.dixinyuan.news.service.NewsQualityAuditService;
import cn.dixinyuan.news.service.RejectedCandidateReplayService;
import cn.dixinyuan.news.service.StrictRelevanceChecker;
import cn.dixinyuan.news.support.TimeSupport;
import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/internal/crawl")
public class InternalCrawlController {
  private final String internalToken;
  private final CrawlBackfillService crawlBackfillService;
  private final CrawlExecutionService crawlExecutionService;
  private final RejectedCandidateReplayService rejectedCandidateReplayService;
  private final NewsDateCleanupService newsDateCleanupService;
  private final NewsCleanupService newsCleanupService;
  private final NewsQualityAuditService newsQualityAuditService;
  private final StrictRelevanceChecker strictRelevanceChecker;

  public InternalCrawlController(
      @Value("${app.internal-token}") String internalToken,
      CrawlBackfillService crawlBackfillService,
      CrawlExecutionService crawlExecutionService,
      RejectedCandidateReplayService rejectedCandidateReplayService,
      NewsDateCleanupService newsDateCleanupService,
      NewsCleanupService newsCleanupService,
      NewsQualityAuditService newsQualityAuditService,
      StrictRelevanceChecker strictRelevanceChecker) {
    this.internalToken = internalToken;
    this.crawlBackfillService = crawlBackfillService;
    this.crawlExecutionService = crawlExecutionService;
    this.rejectedCandidateReplayService = rejectedCandidateReplayService;
    this.newsDateCleanupService = newsDateCleanupService;
    this.newsCleanupService = newsCleanupService;
    this.newsQualityAuditService = newsQualityAuditService;
    this.strictRelevanceChecker = strictRelevanceChecker;
  }

  @PostMapping("/run")
  public ResponseEntity<CrawlRunDto> run(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    LocalDateTime start = parseBodyTime(body, "start");
    LocalDateTime end = parseBodyTime(body, "end");
    return ResponseEntity.ok(crawlExecutionService.runManualCrawl(start, end));
  }

  @GetMapping("/latest")
  public ResponseEntity<CrawlRunDto> latest(@RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    CrawlRunDto latest = crawlExecutionService.latest();
    return latest == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(latest);
  }

  @PostMapping("/replay-not-detail")
  public ResponseEntity<CandidateReplayResultDto> replayNotDetail(
      @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    return ResponseEntity.ok(rejectedCandidateReplayService.replayNotDetailUrlCandidates());
  }

  @PostMapping("/replay-title-short")
  public ResponseEntity<CandidateReplayResultDto> replayTitleShort(
      @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    return ResponseEntity.ok(rejectedCandidateReplayService.replayTitleTooShortCandidates());
  }

  @PostMapping("/refresh-datasets")
  public ResponseEntity<Map<String, Object>> refreshDatasets(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    Long crawlRunId = parseBodyLong(body, "crawlRunId");
    if (crawlRunId == null) {
      CrawlRunDto latest = crawlExecutionService.latest();
      crawlRunId = latest == null ? null : latest.crawlRunId();
    }
    int refreshed = rejectedCandidateReplayService.refreshDerivedSnapshots(crawlRunId);
    return ResponseEntity.ok(Map.of(
        "crawlRunId", crawlRunId,
        "refreshedSnapshots", refreshed));
  }

  @PostMapping("/cleanup-out-of-range")
  public ResponseEntity<NewsCleanupResultDto> cleanupOutOfRange(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    LocalDateTime start = parseBodyTime(body, "start");
    LocalDateTime end = parseBodyTime(body, "end");
    if (start == null) {
      start = LocalDateTime.of(2024, 1, 1, 0, 0);
    }
    if (end == null) {
      end = LocalDateTime.now().plusMinutes(1);
    }
    boolean delete = Boolean.parseBoolean(body == null ? "false" : body.getOrDefault("delete", "false"));
    return ResponseEntity.ok(delete
        ? newsDateCleanupService.deleteOutOfRange(start, end)
        : newsDateCleanupService.preview(start, end));
  }

  @PostMapping("/cleanup-by-relevance")
  public ResponseEntity<StrictCleanupResult> cleanupByRelevance(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    boolean dryRun = Boolean.parseBoolean(body == null ? "true" : body.getOrDefault("dryRun", "true"));
    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    return ResponseEntity.ok(newsCleanupService.cleanupByStrictRelevance(criteria, dryRun));
  }

  @PostMapping("/cleanup-noncompliant")
  public ResponseEntity<StrictCleanupResult> cleanupNoncompliant(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    boolean dryRun = Boolean.parseBoolean(body == null ? "true" : body.getOrDefault("dryRun", "true"));
    boolean verifyUrls = Boolean.parseBoolean(body == null ? "false" : body.getOrDefault("verifyUrls", "false"));
    return ResponseEntity.ok(newsCleanupService.cleanupNoncompliant(dryRun, verifyUrls));
  }

  @PostMapping("/quality-audit")
  public ResponseEntity<QualityAuditResultDto> qualityAudit(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    boolean verifyUrls = Boolean.parseBoolean(body == null ? "false" : body.getOrDefault("verifyUrls", "false"));
    int urlCheckLimit = parseBodyInt(body, "urlCheckLimit", 1000);
    int targetUniqueNews = parseBodyInt(body, "targetUniqueNews", 1000);
    return ResponseEntity.ok(newsQualityAuditService.audit(verifyUrls, urlCheckLimit, targetUniqueNews));
  }

  @PostMapping("/backfill-until-target")
  public ResponseEntity<BackfillResultDto> backfillUntilTarget(
      @RequestHeader(value = "X-Internal-Token", required = false) String token,
      @RequestBody(required = false) Map<String, String> body) {
    if (!internalToken.equals(token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    LocalDateTime start = parseBodyTime(body, "start");
    LocalDateTime end = parseBodyTime(body, "end");
    int monthsPerWindow = parseBodyInt(body, "monthsPerWindow", 3);
    int maxWindows = parseBodyInt(body, "maxWindows", 16);
    int targetUniqueNews = parseBodyInt(body, "targetUniqueNews", 1000);
    return ResponseEntity.ok(crawlBackfillService.backfillUntilTarget(
        start, end, monthsPerWindow, maxWindows, targetUniqueNews));
  }

  private static LocalDateTime parseBodyTime(Map<String, String> body, String key) {
    if (body == null || body.get(key) == null || body.get(key).isBlank()) {
      return null;
    }
    return TimeSupport.parseToLocalDateTime(body.get(key));
  }

  private static Long parseBodyLong(Map<String, String> body, String key) {
    if (body == null || body.get(key) == null || body.get(key).isBlank()) {
      return null;
    }
    return Long.parseLong(body.get(key));
  }

  private static int parseBodyInt(Map<String, String> body, String key, int fallback) {
    if (body == null || body.get(key) == null || body.get(key).isBlank()) {
      return fallback;
    }
    return Integer.parseInt(body.get(key));
  }
}
