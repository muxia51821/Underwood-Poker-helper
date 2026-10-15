// [V7.11.14 新增] Read-only candidate links: shared decision facts, never evidence or automatic strategy conclusions.
import { normalizeLearningHand, deriveFlopDecision, getObservedProfile } from './analysisReadModel.js';
import { matchHandSpot, matchTurnSpot, streetTwoWay } from './spotMatcher.js';
import { resolveTopic } from '../data/strategyFramework.js';

// [V7.11.15 新增] Heads-up postflop order in a multi-seat table; roles are explicit rather than inferred from label order.
export const POSITION_REFERENCES = {
  UTGvsBB: { opener: 'UTG', defender: 'BB', ip: 'UTG', oop: 'BB' },
  UTGvsBTN: { opener: 'UTG', defender: 'BTN', ip: 'BTN', oop: 'UTG' },
  MPvsCO: { opener: 'MP', defender: 'CO', ip: 'CO', oop: 'MP' },
  COvsBTN: { opener: 'CO', defender: 'BTN', ip: 'BTN', oop: 'CO' },
  BTNvsBB: { opener: 'BTN', defender: 'BB', ip: 'BTN', oop: 'BB' },
  SBvsBB: { opener: 'SB', defender: 'BB', ip: 'BB', oop: 'SB' },
  SBvsBTN: { opener: 'BTN', defender: 'SB', ip: 'BTN', oop: 'SB' },
  UTGvsCO: { opener: 'UTG', defender: 'CO', ip: 'CO', oop: 'UTG' },
  MPvsBTN: { opener: 'MP', defender: 'BTN', ip: 'BTN', oop: 'MP' },
  COvsBB: { opener: 'CO', defender: 'BB', ip: 'CO', oop: 'BB' },
};

// [V7.11.15 新增] Derive the actual learning destination for new and legacy units without rewriting them.
export function getStrategyLearningTarget(record) {
  const [scenario, street] = String(record.familyKey || '').split('|');
  const nodes = (record.spotKeys || []).map((key) => String(key).split('|'))
    .filter((parts) => [4, 5].includes(parts.length) && parts[0] === scenario && parts[1] === street);
  const questions = new Set(nodes.map((parts) => parts.at(-1)));
  const boards = new Set(nodes.map((parts) => parts.at(-2)));
  const question = questions.size === 1 ? [...questions][0] : '';
  const frequencyQuiz = street === 'flop' && ['BTNvsBB', 'SBvsBB'].includes(scenario)
    && (question === 'cbet' || !(record.spotKeys || []).length);
  const topicId = street === 'river' ? 'river' : street === 'turn' ? 'turn' : street === 'preflop' ? 'preflop'
    : street === 'flop' ? question === 'facebet' ? 'defense' : 'flop' : 'adjustment';
  return { type: frequencyQuiz ? 'quiz' : 'concept', quizScenario: frequencyQuiz ? scenario : null,
    topicId, boardCategory: frequencyQuiz && boards.size === 1 ? [...boards][0] : '' };
}

export function getTopicHandReferences(topicId, hands, profileKey = 'all') {
  if (!resolveTopic(topicId)) return [];
  const seen = new Set();
  const references = [];
  for (const raw of Array.isArray(hands) ? hands : []) {
    if (!raw || typeof raw !== 'object' || !raw.id || seen.has(raw.id)) continue;
    const hand = normalizeLearningHand(raw);
    const profile = getObservedProfile(hand);
    if (profileKey !== 'all' && profile.key !== profileKey) continue;
    const decision = deriveFlopDecision(hand);
    const spot = matchHandSpot(hand);
    const validFlop = !decision.excluded;
    let reason = '';
    if (topicId === 'flop' && validFlop && decision.question === 'cbet') reason = '翻牌 C-bet 决策（可能已继续到后街）';
    if (topicId === 'defense' && validFlop && decision.question === 'facebet') reason = '翻牌面对下注的决策（可能已继续到后街）';
    if (topicId === 'river' && spot?.street === 'river') reason = '已识别的河牌场景';
    const turn = topicId === 'turn' ? matchTurnSpot(hand) : null;
    if (turn) reason = '已识别转牌节点：' + resolveTopic('turn').spots.find((item) => item.id === turn.spotId).title;
    else if (topicId === 'turn' && validFlop && streetTwoWay(hand.actionLineOTT)) reason = '有转牌行动记录，具体节点待复盘';
    if (topicId === 'ranges' && (validFlop || spot)) reason = '可用于核对双方范围的已识别节点';
    if (topicId === 'preflop' && (validFlop || spot)) reason = '有位置与翻前场景，可回看入池条件；有效筹码未核实';
    if (topicId === 'adjustment' && (validFlop || spot) && (hand.reflection || hand.mistake)) reason = '已有复盘备注，待核对是否构成对手证据';
    if (!reason) continue;
    seen.add(raw.id);
    references.push({ id: raw.id, date: hand.date || '', scenario: hand.preflopScenario,
      reference: hand.ggId || raw.id, cards: hand.heroCards || '', boardCode: hand.boardCode || '',
      position: hand.heroPosition, profileKey: profile.key, profileLabel: profile.label,
      reason, relation: 'candidate' });
  }
  return references.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.id).localeCompare(String(b.id)));
}
