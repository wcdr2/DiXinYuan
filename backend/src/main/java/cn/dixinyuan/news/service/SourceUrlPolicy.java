package cn.dixinyuan.news.service;

import cn.dixinyuan.news.entity.SourceEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class SourceUrlPolicy {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private SourceUrlPolicy() {}

  public static boolean isAllowedArticleUrl(SourceEntity source, String articleUrl) {
    String host = host(articleUrl);
    if (source == null || host.isBlank()) {
      return false;
    }
    Set<String> allowedHosts = allowedHosts(source);
    if (allowedHosts.stream().anyMatch(allowed -> hostMatches(host, allowed))) {
      return true;
    }
    return allowedHostPatterns(source).stream().anyMatch(pattern -> pattern.matcher(host).find());
  }

  private static Set<String> allowedHosts(SourceEntity source) {
    Set<String> hosts = new LinkedHashSet<>();
    String sourceHost = host(source.getSiteUrl());
    if (!sourceHost.isBlank()) {
      hosts.add(sourceHost);
    }
    JsonNode rule = crawlRule(source);
    addJsonHosts(hosts, rule.path("allowedDomains"));
    addJsonHosts(hosts, rule.path("allowedHosts"));
    return hosts;
  }

  private static Set<Pattern> allowedHostPatterns(SourceEntity source) {
    Set<Pattern> patterns = new LinkedHashSet<>();
    JsonNode rule = crawlRule(source);
    JsonNode nodes = rule.path("allowedHostPatterns");
    if (!nodes.isArray()) {
      return patterns;
    }
    for (JsonNode node : nodes) {
      String value = node.asText("");
      if (!value.isBlank()) {
        patterns.add(Pattern.compile(value, Pattern.CASE_INSENSITIVE));
      }
    }
    return patterns;
  }

  private static void addJsonHosts(Set<String> hosts, JsonNode nodes) {
    if (!nodes.isArray()) {
      return;
    }
    for (JsonNode node : nodes) {
      String value = hostOrDomain(node.asText(""));
      if (!value.isBlank()) {
        hosts.add(value);
      }
    }
  }

  private static boolean hostMatches(String host, String allowedHost) {
    String left = stripWww(host);
    String right = stripWww(allowedHost);
    return left.equals(right) || left.endsWith("." + right);
  }

  private static String host(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    try {
      return hostOrDomain(URI.create(value.trim()).getHost());
    } catch (RuntimeException error) {
      return "";
    }
  }

  private static String hostOrDomain(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("^www\\.", "");
  }

  private static String stripWww(String value) {
    return hostOrDomain(value);
  }

  private static JsonNode crawlRule(SourceEntity source) {
    try {
      return OBJECT_MAPPER.readTree(source.getCrawlRuleJson() == null ? "{}" : source.getCrawlRuleJson());
    } catch (Exception error) {
      return OBJECT_MAPPER.createObjectNode();
    }
  }
}
