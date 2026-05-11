# 数据清理操作指南

本文件保留为根目录入口，完整规则见 [docs/CLEANUP_GUIDE.md](docs/CLEANUP_GUIDE.md)。

当前新闻清理不再使用旧的“只删除 2024-01-01 前新闻”SQL 手工流程；统一使用全规则脚本或后端接口，覆盖日期、白名单来源、来源域名、详情页 URL、摘要来自正文、摘要硬词、正文强相关和 URL 可访问状态。

## 当前验收状态

截至 2026-05-09：

- 当前合格新闻 `694` 条，`qualifiedUniqueNews=694`。
- 日期、来源、来源域名、详情页、URL 状态、正文、摘要来源、摘要硬词、正文强相关违规均为 `0`。
- 中文新闻 `390` 条，广西相关 `89` 条。
- 新华网、人民网、央视网、科技日报、中国新闻网、中国政府网已从来源名单移除，其新闻已物理删除。
- 实时 URL 校验发现的 5 条不可访问新闻已物理删除，另删除 2 条分页列表页误入库记录。

## 常用命令

```powershell
npm run news:audit
npm run news:assert-strict
npm run news:verify-summary-body
npm run news:verify-urls
node scripts/cleanup-noncompliant-strict.js --skip-verify-urls
```

`cleanup-noncompliant-strict.js` 默认带 URL 校验熔断，避免实时 URL 校验大面积失败时误删此前已验证可访问的新闻。
