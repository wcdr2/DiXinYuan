package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.CrawlLogDto;
import cn.dixinyuan.news.entity.CrawlRunEntity;
import cn.dixinyuan.news.entity.CrawlRunSourceEntity;
import cn.dixinyuan.news.entity.SourceEntity;
import cn.dixinyuan.news.mapper.CrawlRunMapper;
import cn.dixinyuan.news.mapper.CrawlRunSourceMapper;
import cn.dixinyuan.news.mapper.SourceMapper;
import cn.dixinyuan.news.support.TimeSupport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class LogQueryService {
  private final CrawlRunMapper crawlRunMapper;
  private final CrawlRunSourceMapper crawlRunSourceMapper;
  private final SourceMapper sourceMapper;

  public LogQueryService(
      CrawlRunMapper crawlRunMapper,
      CrawlRunSourceMapper crawlRunSourceMapper,
      SourceMapper sourceMapper) {
    this.crawlRunMapper = crawlRunMapper;
    this.crawlRunSourceMapper = crawlRunSourceMapper;
    this.sourceMapper = sourceMapper;
  }

  public List<CrawlLogDto> latest() {
    CrawlRunEntity latestRun = crawlRunMapper.selectList(new LambdaQueryWrapper<CrawlRunEntity>())
        .stream()
        .max(Comparator.comparing(CrawlRunEntity::getStartedAt))
        .orElse(null);
    if (latestRun == null) {
      return List.of();
    }
    List<CrawlRunSourceEntity> rows = crawlRunSourceMapper.selectList(
        new LambdaQueryWrapper<CrawlRunSourceEntity>().eq(CrawlRunSourceEntity::getCrawlRunId, latestRun.getId()));
    Map<Long, SourceEntity> sources = sourceMapper.selectBatchIds(
            rows.stream().map(CrawlRunSourceEntity::getSourceId).collect(Collectors.toSet()))
        .stream()
        .collect(Collectors.toMap(SourceEntity::getId, Function.identity()));
    return rows.stream()
        .map(row -> {
          SourceEntity source = sources.get(row.getSourceId());
          return new CrawlLogDto(
              source == null ? "" : source.getSourceCode(),
              source == null ? "" : source.getName(),
              TimeSupport.toIsoString(row.getStartedAt()),
              TimeSupport.toIsoString(row.getFinishedAt()),
              statusLabel(row.getStatus()),
              row.getFetchedCount(),
              row.getCandidateCount(),
              row.getAcceptedCount(),
              row.getRejectedCount(),
              row.getPublishedCount(),
              row.getDuplicateCount(),
              coverageLabel(row.getCoverageStatus()),
              diagnosticLabel(row.getErrorMessage()),
              diagnosticLabel(row.getNote()));
        })
        .toList();
  }

  private static String statusLabel(String status) {
    return switch (status == null ? "" : status) {
      case "fetched" -> "已抓取";
      case "skipped" -> "已跳过";
      case "failed" -> "失败";
      case "seeded" -> "种子数据";
      case "running" -> "运行中";
      default -> status == null ? "" : status;
    };
  }

  private static String coverageLabel(String status) {
    return switch (status == null ? "" : status) {
      case "best_effort" -> "尽力完成";
      case "partial" -> "部分完成";
      case "failed" -> "失败";
      case "running" -> "运行中";
      default -> status == null ? "" : status;
    };
  }

  private static String diagnosticLabel(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    String text = value.trim()
        .replace("No in-window candidates were fetched.", "发现了链接/条目，但没有发布日期落在本次抓取时间窗口内的详情页候选。")
        .replace("Source crawl failed.", "来源抓取失败。")
        .replace("pages=", "页面/订阅数=");

    Matcher fetched = Pattern.compile("Fetched (\\d+) candidates from (\\d+) pages/feeds\\.").matcher(text);
    text = fetched.replaceAll("找到 $1 条时间窗口内候选，检查了 $2 个页面/订阅。");

    Matcher httpStatus = Pattern.compile("HTTP error fetching URL\\. Status=(\\d+)", Pattern.CASE_INSENSITIVE).matcher(text);
    text = httpStatus.replaceAll("HTTP 访问失败，状态码 $1");

    Matcher rejectReasons = Pattern.compile("rejectReasons=\\{([^}]*)}").matcher(text);
    StringBuffer translated = new StringBuffer();
    while (rejectReasons.find()) {
      rejectReasons.appendReplacement(
          translated,
          Matcher.quoteReplacement("拒绝原因：" + rejectReasonSummary(rejectReasons.group(1))));
    }
    rejectReasons.appendTail(translated);
    text = translated.toString();

    if (text.contains("Received fatal alert: unrecognized_name")) {
      text = "TLS 握手失败：来源站点不接受当前域名证书握手。";
    }
    if (text.toLowerCase().contains("timed out")) {
      text = "访问超时。";
    }
    return text;
  }

  private static String rejectReasonSummary(String raw) {
    if (raw == null || raw.isBlank()) {
      return "未知原因";
    }
    return Pattern.compile(",\\s*").splitAsStream(raw)
        .map(item -> item.split("=", 2))
        .filter(parts -> parts.length == 2)
        .map(parts -> rejectReasonLabel(parts[0].trim()) + " " + parts[1].trim() + " 条")
        .collect(Collectors.joining("，"));
  }

  private static String rejectReasonLabel(String reason) {
    return switch (reason == null ? "" : reason) {
      case "title_too_short" -> "标题过短";
      case "summary_too_short" -> "摘要过短或没有正文摘要";
      case "missing_published_at" -> "缺少发布时间";
      case "published_at_out_of_range" -> "发布时间不在范围内";
      case "summary_not_from_body" -> "摘要不是正文子串";
      case "summary_required_term_missing" -> "摘要缺少必需硬词";
      case "body_missing" -> "缺少正文";
      case "body_relevance_failed" -> "正文强相关不足";
      case "source_not_whitelisted" -> "来源不在白名单";
      case "source_url_domain_mismatch" -> "新闻 URL 不属于来源域名";
      case "not_detail_url" -> "不是具体新闻详情页";
      case "url_inaccessible" -> "URL 不可访问";
      case "keyword_not_matched" -> "关键词规则未命中";
      default -> reason == null || reason.isBlank() ? "未知原因" : reason;
    };
  }
}
