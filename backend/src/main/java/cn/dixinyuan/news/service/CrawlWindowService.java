package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.CrawlRunEntity;
import cn.dixinyuan.news.mapper.CrawlRunMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CrawlWindowService {
  private final CrawlRunMapper crawlRunMapper;
  private final LocalDateTime firstStartAt;
  private final int overlapMinutes;

  public CrawlWindowService(
      CrawlRunMapper crawlRunMapper,
      @Value("${app.crawl-first-start}") String firstStartAt,
      @Value("${app.crawl-overlap-minutes}") int overlapMinutes) {
    this.crawlRunMapper = crawlRunMapper;
    this.firstStartAt = LocalDateTime.parse(firstStartAt);
    this.overlapMinutes = overlapMinutes;
  }

  public CrawlWindow resolve(LocalDateTime requestedStart, LocalDateTime requestedEnd) {
    LocalDateTime end = requestedEnd == null ? LocalDateTime.now() : requestedEnd;
    if (requestedStart != null) {
      return new CrawlWindow(validStart(requestedStart, end), end, false);
    }

    CrawlRunEntity latest = crawlRunMapper.selectList(
            new LambdaQueryWrapper<CrawlRunEntity>()
                .in(CrawlRunEntity::getRunType, "startup-auto", "manual-crawl")
                .in(CrawlRunEntity::getStatus, "succeeded", "partial_succeeded")
                .isNotNull(CrawlRunEntity::getWindowEndAt)
                .orderByDesc(CrawlRunEntity::getWindowEndAt)
                .last("LIMIT 1"))
        .stream()
        .findFirst()
        .orElse(null);
    if (latest == null) {
      return new CrawlWindow(validStart(firstStartAt, end), end, true);
    }
    LocalDateTime latestEnd = latest.getWindowEndAt();
    LocalDateTime start = latestEnd == null || !latestEnd.isBefore(end)
        ? end.minusMinutes(overlapMinutes)
        : latestEnd.minusMinutes(overlapMinutes);
    return new CrawlWindow(validStart(start, end), end, false);
  }

  private LocalDateTime validStart(LocalDateTime start, LocalDateTime end) {
    LocalDateTime clamped = start.isBefore(firstStartAt) ? firstStartAt : start;
    if (clamped.isAfter(end)) {
      LocalDateTime overlapped = end.minusMinutes(overlapMinutes);
      return overlapped.isBefore(firstStartAt) ? firstStartAt : overlapped;
    }
    return clamped;
  }
}
