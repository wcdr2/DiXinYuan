package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.dto.CrawlLogDto;
import cn.dixinyuan.news.service.LogQueryService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/logs")
public class LogController {
  private final LogQueryService logQueryService;

  public LogController(LogQueryService logQueryService) {
    this.logQueryService = logQueryService;
  }

  @GetMapping("/latest")
  public List<CrawlLogDto> latest() {
    return logQueryService.latest();
  }
}
