package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.QualityAuditResultDto;
import cn.dixinyuan.news.dto.RelevanceCheckResult;
import cn.dixinyuan.news.dto.StrictRelevanceCriteria;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class NewsQualityAuditService {
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final SourceMapper sourceMapper;
  private final EntityWhitelistService entityWhitelistService;
  private final StrictRelevanceChecker strictRelevanceChecker;
  private final UrlVerificationService urlVerificationService;
  private final NewsComplianceService newsComplianceService;
  private final JsonSupport jsonSupport;
  private final LocalDateTime minimumPublishedAt;

  public NewsQualityAuditService(
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      SourceMapper sourceMapper,
      EntityWhitelistService entityWhitelistService,
      StrictRelevanceChecker strictRelevanceChecker,
      UrlVerificationService urlVerificationService,
      NewsComplianceService newsComplianceService,
      JsonSupport jsonSupport,
      @Value("${app.news-min-published-at:2024-01-01T00:00:00}") String minimumPublishedAt) {
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.sourceMapper = sourceMapper;
    this.entityWhitelistService = entityWhitelistService;
    this.strictRelevanceChecker = strictRelevanceChecker;
    this.urlVerificationService = urlVerificationService;
    this.newsComplianceService = newsComplianceService;
    this.jsonSupport = jsonSupport;
    this.minimumPublishedAt = LocalDateTime.parse(minimumPublishedAt);
  }

  public QualityAuditResultDto audit(boolean verifyUrls, int urlCheckLimit, int targetUniqueNews) {
    List<AuditRow> rows = new ArrayList<>();
    Map<String, Integer> reasons = new LinkedHashMap<>();
    Set<String> seenCanonicalKeys = new LinkedHashSet<>();
    int sourceNotWhitelisted = 0;
    int dateOutOfRange = 0;
    int notDetailUrl = 0;
    int sourceUrlDomainMismatch = 0;
    int inaccessibleUrl = 0;
    int bodyMissing = 0;
    int summaryNotFromBody = 0;
    int summaryRequiredTermMissing = 0;
    int relevanceFailed = 0;
    int bodyRelevanceFailed = 0;
    int duplicateCanonicalUrl = 0;
    int zh = 0;
    int guangxiRelated = 0;
    int verifiedAccessibleCurrent = 0;
    int urlChecked = 0;
    int urlAccessible = 0;
    int qualified = 0;

    for (NewsEntity news : newsMapper.selectList(null)) {
      NewsVersionEntity version = newsVersionMapper.selectById(news.getCurrentVersionId());
      SourceEntity source = sourceMapper.selectById(news.getSourceId());
      if (version == null || source == null) {
        continue;
      }

      List<String> keywords = parseKeywords(version.getKeywordsJson());
      boolean verifyThisUrl = verifyUrls && urlChecked < Math.max(urlCheckLimit, 0);
      NewsComplianceResult compliance =
          newsComplianceService.checkCurrentVersion(source, version, keywords, verifyThisUrl);
      List<String> rowReasons = new ArrayList<>(compliance.reasons());
      if ("zh".equalsIgnoreCase(version.getLanguage())) {
        zh++;
      }
      if (Boolean.TRUE.equals(version.getIsGuangxiRelated())) {
        guangxiRelated++;
      }
      if (!compliance.sourceWhitelisted()) {
        sourceNotWhitelisted++;
      }
      if (!compliance.dateInRange()) {
        dateOutOfRange++;
      }
      if (!compliance.detailUrl()) {
        notDetailUrl++;
      }
      if (!compliance.sourceUrlAllowed()) {
        sourceUrlDomainMismatch++;
      }
      if (!compliance.bodyPresent()) {
        bodyMissing++;
      }
      if (!compliance.summaryFromBody()) {
        summaryNotFromBody++;
      }
      if (!compliance.summaryHasRequiredTerm()) {
        summaryRequiredTermMissing++;
      }
      if (!compliance.relevant()) {
        relevanceFailed++;
      }
      if (!compliance.bodyRelevant()) {
        bodyRelevanceFailed++;
      }
      if (verifyThisUrl) {
        urlChecked++;
        if (compliance.urlAccessible()) {
          urlAccessible++;
        }
      } else if (!verifyUrls && compliance.urlAccessible()) {
        urlAccessible++;
      }
      if (compliance.urlAccessible()) {
        verifiedAccessibleCurrent++;
      }
      if (!compliance.urlAccessible()) {
        inaccessibleUrl++;
      }

      String canonicalKey = source.getId() + "::" + news.getCanonicalUrl();
      boolean duplicate = !seenCanonicalKeys.add(canonicalKey);
      if (duplicate) {
        duplicateCanonicalUrl++;
        rowReasons.add("duplicate_canonical_url");
      }

      if (rowReasons.isEmpty()) {
        qualified++;
      } else {
        rowReasons.forEach(reason -> reasons.merge(reason, 1, Integer::sum));
      }

      rows.add(new AuditRow(
          news.getId(),
          news.getNewsCode(),
          source.getSourceCode(),
        source.getName(),
        source.getWhitelistEntityId(),
        version.getTitle(),
        version.getOriginalUrl(),
        version.getPublishedAt(),
        version.getBodyText(),
        String.join(";", rowReasons)));
    }

    String auditPath = writeAudit(rows);
    int total = rows.size();
    double urlRate = urlChecked > 0
        ? (double) urlAccessible / urlChecked
        : total == 0 ? 0.0 : (double) verifiedAccessibleCurrent / total;
    double sourceCoverage = total == 0 ? 0.0 : (double) (total - sourceNotWhitelisted) / total;
    List<String> topReasons = reasons.entrySet().stream()
        .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
        .limit(10)
        .map(entry -> entry.getKey() + ":" + entry.getValue())
        .toList();

    return new QualityAuditResultDto(
        targetUniqueNews,
        total,
        qualified,
        Math.max(targetUniqueNews - qualified, 0),
        sourceNotWhitelisted,
        dateOutOfRange,
        notDetailUrl,
        sourceUrlDomainMismatch,
        inaccessibleUrl,
        bodyMissing,
        summaryNotFromBody,
        summaryRequiredTermMissing,
        relevanceFailed,
        bodyRelevanceFailed,
        duplicateCanonicalUrl,
        zh,
        guangxiRelated,
        verifiedAccessibleCurrent,
        urlChecked,
        urlAccessible,
        urlRate,
        sourceCoverage,
        auditPath,
        topReasons);
  }

  private List<String> parseKeywords(String keywordsJson) {
    try {
      return keywordsJson == null || keywordsJson.isBlank()
          ? List.of()
          : jsonSupport.parseStringList(keywordsJson);
    } catch (RuntimeException error) {
      return List.of();
    }
  }

  private String writeAudit(List<AuditRow> rows) {
    try {
      Path dir = Path.of("target", "audit").toAbsolutePath().normalize();
      Files.createDirectories(dir);
      String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
      Path file = dir.resolve("quality-audit-" + timestamp + ".csv");
      try (FileWriter writer = new FileWriter(file.toFile())) {
        writer.write("news_id,news_code,source_code,source_name,whitelist_entity_id,title,original_url,published_at,body_text_length,reasons\n");
        for (AuditRow row : rows) {
          writer.write(String.format(
              "%d,%s,%s,\"%s\",%s,\"%s\",%s,%s,%d,\"%s\"%n",
              row.newsId(),
              row.newsCode(),
              row.sourceCode(),
              escapeCsv(row.sourceName()),
              row.whitelistEntityId(),
              escapeCsv(row.title()),
              row.originalUrl(),
              row.publishedAt(),
              row.bodyText() == null ? 0 : row.bodyText().length(),
              escapeCsv(row.reasons())));
        }
      }
      return file.toString();
    } catch (IOException error) {
      throw new IllegalStateException("Failed to write quality audit report.", error);
    }
  }

  private static String escapeCsv(String value) {
    return value == null ? "" : value.replace("\"", "\"\"").replace("\n", " ").replace("\r", " ");
  }

  private record AuditRow(
      Long newsId,
      String newsCode,
      String sourceCode,
      String sourceName,
      String whitelistEntityId,
      String title,
      String originalUrl,
      LocalDateTime publishedAt,
      String bodyText,
      String reasons) {}
}
