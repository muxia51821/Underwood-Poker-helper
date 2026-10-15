// [V7.11.13 新增] Reading map: references existing seeds, never creates personal strategy records.
import { CONCEPT_SEEDS } from './conceptSeed.js';
import { POKER_LOGIC_SEEDS } from './pokerLogicSeed.js';
import { GTO_BASELINE_SEEDS } from './gtoBaselineSeed.js';
import { EXTERNAL_EVIDENCE_SEEDS } from './externalEvidenceSeed.js';
import { underBluff, overBluff } from './actionLines.js';
import { TOPIC_LESSONS, TURN_DECISIONS } from './strategyLessons.js';

export const STRATEGY_TOPICS = [
  {
    id: 'preflop', title: '翻前条件与入池范围',
    summary: '先看有效筹码、位置、入池尺度和抽水，再判断一手牌的收益来自收走死钱，还是被跟后的权益实现。深码下还要区分坚果潜力与反向隐含赔率。',
    boundary: '已有范围构造原理，尚无条件完整的 9max / 200bb 开局、跟注、3-bet 表。书中的 cash、MTT、Spin 例子分开使用。',
    conceptIds: ['concept-hand-in-vacuum', 'concept-stack-depth', 'concept-rake-impact', 'concept-strategic-domination', 'concept-3bet-construction', 'concept-squeeze-construction', 'concept-multiway-pots'],
    sourceIds: ['ev-gto-wizard-deep-4bet-cash'],
  },
  {
    id: 'ranges', title: '双方范围与牌面分布',
    summary: '先辨认双方范围的强、中、弱手，而不是孤立判断自己的牌名。牌面与行动会改变分布；平均权益相近的两个范围，也可能具有不同的坚果优势和后续收益。',
    boundary: '范围优势、坚果优势和权益实现是不同问题；不能只看一个 equity 数字就决定下注。',
    conceptIds: ['concept-equity', 'concept-equity-realization', 'concept-equity-buckets', 'concept-range-morphology', 'concept-nut-advantage', 'concept-equity-distribution-graphs', 'concept-board-distribution-shapes'],
    sourceIds: ['gto-baseline-btnvsbb-cbet-paired-high-100bb'],
  },
  {
    id: 'flop', title: '翻牌进攻与加注构造',
    summary: '把下注频率与尺寸分开判断：向哪些手取值，迫使哪些手弃牌，过牌后又如何继续？BTN 对 BB、SB 对 BB、CO 对 BTN 的范围与位置不同，不能共用一个 C-bet 答案。',
    boundary: '尺寸文章的例子是 BTN vs BB、100bb cash SRP；SB 聚合文章是 MTT / chip-EV。SRP 与 3-bet pot 分开，具体频率不搬到主线。',
    conceptIds: ['concept-range-bet', 'concept-targeting', 'concept-overbetting', 'concept-cbet-3bp', 'concept-donk-bet', 'concept-check-raise-construction', 'concept-backdoor-equity', 'concept-combo-eqr', 'concept-trapping'],
    sourceIds: ['gto-baseline-btnvsbb-cbet-paired-high-100bb', 'gto-baseline-sbvsbb-cbet-directional', 'gto-baseline-covsbtn-cbet-oop-framework-100bb'],
  },
  {
    id: 'defense', title: '防守价格与继续范围',
    summary: 'Pot odds 给出价格，equity 描述摊牌份额，EQR 解释后续行动的影响。防守要比较跟注、加注与弃牌，考虑改善牌、后续压力和位置；MDF 不是每手牌必须完成的配额。',
    boundary: 'MDF 的解释依赖诈唬权益与过牌收益等假设。Toy game、3BP chop 例子只解释边界，不是通用防守频率表。',
    conceptIds: ['concept-pot-odds', 'concept-alpha-mdf', 'concept-mdf-boundary', 'concept-mdf-draws', 'concept-mdf-showdown-value', 'concept-clairvoyant-defense', 'concept-4straight-chop-defense'],
    sourceIds: ['gto-baseline-btnvsbb-facebet-paired-high-100bb', 'gto-baseline-btnvsbb-facebet-overcbet-shift-30bb'],
  },
  {
    id: 'turn', title: '转牌与后续权益实现',
    summary: '先读前街，再读新牌。C-bet 被跟、双方过牌、check-raise 被跟，会留下不同的范围。同一张 A 或成听牌转牌，不能单独决定下一步。',
    boundary: '二枪、probe、delayed C-bet 与 donk 按前置线区分；教材的 6max、straddle + ante、100bb／200bb 与 3BP 条件分别保留，不指定主线频率。',
    conceptIds: ['concept-implied-odds', 'concept-probe', 'concept-delayed-cbet', 'concept-owning-draws', 'concept-check-back-draws', 'concept-turn-barrel', 'concept-turn-defense'],
    sourceIds: ['ev-gto-wizard-bb-turn-probe-100bb'],
  },
  {
    id: 'river', title: '河牌价值、诈唬与抓诈',
    summary: '主动下注时比较下注与过牌收益：哪些更差的手跟、哪些更好的手弃？面对下注时先看能否打过诈唬和价格，再看 blocker。前街过滤后的范围决定河牌选手。',
    boundary: '坏河牌会重新定价强牌；好 blocker 不证明对手有足够诈唬。SB 的 XC-X-? 线不能直接套到 BTN vs BB 的 BB。',
    conceptIds: ['concept-blockers', 'concept-bluff-catching', 'concept-value-bluff-ratio', 'concept-block-bet', 'concept-thin-value'],
    sourceIds: ['ev-gto-wizard-nasty-rivers-oop', 'ev-gto-wizard-river-bluff-missed-flushdraws', 'ev-gto-wizard-bvb-xcx-river'],
  },
  {
    id: 'adjustment', title: '对手调整与复盘校准',
    summary: '用对手行为证据决定偏离方向。C-bet 过多与面对加注过度弃牌是两个假设：前者可能支持更多价值／保护性加注，后者才进一步支持扩大诈唬。',
    boundary: '一手输赢或少量摊牌不能证明人群倾向。个人频率变化不等于策略改进；教材与同源文章也不是两份独立人口证据。',
    conceptIds: ['concept-indifference', 'concept-mixed-strategies', 'concept-gto-aim', 'concept-exploit-adjustments', 'concept-pure-vs-frequency-mistakes', 'concept-thresholds-thinking', 'concept-solver-noise', 'concept-solver-accuracy', 'concept-variance-basics', 'concept-eqr-rake'],
    sourceIds: ['gto-baseline-btnvsbb-facebet-overcbet-shift-30bb', 'ev-gto-wizard-showdown-exploit-method'],
  },
  {
    id: 'special', title: '独立分支与极端例子',
    summary: '把锦标赛的 ICM、风险溢价、短码 push-fold，以及 chop 和低 SPR 的极端案例留在各自分支，用它们理解机制的边界。',
    boundary: '这些内容不是深码 cash 的默认打法；不能把 ICM 溢价加入现金局的防守门槛。',
    conceptIds: ['concept-icm', 'concept-risk-premium', 'concept-push-fold-ev', 'concept-shove-extremes'],
    sourceIds: [],
  },
];

// [V7.11.14 修改] Notes now have a single canonical home beside the mechanism and quiz.
export const CONCEPT_READING_NOTES = Object.fromEntries(CONCEPT_SEEDS.filter((c) => c.readingNote).map((c) => [c.id, c.readingNote]));

const HYPOTHESIS_NOTES = [
  ['3IA-XX-R-', 'river', '范围更新与慢打相关；两街看似矛盾并不能排除诈唬。缺直接来源。'],
  ['SIA-Bm-Bb-Bs', 'river', '尺寸不能单独识别价值；人口结论待证。'],
  ['SIA-B-B-B', 'river', '缺同牌面、位置、尺寸的人群证据。'],
  ['SIA-Bb-', 'defense', '先看范围顶部和防守价格；不能只凭大注判定诈唬不足。'],
  ['SOD-XX-CX-DBb', 'river', '先核对行动者，再重估成听牌河牌的范围。'],
  ['SOD-XX-CR / -XR', 'river', '能弃超对是条件结论，不是固定牌名答案。'],
  ['多人池的前位DB', 'preflop', '多人池手类教材不验证这种 lead 的诈唬率。'],
  ['3OD-DB(不见AK)', 'flop', '独立 3BP 节点；不能锁定 KK/QQ/JJ。'],
  ['多人池的河牌才下注', 'river', '多人池河牌待研究，缺直接来源。'],
  ['多人池前位/中位 BC-DBb-DBb', 'river', '先澄清多人池和行动者，不能由单挑教材认证。'],
  ['SOD-DBs-m', 'flop', '弱成牌多不等于诈唬多；还需对加注的反应证据。'],
  ['SOD-XX-probes', 'turn', '先核对 IP/OOP 与 probe 名称，不预设后续诈唬线盈利。'],
  ['3OD-XC-XX-DBs', 'river', '独立 3BP 节点，不能套用 SRP 小注例子。'],
  ['SIAe-B-', 'adjustment', '文章支持调整机制；下注过多与面对 XR 过弃必须分别证实。'],
  ['SIA-B-(掉A)', 'turn', '拆成转牌和河牌两个假设；原文的“肯定”尚无证据。'],
  ['SID-stab', 'adjustment', '诱导犯错是相关机制；是否全范围过牌依赖具体节点。'],
  ['SID-XX-B', 'turn', '过牌也可能保留中段手或陷阱，人口结论待证。'],
  ['对手是进攻方flop下注尺度较小', 'flop', '小注可以容纳强手，不能默认小注意味着牌弱。'],
  ['3OA-Bs-XX-Bs-m', 'river', '原笔记已注明未知；不因列入 overBluff 就成为已知倾向。'],
];

export const STRATEGY_HYPOTHESES = [...underBluff, ...overBluff].map((entry) => {
  const note = HYPOTHESIS_NOTES.find((row) => row[0] === entry.line);
  return { ...entry, topicId: note?.[1] || 'adjustment', status: 'unverified',
    assessment: note?.[2] || '尚未完成来源对照。',
    sourceIds: entry.line === 'SIAe-B-' ? ['gto-baseline-btnvsbb-facebet-overcbet-shift-30bb'] : [] };
});

export function topicForSpot(spotId) {
  const spot = POKER_LOGIC_SEEDS.find((item) => item.id === spotId);
  if (!spot) return null;
  return spot.street === 'river' ? 'river' : spot.street === 'turn' ? 'turn' : spot.question === 'facebet' ? 'defense' : 'flop';
}

export function resolveTopic(topicId) {
  const topic = STRATEGY_TOPICS.find((item) => item.id === topicId);
  if (!topic) return null;
  return { ...topic,
    lessons: topic.id === 'turn' ? TURN_DECISIONS : TOPIC_LESSONS[topic.id] || [],
    concepts: topic.conceptIds.map((id) => CONCEPT_SEEDS.find((item) => item.id === id)),
    sources: topic.sourceIds.map(resolveFrameworkSource),
    spots: POKER_LOGIC_SEEDS.filter((spot) => topicForSpot(spot.id) === topic.id),
    hypotheses: STRATEGY_HYPOTHESES.filter((item) => item.topicId === topic.id),
  };
}

export function resolveFrameworkSource(id) {
  const baseline = GTO_BASELINE_SEEDS.find((item) => item.id === id);
  if (baseline) return { id, title: baseline.source.title, url: baseline.source.url,
    conditions: [baseline.conditions.game, baseline.conditions.tableSize,
      baseline.conditions.stackBB ? baseline.conditions.stackBB + 'bb' : '深度未明示'].filter(Boolean).join(' · '),
    boundary: baseline.transferBoundary };
  const evidence = EXTERNAL_EVIDENCE_SEEDS.find((item) => item.id === id);
  return evidence ? { id, title: evidence.title, url: evidence.sourceRef,
    conditions: evidence.conditions, boundary: evidence.transferBoundary } : null;
}
