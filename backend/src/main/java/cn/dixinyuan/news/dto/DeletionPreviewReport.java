package cn.dixinyuan.news.dto;

import java.util.List;
import java.util.Map;

public record DeletionPreviewReport(
    int totalNewsToDelete,
    int totalVersionsToDelete,
    List<NewsPreviewItem> sampleNews,
    Map<String, Integer> rejectReasonDistribution
) {}
