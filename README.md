# 广西地球信息产业发展研究

这是一个“前后端分离、同仓库管理”的研究门户型项目：

- 前端：`Next.js 15 + React 19 + TypeScript`
- 后端：`Java 21 + Spring Boot 3 + Maven + MyBatis-Plus`
- 数据库：`MySQL 8`
- 数据库管理工具：推荐使用 `Navicat for MySQL`

项目现在支持两种运行方式：

- 完整模式：`Next.js 前端 -> Java REST API -> MySQL`
- 回退模式：如果后端未启动或 API 请求失败，前端会自动读取 `datasets/generated/*.json`

## 项目结构

```text
D:\DiXinYuan
├─ app/                 Next.js 页面
├─ components/          前端组件
├─ lib/                 前端数据读取、类型和后端 API 桥接
├─ datasets/            本地 JSON 数据、抓取来源配置和实体白名单
├─ scripts/             当前抓取与数据生成脚本
├─ backend/             Java Spring Boot 后端
└─ README.md            前后端统一启动说明
```

## 环境要求

- Node.js：用于启动前端
- Java：建议 `Java 21`
- Maven：用于启动和测试后端
- MySQL：建议 `MySQL 8`
- Navicat for MySQL：用于查看数据库、表和数据

已验证的默认端口：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8080`
- MySQL：`localhost:3306`

## 系统特性

### 新闻抓取
- **200+活跃来源**: 覆盖政府、协会、科研、高校、企业和专业国际机构；综合媒体/门户源不再作为新闻来源
- **并行抓取**: 支持多线程并行处理（默认20个线程）
- **智能窗口**: 自动计算抓取时间窗口，避免重复和遗漏
- **重试机制**: URL验证支持指数退避重试（最多3次）
- **内容去重**: 基于内容哈希的版本管理

### 数据处理
- **自动清洗**: 标题、摘要规范化，关键词提取
- **白名单准入**: 启用来源必须绑定 `entity-whitelist.json` 中的机构实体
- **硬门槛审核**: 白名单来源、日期范围、详情页 URL 可访问、摘要来自正文、正文强相关、摘要硬词全部满足才入库
- **严格相关性检查**: 基于核心关键词和实体白名单的双重验证，`requireKeywordMatch:false` 不能绕过
- **地区识别**: 自动识别广西相关新闻
- **分类标注**: 自动分类为企业、技术、政策三大类

### 数据质量管理
- **相关性分析**: 分析关键词分布，识别不相关新闻
- **质量审计**: `/api/v1/internal/crawl/quality-audit` 输出合格唯一新闻数、白名单覆盖率、摘要/正文违规数、中文/广西数量和 URL 可访问率
- **回溯补量**: `/api/v1/internal/crawl/backfill-until-target` 只从允许的领域政府、高校、科研、协会、企业等来源补抓，按广西、国内优先
- **批量清理**: 支持预览和批量删除不合规新闻；预览模式只写审计报告，不修改数据
- **审计日志**: 完整记录所有清理操作，支持审计和回溯
- **词边界匹配**: 英文关键词使用词边界匹配，避免误匹配

### 查询功能
- **多维过滤**: 支持分类、来源、地区、关键词等多种过滤
- **全文搜索**: 支持中英文全文检索
- **灵活排序**: 最新/最旧排序
- **性能优化**: 复杂SQL优化，支持最多2000条结果

## 新闻入库验收规则

唯一合格新闻按 `news` 当前版本计数，不按 `news_versions` 或 `news_candidates` 计数。合格标准如下：

- 来源：`sources.active = 1`，且 `sources.whitelist_entity_id` 命中 `datasets/config/entity-whitelist.json`。
- 日期：`published_at` 在 `2024-01-01 00:00:00` 到当前时间之间。
- URL：`original_url` 必须是详情页，且 URL 验证为 HTTP 2xx/3xx 可访问。
- 主题：正文必须与地球信息科学、遥感、测绘、GIS、北斗、空天信息、实景三维、时空智能、自然资源数字化、低空遥感、数字孪生、智慧城市强相关；党建、招聘、普通会议通知等低相关内容拒绝。
- 摘要：必须是正文子串，并天然包含 `地球信息科学`、`遥感`、`测绘`、`GIS`、`北斗`、`空天信息`、`实景三维`、`时空智能`、`自然资源数字化`、`低空遥感`、`数字孪生`、`智慧城市` 中至少一个；清洗阶段不得追加 `关键词：<硬词>`。

核心主题词包括地球信息科学、遥感、测绘、GIS、北斗、空天信息、实景三维、时空智能、自然资源数字化、低空遥感、数字孪生、智慧城市及对应英文表达。

## 第一次启动：完整模式

### 1. 准备 MySQL 数据库

推荐新建独立数据库，不要复用旧库。

可以在 Navicat 里新建数据库：

```text
数据库名：gx_geo_news
字符集：utf8mb4
排序规则：utf8mb4_unicode_ci
```

也可以用 MySQL 命令创建：

```sql
CREATE DATABASE IF NOT EXISTS gx_geo_news
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

后端启动时会通过 Flyway 自动创建业务表。

### 2. 启动 Java 后端

后端会自动读取项目根目录或 `backend` 目录下的 `.env.local` / `.env` 文件。建议先在根目录 `.env.local` 中配置：

```powershell
JAVA_API_BASE_URL=http://localhost:8080
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/gx_geo_news?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=你的 MySQL 密码
APP_IMPORT_ON_STARTUP=false
APP_AUTO_CRAWL_ON_STARTUP=true
APP_CRAWL_FIRST_START=2024-01-01T00:00:00
APP_CRAWL_OVERLAP_MINUTES=10
APP_CRAWL_PARALLELISM=20
APP_NEWS_MIN_PUBLISHED_AT=2024-01-01T00:00:00
APP_IMPORT_ROOT=D:\DiXinYuan\datasets
CRAWL_TRIGGER_TOKEN=local-dev-token
```

**配置说明**:
- `APP_CRAWL_PARALLELISM`: 并行抓取线程数（默认20，建议10-50）
- `APP_CRAWL_OVERLAP_MINUTES`: 抓取窗口重叠时间（默认10分钟）
- `APP_CRAWL_FIRST_START`: 首次抓取起始时间
- `APP_NEWS_MIN_PUBLISHED_AT`: 新闻最小发布日期（早于此日期的新闻会被拒绝）

然后打开第一个 PowerShell 终端：

```powershell
cd D:\DiXinYuan\backend
mvn spring-boot:run
```

如果你的 `C:` 盘临时空间很小，Maven 测试或启动可能会写临时文件失败。可以把临时目录放到项目 `D:` 盘：

```powershell
New-Item -ItemType Directory -Force -Path D:\DiXinYuan\backend\target\tmp | Out-Null
$env:TEMP="D:\DiXinYuan\backend\target\tmp"
$env:TMP="D:\DiXinYuan\backend\target\tmp"
mvn "-Djava.io.tmpdir=D:\DiXinYuan\backend\target\tmp" spring-boot:run
```

后端健康检查：

```text
http://localhost:8080/api/v1/health
```

如果返回类似下面内容，说明后端已启动：

```json
{
  "status": "ok"
}
```

### 3. 确认或手动触发抓取

`APP_AUTO_CRAWL_ON_STARTUP=true` 时，后端启动成功后会在后台自动抓取新闻，不阻塞启动。

抓取窗口规则：

- 第一次真实抓取：`2024-01-01T00:00:00+08:00` 到当前时间。
- 后续启动：最近一次 `succeeded` 或 `partial_succeeded` 抓取的 `window_end_at - 10 分钟` 到当前时间。
- 如果历史批次的 `window_end_at` 晚于当前批次结束时间，系统会自动夹紧为“当前结束时间 - 重叠分钟”，避免生成反向窗口导致全部候选被过滤。
- 重叠窗口不会造成覆盖，因为入库使用 `canonical_url + content_hash` 做版本化去重。
- 新闻入库还有日期硬边界：早于 `APP_NEWS_MIN_PUBLISHED_AT` 或晚于当前时间的新闻不会成为有效版本。
- 每条入库新闻必须有可访问原始页面；审核会对 `originalUrl` 做 GET 校验并记录最终可访问 URL。
- 抓取日志中的“发现链接”只是本次检查到的链接或订阅条目；只有落在时间窗口内、通过清洗审核并写入版本表的新闻才计入“入库”。

如果你想手动触发一次抓取，可在另一个 PowerShell 中执行：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/v1/internal/crawl/run `
  -Headers @{ "X-Internal-Token" = "local-dev-token" }
```

也可以指定窗口：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/v1/internal/crawl/run `
  -Headers @{ "X-Internal-Token" = "local-dev-token" } `
  -ContentType "application/json" `
  -Body '{"start":"2024-01-01T00:00:00+08:00","end":"2026-04-30T23:59:59+08:00"}'
```

查看最近一次真实抓取状态：

```powershell
Invoke-RestMethod `
  -Uri http://localhost:8080/api/v1/internal/crawl/latest `
  -Headers @{ "X-Internal-Token" = "local-dev-token" }
```

用 Navicat 检查这些表：

```text
sources
news
news_versions
news_candidates
crawl_runs
crawl_run_sources
dataset_snapshots
```

推荐检查 SQL：

```sql
SELECT 'sources' AS table_name, COUNT(*) AS row_count FROM sources
UNION ALL SELECT 'news', COUNT(*) FROM news
UNION ALL SELECT 'news_versions', COUNT(*) FROM news_versions
UNION ALL SELECT 'news_candidates', COUNT(*) FROM news_candidates
UNION ALL SELECT 'crawl_runs', COUNT(*) FROM crawl_runs
UNION ALL SELECT 'crawl_run_sources', COUNT(*) FROM crawl_run_sources
UNION ALL SELECT 'dataset_snapshots_active', COUNT(*) FROM dataset_snapshots WHERE active = 1;
```

### 4. 配置前端环境变量

如果第 2 步已经配置过根目录 `.env.local`，这里通常只需要继续补充百度地图和 AI 变量：

```bash
JAVA_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_BAIDU_MAP_AK=你的百度地图AK
NEXT_PUBLIC_BAIDU_MAP_STYLE_ID=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

说明：

- `JAVA_API_BASE_URL`：前端读取 Java 后端 API 的地址。
- `NEXT_PUBLIC_BAIDU_MAP_AK`：百度地图 AK；不配置时项目仍可启动，但真实地图会显示配置提示。
- `DEEPSEEK_API_KEY`：AI 问答密钥；不配置时项目仍可启动，AI 窗口会提示服务未配置。

### 5. 启动 Next.js 前端

打开第二个 PowerShell 终端：

```powershell
cd D:\DiXinYuan
npm install
npm run dev
```

访问页面：

```text
http://localhost:3000/zh
http://localhost:3000/en
http://localhost:3000/zh/news
http://localhost:3000/zh/map
http://localhost:3000/zh/knowledge-graph
```

## 知识图谱更新口径

知识图谱页 `/{lang}/knowledge-graph` 采用 `广西总览 + 14 个设区市` 的结构。每个城市都覆盖 `主体、目标、内容、活动、评价` 五类要素，且实际图谱节点不少于 `80` 个。

节点内容必须具体到可解释对象：

- `主体`：城市政府、自然资源局、发改/工信/交通/应急/农业农村等部门、具体园区平台、高校科研机构和行业运营单位。
- `目标`：中国—东盟合作、西部陆海新通道、喀斯特示范、530 亿元产业规模、200 家链上企业、30 余个应用场景、绿色保护等明确目标。
- `内容`：卫星遥感、北斗时空基准、389 座基准站、实景三维、10PB 时空数据、2000 个以上接口、自然资源 80 余项数据目录。
- `活动`：卫星/航空/无人机/地面数据采集、AI 遥感解译、三维建模、数据建库、平台运营、影像分发、地灾预警、行业应用开发。
- `评价`：442.3 亿元产业规模、23.3% 增长、18.2:30.5:51.3 结构优化、30 余个 AI 模型、11.03 亿元财政节约等指标。

桂林作为样例城市，图谱必须包含桂林市自然资源局、桂林理工大学、桂林电子科技大学、漓江流域绿色保护、文旅数字孪生、卫星遥感季度覆盖、北斗高精度定位基准、三维建模、自然资源数据建库和结构优化等具体节点。

前端展示口径：

- `广西总览` 只展示广西中心和 14 个设区市，不展示五类要素分区。
- 城市页保留 `图形图谱 / 文字图谱` 切换。文字图谱展示生成数据中的真实节点；图形图谱使用本地依赖 `echarts@^5.5.1`，在客户端动态加载，并通过 ECharts `graph` 的 SVG renderer 渲染。
- 城市图形图谱派生为 `城市中心节点 + 5 个要素 Hub + 全部具体节点`，边关系为 `城市中心 -> 要素 Hub -> 具体节点`。当前每市真实数据节点为 `83` 个时，图形全量视图显示 `88` 个视觉节点；5 个 Hub 仅为前端展示节点，不写入 `datasets/generated/knowledge-graph.json`。
- 图形图谱支持节点拖拽、悬浮完整名称 tooltip、点击联动详情面板，以及右侧控制面板按 `主体、目标、内容、活动、评价` 多选过滤。例如只勾选 `目标 + 评价` 时，视图保留城市中心、两个 Hub 及对应具体节点。

图谱支持稳定的桌面验收入口：

- 城市入口：`/zh/knowledge-graph?region=guilin`
- 五类要素筛选：`/zh/knowledge-graph?region=guilin&class=content`，其中 `class` 可取 `subject`、`goal`、`content`、`activity`、`evaluation`。
- Edge headless 视觉与 DOM 验收：`node .\target\kg-edge-screenshots\edge-validate.cjs`，截图输出目录为 `target/kg-edge-screenshots`。

## 快速启动：只看前端

如果暂时不启动 Java 后端，前端会自动回退读取本地 JSON：

```powershell
cd D:\DiXinYuan
npm install
npm run dev
```

访问：

```text
http://localhost:3000/zh
```

## 后端 API

常用接口：

```text
GET  /api/v1/health
GET  /api/v1/news
GET  /api/v1/news/page
GET  /api/v1/news/{slugOrId}
GET  /api/v1/sources
GET  /api/v1/logs/latest
GET  /api/v1/datasets/summary
GET  /api/v1/datasets/word-cloud
GET  /api/v1/datasets/map
GET  /api/v1/datasets/knowledge-graph
POST /api/v1/internal/crawl/run
POST /api/v1/internal/crawl/cleanup-out-of-range
POST /api/v1/internal/crawl/refresh-datasets
POST /api/v1/internal/crawl/analyze-relevance
POST /api/v1/internal/crawl/preview-deletion
POST /api/v1/internal/crawl/cleanup-by-relevance
POST /api/v1/internal/crawl/cleanup-noncompliant
POST /api/v1/internal/crawl/quality-audit
POST /api/v1/internal/crawl/backfill-until-target
```

新闻列表示例：

```text
http://localhost:8080/api/v1/news?limit=10
```

### 新闻清理

分析关键词分布：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/v1/internal/crawl/analyze-relevance `
  -Headers @{ "X-Internal-Token" = "local-dev-token" }
```

预览要删除的新闻：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/v1/internal/crawl/preview-deletion?dryRun=true" `
  -Headers @{ "X-Internal-Token" = "local-dev-token" }
```

执行清理（本项目更新口径为直接物理删除，不生成数据库备份）：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/v1/internal/crawl/cleanup-noncompliant" `
  -Headers @{ "X-Internal-Token" = "local-dev-token" } `
  -ContentType "application/json" `
  -Body '{"dryRun":"false","verifyUrls":"false"}'
```

最终验收审计：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/v1/internal/crawl/quality-audit" `
  -Headers @{ "X-Internal-Token" = "local-dev-token" } `
  -ContentType "application/json" `
  -Body '{"verifyUrls":"true","urlCheckLimit":"1000","targetUniqueNews":"1000"}'
```

详细使用说明请参考 [docs/CLEANUP_GUIDE.md](docs/CLEANUP_GUIDE.md)。

本地无法启动后端或需要直接操作数据库时，可使用同口径脚本：

```powershell
node scripts\audit-strict-news.js
node scripts\backfill-wp-api-strict.js
node scripts\cleanup-noncompliant-strict.js --dryRun
node scripts\cleanup-noncompliant-strict.js
$env:URL_VERIFY_CONCURRENCY='20'; node scripts\check-url-accessibility.js
node scripts\refresh-db-snapshots.js
```

清理日期越界新闻前先预览并导出审计清单：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/v1/internal/crawl/cleanup-out-of-range `
  -Headers @{ "X-Internal-Token" = "local-dev-token" } `
  -ContentType "application/json" `
  -Body '{"start":"2024-01-01T00:00:00","end":"2026-04-30T23:59:59"}'
```

确认要物理删除后再传 `delete=true`：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/v1/internal/crawl/cleanup-out-of-range `
  -Headers @{ "X-Internal-Token" = "local-dev-token" } `
  -ContentType "application/json" `
  -Body '{"start":"2024-01-01T00:00:00","end":"2026-04-30T23:59:59","delete":"true"}'
```

## 白名单与来源口径

实体白名单位于：

```text
datasets/config/entity-whitelist.json
```

当前白名单由 `datasets/config/entity-whitelist.json` 维护。系统会读取实体名称和英文/别名，并把它们并入抓取关键词体系，用于新闻相关性审核。新增广西官方、协会、高校、企业新闻来源前，必须先有可核验实体白名单绑定。

**严格相关性规则：**

新闻必须满足以下条件之一才被认为是相关的：
1. **至少2个核心关键词**：标题、摘要或关键词中包含至少2个核心关键词
2. **1个核心关键词 + 1个实体名称**：包含至少1个核心关键词和1个实体白名单中的名称

核心关键词包括：地球信息科学、地理信息、测绘、遥感、GIS、北斗、空天信息、实景三维、时空智能、自然资源数字化、低空遥感、数字孪生、智慧城市等。

注意：白名单实体不等于新闻来源。只有具备可抓取官网、新闻栏目、RSS、API 或 sitemap 的站点才会加入 `datasets/config/sources.json`。企查查、爱企查、学科排名页、机构介绍页等只作为实体核验证据，不作为新闻源。

当前来源配置状态：

- 来源配置以 `datasets/config/sources.json` 为准；同步时会自动补齐抓取硬词白名单，并停用无法绑定实体白名单、类型不允许或命中综合媒体/门户黑名单的来源。
- 广西来源优先，但不降低合规门槛。江西、宁夏等名称或域名误匹配项不得作为广西来源。
- 知识图谱数据源要求保留广西 14 个市自然资源局；广西壮族自治区统计局用于统计公报、产业规模和市场主体结构证据；广西壮族自治区自然资源厅补充自然资源公报、测绘资质公告和复审换证入口。
- 补抓只允许使用与地球信息科学、遥感、测绘、GIS、北斗、空天信息、实景三维、时空智能、自然资源数字化、低空遥感、数字孪生、智慧城市相关的政府、高校、科研、协会、企业等来源；顺序为广西优先、国内优先，再考虑专业国际机构。

## 防止新闻覆盖的数据库规则

本项目不会用“新新闻覆盖旧新闻”的方式保存数据。

核心表关系：

```text
sources 1 -> N news
news    1 -> N news_versions
crawl_runs 1 -> N news_versions
crawl_runs 1 -> N dataset_snapshots
```

规则：

- 第一次导入新闻：写入 `news`，同时写入第一条 `news_versions`。
- 再次导入同一新闻且内容没变：不新增版本，只记录抓取批次和重复数量。
- 再次导入同一新闻且内容变化：新增一条 `news_versions`，并更新 `news.current_version_id`。
- 历史版本不会被导入流程物理删除。
- 日期越界清理接口是例外：确认删除后会先导出审计清单，再物理删除不在指定日期范围内的 `news_versions`，并修正或删除对应 `news` 主记录。
- 全规则清理：`cleanup-noncompliant` 使用日期、来源白名单、来源域名、详情页、URL 状态、摘要来自正文、正文强相关和摘要硬词规则删除不合规新闻，实际删除会记录到 `cleanup_audit_log` 表。
- `dataset_snapshots` 每次生成新快照，旧快照保留，只有最新成功快照标记为 `active=1`。

当前本地验收状态以 `quality-audit` 或 `scripts/audit-strict-news.js` 返回值为准。最终通过标准为日期、来源、来源域名、详情页、URL、摘要正文一致性、摘要硬词、正文强相关违规均为 `0`。截至 2026-05-09，按用户要求停止补抓后，本地结果为 `total=694`、`qualifiedUniqueNews=694`、`badDate=0`、`badSource=0`、`sourceUrlDomainMismatch=0`、`badUrlStatus=0`、`notDetailUrl=0`、`bodyMissing=0`、`summaryNotFromBody=0`、`summaryRequiredTermMissing=0`、`bodyRelevanceFailed=0`；中文 `390` 条，广西相关 `89` 条。新华网、人民网、央视网、科技日报、中国新闻网、中国政府网已从来源名单移除，其新闻已物理删除；最终 URL 实时验证删除了 5 条不可访问新闻，并删除了 2 条分页列表页误入库记录。

## 常用命令

前端：

```powershell
npm run dev
npm run typecheck
npm run build:app
npm run data:refresh
npm run news:audit
npm run news:cleanup:dry-run
npm run news:verify-urls
npm run news:restore-cleanup-audit
npm run news:refresh-snapshots
npm run validate
```

后端：

```powershell
cd D:\DiXinYuan\backend
mvn spring-boot:run
mvn test
mvn -DskipTests package
```

## 检查清单

启动检查时建议按这个顺序看：

- MySQL 服务正在运行。
- Navicat 能连接 `localhost:3306`。
- Navicat 中存在数据库 `gx_geo_news`。
- 后端 `http://localhost:8080/api/v1/health` 返回 `ok`。
- `news` 表有新闻主记录。
- `news_versions` 表有新闻版本记录。
- `news.current_version_id` 能关联到 `news_versions.id`。
- 有效新闻数应大于等于 `1000`。
- `news_versions.published_at` 应全部在 `2024-01-01` 到当前时间之间。
- 前端 `http://localhost:3000/zh/news` 能显示新闻列表。
- 新闻详情页能正常打开。
- 重复导入同一批数据时，`news_versions` 不会重复增加。

推荐的 SQL 验收：

```sql
SELECT COUNT(*) AS current_news,
       MIN(v.published_at) AS min_published_at,
       MAX(v.published_at) AS max_published_at
FROM news n
JOIN news_versions v ON n.current_version_id = v.id;

SELECT COUNT(*) AS out_of_range_current
FROM news n
JOIN news_versions v ON n.current_version_id = v.id
WHERE v.published_at < '2024-01-01 00:00:00'
   OR v.published_at > NOW();

SELECT COUNT(*) AS summary_required_term_missing
FROM news n
JOIN news_versions v ON n.current_version_id = v.id
WHERE NOT (
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

-- 检查清理审计日志
SELECT COUNT(*) AS cleanup_operations
FROM cleanup_audit_log;
```

## 文档

- [API 文档](docs/API.md) - 详细的 API 接口说明
- [架构文档](docs/ARCHITECTURE.md) - 系统架构和设计决策
- [数据库文档](docs/DATABASE.md) - 数据库架构和查询优化
- [清理指南](docs/CLEANUP_GUIDE.md) - 新闻清理操作指南

## 百度地图说明

本地调试时，百度地图控制台 Referer 白名单建议填写：

```text
localhost,127.0.0.1
```

注意：

- 不要填写 `http://` 或 `https://`
- 不要填写端口号，例如 `:3000`
- 不要填写路径，例如 `/zh/map`

## AI 站内问答说明

AI 问答通过前端服务端接口 `POST /api/ai-chat` 调用 DeepSeek。

`.env.local` 中配置：

```bash
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

如果不配置 `DEEPSEEK_API_KEY`，项目仍可正常启动。

## 常见问题

### 端口被占用

如果 `3000` 或 `8080` 被占用，先关闭旧进程，或者修改前后端端口配置。

### 前端没有读到 MySQL 数据

优先检查：

- Java 后端是否启动。
- `.env.local` 是否有 `JAVA_API_BASE_URL=http://localhost:8080`。
- 后端接口 `http://localhost:8080/api/v1/news` 是否能返回数据。

如果后端不可用，前端会自动回退本地 JSON，所以页面仍然可能能打开。

### 后端启动时报数据库连接失败

优先检查：

- MySQL 服务是否启动。
- 数据库 `gx_geo_news` 是否存在。
- `SPRING_DATASOURCE_USERNAME` 和 `SPRING_DATASOURCE_PASSWORD` 是否正确。
- JDBC URL 里的数据库名是否是 `gx_geo_news`。

### 想重新做一次干净实验

如果确认 `gx_geo_news` 只是实验库，可以在 Navicat 中删除并重建：

```sql
DROP DATABASE IF EXISTS gx_geo_news;
CREATE DATABASE gx_geo_news
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

然后重新启动后端即可自动建表并导入数据。
