package cn.dixinyuan.news.dto;

import java.time.LocalDateTime;

public class ArticleRowDto {
  private String id;
  private String slug;
  private String title;
  private String summary;
  private String coverImage;
  private String sourceName;
  private String sourceUrl;
  private String originalUrl;
  private LocalDateTime publishedAt;
  private String language;
  private String category;
  private String keywordsJson;
  private String regionTagsJson;
  private Boolean isGuangxiRelated;
  private String entityIdsJson;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getSlug() { return slug; }
  public void setSlug(String slug) { this.slug = slug; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getSummary() { return summary; }
  public void setSummary(String summary) { this.summary = summary; }
  public String getCoverImage() { return coverImage; }
  public void setCoverImage(String coverImage) { this.coverImage = coverImage; }
  public String getSourceName() { return sourceName; }
  public void setSourceName(String sourceName) { this.sourceName = sourceName; }
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
  public Boolean getIsGuangxiRelated() { return isGuangxiRelated; }
  public void setIsGuangxiRelated(Boolean guangxiRelated) { isGuangxiRelated = guangxiRelated; }
  public String getEntityIdsJson() { return entityIdsJson; }
  public void setEntityIdsJson(String entityIdsJson) { this.entityIdsJson = entityIdsJson; }
}
