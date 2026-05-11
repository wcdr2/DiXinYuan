package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.BackfillResultDto;
import cn.dixinyuan.news.dto.CrawlRunDto;
import cn.dixinyuan.news.dto.QualityAuditResultDto;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CrawlBackfillService {
  private final CrawlExecutionService crawlExecutionService;
  private final NewsQualityAuditService newsQualityAuditService;

  public CrawlBackfillService(
      CrawlExecutionService crawlExecutionService,
      NewsQualityAuditService newsQualityAuditService) {
    this.crawlExecutionService = crawlExecutionService;
    this.newsQualityAuditService = newsQualityAuditService;
  }

  public BackfillResultDto backfillUntilTarget(
      LocalDateTime start,
      LocalDateTime end,
      int monthsPerWindow,
      int maxWindows,
      int targetUniqueNews) {
    LocalDateTime current = start == null ? LocalDateTime.of(2024, 1, 1, 0, 0) : start;
    LocalDateTime finalEnd = end == null ? LocalDateTime.now().plusMinutes(1) : end;
    int safeMonths = Math.max(monthsPerWindow, 1);
    int safeMaxWindows = Math.max(maxWindows, 1);
    int safeTarget = Math.max(targetUniqueNews, 1000);

    QualityAuditResultDto initialAudit = newsQualityAuditService.audit(false, 0, safeTarget);
    List<CrawlRunDto> runs = new ArrayList<>();
    QualityAuditResultDto latestAudit = initialAudit;

    while (current.isBefore(finalEnd)
        && runs.size() < safeMaxWindows
        && latestAudit.qualifiedUniqueNews() < safeTarget) {
      LocalDateTime windowEnd = current.plusMonths(safeMonths);
      if (windowEnd.isAfter(finalEnd)) {
        windowEnd = finalEnd;
      }
      runs.add(crawlExecutionService.runManualCrawl(current, windowEnd));
      latestAudit = newsQualityAuditService.audit(false, 0, safeTarget);
      current = windowEnd;
    }

    return new BackfillResultDto(
        safeTarget,
        initialAudit.qualifiedUniqueNews(),
        latestAudit.qualifiedUniqueNews(),
        runs.size(),
        latestAudit.qualifiedUniqueNews() >= safeTarget,
        latestAudit,
        runs);
  }
}
