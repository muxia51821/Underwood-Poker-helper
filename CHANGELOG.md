# 变更日志

本文件记录正式发布证据。详细的历史功能说明继续保留在 `牌桌助手历史迭代版本/版本更新说明.md`。

## 未发布

- V7.8.0 新增可安装 PWA 基础：相对路径 manifest、Apple/PWA 图标、maskable 图标、HTTPS 离线 shell 与严格构建产物白名单；继续保留 `file://` 单文件核心能力。
- 新增部署基线，区分本地 Git 状态、公开远端状态、Netlify 和 GitHub Pages。
- 新增轻量开发、检查和发布流程。
- 新增面向用户的 parser、存储、离线、HTTPS 和移动端验收标准。
- 新增临时构建型 `npm run check` 流程，检查构建产物、数据契约和浏览器冒烟。
- 更新 GitHub Pages workflow：发布前先安装依赖并从源码构建。
- 完成存储 seam：IndexedDB、localStorage 降级、备份和迁移重试统一由持久化协调器管理。
- 完成 GG 导入 seam：解析失败、重复、覆盖和 Session 分组在写入前统一生成导入计划。
- 完成 Review 导航 seam：手牌、Session、Discover 和学习目标使用统一导航意图。
- 完成学习分析读模型：Review、Discover、Quiz 使用只读规范化快照，Discover 可稳定跳转 Quiz。
- 强化构建产物契约：检查单文件输出、CSP、无外部运行时资源、HTTPS Service Worker 和两套部署构建入口。

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
