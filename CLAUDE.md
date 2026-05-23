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
- **ggParser 方法调用**：parse() 内部调用自身方法必须用 `self.xxx()`（`var self = this`），不能用裸名。这是最高频的静默 Bug 来源——裸名在 try/catch 中抛 ReferenceError 被吞，导致所有手牌解析失败
- **回调中的 this**：`.map()` / `.forEach()` / `.then()` 回调中不能用 `this`（指向错误）。必须先 `var self = this` 或 `var state = this._state` 再传入回调
- **新模块必加 init()调用**：新增模块后检查 `app.js` 或对应入口是否调用了 `init()`，并在 `init()` 中初始化所有 `_state` / `_cache` 默认值
- **数据文件用 .js 不用 .json**：ES 模块不能 import JSON（Live Server 的 MIME 类型拒绝）。所有数据文件用 `export default {...}` + `.js` 扩展名
- **注释**：只在 WHY 不显而易见时写。新增用 `// [Vx.x 新增]`，修改用 `// [Vx.x 修改]`
- **版本号**：只改 `src/constants.js` 的 `CONSTANTS.VERSION`

## 工作流

- **Plan 模式先行**：新功能先确认方案再写代码（typo 修复除外）
- **复杂功能自测自修**：发现 bug 先自己修，修完再汇报
- **重构时先试最简方案 → `npm run build`**：让编译器（200ms）报错引导修正，不要在脑中穷举（[[over-analysis-lesson]]）
- **dev + build 双验证**：`npm run build` 成功不代表 `npm run dev` 正常（[[vite-css-import-pitfall]]）
- **Live Server 实测**：涉及新数据文件（import 路径）、新模块、JSON→JS 转换后，必用 Live Server 打开验证一次（Vite dev 会掩盖 JSON import MIME 错误）
- **Console 零报错**：`npm run dev` 后打开 DevTools Console，确认无红色报错再交付
- **改完代码后**：检查版本号 → 备份到 `牌桌助手历史迭代版本/indexVx.x.x.html` → 更新 `版本更新说明.md` → 更新本文状态 → `npm run build` → `npm run dev`（详见 [[post-change-checklist]]）
- **每两个版本执行一次 `/simplify`**：检查代码重复、死代码、可合并逻辑、过时注释，保持代码库整洁

## 技能使用规则

### skill-creator

- **触发**：仅在用户明确说"创建技能"/"新建skill"/"帮我写一个skill"时调用
- **精简模式**（默认）：理解需求 → 写 SKILL.md 草稿 → 用户审核 → 修改 → 完成。禁止自动生成 eval 测试用例、benchmark 对比、description optimization、eval viewer、subagent 跑测试
- **上限**：讨论限制在 3 轮内，SKILL.md 控制在 200 行内
- **Python 脚本**：禁止运行 `scripts/` 下的任何 Python 脚本，除非用户明确要求

### grill-me

- **触发**：仅在用户说"/grill-me"/"grill me"/"追问"时调用
- **用途**：新功能/新项目前期，深度追问帮用户理清需求。平时不主动触发
- **跳过**：小修改、bug 修复、例行任务不调用

### find-skills

- **触发**：仅在用户明确说"找技能"/"有没有技能"/"搜索技能"/"有什么插件"时调用
- **禁止自动触发**：用户问"怎么做X"时不要自动调 find-skills，用已有能力直接回答
- **推荐前验证**：安装量 ≥1000、来源可信（vercel-labs/anthropics/microsoft 等）

## 输出

- 给出代码前先输出中文计划（目标、涉及文件、核心步骤）。除非用户说"直接给代码"，计划中不放大段代码块
- 沟通用中文，简洁

## 用户

扑克牌手，非专业程序员。解释用通俗语言。扑克缩写可直接使用（OTF/OTT/OTR/SPR/BB/100/SIA/SID/SOA/SOD/3IA 等）。考虑手机端，注意按钮大小和间距。

## UI 导航

三 Tab：Timer → Odds → Review。复盘下六子 Tab：Hand → Discover → Session → Weekly → Overall → Villain。SRP 表和行动线表用 `<details>` 懒加载。Tournament 内容迁入 Odds 底部折叠区。

## 文件结构

```
src/
  main.js              # 入口：initStorage → App.init
  constants.js         # CONSTANTS + EQUITY 查找表 + 类型定义
  utils.js             # Utils + PubSub
  styles.css
  parsers/ggParser.js
  store/
    db.js              # IndexedDB 封装（DB 对象，零依赖）
    store.js           # Store + IndexedDB + BaseRepo + repos + 迁移
  modules/
    app.js             # App 骨架（init/导航/SW注册/健康指示器/SRP/行动线）
    timer.js           # 站立提醒（beep/vibrate/notify 依赖注入）
    odds.js            # 底池赔率计算
    tournament.js      # 占位桩
    tiltRescue.js      # 情绪急救（PubSub → Review）
    ggImport.js        # GG手牌导入（解析/去重/批量导入）
    dataSync.js        # 剪切板导入导出
    review.js          # 复盘（Session/Hand/Discover/Weekly/Overall/Villain + 图表 + 统计）
    statsEngine.js     # 声明式统计引擎（36 指标 + 优化建议 + context 缓存）
    handPicker.js      # 手牌精选（☆ 标记 + Picks 跳转）
    discover.js        # 自动模式发现（盈亏异常/自我矛盾/偏离 GTO）
    quizTrainer.js     # GTO 频率判断训练器
  data/
    srpData.js          # GTO 策略速查表（从 gtoRaw 自动生成，import Utils + gtoRaw）
    actionLines.js
    strategy/
      gtoRaw/          # Solver 原始输出（BTNvsBB/SBvsBB flop 频率）
      gtoBaseline.js   # L1 极端阈值自动编译
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

- **最新稳定版**：V7.7.1
- **Git 基线**：V7.5.1（规则：当前稳定版往前退两个版本 commit 为基线）
- **已知缺陷**：无

## 参考

- 架构/数据流/Schema：`docs/ARCHITECTURE.md`
- 版本历史：`牌桌助手历史迭代版本/版本更新说明.md`
- Memory：[[gg-parser-lessons]] [[indexeddb-migration-lessons]] [[vite-css-import-pitfall]] [[over-analysis-lesson]] [[code-patching-lessons]] [[post-change-checklist]] [[self-review-workflow]] [[json-import-pitfall]] [[canvas-chart-lessons]] [[e2e-testing-lesson]] [[data-dedup-lessons]]
