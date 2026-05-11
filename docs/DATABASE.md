# 数据库文档

## 数据库架构

### 核心表

#### sources - 新闻来源

存储所有新闻来源的配置信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| source_code | VARCHAR(100) | 来源代码，唯一 |
| name | VARCHAR(255) | 来源名称 |
| category | VARCHAR(50) | 类别（政府、协会、科研、高校、企业、专业国际机构等；综合媒体/门户源不再准入） |
| website_url | VARCHAR(500) | 官网URL |
| rss_url | VARCHAR(500) | RSS订阅URL |
| trust_level | INT | 信任等级（1-5） |
| enabled | BOOLEAN | 是否启用 |
| crawl_rule_json | TEXT | 抓取规则JSON |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引：**
- `uk_sources_source_code`: 唯一索引 (source_code)
- `idx_sources_category`: 普通索引 (category)
- `idx_sources_enabled`: 普通索引 (enabled)

#### news - 新闻主表

存储新闻的基本信息，每条新闻可以有多个版本。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| news_code | VARCHAR(100) | 新闻代码，唯一 |
| slug | VARCHAR(255) | URL友好的标识符 |
| source_id | BIGINT | 来源ID，外键 -> sources.id |
| current_version_id | BIGINT | 当前版本ID，外键 -> news_versions.id |
| first_seen_at | DATETIME | 首次发现时间 |
| last_updated_at | DATETIME | 最后更新时间 |
| version_count | INT | 版本数量 |

**索引：**
- `uk_news_news_code`: 唯一索引 (news_code)
- `idx_news_source_id`: 普通索引 (source_id)
- `idx_news_first_seen_at`: 普通索引 (first_seen_at)

#### news_versions - 新闻版本

存储新闻的所有版本，支持内容变更追踪。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| news_id | BIGINT | 新闻ID，外键 -> news.id |
| title | VARCHAR(500) | 标题 |
| summary | TEXT | 摘要 |
| cover_image | VARCHAR(500) | 封面图片URL |
| source_url | VARCHAR(500) | 来源URL |
| original_url | VARCHAR(500) | 原始URL |
| canonical_url | VARCHAR(500) | 规范URL |
| published_at | DATETIME | 发布时间 |
| language | VARCHAR(10) | 语言（zh, en） |
| category | VARCHAR(50) | 分类 |
| keywords_json | TEXT | 关键词JSON数组 |
| region_tags_json | TEXT | 地区标签JSON数组 |
| guangxi_related | BOOLEAN | 是否与广西相关 |
| entity_ids_json | TEXT | 实体ID JSON数组 |
| content_hash | VARCHAR(64) | 内容哈希（用于去重） |
| raw_payload_json | TEXT | 原始数据JSON |
| created_at | DATETIME | 创建时间 |

**索引：**
- `idx_news_versions_news_id`: 普通索引 (news_id)
- `idx_news_versions_content_hash`: 普通索引 (content_hash)
- `idx_news_versions_published_at`: 普通索引 (published_at)

#### crawl_logs - 抓取日志

记录每次抓取任务的执行情况。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| source_id | BIGINT | 来源ID，外键 -> sources.id |
| started_at | DATETIME | 开始时间 |
| finished_at | DATETIME | 结束时间 |
| status | VARCHAR(20) | 状态（success, failed, partial） |
| items_found | INT | 发现的条目数 |
| items_new | INT | 新增的条目数 |
| items_updated | INT | 更新的条目数 |
| items_skipped | INT | 跳过的条目数 |
| error_message | TEXT | 错误信息 |

**索引：**
- `idx_crawl_logs_source_id`: 普通索引 (source_id)
- `idx_crawl_logs_started_at`: 普通索引 (started_at)

#### cleanup_audit_log - 清理审计日志

记录所有新闻清理操作，用于审计和回溯。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| cleanup_type | VARCHAR(40) | 清理类型，例如 `strict_relevance`、`noncompliant` |
| criteria_json | JSON | 本次清理使用的规则快照 |
| dry_run | BOOLEAN | 是否预览 |
| deleted_news_count | INT | 删除新闻数 |
| deleted_versions_count | INT | 删除版本数 |
| audit_report_path | VARCHAR(512) | CSV 审计报告路径 |
| started_at | DATETIME | 开始时间 |
| finished_at | DATETIME | 结束时间 |
| status | VARCHAR(30) | `preview`、`completed`、`failed` 等 |
| error_message | TEXT | 失败信息 |

**索引：**
- `idx_cleanup_audit_log_type`: 普通索引 (cleanup_type)
- `idx_cleanup_audit_log_started_at`: 普通索引 (started_at)

## 数据库迁移

项目使用 Flyway 进行数据库版本管理，迁移脚本位于 `backend/src/main/resources/db/migration/`。

### 当前准入与审核字段

从 `V4__add_source_whitelist_and_url_verification.sql` 开始，入库质量规则有显式字段支撑：

- `sources.whitelist_entity_id`: 启用来源必须绑定到 `entity-whitelist.json` 中的机构实体。为空的来源会在来源同步时被停用。
- `news_versions.url_verified_at`: 当前版本 URL 最近一次通过入库审核的验证时间。
- `news_versions.url_status`: URL 状态，入库成功写入 `accessible`，迁移前旧数据默认为 `unknown`。
- `news_versions.final_url`: URL 验证后的最终跳转地址。
- `news_versions.summary`: 最终合格新闻的摘要必须包含摘要硬词之一，且必须是正文子串。
- `news_versions.body_text`: 规范化正文证据。摘要来源、正文强相关、清理审计都依赖该字段；缺失正文的当前版本不合规。

验收时以 `news` 当前版本唯一计数，不能用候选表或版本表代替。

### 迁移历史

- **V1__init_schema.sql**: 初始化数据库架构，创建 sources, news, news_versions, crawl_logs 表
- **V2__add_trust_level.sql**: 为 sources 表添加 trust_level 字段
- **V3__add_cleanup_audit_log.sql**: 创建 cleanup_audit_log 表，用于记录清理操作
- **V4__add_source_whitelist_and_url_verification.sql**: 增加来源白名单绑定和 URL 验证状态字段
- **V5__add_news_body_text.sql**: 为 `news_versions` 增加 `body_text`，保存规范化正文证据

### 严格验收 SQL

```sql
SELECT COUNT(*) AS qualified_unique_news
FROM news n
JOIN news_versions v ON n.current_version_id = v.id
JOIN sources s ON n.source_id = s.id
WHERE s.active = 1
  AND s.whitelist_entity_id IS NOT NULL
  AND s.whitelist_entity_id <> ''
  AND v.published_at BETWEEN '2024-01-01 00:00:00' AND NOW()
  AND v.url_status = 'accessible'
  AND v.body_text IS NOT NULL
  AND v.body_text <> ''
  AND INSTR(v.body_text, v.summary) > 0
  AND (
    v.summary LIKE '%地球信息科学%'
    OR v.summary LIKE '%遥感%'
    OR v.summary LIKE '%测绘%'
    OR v.summary LIKE '%GIS%'
    OR v.summary LIKE '%北斗%'
    OR v.summary LIKE '%空天信息%'
    OR v.summary LIKE '%实景三维%'
    OR v.summary LIKE '%时空智能%'
    OR v.summary LIKE '%自然资源数字化%'
    OR v.summary LIKE '%低空遥感%'
    OR v.summary LIKE '%数字孪生%'
    OR v.summary LIKE '%智慧城市%'
  );
```

严格主题相关性和实时 URL 可访问性需要通过应用侧 `quality-audit` 接口计算，因为它依赖核心关键词、词边界匹配、实体白名单和 HTTP 校验。

2026-05-09 本地清理后的数据库验收结果：移除新华网、人民网、央视网、科技日报、中国新闻网、中国政府网后，`news` 当前版本总数 `694`，严格脚本 `qualifiedUniqueNews=694`，日期、来源、来源域名、详情页、URL 状态、正文、摘要来源和正文强相关违规均为 `0`；中文 `390` 条，广西相关 `89` 条。按用户要求停止继续补抓，最终实时 URL 校验删除了 5 条不可访问记录，并删除 2 条分页列表页误入库记录。

### 执行迁移

迁移会在应用启动时自动执行。如果需要手动执行：

```bash
mvn flyway:migrate
```

查看迁移状态：

```bash
mvn flyway:info
```

## 数据一致性

### 外键约束

- `news.source_id` -> `sources.id`
- `news.current_version_id` -> `news_versions.id`
- `news_versions.news_id` -> `news.id`
- `crawl_logs.source_id` -> `sources.id`

### 级联删除

删除新闻时，需要先删除所有版本：

```java
// 1. 删除所有版本
newsVersionMapper.delete(
    new LambdaQueryWrapper<NewsVersionEntity>()
        .eq(NewsVersionEntity::getNewsId, newsId));

// 2. 删除新闻主记录
newsMapper.deleteById(newsId);
```

### 内容去重

使用 `content_hash` 字段进行内容去重：

```java
String contentHash = DigestUtils.sha256Hex(title + summary);
NewsVersionEntity existing = newsVersionMapper.selectOne(
    new LambdaQueryWrapper<NewsVersionEntity>()
        .eq(NewsVersionEntity::getNewsId, newsId)
        .eq(NewsVersionEntity::getContentHash, contentHash));
```

## 查询优化

### 分页查询

使用 MyBatis-Plus 的分页插件：

```java
Page<NewsEntity> page = new Page<>(pageNum, pageSize);
Page<NewsEntity> result = newsMapper.selectPage(page,
    new LambdaQueryWrapper<NewsEntity>()
        .orderByDesc(NewsEntity::getFirstSeenAt));
```

### 关联查询

查询新闻及其当前版本：

```java
@Select("SELECT n.*, nv.* FROM news n " +
        "LEFT JOIN news_versions nv ON n.current_version_id = nv.id " +
        "WHERE n.id = #{newsId}")
NewsWithVersionDto selectNewsWithVersion(@Param("newsId") Long newsId);
```

### 索引使用建议

- 按时间范围查询：使用 `idx_news_versions_published_at`
- 按来源查询：使用 `idx_news_source_id`
- 按内容哈希查询：使用 `idx_news_versions_content_hash`

## 备份与恢复

### 备份数据库

```bash
mysqldump -u root -p gx_geo_news > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
mysql -u root -p gx_geo_news < backup_20240115_120000.sql
```

### 备份实体白名单

```bash
./scripts/backup-entity-whitelist.sh
```

备份文件保存在 `datasets/config/backups/` 目录。

## 性能监控

### 慢查询日志

在 MySQL 配置中启用慢查询日志：

```ini
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 2
```

### 表统计信息

查看表大小和行数：

```sql
SELECT
    table_name,
    table_rows,
    ROUND(data_length / 1024 / 1024, 2) AS data_size_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_size_mb
FROM information_schema.tables
WHERE table_schema = 'gx_geo_news'
ORDER BY data_length DESC;
```

### 索引使用情况

查看索引使用统计：

```sql
SELECT
    table_name,
    index_name,
    cardinality,
    seq_in_index
FROM information_schema.statistics
WHERE table_schema = 'gx_geo_news'
ORDER BY table_name, index_name, seq_in_index;
```
