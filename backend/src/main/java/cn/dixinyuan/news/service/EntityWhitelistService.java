package cn.dixinyuan.news.service;

import cn.dixinyuan.news.support.JsonSupport;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EntityWhitelistService {
  private final String importRoot;
  private final JsonSupport jsonSupport;
  private volatile List<WhitelistEntity> cachedEntities;

  public EntityWhitelistService(
      @Value("${app.import-root}") String importRoot,
      JsonSupport jsonSupport) {
    this.importRoot = importRoot;
    this.jsonSupport = jsonSupport;
  }

  public List<String> terms() {
    Set<String> seen = new LinkedHashSet<>();
    List<String> terms = new ArrayList<>();
    for (WhitelistEntity entity : entities()) {
      addTerm(entity.name(), seen, terms);
      entity.aliases().forEach(alias -> addTerm(alias, seen, terms));
    }
    return terms;
  }

  public List<String> entityIds() {
    return entities().stream().map(WhitelistEntity::id).toList();
  }

  public boolean hasEntityId(String entityId) {
    String cleanId = NewsCleaningService.cleanText(entityId);
    if (cleanId.isBlank()) {
      return false;
    }
    return entities().stream().anyMatch(entity -> cleanId.equals(entity.id()));
  }

  public List<String> termsForEntityId(String entityId) {
    String cleanId = NewsCleaningService.cleanText(entityId);
    if (cleanId.isBlank()) {
      return List.of();
    }
    return entities().stream()
        .filter(entity -> cleanId.equals(entity.id()))
        .findFirst()
        .map(entity -> {
          List<String> terms = new ArrayList<>();
          addTerm(entity.name(), new LinkedHashSet<>(), terms);
          Set<String> seen = new LinkedHashSet<>(terms.stream().map(EntityWhitelistService::normalizeTerm).toList());
          entity.aliases().forEach(alias -> addTerm(alias, seen, terms));
          return terms;
        })
        .orElse(List.of());
  }

  public List<String> termsForEntityIdOrSource(String entityId, String sourceName) {
    List<String> terms = new ArrayList<>(termsForEntityId(entityId));
    addTerm(sourceName, new LinkedHashSet<>(terms.stream().map(EntityWhitelistService::normalizeTerm).toList()), terms);
    return terms;
  }

  public Optional<String> resolveEntityId(
      String configuredId, String sourceCode, String sourceName, String siteUrl) {
    String cleanConfiguredId = NewsCleaningService.cleanText(configuredId);
    if (hasEntityId(cleanConfiguredId)) {
      return Optional.of(cleanConfiguredId);
    }

    String sourceCodeValue = NewsCleaningService.cleanText(sourceCode);
    if (sourceCodeValue.startsWith("wl-entity-")) {
      String suffix = sourceCodeValue.substring("wl-".length());
      if (hasEntityId(suffix)) {
        return Optional.of(suffix);
      }
    }

    String normalizedName = normalizeTerm(sourceName);
    for (WhitelistEntity entity : entities()) {
      if (normalizedName.equals(normalizeTerm(entity.name()))) {
        return Optional.of(entity.id());
      }
      for (String alias : entity.aliases()) {
        if (normalizedName.equals(normalizeTerm(alias))) {
          return Optional.of(entity.id());
        }
      }
    }

    String host = host(siteUrl);
    if (!host.isBlank()) {
      Map<String, String> matches = new LinkedHashMap<>();
      for (WhitelistEntity entity : entities()) {
        for (String evidenceUrl : entity.evidenceUrls()) {
          if (host.equals(host(evidenceUrl))) {
            matches.put(entity.id(), entity.id());
          }
        }
      }
      if (matches.size() == 1) {
        return Optional.of(matches.keySet().iterator().next());
      }
    }

    return Optional.empty();
  }

  private List<WhitelistEntity> entities() {
    List<WhitelistEntity> cached = cachedEntities;
    if (cached != null) {
      return cached;
    }
    synchronized (this) {
      if (cachedEntities != null) {
        return cachedEntities;
      }
      cachedEntities = loadEntities();
      return cachedEntities;
    }
  }

  private List<WhitelistEntity> loadEntities() {
    Path path = resolveImportRoot().resolve("config").resolve("entity-whitelist.json");
    if (!Files.exists(path)) {
      return List.of();
    }
    JsonNode root = jsonSupport.readFile(path);
    List<WhitelistEntity> items = new ArrayList<>();
    for (JsonNode entity : root.path("entities")) {
      List<String> aliases = new ArrayList<>();
      for (JsonNode alias : entity.path("aliases")) {
        String value = NewsCleaningService.cleanText(alias.asText(""));
        if (!value.isBlank()) {
          aliases.add(value);
        }
      }
      items.add(new WhitelistEntity(
          entity.path("id").asText(""),
          NewsCleaningService.cleanText(entity.path("name").asText("")),
          aliases,
          evidenceUrls(entity.path("evidenceUrl").asText(""))));
    }
    return items.stream().filter(entity -> !entity.id().isBlank()).toList();
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
    return configured;
  }

  private static void addTerm(String value, Set<String> seen, List<String> terms) {
    String term = NewsCleaningService.cleanText(value);
    if (term.length() < 2) {
      return;
    }
    String key = normalizeTerm(term);
    if (seen.add(key)) {
      terms.add(term);
    }
  }

  private static String normalizeTerm(String value) {
    return NewsCleaningService.cleanText(value)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[\\s\\p{Punct}\\u3000-\\u303f\\uff00-\\uffef]+", "");
  }

  private static List<String> evidenceUrls(String evidenceUrl) {
    String cleaned = NewsCleaningService.cleanText(evidenceUrl);
    if (cleaned.isBlank()) {
      return List.of();
    }
    return Arrays.stream(cleaned.split("[;；,，\\s]+"))
        .map(NewsCleaningService::cleanText)
        .filter(item -> item.startsWith("http://") || item.startsWith("https://"))
        .toList();
  }

  private static String host(String url) {
    try {
      String host = java.net.URI.create(NewsCleaningService.cleanText(url)).getHost();
      return host == null ? "" : host.replaceFirst("^www\\.", "").toLowerCase(Locale.ROOT);
    } catch (RuntimeException error) {
      return "";
    }
  }

  private record WhitelistEntity(
      String id,
      String name,
      List<String> aliases,
      List<String> evidenceUrls) {}
}
