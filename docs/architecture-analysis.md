# 单文件架构分析 — Underwood's Table Agent

> 分析日期：2026-08-25。分析对象：V7.8.0 源码、构建管线与双入口线上产物。
> 方法：阅读 `vite.config.js` / `scripts/check.mjs` / `public/sw.js` / `src/` 关键模块，并对 GitHub Pages 与 Netlify 两个线上入口做真浏览器（Chromium headless）验证。本文是评估性分析；模块职责等事实仍以 `docs/ARCHITECTURE.md` 为准。

## 一句话结论

这是一个"把整个应用编译进一个 HTML 文件"的离线优先 PWA：单文件既是交付物也是运行时容器，架构的所有关键决策——零运行时依赖、CSP 注入位置、存储降级链、质量闸门——都围绕这个约束展开，并且目前执行得相当自洽。

## 1. 从源码到单文件：构建管线

```
28 个 ES 模块 (~9000 行, src/)
  → Vite 7 + vite-plugin-singlefile
      ├── DEV: true → false（剔除 selfTests 开发代码）
      ├── CSP <meta> 注入到 </head> 前（仅生产构建）
      └── JS/CSS 全部内联，删除外部 chunk
  → dist/index.html (363 KB, gzip ≈101 KB)
  + 白名单 PWA 资产（manifest / sw.js / 图标）
```

产物只有 9 个文件且全部声明过（`build-output-contract.mjs` 强制校验）。这带来三个直接收益：

1. **`file://` 双击可用**——没有相对路径加载失败问题，离线版和在线版是同一个字节流。
2. **没有资源请求瀑布**——首次加载只有一个 HTML 文档，弱网/牌桌场景下首屏确定性高。
3. **部署面积极小**——Netlify 和 GitHub Pages 只是"放一个文件"的两种方式，平台差异被压缩到几乎为零。

## 2. 最精巧也最脆弱的一处：CSP 与内联脚本的顺序

生产 CSP 是 `script-src 'self'`（无 `'unsafe-inline'`），但应用的全部逻辑恰恰是内联 `<script type="module">`。它没有被拦截的原因是一个**顺序事实**：

```
<head>
  ... manifest / icons / title ...
  <!-- #region HTML -->
  <script type="module">/* 全部应用代码 */</script>   ← 先解析、先执行
  <meta http-equiv="Content-Security-Policy" ...>      ← 后注入，此时内联代码已执行完
</head>
```

HTML 规范中 meta 型 CSP 只约束它被解析**之后**的内容。构建插件把 CSP 注入在 `</head>` 前、内联脚本后，于是：

- 内联引导代码不受 `script-src 'self'` 约束（正常启动）；
- 启动后的运行时（动态 import、外链脚本）仍被策略拦住；
- 样式用 `style-src 'unsafe-inline'` 覆盖了内联 `<style>`。

**这是隐性关键约束**：如果有人把 CSP 移到内联脚本之前（或改成 HTTP 响应头下发），整个应用会静默白屏。2026-08-25 起该约束已纳入自动化保护：`npm run check` 的浏览器冒烟改跑生产构建预览（`vite preview`），CSP+内联组合的启动行为进入 CI 回归范围。

## 3. 数据层：三层防线的本地持久化

```
业务模块 ──只经 Repo 公开方法──▶ BaseRepo 内存缓存（同步读 O(1)）
                                     │ 300ms debounce
                                     ▼
                        PersistenceCoordinator
                          ├─ IndexedDB 主写入（pa_store v1, 4 store + 3 index）
                          ├─ 失败 → localStorage 降级 + 健康状态标记 🟡
                          └─ beforeunload 同步 flush 兜底
```

设计要点与评价：

- **同步读 / 异步写分离**：UI 层永远读内存缓存，永远不 await 存储层，这让 ~9000 行 Vanilla JS 保持简单；代价是写路径必须可靠，所以有降级链和恢复合并（启动时 localStorage 备份 vs IndexedDB 缓存互补偿）。
- **数据不出设备**：跨设备只靠用户手动导出/导入，架构上不存在上传通道，隐私边界即攻击面边界。
- **健康指示器（🟢🟡🔴）** 把存储模式暴露给非程序员的用户本人，是这个项目里"可观测性"的正确形态。
- 契约测试覆盖了解析器语义、导入去重、迁移和 IndexedDB 故障注入（模拟写失败→localStorage 接管），防线完整度高于同规模个人项目平均水平。

## 4. PWA 外壳：Service Worker 的版本化缓存

`sw.js` 只有 83 行：导航请求网络优先、静态资源 cache-first、缓存名按 `?v=CONSTANTS.VERSION` 区分、activate 时清理旧版本。配合单文件产物形成闭环——新版本 = 新 HTML = 新缓存名，旧缓存整体删除，不存在"半新半旧"的资源组合。局限：runtime 缓存无大小上限（当前资产少，不构成风险）；`file://` 场景 SW 天然禁用，与双场景矩阵一致。

## 5. 质量闸门：一条命令的四段式检查

`npm run check` = 临时目录生产构建 → parser/storage 契约测试 → Playwright 冒烟（2026-08-25 起改为生产构建预览）→ 产物契约校验（输出 JSON 证据含 SHA-256）。它是这个架构的核心护栏：单文件产物无法靠"看目录"审查，所以把正确性前移到构建期断言。本次 Pages 故障恰好证明它的价值与盲区并存——检查本身有效拦住了坏产物，但 CI 环境缺 Playwright 浏览器导致闸门误报失败（已修复），而此前 dev-server 冒烟覆盖不到生产特有行为（已修复，见第 2 节）。

## 6. 风险清单（按当前实际影响排序）

| # | 风险 | 影响 | 现状 |
|---|---|---|---|
| 1 | e2e 只测 dev 模式，CSP+内联顺序无自动化保护 | 高（一旦破坏即全站白屏，且 CI 不会报警） | 已修复：`npm run check` 的冒烟改为打生产构建预览（2026-08-25） |
| 2 | 产物体积随功能线性增长（已 363 KB） | 中（SW 需整包重新下载；移动端首装流量） | gzip 后 ≈101 KB，短期无虞；GTO 数据若继续扩表需关注 |
| 3 | 单 HTML 无法增量更新/细粒度缓存 | 中（任何改动都是整包换发） | 版本化缓存名已规避脏读，属接受的取舍 |
| 4 | 备用入口依赖单一 workflow，历史上曾因 legacy Pages 来源发布源码根目录 | 低（已修复并切换 build_type） | `docs/deployment-baseline.md` 已记录证据与回滚方法 |

## 7. 总体评价

以"个人牌桌复盘工具"的需求尺度衡量，这套架构的复杂度分配是克制而准确的：把工程复杂度集中在**构建期转换**（单文件化、CSP、DEV 剔除）和**存储可靠性**（降级/恢复/契约测试）两个真正需要它的地方，UI 层保持直白的 DOM 操作。主要债务不是代码而是**验证盲区**——生产模式的 CSP 行为、CI 环境完整性这两处，值得在下一次迭代中补上自动化覆盖。
