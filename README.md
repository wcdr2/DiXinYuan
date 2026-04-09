# 广西地球信息产业发展研究

这是一个基于 `Next.js + TypeScript` 实现的研究门户型站点原型，包含以下能力：
- 中英双语界面切换
- 新闻索引与摘要详情页
- 词云分析页
- 广西专题知识图谱页
- 白名单来源说明页
- 实时抓取优先的数据刷新脚本

## 快速开始

```bash
npm install
npm run data:refresh
npm run dev
```

默认首页：
- `http://localhost:3000/zh`
- `http://localhost:3000/en`

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
