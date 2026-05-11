package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("cleanup_audit_log")
public class CleanupAuditLogEntity {
  @TableId(type = IdType.AUTO)
  private Long id;

  private String cleanupType;
  private String criteriaJson;
  private Boolean dryRun;
  private Integer deletedNewsCount;
  private Integer deletedVersionsCount;
  private String auditReportPath;
  private LocalDateTime startedAt;
  private LocalDateTime finishedAt;
  private String status;
  private String errorMessage;
  private LocalDateTime createdAt;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getCleanupType() {
    return cleanupType;
  }

  public void setCleanupType(String cleanupType) {
    this.cleanupType = cleanupType;
  }

  public String getCriteriaJson() {
    return criteriaJson;
  }

  public void setCriteriaJson(String criteriaJson) {
    this.criteriaJson = criteriaJson;
  }

  public Boolean getDryRun() {
    return dryRun;
  }

  public void setDryRun(Boolean dryRun) {
    this.dryRun = dryRun;
  }

  public Integer getDeletedNewsCount() {
    return deletedNewsCount;
  }

  public void setDeletedNewsCount(Integer deletedNewsCount) {
    this.deletedNewsCount = deletedNewsCount;
  }

  public Integer getDeletedVersionsCount() {
    return deletedVersionsCount;
  }

  public void setDeletedVersionsCount(Integer deletedVersionsCount) {
    this.deletedVersionsCount = deletedVersionsCount;
  }

  public String getAuditReportPath() {
    return auditReportPath;
  }

  public void setAuditReportPath(String auditReportPath) {
    this.auditReportPath = auditReportPath;
  }

  public LocalDateTime getStartedAt() {
    return startedAt;
  }

  public void setStartedAt(LocalDateTime startedAt) {
    this.startedAt = startedAt;
  }

  public LocalDateTime getFinishedAt() {
    return finishedAt;
  }

  public void setFinishedAt(LocalDateTime finishedAt) {
    this.finishedAt = finishedAt;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }
}
