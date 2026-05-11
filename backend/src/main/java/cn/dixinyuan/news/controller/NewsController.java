package cn.dixinyuan.news.controller;

import cn.dixinyuan.news.dto.ArticleDto;
import cn.dixinyuan.news.dto.ArticlePageDto;
import cn.dixinyuan.news.service.NewsQueryService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/news")
public class NewsController {
  private final NewsQueryService newsQueryService;

  public NewsController(NewsQueryService newsQueryService) {
    this.newsQueryService = newsQueryService;
  }

  @GetMapping
  public List<ArticleDto> list(
      @RequestParam(required = false) String query,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String region,
      @RequestParam(required = false) String guangxi,
      @RequestParam(required = false, defaultValue = "latest") String sort,
      @RequestParam(required = false, defaultValue = "2000") int limit) {
    return newsQueryService.list(query, category, source, region, guangxi, sort, limit);
  }

  @GetMapping("/page")
  public ArticlePageDto page(
      @RequestParam(required = false) String query,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String source,
      @RequestParam(required = false) String region,
      @RequestParam(required = false) String guangxi,
      @RequestParam(required = false, defaultValue = "latest") String sort,
      @RequestParam(required = false, defaultValue = "1") int page,
      @RequestParam(required = false, defaultValue = "24") int pageSize) {
    return newsQueryService.page(query, category, source, region, guangxi, sort, page, pageSize);
  }

  @GetMapping("/{slugOrId}")
  public ResponseEntity<ArticleDto> detail(@PathVariable String slugOrId) {
    ArticleDto article = newsQueryService.findBySlugOrId(slugOrId);
    return article == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(article);
  }
}
