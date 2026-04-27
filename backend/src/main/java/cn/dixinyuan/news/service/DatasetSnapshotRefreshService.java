package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.ArticleDto;
import cn.dixinyuan.news.entity.DatasetSnapshotEntity;
import cn.dixinyuan.news.mapper.DatasetSnapshotMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class DatasetSnapshotRefreshService {
  private final DatasetSnapshotMapper datasetSnapshotMapper;
  private final NewsQueryService newsQueryService;
  private final JsonSupport jsonSupport;

  public DatasetSnapshotRefreshService(
      DatasetSnapshotMapper datasetSnapshotMapper,
      NewsQueryService newsQueryService,
      JsonSupport jsonSupport) {
    this.datasetSnapshotMapper = datasetSnapshotMapper;
    this.newsQueryService = newsQueryService;
    this.jsonSupport = jsonSupport;
  }

  public int refreshDerivedSnapshots(Long crawlRunId) {
    List<ArticleDto> articles = newsQueryService.loadCurrentArticles();
    upsert(crawlRunId, "summary", buildSummary(articles));
    upsert(crawlRunId, "word-cloud", buildWordCloud(articles));
    return 2;
  }

  private void upsert(Long crawlRunId, String type, Object payload) {
    datasetSnapshotMapper.update(
        null,
        new LambdaUpdateWrapper<DatasetSnapshotEntity>()
            .eq(DatasetSnapshotEntity::getDatasetType, type)
            .set(DatasetSnapshotEntity::getActive, false));
    DatasetSnapshotEntity snapshot = new DatasetSnapshotEntity();
    snapshot.setCrawlRunId(crawlRunId);
    snapshot.setDatasetType(type);
    snapshot.setPayloadJson(jsonSupport.stringify(payload));
    snapshot.setActive(true);
    datasetSnapshotMapper.insert(snapshot);
  }

  private static Map<String, Object> buildSummary(List<ArticleDto> articles) {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalArticles", articles.size());
    summary.put("totalSources", articles.stream().map(ArticleDto::sourceName).distinct().count());
    summary.put("guangxiArticles", articles.stream().filter(ArticleDto::isGuangxiRelated).count());
    summary.put("latestUpdateAt", Instant.now().toString());
    summary.put("totalEntities", articles.stream().flatMap(article -> article.entityIds().stream()).distinct().count());
    summary.put("totalEdges", 0);
    return summary;
  }

  private static List<Map<String, Object>> buildWordCloud(List<ArticleDto> articles) {
    Map<String, WordEntry> all = new LinkedHashMap<>();
    Map<String, WordEntry> enterprise = new LinkedHashMap<>();
    Map<String, WordEntry> technology = new LinkedHashMap<>();
    Map<String, WordEntry> policy = new LinkedHashMap<>();
    Map<String, Map<String, WordEntry>> byCategory = Map.of(
        "all", all,
        "enterprise", enterprise,
        "technology", technology,
        "policy", policy);
    for (ArticleDto article : articles) {
      for (String keyword : article.keywords()) {
        addWord(all, keyword, "all", article.id(), Boolean.TRUE.equals(article.isGuangxiRelated()));
        addWord(byCategory.getOrDefault(article.category(), technology), keyword, article.category(), article.id(), Boolean.TRUE.equals(article.isGuangxiRelated()));
      }
    }
    List<Map<String, Object>> items = new ArrayList<>();
    byCategory.values().forEach(map -> map.values().stream()
        .sorted((left, right) -> Integer.compare(right.weight, left.weight))
        .limit(20)
        .map(WordEntry::toMap)
        .forEach(items::add));
    return items;
  }

  private static void addWord(Map<String, WordEntry> map, String term, String category, String articleId, boolean guangxi) {
    if (term == null || term.isBlank()) {
      return;
    }
    WordEntry entry = map.computeIfAbsent(term, key -> new WordEntry(term, category));
    entry.weight += guangxi ? 2 : 1;
    entry.articleIds.add(articleId);
  }

  private static final class WordEntry {
    final String term;
    final String category;
    final List<String> articleIds = new ArrayList<>();
    int weight;

    WordEntry(String term, String category) {
      this.term = term;
      this.category = category;
    }

    Map<String, Object> toMap() {
      Map<String, Object> map = new LinkedHashMap<>();
      map.put("term", term);
      map.put("weight", weight);
      map.put("category", category);
      map.put("period", "30d");
      map.put("articleCount", articleIds.stream().distinct().count());
      return map;
    }
  }
}
