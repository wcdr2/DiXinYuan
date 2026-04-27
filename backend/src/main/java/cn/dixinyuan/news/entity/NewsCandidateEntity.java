package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("news_candidates")
public class NewsCandidateEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long crawlRunId;
  private Long sourceId;
  private String sourceCode;
  private String originalUrl;
  private String canonicalUrl;
  private String rawTitle;
  private String rawSummary;
  private String cleanedTitle;
  private String cleanedSummary;
  private LocalDateTime publishedAt;
  private String language;
  private String category;
  private String keywordsJson;
  private String regionTagsJson;
  private Boolean isGuangxiRelated;
  private String reviewStatus;
  private String rejectReason;
  private String contentHash;
  private String rawPayloadJson;
  private LocalDateTime createdAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getCrawlRunId() { return crawlRunId; }
  public void setCrawlRunId(Long crawlRunId) { this.crawlRunId = crawlRunId; }
  public Long getSourceId() { return sourceId; }
  public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
  public String getSourceCode() { return sourceCode; }
  public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }
  public String getOriginalUrl() { return originalUrl; }
  public void setOriginalUrl(String originalUrl) { this.originalUrl = originalUrl; }
  public String getCanonicalUrl() { return canonicalUrl; }
  public void setCanonicalUrl(String canonicalUrl) { this.canonicalUrl = canonicalUrl; }
  public String getRawTitle() { return rawTitle; }
  public void setRawTitle(String rawTitle) { this.rawTitle = rawTitle; }
  public String getRawSummary() { return rawSummary; }
  public void setRawSummary(String rawSummary) { this.rawSummary = rawSummary; }
  public String getCleanedTitle() { return cleanedTitle; }
  public void setCleanedTitle(String cleanedTitle) { this.cleanedTitle = cleanedTitle; }
  public String getCleanedSummary() { return cleanedSummary; }
  public void setCleanedSummary(String cleanedSummary) { this.cleanedSummary = cleanedSummary; }
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
  public String getReviewStatus() { return reviewStatus; }
  public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }
  public String getRejectReason() { return rejectReason; }
  public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
  public String getContentHash() { return contentHash; }
  public void setContentHash(String contentHash) { this.contentHash = contentHash; }
  public String getRawPayloadJson() { return rawPayloadJson; }
  public void setRawPayloadJson(String rawPayloadJson) { this.rawPayloadJson = rawPayloadJson; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
