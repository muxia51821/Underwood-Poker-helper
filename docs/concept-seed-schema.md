# 概念种子 schema 设计(v1)与首批试点概念

> 专项:扑克概念层。前置文档:`docs/ddog-concept-map.md`(章节地图,木下已裁决 D1-D4:全部认可,方向 = 复用嫁接、不另起炉灶)。
> 状态:设计稿 + 试点数据。**本文档尚未落地到 `src/`**,待木下过目后再实施。

## 1. 嫁接路径(数据流)

```text
src/data/conceptSeed.js          原子概念库(本 schema 的载体;新文件,不碰现有种子数据)
        ↓ 引用(按 id)
src/data/pokerLogicSeed.js       8 张 spot 卡改造:四步框架为导航,每格 = 概念引用列表
        ↓
src/modules/pokerLogic.js        渲染层:拉取概念对象渲染;进 HTML 前过 Utils.escapeHtml()
        ↓ (未来)
Quiz 域                          概念 + DDoG 题型原型(只记录,另行设计)
```

- 概念是唯一牌理内容源;spot 卡不再自写叙述。概念可被多张卡引用,一张卡的一格可引用多条概念。
- 与 `externalEvidenceSeed.js`/`gtoBaselineSeed.js` 的关系:**引用不合并**(D4 裁决)。概念条目可选带 `relatedEvidenceIds` 指向证据包 id;两个既有种子文件不动。
- GW 博客 16 篇文章的定位:概念的展开阅读源。书内每课的 "Learn more" 指向对应博客文章,但 PDF 文本层提取不到 URL,**URL 必须逐条核验后才能写入 `relatedSources`,不发明链接**。

## 2. schema v1 字段定义

```js
{
  id: 'concept-pot-odds',              // 'concept-' 前缀 + kebab-case,全库唯一
  title: '底池赔率(Pot Odds)',         // 中文 + 英文原词
  cluster: 'basic-math',               // 概念簇:basic-math | calibration | equity-distribution |
                                       //   range-construction | defensive | offensive
  mechanism: '…',                      // 牌理机制,提炼自来源(附出处),禁止自写叙述冒充;
                                       // 用 equity 分布四技术词汇(Equity Buckets / Range Morphology /
                                       //   Equity Distribution Graphs / EQR)作为解释语言 [D1]
  misconception: '…',                  // 常见误解/反直觉点,提炼自来源课程如何纠偏 [D2]
  applicability: '…',                  // 适用条件与边界;必须含赛制/深度边界(通用概念写"通用") [D6]
  relatedSpotIds: [],                  // 8 张 spot 卡 id(见 pokerLogicSeed.js),可为空
  relatedConceptIds: [],               // 概念间引用,可为空
  relatedEvidenceIds: [],              // 可选:指向既有证据包 id,可为空
  relatedSources: [],                  // 可选:GW 博客等扩展来源对象 {title,url,publisher,articleDate};
                                       //   仅收已核验 URL
  sourceRef: {                         // 主出处 [D4]:DDoG 课程
    kind: 'ddog',                      // 'ddog'(书课)或 'gwblog'(博客文章)
    lesson: 'Pot odds',                // 课程名(书签原文)
    chapter: 1,
    readerPages: '21-23',              // PDF 阅读器页码(印刷页 = 阅读器页 - 1)
    extraction: '正文核验',            // 提取方式标注:正文核验 | 文章表格直读 | 图像复核(留待)
  },
  seedRevision: 1,                     // 升级纪律与现有种子一致
}
```

### 工程规则(沿用既有种子纪律)

- 新文件 `src/data/conceptSeed.js`,顶部 `export var CONCEPT_SEED_VERSION = 'v1'`。
- `store.js` 新增 `_seedConcepts()`,闸门键 `pa_concept_seed_v1`(升版本重播);种子对象**不带 `updatedAt`**;按 `seedRevision` 升级已存条目。
- 概念 id 是 spot 卡与 Quiz 的外键;改名/删除 = 破坏性变更,只能废弃加新。
- 数字纪律:mechanism 中引用的数字必须来自 sourceRef 指向课程的核验;表格数字标「文章表格直读」,文本提取不清晰的图形数字标「图像复核(留待)」并暂不写入。

## 3. 试点概念(13 条,即未来 `conceptSeed.js` v1 的内容预览)

以下每条都基于对应课程**全文精读**核验。来源页码均为阅读器页码。

### 3.1 basic-math 簇

**concept-pot-odds — 底池赔率(Pot Odds)**
- mechanism:底池赔率 = 需跟注额 / 跟注后的总底池,给出「平均需要赢回底池多大比例才值得跟注」的门槛(书例:转牌 5bb 进 10bb 池,跟注后 20bb,门槛 25%)。CH11 版本公式含减 rake 项。它回答"赢多少才够",不等于"手里牌有多少 equity"——有后续行动时,真实的门槛是实现后的份额而非 raw equity。
- misconception:把「需要 25% equity」直接等同于 raw equity 比较;书课的钩子就是「spot the lie」:equity ≠ value。
- applicability:通用(所有赛制/深度);河牌无后续行动时可直接与 raw equity 比较。
- relatedSpotIds:8 张全部(防守问句都要过这道门槛)。
- relatedConceptIds:concept-equity, concept-equity-realization, concept-alpha-mdf。
- sourceRef:DDoG《Pot odds》CH1 阅读器 21-23;《Basic GTO Math》CH11 阅读器 1160-1163。提取:正文核验。

**concept-alpha-mdf — Pot Odds / Alpha / MDF 三件套与尺寸对照表(Basic GTO Math)**
- mechanism:三者是同一枚硬币的三面,由下注尺寸 s 互相锁定:pot odds = s/(2s+1)(需跟注方 equity 门槛);alpha = risk/(risk+reward)(纯诈唬需要的弃牌率);MDF = 1 − alpha(防守方最低防守频率)。书内对照表(8 个尺寸,「文章表格直读」,CH5 阅读器 397):10%→8%/91%/9%,25%→17%/80%/20%,33%→20%/75%/25%,50%→25%/67%/33%,75%→30%/57%/43%,100%→33%/50%/50%,125%→36%/44%/56%,150%→38%/40%/60%(顺序:pot odds / MDF / alpha;价值:诈唬比 = 1−alpha : alpha)。
- misconception:把 MDF 当成"必须守住的义务"。CH5《MDF vs Pot Odds》示范:对方明显 under-bluff 时,没有 pot odds 就该弃,「solver 在河牌面对极化范围会立即弃掉一切没有足够 pot odds 的手,不管 MDF」。
- applicability:通用;表值是无 rake 理论值,rake 与 blocker 会让真实解偏向价值(书例:pot 尺寸全下理论上 2:1,核验解约 70/30,见 concept-value-bluff-ratio)。
- relatedSpotIds:btnvsbb-caller-facebet, sbvsbb-raiser-riverdual, covsbtn-caller-facebet。
- relatedConceptIds:concept-pot-odds, concept-indifference, concept-value-bluff-ratio, concept-mdf-boundary。
- sourceRef:DDoG《Basic GTO Math》CH11 阅读器 1160-1163;《Balancing your blastoffs》CH5 阅读器 394-398;《MDF vs Pot Odds》CH5 阅读器 512-516。提取:正文核验 + 文章表格直读。

**concept-indifference — 无差别(Indifference)**
- mechanism:无差别 = 两个及以上动作 EV 相等(EV(动作1) = EV(动作2)),是 solver 构造策略的手段:进攻方把对手特定手类推到无差别点(如用尺寸"瞄准"手类),防守方的混合频率就是为了维持对手的无差别。书例:BB 面对 125%/125%/pot 三街线,顶对 equity 恰好被压到 33%(pot 尺寸的跟注门槛),全顶对 call/fold 无差别,可任意混合而不损 EV。
- misconception:无差别 ≠ 0EV(价值手可以在两个 +EV 动作间无差别);也 ≠ "solver 不确定"。call-fold 无差别是特例(跟注 EV = 弃牌 EV = 0)。
- applicability:通用;本概念是产品呈现「混合频率」时的语义基础(混合是结构性结果,不是掷骰子)。
- relatedSpotIds:btnvsbb-caller-facebet, sbvsbb-raiser-riverdual, btnvsbb-raiser-riverbet。
- relatedConceptIds:concept-value-bluff-ratio, concept-alpha-mdf。
- sourceRef:DDoG《Understanding indifference》CH1 阅读器 67-69;《What is indifference actually?》CH5 阅读器 407-409;《Indifference and Mixed Strategies》CH11 阅读器 1164-1167。提取:正文核验。

### 3.2 equity-distribution 簇

**concept-equity — Equity 的严格定义(Equity Buckets)**
- mechanism:equity = 若底池直接 check 到摊牌,你期望赢得的底池百分比(计入平分)。分 hand-vs-hand / range-vs-range / hand-vs-range 三种测量。"真正的份额"(投资者语义)= EV/底池;但存在后续行动时拿不到"公平份额"——位置/范围/nut 优势会把 EV 扭向一方。
- misconception:equity = "赢的频率"(错:是期望份额,含平分;且只是 check-down 假设下的量)。
- applicability:通用;所有 equity 数字(含产品内的 equity 引用)都应按此口径解释。
- relatedConceptIds:concept-equity-realization, concept-equity-buckets。
- sourceRef:DDoG《What is equity?》CH6 阅读器 532-535。提取:正文核验。

**concept-equity-realization — Equity 实现(EQR)**
- mechanism:EQR = EV pot share / equity pot share(= EV/(equity×pot)),衡量一只手把 check-down equity 转化为实际 EV 的效率。书例(CH11,正文核验):BTN A3s 在 Q32-J77 面,45.6% equity → check-down 期望 2.5bb(池 5.5bb),实际最优线 EV 1.39bb,只实现 55%。OOP、易被 hyper 开火、无后门可见度的手欠实现;反之超实现。
- misconception:把 EQR 理解为"打到摊牌的频率"或"含糊无定义的词"(CH6 quiz 两个错误选项正是这两种);它有精确定义,是分布镜头的核心指标之一。
- applicability:通用;产品呈现"OOP 防守更窄"类结论时,EQR 是底层解释之一(见《Overfolding and MDF》修正后的机制,concept-oop-defense-note 未立条,先挂在 alpha-mdf 边界)。
- relatedSpotIds:btnvsbb-caller-facebet, btnvsbb-caller-riverfirst, covsbtn-caller-facebet。
- relatedConceptIds:concept-equity, concept-equity-buckets。
- sourceRef:DDoG《Equity Realization》CH1 阅读器 70-71;《What exactly is equity realization?》CH2 阅读器 114-117;《What is EQR?》CH6 阅读器 626-628;《Fundamental Poker Metrics》CH11 阅读器 1156-1159。提取:正文核验(A3s 例);QT 数值表文本提取错乱,弃用,留图像复核。

**concept-equity-buckets — Equity Buckets(把 equity 看成分布)**
- mechanism:range-vs-range equity 是单一数字,但把手类分桶(Best/Good/Weak/Trash)后,同样的 50/50 可以有完全不同的分布形状——一侧极端极化即占大优(书课原例:总体 50/50,但一侧远比另一侧极化,就是大优势)。分布形状直接决定策略形态:极化分布倾向大注、目标把筹码在河牌前打进去;完美极化下应几何式下注(每街等比例,最大化对方 call-down 范围)。机制术语:极化方的"clairvoyant"信息优势——知道自己领先还是落后,对方不知道。
- misconception:只看 equity 总数比较强弱,忽略分布形状(同一总数,策略可以完全不同)。
- applicability:通用;是 spot 卡「街牌效应」格的解释语言(牌 = 把分布形状改变的事件)。
- relatedConceptIds:concept-range-morphology, concept-nut-advantage, concept-equity-realization。
- sourceRef:DDoG《Equity buckets》CH1 阅读器 36-37;《Translating buckets to range shapes》CH6 阅读器 536-540。提取:正文核验。

**concept-range-morphology — Range Morphology 四形态**
- mechanism:把范围当结构而非 1326 组合(CH1 阅读器 53-54,正文核验定义):Polarized = 强+弱两端;Linear = 自顶向下的强到中;Condensed = 以中等为主;Merged = 极化与线性之间。书内配对练习(CH6 阅读器 561-564 与 CH11 阅读器 1229-1233,正文核验):CO RFI = linear;BB 3-bet vs SB open = polarized(极强+极弱);BTN flat vs HJ open = condensed/depolarized;BB 3-bet vs BTN open = merged(nuts+诈唬+中等价值抽牌);flop call 后范围 = condensed;XR = 极化为主可带少量中等做平衡;7-turn 超池 probe(trips+ 价值 + gutshot 诈唬、无中等)= polarized;三街 call-down 只留最好手 = linear。
- misconception:把四形态当同义词混用;实际每条线(下注/跟注/XR/probe)会把自己的范围"塑"成特定形态,形态又反推下注尺寸选择。
- applicability:通用;spot 卡「线语义」格的解释语言。
- relatedConceptIds:concept-equity-buckets, concept-nut-advantage。
- sourceRef:DDoG《Range Morphology》CH1 阅读器 53-54;《Fundamentals of morphology》CH6 阅读器 561-564;《Understanding Range Shapes Postflop》CH11 阅读器 1229-1233。提取:正文核验;CH11 配对表的表格列序文本提取有歧义,仅收解释段明确的两例,其余留图像复核。

**concept-equity-distribution-graph — Equity Distribution Graph 的读法(暂缓入种子,先立条占位)**
- mechanism:x 轴 = 手在自己范围内按 raw equity 排的百分位;y 轴 = 该手对对方范围的手-vs-范围 equity。书例:QQ 在 BTN 范围第 50 百分位、对 CO 70% equity。比 buckets 分辨率更高,可快速看出 range advantage 与 nut advantage。
- misconception:把图的横轴当成"牌力排名",错——是"自己范围内的 equity 百分位"。
- applicability:GW 工具视角;概念本身通用,但产品无此图,只作解释背景。
- sourceRef:DDoG《Equity Distribution Graphs》CH6 阅读器 594-597。提取:正文核验。
- 备注:本条暂不进 v1 种子(产品无渲染载体),schema 占位说明用途;后续 Quiz 域可复用。

### 3.3 range-construction 簇

**concept-nut-advantage — Nut Advantage(与 range advantage 的分工)**
- mechanism:nut advantage = 范围中 nut 部分的相对优势,决定**能多极化、能下多大**:下大注会快速收窄对方范围,价值注必须在被跟注时能从对方范围顶部收到钱;没有 nut advantage 时大注失去支撑。range advantage(平均 equity 优势)则支撑高频小注。书例(CH9,正文核验):443 面被跟注后,HJ 在 4 转牌下注最凶——4 不是 HJ equity 最高的转牌,但最能放大 overpair 优势、制造弃牌激励:nut/范围优势的激励侧写。
- misconception:把「我整体 equity 高」直接推出「我应该下大」;支撑大注的是 nut 部分而非平均优势。
- applicability:通用;大注/超池相关结论的先决检查项。
- relatedSpotIds:btnvsbb-raiser-cbet, sbvsbb-raiser-cbet, btnvsbb-raiser-riverbet。
- relatedConceptIds:concept-equity-buckets, concept-range-morphology。
- sourceRef:DDoG《Nut advantage》CH1 阅读器 48-49;《Leveraging nut advantages on turns》CH9 阅读器 940-944。提取:正文核验。

**concept-backdoor-equity — Backdoor Equity(后门可见度)**
- mechanism:backdoor = 转牌才能成抽牌的能力,给手更好的"可见度":能开更多转牌枪、实现更多 equity、后街导航更灵活。书例(CH1,正文核验):QTs 在 8-7-5 面可在 19 张不同转牌上成抽牌(逐张清单文本提取不全,总数已核验,清单留图像复核)。花色维度:rainbow 面先看"哪个花色不在面上"(CH5《Backdoor suits》,正文核验):冷跟方会跟带 BDFD 的高张而弃无 BDFD 的同手,故持有面外花色会 block 弃牌、unblock 跟注——价值手想被跟时,希望持有面外花色。
- misconception:把 backdoor 当可有可无的小权益;实际是同点数手之间 EV 与可见度差异的主要来源之一;另一个方向误区:价值手拿"block 弃牌"的花色还去开大注。
- applicability:通用;flop/turn 格纹理判断的标准检查项。
- relatedSpotIds:btnvsbb-raiser-cbet, sbvsbb-raiser-cbet, covsbtn-raiser-cbet, btnvsbb-raiser-riverbet。
- relatedConceptIds:concept-blockers, concept-equity-realization。
- sourceRef:DDoG《Pay attention to backdoors》CH1 阅读器 38-39;《Backdoor suits》CH5 阅读器 461-465。提取:正文核验(19 张总数);逐张清单留图像复核。

**concept-blockers — Blocker 与其生效条件**
- mechanism:blocker = 移除对方具体组合的卡片效应。生效条件(CH1,正文核验):范围窄、价值/诈唬集中在少数关键牌上时影响大;范围宽、价值/诈唬分散时影响小。应用范式一(CH1《Using filters》,正文核验):QJ7 面 BTN 125% 超池,BB 持 8/9 会重 block BTN 的诈唬区 → 更可能面对价值 → Q9/Q8s 这类顶对选择弃牌。应用范式二(见 concept-backdoor-equity 的花色范式)。
- misconception:「有好 blocker 就可以打得更凶」无条件成立;先检查双方范围宽度与关键牌集中度。
- applicability:通用;河牌格(block 选择)与防守格(跟注选择)的标准检查项。
- relatedSpotIds:btnvsbb-raiser-riverbet, sbvsbb-raiser-riverdual, btnvsbb-caller-riverfirst。
- relatedConceptIds:concept-backdoor-equity, concept-bluff-catching。
- sourceRef:DDoG《When do blockers actually matter?》CH1 阅读器 57-58;《Using filters to examine blockers》CH1 阅读器 50-52;《Backdoor suits》CH5 阅读器 461-465。提取:正文核验。

### 3.4 defensive 簇(河牌三卡的主粮)

**concept-bluff-catching — 抓诈唬三问**
- mechanism:河牌面对下注按顺序问三问(CH1,正文核验):1) 我能否打过诈唬组合?2) 对方诈唬频率是否让我有 pot odds(下注尺寸 s 对应门槛 s/(2s+1))?3) 我的手是否 block 对方价值 / unblock 对方差唬?前两问不过 → 弃;第三问决定同强度手里的选择。配合 concept-indifference 的书例:面对 125/125/pot 线,BB 顶对被压到恰好 33% equity,call/fold 无差别。
- misconception:只用"我牌大不大"思考抓诈唬;三问的第二问与对手模型耦合(对方明显 under-bluff 时第二问直接否决,见 concept-mdf-boundary)。
- applicability:通用;sbvsbb-raiser-riverdual「面对下注」问句、btnvsbb-caller-riverfirst 的核心句式。
- relatedSpotIds:btnvsbb-caller-riverfirst, sbvsbb-raiser-riverdual, btnvsbb-raiser-riverbet。
- relatedConceptIds:concept-pot-odds, concept-blockers, concept-indifference, concept-mdf-boundary。
- sourceRef:DDoG《Bluff-catching rivers》CH1 阅读器 46-47;《Indifference and Mixed Strategies》CH11 阅读器 1164-1167。提取:正文核验。

**concept-value-bluff-ratio — 价值:诈唬比(使对方无差别的构造)**
- mechanism:极化下注中,诈唬占比应等于对方的 pot odds 门槛:诈唬多了对方全弃 +EV,少了对方全弃诈唬抓手也无损——对方无差别即最优。书例(正文核验):75% pot → 诈唬 30%;pot 尺寸理论 1/3 诈唬,核验解约 70/30 偏价值(rake + blocker 效应使真实解价值更重);同课核验:BTN 三街线在河牌放弃 36%(多为 0% EQ 手),恰等于 BB 面对 125% 转牌注的 36% pot odds——上一街的防守门槛就是下一街的构造约束。
- misconception:把「理论比」当死表;理论值(rake=0、纯极化)与核验值的偏差方向(偏价值)和原因(rake、blocker)本身是知识。
- applicability:通用,但数值表随下注尺寸与 rake 变;斑点卡引用时先给机制句,数值仅示意。
- relatedSpotIds:btnvsbb-raiser-riverbet, sbvsbb-raiser-riverdual。
- relatedConceptIds:concept-alpha-mdf, concept-indifference。
- sourceRef:DDoG《Balancing bluffs》CH2 阅读器 174-176;《Balancing your blastoffs》CH5 阅读器 394-398;《Bet-Bet-Jam Construction》CH5 阅读器 403-406。提取:正文核验 + 文章表格直读。

**concept-mdf-boundary — MDF 是下界不是目标(校准)**
- mechanism:MDF 的功能是让 0% equity 的纯诈唬无差别,防的是**对方过度诈唬**;对方 clearly under-bluff 时它不再相关——没有 pot odds 的手直接弃(CH5 示范:pot 尺寸全下、对方明显价值偏重,顶半段纯诈唬抓手也弃;「GTO 面对极化范围时,solver 会立即弃掉一切无足够 pot odds 的河牌手,不管 MDF」)。防守频率可以高于表观 MDF 的原因之一是 blocker 制造的"幽灵组合"(CH9 例,正文核验:表观 19% > MDF 14%,扣除被对方全下范围 block 掉、HJ 根本拿不到的组合后,实际恰在 MDF)。
- misconception:三类:1) 把 MDF 当义务(under-bluff 对手面前硬守);2) 把「OOP 过弃」归因于「BB 有 preflop 折扣」(CH2 全文明确点名这是常见误解,BvB 分析显示 BB 平均防守接近 MDF;真实机制 = IP 的 check 选项抬高 OOP 防守门槛:OOP 只需让 IP 的下注不优于 check,不需要把诈唬压到 0EV);3) 表观频率 ≠ 有效频率(幽灵组合)。
- applicability:通用校准;产品呈现频率类 GTO 基线时的语义边界(与 V7.10.5「结构性参考」裁决同向)。
- relatedSpotIds:btnvsbb-caller-facebet, covsbtn-caller-facebet, sbvsbb-raiser-riverdual。
- relatedConceptIds:concept-alpha-mdf, concept-bluff-catching, concept-indifference。
- sourceRef:DDoG《MDF vs Pot Odds》CH5 阅读器 512-516;《Overfolding and MDF》CH2 阅读器 164-167;《Facing river check-raises on flush boards》CH9 阅读器 1016-1019。提取:正文核验。

## 4. 本批核验说明(诚实边界)

- 13 条全部基于对应课程全文精读;「文章表格直读」仅用于 CH5 阅读器 397 尺寸对照表与 Bet-Bet-Jam 的 70/30。
- 两处文本提取不可靠、**已主动弃用**而非写入:CH2 QT 的 EQR 数值表、CH1 backdoor 逐张转牌清单、CH11 形态配对表的列序——均标「图像复核(留待)」,后续用页面渲染 PNG 逐张核验后再补。
- 《Overfolding and MDF》全文修正了地图初稿的一个表述:地图曾写"BB 折扣与过弃的相容",全文核验后确认"BB 折扣"恰是该课点名的**错误选项**,真实机制是 check 价值抬高防守门槛。地图文档已同步修正。
- GW 博客 URL 一律未写入本批(不发明链接);书内 "Learn more" 指向的对应文章 URL 需逐条到 GW 博客核验后再补 `relatedSources`。

## 5. 实施记录(as-built,2026-08-31,V7.11.1)

1. ✅ `src/data/conceptSeed.js`(v1,13 条;`// [V7.11.1 新增]` 注释与来源内联)。
2. ✅ **与原计划的偏差**:未新增 `store.js _seedConcepts()` 与闸门键 `pa_concept_seed_v1`——概念是静态只读知识(不可被用户编辑),与现有 `pokerLogicSeed.js` 一致采用直接 ES module import,避免为零收益引入 localStorage 迁移面。若未来概念需要用户标注(如"已掌握"),再引入存储与闸门。闸门键/seedRevision 纪律仅约束会落库的种子,不适用于本文件。
3. ✅ `pokerLogicSeed.js` 升 v2:四步框架保留,每格 = 导航语 + `conceptIds` 引用列表(空引用 = 显式缺口);匹配字段(`street/scenario/role/question`)、`evidenceRefs`、`boundary` 原样保留;v1 叙述字段(`rangeStory/lineNotes/streetEffect/deviation`)移除且契约测试断言不得回归。
4. ✅ `pokerLogic.js`:四步渲染概念卡(机制/误解/适用边界/来源行)。
5. ✅ 版本:木下裁决走 **7.11.1**(小改动不跳 minor 位);constants/package.json/lockfile/CHANGELOG/CONTEXT 已同步。`npm run check` 全绿(2026-08-31)。
6. ✅ as-built 微调(review 后确认):概念条目的 `relatedSpotIds` 以 8 张卡 `steps.conceptIds` 的实际反向索引为准(第 3 节预览中个别条目按卡收窄,如 pot-odds 挂两张防守卡而非"8 张全部");反向索引自洽性由契约测试核对。渲染层 `esc()` 修复为真转义(浏览器路径走 `Utils.escapeHtml`,node 契约测试无 DOM 时用语义等价的纯 JS 转义)。

## 6. 提炼覆盖台账（典型 / 全本）

- **全本**：全书 334 课的结构与页码索引见 `docs/ddog-concept-map.md` 附录 A（同一本参考源的完整台账）。
- **典型**：以下课程已全文精读并提炼进概念库/应用层（截至 V7.11.2，按章分组）：

- CH1（18）：Pot odds、Implied odds、Equity buckets、Nut Potential、Range Morphology、Nut advantage、Pay attention to backdoors、Bluff-catching rivers、Using filters to examine blockers、When do blockers actually matter?、Visualizing MDF and Pot odds、Understanding indifference、Equity Realization、Pure mistakes vs frequency mistakes、Targeting hand classes、Finding the thresholds、A hand in a vacuum is meaningless、What does GTO aim to achieve
- CH2（8）：Balancing bluffs、Overfolding and MDF、What exactly is equity realization?、Where do pot odds and MDF meet?、Suitedness and aggression、C-Betting against IP cold-callers、Splitting value on the river、Linear vs Polarized 3-betting
- CH3（2）：Rangebetting vs cold-callers OOP、Raising the river in position
- CH4（1）：Building block bets OOP
- CH5（15）：What is indifference actually?、Balancing your blastoffs、Bet-Bet-Jam Construction、MDF vs Pot Odds、Backdoor suits、Overbet sizing motifs、The Vluff、How thin should you raise the river?、Should you donk into a rangebettor?、Solver noise、How to interpret solver accuracy?、Clairvoyant Defense、Understanding ICM、Risk Premium、MDF facing draws
- CH6（7）：What is equity?、What is EQR?、Translating buckets to range shapes、Fundamentals of morphology、Equity Distribution Graphs、Check-raising dry boards、Probing turn bricks
- CH7（1）：Donking monotone turns
- CH8（13）：Should you rangebet these flops?、Countering range-bettors、Facing cold-callers OOP、Depolarized turn barrels、River probe blocks、Raising flop c-bets in position、Overdefend pre - Overfold post、Donking the flop、Block-Block-Jam OOP 3BP、Splitting the turn OOP BvB、Triple Barrel Fold、Probing the river on dry runouts、Value betting with <50% equity、Overbetting vs condensed ranges
- CH9（7）：Leveraging nut advantages on turns、Countering Double-Barrels BvB、Trapping the river OOP、Facing block bets on the river、Triple-barrel bluffing、Giving up on the river、Facing river check-raises on flush boards
- CH10（2）：Check-raising on paired boards、Donking vs early position openers
- CH11（11）：Fundamental Poker Metrics、Basic GTO Math、Indifference and Mixed Strategies、Understanding Range Shapes Postflop、Why does donking matter?、Depolarized Turn Probes、Trapping top set、Showdown or Shove?、Block-calling the river、Why check back good draws?、3-betting passive players

合计约 85 课已提炼（占全书 334 课的 ~25%），覆盖 8 张 spot 卡的全部格子与概念骨干；其余课程按需在后续批次点选。

## 7. 提炼覆盖台账（典型 / 全本）

- **全本**：全书 334 课的结构与页码索引见 `docs/ddog-concept-map.md` 附录 A（同一本参考源的完整台账）。
- **典型**：以下课程已全文精读并提炼进概念库/应用层（截至 V7.11.2，按章分组，括号内为阅读器页码）：

- CH1（18 课）：Pot odds(21-23)、Implied odds(33-35)、Equity buckets(36-37)、Nut Potential(55-56)、Range Morphology(53-54)、Nut advantage(48-49)、Pay attention to backdoors(38-39)、Bluff-catching rivers(46-47)、Using filters to examine blockers(50-52)、When do blockers actually matter?(57-58)、Visualizing MDF and Pot odds(62-64)、Understanding indifference(67-69)、Equity Realization(70-71)、Pure mistakes vs frequency mistakes(72-73)、Targeting hand classes(59-61)、Finding the thresholds(65-66)、A hand in a vacuum is meaningless(17-18)、What does GTO aim to achieve?(26-27)
- CH2（8 课）：Balancing bluffs(174-176)、Overfolding and MDF(164-167)、What exactly is equity realization?(114-117)、Where do pot odds and MDF meet?(86-89)、Suitedness and aggression(90-92)、C-Betting against IP cold-callers(100-103)、Splitting value on the river(150-152)、Linear vs Polarized 3-betting(110-113)
- CH3（2 课）：Rangebetting vs cold-callers OOP(228-231)、Raising the river in position(203-205)
- CH4（1 课）：Building block bets OOP(387-391)
- CH5（15 课）：What is indifference actually?(407-409)、Balancing your blastoffs(394-398)、Bet-Bet-Jam Construction(403-406)、MDF vs Pot Odds(512-516)、Backdoor suits(461-465)、Overbet sizing motifs(440-443)、The Vluff(472-476)、How thin should you raise the river?(494-497)、Should you donk into a rangebettor?(477-480)、Solver noise(410-412)、How to interpret solver accuracy?(436-439)、Clairvoyant Defense(420-424)、Understanding ICM(444-447)、Risk Premium(481-484)、MDF facing draws(432-435)
- CH6（7 课）：What is equity?(532-535)、What is EQR?(626-628)、Translating buckets to range shapes(536-540)、Fundamentals of morphology(561-564)、Equity Distribution Graphs(594-597)、Check-raising dry boards(585-588)、Probing turn bricks(573-576)
- CH7（1 课）：Donking monotone turns(686-689)
- CH8（13 课）：Should you rangebet these flops?(777-781)、Countering range-bettors(782-786)、Facing cold-callers OOP(795-798)、Depolarized turn barrels(813-816)、River probe blocks(817-820)、Raising flop c-bets in position(821-824)、Overdefend pre - Overfold post(830-834)、Donking the flop(844-847)、Block-Block-Jam OOP 3BP(848-852)、Splitting the turn OOP BvB(853-856)、Triple Barrel Fold(861-865)、Probing the river on dry runouts(866-870)、Value betting with <50% equity(875-878)、Overbetting vs condensed ranges(891-894)
- CH9（7 课）：Leveraging nut advantages on turns(940-944)、Countering Double-Barrels BvB(931-934)、Trapping the river OOP(1008-1011)、Facing block bets on the river(1023-1026)、Triple-barrel bluffing(961-964)、Giving up on the river(985-988)、Facing river check-raises on flush boards(1016-1019)
- CH10（2 课）：Check-raising on paired boards(1048-1051)、Donking vs early position openers(1052-1054)
- CH11（11 课）：Fundamental Poker Metrics(1156-1159)、Basic GTO Math(1160-1163)、Indifference and Mixed Strategies(1164-1167)、Understanding Range Shapes Postflop(1229-1233)、Why does donking matter?(1200-1203)、Depolarized Turn Probes(1204-1208)、Trapping top set(1212-1216)、Showdown or Shove?(1272-1275)、Block-calling the river(1281-1284)、Why check back good draws?(1242-1246)、3-betting passive players(1178-1181)

合计约 85 课已提炼（占全书 334 课的 ~25%），覆盖 8 张 spot 卡全部格子与概念骨干；其余课程按需在后续批次点选。

## 8. V7.11.3 补充台账（扩量后）

V7.11.3 概念库扩至 34 条后，新增提炼课程：CH1 Implied odds(33-35)、Nut Potential(55-56)、Pure mistakes vs frequency mistakes(72-73)、Targeting hand classes(59-61)、Finding the thresholds(65-66)、A hand in a vacuum(17-18)、What does GTO aim to achieve(26-27)；CH2 Linear vs Polarized 3-betting(110-113)；CH5 Solver noise(410-412)、How to interpret solver accuracy(436-439)、Clairvoyant Defense(420-424)、Understanding ICM(444-447)、Risk Premium(481-484)、MDF facing draws(432-435)；CH11 3-betting passive players(1178-1181)、Why check back good draws(1242-1246)。合计约 101 课已精读（占全书 ~30%）。

## 9. V7.11.4 补充台账（概念库 46 条）

新增提炼课程：CH1 Mixed strategies(43-45)；CH2 What's the point of mixing(143-146)、C-bet sizing in 3-bet pots(97-99)、Exploiting value heavy players(118-120)、Exploiting trappy players(125-128)、Effects of stack depth(168-170)；CH3 Which hands like going multiway(193-195)；CH4 Double overbet diligence(357-359)、Delayed c-betting limped pots(354-356)；CH5 MDF facing bluffs with showdown value(428-431)、Overbetting pocket pairs(490-493)、Strategic Domination(507-511)、Push-folding EV(457-460)；CH6 Equity realization and stack depth(645-647)；CH8 Squeezing out of position(825-829)、Owning draws with big turn bets(879-882)；CH9 Delay c-betting OOP in 3BPs(920-923)；CH10 4-bet shoving in different rake structures(1084-1086)、C-betting semi-connected boards in 3BPs(1063-1066)；CH11 C-betting in 3BPs(1173-1177)、The more the merrier(1187-1190)、Opening in a cash game(1195-1199)、How stack depth impacts strategy(1251-1254)。

累计约 117 课已精读（占全书 ~35%），概念库 46 条（自测题 35 道）、spot 应用 44 条。Quiz 训练器升级为交互判分，掌握度存 `pa_concept_quiz_mastery`。

## 10. V7.11.4 图像复核（3 处遗留全部关闭）

PDF 页面渲染 PNG（pymupdf, 150dpi）逐张人工核验：

1. **QT EQR 数值表**（CH2《What exactly is equity realization?》printed 115-116）：Q♣T♣ check 线（Bet 0%）EV 2.6bb、EQ 67.51%、EQR 70.71%——BB OOP 只实现约七成 equity。已作为图像复核对比例写入 concept-equity-realization。
2. **Backdoor 19 张转牌**（CH1《Pay attention to backdoors》printed 38）：board Q♥7♦5♣、手牌 T♥8♥，任意 6、9、J 或 ♥ 共 19 张转牌成抽牌。**修正**：此前种子误写"QTs 在 8-7-5 面"（手牌与牌面均错），已改为 T8s/Q♥7♦5♣。
3. **CH11 形态配对表**（printed 1229-1230）：按颜色圈配对（非行序）确认 flop call→Condensed、XR→Merged、probe(A♥ turn)→Polarized、call-down 三街→Linear，与解释段一致。已写入 concept-range-morphology mechanism（标注图像复核）。

另：pokerLogic.js evidenceLine 补 href 协议白名单（复用 decisionRadar._safeExternalUrl 模式，仅 http/https 渲染为链接，其余降级纯文本）——关闭 review 提出的注入面旧账（pokerLogic 侧；decisionRadar 侧已有防护）。

## 11. V7.11.5 补充台账（概念库 52 条）

新增提炼课程：CH6 Symmetrical Distributions(541-544)、Polarized Distributions(545-548)、Guess the line! #1(549-553)、Guess the stack depth(558-560)、The staircase distribution(609-613)、The no-bluff shove(614-617)、The no-nut shove(618-621)、Gutshot performance(641-644)、Can both ranges underperform(633-636)、Realizing the best turn cards(637-640)；CH9 Facing turn probes on 4-straight boards(981-984)、Defending the BXB line on 4-flush boards(1005-1007)、Bluffcatching vs deep stack triple-barrels(977-980)、Defending vs huge overbets(993-996)。

累计约 131 课已精读（占全书 ~39%），概念库 52 条（自测 40 道）、spot 应用 45 条。Equity Distribution Graph 从占位转正，四大 equity 分析技术在概念库中全部就位（Buckets/Morphology/Distribution Graphs/EQR）。

## 12. V7.11.8 补充台账（批次 A：CH11 收尾，概念库 53 条）

新增提炼课程：CH1 Understanding variance(40-42)；CH11 Evaluating cold-called flop EQR(1168-1172)、Overperformance(1238-1241)、The Double-Plateau Distribution(1234-1237)、Defending against polar turn barrels(1191-1194)、Hero calling triple barrels in 3BP(1209-1212)、Bluff-Catching Triple Barrels(1262-1266)、Shortstack Triple Barrel Math(1247-1250)、Constructing Shortstack Turn Shoves(1267-1271)、Trapping the Turn OOP(1276-1280)、Overbetting the Turn(1255-1258)、Countering Value-Heavy 3-bets(1259-1261)、HU cash shortstack limps(1182-1186)、Final Table on the BTN(1217-1220)。

9 课"已读未提炼"处置完成：8 课以正式 sourceRef 对比条目补标（Using filters/Understanding Range Shapes 原有行内引用维持）、Probing OOP on Ace high boards 新增 probe 对比。Taking your shot 归个人 OS 域待办。累计精读 145 课（约全书 43%），概念库 53 条、自测 53 道、应用 45 条。

## 13. V7.11.9 补充台账（批次 B：多题制，题库 68 题）

新增全文精读课程（CH2 首页级→全文升级，18 课）：Guess the hand(76-78)、Which set has the most EV?(79-82)、Over-realizing equity(83-85)、Rangebetting UTG(93-96)、Valuing hands on monotone flops(104-106)、What does EV really mean?(107-109)、Fundamental laws in poker(121-124)、Range vs Range(129-131)、Perfect polarity(132-135)、Check-raise barreling(136-138)、When to donk the turn?(139-142)、Calculating Expected Value(147-149)、Scared underpairs(153-156)、Angry underpairs(157-159)、Prisoners dilemma(160-163)、Infinite quads(171-173)、What's the difference?(177-179)、Explosive flops(180-184)。

Schema v8：selfCheck 单题 → selfChecks 数组。15 道第二题挂靠：equity-realization（987 面 A6s 最高 EQR）、range-bet（JT9）、mdf-boundary（pot odds 唯一恒真定律）、hand-in-vacuum（对方不打固定策略）、value-bluff-ratio（quads 也 range-check）、mixed-strategies（双目的）、equity（EV 相对弃牌、98.91bb）、board-distribution-shapes（632r 最炸池=双方 EV 接近）、backdoor-equity（22 带花 out 更干净）、check-raise-construction（转 3 顺子最多）、donk-bet（75% 线底对失衡）、thin-value（EV 手算 4.95<7）、blockers（JJ set 最能榨值）、nut-advantage（AK9 被 QJ 否定 nut 优势）、rake-impact（50NL flat/500NL raise 弱占优）。对比 +4：monotone 实现规律、弃牌权益不均质、几何式 54%×3、短码 TT shove（批次 A 已加）。题库 68 题、累计精读 163 课（约全书 49%）。Guess the hand 一课留存未用（11-outs 手牌推理题，单选格式不适配）。

## 14. V7.11.10 补充台账（批次 C：CH7 深度维度，概念库 53 条）

新增全文精读课程：CH7 Limping premiums(650-654)、Building short-stack turn shoves(659-662)、Shoving draws on the flop(670-673)、Trapping the turn BvB(708-711)、So many flush draws to choose from!(732-735)、Static bluff-catchers in deep 3BP(741-744)、5-Flush deepstack river 3-bets(754-758)、Deepstack value shove thresholds(759-763)、Deepstack triple barrel math(764-767)。

产出：+9 对比（挂 implied-odds ×2/thin-value/mdf-draws/trapping/blockers/bluff-catching/4straight-chop-defense/overbetting）+ alpha-mdf 第二题（200bb 三街连乘计算：18%/25%）+ spot 应用 2 条（btn6 深度阈值弹性、btn2 深度应对谱 12.2/55.7 vs 15.5/48.5）。深度维度从 1/30 提升到 10/30。累计精读 172 课（约全书 52%），概念库 53 条、应用 47 条、自测 54 道（69 题库含 alpha-mdf 第二题——与 batch B 合计）。

更正：题库计数——batch B 后题库 68（53+15），batch C 新增 alpha-mdf 第二题 → 69。此前第 13 节的"题库 68 题"为 batch B 时点数。
