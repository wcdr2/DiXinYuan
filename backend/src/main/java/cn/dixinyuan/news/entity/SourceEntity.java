package cn.dixinyuan.news.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("sources")
public class SourceEntity {
  @TableId(type = IdType.AUTO)
  private Long id;
  private String sourceCode;
  private String name;
  private String type;
  private String siteUrl;
  private String language;
  private String trustLevel;
  private Boolean active;
  private String crawlRuleJson;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getSourceCode() { return sourceCode; }
  public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getSiteUrl() { return siteUrl; }
  public void setSiteUrl(String siteUrl) { this.siteUrl = siteUrl; }
  public String getLanguage() { return language; }
  public void setLanguage(String language) { this.language = language; }
  public String getTrustLevel() { return trustLevel; }
  public void setTrustLevel(String trustLevel) { this.trustLevel = trustLevel; }
  public Boolean getActive() { return active; }
  public void setActive(Boolean active) { this.active = active; }
  public String getCrawlRuleJson() { return crawlRuleJson; }
  public void setCrawlRuleJson(String crawlRuleJson) { this.crawlRuleJson = crawlRuleJson; }
  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
  public LocalDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
