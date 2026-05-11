package cn.dixinyuan.news.dto;

import java.util.Map;

public record KeywordDistributionReport(
    int totalVersions,
    Map<String, Integer> keywordMatchCounts,
    Map<Integer, Integer> matchCountDistribution,
    int strictPassCount,
    int strictFailCount
) {}
