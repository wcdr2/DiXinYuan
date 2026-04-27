package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.service.DatasetQueryService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/datasets")
public class DatasetController {
  private final DatasetQueryService datasetQueryService;

  public DatasetController(DatasetQueryService datasetQueryService) {
    this.datasetQueryService = datasetQueryService;
  }

  @GetMapping("/summary")
  public JsonNode summary() {
    return datasetQueryService.latest("summary");
  }

  @GetMapping("/word-cloud")
  public JsonNode wordCloud() {
    return datasetQueryService.latest("word-cloud");
  }

  @GetMapping("/map")
  public JsonNode map() {
    return datasetQueryService.latest("map");
  }

  @GetMapping("/knowledge-graph")
  public JsonNode knowledgeGraph() {
    return datasetQueryService.latest("knowledge-graph");
  }
}
