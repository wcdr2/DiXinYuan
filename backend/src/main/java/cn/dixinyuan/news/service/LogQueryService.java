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
              row.getStatus(),
              row.getFetchedCount(),
              row.getPublishedCount(),
              row.getDuplicateCount(),
              row.getNote());
        })
        .toList();
  }
}
