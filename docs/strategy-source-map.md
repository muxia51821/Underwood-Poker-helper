# 策略体系与教材对照

整理日期：2026-09-09。仓库核查基线：`244f1ac`。本文是这一基线的策略内容对照稿，不是完整的求解器策略表，也不代表木下已经在实战中验证了全部内容。

主线为 9max / 200bb cash，次线为 6max / 100bb，沿用 `docs/poker-personal-os-plan.md` 的产品边界。下文的“已有”指仓库已沉淀的内容；未读取浏览器内的个人策略修订、例题作答或私有牌局，因而不判断木下的掌握程度。

## 1. 我们已有的策略骨架

一手牌的策略可以沿这条主线理解：

**翻前条件决定入池范围 → 牌面和行动改变双方范围 → 为不同手类选择下注、过牌或防守 → 后街重新判断价值 → 有对手证据时作针对性调整。**

书籍提供机制和反例，文章提供具体场景，原有行动线笔记提供待核查的对手倾向。个人牌局则用来判断：这些条件是否真的出现、我们是否误用了机制、对手是否确有某种偏差。同一主题下保留这几种材料的关系，不要求每次学习产出固定格式。

已有材料的用途不同：

| 仓库材料 | 已有内容 | 在这套体系里的位置 |
| --- | --- | --- |
| `src/data/conceptSeed.js`：`CONCEPT_SEEDS` / `CONCEPT_APPLICATIONS` | 54 个概念、50 条应用讲解 | 解释策略为什么成立；具体例子的条件仍需保留 |
| `src/data/pokerLogicSeed.js`：`POKER_LOGIC_SEEDS` | 5 张翻牌卡、3 张河牌卡 | 把机制放进特定位置和决策；不是完整的三街策略 |
| `src/data/gtoBaselineSeed.js`：`GTO_BASELINE_SEEDS` | 17 条带来源的基线参考 | 条件明确的教学锚点；不等于主线频率目标 |
| `src/data/externalEvidenceSeed.js`：`EXTERNAL_EVIDENCE_SEEDS` | 17 条文章、方法或工具线索 | 补充场景与研究依据；工具介绍不等于实际人群数据 |
| `src/data/actionLines.js`：`underBluff` / `overBluff` | 19 条行动线判断 | 保留为经验假设，逐条对照，不先当成定论 |
| `src/modules/review.js`：`POSITION_ADVICE` | 10 组位置提示 | 旧材料，含角色和条件问题，不能直接并入工作策略 |
| `src/data/strategy/gtoBaseline.js`：`GTO_LEGACY_SCOPE` | 旧 GTO 查询表的来源边界 | 原始条件未知，只作历史结构参考 |

PDF 页码均指阅读器页码。《Daily Dose of GTO》的章节索引见 `docs/ddog-concept-map.md`；本文按决策问题重组，不重复章节目录。书籍依据沿用已有提炼和此前选页核验，不表示本轮重新逐页通读。

## 2. 翻前：先确定我们将带着什么范围进入底池

已有主张的核心是：有效筹码、位置、开局与再加注尺度、抽水，以及尚未行动的玩家，会一起影响入池选择。某手牌能否盈利，既涉及直接拿走死钱，也涉及被跟后能否实现权益。

深筹码要单独看坚果潜力和反向隐含赔率。不能把“深码有更多后街收益”缩写成“所有强起手牌都更值钱”或“所有同花连张都可以多跟”。书中《Effects of stack depth》p168–170 的 BTN 开局比较里，多数列出的强牌在 200bb 的 EV 比 100bb 低，但 AA 是反例；这组数字不能推广成所有位置的规律。

已有对照：

- 深度：`concept-stack-depth`，p168–170；BB 深度对照 p1251–1254 是 **6max cash、CO vs BB、面对 33% 翻牌下注的聚合例子**，不是 BTN vs BB 或所有尺寸的答案。
- 抽水：`concept-rake-impact`，《Opening in a cash game》p1195–1199，例子为 **6max cash / 100bb**。只迁移“抽水改变收益来源和入池激励”的机制，不把该例当作当前平台费率或开局表。
- 再加注：`concept-3bet-construction` p110–113、`concept-squeeze-construction` p825–829，分别讨论 3-bet 与 squeeze 范围；需要区分对手继续时偏跟注还是偏再加注。
- 多人池：`concept-multiway-pots` p193–195；《Overcalling the deep stacked squeeze》p303–306 的 200bb cash squeeze 例子补充价格与隐含赔率，不能推出普遍宽跟。

**主线缺口：已有翻前构造原理，但尚不能从这些材料拼出一张条件完整的 9max / 200bb 开局、跟注、3-bet 表。** 锦标赛、Spin 和不同抽水的例子保留在各自条件下。

## 3. 翻牌进攻：范围、频率和尺寸分开判断

现有概念可以组成三个连续问题：双方有哪些强、中、弱手？下注主要向哪些手取值或使哪些手弃牌？我们剩下的过牌范围是否仍能应对后续行动？

教材的范围形态、权益分桶和坚果优势，分别解释“有哪些手”“这些手如何分布”“范围顶部谁更强”。文章进一步区分下注频率与尺寸：范围优势通常影响下注频率，坚果优势、弃牌的价值和中段手的构成共同影响尺寸。不能只凭“湿面”就统一下大注。[The Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)

| 已有场景 | 可以保留的策略理解 | 教材、文章对照与边界 |
| --- | --- | --- |
| BTN 开局，BB 跟注后过牌 | 从双方范围和目标手类推导 C-bet；区分适合小注、极化大注和更多过牌的牌面 | 书 p36–39、48–54、59–61、777–781；上述尺寸文章是 **cash / 100bb / BTN vs BB SRP**，具体比例不搬到 200bb |
| SB 开局，BB 跟注 | SB 是翻后先行动方；盲注防守的范围不同于 BTN 冷跟范围，不能只贴“OOP”标签 | 书 p48–54；[SB 聚合文章](https://blog.gtowizard.com/aggregate-flop-strategy-sb-c-betting-in-srp/)讨论 **MTT / chip-EV**，且翻前混合策略随深度变化，不能取其频率作 cash 默认值 |
| CO 开局，BTN 冷跟 | 需要把 BTN 的位置和冷跟范围放进判断，过牌必须是正常的策略分支 | `covsbtn-raiser-cbet` 的原参考含 **UTG vs BTN 的位置类比及 40bb 例子**；保留 OOP 构造问题，不输出 CO 的精确频率 |

已有的大注、慢打、后门和 check-raise 概念是这套构造的分支。SRP 与 3-bet pot 分开：`concept-cbet-3bp` 的 p97–99 是 3BP 例子，不能写成“所有对子面都应该大注”。

## 4. 翻牌防守：不仅问能不能跟，还要比较跟、加注与弃牌

Pot odds 给出价格，equity 描述摊牌份额，EQR 解释为什么有后续行动时不能把两者直接画等号。跟注还要考虑后续压力、改善牌、位置和隐含赔率；加注则可能同时取值、保护权益、让对手放弃未来收益。

已有对照是书 p21–23、626–628、585–588 和两张 `facebet` 卡。MDF 放在校准位置：它依赖诈唬权益与对手过牌收益等假设，不能当作每手牌必须完成的防守配额；书 p512–516、428–435 专门讨论这些边界。

原笔记 `SIAe-B-` 可以拆成两个判断：

1. **若对手在特定节点下注了过多弱手**，一些原本跟注的中段手可能更适合价值／保护性加注。
2. **若对手面对加注还会过度弃牌**，才进一步支持扩大诈唬加注。

GTO Wizard 的实验明确分开了这两个条件；主要例子是 **BTN vs BB、30bb chip-EV、33% C-bet**，另有 100bb 对照。它支持调整机制，不证明我们的牌池具有这两种倾向。[Exploiting Excessive C-Betting by IP](https://blog.gtowizard.com/exploiting-excessive-c-betting-by-ip/)

## 5. 转牌：先读前街，再读新牌

同一张转牌落在 C-bet 被跟、双方过牌、check-raise 被跟之后，面对的是不同范围。当前已有 probe、delayed C-bet、donk、隐含赔率和低 SPR 听牌处理等内容，应按前置行动线区分。

- **双方过牌后的 probe**：书《Probing turn bricks》p573–576；文章以 **BTN vs BB / 100bb cash / T72r 翻牌过牌到底** 为例。前街过滤后的 Ax、口袋对、听牌分布会影响转牌策略；“对手过牌”不等于“没有强牌”。[The Turn Probe Bet](https://blog.gtowizard.com/the-turn-probe-bet/)
- **翻牌下注后的二枪**：已有后门、坚果优势与 targeting 概念可共同解释是否继续开火；不能仅凭转牌出了 A，就判断对手诈唬过多。
- **翻牌加注线和再加注底池**：delayed C-bet p920–923、低 SPR 听牌 check-back p1242–1246，各自保留原底池与 SPR 条件，不并入通用 SRP。
- **深码面对后续压力**：隐含赔率 p33–35 与权益实现一起解释为什么有改善潜力的手和静态抓诈手会分化；不等于“有听牌就继续”。

这里已有较多解释材料，但八张场景卡没有转牌卡。知识主题可以完整保留，应用自动匹配的覆盖范围另行处理。

## 6. 河牌：先比较下注和过牌的收益，再判断价值与诈唬

河牌分为两个问题，不能混写。

**主动下注：** 哪些更差的手会跟？哪些更好的手会弃？过牌还有多少收益？选择小注、较大极化下注或过牌时，要回到经过前街过滤的范围。依据为 targeting p59–61、价值／诈唬构造 p394–398、block-bet p387–391、薄价值 p875–878。

**面对下注：** 自己能否战胜对手的诈唬？价格要求什么样的胜率？移除哪些组合会改变价值与诈唬比例？依据为抓诈 p46–47、blocker p50–52、57–58 与 MDF 边界 p512–516。不能把“有一个好 blocker”当作对手确实存在足够诈唬的证据。

两组文章补充了原策略容易遗漏的条件：

- **坏河牌会改变此前强牌的价值。** OOP 可能需要在过牌和小注中保留强手；文章的河牌主例是 **100bb full-ring MTT、UTG vs BTN**，前半另含 cash 例子。主例不能标成 9max / 200bb cash 的精确方案。[Navigating Nasty Rivers Out of Position](https://blog.gtowizard.com/navigating-nasty-rivers-out-of-position/)
- **未完成同花听牌不是一律放弃，也不是一律诈唬。** 先看此前行动过滤后，还剩哪些诈唬候选，以及持牌实际阻断了哪些继续／弃牌组合。文章含 **100bb UTG vs BB** 与 **200bb BTN vs BB、BB 翻牌 check-raise 后转牌超池** 两个不同例子。[Bricked Flush Draws in Cash Games](https://blog.gtowizard.com/why_youre_bluffing_the_river_wrong_with_bricked_flush_draws_in_cash_games/)

盲注战再单独保留：SB 翻牌 check-call、转牌双方过牌后的河牌，SB 的高张构成与 BTN vs BB 中的 BB 不同。原文章明确指出不能照搬相邻行动线。因此 `btnvsbb-caller-riverfirst` 引用该文只宜提示“前街如何过滤范围”，不能据此推导 BB 的河牌动作。[Navigating BvB OOP After Check-Calling the Flop](https://blog.gtowizard.com/navigating-bvb-oop-after-check-calling-the-flop/)

## 7. 原有行动线经验：逐条保留，但不替它补造证据

以下编号 U/O 仅用于本文定位，分别按 `underBluff` / `overBluff` 源码顺序排列。原文件未给出处、日期、级别或样本，也未完整说明缩写；保留原字符串，不把不明确的行动者补猜出来。

“有相关机制”不等于“教材证实了该人群倾向”。没有对应来源的行，结论仍然开放。

| 编号与原行动线 | 原判断的核心 | 与体系的对照结论 |
| --- | --- | --- |
| U1 `3IA-XX-R-` | 前街控池、后街加注，更相信后街强度 | 对应范围更新和慢打；不能因两街看似矛盾就排除诈唬。缺直接来源 |
| U2 `SIA-Bm-Bb-Bs` | 三枪末街小注偏薄价值，大注也偏价值 | 对应河牌尺寸与 targeting；尺寸不能单独识别价值，人口结论待证 |
| U3 `SIA-B-B-B` | A 高面三枪诈唬不足 | 对应河牌价值／诈唬构造；缺同牌面、位置、尺寸的人群证据 |
| U4 `SIA-Bb-` | 翻牌极化大注，不宜过度防守 | 对应范围顶部和防守价格；不能只凭大注判定诈唬不足 |
| U5 `SOD-XX-CX-DBb` | 成听牌河牌大 lead 诈唬不足 | 对应 runout、donk 与河牌范围重估；原行动者及范围尚需澄清 |
| U6 `SOD-XX-CR / -XR` | 后街面对大注再加注偏强，可以弃超对 | 对应抓诈与重新估值；“能弃超对”是条件结论，不是固定牌名答案 |
| U7 `多人池的前位DB` | 前位 lead 多为强牌 | 多人池单列；书 p193–195 讨论入池手类，不验证这种 lead 的诈唬率 |
| U8 `3OD-DB(不见AK)` | 冷跟 3-bet 后无 A/K 面 lead 多为超对 | 3BP 单列；缺范围、牌面和对手依据，不能锁定 KK/QQ/JJ |
| U9 `多人池的河牌才下注` | 前两街过牌、河牌下注偏薄价值 | 多人池河牌待研究；没有可直接支撑原判断的既有来源 |
| U10 `多人池前位/中位 BC-DBb-DBb` | 成听牌后连续大 lead 诈唬不足 | 多人池与行动者归属先澄清；不能由单挑教材认证 |
| O1 `SOD-DBs-m` | 小中 lead 多弱成牌，可 float 或诈唬加注 | donk 机制解释了可能的价值来源；“弱成牌多”不等于“诈唬多”，还需对加注的反应证据 |
| O2 `SOD-XX-probes` | 小 probe 诈唬多，跟转牌后河牌转诈唬 | probe 教材支持范围重估；IP/OOP 与 probe 名称需先核对，不预设后续诈唬线盈利 |
| O3 `3OD-XC-XX-DBs` | 小河牌下注多诈唬，大注偏价值 | 独立 3BP 节点；不能套用 SRP 的小注／阻挡下注例子 |
| O4 `SIAe-B-` | C-bet 过多，可高频 XR，且对手会过弃 | 有 IP 过量 C-bet 文章作机制依据；“下注过多”和“面对 XR 过弃”必须分别证实 |
| O5 `SIA-B-(掉A)` | A 转牌诈唬多，继续打河牌则诈唬不足 | 按范围过滤拆成转牌、河牌两个假设；删除推理中的“肯定”含义，源码本轮未改 |
| O6 `SID-stab` | IP 刺探过多，OOP 应全范围过牌 | 诱导对手犯错是相关机制；是否全范围过牌依赖具体节点，不由一条泛化倾向推出 |
| O7 `SID-XX-B` | 连续过牌后，IP 转牌多空气 | 与 delayed/stab 主题关联；前街过牌也可能留有中段手或陷阱，人口结论待证 |
| O8 `对手是进攻方flop下注尺度较小` | 深 SPR 小注偏中等牌，后街可转诈唬 | 尺寸文章显示小注可容纳强手；“小注意味着牌弱”不能作为默认读牌 |
| O9 `3OA-Bs-XX-Bs-m` | 尚不明确是否诈唬过度 | 保留未知；不因被放进 overBluff 数组就升级为已知结论 |

这些经验最值得保留的部分，是它们提出了具体问题。未来的个人牌局可以挂在相应主题下作为支持、反例或尚不清楚的例子；单次输赢和少量可见摊牌都不足以估计整条线的诈唬频率。

## 8. 内容对照中暴露的冲突

以下保留对照时发现的问题。后续实现已修正位置速查、深度／抽水／probe 正文及 SB 河牌卡的泛化表述；原问题与来源条件仍留在这里便于追溯。

| 位置 | 问题 | 本文采用的边界 |
| --- | --- | --- |
| `POSITION_ADVICE.UTGvsBB` | 把 UTG 对 BB 写成翻后 OOP，与普通多人桌的位置顺序不符 | 不纳入策略结论；先修正角色，再审其余建议 |
| `POSITION_ADVICE.BTNvsBB` 等 | 未注明条件的开局／C-bet 数字，以及“几乎任何两张”等提示 | 不与带出处的场景参考并列成默认答案 |
| `concept-probe` | 把 check-back 概括成没有强 trap | 限定到原例子的过滤结果；probe 文章也明确保留慢打可能 |
| `concept-stack-depth` | 主机制揉合 BTN 开局、6max CO vs BB 防守和 Spin limped pot 的例子 | 三个例子分开读，不能把数字作为同一个深度模型 |
| `concept-rake-impact` | 从书中特定模型扩写出对平台策略的绝对描述 | 只保留抽水激励机制，平台事实和精确策略另行核实 |
| `btnvsbb-caller-riverfirst` | 用 SB vs BB 的文章推导 BB 策略；原文反而强调二者区别 | 保留机制联系，不接受直接动作迁移 |
| `sbvsbb-raiser-riverdual` | 把特定 XC-X-? 线的小注倾向放在宽泛 SB 河牌卡里 | 限定到前置线，不扩写成所有 SB 河牌都应小注 |

另外，已有场景识别和学习入口的覆盖问题，属于系统接线审计；它们影响材料何时出现，不改变本文对出处和策略含义的区分。不能把“卡片出现了”视为策略条件已全部匹配。

## 9. 全部概念如何归位

以下为 `CONCEPT_SEEDS` 的完整归类，ID 保留以便维护者回到原条目的 `sourceRef`、例子和自测。一个概念可以服务多个决策；这里按主要职责只列一次。

- **翻前条件与入池范围**：`concept-hand-in-vacuum`、`concept-stack-depth`、`concept-rake-impact`、`concept-strategic-domination`、`concept-3bet-construction`、`concept-squeeze-construction`、`concept-multiway-pots`。
- **双方范围与牌面分布**：`concept-equity`、`concept-equity-realization`、`concept-equity-buckets`、`concept-range-morphology`、`concept-nut-advantage`、`concept-equity-distribution-graphs`、`concept-board-distribution-shapes`。
- **翻牌进攻与加注构造**：`concept-range-bet`、`concept-targeting`、`concept-overbetting`、`concept-cbet-3bp`、`concept-donk-bet`、`concept-check-raise-construction`、`concept-backdoor-equity`、`concept-combo-eqr`、`concept-trapping`。
- **转牌与后续权益实现**：`concept-implied-odds`、`concept-probe`、`concept-delayed-cbet`、`concept-owning-draws`、`concept-check-back-draws`。
- **河牌价值、诈唬与抓诈**：`concept-blockers`、`concept-bluff-catching`、`concept-value-bluff-ratio`、`concept-block-bet`、`concept-thin-value`。
- **防守数学及其边界**：`concept-pot-odds`、`concept-alpha-mdf`、`concept-mdf-boundary`、`concept-mdf-draws`、`concept-mdf-showdown-value`、`concept-clairvoyant-defense`、`concept-4straight-chop-defense`。其中 toy game 与 3BP chop 例子不作通用频率表。
- **对手调整与复盘校准**：`concept-indifference`、`concept-mixed-strategies`、`concept-gto-aim`、`concept-exploit-adjustments`、`concept-pure-vs-frequency-mistakes`、`concept-thresholds-thinking`、`concept-solver-noise`、`concept-solver-accuracy`、`concept-variance-basics`、`concept-eqr-rake`。
- **独立分支与极端例子**：`concept-icm`、`concept-risk-premium`、`concept-push-fold-ev`、`concept-shove-extremes`。前三项留在锦标赛／短码分支；最后一项保留 chop 与低 SPR 条件，不成为深码 cash 默认策略。

八张场景卡对应第 3、4、6 节：`btnvsbb-raiser-cbet`、`btnvsbb-caller-facebet`、`sbvsbb-raiser-cbet`、`covsbtn-raiser-cbet`、`covsbtn-caller-facebet`、`btnvsbb-raiser-riverbet`、`btnvsbb-caller-riverfirst`、`sbvsbb-raiser-riverdual`。卡片与应用的精确关系以种子中的 `applicationIds` 为准，本文不另抄一份应用正文。

## 10. 这套体系的当前结论

已经能够形成的，是一套以范围和权益实现为基础、按街组织、允许对手证据修正的策略解释体系。翻牌 SRP 的材料最集中；转牌和河牌有可用机制，但具体前置线仍有缺口。翻前 9max / 200bb 的精确范围，以及旧行动线笔记中的人群倾向，仍不能视为已建立。

书与 GTO Wizard 文章很多出自同一内容体系，二者一致不等于两份独立的人群证据。新的文章观点和个人牌局应归入已有主题，注明它是补充机制、限定适用条件，还是挑战原有判断；不因新增材料就自动升级成个人工作策略。

本次对照重新打开并核对了正文中的七篇 GTO Wizard 文章；其他已存文章、工具线索和全部书籍例子的核验深度，仍以种子出处及已有章节地图为准。

系统接入：复盘 → 策略中的主题由 `src/data/strategyFramework.js` 引用既有种子组装，呈现待证经验。深度、抽水、probe 的机制、阅读限定及相关自测正文统一由 `conceptSeed.js` 提供；主题可查看本地候选手牌并进入对应概念自测。策略训练按街与决策问题分流，位置速查连接主题阅读。SB 河牌卡注明 XC-X 前置线，文章同花例子的 blocker 方向已按原文修正，转牌／3-bet 底池／Spin 书例标明原场景；这不是对所有书例重新精读的声明。候选关联不替用户判断证据，运行时职责见 `docs/ARCHITECTURE.md` 的 `strategyLibrary.js` 与 `strategyStudy.js` 条目。
