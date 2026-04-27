package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("news_versions")
public class NewsVersionEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long newsId;
  private Long crawlRunId;
  private String title;
  private String summary;
  private String coverImage;
  private String sourceUrl;
  private String originalUrl;
  private LocalDateTime publishedAt;
  private String language;
  private String category;
  private String keywordsJson;
  private String regionTagsJson;
  private String entityIdsJson;
  private Boolean isGuangxiRelated;
  private String contentHash;
  private LocalDateTime createdAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getNewsId() { return newsId; }
  public void setNewsId(Long newsId) { this.newsId = newsId; }
  public Long getCrawlRunId() { return crawlRunId; }
  public void setCrawlRunId(Long crawlRunId) { this.crawlRunId = crawlRunId; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getSummary() { return summary; }
  public void setSummary(String summary) { this.summary = summary; }
  public String getCoverImage() { return coverImage; }
  public void setCoverImage(String coverImage) { this.coverImage = coverImage; }
  public String getSourceUrl() { return sourceUrl; }
  public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
  public String getOriginalUrl() { return originalUrl; }
  public void setOriginalUrl(String originalUrl) { this.originalUrl = originalUrl; }
  public LocalDateTime getPublishedAt() { return publishedAt; }
  public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
  public String getLanguage() { return language; }
  public void setLanguage(String language) { this.language = language; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getKeywordsJson() { return keywordsJson; }
  public void setKeywordsJson(String keywordsJson) { this.keywordsJson = keywordsJson; }
  public String getRegionTagsJson() { return regionTagsJson; }
  public void setRegionTagsJson(String regionTagsJson) { this.regionTagsJson = regionTagsJson; }
  public String getEntityIdsJson() { return entityIdsJson; }
  public void setEntityIdsJson(String entityIdsJson) { this.entityIdsJson = entityIdsJson; }
  public Boolean getIsGuangxiRelated() { return isGuangxiRelated; }
  public void setIsGuangxiRelated(Boolean guangxiRelated) { isGuangxiRelated = guangxiRelated; }
  public String getContentHash() { return contentHash; }
  public void setContentHash(String contentHash) { this.contentHash = contentHash; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
