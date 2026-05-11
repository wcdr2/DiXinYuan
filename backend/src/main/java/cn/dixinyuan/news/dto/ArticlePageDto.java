package cn.dixinyuan.news.dto;

import java.util.List;

public record ArticlePageDto(
    List<ArticleDto> content,
    int page,
    int pageSize,
    long totalElements,
    int totalPages,
    boolean hasPrevious,
    boolean hasNext) {}
