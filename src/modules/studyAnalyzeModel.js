// [V7.13.0 新增] Read-only projections shared by the two workspaces; no repository writes.
import { Utils } from '../utils.js';
import BTNvsBB from '../data/strategy/gtoRaw/BTNvsBB_SRP_flop.js';
import SBvsBB from '../data/strategy/gtoRaw/SBvsBB_SRP_flop.js';
import { normalizeLearningHand, deriveFlopDecision, getObservedProfile } from './analysisReadModel.js';

export const STUDY_SCENARIOS = { BTNvsBB, SBvsBB };
export const BOARD_LABELS = {
  dryAHigh: '高张干燥', flushy_dry: '双花干燥', straighty: '听顺面',
  flushy_straighty: '双花听顺', paired_high: '高张公对', paired_low: '低张公对',
  monotone: '单色面', dry_low: '低牌干燥', made_straight: '三连张', trips_board: '三条面',
};
export const STUDY_ACTIONS = [
  { key: 'bet75', label: '下注 75%', className: 'large' },
  { key: 'bet50', label: '下注 50%', className: 'medium' },
  { key: 'bet33', label: '下注 33%', className: 'small' },
  { key: 'check', label: '过牌', className: 'check' },
];

export function studyBoards(scenario, filters = {}) {
  const source = STUDY_SCENARIOS[scenario];
  if (!source) return [];
  const query = String(filters.query || '').replace(/\s/g, '').toLowerCase();
  return source.boards.map((board) => ({ ...board, category: Utils.classifyBoard(board.code),
    bet: board.bet75 + board.bet50 + board.bet33 }))
    .filter((board) => (!filters.category || board.category === filters.category)
      && (!query || board.code.toLowerCase().includes(query)))
    .sort((a, b) => filters.sort === 'bet' ? b.bet - a.bet || a.code.localeCompare(b.code)
      : filters.sort === 'check' ? b.check - a.check || a.code.localeCompare(b.code) : a.code.localeCompare(b.code));
}

// These subsets have no board-probability weights. Their mean is not a population GTO frequency.
export function referenceAverage(boards) {
  if (!boards.length) return null;
  const result = Object.fromEntries(STUDY_ACTIONS.map(({ key }) => [key, 0]));
  for (const board of boards) for (const { key } of STUDY_ACTIONS) result[key] += board[key] / boards.length;
  return { ...result, count: boards.length, weighting: 'unweighted-recorded-boards' };
}

export function analysisQueue(hands, filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  return (Array.isArray(hands) ? hands : []).filter((hand) => hand && hand.id).map(normalizeLearningHand)
    .filter((hand) => (!filters.profile || getObservedProfile(hand).key === filters.profile)
      && (!filters.scenario || hand.preflopScenario === filters.scenario)
      && (!filters.sessionId || hand.sessionId === filters.sessionId)
      && (filters.flag !== 'marked' || hand.marked === true)
      && (filters.flag !== 'mistake' || Boolean(String(hand.mistake || '').trim()))
      && (!query || [hand.ggId, hand.id, hand.date, hand.heroCards, hand.boardCode,
        hand.heroPosition, hand.preflopScenario, hand.mistake, hand.reflection].join(' ').toLowerCase().includes(query)))
    .sort((a, b) => {
      const av = typeof a.pBB === 'number' && Number.isFinite(a.pBB) ? a.pBB : null;
      const bv = typeof b.pBB === 'number' && Number.isFinite(b.pBB) ? b.pBB : null;
      if (filters.sort === 'loss' || filters.sort === 'swing') {
        if (av === null && bv !== null) return 1;
        if (bv === null && av !== null) return -1;
        if (av !== null && bv !== null) {
          const diff = filters.sort === 'loss' ? av - bv : Math.abs(bv) - Math.abs(av);
          if (diff) return diff;
        }
      }
      return String(b.date || '').localeCompare(String(a.date || '')) || String(a.id).localeCompare(String(b.id));
    });
}

export function handLearningContext(raw) {
  const hand = normalizeLearningHand(raw);
  const decision = deriveFlopDecision(hand);
  const topicId = hand.actionLineOTR ? 'river' : hand.actionLineOTT ? 'turn'
    : !decision.excluded ? decision.question === 'facebet' ? 'defense' : 'flop' : 'ranges';
  return { handId: hand.id, topicId, scenario: hand.preflopScenario,
    boardCode: String(hand.boardCode || '').replace(/\s/g, '').slice(0, 6) };
}
