# Daily Dose of GTO 章节地图(ddog-concept-map)

> 专项:扑克概念层(见 `docs/handoff-poker-concepts.md`)。本文档是 DDoG 全书的结构地图:章节 → 主题 → 概念候选 → 与现有 spot 卡的关联。它是概念种子提炼的"选材索引",不是种子本身。
> 建档:2026-08-31,由概念层专项 session 建立。

## 0. 方法与诚实边界

- 结构数据来自 PDF 内嵌书签(全书 334 课,逐条页码已核验,见附录 A)。
- 阅读深度:**全部 334 课均读取了首页文本**(标题 + 钩子叙述/题干);**全文精读仅 2 课**(《Pot odds》与《Where do pot odds and MDF meet?》,作为课程解剖样本)。
- 图形/表格层数字(在解法图、EV 网格里)**未提取**。地图阶段只需要结构与概念定位;种子提炼阶段每条概念必须回到对应课程的全文核验数字,并按既定纪律标注提取方式(正文核验 / 表格直读 / 逐手网格只取定性)。
- 本文档只记录课程"在哪里、讲什么主题、与哪些 spot 卡相关";不抄录原文叙述。所有牌理机制文本在种子阶段按"提炼 + 出处"纪律单独产出。
- 页码口径:PDF 阅读器页码(书页印刷页码 = 阅读器页码 − 1)。

## 1. 书籍概况

- 书名:Daily Dose of GTO(Book 合订本,1293 页);作者 Tom Boshoff(Tombos21,GTO Wizard 团队),贡献作者 Daniel Jacobson;版权页 2024 GTO Wizard;免费教材(邮件墙后),木下本地 PDF。
- 形态:**334 课短文**,每课 3-5 页(均值 3.8 页)。前 30 课(CH1)是讲解型;**从 CH2 起每课首页即一道选择题**(章扉页原话:先做题,再看答案与解析)。
- 每课末尾有 "Learn more" 指向 GW 博客对应文章——**书与已核验的 16 篇 GW 博客文章是同源体系**,博客文章可作课程内容的展开阅读。
- 章扉页各有一段主题导言;书末 Summary 把全书收成三层:Fundamentals(概念工具)、Technical skills(理解 solver 输出背后的因果,而不是背频率)、Soft skills(资金管理/方差/心态)。Summary 还推荐 Hand History Analyzer(上传手牌 → 对比 GTO → 找最大漏损)——与本产品"复盘 + 个人数据"的定位同构。

## 2. 章节总览

| 章 | 主题 | 课数 | 阅读器页 |
|----|------|------|---------|
| 前置 | Table of Contents / Introduction | - | 2-3 |
| 1 | Fundamentals:基础概念(约 23 课真概念 + 7 课软技能/学习方法) | 30 | 6-73 |
| 2 | Quizzes:概念测验(每课一题,概念误解校正导向) | 31 | 76-184 |
| 3 | Spots:具体场景决策(多赛制) | 31 | 187-289 |
| 4 | Streets:按街组织(牌签 Preflop→Flop→Turn→River) | 28 | 292-391 |
| 5 | Advanced Concepts:数学原理、toy games、资金/方差 | 31 | 394-525 |
| 6 | Equity:equity 分布四技术(Equity Buckets / Morphology / Equity Distribution Graphs / EQR) | 30 | 528-647 |
| 7 | Stack Depth:深度如何改变策略形态(浅→深) | 30 | 650-774 |
| 8 | Tactics:常见下注线的构造与阈值(range-bet、donk、probe、block-bet、XR) | 31 | 777-909 |
| 9 | Offense vs Defense:进攻线与应对线成对出现 | 31 | 912-1034 |
| 10 | Formats:Cash / Spins / MTT 四个子块 | 30 | 1037-1153 |
| 11 | All Stars:全书复习,作者自选最重要概念 | 31 | 1156-1290 |
| 收尾 | Summary / Thank you / Credits | - | 1291-1293 |

CH2 扉页起的规则(每课首页 = 题目)意味着 CH2-CH11 的每课都可当 quiz 素材读;CH1 的课程则更像微型讲义。

## 3. 各章主题与概念簇

概念簇 = 提炼种子时的候选分组;括号内课程名见附录 A 对应章的页码。

### CH1 Fundamentals(概念层第一主矿)

- **软技能/方法课(7 课,概念层暂不收,Quiz 域可参考)**:Utilizing the glossary、Low-hanging fruit、Tilt management、Find your game、Where to start、How to warm up、Bankroll management、The power of incremental improvement、GTO Study tip: Focus on one spot / Reviewing sessions、Understanding variance(此课含方差计算器练习)。
- **基础数学簇**:Pot odds(含 "equity ≠ value" 的校正:有后续行动时需要的是实现后份额而非 raw equity);Implied odds(含 nut potential 引子);Visualizing MDF and Pot odds(两者的联动可视化);Finding the thresholds(三个阈值问题:最弱跟注手/最弱价值下注手/最强弃牌手)。
- **Range-vs-range 镜头簇**:A hand in a vacuum is meaningless(单手无意义,必须在范围语境下);Equity buckets(把范围 equity 看成分布而非单一数字);Range Morphology(把范围当"结构"想:polarized/linear/condensed/merged);Nut advantage;Nut Potential;Pay attention to backdoors。
- **Blocker 簇**:Using filters to examine blockers(BB 面对 BTN 125% 超池下注时为何弃顶对——过滤视角);When do blockers actually matter?(blocker 何时重要何时不重要)。
- **博弈论直觉簇**:Mixed strategies;Understanding indifference;Equity Realization;Pure mistakes vs frequency mistakes(两类错误的区分——对产品"频率呈现"口径很关键);Targeting hand classes(用尺寸让特定手类无差别);Bluff-catching rivers(河牌抓诈唬三问:能否打过诈唬 / 对方诈唬频率是否满足底池赔率 / 我的牌是否 block 价值 unblock 诈唬)。
- **GTO 是什么簇**:What does GTO aim to achieve?

### CH2 Quizzes(概念测验 + 误解校正)

每题瞄准一个具体误解;题型原型见第 7 节。代表性概念考题:
- 数学交叉:Where do pot odds and MDF meet?(答案:黄金比例 Φ≈162% pot 时,MDF% = pot odds%,均为 38%——本课已全文精读,解析含 MDF=1/(s+1)、pot odds=s/(2s+1) 的推导)
- EQR 语义:What exactly is equity realization?、Over-realizing equity、What does EV really mean?(EV 是"从当前决策点的期望",不是"期望最终堆栈+EV"的直觉算法)
- 混合的目的:What's the point of mixing?(不同手类受益于不同尺寸/动作)
- 校准题:Fundamental laws in poker(区分"定律"与"人类简化")、Range vs Range(隐藏假设:对方打固定策略)、Overfolding and MDF(2026-08-31 全文核验:"BB 有 preflop 折扣"是本课点名的错误选项,真实机制 = IP 的 check 选项抬高 OOP 防守门槛)、Infinite quads(极化极值思想实验)、Balancing bluffs(75% pot 下使对方无差别的价值:诈唬比)
- 纹理与结构:Suitedness and aggression(SRP 中 rainbow 更常下注)、Rangebetting UTG、Explosive flops、What's the difference?(AKT vs AK9 超池差异)、Effects of stack depth

### CH3 Spots / CH4 Streets(场景课,spot 卡素材层)

- CH3 多为"给场景选动作/选阈值"的决策课,覆盖 MTT/Spin/HU/短码;与 8 张 spot 卡直接相关的课在第 5 节映射。
- 概念性强的课:Which hands like going multiway?(多人池谁受益);Raising the river in position(持 spade 与否的 KK raise/call 分裂——blocker 教学);Blocking the missed flush draw / Comparing flush draw blockers / Comparing blockers in HU 3-bet pots(blocker score 概念);C-betting Sets vs Overpairs(用 vulnerability/implied odds/blockers 解释尺寸差)。
- CH4 按街组织:Preflop(RFI/3-bet 尺寸/冷 4-bet/短码 EV 来源 Where does EV come from?);Flop(定价与防守、低连接面 c-bet、BB 深码防守);Turn(trip 面、超池 turn、4-straight probe);River(check back 最强手、double-paired jam、chop 面构建、OOP block-bet 价值构成 Building block bets OOP)。

### CH5 Advanced Concepts(概念层第二主矿:数学硬核)

- **Toy game 簇**:Balancing your blastoffs(极化范围下注的价值:诈唬比计算);Bluffing the calling station(GTO 对固定对手的 EV 变化);Clairvoyant Defense(AQK 全知防守:何时整个范围可弃);[0, 1] Game(连续牌型博弈:最弱价值手/最强诈唬手的解析解);AKQ Game Block-bet(block-bet 如何提升中等手 EV)。
- **校准簇(与产品口径直接相关)**:What is indifference actually?(无差别 = 多动作同 EV,不是"不确定"也不是 0EV);Solver noise(求解器混合 ≠ 每个动作都等 EV,有数值噪声层);How to interpret solver accuracy?(Nash distance 0.3% 的确切含义——需全文核验后引用);MDF vs Pot Odds(对方明显 under-bluff 时,MDF 不是必须遵守的定律——需全文核验)。
- **MDF 变体簇**:MDF facing bluffs with showdown value(对方诈唬有摊牌价值时防守更窄);MDF facing draws(诈唬是带 equity 的 draw 时防守口径变化)。
- **构造与尺寸簇**:Bet-Bet-Jam Construction(三街几何的价值:诈唬比);Overbet sizing motifs(AA 反而不超池的 blocker 解释);Turning made hands into bluffs;The Vluff(是价值还是诈唬取决于对方如何应对——价值/诈唬的边界定义);Should you donk into a rangebettor?;Overbetting pocket pairs;How thin should you raise the river?;Backdoor suits;4bet shoving 100bb deep。
- **资金/风险簇(产品"个人 OS"域素材,非牌理概念)**:Understanding variance(Bob vs Alice 胜率/样本量);Risk of Ruin;Kelly Criterion;Risk Premium(ICM 下的额外 equity 要求);Understanding ICM;Straddle Theory;Strategic Domination(无盲注时 BTN 开什么);Push-folding EV;Shipping shortstacked flops HU;Which flop is more likely?(组合概率)。

### CH6 Equity(概念层第三主矿:equity 分布四技术)

章扉页明确四大技术:**Range Morphology、Equity Distribution Graphs、Equity Realization、Equity Buckets**——这是本书解释"为什么这样打"的统一语言,建议直接采纳为概念层的机制词汇。

- **Equity Buckets 子块**:What is equity?(equity = check-down 下的期望赢池份额,不是"赢的频率");Translating buckets to range shapes(bucket 形状 → 范围形态);Symmetrical Distributions / Polarized Distributions(什么牌面产生什么分布)。
- **Morphology 子块**(每课训练"这个 spot 该用哪种范围形态"):Fundamentals of morphology(preflop 四场景配对);BvB Broadway Bets;Short stack 3BP c-bets on wet board;Probing turn bricks;Constructing HU 3-bets;Constructing Spin check-backs;Check-raising dry boards;Block-betting scary rivers in 4BP。
- **Equity Distribution Graphs 子块**:Equity Distribution Graphs(如何读图);Guess the line! #1/#2(由分布反推行牌线);Guess the stack depth;Guess the move! #1-#3(**只看分布形状即可选尺寸**——分布→策略的直连证据);The staircase distribution;The no-bluff shove / The no-nut shove(极化极端案例);Giving up on the river(弃牌范围里留"陷阱"的原因)。
- **EQR 子块**:What is EQR?;Realizing Equity on Broadway Boards;Can both ranges underperform?(双方同时欠实现——EQR 不是零和);Realizing the best turn cards;Gutshot performance(同手不同 combo 的 EQR 差);Equity realization and stack depth。
- Daily Dose of Memes 是愚人节彩蛋,非概念课。

### CH7 Stack Depth(深度 = 战略形态的调节变量)

- 浅码:Why shove suited connectors?(equity ≠ EV 的 push-fold 应用)、Limping premiums、Building short-stack turn shoves、Shoving draws on the flop、3-betting flops in shortstack pots。
- 中码:Midstack HU SnG turn probes(probe 用哪种形态)、Trapping the turn BvB、2nd barrel Bluff-catching。
- 深码:Deepstack MTT heuristics、Static bluff-catchers in deep 3BP(静态对子在哪个节点开始弃)、5-Flush deepstack river 3-bets、Deepstack value shove thresholds、Deepstack triple barrel math(flush 稀释的量化题)、The fearless fast-play。
- 横向课:HU 3BP flop heuristics(哪类牌面 c-bet 最频繁最大)、So many flush draws to choose from!(同是 FD 选哪手)、Donking monotone turns。
- 对产品意义:8 张 spot 卡全是 100bb cash 语境,而本章大量结论随深度变化——**applicability 字段必须带深度边界**(见 D7)。

### CH8 Tactics(下注线构造手册,spot 卡素材层)

- **Range-bet 线**:Should you rangebet these flops?、Countering range-bettors(BB 为何 XR>28%)、Rangebetting UTG(CH2)。
- **Donk 线**:Finding donk bets against tight ranges、Donking the flop、Donking monotone turns(CH7)、Double donk diss(CH4)。
- **Probe 线**:Probing OOP on Ace high boards(跨所有 turn 的主用尺寸)、Probing the river on dry runouts、River probe blocks。
- **Block-bet 线**:Block-Block-Jam OOP 3BP、Splitting the turn OOP BvB(三尺寸分裂的价值构成)。
- **XR 线**:Finding check-raises on dry ace flops、Check-raising vs delay c-bets、Check-raising for value on the flop(哪些强牌反而不常 raise)。
- **Barrel 线**:Turn barreling after small flop cbet、Depolarized turn barrels(哪类 turn 用小尺寸)、Barreling turns in 3-bet pots、Triple Barrel Fold、Triple barreling as the IP PFC。
- **防守原理课**:Overdefend pre - Overfold post(过弃真实机制见《Overfolding and MDF》修正注)、Facing turn overbets(无差别手)、Value betting with <50% equity(45% equity 仍价值下注的 fold-equity 解释)、Owning draws with big turn bets、Finding bluffs on 4-flush runouts、Overbetting vs condensed ranges(对 condensed 范围超池)。

### CH9 Offense vs Defense(攻防成对课)

- Offense 子块:Limp triple barrel、Half-stacked check-raises、Delay c-betting OOP in 3BPs、Examining polarized ISO strategies(用 72o 极化 iso 的原因)、Leveraging nut advantages on turns、Barreling turns in HU 3BPs、Raising vs double-barrels、Barreling rivers after check-raising、Triple-barrel bluffing、Donk Shoving in 4-Bet Pots(可全 donk 却选择 check 的范围构造)、Limp-call-donk。
- Defense 子块:Countering Double-Barrels BvB、Defending vs double-barrels in 3BPs、Bluffcatching vs deep stack triple-barrels、Facing turn probes on 4-straight boards、Giving up on the river(BB 三街后面对 shove 的全范围频率)、Final 3 ICM scenarios、Defending vs huge overbets、Facing double-barrels on monotone flops(开始弃的最强 FD)、Calling off short stack shoves、Defending the BXB line on 4-flush boards、Trapping the river OOP、Defending vs c-bets in 3BPs、Facing river check-raises on flush boards(**防守频率 19% > MDF 14% 的解释**——MDF 是下界不是目标,需全文核验)、Defending vs c-bets with short stacks、Facing block bets on the river(应对 block 时跟注范围构成)、Calling down as the OOP PFR in SRPs、Facing shoves on 5-straight boards(0%/100% 频率极值案例)。

### CH10 Formats(赛制差异课)

- Cash 子块:It's a chop, right?!(chop 面 must-check 的反例边界)、Bluffing low pairs、C-betting after squeezing、Check-raising on paired boards、Donking vs early position openers、Defending vs flop shoves at low SPRs、Check-raising flops in 3BPs、C-betting semi-connected boards in 3BPs(33%/66% 两个尺寸各装什么)、Defending vs polarized turn barrels、Range asymmetries after big c-bets(大 c-bet 后的后续街不对称)、Probing the river after big c-bets、Check-raise giving up、4-bet shoving in different rake structures(**GG 与 Stars 结构差异导致 4-bet 全下范围有无**——与本项目 GG 导入域有交叉参考价值)、4-bet bluffing HU。
- Spins 子块:Min open or shove?、Donking out of the SB、Fast-playing top pair at low SPRS、Defending vs short stack triple barrels、Short stack turn barreling after XR、Donking out of the BB with short stacks、Limping with short stacks。
- MTT 子块:Defending the BB in ICM scenarios、Constructing MTT c-bet strategies、C-betting vs an IP cold caller in MTTs(深度×场景矩阵)、Aggressive postflop play with short stacks、Finding thin value in checked down pots、Bluff catching vs short stack triple barrel、Calling vs short stack shoves、4-betting as the chip leader(chipEV vs ICM 对比)、3-betting BvB as the mid stack。

### CH11 All Stars(作者自选的"最重要概念"复习 —— 首批种子的优先级清单)

- 三大指标:Fundamental Poker Metrics(EV / equity / EQR 三者的关系与读法)。
- 三件套数学:Basic GTO Math(**pot odds / alpha / MDF 联动表**,含各尺寸下的 MDF、α、价值%、诈唬% 对照——种子提炼的表格式素材,直读后标注)。
- 核心校准:Indifference and Mixed Strategies。
- 应用复习:Evaluating cold-called flop EQR、C-betting in 3BPs、3-betting passive players(与 CH2 Linear vs Polarized 3-betting 呼应:对方不 4-bet 时线性更大)、HU cash shortstack limps、The more the merrier(多人池 EV 增益)、Defending against polar turn barrels、Opening in a cash game(rake 与开局范围)、Why does donking matter?(donk 的 EV 来源)、Depolarized Turn Probes、Hero calling triple barrels in 3BP、Trapping top set(AA 为何要 check)、Final Table on the BTN、Taking your shot、Deriving strategies from Equity Buckets(**只看 bucket 分布选尺寸**)、Understanding Range Shapes Postflop(四条线 ↔ 四种形态配对)、The Double-Plateau Distribution、Overperformance、Why check back good draws?、Shortstack Triple Barrel Math、How stack depth impacts strategy、Overbetting the Turn、Countering Value-Heavy 3-bets、Bluff-Catching Triple Barrels、Constructing Shortstack Turn Shoves、Showdown or Shove?、Trapping the Turn OOP、Block-calling the river。
- Summary(阅读器 1291-1296):三层收束(见第 1 节)。

## 4. 与现有 8 张 spot 卡的关联

关联 = 该 spot 卡四步框架各格可引用的概念簇 + 代表课程。全 8 卡均为 6-max cash 100bb 语境;DDoG 课程若来自其他赛制/深度,种子阶段须在 applicability 里显式标注。

| spot 卡 | 直接相关的 DDoG 课程(代表) | 可引用概念簇 |
|---------|------------------------------|--------------|
| btnvsbb-raiser-cbet(BTN C-bet,IP 进攻) | Should you rangebet these flops?(CH8)、Suitedness and aggression(CH2)、Overbetting vs condensed ranges(CH8)、Rangebetting UTG(CH2) | range-bet 的条件;纹理→尺寸;range advantage vs nut advantage;backdoors |
| btnvsbb-caller-facebet(BB 面对 C-bet,OOP 防守) | Overfolding and MDF(CH2)、Overdefend pre - Overfold post(CH8)、Pricing and defense in 3-bet pots(CH4)、Defending vs c-bets with short stacks(CH9) | MDF vs pot odds 的边界;OOP 过弃的真实机制(IP 的 check 选项抬高防守门槛;「BB 折扣」是 CH2 点名的误解,2026-08-31 全文核验修正);EQR OOP 偏低;无差别手 |
| sbvsbb-raiser-cbet(SB C-bet,OOP 进攻) | C-bet sizing in 3-bet pots(CH2)、C-betting in 3BPs(CH11)、Belligerent Big Blind(CH3)、Delay c-betting OOP in 3BPs(CH9) | OOP 3BP c-bet 尺寸逻辑;pair 面大尺寸;delay c-bet 尺寸选择 |
| covsbtn-raiser-cbet(CO C-bet,OOP 对抗 BTN 冷跟) | C-Betting a gainst IP cold-callers(CH2,题干即 HJ 冷跟)、Facing cold-callers OOP(CH8)、Rangebetting vs cold-callers OOP(CH3) | 冷跟场景的 c-bet 频率与价值构造(与 externalEvidenceSeed 的 GW c-bet 系列同源互补) |
| covsbtn-caller-facebet(BTN 面对单加注局 C-bet,IP 防守) | Raising flop c-bets in position(CH8)、MDF facing bluffs with showdown value(CH5)、Check-raising flops in 3BPs(CH10) | IP 防守的 raise 权重;摊牌价值对 MDF 的修正 |
| btnvsbb-raiser-riverbet(BTN 河牌下注,IP 终街) | Bet-Bet-Jam Construction(CH5)、Triple-barrel bluffing(CH9)、Showdown or Shove?(CH11)、Value betting with <50% equity(CH8)、Overbet sizing motifs(CH5)、Splitting value on the river(CH2)、The Vluff(CH5) | 价值:诈唬比与无差别;几何下注;超池动机;薄价值;Vluff 边界 |
| btnvsbb-caller-riverfirst(BB 河牌首动,OOP 转主动) | River probe blocks(CH8)、Probing the river on dry runouts(CH8)、Building block bets OOP(CH4)、Block-Block-Jam OOP 3BP(CH8)、Giving up on the river(CH6/CH9 两课同名) | 河牌 probe/block-bet 的价值构成;陷阱保留 |
| sbvsbb-raiser-riverdual(SB 河牌决策,下注+面对下注) | Bluff-catching rivers(CH1)、Balancing bluffs(CH2)、Bluff-Catching Triple Barrels(CH11)、Facing block bets on the river(CH9)、Block-calling the river(CH11)、Trapping the river OOP(CH9) | 抓诈唬三问;blocker 对跟注的选择;面对 block 的跟注构成;慢打 |

## 5. 对现有思路的影响:讨论点(待木下裁决)

以下按"重构/印证/张力"分级;**都不推翻已拍板的方向**(概念层 + spot 卡组装、四步框架、纪律红线),只影响实施细节。

- **D1(重构·概念词汇)**:本书解释策略的统一语言是 equity 分布四技术(Equity Buckets / Range Morphology / Equity Distribution Graphs / EQR)。建议概念种子的 mechanism 采用这套词汇;"街牌效应"一格的写法从"这张牌面纹理如何"升级为"这张牌把双方 equity 分布变成什么形状 → 策略形态如何变"。四步框架保留为导航,格子内容换镜头。
- **D2(重构·schema 增维)**:DDoG 大量课程围绕"一个常见误解"构建(如 pot odds 的 "spot the lie"、indifference 的语义校正、"MDF 不是定律")。建议概念种子显式产出"常见误解/反直觉点"维度(可挂在 applicability 内或独立字段),而不只是"适用条件"。
- **D3(印证·校准课的优先级)**:CH5/CH11 的校准课(indifference 真义、solver noise、Nash distance 语义、MDF 是下界不是目标)与产品既有裁决同向(V7.10.5:GTO 基线只作结构性参考、不展示数值差)。这批"防误读"概念应进首批种子,为产品呈现频率提供正确语义。
- **D4(张力·出处主次)**:16 篇已核验 GW 博客与 DDoG 课程主题重叠(c-bet 尺寸、河牌构造等),书是系统化的、博客是单点的。建议种子 schema 支持"主出处(DDoG 课,带页码)+ 相关来源(博客 URL)";**不动 externalEvidenceSeed.js 既有数据本身**。
- **D5(印证·产品叙事)**:书末 Summary 的三层(Fundamentals/Technical/Soft)+ Hand History Analyzer 推荐,与产品"复盘驱动 + 个人数据"的定位同构;概念层喂给 spot 卡与 Quiz,正好补齐 Technical 层。
- **D6(边界·格式纪律)**:DDoG 逾半课程来自 MTT/Spin/HU/短码,8 张 spot 卡全部是 100bb 6-max cash。种子 applicability 必须带"赛制 + 深度"边界,防止把 25bb Spin 的结论装进 100bb cash 的卡(如 push-fold、ICM、低 SPR 快打类概念)。
- **D7(候选·首批选材范围)**:首批 20-40 条概念的选材优先级建议 = CH11 All Stars(作者自选最重要)+ CH1 真概念 23 课 + CH5 校准簇;CH6 四技术作为机制词汇贯穿。CH2-CH10 主要按 spot 卡需要点选。

## 6. Quiz 设计参考(只记录,不实施;对应交接任务 5)

- 形态:单选 4 选项 → 答案页 → 1-3 页解析(solver 证据 + 数学推导);从 CH2 起每课即一题。
- 题型原型归纳(供产品 Quiz 域借鉴):
  1. 找谎言/找例外("以下陈述只有一个为假/为真")——Fundamental laws、Effects of stack depth、Infinite quads;
  2. 找隐藏假设——Range vs Range;
  3. EV/期望手算(给完整分支与概率)——Calculating Expected Value、Push-folding EV、What does EV really mean?、Prisoners dilemma(rake 分层);
  4. 阈值题("最弱可跟/最强可弃")——CH3/CH4/CH7 大量;
  5. blocker 对比("更愿意拿哪张/哪个 combo")——Blocking the missed flush draw、Raising the river in position、Double-paired river jams;
  6. 频率/尺寸对比("哪个更高/用哪个尺寸及为什么")——C-betting 系列、Guess the move 系列、Suitedness and aggression;
  7. 反直觉数值——Where do pot odds and MDF meet?(Φ≈162%)、Deepstack triple barrel math(由 4.5% flush 推最终 show-down 占比)。
- 解析页惯用结构:先给结论 → 手算/solver 图证据 → 推广的 heuristics("何时适用/何时不适用")——与概念种子"机制 + 边界"结构天然对齐。

## 7. 下一步(建议顺序)

1. 木下裁决第 5 节 D1-D7(尤其 D1 概念词汇、D4 出处主次)。
2. 概念种子 schema 设计(含 D2 的"误解"维度、D6 的 applicability 边界、与 evidencePacks 的引用关系),过契约测试。
3. 按 D7 优先级提炼首批概念(每条回到课程全文核验数字,标注提取方式与页码)。
4. 重写 `src/data/pokerLogicSeed.js` 为概念引用组装(四步框架导航)。
## 附录 A:全书 334 课完整清单

> 页码为 PDF 阅读器页码(书页印刷页码 = 阅读器页码 − 1)。课程标题保留书签原文(含原书笔误,如 Freerolling staights)。


### 第1章 Chapter 1: Fundamentals — 30 课,阅读器页 6–73

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Utilizing the glossary | 6–7 |
| 2 | Low-hanging fruit | 8–9 |
| 3 | Tilt management | 10–12 |
| 4 | Find your game - MTT, Spins or cash? | 13–14 |
| 5 | Where to start | 15–16 |
| 6 | A hand in a vacuum is meaningless | 17–18 |
| 7 | How to warm up before a session | 19–20 |
| 8 | Pot odds | 21–23 |
| 9 | GTO Study tip: Focus on one spot | 24–25 |
| 10 | What does GTO aim to achieve? | 26–27 |
| 11 | Bankroll management | 28–29 |
| 12 | The power of incremental improvement | 30–30 |
| 13 | GTO Study tip: Reviewing sessions | 31–32 |
| 14 | Implied odds | 33–35 |
| 15 | Equity buckets | 36–37 |
| 16 | Pay attention to backdoors | 38–39 |
| 17 | Understanding variance | 40–42 |
| 18 | Mixed strategies | 43–45 |
| 19 | Bluff-catching rivers | 46–47 |
| 20 | Nut advantage | 48–49 |
| 21 | Using filters to examine blockers | 50–52 |
| 22 | Range Morphology | 53–54 |
| 23 | Nut Potential | 55–56 |
| 24 | When do blockers actually matter? | 57–58 |
| 25 | Targeting hand classes | 59–61 |
| 26 | Visualizing MDF and Pot odds | 62–64 |
| 27 | Finding the thresholds | 65–66 |
| 28 | Understanding indifference | 67–69 |
| 29 | Equity Realization | 70–71 |
| 30 | Pure mistakes vs frequency mistakes | 72–73 |

### 第2章 Chapter 2: Quizzes — 31 课,阅读器页 76–184

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Guess the hand | 76–78 |
| 2 | Which set has the most EV? | 79–82 |
| 3 | Over-realizing equity | 83–85 |
| 4 | Where do pot odds and MDF meet? | 86–89 |
| 5 | Suitedness and aggression | 90–92 |
| 6 | Rangebetting UTG | 93–96 |
| 7 | C-bet sizing in 3-bet pots | 97–99 |
| 8 | C-betting against IP cold-callers | 100–103 |
| 9 | Valuing hands on monotone flops | 104–106 |
| 10 | What does EV really mean? | 107–109 |
| 11 | Linear vs Polarized 3-betting | 110–113 |
| 12 | What exactly is equity realization? | 114–117 |
| 13 | Exploiting value heavy players | 118–120 |
| 14 | Fundamental laws in poker | 121–124 |
| 15 | Exploiting trappy players | 125–128 |
| 16 | Range vs Range | 129–131 |
| 17 | Perfect polarity | 132–135 |
| 18 | Check-raise barreling | 136–138 |
| 19 | When to donk the turn? | 139–142 |
| 20 | What's the point of mixing? | 143–146 |
| 21 | Calculating Expected Value | 147–149 |
| 22 | Splitting value on the river | 150–152 |
| 23 | Scared underpairs | 153–156 |
| 24 | Angry underpairs | 157–159 |
| 25 | Prisoners dilemma | 160–163 |
| 26 | Overfolding and MDF | 164–167 |
| 27 | Effects of stack depth | 168–170 |
| 28 | Infinite quads | 171–173 |
| 29 | Balancing bluffs | 174–176 |
| 30 | What's the difference? | 177–179 |
| 31 | Explosive flops | 180–184 |

### 第3章 Chapter 3: Spots — 31 课,阅读器页 187–289

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | XR Shoving scary boards | 187–189 |
| 2 | When to start push-folding? | 190–192 |
| 3 | Which hands like going multiway? | 193–195 |
| 4 | 3-bet shoving pocket pairs | 196–198 |
| 5 | Valuing hands in 4-bet pots | 199–202 |
| 6 | Raising the river in position | 203–205 |
| 7 | Stacking off in spins | 206–208 |
| 8 | Checking back the flop HU | 209–212 |
| 9 | No limp for you! | 213–215 |
| 10 | Donking in 3-bet pots on low boards | 216–218 |
| 11 | Facing a 3-bet UTG | 219–221 |
| 12 | XR shoving 3-bet pots | 222–224 |
| 13 | Delayed c-bet OOP on wet boards | 225–227 |
| 14 | Rangebetting vs cold-callers OOP | 228–231 |
| 15 | Cold 4-bet flop trends | 232–234 |
| 16 | Donk shoving rivers | 235–238 |
| 17 | Cbet trends in HU 3-bet pots | 239–242 |
| 18 | Squeezing short stacks in spins | 243–246 |
| 19 | Belligerent Big Blind | 247–249 |
| 20 | Finding the value line in checked down pots | 250–252 |
| 21 | Checking down with strong hands | 253–255 |
| 22 | Donking HU 4-bet pots | 256–259 |
| 23 | XR shoving flop in spins | 260–263 |
| 24 | Optimizing AK | 264–266 |
| 25 | Comparing MTT and Cash | 267–269 |
| 26 | Defending against overbet flops in HU pots | 270–273 |
| 27 | Block bet bonanza | 274–277 |
| 28 | Blocking the missed flush draw | 278–280 |
| 29 | Comparing flush draw blockers | 281–283 |
| 30 | Comparing blockers in HU 3-bet pots | 284–286 |
| 31 | C-betting Sets vs Overpairs | 287–289 |

### 第4章 Chapter 4: Streets — 28 课,阅读器页 292–391

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | 3-bet sizing with half-stacks | 292–295 |
| 2 | Opening pockets from EP | 296–298 |
| 3 | Adjusting RFI to short stacked | 299–302 |
| 4 | Overcalling the deep stacked squeeze | 303–306 |
| 5 | Complicating your short stacked RFI strategy | 307–310 |
| 6 | Where does EV come from? | 311–314 |
| 7 | Facing the cold 4-bet | 315–318 |
| 8 | Baby flush draws on mono flops | 319–322 |
| 9 | C-betting spins | 323–325 |
| 10 | Defending small pairs OOP | 326–329 |
| 11 | C-Betting low connected boards | 330–333 |
| 12 | Defending the BB deepstacked | 334–336 |
| 13 | Pricing and defense in 3-bet pots | 337–340 |
| 14 | Facing overbets HU | 341–343 |
| 15 | Calling down BvB | 344–347 |
| 16 | XR Barreling paired boards | 348–350 |
| 17 | Double donk diss | 351–353 |
| 18 | Delayed c-betting limped pots | 354–356 |
| 19 | Double overbet diligence | 357–359 |
| 20 | Turn strategy on trip boards | 360–362 |
| 21 | Explosive turn probes | 363–365 |
| 22 | Checking back the river | 366–368 |
| 23 | Defending the river block in passive pots | 369–371 |
| 24 | Double-paired river jams | 372–375 |
| 25 | Triple barrel defense in 3BP | 376–379 |
| 26 | Bluff-catching 4BP river shoves | 380–383 |
| 27 | How to play chop boards? | 384–386 |
| 28 | Building block bets OOP | 387–391 |

### 第5章 Chapter 5: Advanced Concepts — 31 课,阅读器页 394–525

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Balancing your blastoffs | 394–398 |
| 2 | Bluffing the calling station | 399–402 |
| 3 | Bet-Bet-Jam Construction | 403–406 |
| 4 | What is indifference actually? | 407–409 |
| 5 | Solver noise | 410–412 |
| 6 | Understanding variance | 413–416 |
| 7 | Which flop is more likely? | 417–419 |
| 8 | Clairvoyant Defense | 420–424 |
| 9 | Turning made hands into bluffs | 425–427 |
| 10 | MDF facing bluffs with showdown value | 428–431 |
| 11 | MDF facing draws | 432–435 |
| 12 | How to interpret solver accuracy? | 436–439 |
| 13 | Overbet sizing motifs | 440–443 |
| 14 | Understanding ICM | 444–447 |
| 15 | Straddle Theory | 448–452 |
| 16 | Shipping shortstacked flops HU | 453–456 |
| 17 | Push-folding EV | 457–460 |
| 18 | Backdoor suits | 461–465 |
| 19 | 4bet shoving 100bb deep | 466–471 |
| 20 | The Vluff | 472–476 |
| 21 | Should you donk into a rangebettor? | 477–480 |
| 22 | Risk Premium | 481–484 |
| 23 | Freerolling staights | 485–489 |
| 24 | Overbetting pocket pairs | 490–493 |
| 25 | How thin should you raise the river? | 494–497 |
| 26 | Risk of Ruin | 498–501 |
| 27 | Kelly Criterion | 502–506 |
| 28 | Strategic Domination | 507–511 |
| 29 | MDF vs Pot Odds | 512–516 |
| 30 | AKQ Game Block-bet | 517–520 |
| 31 | [0, 1] Game | 521–525 |

### 第6章 Chapter 6: Equity — 30 课,阅读器页 528–647

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Daily Dose of Memes | 528–531 |
| 2 | What is equity? | 532–535 |
| 3 | Translating buckets to range shapes | 536–540 |
| 4 | Symmetrical Distributions | 541–544 |
| 5 | Polarized Distributions | 545–548 |
| 6 | Guess the line! #1 | 549–553 |
| 7 | Guess the line! #2 | 554–557 |
| 8 | Guess the stack depth | 558–560 |
| 9 | Fundamentals of morphology | 561–564 |
| 10 | BvB Broadway Bets | 565–568 |
| 11 | Short stack 3BP c-bets on wet board | 569–572 |
| 12 | Probing turn bricks | 573–576 |
| 13 | Constructing HU 3-bets | 577–580 |
| 14 | Constructing Spin check-backs | 581–584 |
| 15 | Check-raising dry boards | 585–588 |
| 16 | Block-betting scary rivers in 4BP | 589–593 |
| 17 | Equity Distribution Graphs | 594–597 |
| 18 | Guess the move! #1 | 598–600 |
| 19 | Guess the move! #2 | 601–603 |
| 20 | Guess the move! #3 | 604–608 |
| 21 | The staircase distribution | 609–613 |
| 22 | The no-bluff shove | 614–617 |
| 23 | The no-nut shove | 618–621 |
| 24 | Giving up on the river | 622–625 |
| 25 | What is EQR? | 626–628 |
| 26 | Realizing Equity on Broadway Boards | 629–632 |
| 27 | Can both ranges underperform? | 633–636 |
| 28 | Realizing the best turn cards | 637–640 |
| 29 | Gutshot performance | 641–644 |
| 30 | Equity realization and stack depth | 645–647 |

### 第7章 Chapter 7: Stack Depth — 30 课,阅读器页 650–774

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Limping premiums | 650–654 |
| 2 | Why shove suited connectors? | 655–658 |
| 3 | Building short-stack turn shoves | 659–662 |
| 4 | Countering range-bets in limped pots | 663–666 |
| 5 | Checking back turns with flush draws | 667–669 |
| 6 | Shoving draws on the flop | 670–673 |
| 7 | Calling down medium made hands | 674–677 |
| 8 | Evaluating pairs on dangerous boards | 678–681 |
| 9 | 3-betting flops in shortstack pots | 682–685 |
| 10 | Donking monotone turns | 686–689 |
| 11 | Spin flop c-bet strategies | 690–693 |
| 12 | Midstack HU SnG turn probes | 694–696 |
| 13 | Evaluating midstack iso flops | 697–700 |
| 14 | OOP bet construction on trip rivers | 701–704 |
| 15 | Evaluating turn cards in short 3BP | 705–707 |
| 16 | Trapping the turn BvB | 708–711 |
| 17 | 3-betting HU midstacks | 712–715 |
| 18 | Defending the straddle on wet flops | 716–719 |
| 19 | 2nd barrel Bluff-catching in midstack 3BP | 720–723 |
| 20 | Turning the tables | 724–727 |
| 21 | Deepstack MTT heuristics, UTG vs BB | 728–731 |
| 22 | So many flush draws to choose from! | 732–735 |
| 23 | HU 3BP flop heuristics | 736–740 |
| 24 | Static bluff-catchers in deep 3BP | 741–744 |
| 25 | Defending the XR turn barrel | 745–748 |
| 26 | Defending the probe OB in 3BP | 749–753 |
| 27 | 5-Flush deepstack river 3-bets | 754–758 |
| 28 | Deepstack value shove thresholds | 759–763 |
| 29 | Deepstack triple barrel math | 764–767 |
| 30 | The fearless fast-play | 768–774 |

### 第8章 Chapter 8: Tactics — 31 课,阅读器页 777–909

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Should you rangebet these flops? | 777–781 |
| 2 | Countering range-bettors | 782–786 |
| 3 | Probing OOP on Ace high boards | 787–790 |
| 4 | Turn barreling after small flop cbet | 791–794 |
| 5 | Facing cold-callers OOP | 795–798 |
| 6 | Double-paired rivers | 799–803 |
| 7 | Facing turn overbets | 804–808 |
| 8 | Finding donk bets against tight ranges | 809–812 |
| 9 | Depolarized turn barrels | 813–816 |
| 10 | River probe blocks | 817–820 |
| 11 | Raising flop c-bets in position | 821–824 |
| 12 | Squeezing out of position | 825–829 |
| 13 | Overdefend pre - Overfold post | 830–834 |
| 14 | Flatting SB | 835–839 |
| 15 | Finding check-raises on dry ace flops | 840–843 |
| 16 | Donking the flop | 844–847 |
| 17 | Block-Block-Jam OOP 3BP | 848–852 |
| 18 | Splitting the turn OOP BvB | 853–856 |
| 19 | Bet Check Bet on connected runouts | 857–860 |
| 20 | Triple Barrel Fold | 861–865 |
| 21 | Probing the river on dry runouts | 866–870 |
| 22 | Shoving shortstacks for your tournament life | 871–874 |
| 23 | Value betting with <50% equity | 875–878 |
| 24 | Owning draws with big turn bets | 879–882 |
| 25 | Finding bluffs on 4-flush runouts | 883–886 |
| 26 | 3-betting flops | 887–890 |
| 27 | Overbetting vs condensed ranges | 891–894 |
| 28 | Barreling turns in 3-bet pots | 895–898 |
| 29 | Triple barreling as the IP PFC in 3BPs | 899–902 |
| 30 | Check-raising vs delay c-bets | 903–906 |
| 31 | Check-raising for value on the flop | 907–909 |

### 第9章 Chapter 9: Offense vs Defense — 31 课,阅读器页 912–1034

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Limp triple barrel | 912–915 |
| 2 | Half-stacked check-raises on dry boards | 916–919 |
| 3 | Delay c-betting OOP in 3BPs | 920–923 |
| 4 | Examining polarized ISO strategies | 924–926 |
| 5 | Check-raise barreling in 3BPs | 927–930 |
| 6 | Countering Double-Barrels BvB | 931–934 |
| 7 | Donk Shoving in 4-Bet Pots | 935–939 |
| 8 | Leveraging nut advantages on turns | 940–944 |
| 9 | Barreling turns in HU 3BPs | 945–948 |
| 10 | Raising vs double-barrels | 949–952 |
| 11 | Check-raising out of the straddle | 953–956 |
| 12 | Barreling rivers after check-raising | 957–960 |
| 13 | Triple-barrel bluffing | 961–964 |
| 14 | Barreling turns in short stack 4BPs | 965–968 |
| 15 | Limp-call-donk | 969–972 |
| 16 | Defending vs double-barrels in 3BPs | 973–976 |
| 17 | Bluffcatching vs deep stack triple-barrels | 977–980 |
| 18 | Facing turn probes on 4-straight boards | 981–984 |
| 19 | Giving up on the river | 985–988 |
| 20 | Final 3 ICM scenarios | 989–992 |
| 21 | Defending vs huge overbets | 993–996 |
| 22 | Facing double-barrels on monotone flops | 997–1000 |
| 23 | Calling off short stack shoves | 1001–1004 |
| 24 | Defending the BXB line on 4-flush boards | 1005–1007 |
| 25 | Trapping the river OOP | 1008–1011 |
| 26 | Defending vs c-bets in 3BPs | 1012–1015 |
| 27 | Facing river check-raises on flush boards | 1016–1019 |
| 28 | Defending vs c-bets with short stacks | 1020–1022 |
| 29 | Facing block bets on the river | 1023–1026 |
| 30 | Calling down as the OOP PFR in SRPs | 1027–1030 |
| 31 | Facing shoves on 5-straight boards | 1031–1034 |

### 第10章 Chapter 10: Formats — 30 课,阅读器页 1037–1153

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | It's a chop, right?! | 1037–1040 |
| 2 | Bluffing low pairs | 1041–1043 |
| 3 | C-betting after squeezing | 1044–1047 |
| 4 | Check-raising on paired boards | 1048–1051 |
| 5 | Donking vs early position openers | 1052–1054 |
| 6 | Defending vs flop shoves at low SPRs | 1055–1058 |
| 7 | Check-raising flops in 3BPs | 1059–1062 |
| 8 | C-betting semi-connected boards in 3BPs | 1063–1066 |
| 9 | Defending vs polarized turn barrels | 1067–1070 |
| 10 | Range asymmetries after big c-bets | 1071–1074 |
| 11 | Probing the river after big c-bets | 1075–1078 |
| 12 | Check-raise giving up | 1079–1083 |
| 13 | 4-bet shoving in different rake structures | 1084–1086 |
| 14 | 4-bet bluffing HU | 1087–1090 |
| 15 | Min open or shove? | 1091–1093 |
| 16 | Donking out of the SB | 1094–1097 |
| 17 | Fast-playing top pair at low SPRS | 1098–1101 |
| 18 | Defending vs short stack triple barrels | 1102–1105 |
| 19 | Short stack turn barreling after XR | 1106–1108 |
| 20 | Donking out of the BB with short stacks | 1109–1111 |
| 21 | Limping with short stacks | 1112–1115 |
| 22 | Defending the BB in ICM scenarios | 1116–1119 |
| 23 | Constructing MTT c-bet strategies | 1120–1123 |
| 24 | C-betting vs an IP cold caller in MTTs | 1124–1128 |
| 25 | Aggressive postflop play with short stacks | 1129–1132 |
| 26 | Finding thin value in checked down pots | 1133–1136 |
| 27 | Bluff catching vs short stack triple barrel | 1137–1140 |
| 28 | Calling vs short stack shoves | 1141–1144 |
| 29 | 4-betting as the chip leader | 1145–1148 |
| 30 | 3-betting BvB as the mid stack | 1149–1153 |

### 第11章 Chapter 11: All Stars — 31 课,阅读器页 1156–1290

| # | 课程 | 阅读器页 |
|---|------|---------|
| 1 | Fundamental Poker Metrics | 1156–1159 |
| 2 | Basic GTO Math | 1160–1163 |
| 3 | Indifference and Mixed Strategies | 1164–1167 |
| 4 | Evaluating cold-called flop EQR | 1168–1172 |
| 5 | C-betting in 3BPs | 1173–1177 |
| 6 | 3-betting passive players | 1178–1181 |
| 7 | HU cash shortstack limps | 1182–1186 |
| 8 | The more the merrier | 1187–1190 |
| 9 | Defending against polar turn barrels | 1191–1194 |
| 10 | Opening in a cash game | 1195–1199 |
| 11 | Why does donking matter? | 1200–1203 |
| 12 | Depolarized Turn Probes | 1204–1208 |
| 13 | Hero calling triple barrels in 3BP | 1209–1212 |
| 14 | Trapping top set | 1213–1216 |
| 15 | Final Table on the BTN | 1217–1220 |
| 16 | Taking your shot | 1221–1224 |
| 17 | Deriving strategies from Equity Buckets | 1225–1228 |
| 18 | Understanding Range Shapes Postflop | 1229–1233 |
| 19 | The Double-Plateau Distribution | 1234–1237 |
| 20 | Overperformance | 1238–1241 |
| 21 | Why check back good draws? | 1242–1246 |
| 22 | Shortstack Triple Barrel Math | 1247–1250 |
| 23 | How stack depth impacts strategy | 1251–1254 |
| 24 | Overbetting the Turn | 1255–1258 |
| 25 | Countering Value-Heavy 3-bets | 1259–1261 |
| 26 | Bluff-Catching Triple Barrels | 1262–1266 |
| 27 | Constructing Shortstack Turn Shoves | 1267–1271 |
| 28 | Showdown or Shove? | 1272–1275 |
| 29 | Trapping the Turn OOP | 1276–1280 |
| 30 | Block-calling the river | 1281–1284 |
| 31 | Summary | 1285–1290 |
