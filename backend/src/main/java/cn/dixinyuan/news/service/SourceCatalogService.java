package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class SourceCatalogService {
  private static final Set<String> ALLOWED_SOURCE_TYPES = Set.of(
      "government", "association", "research", "enterprise", "university", "international");
  private static final Set<String> RETIRED_SOURCE_CODES = Set.of(
      "news-cn", "people-cn", "cctv-cn", "stdaily", "chinanews", "gov-cn");
  private static final Set<String> RETIRED_SOURCE_HOSTS = Set.of(
      "news.cn", "xinhuanet.com", "people.com.cn", "cctv.com", "stdaily.com",
      "chinanews.com.cn", "chinanews.com", "gov.cn");
  private final String importRoot;
  private final JsonSupport jsonSupport;
  private final SourceMapper sourceMapper;
  private final TransactionTemplate transactionTemplate;
  private final EntityWhitelistService entityWhitelistService;

  public SourceCatalogService(
      @Value("${app.import-root}") String importRoot,
      JsonSupport jsonSupport,
      SourceMapper sourceMapper,
      TransactionTemplate transactionTemplate,
      EntityWhitelistService entityWhitelistService) {
    this.importRoot = importRoot;
    this.jsonSupport = jsonSupport;
    this.sourceMapper = sourceMapper;
    this.transactionTemplate = transactionTemplate;
    this.entityWhitelistService = entityWhitelistService;
  }

  public List<SourceEntity> syncConfiguredSources() {
    return upsertFromFile(resolveImportRoot().resolve("config").resolve("sources.json"));
  }

  public List<SourceEntity> upsertFromFile(Path path) {
    return transactionTemplate.execute(status -> {
      JsonNode array = jsonSupport.readFile(path);
      List<SourceEntity> sources = new ArrayList<>();
      for (JsonNode node : array) {
        SourceEntity entity = sourceMapper.selectOne(
            new LambdaQueryWrapper<SourceEntity>().eq(SourceEntity::getSourceCode, text(node, "id")));
        if (entity == null) {
          entity = new SourceEntity();
          entity.setSourceCode(text(node, "id"));
        }
        entity.setName(text(node, "name"));
        entity.setType(text(node, "type"));
        entity.setSiteUrl(text(node, "siteUrl"));
        entity.setLanguage(text(node, "language"));
        entity.setTrustLevel(text(node, "trustLevel"));
        Optional<String> whitelistEntityId = entityWhitelistService.resolveEntityId(
            text(node, "whitelistEntityId"),
            text(node, "id"),
            text(node, "name"),
            text(node, "siteUrl"));
        entity.setWhitelistEntityId(whitelistEntityId.orElse(""));
        entity.setActive(node.path("isActive").asBoolean(true)
            && whitelistEntityId.isPresent()
            && isSourceAllowed(node));
        entity.setCrawlRuleJson(jsonSupport.stringify(normalizeCrawlRule(node.path("crawlRule"))));
        if (entity.getId() == null) {
          sourceMapper.insert(entity);
        } else {
          sourceMapper.updateById(entity);
        }
        sources.add(entity);
      }
      sourceMapper.update(
          null,
          new LambdaUpdateWrapper<SourceEntity>()
              .and(wrapper -> wrapper
                  .isNull(SourceEntity::getWhitelistEntityId)
                  .or()
                  .eq(SourceEntity::getWhitelistEntityId, ""))
              .set(SourceEntity::getActive, false));
      return sources;
    });
  }

  private Path resolveImportRoot() {
    Path configured = Path.of(importRoot).toAbsolutePath().normalize();
    if (Files.exists(configured)) {
      return configured;
    }
    Path projectRoot = Path.of("..").resolve("datasets").toAbsolutePath().normalize();
    if (Files.exists(projectRoot)) {
      return projectRoot;
    }
    Path localRoot = Path.of("datasets").toAbsolutePath().normalize();
    if (Files.exists(localRoot)) {
      return localRoot;
    }
    throw new IllegalStateException("Could not locate datasets directory.");
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? "" : value.asText();
  }

  private static boolean isSourceAllowed(JsonNode node) {
    String code = text(node, "id").toLowerCase(Locale.ROOT);
    String type = text(node, "type").toLowerCase(Locale.ROOT);
    if (RETIRED_SOURCE_CODES.contains(code) || !ALLOWED_SOURCE_TYPES.contains(type)) {
      return false;
    }
    String host = host(text(node, "siteUrl"));
    return host.isBlank() || !RETIRED_SOURCE_HOSTS.contains(host);
  }

  private static String host(String siteUrl) {
    try {
      String host = URI.create(siteUrl).getHost();
      return host == null ? "" : host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
    } catch (IllegalArgumentException exception) {
      return "";
    }
  }

  private Map<String, Object> normalizeCrawlRule(JsonNode crawlRule) {
    Map<String, Object> rule = crawlRule == null || crawlRule.isMissingNode() || crawlRule.isNull()
        ? new LinkedHashMap<>()
        : new com.fasterxml.jackson.databind.ObjectMapper().convertValue(crawlRule, new TypeReference<>() {});
    Set<String> whitelist = new LinkedHashSet<>();
    Object existing = rule.get("whitelist");
    if (existing instanceof Iterable<?> iterable) {
      for (Object item : iterable) {
        String term = NewsCleaningService.cleanText(String.valueOf(item));
        if (!term.isBlank()) {
          whitelist.add(term);
        }
      }
    }
    whitelist.addAll(NewsCleaningService.REQUIRED_SUMMARY_TERMS);
    rule.put("whitelist", new ArrayList<>(whitelist));
    rule.put("requireKeywordMatch", true);
    return rule;
  }
}
