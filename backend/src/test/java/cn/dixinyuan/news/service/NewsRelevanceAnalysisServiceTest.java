package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.dto.DeletionPreviewReport;
import cn.dixinyuan.news.dto.KeywordDistributionReport;
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
class NewsRelevanceAnalysisServiceTest {

  @Autowired
  private NewsRelevanceAnalysisService analysisService;

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
    testSource.setActive(true);
    testSource.setCrawlRuleJson("{}");
    sourceMapper.insert(testSource);
  }

  @Test
  void shouldAnalyzeKeywordDistribution() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");
    createTestNews("GIS系统开发指南", "介绍GIS开发", "[\"GIS\"]");
    createTestNews("学院年度会议", "会议通知", "[]");

    KeywordDistributionReport report = analysisService.analyzeKeywordDistribution();

    assertThat(report.totalVersions()).isGreaterThanOrEqualTo(3);
    assertThat(report.strictPassCount()).isGreaterThanOrEqualTo(1);
    assertThat(report.strictFailCount()).isGreaterThanOrEqualTo(1);
  }

  @Test
  void shouldPreviewDeletion() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");
    createTestNews("学院年度会议", "会议通知", "[]");

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    DeletionPreviewReport report = analysisService.previewDeletion(criteria);

    assertThat(report.totalNewsToDelete()).isGreaterThanOrEqualTo(1);
    assertThat(report.sampleNews()).isNotEmpty();
    assertThat(report.rejectReasonDistribution()).isNotEmpty();
  }

  @Test
  void shouldGenerateAuditReport() {
    createTestNews("遥感技术在测绘中的应用", "本文介绍遥感和测绘", "[\"遥感\",\"测绘\"]");

    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();
    String auditReportPath = analysisService.generateAuditReport(criteria);

    assertThat(auditReportPath).isNotBlank();
    assertThat(auditReportPath).contains("relevance-analysis");
    assertThat(auditReportPath).endsWith(".csv");
  }

  private void createTestNews(String title, String summary, String keywordsJson) {
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
    newsVersionMapper.insert(version);

    news.setCurrentVersionId(version.getId());
    newsMapper.updateById(news);
  }
}
