package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.DeletionPreviewReport;
import cn.dixinyuan.news.dto.KeywordDistributionReport;
import cn.dixinyuan.news.dto.NewsPreviewItem;
import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class NewsRelevanceAnalysisService {

  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final SourceMapper sourceMapper;
  private final StrictRelevanceChecker strictRelevanceChecker;
  private final JsonSupport jsonSupport;

  @Autowired
  public NewsRelevanceAnalysisService(
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      SourceMapper sourceMapper,
      StrictRelevanceChecker strictRelevanceChecker,
      JsonSupport jsonSupport) {
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.sourceMapper = sourceMapper;
    this.strictRelevanceChecker = strictRelevanceChecker;
    this.jsonSupport = jsonSupport;
  }

  public KeywordDistributionReport analyzeKeywordDistribution() {
    StrictRelevanceCriteria criteria = strictRelevanceChecker.getDefaultCriteria();

    List<NewsVersionEntity> allVersions = newsVersionMapper.selectList(null);

    Map<String, Integer> keywordMatchCounts = new HashMap<>();
    Map<Integer, Integer> matchCountDistribution = new HashMap<>();
    int strictPassCount = 0;
    int strictFailCount = 0;

    for (NewsVersionEntity version : allVersions) {
      List<String> keywords = parseKeywords(version.getKeywordsJson());

      RelevanceCheckResult result =
          checkStrictRelevance(
              version.getTitle(), version.getSummary(), keywords, criteria);

      if (result.passed()) {
        strictPassCount++;
      } else {
        strictFailCount++;
      }

      for (String keyword : result.matchedCoreKeywords()) {
        keywordMatchCounts.merge(keyword, 1, Integer::sum);
      }

      int matchCount = result.matchedCoreKeywords().size();
      matchCountDistribution.merge(matchCount, 1, Integer::sum);
    }

    return new KeywordDistributionReport(
        allVersions.size(),
        keywordMatchCounts,
        matchCountDistribution,
        strictPassCount,
        strictFailCount);
  }

  public DeletionPreviewReport previewDeletion(StrictRelevanceCriteria criteria) {
    List<NewsEntity> allNews = newsMapper.selectList(null);

    List<NewsPreviewItem> toDelete = new ArrayList<>();
    Map<String, Integer> rejectReasonDistribution = new HashMap<>();
    int totalVersionsToDelete = 0;

    for (NewsEntity news : allNews) {
      NewsVersionEntity currentVersion =
          newsVersionMapper.selectById(news.getCurrentVersionId());
      if (currentVersion == null) {
        continue;
      }

      SourceEntity source = sourceMapper.selectById(news.getSourceId());
      if (source == null) {
        continue;
      }

      List<String> keywords = parseKeywords(currentVersion.getKeywordsJson());

      RelevanceCheckResult result =
          checkStrictRelevance(
              currentVersion.getTitle(),
              currentVersion.getSummary(),
              keywords,
              criteria);

      if (!result.passed()) {
        toDelete.add(
            new NewsPreviewItem(
                news.getId(),
                news.getNewsCode(),
                currentVersion.getTitle(),
                currentVersion.getSummary(),
                currentVersion.getPublishedAt(),
                source.getName(),
                result.matchedCoreKeywords(),
                result.reason()));

        rejectReasonDistribution.merge(result.reason(), 1, Integer::sum);

        List<NewsVersionEntity> versions =
            newsVersionMapper.selectList(
                new LambdaQueryWrapper<NewsVersionEntity>()
                    .eq(NewsVersionEntity::getNewsId, news.getId()));
        totalVersionsToDelete += versions.size();
      }
    }

    List<NewsPreviewItem> sampleNews =
        toDelete.stream().limit(100).toList();

    return new DeletionPreviewReport(
        toDelete.size(), totalVersionsToDelete, sampleNews, rejectReasonDistribution);
  }

  public String generateAuditReport(StrictRelevanceCriteria criteria) {
    List<NewsEntity> allNews = newsMapper.selectList(null);

    Path auditDir = Paths.get("target/audit");
    try {
      Files.createDirectories(auditDir);
    } catch (IOException e) {
      throw new RuntimeException("Failed to create audit directory", e);
    }

    String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    Path auditFile = auditDir.resolve("relevance-analysis-" + timestamp + ".csv");

    try (FileWriter writer = new FileWriter(auditFile.toFile())) {
      writer.write(
          "news_id,news_code,version_id,title,summary,keywords,published_at,source_name,"
              + "matched_core_keywords,matched_entities,core_keyword_count,entity_count,"
              + "strict_pass,reject_reason\n");

      for (NewsEntity news : allNews) {
        NewsVersionEntity currentVersion =
            newsVersionMapper.selectById(news.getCurrentVersionId());
        if (currentVersion == null) {
          continue;
        }

        SourceEntity source = sourceMapper.selectById(news.getSourceId());
        if (source == null) {
          continue;
        }

        List<String> keywords = parseKeywords(currentVersion.getKeywordsJson());

        RelevanceCheckResult result =
            checkStrictRelevance(
                currentVersion.getTitle(),
                currentVersion.getSummary(),
                keywords,
                criteria);

        writer.write(
            String.format(
                "%d,%s,%d,\"%s\",\"%s\",\"%s\",%s,%s,\"%s\",\"%s\",%d,%d,%s,\"%s\"\n",
                news.getId(),
                news.getNewsCode(),
                currentVersion.getId(),
                escapeCsv(currentVersion.getTitle()),
                escapeCsv(currentVersion.getSummary()),
                escapeCsv(String.join(";", keywords)),
                currentVersion.getPublishedAt(),
                escapeCsv(source.getName()),
                escapeCsv(String.join(";", result.matchedCoreKeywords())),
                escapeCsv(String.join(";", result.matchedEntities())),
                result.matchedCoreKeywords().size(),
                result.matchedEntities().size(),
                result.passed(),
                escapeCsv(result.reason())));
      }
    } catch (IOException e) {
      throw new RuntimeException("Failed to write audit report", e);
    }

    return auditFile.toString();
  }

  public RelevanceCheckResult checkStrictRelevance(
      String title, String summary, List<String> keywords, StrictRelevanceCriteria criteria) {
    return strictRelevanceChecker.check(title, summary, keywords, criteria);
  }

  private List<String> parseKeywords(String keywordsJson) {
    if (keywordsJson == null || keywordsJson.isBlank()) {
      return List.of();
    }
    try {
      return jsonSupport.parseStringList(keywordsJson);
    } catch (Exception e) {
      return List.of();
    }
  }

  private String escapeCsv(String value) {
    if (value == null) {
      return "";
    }
    return value.replace("\"", "\"\"").replace("\n", " ").replace("\r", " ");
  }
}
