package cn.dixinyuan.news.service;

import static org.assertj.core.api.Assertions.assertThat;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.support.JsonSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NewsCleaningServiceTest {
  @Test
  void acceptsKnownArticlePathPatterns() {
    assertThat(NewsCleaningService.isDetailUrl("https://www.cagis.org.cn/Lists/content/id/4687.html")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.usgs.gov/centers/eros/news/example-story")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://ngcc.cn/xwzx/ywcg/202601/t20260113_2599.html")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.ogc.org/announcement/ogc-announces-new-standard")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.ogc.org/blog-article/insights-from-innovation-days")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.esa.int/Newsroom/Press_Releases/example")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl(
        "https://www.esa.int/Applications/Observing_the_Earth/ESA_s_Digital_Twin_Earth_programme_building_a_virtual_model_for_a_changing_planet")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl(
        "https://dataspace.copernicus.eu/events/national-forum-remote-sensing-and-copernicus-2026")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://science.nasa.gov/earth/earth-observatory/fiery-fall-color-in-southern-chile")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.geographyrealm.com/landsat-ndvi-vegetation-change")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.huace.cn/informationDetail/465")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.southsurvey.com/news_view/id/488.html")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.bdstar.com/news.aspx?type=17&&id=4884")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.mapgis.com/index.php?a=shows&catid=33&id=1874")).isTrue();
    assertThat(NewsCleaningService.isDetailUrl("https://www.glac.org.cn/a9837.html")).isTrue();
  }

  @Test
  void rejectsListAndIndexPages() {
    assertThat(NewsCleaningService.isDetailUrl("https://www.csgpc.org/list/93.html")).isFalse();
    assertThat(NewsCleaningService.isDetailUrl("https://www.cagis.org.cn/Lists/index/cid/93.html")).isFalse();
    assertThat(NewsCleaningService.isDetailUrl("https://www.supermap.com/zh-cn/a/news/list_9_1.html")).isFalse();
    assertThat(NewsCleaningService.isDetailUrl("https://www.supermap.com/zh-cn/a/news/list_8_1.html")).isFalse();
    assertThat(NewsCleaningService.isDetailUrl("https://example.test/news")).isFalse();
  }

  @Test
  void doesNotInventDefaultDomainKeywordsForIrrelevantArticles() {
    NewsCleaningService service = new NewsCleaningService(new JsonSupport(new ObjectMapper()));
    SourceEntity source = new SourceEntity();
    source.setSourceCode("test-source");
    source.setName("测试来源");
    source.setSiteUrl("https://example.test");
    source.setLanguage("zh");
    source.setCrawlRuleJson("{\"whitelist\":[\"遥感\",\"测绘\"]}");

    CleanedNewsArticle article = service.clean(source, new CrawledArticleCandidate(
        "党委召开理论学习会议",
        "会议围绕组织建设和人才培养展开交流。",
        "",
        "https://example.test",
        "https://example.test/info/202401010001.htm",
        LocalDateTime.of(2024, 1, 1, 10, 0),
        "zh",
        List.of(),
        Map.of()));

    assertThat(article.keywords()).isEmpty();
  }

  @Test
  void doesNotAppendRequiredSummaryTermWhenAliasEvidenceExists() {
    NewsCleaningService service = new NewsCleaningService(new JsonSupport(new ObjectMapper()));
    SourceEntity source = new SourceEntity();
    source.setSourceCode("test-source");
    source.setName("测试来源");
    source.setSiteUrl("https://example.test");
    source.setLanguage("en");
    source.setCrawlRuleJson("{\"whitelist\":[\"remote sensing\",\"geospatial\"]}");

    CleanedNewsArticle article = service.clean(source, new CrawledArticleCandidate(
        "Remote sensing platform update",
        "The platform improves geospatial analytics for resource monitoring.",
        "",
        "https://example.test",
        "https://example.test/news/remote-sensing-platform-update",
        LocalDateTime.of(2024, 1, 1, 10, 0),
        "en",
        List.of("remote sensing"),
        Map.of()));

    assertThat(article.summary()).isEqualTo("The platform improves geospatial analytics for resource monitoring.");
  }

  @Test
  void doesNotUseTitleAsFallbackSummary() {
    NewsCleaningService service = new NewsCleaningService(new JsonSupport(new ObjectMapper()));
    SourceEntity source = new SourceEntity();
    source.setSourceCode("test-source");
    source.setName("Test Source");
    source.setSiteUrl("https://example.test");
    source.setLanguage("en");
    source.setCrawlRuleJson("{\"whitelist\":[\"GIS\"]}");

    CleanedNewsArticle article = service.clean(source, new CrawledArticleCandidate(
        "GIS platform released",
        "",
        "",
        "https://example.test",
        "https://example.test/news/gis-platform-released",
        LocalDateTime.of(2024, 1, 1, 10, 0),
        "en",
        List.of("GIS"),
        Map.of()));

    assertThat(article.summary()).isBlank();
  }

  @Test
  void detectsTitleOnlySummary() {
    assertThat(NewsCleaningService.isTitleOnlySummary("GIS platform released", "GIS platform released")).isTrue();
    assertThat(NewsCleaningService.isTitleOnlySummary("GIS platform released", "The GIS platform supports mapping.")).isFalse();
  }

  @Test
  void keepsSummaryUnchangedForGeospatialAlias() {
    String summary = NewsCleaningService.ensureRequiredSummaryTerm(
        "The platform improves geospatial analytics for cities.",
        "Location platform update",
        List.of());

    assertThat(summary).isEqualTo("The platform improves geospatial analytics for cities.");
  }

  @Test
  void keepsSummaryUnchangedForInteractiveMapAlias() {
    String summary = NewsCleaningService.ensureRequiredSummaryTerm(
        "Interactive map of service boundaries and mapped facilities.",
        "Wastewater treatment plants map",
        List.of());

    assertThat(summary).isEqualTo("Interactive map of service boundaries and mapped facilities.");
  }

  @Test
  void keepsSummaryUnchangedWhenNoDomainEvidenceExists() {
    String summary = NewsCleaningService.ensureRequiredSummaryTerm(
        "会议围绕组织建设和人才培养展开交流。",
        "学院召开年度会议",
        List.of());

    assertThat(summary).isEqualTo("会议围绕组织建设和人才培养展开交流。");
  }
}
