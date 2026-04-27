package cn.dixinyuan.news.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class StartupCrawlService {
  private final boolean autoCrawlOnStartup;
  private final CrawlExecutionService crawlExecutionService;

  public StartupCrawlService(
      @Value("${app.auto-crawl-on-startup}") boolean autoCrawlOnStartup,
      CrawlExecutionService crawlExecutionService) {
    this.autoCrawlOnStartup = autoCrawlOnStartup;
    this.crawlExecutionService = crawlExecutionService;
  }

  @Async
  @EventListener(ApplicationReadyEvent.class)
  public void crawlOnStartup() {
    if (!autoCrawlOnStartup) {
      return;
    }
    crawlExecutionService.runAutoStartupCrawl();
  }
}
