package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.dto.CrawlRunDto;
import cn.dixinyuan.news.service.CrawlExecutionService;
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
  private final CrawlExecutionService crawlExecutionService;

  public InternalCrawlController(
      @Value("${app.internal-token}") String internalToken,
      CrawlExecutionService crawlExecutionService) {
    this.internalToken = internalToken;
    this.crawlExecutionService = crawlExecutionService;
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

  private static LocalDateTime parseBodyTime(Map<String, String> body, String key) {
    if (body == null || body.get(key) == null || body.get(key).isBlank()) {
      return null;
    }
    return TimeSupport.parseToLocalDateTime(body.get(key));
  }
}
