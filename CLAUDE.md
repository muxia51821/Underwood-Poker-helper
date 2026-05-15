# CLAUDE.md

## 项目

"Underwood's table agent"（木下的牌桌助手），扑克玩家 PWA 工具。源码 `src/` 多文件 ES 模块，Vite 构建为单文件 `dist/index.html`。托管于 https://mxpoker.netlify.app/。

**双场景**：离线版双击 `dist/index.html`（`file://`），线上版走 HTTPS。file:// 下 Service Worker / 通知不可用。数据跨设备不互通，用户手动导出/导入同步。

## 硬性约束

1. 构建产物 `dist/index.html` 为单文件，`file://` 可直接打开
2. 开发用 `npm run dev`，不直接双击 `index.html`
3. 禁止代码省略（`// ...` `…` 等）
4. 禁止外部 CDN/npm 依赖（仅 `vite` + `vite-plugin-singlefile`）
5. 禁止自动上传用户数据。localStorage 键名统一 `pa_` 前缀
6. 存储结构变更必须向后兼容，平滑迁移
7. file:// 下未经用户点击不得读取设备文件（FileReader 除外）

## 编码

- **文件组织**：偏好少的大文件，直到"不舒服地大"再拆。共置相关功能，不为"整洁"建深层目录。不过早抽象。
- **编辑**：对已有文件用 Edit，不用 Write。不做任务范围外的重构。
- **安全**：用户数据插入 HTML 前必须 `Utils.escapeHtml()`；浮点数显示必须 `Utils.safeFixed()`
- **事件**：优先事件委托。innerHTML 更新后确保事件仍有效
- **注释**：只在 WHY 不显而易见时写。新增用 `// [Vx.x 新增]`，修改用 `// [Vx.x 修改]`
- **版本号**：只改 `src/constants.js` 的 `CONSTANTS.VERSION`

## 工作流

- **Plan 模式先行**：新功能先确认方案再写代码（typo 修复除外）
- **复杂功能自测自修**：发现 bug 先自己修，修完再汇报
- **重构时先试最简方案 → `npm run build`**：让编译器（200ms）报错引导修正，不要在脑中穷举（[[over-analysis-lesson]]）
- **dev + build 双验证**：`npm run build` 成功不代表 `npm run dev` 正常（[[vite-css-import-pitfall]]）
- **改完代码后**：检查版本号 → 备份到 `牌桌助手历史迭代版本/indexVx.x.x.html` → 更新 `版本更新说明.md` → 更新本文状态 → `npm run build` → `npm run dev`（详见 [[post-change-checklist]]）

## 输出

- 给出代码前先输出中文计划（目标、涉及文件、核心步骤）。除非用户说"直接给代码"，计划中不放大段代码块
- 沟通用中文，简洁

## 用户

扑克牌手，非专业程序员。解释用通俗语言。扑克缩写可直接使用（OTF/OTT/OTR/SPR/BB/100/SIA/SID/SOA/SOD/3IA 等）。手机端为主，注意按钮大小和间距。

## UI 导航

四 Tab：计时 → 赔率 → 锦标赛 → 复盘。复盘下四子 Tab：Hand → Session → Weekly → Villain。SRP 表和行动线表用 `<details>` 懒加载。

## 文件结构

```
src/
  main.js              # 入口：initStorage → App.init
  constants.js         # CONSTANTS + EQUITY 查找表 + 类型定义
  utils.js             # Utils + PubSub
  styles.css
  parsers/ggParser.js
  store/store.js       # Store + IndexedDB + BaseRepo + repos + 迁移
  modules/
    app.js             # App 骨架（init/导航/健康指示器/SRP/行动线）
    timer.js           # 站立提醒（beep/vibrate/notify 依赖注入）
    odds.js            # 底池赔率计算
    tournament.js      # 占位桩
    tiltRescue.js      # 情绪急救（PubSub → Review）
    ggImport.js        # GG手牌导入（解析/去重/批量导入）
    dataSync.js        # 剪切板导入导出
    review.js          # 复盘（Session/手局/周级/对手画像 + 分页 + 图表 + 统计 + 迁徙）
  data/srpData.js
  data/actionLines.js
  selfTests.js
public/sw.js           # Service Worker（独立文件，Blob 降级）
e2e/                   # Playwright 端到端冒烟测试
docs/                  # 架构文档
```

- **Store**：localStorage + IndexedDB 双后端。`pa_migrated_v1` 标记迁移。`#safemode` 跳过 IndexedDB
- **BaseRepo**：内存缓存 + IndexedDB 读写 + localStorage 降级。`getAll/saveAll/getById/add/update/delete/getPage/count`
- **PubSub**：事件总线，当前用于 TiltRescue → Review
- **存储健康指示器**：页面标题旁圆点，🟢 IndexedDB / 🟡 localStorage / 🔴 异常

## 状态

- **最新稳定版**：V6.12.4
- **Git 基线**：V6.8.0（规则：当前稳定版往前退两个版本 commit 为基线）
- **已知缺陷**：无

## 参考

- 架构/数据流/Schema：`docs/ARCHITECTURE.md`
- 版本历史：`牌桌助手历史迭代版本/版本更新说明.md`
- Memory：[[gg-parser-lessons]] [[indexeddb-migration-lessons]] [[vite-css-import-pitfall]] [[over-analysis-lesson]]
