# 广西地球信息产业发展研究

这是一个基于 `Next.js + TypeScript` 实现的研究门户型站点原型，包含以下能力：
- 中英双语界面切换
- 新闻索引与摘要详情页
- 词云分析页
- 广西专题知识图谱页
- 百度真实地图专题页
- 全站 AI 站内问答浮窗
- 白名单来源说明页
- 实时抓取优先的数据刷新脚本

## 快速开始

```bash
npm install
npm run data:refresh
npm run dev
```

## 百度真实地图配置

如果你是从 GitHub 下载本项目，想正常使用“百度真实地图”模块，请先完成下面配置。

### 第一步：创建本地环境文件

先将根目录下的 `.env.example` 复制为 `.env.local`，然后填写你自己的百度地图 AK：

```bash
NEXT_PUBLIC_BAIDU_MAP_AK=你的百度地图AK
NEXT_PUBLIC_BAIDU_MAP_STYLE_ID=
```

说明：
- `NEXT_PUBLIC_BAIDU_MAP_AK`：必填，用于加载百度地图 JavaScript API GL
- `NEXT_PUBLIC_BAIDU_MAP_STYLE_ID`：可选，用于后续接入个性化地图样式；不填也可以正常使用

### 第二步：配置百度地图 Referer 白名单

本地调试时，百度地图控制台的 Referer 白名单填写：

```text
localhost,127.0.0.1
```

如果需要手机同局域网调试，可额外加入你的内网 IP，例如：

```text
localhost,127.0.0.1,192.168.1.23
```

注意：
- 不要填写 `http://` 或 `https://`
- 不要填写端口号，如 `:3000`
- 不要填写路径，如 `/zh` 或 `/map`
- 正式上线后建议单独申请生产 AK，并绑定正式域名

### 第三步：启动项目

配置完成后，执行：

```bash
npm install
npm run data:refresh
npm run dev
```

### 第四步：访问页面

默认首页：
- `http://localhost:3000/zh`
- `http://localhost:3000/en`

地图页面：
- `http://localhost:3000/zh/map`
- `http://localhost:3000/en/map`

### 常见情况说明

- 如果没有创建 `.env.local`，项目仍然可以启动，但真实地图不会加载，地图页会显示配置提示。
- 如果 AK 不正确，或 Referer 白名单没有包含 `localhost` / `127.0.0.1`，地图页会提示加载失败。
- `.env.local` 已被 `.gitignore` 忽略，不会被正常提交到 GitHub。
- 仓库中的 `.env.example` 只是示例模板，不包含真实 AK。
- 正式部署上线时，不建议继续使用本地调试 AK，建议重新申请生产 AK，并把 Referer 白名单改为正式域名，例如：

```text
yourdomain.com,www.yourdomain.com
```

## AI 站内问答配置

如果你想启用右下角 `AI` 按钮的真实聊天能力，请继续在 `.env.local` 中填写 DeepSeek 服务配置。

### 第一步：补充 DeepSeek 环境变量

```bash
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

说明：
- `DEEPSEEK_API_KEY`：必填，服务端调用 DeepSeek 的密钥。
- `DEEPSEEK_BASE_URL`：可选，默认是 `https://api.deepseek.com`；如果你使用兼容 `/v1` 的代理网关，也可以填写带 `/v1` 的地址。
- `DEEPSEEK_MODEL`：可选，默认是 `deepseek-chat`；也可以改为 `deepseek-reasoner`。
- AI 接口统一通过服务端 `POST /api/ai-chat` 代理调用，前端不会直接暴露模型密钥。

### 第二步：启动项目并联调

```bash
npm install
npm run data:refresh
npm run dev
```

启动后可直接访问：
- `http://localhost:3000/zh`
- `http://localhost:3000/en`

然后点击页面右下角的 `AI` 按钮进行联调。

### 当前 AI 功能说明

- AI 助手是全站级浮窗组件，挂载在 `SiteShell`，首页、新闻、地图、知识图谱、来源说明等页面都可直接打开。
- 问答只围绕本站新闻、词云、专题地图、知识图谱、来源说明和项目介绍，不承担开放域百科问答。
- 服务端会结合当前页面、筛选参数、最近对话以及站内结构化数据拼装上下文，再调用 DeepSeek 生成回答。
- 回答会尽量附带站内入口，方便继续跳转阅读对应页面。
- 同语言站内跳转时会保留当前会话；刷新页面或切换语言后会清空。
- 如果未配置 `DEEPSEEK_API_KEY`，项目仍可启动，但聊天窗口会提示 AI 服务尚未配置。

### 推荐联调问题

- `广西近期有哪些企业动态？`
- `专题地图里哪些城市更值得关注？`
- `知识图谱里最近关联较多的主体有哪些？`
- `本站的数据来源主要有哪些？`

## 常用命令

```bash
npm run data:refresh
npm run typecheck
npm run build:app
npm run build
npm run validate
```

## 数据目录
- `datasets/config`：来源白名单配置
- `datasets/seed`：内置回退种子数据
- `datasets/generated`：脚本生成的结构化数据输出

## 抓取说明
- `npm run data:refresh` 会优先尝试联网抓取白名单来源的实时新闻。
- 如果部分来源不可访问、栏目结构异常或抓不到符合规则的文章，脚本会自动回退到对应来源的种子数据。
- 当前已接入真实抓取的重点来源包括：广西自然资源厅、自然资源部、中国地理信息产业协会、空天信息创新研究院、OGC、ESA 等。
- OGC 使用官方 `wp-json` 接口，其他来源主要使用栏目页 + 详情页抽取方式。

## 说明
当前仓库同时保留了演示种子数据、实时抓取能力和 AI 站内问答能力，目的是保证你在有网时能得到真实新闻与站内问答结果，在无网或来源异常时项目仍然可以正常启动、构建和演示。AI 首版不做数据库持久化、不做向量库、不做站外联网搜索，只围绕本站结构化内容生成回答。
