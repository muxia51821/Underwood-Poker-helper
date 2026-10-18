# 项目上下文

## 产品边界

Underwood's Table Agent 是独立的扑克学习与复盘 PWA。

- 离线优先；当前构建和数据边界见 `AGENTS.md`，技术实现见 `docs/ARCHITECTURE.md`。
- 用户数据默认只保存在本地，不自动上传。
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
- 策略主题含带来源页码的讲解与转牌决策卡；受限翻后样例用于研究和个人练习，条件和可用行动随样例展示，不自动判定真实手牌或给出通用 GTO 频率。
- 已实现按 Session 复盘、逐决策短记、Study／Practice 续接、完整备份恢复及个人翻前范围编辑。模块与数据边界见 `docs/ARCHITECTURE.md`，批次改动见 `CHANGELOG.md`。
- 逐节点翻后决策卡、个人计划盲练对照与问题续接仍待木下实际学习验收；任务见 `docs/acceptance.md`。翻前练习不是当前优先项。
- 木下确认优先建立可重算的翻后专项，从翻牌行动后继续研究转牌与河牌；完整范围、下注树和规模能力仍是后续工作，达到引擎停止条件本身不代表答案获准评分。
- Study／Practice 已接入两个固定河牌样例、河牌只摊牌的转牌样例及可下注的两街样例，支持 OOP／IP 连续训练、冻结答案下的练习与复练，不自动匹配或评价真实手牌；另有一门 BTN–BB 转牌—河牌研究课程，数值仍待独立核验，只作参考、不判分。四个固定样例的输入、核验报告及复现入口见 `tools/solver-lab/README.md`；旧训练记录保持原义。
- 网页优先方向已确认；页面设计与后续实施分别见下方蓝图和路线图入口。当前单文件与离线约束仍按 `AGENTS.md` 执行，受控缓存更新尚未完成。

## 历史裁决

以下适用于所列阶段或既有模块；阶段版本安排和旧页面位置不约束后续已确认的重设计。

- Phase 3 默认项（木下未答复按推荐执行）：策略域用 Review 新增「策略」子页；证据包纯手工录入（无自动抓取）；Dossier 可转策略修订。
- Phase 4 默认项（木下未答复按推荐执行）：复测 = 基线快照对比（频率 ≥15pp / 样本 ≥50% / 信号消失）；对手上下文 v1 = 观察笔记 + Live 开关（合并 UI 未做）。
- Phase 0a 裁决（木下）：6-max 与 9-max 历史数据同等进入观察档案，手牌记录携带桌型字段 `tableMax`；旧导入 Session 等级错标保留不修（选项 a）。
- Phase 1 裁决（木下）：版本并入 7.9.1 不开 7.10；收尾流程不新增 tab，嵌入 Review 的 Session 面板；快速记录桌面入口放 Review 内（Session 面板顶部）。
- Phase 2 裁决（木下）：Signal v1 覆盖翻牌 C-bet + 跟注者应对；与 Discover 既有发现并存；基线只用自有样本，不涉及旧 GTO。
- V7.10.5：Radar 观察按 `tableMax`（6max/9max/其他/未知）隔离；当前 GTO 基线均为结构性参考，不展示与当前样本的数值差。
- V7.10.6：GG 自动导入以连续 1 小时窗口定义一场；换级别保留在 `stakeLevels` 并显示为组合级别，只有带精确起止时间的既有自动场次可被安全续接；历史/手工场次不自动吞并。
- V7.10.7：外部证据只在同场景、同 Hero 决策、同牌面类别时自动进入 Radar；GTO 以专项牌面参考优先、通用聚合回退，MDA 缺口必须显式保留。相邻节点材料只能标作情境参考，不能推出 Hero 动作。
- V7.10.8（木下裁决方向）：来源图表数字与正文数字同等权威，GTO 种子必须标注数字提取方式（正文核验 / 文章表格直读 / 逐手网格只取定性）；facebet 证据以「应对构成 + 尺寸上下文」呈现，不占用 C-bet 频率字段；来源频率仅作参考展示，不与个人样本做差值（延续 V7.10.5）。

## 部署状态

Netlify 是主入口候选，GitHub Pages 是备用入口。平台核查与历史发布证据统一见 `docs/deployment-baseline.md`；日常验证和发布步骤见 `docs/workflow.md`。

## 文档索引

- `AGENTS.md`：Agent 行为和编码约束。
- `docs/deployment-baseline.md`：本地、Git、平台和线上部署证据。
- `docs/workflow.md`：开发、检查和发布流程。
- `docs/acceptance.md`：面向木下的验收清单。
- `docs/ARCHITECTURE.md`：已实现的模块、导航和数据模型。
- `docs/poker-personal-os-plan.md`：Poker Personal OS 的产品主线与最初阶段计划；旧导航和阶段安排不约束后续已确认的重设计。
- `docs/poker-redesign-blueprint.md`、`docs/poker-redesign-roadmap.md`：涉及页面或构建重设计时阅读；分别保存设计方向与分批实施计划，未实施部分不作为当前能力。
- `docs/gto-wizard-study-analyze.md`：Study / Analyze 的来源、REA 观察、移植选择及本次实现范围。
- `docs/trainer-implementation-audit.md`：Trainer 八项产品取舍的逐项实施、暂缓边界与验证。
- `docs/decision-workbench-research.md`：统一决策工作台的官方来源与借鉴边界。
- `CHANGELOG.md`：变更与发布记录。
