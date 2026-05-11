package cn.dixinyuan.news.fixtures;

import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.service.CleanedNewsArticle;
import cn.dixinyuan.news.service.CrawlWindow;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class TestDataFixtures {

  public static SourceEntity createTestSource() {
    SourceEntity source = new SourceEntity();
    source.setSourceCode("test-source-" + System.nanoTime());
    source.setName("测试来源");
    source.setType("government");
    source.setSiteUrl("https://test.example.com");
    source.setLanguage("zh");
    source.setTrustLevel("high");
    source.setActive(true);
    source.setCrawlRuleJson("{\"requireKeywordMatch\":true,\"whitelist\":[\"遥感\",\"测绘\"]}");
    return source;
  }

  public static NewsEntity createTestNewsEntity(Long sourceId) {
    NewsEntity news = new NewsEntity();
    news.setNewsCode("test-news-" + System.nanoTime());
    news.setSourceId(sourceId);
    news.setCanonicalUrl("https://test.example.com/news/" + System.nanoTime());
    news.setSlug("test-slug-" + System.nanoTime());
    news.setFirstSeenAt(LocalDateTime.now());
    news.setLastSeenAt(LocalDateTime.now());
    return news;
  }

  public static NewsVersionEntity createTestNewsVersion(Long newsId, String title, String summary, String keywordsJson) {
    NewsVersionEntity version = new NewsVersionEntity();
    version.setNewsId(newsId);
    version.setTitle(title);
    version.setSummary(summary);
    version.setSourceUrl("https://test.example.com");
    version.setOriginalUrl("https://test.example.com/news/" + System.nanoTime());
    version.setPublishedAt(LocalDateTime.of(2024, 5, 1, 10, 0));
    version.setLanguage("zh");
    version.setCategory("technology");
    version.setKeywordsJson(keywordsJson);
    version.setRegionTagsJson("[\"全国\"]");
    version.setEntityIdsJson("[]");
    version.setIsGuangxiRelated(false);
    version.setContentHash("hash-" + System.nanoTime());
    version.setBodyText(summary);
    return version;
  }

  public static CleanedNewsArticle createTestArticle(String title, String summary, List<String> keywords) {
    return new CleanedNewsArticle(
        "test-id-" + System.nanoTime(),
        "test-slug-" + System.nanoTime(),
        title,
        summary,
        "",
        "https://test.example.com",
        "https://test.example.com/news/" + System.nanoTime(),
        "https://test.example.com/news/" + System.nanoTime(),
        LocalDateTime.of(2024, 5, 1, 10, 0),
        "zh",
        "technology",
        keywords,
        List.of("全国"),
        false,
        List.of(),
        "hash-" + System.nanoTime(),
        summary,
        Map.of());
  }

  public static CrawlWindow createTestCrawlWindow() {
    return new CrawlWindow(
        LocalDateTime.of(2024, 1, 1, 0, 0),
        LocalDateTime.of(2024, 12, 31, 23, 59),
        false);
  }
}
