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
├─ datasets/            本地 JSON 数据，作为导入样本和回退数据
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
APP_CRAWL_FIRST_START=2026-01-01T00:00:00
APP_CRAWL_OVERLAP_MINUTES=10
APP_IMPORT_ROOT=D:\DiXinYuan\datasets
CRAWL_TRIGGER_TOKEN=local-dev-token
```

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

- 第一次真实抓取：`2026-01-01T00:00:00+08:00` 到当前时间。
- 后续启动：最近一次成功抓取的 `window_end_at - 10 分钟` 到当前时间。
- 重叠窗口不会造成覆盖，因为入库使用 `canonical_url + content_hash` 做版本化去重。

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
  -Body '{"start":"2026-01-01T00:00:00+08:00","end":"2026-04-27T23:59:59+08:00"}'
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
GET  /api/v1/news/{slugOrId}
GET  /api/v1/sources
GET  /api/v1/logs/latest
GET  /api/v1/datasets/summary
GET  /api/v1/datasets/word-cloud
GET  /api/v1/datasets/map
GET  /api/v1/datasets/knowledge-graph
POST /api/v1/internal/crawl/run
```

新闻列表示例：

```text
http://localhost:8080/api/v1/news?limit=10
```

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
- `dataset_snapshots` 每次生成新快照，旧快照保留，只有最新成功快照标记为 `active=1`。

## 常用命令

前端：

```powershell
npm run dev
npm run typecheck
npm run build:app
npm run data:refresh
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
- 前端 `http://localhost:3000/zh/news` 能显示新闻列表。
- 新闻详情页能正常打开。
- 重复导入同一批数据时，`news_versions` 不会重复增加。

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
