package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("dataset_snapshots")
public class DatasetSnapshotEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long crawlRunId;
  private String datasetType;
  private String payloadJson;
  private Boolean active;
  private LocalDateTime createdAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getCrawlRunId() { return crawlRunId; }
  public void setCrawlRunId(Long crawlRunId) { this.crawlRunId = crawlRunId; }
  public String getDatasetType() { return datasetType; }
  public void setDatasetType(String datasetType) { this.datasetType = datasetType; }
  public String getPayloadJson() { return payloadJson; }
  public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
  public Boolean getActive() { return active; }
  public void setActive(Boolean active) { this.active = active; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
