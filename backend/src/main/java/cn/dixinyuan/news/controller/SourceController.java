package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.dto.SourceDto;
import cn.dixinyuan.news.service.SourceQueryService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sources")
public class SourceController {
  private final SourceQueryService sourceQueryService;

  public SourceController(SourceQueryService sourceQueryService) {
    this.sourceQueryService = sourceQueryService;
  }

  @GetMapping
  public List<SourceDto> list() {
    return sourceQueryService.list();
  }
}
