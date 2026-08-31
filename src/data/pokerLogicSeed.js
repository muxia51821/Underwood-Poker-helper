// [V7.11.1 修改] 复盘牌理参考种子 v2：四步框架保留为导航（范围合法性 → 线语义 → 街牌效应 → 偏离解读），
// 每格 = 概念引用列表（conceptIds 指向 conceptSeed.js 的原子概念，牌理内容只在概念库里）+ 一句导航语。
// 纪律：本文件不再自写牌理叙述；V7.11.0 的叙述内容作废。格内 conceptIds 为空 = 该格暂无已核验概念（缺口显式保留）。
// street/scenario/role/question 为 spotMatcher 匹配字段，evidenceRefs 指向证据包 id，boundary 为证据转移边界——均保持不变。
export var POKER_LOGIC_SEED_VERSION = 'v2';

export var POKER_LOGIC_SEEDS = [
  {
    id: 'btnvsbb-raiser-cbet',
    street: 'flop',
    scenario: 'BTNvsBB',
    role: 'raiser',
    question: 'cbet',
    title: 'BTN C-bet（IP 进攻方）',
    steps: {
      scope: {
        note: '本 spot = BTN 开牌、BB 跟注后的翻牌首动。先问：开牌加注范围与 BB 冷跟范围各自是什么形态，你的优势从哪来。',
        conceptIds: ['concept-range-morphology', 'concept-nut-advantage'],
      },
      lines: {
        note: '前置线语义：BB check 后行动。下注的本质是拿走对手 equity 的实现权；"对方先下注（donk）"不属于本 spot（雷达与牌理参考都不覆盖）。',
        conceptIds: [],
      },
      streets: {
        note: '街牌效应：把牌面当作"改变双方 equity 分布形状"的事件，再对照信号卡的牌面专项参考（若有）。',
        conceptIds: ['concept-equity-buckets', 'concept-backdoor-equity'],
      },
      deviation: {
        note: '偏离解读：先对照 Radar 同场景基线，再回到本格概念检查机制；本卡不给频率答案。',
        conceptIds: [],
      },
    },
    evidenceRefs: ['ev-gto-btnvsbb-cbet-100bb-6max', 'ev-gto-btnvsbb-cbet-paired-high-100bb', 'ev-gto-btnvsbb-cbet-monotone-100bb', 'ev-gto-btnvsbb-cbet-flushy-straighty-100bb', 'ev-gto-wizard-ip-mtt-heuristics-40bb'],
    boundary: '6max 100bb 总体锚点（63%/37%）来自 NL500z 级别解读，微级别对手倾向可能不同；牌面专项条目为单牌面定性；MTT 启发式只提供"范围动态优先于牌面"的思考框架，不提供频率。',
  },
  {
    id: 'btnvsbb-caller-facebet',
    street: 'flop',
    scenario: 'BTNvsBB',
    role: 'caller',
    question: 'facebet',
    title: 'BB 面对 C-bet（OOP 防守方）',
    steps: {
      scope: {
        note: '本 spot = BB 跟注 BTN 开牌后面对翻牌 C-bet。防守方的问题不是"猜牌"，而是"以多宽的继续范围挡住对手的自动获利"。',
        conceptIds: ['concept-equity-realization'],
      },
      lines: {
        note: '线语义：下注尺寸同时决定对手的诈唬门槛（alpha）与你的最低防守频率（MDF）；你的混合频率是维持对手无差别的手段。',
        conceptIds: ['concept-alpha-mdf', 'concept-indifference'],
      },
      streets: {
        note: '街牌效应：牌面改变双方分布形状，应对构成（跟/弃/加注）随之移动；具体牌面的应对构成见信号卡。',
        conceptIds: ['concept-equity-buckets'],
      },
      deviation: {
        note: '偏离解读：先过 pot odds 门槛，再检查 MDF 边界——MDF 防的是对手过度诈唬，不是必须守住的义务。',
        conceptIds: ['concept-pot-odds', 'concept-mdf-boundary'],
      },
    },
    evidenceRefs: ['ev-gto-btnvsbb-facebet-paired-high-100bb', 'ev-gto-btnvsbb-facebet-monotone-100bb', 'ev-gto-btnvsbb-facebet-flushy-straighty-100bb'],
    boundary: '三条应对构成均绑定 33% 池或 125% 超池的具体尺寸与单牌面；尺寸效应（小注多跟、大注多弃）是可迁移的机制，具体百分比不可外推。',
  },
  {
    id: 'sbvsbb-raiser-cbet',
    street: 'flop',
    scenario: 'SBvsBB',
    role: 'raiser',
    question: 'cbet',
    title: 'SB C-bet（OOP 进攻方）',
    steps: {
      scope: {
        note: '本 spot = SB 开牌、BB 跟注（SRP）后 OOP 翻牌首动。优势微弱且全程无位置——范围形态与 nut 优势决定下注结构。',
        conceptIds: ['concept-range-morphology', 'concept-nut-advantage'],
      },
      lines: {
        note: '线语义：你是先行动方，check 是默认可接受选项；下注尺寸应瞄准让对手特定手类无差别。',
        conceptIds: ['concept-indifference'],
      },
      streets: {
        note: '街牌效应：OOP 下注价值随牌面改变分布的方式变化；backdoor 可见度是你中段手实现 equity 的关键。',
        conceptIds: ['concept-equity-buckets', 'concept-backdoor-equity'],
      },
      deviation: {
        note: '偏离解读：对照 Radar SBvsBB 基线（注意其正确基线本来就低于 BTNvsBB），再回本卡概念检查。',
        conceptIds: [],
      },
    },
    evidenceRefs: ['ev-gto-sbvsbb-cbet-directional', 'ev-gto-wizard-oop-mtt-heuristics-40bb'],
    boundary: '六深度分布为 MTT/chip-EV 聚合（文章表格直读），与现金条件不符仅结构参考；MTT 启发式为 40bb UTG 场景，位置类比。具体频率不做与个人样本的差值。',
  },
  {
    id: 'covsbtn-raiser-cbet',
    street: 'flop',
    scenario: 'COvsBTN',
    role: 'raiser',
    question: 'cbet',
    title: 'CO C-bet（OOP 进攻方，对抗按钮冷跟）',
    steps: {
      scope: {
        note: '本 spot = CO 开牌、BTN 冷跟后 OOP 翻牌首动。对手的补偿来自位置（equity 实现优势），而非牌力；整体下注频率显著低于 IP 加注者。',
        conceptIds: ['concept-nut-advantage', 'concept-equity-realization'],
      },
      lines: {
        note: '线语义：过牌是策略不是软弱——对手用位置实现 equity，你的下注需要在被 float 后仍有后续计划。',
        conceptIds: ['concept-indifference'],
      },
      streets: {
        note: '街牌效应：静态面（你的范围优势大）与动态面（接近对称）由分布形状区分，策略整体随之切换。',
        conceptIds: ['concept-equity-buckets', 'concept-backdoor-equity'],
      },
      deviation: {
        note: '偏离解读：OOP 过度进攻的指纹是"下注-过牌-弃牌"结构；对照 Radar COvsBTN 基线与自己的转牌行动分布。',
        conceptIds: [],
      },
    },
    evidenceRefs: ['ev-gto-covsbtn-cbet-oop-framework-100bb', 'ev-gto-covsbtn-cbet-dynamic-static-40bb', 'ev-gto-covsbtn-cbet-40bb'],
    boundary: '28%/72% 框架来自 UTG vs BTN 冷跟示例（位置类比）；40bb 聚合（25.4%）条件不符仅结构参考；两个来源的位置与深度都和 CO vs BTN 不完全一致，频率不可直接对照。',
  },
  {
    id: 'covsbtn-caller-facebet',
    street: 'flop',
    scenario: 'COvsBTN',
    role: 'caller',
    question: 'facebet',
    title: 'BTN 面对单次加注局 C-bet（IP 防守方）',
    steps: {
      scope: {
        note: '本 spot = BTN 冷跟后面对 CO 的翻牌 C-bet（IP 防守）。你有位置，对手下注范围通常更强。',
        conceptIds: ['concept-equity-realization'],
      },
      lines: {
        note: '线语义：对手 OOP 下注有更强支撑，你的跟注需要真实摊牌价值或明确改善计划；对手过牌时位置价值兑现（免费牌 / 小注 stab）。',
        conceptIds: ['concept-alpha-mdf', 'concept-indifference'],
      },
      streets: {
        note: '街牌效应：对手的两极下注只出现在特定纹理（其范围在这些面结构性更宽）；应对按牌面类别看信号卡。',
        conceptIds: ['concept-equity-buckets'],
      },
      deviation: {
        note: '偏离解读：先 pot odds 后 MDF 边界；该格当前样本薄，信号统计意义有限，优先当检查清单用。',
        conceptIds: ['concept-pot-odds', 'concept-mdf-boundary'],
      },
    },
    evidenceRefs: ['ev-gto-covsbtn-facebet-a99r-40bb'],
    boundary: '唯一数值条目为 40bb 单牌面（A99r）+ nodelock 位移演示；当前样本该格仅约 20 手，偏离结论统计意义有限，优先当检查清单用。',
  },
  {
    id: 'btnvsbb-raiser-riverbet',
    street: 'river',
    scenario: 'BTNvsBB',
    role: 'raiser',
    question: 'riverbet',
    title: 'BTN 河牌下注（IP 进攻方终街）',
    steps: {
      scope: {
        note: '本 spot = BTN 进攻权延续到河牌（IP 终街）。河牌是最后一次变现窗口——过牌后你的范围优势不再产生收益。',
        conceptIds: ['concept-nut-advantage'],
      },
      lines: {
        note: '线语义：极化下注的诈唬占比由对方的 pot odds 门槛锁定；上一街的防守门槛就是这一街的构造约束。',
        conceptIds: ['concept-value-bluff-ratio'],
      },
      streets: {
        note: '街牌效应：惊悚/空白二分已由匹配器标注——先问这张牌把双方 equity 分布推向什么形状（惊悚 = 重新定价，空白 = 力量对比不变），再选 blocker。',
        conceptIds: ['concept-equity-buckets', 'concept-blockers'],
      },
      deviation: {
        note: '偏离解读：空白河牌下注偏低 = 放弃收租窗口；惊悚面不重新定价是偏高侧的典型问题；对照 Radar 基线。',
        conceptIds: [],
      },
    },
    evidenceRefs: ['ev-gto-wizard-post-overbet-later-streets', 'ev-gto-wizard-nasty-rivers-oop'],
    boundary: '「翻牌超注后转河」绑定超注前置线（机制同构、尺寸不同）；「惊悚河牌导航」为 OOP 视角（去值化机制通用、主动方策略仅结构参考）。均不做频率对照。',
  },
  {
    id: 'btnvsbb-caller-riverfirst',
    street: 'river',
    scenario: 'BTNvsBB',
    role: 'caller',
    question: 'riverfirst',
    title: 'BB 河牌首动（OOP 防守方转主动）',
    steps: {
      scope: {
        note: '本 spot = BB 防守后河牌首动（OOP 转主动）。对手示弱（C-bet 后转牌 check）后其范围两极化——你的线是"抢夺 + 摊牌保护"。',
        conceptIds: ['concept-range-morphology'],
      },
      lines: {
        note: '线语义：首动下注的尺寸与手选由 blocker 与摊牌价值共同决定；对手慢玩段（两极的 nuts）也存在，stab 留有余地。',
        conceptIds: ['concept-blockers'],
      },
      streets: {
        note: '街牌效应：空白河牌 = 抢夺窗口有效；惊悚河牌 = 先评估"这张牌帮了谁"，stab 门槛显著上升。',
        conceptIds: ['concept-equity-buckets'],
      },
      deviation: {
        note: '偏离解读：偏低侧对示弱对手不够狠；偏高侧常撞 check-raise / 慢玩。先看对手这条线的摊牌与加注记录，再对照 Radar。',
        conceptIds: [],
      },
    },
    evidenceRefs: ['ev-gto-wizard-bvb-xcx-river', 'ev-gto-wizard-nasty-rivers-oop'],
    boundary: '「BvB check-call 转河」讲的是 SB（equity 优势方）的转河——位置与范围方向与你（BB 劣势方）相反，只有"示弱→抢夺"的结构逻辑可参考，频率不可搬；「惊悚河牌导航」OOP 视角可参考去值化机制。',
  },
  {
    id: 'sbvsbb-raiser-riverdual',
    street: 'river',
    scenario: 'SBvsBB',
    role: 'raiser',
    question: 'riverdual',
    title: 'SB 河牌决策（OOP 进攻方：下注与面对下注）',
    steps: {
      scope: {
        note: '本 spot = SBvsBB SRP 河牌，SB 兼有两个问句：首动下注与面对下注。优势是全场景最微弱的，牌理基调是克制。',
        conceptIds: ['concept-nut-advantage'],
      },
      lines: {
        note: '线语义：下注以小注为主（薄价值 / 阻挡）；大注需要真两极或关键 blocker。',
        conceptIds: ['concept-value-bluff-ratio'],
      },
      streets: {
        note: '街牌效应：惊悚面 middling 牌失去价值下注资格；成花河牌过牌设陷阱（check 不总是示弱）。',
        conceptIds: ['concept-equity-buckets', 'concept-blockers'],
      },
      deviation: {
        note: '偏离解读：面对下注侧按"抓诈唬三问"走；对手有位置的河牌下注更两极，MDF 是下界。',
        conceptIds: ['concept-bluff-catching', 'concept-mdf-boundary'],
      },
    },
    evidenceRefs: ['ev-gto-wizard-bvb-xcx-river', 'ev-gto-wizard-nasty-rivers-oop', 'ev-gto-sbvsbb-cbet-directional'],
    boundary: '「BvB check-call 转河」为 SB vs BB 场景直接对口（其线为对手翻牌刺探被跟，与你的 C-bet 线镜像同构、非同一前置线）；六深度分布为 MTT 聚合结构参考。',
  },
];
