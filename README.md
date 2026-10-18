# 木下的牌桌助手 · Underwood's Table Agent

离线优先的扑克学习与复盘 PWA——Timer、Odds、手牌导入、Session 复盘、Study／Practice 与 GTO 频率参考。

An offline-first poker PWA for hand import, Session review, Study / Practice, GTO frequency quiz, and scoped strategy reference.

---

## 核心功能 · Features

- ⏱ **站立提醒 Timer** — 番茄钟 + 长休息 + 移动端振动/通知
- 🧮 **底池赔率 Odds** — MDF / SPR / 隐含赔率 / 几何下注路线 / Outs 参考
- 📋 **多维度复盘 Review** — Hand / Session / Weekly / Overall / Villain，Canvas 图表、Monte Carlo 波动模拟及 Session Closure
- 📚 **复盘与学习** — 从 Session 挑牌、逐决策记录疑问，接续 Study／Practice
- 🔍 **Discover 自动发现** — 盈亏异常、自我矛盾与热力图；发现的问题可追溯到手牌
- 🏋 **Quiz 训练器与专项练习** — 概念自测、范围对照、个人手牌及受限求解样例练习；旧 Quiz 记录保留
- 🎯 **GTO 频率速查** — BTNvsBB / SBvsBB 聚合参考，保留旧资料的适用范围提示
- 📤📥 **本地备份与恢复** — GG 手牌文本导入、文件与剪贴板备份、恢复预览和冲突选择

---

## 快速开始 · Quick Start

```bash
npm ci
npm run dev       # 开发 · Dev server (http://localhost:5173)
npm run build     # 构建 · Build → dist/index.html (可直接双击打开 · double-click to open)
```

---

## 技术栈 · Tech Stack

- **Vite 7** + `vite-plugin-singlefile` → 单文件构建 · Single-file output
- **原生 ES 模块** · Vanilla ES modules — 运行时资源随产物交付，无外部 CDN
- **localStorage + IndexedDB** 双后端存储 · Dual-backend persistence
- **离线 PWA** · Offline-ready (Service Worker, `file://` 降级 · fallback)

---

## 项目结构 · Project Structure

```
src/
  main.js / constants.js / utils.js / styles.css
  parsers/ggParser.js          — GG 手牌历史解析
  store/store.js               — Storage + BaseRepo + 迁移
  modules/
    app.js                     — 骨架 · App shell
    timer.js / odds.js         — 计时 & 赔率 · Timer & Odds
    review.js                  — 复盘系统 · Review
    analyzeWorkspace.js        — 场次与手牌复盘 · Session and hand review
    studyWorkspace.js          — 主题学习 · Study
    practiceWorkspace.js       — 专项练习 · Practice
    discover.js                — 自动模式发现 · Pattern discovery
    quizTrainer.js             — GTO 训练器 · Quiz trainer
    statsEngine.js             — 统计引擎 · Statistics
  data/strategy/gtoRaw/        — GTO Solver 原始数据 (BTNvsBB / SBvsBB)
dist/index.html                — 构建产物 · Build output (单文件 · single file)
docs/ARCHITECTURE.md           — 架构文档 · Architecture docs
```

---

## 参考文档 · References

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构 / 数据流 / Schema / 性能优化 |
| [CONTEXT.md](CONTEXT.md) | 当前能力 / 已确认决策 / 任务入口 |
| [docs/workflow.md](docs/workflow.md) | 开发 / 检查 / PR 与发布流程 |
| [docs/acceptance.md](docs/acceptance.md) | 按功能选择的用户验收任务 |
| [CHANGELOG.md](CHANGELOG.md) | 当前变更与发布记录 |
| [牌桌助手历史迭代版本/版本更新说明.md](牌桌助手历史迭代版本/版本更新说明.md) | 早期版本 Changelog |
| [AGENTS.md](AGENTS.md) | Agent 开发约定 / 技能规则 / 编码规范 |

---

## 部署 · Deployment

- **主入口候选** · Primary candidate: [mxpoker.netlify.app](https://mxpoker.netlify.app/)
- **备用入口** · Backup target: [GitHub Pages](https://muxia51821.github.io/Underwood-Poker-helper/)
- **部署基线** · Deployment evidence: [docs/deployment-baseline.md](docs/deployment-baseline.md)
- **离线** · Offline: 双击 `dist/index.html` 即可使用
