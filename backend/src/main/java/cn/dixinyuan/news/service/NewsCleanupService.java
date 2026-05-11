package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictCleanupResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.CleanupAuditLogEntity;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.CleanupAuditLogMapper;
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
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NewsCleanupService {
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final SourceMapper sourceMapper;
  private final CleanupAuditLogMapper cleanupAuditLogMapper;
  private final NewsRelevanceAnalysisService analysisService;
  private final NewsComplianceService newsComplianceService;
  private final JsonSupport jsonSupport;

  public NewsCleanupService(
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      SourceMapper sourceMapper,
      CleanupAuditLogMapper cleanupAuditLogMapper,
      NewsRelevanceAnalysisService analysisService,
      NewsComplianceService newsComplianceService,
      JsonSupport jsonSupport) {
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.sourceMapper = sourceMapper;
    this.cleanupAuditLogMapper = cleanupAuditLogMapper;
    this.analysisService = analysisService;
    this.newsComplianceService = newsComplianceService;
    this.jsonSupport = jsonSupport;
  }

  @Transactional
  public CleanupResult cleanupOldNews(LocalDateTime beforeDate, boolean dryRun) {
    // 查询要删除的新闻ID列表
    String sql = """
        SELECT n.id
        FROM news n
        JOIN news_versions v ON n.current_version_id = v.id
        WHERE v.published_at < ?
        """;

    // 这里需要使用原生SQL，因为MyBatis-Plus不支持复杂的删除
    // 建议通过Controller调用，手动在Navicat执行

    return new CleanupResult(0, 0, "请在Navicat中执行cleanup_old_news_safe.sql");
  }

  @Transactional(
      isolation = Isolation.READ_COMMITTED,
      propagation = Propagation.REQUIRED,
      rollbackFor = Exception.class,
      timeout = 3600)
  public StrictCleanupResult cleanupByStrictRelevance(
      StrictRelevanceCriteria criteria, boolean dryRun) {
    LocalDateTime startedAt = LocalDateTime.now();
    CleanupAuditLogEntity auditLog = new CleanupAuditLogEntity();
    auditLog.setCleanupType("strict_relevance");
    auditLog.setCriteriaJson(jsonSupport.stringify(criteria));
    auditLog.setDryRun(dryRun);
    auditLog.setStartedAt(startedAt);
    auditLog.setStatus("running");

    try {
      String auditReportPath = generateDeletionAuditReport(criteria);
      auditLog.setAuditReportPath(auditReportPath);

      List<NewsEntity> allNews = newsMapper.selectList(null);
      int deletedNewsCount = 0;
      int deletedVersionsCount = 0;
      int updatedNewsCount = 0;

      for (NewsEntity news : allNews) {
        NewsVersionEntity currentVersion = newsVersionMapper.selectById(news.getCurrentVersionId());
        if (currentVersion == null) {
          continue;
        }

        SourceEntity source = sourceMapper.selectById(news.getSourceId());
        if (source == null) {
          continue;
        }

        List<String> keywords = parseKeywords(currentVersion.getKeywordsJson());
        RelevanceCheckResult result =
            analysisService.checkStrictRelevance(
                currentVersion.getTitle(), currentVersion.getSummary(), keywords, criteria);

        if (!result.passed()) {
          List<NewsVersionEntity> allVersions =
              newsVersionMapper.selectList(
                  new LambdaQueryWrapper<NewsVersionEntity>()
                      .eq(NewsVersionEntity::getNewsId, news.getId()));

          NewsVersionEntity validVersion = null;
          for (NewsVersionEntity version : allVersions) {
            List<String> versionKeywords = parseKeywords(version.getKeywordsJson());
            RelevanceCheckResult versionResult =
                analysisService.checkStrictRelevance(
                    version.getTitle(), version.getSummary(), versionKeywords, criteria);
            if (versionResult.passed()) {
              validVersion = version;
              break;
            }
          }

          if (validVersion != null) {
            if (!dryRun) {
              news.setCurrentVersionId(validVersion.getId());
              newsMapper.updateById(news);
            }
            updatedNewsCount++;

            for (NewsVersionEntity version : allVersions) {
              if (!version.getId().equals(validVersion.getId())) {
                List<String> versionKeywords = parseKeywords(version.getKeywordsJson());
                RelevanceCheckResult versionResult =
                    analysisService.checkStrictRelevance(
                        version.getTitle(), version.getSummary(), versionKeywords, criteria);
                if (!versionResult.passed()) {
                  if (!dryRun) {
                    newsVersionMapper.deleteById(version.getId());
                  }
                  deletedVersionsCount++;
                }
              }
            }
          } else {
            for (NewsVersionEntity version : allVersions) {
              if (!dryRun) {
                newsVersionMapper.deleteById(version.getId());
              }
              deletedVersionsCount++;
            }
            if (!dryRun) {
              newsMapper.deleteById(news.getId());
            }
            deletedNewsCount++;
          }
        }
      }

      auditLog.setDeletedNewsCount(deletedNewsCount);
      auditLog.setDeletedVersionsCount(deletedVersionsCount);
      auditLog.setFinishedAt(LocalDateTime.now());
      auditLog.setStatus(dryRun ? "preview" : "completed");

      if (!dryRun) {
        cleanupAuditLogMapper.insert(auditLog);
      }

      String message =
          dryRun
              ? String.format(
                  "预览模式：将删除 %d 条新闻和 %d 个版本，更新 %d 条新闻",
                  deletedNewsCount, deletedVersionsCount, updatedNewsCount)
              : String.format(
                  "已删除 %d 条新闻和 %d 个版本，更新 %d 条新闻",
                  deletedNewsCount, deletedVersionsCount, updatedNewsCount);

      StrictCleanupResult result = new StrictCleanupResult(
          deletedNewsCount,
          deletedVersionsCount,
          updatedNewsCount,
          auditReportPath,
          dryRun,
          message);

      return result;

    } catch (Exception e) {
      auditLog.setStatus("failed");
      auditLog.setErrorMessage(e.getMessage());
      auditLog.setFinishedAt(LocalDateTime.now());
      if (!dryRun) {
        cleanupAuditLogMapper.insert(auditLog);
      }
      throw new RuntimeException("Cleanup failed: " + e.getMessage(), e);
    }
  }

  @Transactional(
      isolation = Isolation.READ_COMMITTED,
      propagation = Propagation.REQUIRED,
      rollbackFor = Exception.class,
      timeout = 3600)
  public StrictCleanupResult cleanupNoncompliant(boolean dryRun, boolean verifyUrls) {
    LocalDateTime startedAt = LocalDateTime.now();
    CleanupAuditLogEntity auditLog = new CleanupAuditLogEntity();
    auditLog.setCleanupType("noncompliant");
    auditLog.setCriteriaJson(jsonSupport.stringify(Map.of(
        "minimumPublishedAt", newsComplianceService.minimumPublishedAt().toString(),
        "maximumPublishedAt", newsComplianceService.maximumPublishedAt().toString(),
        "verifyUrls", verifyUrls,
        "requiredSummaryTerms", NewsCleaningService.REQUIRED_SUMMARY_TERMS)));
    auditLog.setDryRun(dryRun);
    auditLog.setStartedAt(startedAt);
    auditLog.setStatus("running");

    try {
      String auditReportPath = generateNoncompliantAuditReport(verifyUrls);
      auditLog.setAuditReportPath(auditReportPath);
      int deletedNewsCount = 0;
      int deletedVersionsCount = 0;
      int updatedNewsCount = 0;

      for (NewsEntity news : newsMapper.selectList(null)) {
        SourceEntity source = sourceMapper.selectById(news.getSourceId());
        NewsVersionEntity currentVersion = newsVersionMapper.selectById(news.getCurrentVersionId());
        if (source == null || currentVersion == null) {
          continue;
        }

        NewsComplianceResult currentResult = checkCompliance(source, currentVersion, verifyUrls);
        if (currentResult.qualified()) {
          backfillVerifiedBodyText(currentVersion, currentResult, dryRun);
          continue;
        }

        List<NewsVersionEntity> allVersions =
            newsVersionMapper.selectList(
                new LambdaQueryWrapper<NewsVersionEntity>()
                    .eq(NewsVersionEntity::getNewsId, news.getId())
                    .orderByDesc(NewsVersionEntity::getPublishedAt));
        NewsVersionEntity validVersion = null;
        NewsComplianceResult validVersionResult = null;
        for (NewsVersionEntity version : allVersions) {
          NewsComplianceResult versionResult = checkCompliance(source, version, verifyUrls);
          if (versionResult.qualified()) {
            validVersion = version;
            validVersionResult = versionResult;
            break;
          }
        }

        if (validVersion == null) {
          for (NewsVersionEntity version : allVersions) {
            if (!dryRun) {
              newsVersionMapper.deleteById(version.getId());
            }
            deletedVersionsCount++;
          }
          if (!dryRun) {
            newsMapper.deleteById(news.getId());
          }
          deletedNewsCount++;
          continue;
        }

        if (!dryRun && !validVersion.getId().equals(news.getCurrentVersionId())) {
          news.setCurrentVersionId(validVersion.getId());
          newsMapper.updateById(news);
        }
        backfillVerifiedBodyText(validVersion, validVersionResult, dryRun);
        updatedNewsCount++;

        for (NewsVersionEntity version : allVersions) {
          if (version.getId().equals(validVersion.getId())) {
            continue;
          }
          if (!checkCompliance(source, version, verifyUrls).qualified()) {
            if (!dryRun) {
              newsVersionMapper.deleteById(version.getId());
            }
            deletedVersionsCount++;
          }
        }
      }

      auditLog.setDeletedNewsCount(deletedNewsCount);
      auditLog.setDeletedVersionsCount(deletedVersionsCount);
      auditLog.setFinishedAt(LocalDateTime.now());
      auditLog.setStatus(dryRun ? "preview" : "completed");
      if (!dryRun) {
        cleanupAuditLogMapper.insert(auditLog);
      }

      String message = dryRun
          ? String.format("预览模式：将删除 %d 条新闻和 %d 个版本，更新 %d 条新闻",
              deletedNewsCount, deletedVersionsCount, updatedNewsCount)
          : String.format("已删除 %d 条新闻和 %d 个版本，更新 %d 条新闻",
              deletedNewsCount, deletedVersionsCount, updatedNewsCount);
      return new StrictCleanupResult(
          deletedNewsCount,
          deletedVersionsCount,
          updatedNewsCount,
          auditReportPath,
          dryRun,
          message);
    } catch (Exception error) {
      auditLog.setStatus("failed");
      auditLog.setErrorMessage(error.getMessage());
      auditLog.setFinishedAt(LocalDateTime.now());
      if (!dryRun) {
        cleanupAuditLogMapper.insert(auditLog);
      }
      throw new RuntimeException("Noncompliant cleanup failed: " + error.getMessage(), error);
    }
  }

  @Transactional
  public void deleteNewsWithVersions(Long newsId) {
    List<NewsVersionEntity> versions =
        newsVersionMapper.selectList(
            new LambdaQueryWrapper<NewsVersionEntity>().eq(NewsVersionEntity::getNewsId, newsId));
    for (NewsVersionEntity version : versions) {
      newsVersionMapper.deleteById(version.getId());
    }
    newsMapper.deleteById(newsId);
  }

  @Transactional
  public void deleteNewsVersion(Long newsId, Long versionId) {
    newsVersionMapper.deleteById(versionId);

    NewsEntity news = newsMapper.selectById(newsId);
    if (news != null && news.getCurrentVersionId().equals(versionId)) {
      List<NewsVersionEntity> remainingVersions =
          newsVersionMapper.selectList(
              new LambdaQueryWrapper<NewsVersionEntity>().eq(NewsVersionEntity::getNewsId, newsId));
      if (remainingVersions.isEmpty()) {
        newsMapper.deleteById(newsId);
      } else {
        news.setCurrentVersionId(remainingVersions.get(0).getId());
        newsMapper.updateById(news);
      }
    }
  }

  private String generateDeletionAuditReport(StrictRelevanceCriteria criteria) {
    Path auditDir = Paths.get("target/audit");
    try {
      Files.createDirectories(auditDir);
    } catch (IOException e) {
      throw new RuntimeException("Failed to create audit directory", e);
    }

    String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    Path auditFile = auditDir.resolve("deletion-audit-" + timestamp + ".csv");

    try (FileWriter writer = new FileWriter(auditFile.toFile())) {
      writer.write(
          "news_id,news_code,version_id,title,summary,published_at,source_name,"
              + "matched_core_keywords,matched_entities,will_delete\n");

      List<NewsEntity> allNews = newsMapper.selectList(null);
      for (NewsEntity news : allNews) {
        NewsVersionEntity currentVersion = newsVersionMapper.selectById(news.getCurrentVersionId());
        if (currentVersion == null) {
          continue;
        }

        SourceEntity source = sourceMapper.selectById(news.getSourceId());
        if (source == null) {
          continue;
        }

        List<String> keywords = parseKeywords(currentVersion.getKeywordsJson());
        RelevanceCheckResult result =
            analysisService.checkStrictRelevance(
                currentVersion.getTitle(), currentVersion.getSummary(), keywords, criteria);

        writer.write(
            String.format(
                "%d,%s,%d,\"%s\",\"%s\",%s,%s,\"%s\",\"%s\",%s\n",
                news.getId(),
                news.getNewsCode(),
                currentVersion.getId(),
                escapeCsv(currentVersion.getTitle()),
                escapeCsv(currentVersion.getSummary()),
                currentVersion.getPublishedAt(),
                escapeCsv(source.getName()),
                escapeCsv(String.join(";", result.matchedCoreKeywords())),
                escapeCsv(String.join(";", result.matchedEntities())),
                !result.passed()));
      }
    } catch (IOException e) {
      throw new RuntimeException("Failed to write deletion audit report", e);
    }

    return auditFile.toString();
  }

  private String generateNoncompliantAuditReport(boolean verifyUrls) {
    Path auditDir = Paths.get("target/audit");
    try {
      Files.createDirectories(auditDir);
    } catch (IOException error) {
      throw new RuntimeException("Failed to create audit directory", error);
    }

    String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    Path auditFile = auditDir.resolve("noncompliant-cleanup-" + timestamp + ".csv");

    try (FileWriter writer = new FileWriter(auditFile.toFile())) {
      writer.write(
          "news_id,news_code,version_id,title,summary,published_at,source_name,original_url,reasons,will_delete\n");
      for (NewsEntity news : newsMapper.selectList(null)) {
        SourceEntity source = sourceMapper.selectById(news.getSourceId());
        NewsVersionEntity currentVersion = newsVersionMapper.selectById(news.getCurrentVersionId());
        if (source == null || currentVersion == null) {
          continue;
        }
        NewsComplianceResult result = checkCompliance(source, currentVersion, verifyUrls);
        writer.write(String.format(
            "%d,%s,%d,\"%s\",\"%s\",%s,\"%s\",%s,\"%s\",%s\n",
            news.getId(),
            news.getNewsCode(),
            currentVersion.getId(),
            escapeCsv(currentVersion.getTitle()),
            escapeCsv(currentVersion.getSummary()),
            currentVersion.getPublishedAt(),
            escapeCsv(source.getName()),
            escapeCsv(currentVersion.getOriginalUrl()),
            escapeCsv(String.join(";", result.reasons())),
            !result.qualified()));
      }
    } catch (IOException error) {
      throw new RuntimeException("Failed to write noncompliant audit report", error);
    }

    return auditFile.toString();
  }

  private NewsComplianceResult checkCompliance(
      SourceEntity source, NewsVersionEntity version, boolean verifyUrls) {
    return newsComplianceService.checkCurrentVersion(
        source,
        version,
        parseKeywords(version.getKeywordsJson()),
        verifyUrls);
  }

  private void backfillVerifiedBodyText(
      NewsVersionEntity version, NewsComplianceResult result, boolean dryRun) {
    if (dryRun || version == null || result == null) {
      return;
    }
    if (!NewsCleaningService.cleanText(version.getBodyText()).isBlank()
        || NewsCleaningService.cleanText(result.verifiedBodyText()).isBlank()) {
      return;
    }
    version.setBodyText(result.verifiedBodyText());
    newsVersionMapper.updateById(version);
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

  public record CleanupResult(int deletedNews, int deletedVersions, String message) {}
}
