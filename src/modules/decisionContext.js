// [V7.15.0 新增] A viewed decision is independent of the last street reached by the hand.
import { HandReplay } from './handReplay.js';
import { deriveFlopDecision, getObservedProfile } from './analysisReadModel.js';
import { postflopReview } from './postflopReviewModel.js'; // [V7.19.0 新增]
export const STREET_NAMES = { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌', result: '结果' };
export function handRevision(hand) {
  const source = JSON.stringify([hand.desc, hand.heroCards, hand.heroPosition, hand.tableMax, hand.preflopScenario, hand.boardCode]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function decisionKey(hand, position = {}) {
  return handRevision(hand) + ':' + (position.street || 'preflop') + ':' + (Number.isInteger(position.actionIndex) ? position.actionIndex : 'street');
}
export function decisionContext(hand, position = {}) {
  const replay = HandReplay.parseReplay(hand);
  const street = replay.streets.find(item => item.key === position.street);
  const selectedStreet = street?.key || (position.street === 'result' ? 'result' : replay.streets[0]?.key || 'preflop');
  const index = Number.isInteger(position.actionIndex) && position.actionIndex >= 0 && position.actionIndex < (street?.actions.length || 0) ? position.actionIndex : null;
  const end = replay.streets.findIndex(item => item.key === selectedStreet);
  const visible = end >= 0 ? replay.streets.slice(0, end + 1) : [];
  const suggested = deriveFlopDecision(hand);
  const topicId = selectedStreet === 'flop' ? position.decisionKind === 'facingBet' ? 'defense' : position.decisionKind === 'initiative' ? 'flop'
    : !suggested.excluded ? suggested.question === 'facebet' ? 'defense' : 'flop' : 'ranges'
    : ({ preflop: 'preflop', turn: 'turn', river: 'river' })[selectedStreet] || 'ranges';
  return { handId: hand.id, reference: hand.ggId || hand.id, revision: handRevision(hand), key: decisionKey(hand, { street: selectedStreet, actionIndex: index }),
    street: selectedStreet, actionIndex: index, decisionKind: position.decisionKind || '', topicId,
    scenario: hand.preflopScenario || '', profile: getObservedProfile(hand).label, heroPosition: replay.hero.position,
    heroCards: replay.hero.cards || [], board: visible.flatMap(item => item.newCards),
    boardCode: visible.flatMap(item => item.newCards).slice(0, 3).join(''),
    prefix: visible.map(item => ({ street: item.label, actions: (item.key === selectedStreet && index !== null ? item.actions.slice(0, index) : item.actions).map(action => action.label) })),
    question: position.question || '', eligible: !replay.degraded && index !== null && ['flop', 'turn', 'river'].includes(selectedStreet),
    attribution: 'unconfirmed', effectiveStack: null, pot: null };
}
export function updateDecisionReview(hand, context, draft) {
  if (context.handId !== hand.id || context.revision !== handRevision(hand)) throw new Error('牌谱已变更，请重新核对决策后再保存；当前草稿仍保留。');
  return { ...hand, reflection: draft.reflectionDirty ? draft.reflection ?? '' : hand.reflection ?? '', decisionReviews: { ...hand.decisionReviews,
    [context.key]: { street: context.street, actionIndex: context.actionIndex, revision: context.revision, topicId: context.topicId, decisionKind: context.decisionKind || '',
      question: draft.question || '', reason: draft.reason || '', insight: draft.insight || '', references: draft.references || [],
      ...postflopReview(draft, true), updatedAt: new Date().toISOString() } } };
}
