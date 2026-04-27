package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("crawl_runs")
public class CrawlRunEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private String runType;
  private String triggeredBy;
  private String status;
  private String coverageStatus;
  private Integer acceptedCount;
  private Integer rejectedCount;
  private LocalDateTime startedAt;
  private LocalDateTime windowStartAt;
  private LocalDateTime windowEndAt;
  private LocalDateTime finishedAt;
  private String note;
  private LocalDateTime createdAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getRunType() { return runType; }
  public void setRunType(String runType) { this.runType = runType; }
  public String getTriggeredBy() { return triggeredBy; }
  public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getCoverageStatus() { return coverageStatus; }
  public void setCoverageStatus(String coverageStatus) { this.coverageStatus = coverageStatus; }
  public Integer getAcceptedCount() { return acceptedCount; }
  public void setAcceptedCount(Integer acceptedCount) { this.acceptedCount = acceptedCount; }
  public Integer getRejectedCount() { return rejectedCount; }
  public void setRejectedCount(Integer rejectedCount) { this.rejectedCount = rejectedCount; }
  public LocalDateTime getStartedAt() { return startedAt; }
  public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
  public LocalDateTime getWindowStartAt() { return windowStartAt; }
  public void setWindowStartAt(LocalDateTime windowStartAt) { this.windowStartAt = windowStartAt; }
  public LocalDateTime getWindowEndAt() { return windowEndAt; }
  public void setWindowEndAt(LocalDateTime windowEndAt) { this.windowEndAt = windowEndAt; }
  public LocalDateTime getFinishedAt() { return finishedAt; }
  public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
  public String getNote() { return note; }
  public void setNote(String note) { this.note = note; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
