// [V7.11.16 新增] Source-based reading paths; shared turn lessons also supply hand-card applications.
const D = (lesson, chapter, readerPages) => ({ kind: 'ddog', lesson, chapter, readerPages, extraction: '正文核验与牌例图像复核' });
const A = (lesson, readerPages) => ({ kind: 'aonlh', book: '无限德州扑克应用指南', lesson, readerPages, extraction: '正文核验' });
const step = (text, conceptIds, sourceRef) => ({ text, conceptIds, sourceRef });

export const TURN_DECISIONS = [
  {
    id: 'barrel', title: '二枪：不是把翻牌下注再做一次', role: 'raiser', scenarios: ['BTNvsBB', 'SBvsBB', 'COvsBTN'],
    steps: {
      scope: step('先把翻牌下注者与跟注者的范围分别留下来。跟注不是带着翻前全范围到转牌：一些强牌可能已加注，一些空气已弃牌，部分中段和听牌则留下。先确认这些过滤，再判断自己的价值段。', ['concept-range-morphology'], A('转牌圈在有利位置将牌归入正确的范围', '132-135')),
      lines: step('深码二枪的尺寸服务于价值段和河牌计划。DDoG 的 CO vs BB、6max / 200bb cash 例子：K♠7♠4♦ 翻牌下注 33% 被跟，J♦ 转牌增加 CO 的强价值组合；以两对以上为主超池，多数一对过牌。它说明坚果优势如何支持建大池，不是所有小 C-bet 后都必须超池。', ['concept-turn-barrel', 'concept-nut-advantage'], D('Turn barreling after small flop cbet', 8, '791-794')),
      streets: step('对照 SB vs BB、6max / 100bb cash 的 A♠9♥3♥ 例子：成花或牌面成对会给 BB 的跟注范围补进更多强牌，SB 因而缩小尺寸，并容纳更多中等强度价值手。新牌改变的是双方剩余范围，不是“危险牌一律停火”或“保护就下大”。', ['concept-turn-barrel'], D('Depolarized turn barrels', 8, '813-816')),
      deviation: step('复盘时分别问：哪些更差手愿意跟这档尺寸？哪些更好手会弃？若所有听牌都开火，价值段能否支撑？Janda 用多听牌转牌与干燥对子面作对照：听牌多不代表全部应诈唬，听牌少也不代表可以完全没有诈唬。', ['concept-backdoor-equity', 'concept-targeting'], A('作为翻牌圈的下注方面对一个转牌圈check', '134-135')),
    },
    question: '小 C-bet 被跟后，转牌应该统一放大尺寸吗？',
    answer: '不应该。先比较新牌对双方价值段的影响，再决定尺寸与手类：CO 的 K74-J 例子与 SB 的成花／成对例子给出相反的尺寸方向。',
    boundary: '两个 DDoG 例子分别是 CO vs BB / 200bb 与 SB vs BB / 100bb。用于理解二枪构造，不给其他位置或 9max 指定频率。',
  },
  {
    id: 'facebarrel', title: '面对二枪：牌名强，不代表跟注收益高', role: 'caller', scenarios: ['BTNvsBB', 'SBvsBB', 'COvsBTN'],
    steps: {
      scope: step('先确认这是翻牌下注并被跟后的第二枪。现在的对手范围已经经过一次下注过滤；自己的继续范围也不应直接沿用翻牌的跟注牌表。比较跟注、加注、弃牌，而不是只问“我的对子够不够大”。', ['concept-range-morphology'], A('翻牌圈跟注后，面对一个转牌圈下注', '132')),
      lines: step('价格只给出需要赢回多少，不告诉你能实现多少。还有河牌下注时，改善牌是否干净、击中后能否再取值、未击中是否还需付费，都影响跟注收益。不能将当前 raw equity 直接当作已经到手的底池份额。', ['concept-pot-odds', 'concept-implied-odds'], D('Pot odds', 1, '21-23')),
      streets: step('BTN vs BB、6max / 100bb cash：BB 在 A♠8♠5♥ 跟 33% 翻牌下注，2♦ 转牌面对 125%。教材四个候选中，5♦3♦ 的跟注 EV 最高：它能在 5、4、3 河牌反超部分强价值。A7 等名义更强的牌也可能只是抓诈牌，改善到价值段之上的路径才是区别。', ['concept-turn-defense', 'concept-implied-odds'], D('Defending against polar turn barrels', 11, '1191-1194')),
      deviation: step('也要比较加注的代价。SB vs BB、100bb 的 Q-Q-5-J 例子里，弱同花听牌 4♠3♠ 加注能赶走支配它的同花听牌；其他有摊牌价值的候选更愿意跟注，避免遭遇转牌再加注。不能把“有听牌”统一写成跟注或半诈唬加注。', ['concept-turn-defense', 'concept-equity-realization'], D('Raising vs double-barrels', 9, '949-952')),
    },
    question: '面对极化转牌大注，为什么较小的对子有时比顶对更适合跟注？',
    answer: '两者都可能只打赢诈唬。能反超价值段的干净改善牌、blocker 与河牌权益实现，会让较小对子有更高跟注收益；不是“小对子永远优于顶对”。',
    boundary: '具体比较来自 100bb 的指定牌面与候选手；主线深码要重估后续压力，不能机械按牌名排序。',
  },
  {
    id: 'probe', title: 'Probe：翻牌过牌到底后，BB 如何建立下注范围', role: 'caller', scenarios: ['BTNvsBB'],
    steps: {
      scope: step('这里是 BTN 翻前开局、BB 跟注，翻牌双方过牌，BB 转牌先行动。它叫 probe；不是面对翻牌下注跟注后的 donk，也不是翻前加注者的 delayed C-bet。Check-back 会过滤范围，但不等于没有强牌或陷阱。', ['concept-probe'], D('Probing turn bricks', 6, '573-576')),
      lines: step('DDoG 的 BTN vs BB 例子为 8max / straddle + ante cash / 200bb，J♥T♦5♣ 翻牌过牌到底。低砖牌转牌时，BB 用强顶对以上与听牌构成极化下注，采用几何超池。理解重点是价值段为何能承受大底池，不是看见对手过牌就随便下注。', ['concept-probe', 'concept-range-morphology'], D('Probing turn bricks', 6, '573-576')),
      streets: step('另一个例子是 HJ vs BB、6max / 200bb cash，8♥7♠4♥ 翻牌过牌到底。多数题列转牌采用包含顶对价值的小注；A♥ 转牌却转为超池／过牌，价值段主要是同花。A♥ 对 BB 的整体范围并不好：下注大不等于这张牌对自己有利，而是剩余价值段更适合该尺寸。', ['concept-probe', 'concept-targeting'], D('Depolarized Turn Probes', 11, '1204-1208')),
      deviation: step('对照两例，不要将“probe”记成固定大注或固定小注。复盘时先列对方过牌后保留的顶对、听牌与陷阱，再列自己可取值的手；最后才问诈唬候选和尺寸是否配得上价值段。', ['concept-probe'], D('Depolarized Turn Probes', 11, '1204-1208')),
    },
    question: 'Probe 打超池，能否反推出转牌对 BB 的整个范围有利？',
    answer: '不能。8♥7♠4♥-A♥ 的教材例子里，A♥ 对 BB 整体范围不利，但剩余价值段主要是同花，超池仍是更有效率的尺寸。',
    boundary: 'J-T-5 是 BTN / 8max / straddle + ante，8-7-4 是 HJ / 6max；两例都为 200bb，但不是同一个底池，尺寸不能互换。',
  },
  {
    id: 'delayed', title: '延迟 C-bet：翻前加注者过牌后再下注', role: 'raiser', scenarios: ['BTNvsBB', 'SBvsBB', 'COvsBTN'],
    steps: {
      scope: step('前提是翻牌双方过牌；现在轮到翻前加注者在转牌下注或继续过牌。先还原自己的翻牌过牌段：哪些中段手在实现权益，哪些强牌留作陷阱，哪些空气仍能成为诈唬。', ['concept-delayed-cbet'], A('翻牌圈随后check后，面对一个转牌圈check', '135')),
      lines: step('DDoG 的 SB vs CO、6max / 100bb 3-bet 底池例子里，低牌面让未成对高张落空，SB 的过牌段含超对陷阱与空气，因而转牌偏向超池／过牌。这里说明的是范围结构，不是“OOP 的延迟下注天然都要极化超池”。', ['concept-delayed-cbet', 'concept-range-morphology'], D('Delay c-betting OOP in 3BPs', 9, '920-923')),
      streets: step('回到当前单加注底池，重新判断转牌是否补进双方的顶对、两对、顺子或同花。若自己的过牌段仍含许多中段手，就不能用“陷阱加空气”替代真实范围；也不能把相邻 3-bet 底池的尺度直接搬来。', ['concept-delayed-cbet'], D('Delay c-betting OOP in 3BPs', 9, '920-923')),
      deviation: step('比较下注与再次过牌：即使某手空气现在下注能盈利，也不代表全范围下注最好。保留中段摊牌收益、安排价值与诈唬，并考虑对手加注后的行动，比“错过翻牌，现在补一枪”更重要。', ['concept-equity-realization'], A('翻牌圈随后check后，面对一个转牌圈check', '135')),
    },
    question: '能否把 SB 在 3-bet 底池的延迟超池照搬到所有单加注底池？',
    answer: '不能。要先确认自己的翻牌过牌段是否真的由强陷阱与空气主导；原例的底池、位置和深度都是构造的一部分。',
    boundary: '自动匹配的是 SRP 决策类别；3-bet 底池例子只解释陷阱与空气如何影响尺寸，不是该手牌的求解结果。',
  },
  {
    id: 'donk', title: 'Donk：翻牌跟注后，转牌先下注', role: 'caller', scenarios: ['BTNvsBB'],
    steps: {
      scope: step('BB 翻牌 check-call BTN 的 C-bet，转牌不先过牌而主动下注，这才是此处的 donk。先核对翻牌尺寸如何筛选双方的底对、听牌与强手，不能只把 lead 理解成抢主动。', ['concept-donk-bet'], D('When to donk the turn?', 2, '139-142')),
      lines: step('6max / NL50 / 100bb 的 K-T-5 翻牌、5 转牌例子：BTN 很少用 75% 翻牌下注携带底对，但 BB 对该尺寸几乎保留所有 5x，所以这条线的转牌 donk 最多。原因是双方 5x 的不对称，不是 75% 本身具有魔法。', ['concept-donk-bet', 'concept-nut-advantage'], D('When to donk the turn?', 2, '139-142')),
      streets: step('同一转牌、不同前街尺寸会得到不同答案：33%／50% 线里 BTN 保留更多较弱对子；125% 线里 BB 已弃掉部分底对，而 BTN 也可能用第三对半诈唬。牌面成对并不自动意味着 BB 应领先下注。', ['concept-donk-bet'], D('When to donk the turn?', 2, '139-142')),
      deviation: step('Janda 用 Q-T-4-T 对照解释：若 BB 的 Tx 比对手多，而对手的 Qx 已不愿继续价值下注，BB 可以考虑自己领先建池。复盘先检查新牌是否真让自己有更强的价值段，不把 lead 本身标成错误或强弱信号。', ['concept-nut-advantage'], A('翻牌圈check-call之后，转牌圈反主动下注', '154-155')),
    },
    question: 'K-T-5-5 同一牌面，为什么不能忽略翻牌 C-bet 尺寸？',
    answer: '尺寸筛选了双方到转牌的 5x 等组合。教材中 75% 线的底对不对称最明显，但更小或更大的翻牌下注会改变这种不对称。',
    boundary: '原例为 BTN vs BB / 100bb；匹配只识别行动线，不自动证明当前牌面适合 donk。',
  },
  {
    id: 'faceprobe', title: '面对 Probe：过牌范围不等于弃牌范围', role: 'raiser', scenarios: ['BTNvsBB'],
    steps: {
      scope: step('BTN 翻牌 check-back 后，BB 转牌先下注。这不是二枪；先回到自己选择过牌的范围，区分中段摊牌手、未改善空气和保留强手。', ['concept-probe', 'concept-range-morphology'], D('Probing turn bricks', 6, '573-576')),
      lines: step('不要因放弃翻牌下注就认为自己已经被迫防守到底。先按转牌下注尺寸计算价格，再考虑对手价值段、自己的改善机会和河牌压力。', ['concept-pot-odds', 'concept-equity-realization'], D('Pot odds', 1, '21-23')),
      streets: step('新牌会重排双方的价值段：probe 既可能采用强顶对以上的极化结构，也可能采用包含中段手的小注。先辨认对方正在针对哪些手，不把“他在我过牌后下注”直接等同于诈唬过多。', ['concept-probe'], D('Depolarized Turn Probes', 11, '1204-1208')),
      deviation: step('复盘分别比较跟注、加注与弃牌的理由。若自己的牌只能赢诈唬，就需要对手范围与价格支持；若有改善潜力，要核对能否反超其价值，而非只数所有看似能进步的牌。', ['concept-implied-odds'], D('Implied odds', 1, '33-35')),
    },
    question: '面对 probe，应该为保护翻牌过牌范围而无条件跟注吗？',
    answer: '不应该。范围保护要靠合理组成；单手仍需比较价格、对手下注构成与后街收益。',
    boundary: '以 probe 的进攻构造反观防守问题；这里没有给定一张来源求解的 BTN 应对表。',
  },
  {
    id: 'facedelayed', title: '面对延迟 C-bet：别把两次过牌当成没有强手', role: 'caller', scenarios: ['BTNvsBB', 'SBvsBB', 'COvsBTN'],
    steps: {
      scope: step('翻牌双方过牌，转牌面对翻前加注者下注。这个范围并没有经历翻牌 C-bet 的筛选；可能同时存在中段手、强陷阱和空气，不能直接套用二枪的强度判断。', ['concept-delayed-cbet', 'concept-range-morphology'], D('Delay c-betting OOP in 3BPs', 9, '920-923')),
      lines: step('对照原 3-bet 底池例子，过牌后仍有超对陷阱；但当前 SRP 的范围构成不同。先结合翻前位置、转牌改善和尺寸提出对手范围，再比较跟注、加注、弃牌。', ['concept-delayed-cbet'], D('Delay c-betting OOP in 3BPs', 9, '920-923')),
      streets: step('检查转牌带来的改善是否真的能对抗价值段。当前价格只是跟注的起点：河牌能否实现权益、击中是否还会被更好牌支配，都会改变继续价值。', ['concept-pot-odds', 'concept-implied-odds'], D('Implied odds', 1, '33-35')),
      deviation: step('把“对手有弱牌”和“对手面对加注会弃掉足够多牌”分开。自己的加注还会扩大底池并承受再加注，不能只因对手错过翻牌下注就自动攻击。', ['concept-equity-realization'], A('翻牌圈跟注后加注一个转牌圈下注', '126-127')),
    },
    question: '翻前加注者翻牌过牌，转牌下注是否天然比二枪弱？',
    answer: '不一定。其过牌段可以保留强陷阱，也可能有许多中段手；必须按具体范围和新牌分析。',
    boundary: '当前为 SRP 分类；引用的 3-bet 底池只解释过牌段能保留强手，不提供该 SRP 的防守频率。',
  },
];

export const TOPIC_LESSONS = {
  preflop: [
    { title: '先确定收益来源，再谈扩大范围',
      text: '一手牌的入池价值既来自直接收走死钱，也来自被继续后能实现多少权益。不要只按起手牌名排序：考虑位置、有效筹码、尺度、抽水和后方玩家，尤其要区分打赢对手的弃牌段与能对抗其继续段。',
      example: 'Janda 比较 A9o 与 98s：高牌对整体范围的 equity 较高，不代表被强范围继续后更容易获利。同花连张的改善路径解释了可玩性，但这个例子不是任何位置都跟 98s 的许可。',
      question: '这手牌被 3-bet 或被跟后，收益还来自哪里？',
      answer: '检查是否仍有位置、干净改善牌与价值目标；若只剩被支配的一对潜力，不能以翻前 equity 看起来不错代替盈利依据。',
      sourceRef: A('对抗强范围的保留胜率与可看更多公共牌的信号', '12-14') },
    { title: '深码改变什么，不改变什么',
      text: '筹码加深会放大坚果优势、位置与正反向隐含赔率，却不保证所有强起手牌的 EV 增加。深度必须与范围和可投入的大底池一起考虑。',
      example: 'DDoG 的 BTN 开局对照中，AA 在 200bb 增值，但多数其他列出的强起手牌比 100bb EV 更低。它反驳“越深强牌越值钱”，不提供 9max 全位置范围。',
      question: '一手大对子在深码下，能否默认打光？', answer: '不能。它翻前强不等于经过三街过滤后仍适合打大底池；先重估对手能继续的强手。',
      sourceRef: D('Effects of stack depth', 2, '168-170') },
  ],
  ranges: [
    { title: '从平均权益，走到强、中、弱手的分布',
      text: '同样的平均 equity 可以来自完全不同的结构：一方有强手和空气，另一方主要是中段手。前者可能利用坚果优势打大，后者则需要价格和权益实现；不能由“双方五五开”推出策略也对称。',
      example: '把两边都分成坚果候选、可取值中段、抓诈／听牌、空气，再标出前街哪些牌加注、跟注或过牌。行动是在筛选范围，不是仅给自己的牌贴“强／弱”标签。',
      question: '为什么需要同时看坚果优势与平均权益？', answer: '平均权益描述整体份额；坚果优势影响能否承受范围收窄后的大底池。两者回答不同的问题。',
      sourceRef: D('Equity buckets / Nut advantage / Range Morphology', 1, '36-37, 48-49, 53-54') },
    { title: '权益不是已经兑现的收益',
      text: '有后续行动时，权益能否变成收益还取决于位置、改善路径、对手范围与下注压力。能明确识别哪些转牌可以继续的手，可能比原始 equity 接近的静态手更能实现权益。',
      example: 'DDoG 的后门例子说明为什么 T♥8♥ 在 Q♥7♦5♣ 上能继续多种转牌：不是“有后门就下注”，而是这些改善路径让后街选择更多。',
      question: '对手的强价值段出现时，我的改善仍有用吗？', answer: '只统计能改变相对位置的改善；做成一对却仍被支配，不等于有干净的取胜路径。',
      sourceRef: D('Pot odds / Pay attention to backdoors', 1, '21-23, 38-39') },
  ],
  flop: [
    { title: '把下注意图、频率和尺寸拆开',
      text: '先问哪些手从下注中获益，再问范围中的多少手要下注，最后选能针对对手手类的尺寸。平均范围优势不等于所有强牌都下大；坚果优势也不等于全范围都下注。',
      example: '尺寸变大后，对手继续的范围通常更窄更强。自己的价值段必须能从这个继续段取值，诈唬也要与之配套，而非用“怕被反超”统一解释所有大注。',
      question: '换一个尺寸，改变的是对手哪一类牌的决定？', answer: '明确目标手类：让哪些空气放弃权益，让哪些中段手难以继续，或让哪些较差价值手愿意付费。',
      sourceRef: D('Nut advantage / Targeting hand classes', 1, '48-49, 59-61') },
    { title: '过牌和下注都需要后街计划',
      text: '下注不只考虑当下能否收池，还要看被跟后有哪些转牌能取值、继续诈唬或停火。过牌则保留权益实现与保护范围的机会；不能把所有空气都下注，再把所有中段手都过牌。',
      example: 'Janda 的多听牌转牌例子提醒：有很多听牌时，若全部开火，可能让诈唬候选过量；干面缺少自然听牌时，又不能因此把所有弱手都放弃。',
      question: '这次下注被跟后，我准备在哪类转牌重新判断？', answer: '分别看坚果变化、听牌改善与对手范围过滤，不预先承诺每张牌都继续开火。',
      sourceRef: A('作为翻牌圈的下注方面对一个转牌圈check', '134-135') },
  ],
  defense: [
    { title: '价格是起点，不是跟注答案',
      text: '先计算跟注成本占跟注后底池的比例，再问能实现多少收益。还有后街时，不只比较 raw equity；也要看改善牌是否干净、对手能否继续施压、击中后能否再收钱。',
      example: 'DDoG 的转牌半池下注例子得到 25% 的价格门槛，但刻意指出“有 25% equity 就能跟”是误读，因为河牌尚有行动。',
      question: '把所有后街压力删掉后算出的跟注，现实中还能成立吗？', answer: '需要重新加入权益实现、隐含赔率与反向隐含赔率；若面对全下才没有后街行动的折价。',
      sourceRef: D('Pot odds / Implied odds', 1, '21-23, 33-35') },
    { title: '跟注与加注是不同的权益实现方式',
      text: '加注可以取值、迫使更好牌弃牌，或清理支配自己听牌的组合；但也会扩大底池并招致再加注。有摊牌价值且能在后街实现的手，未必需要转成诈唬。',
      example: '转牌的 4♠3♠ 加注教材例子，与其他候选跟注形成对照：两手都带听牌，却因被支配和摊牌价值不同，适合不同动作。',
      question: '加注后留下的对手范围，是我希望面对的吗？', answer: '比较加注与跟注各自的收益，尤其检查被再加注时损失了多少潜在权益。',
      sourceRef: D('Raising vs double-barrels', 9, '949-952') },
  ],
  river: [
    { title: '下注与过牌收益分开估计',
      text: '到河牌不再有改善机会。下注应明确向哪些更差手取值、让哪些更好手弃牌，并与过牌能赢得的摊牌收益比较。薄价值与大注的价值门槛不同，不能仅由自己的绝对牌力决定。',
      example: 'Janda 的尺度讨论指出，大注通常让继续范围变窄变强，小注让更宽更弱的范围获得继续价格。深码强牌若无法从收窄后的范围取值，单纯扩大底池并不会增加收益。',
      question: '如果对手所有更差牌都弃掉，这个下注靠什么赚钱？', answer: '若也不能让更好牌弃掉，就要重新比较过牌，不能把它称为价值下注。',
      sourceRef: A('翻后下注尺度概览', '54-57') },
    { title: '先证明抓得到诈唬，再谈 blocker',
      text: '依次问：能否击败对手的诈唬？下注范围中是否有足够诈唬满足当前价格？最后才在接近的候选间比较阻断价值、保留诈唬。',
      example: '有好 blocker 也不能创造对手本来没有的诈唬。河牌单手输赢不是范围证据；要回看前街哪些候选真正走得过来。',
      question: '我是在识别对手可能的诈唬，还是只为跟注寻找一个 blocker 理由？', answer: '先列出能走到这里的价值与诈唬手，再用持牌移除效应修正，避免倒推想要的结论。',
      sourceRef: D('Bluff-catching rivers', 1, '46-47') },
  ],
  adjustment: [
    { title: '用机制提出假设，用牌局判断假设',
      text: '教材解释什么情况下某种调整能获利，不证明你的对手已经满足条件。“下注里弱牌多”与“面对加注弃牌多”是不同事实：前者可能支持更多价值／保护性加注，后者才支持进一步增加诈唬。',
      example: '同样是对手过度下注，若他面对加注跟得很宽，扩大诈唬可能与目标相反。原行动线笔记保留为问题清单，不能因能找到相关教材就升级为已验证人口结论。',
      question: '我具体观察到哪一种行为？如果事实相反，调整是否也应反向？', answer: '把对手动作、发生条件和应对反应分开看；证据不足时保留假设，不把机制说明当作样本。',
      sourceRef: A('最优秀的牌手总是采用EV最多的玩法', '20-21') },
  ],
  special: [
    { title: '先认出模型，再迁移机制',
      text: '纯坚果／空气的思想实验能清楚说明下注数学；真实底池却通常还含听牌、中段手与反超风险。学会公式以后，还要把这些删去的条件放回分析。',
      example: 'Janda 的均匀几何下注从完全极化范围推导，但紧接着说明：当对手仍能持有更强牌或反超时，每街固定比例并不总是最优。同理，短码、锦标赛和 3-bet 底池的数字不能直接用于深码 SRP。',
      question: '这个结论依赖哪些现实中不一定成立的假设？', answer: '先标出赛制、筹码、位置、底池和范围结构，再迁移可解释的因果，不搬运失去条件的数字。',
      sourceRef: A('翻后下注尺度概览', '54-57') },
  ],
};

export const TURN_SPOTS = TURN_DECISIONS.flatMap((decision) => decision.scenarios.map((scenario) => ({
  id: scenario.toLowerCase() + '-' + decision.role + '-turn-' + decision.id,
  scenario, role: decision.role, decision,
})));
