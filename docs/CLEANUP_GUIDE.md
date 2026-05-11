# 新闻清理指南

本指南介绍如何使用全规则合规清理和严格相关性规则清理新闻。

## 概述

新闻清理功能允许你删除不符合入库规则的新闻，确保数据库中只保留与地球信息科学、遥感、测绘、GIS、北斗等领域高度相关且来源、日期、URL、摘要均合规的新闻。

## 全规则合规口径

最终验收使用 `cleanup-noncompliant` 和 `quality-audit` 的同一套规则：

- 来源启用，且 `whitelistEntityId` 命中实体白名单。
- 发布时间在 `2024-01-01 00:00:00` 到当前时间之间。
- `original_url` 是具体详情页，且 URL 状态为 `accessible`；最终验收可开启实时 URL 校验。
- 摘要必须来自正文，且正文内容强相关。
- 主题相关性通过严格规则，党建、招聘、普通会议通知等低相关内容删除。
- 摘要包含至少一个硬词：`地球信息科学`、`遥感`、`测绘`、`GIS`、`北斗`、`空天信息`、`实景三维`、`时空智能`、`自然资源数字化`、`低空遥感`、`数字孪生`、`智慧城市`。

清洗阶段必须从正文段落中选择摘要，不得追加 `关键词：<硬词>`。旧版本不会被直接回写修摘要；同一 URL 再次抓取通过新规则时，会生成新的当前版本，仍不合规的旧当前新闻按清理规则删除。

2026-05-09 本地执行结果：按用户要求不做数据库备份，直接物理删除不合规新闻；新华网、人民网、央视网、科技日报、中国新闻网、中国政府网来源新闻已删除。当前 `total=694`、`qualifiedUniqueNews=694`，日期、来源、来源域名、详情页、URL、正文、摘要来源和正文强相关违规均为 `0`；中文 `390` 条，广西相关 `89` 条。最终实时 URL 校验删除了 5 条不可访问记录，并删除 2 条分页列表页误入库记录；随后停止继续补抓。

## 严格相关性规则

新闻必须满足以下条件之一才被认为是相关的：

### 规则1：至少2个核心关键词

标题、摘要或关键词中包含至少2个核心关键词。

**示例：**
- ✅ "遥感技术在测绘领域的应用" - 包含"遥感"和"测绘"
- ✅ "GIS与北斗系统的集成研究" - 包含"GIS"和"北斗"
- ❌ "测绘学会年度总结会议" - 只包含"测绘"

### 规则2：1个核心关键词 + 1个实体名称

包含至少1个核心关键词和1个实体白名单中的名称。

**示例：**
- ✅ "自然资源部发布地理信息新政策" - 包含"地理信息"和实体"自然资源部"
- ✅ "中国测绘科学研究院遥感技术突破" - 包含"遥感"和实体"中国测绘科学研究院"
- ❌ "广西测绘学会年度会议" - 只包含实体"广西测绘学会"，没有核心关键词

## 核心关键词列表

### 中文关键词
- 地理信息
- 测绘
- 遥感
- 北斗
- 实景三维
- 时空智能
- 自然资源
- 低空遥感
- 数字孪生
- 智慧城市
- 空天信息

### 英文关键词
- GIS
- GPS
- RS (Remote Sensing)
- LiDAR
- SAR
- UAV
- BDS (BeiDou)
- GNSS
- DEM
- DSM

**注意：** 英文关键词使用词边界匹配，避免误匹配（如"GIS"不会匹配"register"）。

## 清理流程

### 步骤1：分析关键词分布

在执行清理之前，先分析数据库中的关键词分布，了解有多少新闻会被删除。

```bash
curl -X POST http://localhost:8080/api/v1/internal/crawl/analyze-relevance \
  -H "X-Internal-Token: your-token-here"
```

**响应示例：**

```json
{
  "totalNews": 694,
  "coreKeywordDistribution": {
    "地理信息": 120,
    "测绘": 95,
    "遥感": 80,
    "GIS": 65,
    "北斗": 50
  },
  "newsWithoutCoreKeywords": 200,
  "newsWithOneKeyword": 150,
  "newsWithTwoOrMoreKeywords": 410
}
```

**解读：**
- 总共694条新闻
- 200条没有核心关键词（将被删除）
- 150条只有1个核心关键词（可能被删除，取决于是否有实体名称）
- 410条有2个或更多核心关键词（将被保留）

### 步骤2：预览删除

在真正删除之前，先预览哪些新闻会被删除。最终更新优先使用全规则接口：

```bash
curl -X POST http://localhost:8080/api/v1/internal/crawl/cleanup-noncompliant \
  -H "X-Internal-Token: your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":"true","verifyUrls":"false"}'
```

**响应示例：**

```json
{
  "deletedNewsCount": 200,
  "deletedVersionsCount": 250,
  "updatedNewsCount": 0,
  "auditReportPath": "target/audit/noncompliant-cleanup-20260505120000.csv"
}
```

**审计报告：**

预览会生成一个CSV格式的审计报告，包含所有将被删除的新闻的详细信息：

```csv
news_id,news_code,version_id,title,summary,published_at,source_name,original_url,reasons,will_delete
123,news-123,456,"学院年度总结会议","会议通知内容",2024-01-15 10:00:00,"某大学官网",https://example.test/info/123.htm,"summary_required_term_missing;keyword_not_matched",true
```

### 步骤3：执行清理

确认预览结果无误后，执行真正的删除操作。本次更新口径为直接物理删除，不生成数据库备份。

```bash
curl -X POST http://localhost:8080/api/v1/internal/crawl/cleanup-noncompliant \
  -H "X-Internal-Token: your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":"false","verifyUrls":"false"}'
```

**参数说明：**
- `dryRun=false`: 执行真正的删除（默认为true，即预览模式）
- `verifyUrls=false`: 使用已入库 URL 状态；最终质量审计再使用 `verifyUrls=true` 实时校验
- 脚本版 `cleanup-noncompliant-strict.js` 带有 URL 校验熔断：如果实时校验把大部分此前已标记 `accessible` 的记录都判成不可访问，默认中止删除，避免网络或校验器异常导致误删；只有人工确认后才可使用 `--allow-mass-delete` 覆盖。

如果后端进程不可用，可使用同口径脚本：

```powershell
node scripts\cleanup-noncompliant-strict.js --dryRun
node scripts\cleanup-noncompliant-strict.js
node scripts\audit-strict-news.js
$env:URL_VERIFY_CONCURRENCY='20'; node scripts\check-url-accessibility.js
node scripts\refresh-db-snapshots.js
```

**响应示例：**

```json
{
  "deletedNewsCount": 200,
  "deletedVersionsCount": 250,
  "updatedNewsCount": 3,
  "auditReportPath": "target/audit/noncompliant-cleanup-20260505120000.csv",
  "dryRun": false,
  "message": "成功删除 200 条新闻（250 个版本）"
}
```

### 步骤4：验证结果

删除完成后，验证数据库中的新闻数量和内容。

```bash
# 查询新闻总数
curl http://localhost:8080/api/v1/news?page=0&size=1

# 严格质量审计
curl -X POST http://localhost:8080/api/v1/internal/crawl/quality-audit \
  -H "X-Internal-Token: your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"verifyUrls":"true","urlCheckLimit":"1000","targetUniqueNews":"1000"}'

# 查看审计日志
mysql -u root -p gx_geo_news -e "SELECT * FROM cleanup_audit_log ORDER BY started_at DESC LIMIT 10;"
```

## 审计日志

所有删除操作都会记录到 `cleanup_audit_log` 表中，包括：

- 操作类型（`delete_news`, `delete_version`）
- 新闻ID和版本ID
- 删除原因
- 删除时间
- 操作者

**查询审计日志：**

```sql
SELECT
    cleanup_type,
    criteria_json,
    deleted_news_count,
    deleted_versions_count,
    audit_report_path,
    started_at,
    finished_at,
    status
FROM cleanup_audit_log
WHERE started_at >= '2026-05-09 00:00:00'
ORDER BY started_at DESC;
```

## 删除不可撤销

本次清理口径是不生成数据库备份并直接物理删除。审计 CSV 和 `cleanup_audit_log` 只用于说明删除原因，不能用于恢复数据。

## 配置选项

严格相关性规则的配置位于 `backend/src/main/resources/application.yml`：

```yaml
app:
  strict-relevance:
    enabled: true
    min-core-keyword-matches: 2
    allow-entity-substitution: true
    use-word-boundary: true
    core-keywords:
      - name: "地理信息"
        aliases: ["Geographic Information", "Geoinformation", "GI"]
      - name: "测绘"
        aliases: ["Surveying", "Mapping", "Surveying and Mapping"]
      # ... 更多关键词
```

**配置说明：**
- `enabled`: 是否启用严格相关性检查
- `min-core-keyword-matches`: 最少核心关键词匹配数（默认2）
- `allow-entity-substitution`: 是否允许实体名称替代1个核心关键词（默认true）
- `use-word-boundary`: 是否使用词边界匹配（默认true）
- 摘要硬词列表由 `NewsCleaningService.REQUIRED_SUMMARY_TERMS` 固化，质量审计、清理、公开查询使用同一口径。

## 常见问题

### Q: 如何调整相关性规则？

A: 修改 `application.yml` 中的 `app.strict-relevance` 配置，然后重启应用。

### Q: 如何查看哪些新闻会被删除？

A: 使用预览API（`dryRun=true`）并查看生成的CSV审计报告。

### Q: 删除操作可以撤销吗？

A: 本次清理口径下删除操作不可撤销；如需避免删除，只能先使用 `dryRun=true` 预览并人工确认。

### Q: 如何只删除特定来源的新闻？

A: 当前API不支持按来源过滤。如需此功能，可以修改 `NewsCleanupService.cleanupByStrictRelevance()` 方法添加来源过滤。

### Q: 清理操作会影响正在运行的抓取任务吗？

A: 清理操作使用事务保护，不会影响正在运行的抓取任务。但建议在抓取任务完成后执行清理。

## 最佳实践

1. **定期分析**：每周或每月分析一次关键词分布，了解数据质量
2. **先预览后删除**：始终先使用 `dryRun=true` 预览，确认无误后再执行删除
3. **审查审计报告**：仔细审查 CSV 审计报告，确保不会误删重要新闻
4. **小批量测试**：首次使用时，先用小的 `batchSize` 测试，确认无误后再增大
5. **保留审计日志**：定期导出审计日志，用于长期审计和分析

## 技术细节

### 词边界匹配

英文关键词使用正则表达式 `\b(keyword)\b` 进行词边界匹配：

```java
Pattern pattern = Pattern.compile("\\b" + keyword + "\\b", Pattern.CASE_INSENSITIVE);
Matcher matcher = pattern.matcher(text);
return matcher.find();
```

中文关键词直接使用 `contains` 匹配：

```java
return text.contains(keyword);
```

### 事务管理

清理操作使用 Spring 的 `@Transactional` 注解进行事务管理：

```java
@Transactional(
    isolation = Isolation.READ_COMMITTED,
    propagation = Propagation.REQUIRED,
    rollbackFor = Exception.class,
    timeout = 3600)
public StrictCleanupResult cleanupByStrictRelevance(
    StrictRelevanceCriteria criteria, boolean dryRun) {
  // ...
  if (dryRun) {
    throw new DryRunRollbackException(result);
  }
  return result;
}
```

在 `dryRun` 模式下，抛出 `DryRunRollbackException` 触发事务回滚，确保数据不会被真正删除。

### 批处理

为了避免一次性加载过多数据到内存，清理操作使用批处理：

```java
Page<NewsEntity> page = new Page<>(currentPage, batchSize);
Page<NewsEntity> newsPage = newsMapper.selectPage(page, null);
```

每次处理 `batchSize` 条新闻，处理完后再加载下一批。
