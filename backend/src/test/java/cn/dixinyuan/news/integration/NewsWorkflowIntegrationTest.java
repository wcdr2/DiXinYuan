package cn.dixinyuan.news.integration;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.dto.StrictCleanupResult;
import cn.dixinyuan.news.dto.ArticlePageDto;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.service.CleanedNewsArticle;
import cn.dixinyuan.news.service.NewsCleanupService;
import cn.dixinyuan.news.service.NewsQueryService;
import cn.dixinyuan.news.service.StrictRelevanceChecker;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for the complete news workflow: review -> cleanup
 */
@SpringBootTest
@Transactional
class NewsWorkflowIntegrationTest {

  @Autowired private NewsCleanupService cleanupService;

  @Autowired private NewsQueryService newsQueryService;

  @Autowired private StrictRelevanceChecker strictRelevanceChecker;

  @Autowired private NewsMapper newsMapper;

  @Autowired private NewsVersionMapper newsVersionMapper;

  @Autowired private SourceMapper sourceMapper;

  private SourceEntity testSource;

  @BeforeEach
  void setUp() {
    testSource = new SourceEntity();
    testSource.setSourceCode("integration-test-source-" + System.nanoTime());
    testSource.setName("集成测试来源");
    testSource.setType("government");
    testSource.setSiteUrl("https://integration-test.example.com");
    testSource.setLanguage("zh");
    testSource.setTrustLevel("high");
    testSource.setActive(true);
    testSource.setWhitelistEntityId("integration-test-entity");
    testSource.setCrawlRuleJson("{}");
    sourceMapper.insert(testSource);
  }

  @Test
  void shouldPageCurrentNewsAndMapRegionIds() {
    createTestNews(
        "南宁遥感测绘平台上线",
        "南宁遥感测绘平台服务自然资源数字化应用",
        "[\"遥感\",\"测绘\",\"自然资源数字化\"]",
        "[\"南宁\"]");

    ArticlePageDto page = newsQueryService.page("遥感", "technology", null, "nanning", "all", "latest", 1, 2);

    assertThat(page.page()).isEqualTo(1);
    assertThat(page.pageSize()).isEqualTo(2);
    assertThat(page.totalElements()).isGreaterThanOrEqualTo(1);
    assertThat(page.content()).isNotEmpty();
    assertThat(page.content())
        .anySatisfy(article -> assertThat(article.title() + article.summary() + article.keywords()).contains("遥感"));
  }

  @Test
  void shouldReviewAndCleanupNewsEndToEnd() {
    Long relevantNewsId =
        createTestNews(
            "遥感技术在测绘领域的应用", "本文介绍遥感技术和测绘技术的结合", "[\"遥感\",\"测绘\"]");
    Long irrelevantNewsId = createTestNews("学院年度总结会议", "会议通知内容", "[]");

    List<NewsVersionEntity> relevantVersions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", relevantNewsId));
    List<NewsVersionEntity> irrelevantVersions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", irrelevantNewsId));

    NewsVersionEntity relevantVersion = relevantVersions.get(0);
    NewsVersionEntity irrelevantVersion = irrelevantVersions.get(0);

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();

    boolean relevantIsRelevant = strictRelevanceChecker.check(
        relevantVersion.getTitle(),
        relevantVersion.getSummary(),
        parseKeywords(relevantVersion.getKeywordsJson()),
        criteria).passed();
    boolean irrelevantIsRelevant = strictRelevanceChecker.check(
        irrelevantVersion.getTitle(),
        irrelevantVersion.getSummary(),
        parseKeywords(irrelevantVersion.getKeywordsJson()),
        criteria).passed();

    assertThat(relevantIsRelevant).isTrue();
    assertThat(irrelevantIsRelevant).isFalse();

    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, true);

    assertThat(result.dryRun()).isTrue();
    assertThat(result.deletedNewsCount()).isGreaterThanOrEqualTo(0);
    assertThat(result.message()).contains("预览模式");
  }

  @Test
  void shouldHandleMixedRelevanceVersions() {
    Long newsId =
        createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");

    createNewsVersion(newsId, "学院年度会议", "会议通知", "[]");

    List<NewsVersionEntity> versions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", newsId));

    NewsVersionEntity relevantVersion = versions.get(0);
    NewsVersionEntity irrelevantVersion = versions.get(1);

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();

    boolean relevantIsRelevant = strictRelevanceChecker.check(
        relevantVersion.getTitle(),
        relevantVersion.getSummary(),
        parseKeywords(relevantVersion.getKeywordsJson()),
        criteria).passed();
    boolean irrelevantIsRelevant = strictRelevanceChecker.check(
        irrelevantVersion.getTitle(),
        irrelevantVersion.getSummary(),
        parseKeywords(irrelevantVersion.getKeywordsJson()),
        criteria).passed();

    assertThat(relevantIsRelevant).isTrue();
    assertThat(irrelevantIsRelevant).isFalse();

    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, false);

    assertThat(result.dryRun()).isFalse();

    NewsEntity news = newsMapper.selectById(newsId);
    assertThat(news).isNotNull();
  }

  @Test
  void shouldHandleEntityNameMatching() {
    Long newsId =
        createTestNews(
            "自然资源部发布新政策", "自然资源部今日发布关于测绘的新政策", "[\"自然资源\",\"测绘\"]");

    List<NewsVersionEntity> versions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", newsId));
    NewsVersionEntity version = versions.get(0);

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();

    boolean isRelevant = strictRelevanceChecker.check(
        version.getTitle(),
        version.getSummary(),
        parseKeywords(version.getKeywordsJson()),
        criteria).passed();

    assertThat(isRelevant).isTrue();
  }

  @Test
  void shouldHandleWordBoundaryMatching() {
    Long gisNewsId = createTestNews("GIS技术与遥感应用", "本文介绍GIS技术和遥感的最新发展", "[\"GIS\",\"遥感\"]");
    Long registerNewsId = createTestNews("用户注册系统", "register功能说明", "[]");

    List<NewsVersionEntity> gisVersions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", gisNewsId));
    List<NewsVersionEntity> registerVersions = newsVersionMapper.selectList(
        new QueryWrapper<NewsVersionEntity>().eq("news_id", registerNewsId));

    NewsVersionEntity gisVersion = gisVersions.get(0);
    NewsVersionEntity registerVersion = registerVersions.get(0);

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();

    boolean gisIsRelevant = strictRelevanceChecker.check(
        gisVersion.getTitle(),
        gisVersion.getSummary(),
        parseKeywords(gisVersion.getKeywordsJson()),
        criteria).passed();
    boolean registerIsRelevant = strictRelevanceChecker.check(
        registerVersion.getTitle(),
        registerVersion.getSummary(),
        parseKeywords(registerVersion.getKeywordsJson()),
        criteria).passed();

    assertThat(gisIsRelevant).isTrue();
    assertThat(registerIsRelevant).isFalse();
  }

  private List<String> parseKeywords(String keywordsJson) {
    if (keywordsJson == null || keywordsJson.equals("[]")) {
      return List.of();
    }
    String cleaned = keywordsJson.replaceAll("[\\[\\]\"]", "");
    if (cleaned.isEmpty()) {
      return List.of();
    }
    return List.of(cleaned.split(",\\s*"));
  }

  private Long createTestNews(String title, String summary, String keywordsJson) {
    return createTestNews(title, summary, keywordsJson, "[\"全国\"]");
  }

  private Long createTestNews(String title, String summary, String keywordsJson, String regionTagsJson) {
    NewsEntity news = new NewsEntity();
    news.setNewsCode("integration-test-" + System.nanoTime());
    news.setSourceId(testSource.getId());
    news.setCanonicalUrl("https://integration-test.example.com/news/" + System.nanoTime());
    news.setSlug("integration-test-slug-" + System.nanoTime());
    news.setFirstSeenAt(LocalDateTime.now());
    news.setLastSeenAt(LocalDateTime.now());
    newsMapper.insert(news);

    NewsVersionEntity version = new NewsVersionEntity();
    version.setNewsId(news.getId());
    version.setTitle(title);
    version.setSummary(summary);
    version.setSourceUrl("https://integration-test.example.com");
    version.setOriginalUrl(news.getCanonicalUrl());
    version.setPublishedAt(LocalDateTime.of(2024, 5, 1, 10, 0));
    version.setLanguage("zh");
    version.setCategory("technology");
    version.setKeywordsJson(keywordsJson);
    version.setRegionTagsJson(regionTagsJson);
    version.setEntityIdsJson("[]");
    version.setIsGuangxiRelated(false);
    version.setContentHash("hash-" + System.nanoTime());
    version.setUrlStatus("accessible");
    version.setBodyText(summary);
    newsVersionMapper.insert(version);

    news.setCurrentVersionId(version.getId());
    newsMapper.updateById(news);

    return news.getId();
  }

  private void createNewsVersion(Long newsId, String title, String summary, String keywordsJson) {
    NewsVersionEntity version = new NewsVersionEntity();
    version.setNewsId(newsId);
    version.setTitle(title);
    version.setSummary(summary);
    version.setSourceUrl("https://integration-test.example.com");
    version.setOriginalUrl("https://integration-test.example.com/news/" + System.nanoTime());
    version.setPublishedAt(LocalDateTime.of(2024, 5, 2, 10, 0));
    version.setLanguage("zh");
    version.setCategory("technology");
    version.setKeywordsJson(keywordsJson);
    version.setRegionTagsJson("[\"全国\"]");
    version.setEntityIdsJson("[]");
    version.setIsGuangxiRelated(false);
    version.setContentHash("hash-" + System.nanoTime());
    version.setUrlStatus("accessible");
    version.setBodyText(summary);
    newsVersionMapper.insert(version);
  }
}
