# API 文档

## 内部抓取 API

所有内部 API 需要在请求头中包含 `X-Internal-Token`，值为 `application.yml` 中配置的 `app.internal-token`。

### 质量审计与严格验收

```http
POST /api/v1/internal/crawl/quality-audit
X-Internal-Token: <your-token>
Content-Type: application/json

{
  "verifyUrls": "true",
  "urlCheckLimit": "1000",
  "targetUniqueNews": "694"
}
```

该接口生成 `target/audit/quality-audit-{timestamp}.csv`，并返回唯一新闻验收结果。`qualifiedUniqueNews` 是合格口径，必须同时满足白名单来源、来源域名、日期范围、详情页可访问、摘要来自正文、正文强相关、摘要硬词等规则。

```json
{
  "targetUniqueNews": 694,
  "totalUniqueNews": 694,
  "qualifiedUniqueNews": 694,
  "missingToTarget": 0,
  "sourceNotWhitelistedCount": 0,
  "sourceUrlDomainMismatchCount": 0,
  "dateOutOfRangeCount": 0,
  "notDetailUrlCount": 0,
  "inaccessibleUrlCount": 0,
  "bodyMissingCount": 0,
  "summaryNotFromBodyCount": 0,
  "summaryRequiredTermMissingCount": 0,
  "bodyRelevanceFailedCount": 0,
  "zhCount": 390,
  "guangxiRelatedCount": 89,
  "verifiedAccessibleCurrentCount": 694,
  "urlCheckedCount": 694,
  "urlAccessibleCount": 694,
  "urlAccessibilityRate": 1.0,
  "sourceWhitelistCoverageRate": 1.0,
  "auditReportPath": "target/audit/quality-audit-20260509.csv"
}
```

2026-05-09 本地直接审计脚本 `scripts/audit-strict-news.js` 的结果为 `total=694`、`qualifiedUniqueNews=694`，日期、来源、来源域名、详情页、URL、正文、摘要和正文强相关违规均为 `0`；中文 `390` 条，广西相关 `89` 条。新华网、人民网、央视网、科技日报、中国新闻网、中国政府网已从来源名单移除，其新闻已物理删除。最终实时 URL 校验发现 5 条不可访问记录，已按规则物理删除；随后删除了 2 条分页列表页误入库记录。

### 回溯补量

```http
POST /api/v1/internal/crawl/backfill-until-target
X-Internal-Token: <your-token>
Content-Type: application/json

{
  "start": "2024-01-01T00:00:00",
  "end": "2026-05-02T23:59:59",
  "monthsPerWindow": "3",
  "maxWindows": "16",
  "targetUniqueNews": "1000"
}
```

服务会按时间窗口调用现有抓取链路，并在每个窗口后执行质量审计。补量只使用允许的领域政府、高校、科研、协会、企业等来源，按广西、国内优先；达到 `targetUniqueNews` 或可用来源耗尽后停止。

### 审核硬门槛

入库审核由 `NewsReviewService` 强制执行：

- 来源必须启用且绑定 `whitelistEntityId`。
- URL 必须是详情页，并通过 `UrlVerificationService` 的 HTTP 2xx/3xx 检查。
- 发布时间必须在 `2024-01-01` 到当前时间内。
- 主题相关性必须通过严格规则；配置里的 `requireKeywordMatch:false` 不再具有放行效果。
- 摘要必须来自正文，是 `body_text` 的子串，并天然包含至少一个硬词：`地球信息科学`、`遥感`、`测绘`、`GIS`、`北斗`、`空天信息`、`实景三维`、`时空智能`、`自然资源数字化`、`低空遥感`、`数字孪生`、`智慧城市`。清洗阶段不得追加 `关键词：<硬词>`；无正文证据或正文不强相关则拒绝入库。

### 新闻相关性分析

#### 分析关键词分布

```http
POST /api/v1/internal/crawl/analyze-relevance
X-Internal-Token: <your-token>
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
    "北斗": 50,
    "实景三维": 40,
    "时空智能": 30,
    "自然资源": 25,
    "低空遥感": 20,
    "数字孪生": 15,
    "智慧城市": 12,
    "空天信息": 8
  },
  "newsWithoutCoreKeywords": 200,
  "newsWithOneKeyword": 150,
  "newsWithTwoOrMoreKeywords": 410
}
```

#### 预览删除

```http
POST /api/v1/internal/crawl/preview-deletion?dryRun=true
X-Internal-Token: <your-token>
```

**查询参数：**

- `dryRun` (boolean, 可选): 是否为预览模式，默认 `true`

**响应示例：**

```json
{
  "totalNewsToDelete": 200,
  "totalVersionsToDelete": 250,
  "sampleNews": [
    {
      "newsId": 123,
      "newsCode": "news-123",
      "versionId": 456,
      "title": "学院年度总结会议",
      "summary": "会议通知内容",
      "publishedAt": "2024-01-15T10:00:00",
      "sourceName": "某大学官网",
      "matchedCoreKeywords": [],
      "matchedEntities": [],
      "willDelete": true
    }
  ],
  "auditReportPath": "/path/to/audit/report.csv"
}
```

#### 执行清理

```http
POST /api/v1/internal/crawl/cleanup-by-relevance?dryRun=false&batchSize=100
X-Internal-Token: <your-token>
```

**查询参数：**

- `dryRun` (boolean, 可选): 是否为预览模式，默认 `false`
- `batchSize` (int, 可选): 批处理大小，默认 `100`

**响应示例：**

```json
{
  "deletedNewsCount": 200,
  "deletedVersionsCount": 250,
  "auditReportPath": "/path/to/audit/report.csv",
  "dryRun": false,
  "message": "成功删除 200 条新闻（250 个版本）"
}
```

#### 全规则合规清理

最终更新使用全规则清理，而不是只按相关性清理。该接口会覆盖日期、来源白名单、来源域名、详情页、URL 状态、摘要来自正文、摘要硬词和正文强相关性。

```http
POST /api/v1/internal/crawl/cleanup-noncompliant
X-Internal-Token: <your-token>
Content-Type: application/json

{
  "dryRun": "true",
  "verifyUrls": "false"
}
```

`dryRun=true` 只生成 `target/audit/noncompliant-cleanup-{timestamp}.csv`，不修改数据；`dryRun=false` 会物理删除不合规新闻版本，并在存在合规历史版本时提升合规版本为当前版本。`verifyUrls=true` 会实时 GET 校验 URL，耗时较长，建议在最终验收审计中使用。

后端进程不可用时，可用同口径数据库脚本执行：

```powershell
node scripts\cleanup-noncompliant-strict.js --dryRun
node scripts\cleanup-noncompliant-strict.js
node scripts\audit-strict-news.js
```

### 严格相关性规则

新闻必须满足以下条件之一才被认为是相关的：

1. **至少2个核心关键词**：标题、摘要或关键词中包含至少2个核心关键词
2. **1个核心关键词 + 1个实体名称**：包含至少1个核心关键词和1个实体白名单中的名称

#### 核心关键词列表

中文关键词：
- 地球信息科学
- 地理信息
- 测绘
- 遥感
- 北斗
- 空天信息
- 实景三维
- 时空智能
- 自然资源数字化
- 低空遥感
- 数字孪生
- 智慧城市

英文关键词（使用词边界匹配）：
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

#### 词边界匹配

- **英文关键词**：使用正则表达式 `\b(keyword)\b` 进行词边界匹配，避免误匹配（如 "GIS" 不会匹配 "register"）
- **中文关键词**：直接使用 `contains` 匹配

### 审计日志

所有删除操作都会记录到 `cleanup_audit_log` 表中，包括：

- 操作类型（`delete_news`, `delete_version`）
- 新闻ID和版本ID
- 删除原因
- 删除时间
- 操作者

同时会生成 CSV 格式的审计报告，保存在 `target/audit/deletion-audit-{timestamp}.csv`。

## 公共 API

### 新闻列表

```http
GET /api/v1/news?query=遥感&limit=200
```

兼容列表接口仍返回数组，默认最多返回 `2000` 条。新闻页优先使用分页接口：

```http
GET /api/v1/news/page?page=1&pageSize=24&query=遥感&category=technology&guangxi=only
```

**查询参数：**

- `limit` (int, 可选): 兼容列表接口返回条数，默认 `2000`，最大 `2000`。
- 分页接口中的 `page` 从 `1` 开始，`pageSize` 默认 `24`，最大 `60`。
- `query` 匹配标题、摘要、来源、关键词和地区标签。
- `region` 支持前端地图区域 id，例如 `nanning`、`guilin`，后端会映射到数据库地区标签。

**分页接口响应示例：**

```json
{
  "content": [
    {
      "id": "news-123",
      "slug": "news-slug",
      "title": "新闻标题",
      "summary": "新闻摘要",
      "coverImage": "https://example.com/image.jpg",
      "publishedAt": "2024-01-15T10:00:00",
      "language": "zh",
      "category": "政策",
      "keywords": ["地理信息", "测绘"],
      "regionTags": ["广西"],
      "guangxiRelated": true
    }
  ],
  "totalElements": 694,
  "pageSize": 24,
  "page": 1,
  "totalPages": 29,
  "hasPrevious": false,
  "hasNext": true
}
```

### 新闻详情

```http
GET /api/v1/news/{id}
```

**路径参数：**

- `id` (string): 新闻ID

**响应示例：**

```json
{
  "id": "news-123",
  "slug": "news-slug",
  "title": "新闻标题",
  "summary": "新闻摘要",
  "coverImage": "https://example.com/image.jpg",
  "sourceUrl": "https://example.com/news",
  "originalUrl": "https://example.com/original",
  "canonicalUrl": "https://example.com/canonical",
  "publishedAt": "2024-01-15T10:00:00",
  "language": "zh",
  "category": "政策",
  "keywords": ["地理信息", "测绘"],
  "regionTags": ["广西"],
  "guangxiRelated": true,
  "entityIds": ["entity-1", "entity-2"],
  "contentHash": "abc123",
  "rawPayload": {}
}
```

### 新闻来源列表

```http
GET /api/v1/sources?page=0&size=20
```

**查询参数：**

- `page` (int, 可选): 页码，从0开始，默认 `0`
- `size` (int, 可选): 每页大小，默认 `20`

**响应示例：**

```json
{
  "content": [
    {
      "id": 1,
      "sourceCode": "source-code",
      "name": "来源名称",
      "category": "政府",
      "websiteUrl": "https://example.com",
      "rssUrl": "https://example.com/rss",
      "trustLevel": 5,
      "enabled": true
    }
  ],
  "totalElements": 200,
  "totalPages": 10,
  "number": 0,
  "size": 20
}
```
