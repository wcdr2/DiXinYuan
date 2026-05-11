package cn.dixinyuan.news.service;

import cn.dixinyuan.news.dto.NewsCleanupResultDto;
import cn.dixinyuan.news.entity.NewsEntity;
import cn.dixinyuan.news.entity.NewsVersionEntity;
import cn.dixinyuan.news.mapper.NewsMapper;
import cn.dixinyuan.news.mapper.NewsVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class NewsDateCleanupService {
  private final NewsMapper newsMapper;
  private final NewsVersionMapper newsVersionMapper;
  private final TransactionTemplate transactionTemplate;

  public NewsDateCleanupService(
      NewsMapper newsMapper,
      NewsVersionMapper newsVersionMapper,
      TransactionTemplate transactionTemplate) {
    this.newsMapper = newsMapper;
    this.newsVersionMapper = newsVersionMapper;
    this.transactionTemplate = transactionTemplate;
  }

  public NewsCleanupResultDto preview(LocalDateTime startAt, LocalDateTime endAt) {
    List<NewsVersionEntity> outOfRange = outOfRangeVersions(startAt, endAt);
    String auditPath = writeAudit(outOfRange, startAt, endAt);
    return new NewsCleanupResultDto(outOfRange.size(), 0, 0, auditPath, false);
  }

  public NewsCleanupResultDto deleteOutOfRange(LocalDateTime startAt, LocalDateTime endAt) {
    return transactionTemplate.execute(status -> {
      List<NewsVersionEntity> outOfRange = outOfRangeVersions(startAt, endAt);
      String auditPath = writeAudit(outOfRange, startAt, endAt);
      Set<Long> affectedNewsIds = new LinkedHashSet<>();
      outOfRange.stream().map(NewsVersionEntity::getNewsId).forEach(affectedNewsIds::add);
      if (!outOfRange.isEmpty()) {
        newsVersionMapper.deleteBatchIds(outOfRange.stream().map(NewsVersionEntity::getId).toList());
      }

      int updatedNews = 0;
      int deletedNews = 0;
      for (Long newsId : affectedNewsIds) {
        NewsVersionEntity latestInRange = newsVersionMapper.selectList(
                new LambdaQueryWrapper<NewsVersionEntity>()
                    .eq(NewsVersionEntity::getNewsId, newsId)
                    .ge(NewsVersionEntity::getPublishedAt, startAt)
                    .le(NewsVersionEntity::getPublishedAt, endAt)
                    .orderByDesc(NewsVersionEntity::getPublishedAt)
                    .last("LIMIT 1"))
            .stream()
            .findFirst()
            .orElse(null);
        if (latestInRange == null) {
          newsMapper.deleteById(newsId);
          deletedNews++;
          continue;
        }
        newsMapper.update(
            null,
            new LambdaUpdateWrapper<NewsEntity>()
                .eq(NewsEntity::getId, newsId)
                .set(NewsEntity::getCurrentVersionId, latestInRange.getId()));
        updatedNews++;
      }
      return new NewsCleanupResultDto(outOfRange.size(), updatedNews, deletedNews, auditPath, true);
    });
  }

  private List<NewsVersionEntity> outOfRangeVersions(LocalDateTime startAt, LocalDateTime endAt) {
    return newsVersionMapper.selectList(
        new LambdaQueryWrapper<NewsVersionEntity>()
            .lt(NewsVersionEntity::getPublishedAt, startAt)
            .or()
            .gt(NewsVersionEntity::getPublishedAt, endAt)
            .orderByAsc(NewsVersionEntity::getPublishedAt));
  }

  private String writeAudit(List<NewsVersionEntity> versions, LocalDateTime startAt, LocalDateTime endAt) {
    try {
      Path dir = Path.of("target", "audit").toAbsolutePath().normalize();
      Files.createDirectories(dir);
      Path file = dir.resolve("news-out-of-range-"
          + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(LocalDateTime.now())
          + ".csv");
      StringBuilder builder = new StringBuilder();
      builder.append("allowed_start,allowed_end,version_id,news_id,published_at,title,original_url\n");
      for (NewsVersionEntity version : versions) {
        builder.append(csv(startAt.toString())).append(',')
            .append(csv(endAt.toString())).append(',')
            .append(version.getId()).append(',')
            .append(version.getNewsId()).append(',')
            .append(csv(String.valueOf(version.getPublishedAt()))).append(',')
            .append(csv(version.getTitle())).append(',')
            .append(csv(version.getOriginalUrl())).append('\n');
      }
      Files.writeString(file, builder.toString(), StandardCharsets.UTF_8);
      return file.toString();
    } catch (IOException error) {
      throw new IllegalStateException("Failed to write news cleanup audit.", error);
    }
  }

  private static String csv(String value) {
    String safe = value == null ? "" : value;
    return "\"" + safe.replace("\"", "\"\"") + "\"";
  }
}
