package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class NewsReviewService {
  public ReviewResult review(SourceEntity source, CleanedNewsArticle article, CrawlWindow window) {
    if (!Boolean.TRUE.equals(source.getActive())) {
      return new ReviewResult(false, "source_inactive");
    }
    if (article.publishedAt() == null) {
      return new ReviewResult(false, "missing_published_at");
    }
    if (article.publishedAt().isBefore(window.startAt()) || article.publishedAt().isAfter(window.endAt().plusMinutes(1))) {
      return new ReviewResult(false, "published_at_out_of_window");
    }
    if (article.title().length() < 6) {
      return new ReviewResult(false, "title_too_short");
    }
    if (article.summary().length() < 12) {
      return new ReviewResult(false, "summary_too_short");
    }
    if (!NewsCleaningService.isDetailUrl(article.originalUrl())) {
      return new ReviewResult(false, "not_detail_url");
    }
    if (!isRelevant(source, article)) {
      return new ReviewResult(false, "keyword_not_matched");
    }
    return new ReviewResult(true, "");
  }

  private boolean isRelevant(SourceEntity source, CleanedNewsArticle article) {
    String text = (article.title() + " " + article.summary() + " " + String.join(" ", article.keywords())).toLowerCase(Locale.ROOT);
    for (String keyword : article.keywords()) {
      if (!keyword.isBlank() && text.contains(keyword.toLowerCase(Locale.ROOT))) {
        return true;
      }
    }
    try {
      JsonNode whitelist = new com.fasterxml.jackson.databind.ObjectMapper().readTree(source.getCrawlRuleJson()).path("whitelist");
      if (whitelist.isArray()) {
        for (JsonNode item : whitelist) {
          String keyword = item.asText("").toLowerCase(Locale.ROOT);
          if (!keyword.isBlank() && text.contains(keyword)) {
            return true;
          }
        }
      }
    } catch (Exception ignored) {
      // Fall through to built-in keyword checks.
    }
    return text.contains("地理信息")
        || text.contains("测绘")
        || text.contains("遥感")
        || text.contains("自然资源")
        || text.contains("geospatial")
        || text.contains("earth observation")
        || text.contains("remote sensing")
        || text.contains("satellite");
  }
}
