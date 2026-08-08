# 变更日志

本文件记录正式发布证据。详细的历史功能说明继续保留在 `牌桌助手历史迭代版本/版本更新说明.md`。

## 未发布

- 新增部署基线，区分本地 Git 状态、公开远端状态、Netlify 和 GitHub Pages。
- 新增轻量开发、检查和发布流程。
- 新增面向用户的 parser、存储、离线、HTTPS 和移动端验收标准。
- 新增临时构建型 `npm run check` 流程，检查构建产物、数据契约和浏览器冒烟。
- 更新 GitHub Pages workflow：发布前先安装依赖并从源码构建。

本条目不代表已经发布到生产环境。

## 正式发布记录模板

```text
Source SHA:
App Version:
Artifact Hash:
Target URL:
Automated Checks:
Manual Acceptance:
Online Smoke:
Rollback Point:
```
