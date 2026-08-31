# 交接：扑克概念层专项（Daily Dose of GTO 整理与牌理参考重构）

> 交接对象：新专项 session。本文档自包含；AGENTS.md 与 CONTEXT.md 为最高约束，冲突时以它们为准。

## 1. 目标

把产品的"复盘牌理参考"从硬编码叙述重构为**概念层 + spot 卡组装**：牌理知识以"概念"为原子单位（提炼自权威来源 + 原文出处 + 适用条件），spot 卡片是概念的组装视图。首批工作 = 系统理解 GTO Wizard 官方免费教材 **Daily Dose of GTO**（PDF，约 1000 页，木下已下载）并设计概念种子结构与首批提炼。

## 2. 木下已拍板的决策（不要再议）

1. 方向认可：概念层 + spot 卡组装（2026-08-31）。
2. **纪律红线**：牌理内容必须来自权威来源的提炼（附出处链接），禁止助手自写牌理叙述冒充内容——V7.11.0 的 `src/data/pokerLogicSeed.js` 内容因此作废待重写。
3. Daily Dose of GTO 值得专项 session 逐章理解（1000 页）；木下评价"里面的内容和 Quiz 很像，但题更好"——其交互 quiz 形式对产品 Quiz 域有参考价值，理解阶段顺便记录。
4. spot 卡的四步框架保留（范围合法性 → 线语义 → 街牌效应 → 偏离解读），每格内容改为概念引用。
5. 河牌三 spot 的裁剪基于 4.37 万手真实样本摸底（594 手到河牌）：BTNvsBB BTN 河牌下注（92）、BTNvsBB BB 河牌首动（103）、SBvsBB SB 双问（124）；COvsBTN 防守（9 手）明确不做。

## 3. 现状与资产

### 工作区状态（新 session 第一步：`git status --short` 核对）
- V7.11.0（复盘牌理参考框架）**已实现、check 全绿、尚未提交**——建议木下先提交形成干净基线，本专项在其上工作。涉及：`src/modules/spotMatcher.js`（单手牌 spot 识别，含两人池位置交替归属与多人池噪声排除，已契约测试钉死）、`src/modules/pokerLogic.js`（渲染层）、`src/data/pokerLogicSeed.js`（内容作废待重写）、`src/modules/review.js` 两行接线、e2e 与契约测试。
- 版本基线：constants `7.11.0`；外部证据种子 v5（16 条）；GTO 基线种子 v4（17 条）。

### 已核验的来源资产（概念提炼的第一批原料）
以下文章均已全文核验（正文数字逐条确认过，日期/作者已记录在种子文件 source 字段）：
- 翻牌 C-bet 系列：The Mechanics of C-Bet Sizing（2024-07-09）、Flop Heuristics IP/OOP in Cash/MTTs（4 篇）、C-Betting As the OOP Preflop Raiser（2024-01-22）、Aggregate Flop Strategy: SB C-Betting in SRP（2024-04-29，含六深度精确表）
- 后街系列：Exploiting Excessive C-Betting by IP（2023-12-12）/ by OOP（2023-12-07）、Navigating Nasty Rivers OOP（2024-03-26）、Why You're Bluffing the River Wrong With Bricked Flush Draws（2025-11-10）、How to Exploit Human Mistakes After a Flop Overbet（2025-11-07）、Navigating BvB OOP After Check-Calling the Flop（2026-04-06）
- 对手类型系列（已找到未核验）：Exploiting Profiles Episode I-IV（Calling Station/Nit/Maniac/TAG）
- 全部出处 URL 与条件/边界已内联在 `src/data/externalEvidenceSeed.js`（v5）与 `src/data/gtoBaselineSeed.js`（v4）的种子字段中。

### Daily Dose of GTO PDF
- 免费但邮件墙后，木下已自行下载（约 1000 页）。**文件在木下本地——开工时向木下要文件路径。** 作者 Tombos21（GW 团队）；落地页宣称覆盖 equity/pot odds/implied odds 等 core math 与 solver 决策原理；目录未知，理解阶段第一件事就是建立章节地图。

## 4. 建议任务分解

1. **建立章节地图**：通读 DDoG 目录与各章开头，产出"章节 → 主题 → 概念候选"的地图文档（放 `docs/`，命名如 `ddog-concept-map.md`）。每章记录：讲了什么概念、原文页码/章节号、与现有 spot 卡的关联。
2. **设计概念种子 schema**：原子概念 = { id, title, mechanism（来源提炼，非自写）, sourceRef（DDoG 章节/GW 文章 URL）, applicability（适用条件/边界）, relatedSpotIds }。与现有 evidencePacks 的关系（引用或合并）需要设计并过契约测试。
3. **首批概念提炼**：以 DDoG 基础数学/决策原理章节 + 已核验的 16 篇 GW 文章为原料，产出首批概念（预估 20-40 条）。
4. **重写 8 张 spot 卡**：pokerLogicSeed 内容改为概念引用组装（四步框架为导航，每格 = 概念引用列表）。
5. **Quiz 参考**：记录 DDoG quiz 的题型/判分设计，供产品 Quiz 域后续借鉴（只记录，不实施）。

## 5. 纪律与已知坑（前车之鉴）

- **交接数字当线索不当事实**：本档的数字（如样本量 92/103/124、文章日期）来自上一 session 的核验记录，重要决策前可复核（种子文件是最可靠的底账）。
- **图表数字也是权威数字**：来源图表数值可采，按提取方式标注（正文核验/文章表格直读/逐手网格只取定性）。
- **种子工程坑**：种子升级靠 seedRevision 且种子对象不得自带 updatedAt（会阻断升级）；gate key `pa_..._seed_<version>` 升版本重播；facebet 类条目不得填 C-bet 频率字段（渲染会误标）；`classifyBoard` 三连张优先于同花（造 monotone 测试牌面用非连张三同花如 QJ7 同花）。
- **两人池归属口径**：desc 行动 token 不带玩家名，按位置交替归属（OOP 先动）；token>3 且不含 R = 多人池噪声；河牌 OOP 永远先动。
- **治理文档职责分离**：CHANGELOG 独占版本改动记录；CONTEXT 只写现行规则/当前值；文档改动经 writing-for-agents 审核后才交木下。
- **Git**：不执行 add/commit/push，全部由木下执行；并行会话可能有其他工作在跑，动手前 `git status --short` 核对。
- **汇报**：中文、称呼木下；诚实区分"已运行并通过"与"尚未运行"。

## 6. 与本 session 的边界

本档交接后，牌理概念域由新专项 session 负责；Decision Radar 数值域、导入域等继续由主线 session 处理。若两者要动同一文件（如 externalEvidenceSeed.js），按并行会话协议：先验对方树绿色、加法修改、每次编辑前重读。
