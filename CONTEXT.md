# 项目上下文

## 产品边界

Underwood's Table Agent 是独立的扑克学习与复盘 PWA。

- 离线优先：`dist/index.html` 必须能够通过 `file://` 使用。
- 用户数据默认只保存在本地，不自动上传。
- 技术栈保持 Vite + Vanilla ES modules；生产环境以单文件 `dist/index.html` 为核心，仅额外输出已验证的 PWA manifest、Service Worker 和图标资源。
- Catstarry.xyz 只作为治理方法参考，其框架和后端不属于本项目。

## 产品词汇

- **Game Profile**：影响策略含义的一组条件。区分目标档案与从历史手牌得出的观察档案。
- **Hand Fact / Decision Observation**：前者是不可被策略回写的手牌事实；后者是带解析版本的 Hero 决策派生结果。
- **Mark**：牌局中以最少输入留下的时间指针或短备注；由全局 Quick Capture 创建，后续匹配手牌。
- **Decision Family / Spot**：前者是研究、训练和复测的聚合单位；后者是其中足够明确的策略节点。
- **Signal / Finding Dossier**：前者是待核查的候选异常；后者记录它的样本、反例、假设与下一步取证。
- **Evidence Pack / Strategy Revision**：前者保存来源、条件和转移边界；后者是在指定条件下可复核、可更新的当前工作策略。
- **Session Closure**：一次 Session 结束后的导入、Mark 匹配、值得看的手牌复盘与完成确认。
- **Opponent Context**：有证据、范围和时效的对手或桌况观察，不是永久标签。

## 当前工程状态

- 应用版本唯一来源：`src/constants.js`。
- 当前源码版本：`7.10.5`（Phase 0-4 完成 + V7.10.0 手牌回放 + GTO 基线域；`npm run check` 全绿待木下验收）。
- Phase 3 默认项（木下未答复按推荐执行）：策略域用 Review 新增「策略」子页；证据包纯手工录入（无自动抓取）；Dossier 可转策略修订。
- Phase 4 默认项（木下未答复按推荐执行）：复测 = 基线快照对比（频率 ≥15pp / 样本 ≥50% / 信号消失）；对手上下文 v1 = 观察笔记 + Live 开关（合并 UI 未做）。
- Phase 0a 裁决（木下）：6-max 与 9-max 历史数据同等进入观察档案，手牌记录携带桌型字段 `tableMax`；旧导入 Session 等级错标保留不修（选项 a）。
- Phase 1 裁决（木下）：版本并入 7.9.1 不开 7.10；收尾流程不新增 tab，嵌入 Review 的 Session 面板；快速记录桌面入口放 Review 内（Session 面板顶部）。
- Phase 2 裁决（木下）：Signal v1 覆盖翻牌 C-bet + 跟注者应对；与 Discover 既有发现并存；基线只用自有样本，不涉及旧 GTO。
- V7.10.5：Radar 观察按 `tableMax`（6max/9max/其他/未知）隔离；当前 GTO 基线均为结构性参考，不展示与当前样本的数值差。
- 工作区可能存在木下尚未提交的修改；完成核对前不能当作发布基线。
- 只有通过 `npm run check` 后，才把修改视为技术上通过。

## 部署状态

Netlify 是主入口候选，GitHub Pages 继续作为备用入口。2026-08-25 抽查：`poker.catstarry.xyz`（Netlify）与 `muxia51821.github.io/Underwood-Poker-helper/`（GitHub Pages）均返回 `V7.8.0` 且字节级一致；此前「Netlify 线上仍是 V7.3.3」的记录已过时。GitHub Pages 部署来源已切换为 GitHub Actions 工作流（`static.yml`，含 Playwright 浏览器安装与缓存）。当前证据统一记录在 `docs/deployment-baseline.md`。

## 文档索引

- `AGENTS.md`：Agent 行为和编码约束。
- `docs/deployment-baseline.md`：本地、Git、平台和线上部署证据。
- `docs/workflow.md`：开发、检查和发布流程。
- `docs/acceptance.md`：面向木下的验收清单。
- `docs/poker-personal-os-plan.md`：Poker Personal OS 的产品主线、阶段边界和验收方向。
- `CHANGELOG.md`：正式发布证据记录。
