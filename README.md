# 木下的牌桌助手 · Underwood's Table Agent

扑克玩家桌面端 PWA 工具——手牌导入、多维度复盘、GTO 频率训练、实战策略速查。

A desktop PWA for poker players — hand import, multi-dimension review, GTO frequency quiz, and live strategy reference.

---

## 核心功能 · Features

- ⏱ **站立提醒 Timer** — 番茄钟 + 长休息 + 移动端振动/通知
- 🧮 **底池赔率 Odds** — MDF / SPR / 隐含赔率 / 几何下注路线 / Outs 参考
- 📋 **多维度复盘 Review** — Hand / Session / Weekly / Overall / Villain，36 统计指标 + Canvas 图表 + Monte Carlo 波动模拟
- 🔍 **Discover 自动发现** — 盈亏异常 / 自我矛盾 / 偏离 GTO，热力图全局概览
- 🏋 **Quiz 训练器** — 牌面分类 + 频率判断（双阈值判分），错题集 + 掌握追踪 + 轮转出题
- 🎯 **GTO 频率速查** — BTNvsBB / SBvsBB 翻牌策略表，场景 + 高牌 + 类型三过滤器
- 📤📥 **数据导入导出** — GG 手牌文本解析 / 剪切板导入导出 / Session 管理

---

## 快速开始 · Quick Start

```bash
npm install
npm run dev       # 开发 · Dev server (http://localhost:5173)
npm run build     # 构建 · Build → dist/index.html (可直接双击打开 · double-click to open)
```

---

## 技术栈 · Tech Stack

- **Vite 7** + `vite-plugin-singlefile` → 单文件构建 · Single-file output
- **原生 ES 模块** · Vanilla ES modules — 零外部 CDN/npm 依赖 · Zero external dependencies
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
    review.js                  — 复盘系统 · Review (~2500 lines)
    discover.js                — 自动模式发现 · Pattern discovery
    quizTrainer.js             — GTO 训练器 · Quiz trainer
    statsEngine.js             — 36 指标统计引擎
  data/strategy/gtoRaw/        — GTO Solver 原始数据 (BTNvsBB / SBvsBB)
dist/index.html                — 构建产物 · Build output (单文件 · single file)
docs/ARCHITECTURE.md           — 架构文档 · Architecture docs
```

---

## 参考文档 · References

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构 / 数据流 / Schema / 性能优化 |
| [牌桌助手历史迭代版本/版本更新说明.md](牌桌助手历史迭代版本/版本更新说明.md) | 全版本 Changelog |
| [AGENTS.md](AGENTS.md) | Agent 开发约定 / 技能规则 / 编码规范 |

---

## 部署 · Deployment

- **主入口候选** · Primary candidate: [mxpoker.netlify.app](https://mxpoker.netlify.app/)
- **备用入口** · Backup target: [GitHub Pages](https://muxia51821.github.io/Underwood-Poker-helper/)
- **部署基线** · Deployment evidence: [docs/deployment-baseline.md](docs/deployment-baseline.md)
- **离线** · Offline: 双击 `dist/index.html` 即可使用
