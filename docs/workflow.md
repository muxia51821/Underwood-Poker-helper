# 开发与发布工作流

## 适用范围

这是独立 Poker 助手使用的轻量流程。它借鉴 Catstarry 的证据和关卡纪律，但不引入 Catstarry 的框架、服务或多阶段调度模型。

## 变更闭环

```text
确认变更类型
→ 确认允许修改的文件和当前 Git 状态
→ 实施最小修改
→ 执行 npm run check
→ 完成用户验收清单
→ 记录发布证据
→ 获得明确授权后再发布
→ 对目标 URL 做线上冒烟
```

## 工作区保护

开始修改前，先检查 `git status --short` 和 `git log -1 --oneline`。除非明确属于任务范围，否则保留木下已有的修改和未跟踪文件。存在未提交修改的工作区不能作为发布基线。

远端同步是独立操作。执行 `pull`、`rebase`、merge 或 reset 前，必须先比较远端提交和本地修改；这些改变 Git 状态的操作由木下执行，助手只提供命令和前置条件。

## 检查命令

```bash
npm run check
npm run preview
npm run test:e2e
```

`npm run check` 会构建临时生产产物，检查单文件契约，运行数据契约测试，并把浏览器冒烟跑在**生产构建的预览服务器**上（`vite preview`，覆盖 CSP 与内联产物的真实行为），不会覆盖受 Git 跟踪的 `dist` 目录。单独运行 `npm run test:e2e` 时仍使用 dev server。

## 部署目标

- Netlify 是主入口候选，仍需确认平台侧绑定关系。
- GitHub Pages 保留为备用入口，并通过 `.github/workflows/static.yml` 使用同一套源码构建。
- `file://` 是离线分发场景，需要与 HTTPS 行为分开验证。

## 发布证据

一次构建或一次合并本身不代表生产发布。发布记录必须包含：

- source SHA
- 应用版本
- 产物 hash
- 目标 URL
- 自动检查结果
- 人工验收结果
- 线上冒烟结果
- 回滚点

生产部署仍然必须由木下明确授权，并由木下执行对应的 Git 或平台操作。
