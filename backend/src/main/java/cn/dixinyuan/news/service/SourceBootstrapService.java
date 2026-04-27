package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.JsonSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SourceBootstrapService {
  private final String importRoot;
  private final JsonSupport jsonSupport;
  private final SourceMapper sourceMapper;

  public SourceBootstrapService(
      @Value("${app.import-root}") String importRoot,
      JsonSupport jsonSupport,
      SourceMapper sourceMapper) {
    this.importRoot = importRoot;
    this.jsonSupport = jsonSupport;
    this.sourceMapper = sourceMapper;
  }

  public List<SourceEntity> ensureSources() {
    if (sourceMapper.selectCount(null) == 0) {
      importSources(resolveImportRoot().resolve("config").resolve("sources.json"));
    }
    return sourceMapper.selectList(
        new LambdaQueryWrapper<SourceEntity>().eq(SourceEntity::getActive, true));
  }

  private void importSources(Path path) {
    JsonNode array = jsonSupport.readFile(path);
    for (JsonNode node : array) {
      SourceEntity entity = new SourceEntity();
      entity.setSourceCode(text(node, "id"));
      entity.setName(text(node, "name"));
      entity.setType(text(node, "type"));
      entity.setSiteUrl(text(node, "siteUrl"));
      entity.setLanguage(text(node, "language"));
      entity.setTrustLevel(text(node, "trustLevel"));
      entity.setActive(node.path("isActive").asBoolean(true));
      entity.setCrawlRuleJson(jsonSupport.stringify(node.path("crawlRule")));
      sourceMapper.insert(entity);
    }
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
    throw new IllegalStateException("Could not locate datasets directory.");
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isMissingNode() || value.isNull() ? "" : value.asText();
  }
}
