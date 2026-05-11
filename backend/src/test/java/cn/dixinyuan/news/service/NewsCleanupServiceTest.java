package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.dto.StrictCleanupResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class NewsCleanupServiceTest {

  @Autowired
  private NewsCleanupService cleanupService;

  @Autowired
  private NewsMapper newsMapper;

  @Autowired
  private NewsVersionMapper newsVersionMapper;

  @Autowired
  private SourceMapper sourceMapper;

  @Autowired
  private StrictRelevanceChecker strictRelevanceChecker;

  private SourceEntity testSource;

  @BeforeEach
  void setUp() {
    testSource = new SourceEntity();
    testSource.setSourceCode("test-source-" + System.nanoTime());
    testSource.setName("测试来源");
    testSource.setType("government");
    testSource.setSiteUrl("https://test.example.com");
    testSource.setLanguage("zh");
    testSource.setTrustLevel("high");
    testSource.setWhitelistEntityId("source-gx-dnr");
    testSource.setActive(true);
    testSource.setCrawlRuleJson("{}");
    sourceMapper.insert(testSource);
  }

  @Test
  void shouldPreviewCleanupWithoutDeletion() {
    long countBefore = newsMapper.selectCount(null);

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, true);

    assertThat(result.dryRun()).isTrue();
    assertThat(result.deletedNewsCount()).isGreaterThanOrEqualTo(0);
    assertThat(result.message()).contains("预览模式");

    long countAfter = newsMapper.selectCount(null);
    assertThat(countAfter).isEqualTo(countBefore);
  }

  @Test
  void shouldDeleteIrrelevantNews() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");
    createTestNews("学院年度会议", "会议通知", "[]");

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, false);

    assertThat(result.dryRun()).isFalse();
    assertThat(result.deletedNewsCount()).isGreaterThanOrEqualTo(0);
    assertThat(result.message()).contains("已删除");
  }

  @Test
  void shouldKeepRelevantNews() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, false);

    assertThat(result.dryRun()).isFalse();
    assertThat(result.message()).contains("已删除");
  }

  @Test
  void shouldGenerateAuditReport() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    StrictCleanupResult result = cleanupService.cleanupByStrictRelevance(criteria, true);

    assertThat(result.auditReportPath()).isNotBlank();
    assertThat(result.auditReportPath()).contains("deletion-audit");
    assertThat(result.auditReportPath()).endsWith(".csv");
  }

  @Test
  void shouldPreviewNoncompliantCleanupBySummaryTerm() {
    long countBefore = newsMapper.selectCount(null);
    createTestNews("地理空间平台发布", "平台面向空间数据服务提供能力。", "[\"geospatial\"]");

    StrictCleanupResult result = cleanupService.cleanupNoncompliant(true, false);

    assertThat(result.dryRun()).isTrue();
    assertThat(result.auditReportPath()).contains("noncompliant-cleanup");
    assertThat(result.deletedNewsCount()).isGreaterThanOrEqualTo(1);
    assertThat(newsMapper.selectCount(null)).isEqualTo(countBefore + 1);
  }

  @Test
  void shouldDeleteNewsWithAllVersions() {
    Long newsId = createTestNews("测试新闻", "测试内容", "[]");

    cleanupService.deleteNewsWithVersions(newsId);

    NewsEntity deletedNews = newsMapper.selectById(newsId);
    assertThat(deletedNews).isNull();
  }

  private Long createTestNews(String title, String summary, String keywordsJson) {
    NewsEntity news = new NewsEntity();
    news.setNewsCode("test-" + System.nanoTime());
    news.setSourceId(testSource.getId());
    news.setCanonicalUrl("https://test.example.com/news/" + System.nanoTime());
    news.setSlug("test-slug-" + System.nanoTime());
    news.setFirstSeenAt(LocalDateTime.now());
    news.setLastSeenAt(LocalDateTime.now());
    newsMapper.insert(news);

    NewsVersionEntity version = new NewsVersionEntity();
    version.setNewsId(news.getId());
    version.setTitle(title);
    version.setSummary(summary);
    version.setSourceUrl("https://test.example.com");
    version.setOriginalUrl(news.getCanonicalUrl());
    version.setPublishedAt(LocalDateTime.of(2024, 5, 1, 10, 0));
    version.setLanguage("zh");
    version.setCategory("technology");
    version.setKeywordsJson(keywordsJson);
    version.setRegionTagsJson("[\"全国\"]");
    version.setEntityIdsJson("[]");
    version.setIsGuangxiRelated(false);
    version.setContentHash("hash-" + System.nanoTime());
    version.setUrlStatus("accessible");
    version.setFinalUrl(news.getCanonicalUrl());
    version.setUrlVerifiedAt(LocalDateTime.now());
    version.setBodyText(summary);
    newsVersionMapper.insert(version);

    news.setCurrentVersionId(version.getId());
    newsMapper.updateById(news);

    return news.getId();
  }
}
