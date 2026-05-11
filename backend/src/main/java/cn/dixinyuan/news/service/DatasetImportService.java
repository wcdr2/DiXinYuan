package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.ImportResultDto;
import cn.dixinyuan.news.entity.CrawlRunEntity;
import cn.dixinyuan.news.entity.CrawlRunSourceEntity;
import cn.dixinyuan.news.entity.DatasetSnapshotEntity;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.CrawlRunMapper;
import cn.dixinyuan.news.mapper.CrawlRunSourceMapper;
import cn.dixinyuan.news.mapper.DatasetSnapshotMapper;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.HashSupport;
import cn.dixinyuan.news.support.JsonSupport;
import cn.dixinyuan.news.support.TimeSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class DatasetImportService {
  private final boolean importOnStartup;
  private final String importRoot;
  private final JsonSupport jsonSupport;
  private final SourceMapper sourceMapper;
  private final SourceCatalogService sourceCatalogService;
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final CrawlRunMapper crawlRunMapper;
  private final CrawlRunSourceMapper crawlRunSourceMapper;
  private final DatasetSnapshotMapper datasetSnapshotMapper;
  private final TransactionTemplate transactionTemplate;

  public DatasetImportService(
      @Value("${app.import-on-startup}") boolean importOnStartup,
      @Value("${app.import-root}") String importRoot,
      JsonSupport jsonSupport,
      SourceMapper sourceMapper,
      SourceCatalogService sourceCatalogService,
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      CrawlRunMapper crawlRunMapper,
      CrawlRunSourceMapper crawlRunSourceMapper,
      DatasetSnapshotMapper datasetSnapshotMapper,
      TransactionTemplate transactionTemplate) {
    this.importOnStartup = importOnStartup;
    this.importRoot = importRoot;
    this.jsonSupport = jsonSupport;
    this.sourceMapper = sourceMapper;
    this.sourceCatalogService = sourceCatalogService;
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.crawlRunMapper = crawlRunMapper;
    this.crawlRunSourceMapper = crawlRunSourceMapper;
    this.datasetSnapshotMapper = datasetSnapshotMapper;
    this.transactionTemplate = transactionTemplate;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void importOnStartup() {
    if (importOnStartup && sourceMapper.selectCount(null) == 0) {
      importFromDatasets();
    }
  }

  public ImportResultDto importFromDatasets() {
    return transactionTemplate.execute(status -> doImportFromDatasets());
  }

  private ImportResultDto doImportFromDatasets() {
    Path root = resolveImportRoot();
    LocalDateTime now = LocalDateTime.now();

    CrawlRunEntity run = new CrawlRunEntity();
    run.setRunType("seed-import");
    run.setStatus("running");
    run.setStartedAt(now);
    run.setNote("Imported from existing datasets JSON files.");
    crawlRunMapper.insert(run);

    Map<String, SourceEntity> sourcesByName = sourceCatalogService.upsertFromFile(root.resolve("config").resolve("sources.json")).stream()
        .collect(java.util.stream.Collectors.toMap(
            SourceEntity::getName,
            java.util.function.Function.identity(),
            (left, right) -> left,
            LinkedHashMap::new));
    ImportStats stats = importArticles(root.resolve("generated").resolve("articles.json"), run.getId(), sourcesByName);
    int snapshotCount = importSnapshots(root.resolve("generated"), run.getId());
    importLogs(root.resolve("generated").resolve("logs.json"), run.getId(), sourcesByName);

    run.setStatus("succeeded");
    run.setFinishedAt(LocalDateTime.now());
    crawlRunMapper.updateById(run);

    return new ImportResultDto(
        run.getId(),
        sourcesByName.size(),
        stats.articleCount,
        stats.insertedVersions,
        stats.duplicateVersions,
        snapshotCount);
  }

  private Path resolveImportRoot() {
    Path configured = Path.of(importRoot).toAbsolutePath().normalize();
    if (Files.exists(configured)) {
      return configured;
    }
    Path projectRoot = Path.of("datasets").toAbsolutePath().normalize();
    if (Files.exists(projectRoot)) {
      return projectRoot;
    }
    throw new IllegalStateException("Could not locate datasets directory. Checked: " + configured + " and " + projectRoot);
  }

  private ImportStats importArticles(Path articlesPath, Long crawlRunId, Map<String, SourceEntity> sourcesByName) {
    ImportStats stats = new ImportStats();
    JsonNode articleArray = jsonSupport.readFile(articlesPath);
    for (JsonNode article : articleArray) {
      stats.articleCount++;
      SourceEntity source = sourcesByName.get(text(article, "sourceName"));
      if (source == null) {
        source = createFallbackSource(article);
        sourcesByName.put(source.getName(), source);
      }

      String canonicalUrl = canonicalUrl(article);
      NewsEntity news = newsMapper.selectOne(
          new LambdaQueryWrapper<NewsEntity>()
              .eq(NewsEntity::getSourceId, source.getId())
              .eq(NewsEntity::getCanonicalUrl, canonicalUrl));
      LocalDateTime now = LocalDateTime.now();
      if (news == null) {
        news = new NewsEntity();
        news.setNewsCode(text(article, "id"));
        news.setSourceId(source.getId());
        news.setCanonicalUrl(canonicalUrl);
        news.setSlug(text(article, "slug"));
        news.setFirstSeenAt(now);
        news.setLastSeenAt(now);
        newsMapper.insert(news);
      } else {
        news.setLastSeenAt(now);
      }

      String hash = contentHash(article);
      NewsVersionEntity existingVersion = newsVersionMapper.selectOne(
          new LambdaQueryWrapper<NewsVersionEntity>()
              .eq(NewsVersionEntity::getNewsId, news.getId())
              .eq(NewsVersionEntity::getContentHash, hash));
      if (existingVersion != null) {
        stats.duplicateVersions++;
        newsMapper.updateById(news);
        continue;
      }

      NewsVersionEntity version = toVersion(article, news.getId(), crawlRunId, hash);
      newsVersionMapper.insert(version);
      news.setCurrentVersionId(version.getId());
      news.setSlug(text(article, "slug"));
      newsMapper.updateById(news);
      stats.insertedVersions++;
    }
    return stats;
  }

  private SourceEntity createFallbackSource(JsonNode article) {
    SourceEntity source = new SourceEntity();
    source.setSourceCode(HashSupport.sha256(text(article, "sourceName")).substring(0, 16));
    source.setName(text(article, "sourceName"));
    source.setType("unknown");
    source.setSiteUrl(text(article, "sourceUrl"));
    source.setLanguage(text(article, "language"));
    source.setTrustLevel("medium");
    source.setWhitelistEntityId("");
    source.setActive(false);
    source.setCrawlRuleJson("{}");
    sourceMapper.insert(source);
    return source;
  }

  private NewsVersionEntity toVersion(JsonNode article, Long newsId, Long crawlRunId, String hash) {
    NewsVersionEntity version = new NewsVersionEntity();
    String originalUrl = text(article, "originalUrl");
    version.setNewsId(newsId);
    version.setCrawlRunId(crawlRunId);
    version.setTitle(text(article, "title"));
    version.setSummary(text(article, "summary"));
    version.setCoverImage(text(article, "coverImage"));
    version.setSourceUrl(text(article, "sourceUrl"));
    version.setOriginalUrl(originalUrl);
    version.setPublishedAt(TimeSupport.parseToLocalDateTime(text(article, "publishedAt")));
    version.setLanguage(text(article, "language"));
    version.setCategory(text(article, "category"));
    version.setKeywordsJson(jsonSupport.stringify(article.path("keywords")));
    version.setRegionTagsJson(jsonSupport.stringify(article.path("regionTags")));
    version.setEntityIdsJson(jsonSupport.stringify(article.path("entityIds")));
    version.setIsGuangxiRelated(article.path("isGuangxiRelated").asBoolean(false));
    version.setContentHash(hash);
    version.setUrlVerifiedAt(LocalDateTime.now());
    version.setUrlStatus("accessible");
    version.setFinalUrl(originalUrl);
    version.setBodyText(text(article, "bodyText"));
    return version;
  }

  private int importSnapshots(Path generatedRoot, Long crawlRunId) {
    Map<String, String> files = Map.of(
        "summary", "summary.json",
        "word-cloud", "word-cloud.json",
        "map", "map.json",
        "knowledge-graph", "knowledge-graph.json",
        "logs", "logs.json");
    int count = 0;
    for (Map.Entry<String, String> entry : files.entrySet()) {
      Path path = generatedRoot.resolve(entry.getValue());
      if (!Files.exists(path)) {
        continue;
      }
      datasetSnapshotMapper.update(
          null,
          new LambdaUpdateWrapper<DatasetSnapshotEntity>()
              .eq(DatasetSnapshotEntity::getDatasetType, entry.getKey())
              .set(DatasetSnapshotEntity::getActive, false));
      DatasetSnapshotEntity snapshot = new DatasetSnapshotEntity();
      snapshot.setCrawlRunId(crawlRunId);
      snapshot.setDatasetType(entry.getKey());
      snapshot.setPayloadJson(jsonSupport.stringify(jsonSupport.readFile(path)));
      snapshot.setActive(true);
      datasetSnapshotMapper.insert(snapshot);
      count++;
    }
    return count;
  }

  private void importLogs(Path logsPath, Long crawlRunId, Map<String, SourceEntity> sourcesByName) {
    if (!Files.exists(logsPath)) {
      return;
    }
    JsonNode logs = jsonSupport.readFile(logsPath);
    for (JsonNode log : logs) {
      SourceEntity source = sourcesByName.get(text(log, "sourceName"));
      if (source == null) {
        continue;
      }
      CrawlRunSourceEntity entity = new CrawlRunSourceEntity();
      entity.setCrawlRunId(crawlRunId);
      entity.setSourceId(source.getId());
      entity.setStatus(text(log, "status"));
      entity.setFetchedCount(log.path("fetchedCount").asInt(0));
      entity.setPublishedCount(log.path("publishedCount").asInt(0));
      entity.setDuplicateCount(log.path("duplicateCount").asInt(0));
      entity.setNote(text(log, "note"));
      entity.setStartedAt(TimeSupport.parseToLocalDateTime(text(log, "startedAt")));
      entity.setFinishedAt(TimeSupport.parseToLocalDateTime(text(log, "finishedAt")));
      crawlRunSourceMapper.insert(entity);
    }
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? "" : value.asText();
  }

  private static String canonicalUrl(JsonNode article) {
    String originalUrl = text(article, "originalUrl").trim();
    if (!originalUrl.isEmpty()) {
      return originalUrl.replaceAll("#.*$", "").replaceAll("/+$", "");
    }
    return text(article, "title").trim();
  }

  private String contentHash(JsonNode article) {
    StringBuilder builder = new StringBuilder();
    Iterator<String> fields = article.fieldNames();
    while (fields.hasNext()) {
      String field = fields.next();
      if (!"id".equals(field)) {
        builder.append(field).append('=').append(article.path(field)).append('\n');
      }
    }
    return HashSupport.sha256(builder.toString());
  }

  private static final class ImportStats {
    int articleCount;
    int insertedVersions;
    int duplicateVersions;
  }
}
