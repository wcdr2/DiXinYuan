# 广西地球信息产业发展研究

这是一个基于 `Next.js + TypeScript` 实现的研究门户型站点原型，包含以下能力：
- 中英双语界面切换
- 新闻索引与摘要详情页
- 词云分析页
- 广西专题知识图谱页
- 百度真实地图专题页
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

## 常用命令

```bash
npm run data:refresh
npm run typecheck
npm run build
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
当前仓库同时保留了演示种子数据和实时抓取能力，目的是保证你在有网时能得到真实新闻，在无网或来源异常时项目仍然可以正常启动、构建和演示。
