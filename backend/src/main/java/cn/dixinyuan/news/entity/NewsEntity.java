package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("news")
public class NewsEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private String newsCode;
  private Long sourceId;
  private String canonicalUrl;
  private String slug;
  private Long currentVersionId;
  private LocalDateTime firstSeenAt;
  private LocalDateTime lastSeenAt;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getNewsCode() { return newsCode; }
  public void setNewsCode(String newsCode) { this.newsCode = newsCode; }
  public Long getSourceId() { return sourceId; }
  public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
  public String getCanonicalUrl() { return canonicalUrl; }
  public void setCanonicalUrl(String canonicalUrl) { this.canonicalUrl = canonicalUrl; }
  public String getSlug() { return slug; }
  public void setSlug(String slug) { this.slug = slug; }
  public Long getCurrentVersionId() { return currentVersionId; }
  public void setCurrentVersionId(Long currentVersionId) { this.currentVersionId = currentVersionId; }
  public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
  public void setFirstSeenAt(LocalDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }
  public LocalDateTime getLastSeenAt() { return lastSeenAt; }
  public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
  public LocalDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
