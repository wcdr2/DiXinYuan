package cn.dixinyuan.news.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record SourceDto(
    String id,
    String name,
    String type,
    String siteUrl,
    String language,
    String trustLevel,
    Boolean isActive,
    JsonNode crawlRule) {}
