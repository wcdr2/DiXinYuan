package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("crawl_run_sources")
public class CrawlRunSourceEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long crawlRunId;
  private Long sourceId;
  private LocalDateTime windowStartAt;
  private LocalDateTime windowEndAt;
  private String status;
  private Integer fetchedCount;
  private Integer candidateCount;
  private Integer acceptedCount;
  private Integer rejectedCount;
  private Integer publishedCount;
  private Integer duplicateCount;
  private LocalDateTime earliestPublishedAt;
  private LocalDateTime latestPublishedAt;
  private String coverageStatus;
  private String errorMessage;
  private String note;
  private LocalDateTime startedAt;
  private LocalDateTime finishedAt;
  private LocalDateTime createdAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getCrawlRunId() { return crawlRunId; }
  public void setCrawlRunId(Long crawlRunId) { this.crawlRunId = crawlRunId; }
  public Long getSourceId() { return sourceId; }
  public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
  public LocalDateTime getWindowStartAt() { return windowStartAt; }
  public void setWindowStartAt(LocalDateTime windowStartAt) { this.windowStartAt = windowStartAt; }
  public LocalDateTime getWindowEndAt() { return windowEndAt; }
  public void setWindowEndAt(LocalDateTime windowEndAt) { this.windowEndAt = windowEndAt; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Integer getFetchedCount() { return fetchedCount; }
  public void setFetchedCount(Integer fetchedCount) { this.fetchedCount = fetchedCount; }
  public Integer getCandidateCount() { return candidateCount; }
  public void setCandidateCount(Integer candidateCount) { this.candidateCount = candidateCount; }
  public Integer getAcceptedCount() { return acceptedCount; }
  public void setAcceptedCount(Integer acceptedCount) { this.acceptedCount = acceptedCount; }
  public Integer getRejectedCount() { return rejectedCount; }
  public void setRejectedCount(Integer rejectedCount) { this.rejectedCount = rejectedCount; }
  public Integer getPublishedCount() { return publishedCount; }
  public void setPublishedCount(Integer publishedCount) { this.publishedCount = publishedCount; }
  public Integer getDuplicateCount() { return duplicateCount; }
  public void setDuplicateCount(Integer duplicateCount) { this.duplicateCount = duplicateCount; }
  public LocalDateTime getEarliestPublishedAt() { return earliestPublishedAt; }
  public void setEarliestPublishedAt(LocalDateTime earliestPublishedAt) { this.earliestPublishedAt = earliestPublishedAt; }
  public LocalDateTime getLatestPublishedAt() { return latestPublishedAt; }
  public void setLatestPublishedAt(LocalDateTime latestPublishedAt) { this.latestPublishedAt = latestPublishedAt; }
  public String getCoverageStatus() { return coverageStatus; }
  public void setCoverageStatus(String coverageStatus) { this.coverageStatus = coverageStatus; }
  public String getErrorMessage() { return errorMessage; }
  public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
  public String getNote() { return note; }
  public void setNote(String note) { this.note = note; }
  public LocalDateTime getStartedAt() { return startedAt; }
  public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
  public LocalDateTime getFinishedAt() { return finishedAt; }
  public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
