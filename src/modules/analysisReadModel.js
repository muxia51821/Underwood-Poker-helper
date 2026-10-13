// [V7.7.2 新增] Review / Discover / Quiz 共用的学习分析只读模型。
// 这里的规范化不会回写 HandRepo，避免分析页面意外修改用户数据。
import { Utils } from '../utils.js';

function _deriveActionLine(hand, field, prefix, missingValue) {
  if (hand[field]) return hand[field];
  if (!hand.desc) return missingValue || '';
  return Utils.extractActionLine(hand.desc, prefix) || missingValue || '';
}

export function normalizeLearningHand(hand) {
  var source = hand || {};
  var normalized = Object.assign({}, source);
  normalized.boardCategory = source.boardCategory || (source.boardCode ? Utils.classifyBoard(source.boardCode) : '');
  normalized.preflopScenario = source.preflopScenario || 'other';
  normalized.actionLineOTF = _deriveActionLine(source, 'actionLineOTF', 'OTF', source.desc ? '未知' : '');
  normalized.actionLineOTT = _deriveActionLine(source, 'actionLineOTT', 'OTT', '');
  normalized.actionLineOTR = _deriveActionLine(source, 'actionLineOTR', 'OTR', '');
  return normalized;
}

// [V7.10.5 新增] Radar 的最低可靠观察档案是牌桌人数。
// 当前历史手牌只稳定保存 tableMax；Hero 起止筹码不能代替 effective stack，不能据此伪造 100bb/200bb 档。
export function getObservedProfile(hand) {
  var tableMax = Number(hand && hand.tableMax);
  if (Number.isInteger(tableMax) && tableMax >= 2 && tableMax <= 10) {
    return { key: tableMax + 'max', label: tableMax + 'max' };
  }
  return { key: 'unknown-table', label: '桌型未知' };
}

function _isEligibleForPostflopAnalysis(hand) {
  if (!hand.boardCategory) return false;
  if (!hand.actionLineOTF || hand.actionLineOTF === '未知') return false;
  return !/\bHero\b[^\n]*\bfolds\b/i.test(hand.desc || '');
}

export function createLearningSnapshot(hands) {
  var normalizedHands = (Array.isArray(hands) ? hands : [])
    .filter(function (hand) { return hand && typeof hand === 'object'; })
    .map(normalizeLearningHand);
  return {
    hands: normalizedHands,
    eligibleHands: normalizedHands.filter(_isEligibleForPostflopAnalysis),
    totalHands: normalizedHands.length,
  };
}

export function getLearningTarget(finding) {
  if (!finding) return null;
  return {
    findingId: finding.id || '',
    type: finding.type || '',
    scenario: finding.scenario || 'other',
    boardCategory: finding.category || '',
    handIds: Array.isArray(finding.handIds) ? finding.handIds.slice() : [],
  };
}

// [V7.9.2 新增] Decision Radar 观察派生层（Decision Observation）
// 口径：命名场景（翻前单加注）× 翻牌 × 加注者 C-bet / 跟注者应对。
// 归属为启发式：desc 行动 token 不带玩家名，按下表"翻牌先行动方"推断；多边池/donk bet 属已知噪声，
// 信号 UI 必须如实标注"归属为启发式"。基线只用用户自己的样本，不涉及旧 GTO（Phase 0 裁决）。
export var OBSERVATION_VERSION = 2;

// 命名场景的翻牌行动顺序：first = 翻牌先行动方（OOP），second = 后行动方（IP，持按钮位）
var SCENARIO_FLOP_ORDER = {
  BTNvsBB: { first: 'BB', second: 'BTN' },
  SBvsBB: { first: 'SB', second: 'BB' },
  COvsBTN: { first: 'CO', second: 'BTN' },
};

// [V7.11.14 修改] Only a true heads-up table puts SB on the button; unknown BvB order is not guessed.
export function getPostflopOrder(hand) {
  var order = SCENARIO_FLOP_ORDER[hand.preflopScenario];
  if (hand.preflopScenario !== 'SBvsBB') return order || null;
  var size = Number(hand.tableMax);
  if (size === 2) return { first: 'BB', second: 'SB' };
  return Number.isInteger(size) && size >= 3 && size <= 10 ? order : null;
}

// [V7.11.14 新增] Shared attribution for Radar and logic cards; multiway/ambiguous short lines stay excluded.
export function deriveFlopDecision(hand) {
  var order = getPostflopOrder(hand);
  if (!order) return { excluded: 'unknownOrder' };
  var tokens = _flopTokens(hand.actionLineOTF);
  if (!tokens.length) return { excluded: 'noActionLine' };
  if (tokens.length > 5 || (tokens.length > 3 && !tokens.some(function (t) { return t[0] === 'R'; }))) return { excluded: 'ambiguousLine' };
  var positions = hand.preflopScenario.split('vs');
  if (!positions.includes(hand.heroPosition)) return { excluded: 'unknownRole' };
  var aggressor = hand.heroPosition === positions[0];
  var first = hand.heroPosition === order.first;
  var token;
  if (aggressor) {
    if (first) token = tokens[0];
    else if (tokens[0] === 'X') token = tokens[1];
    else return { excluded: 'donkExcluded' };
  } else {
    if (first && tokens[0] !== 'X') return { excluded: 'donkExcluded' };
    var betIndex = first ? 1 : 0;
    if (!/^[BR]/.test(tokens[betIndex] || '')) return { excluded: 'checkedThroughExcluded' };
    token = tokens[betIndex + 1];
    if (!/^[CFR]/.test(token || '')) return { excluded: 'streetEndedEarly' };
  }
  var action = _actionFromToken(token);
  if (!action || (aggressor && !['bet', 'check'].includes(action.actionClass))) return { excluded: 'streetEndedEarly' };
  return { ...action, role: aggressor ? 'aggressor' : 'caller', question: aggressor ? 'cbet' : 'facebet' };
}

// actionLineOTF 短码 → 有效 token 序列（过滤 '(3.2bb)' 类注额噪声 token）
function _flopTokens(actionLineOTF) {
  if (!actionLineOTF) return [];
  return String(actionLineOTF)
    .split('-')
    .filter(function (t) { return /^[BCXFR]/.test(t); });
}

// 单 token → { actionClass, sizingBucket }。'B60'=60% 底池；裸 'B'（无数字）=解析器按 BB 计的超大注。
function _actionFromToken(token) {
  if (!token) return null;
  var c = token.charAt(0).toUpperCase();
  if (c === 'B') {
    var num = parseFloat(token.slice(1));
    var bucket = isNaN(num) ? 'over' : num < 40 ? 'low' : num <= 70 ? 'mid' : 'high';
    return { actionClass: 'bet', sizingBucket: bucket };
  }
  if (c === 'R') return { actionClass: 'raise', sizingBucket: null };
  if (c === 'C') return { actionClass: 'call', sizingBucket: null };
  if (c === 'X') return { actionClass: 'check', sizingBucket: null };
  if (c === 'F') return { actionClass: 'fold', sizingBucket: null };
  return null;
}

/**
 * 从手牌派生翻牌决策观察（Decision Observation）。
 * 覆盖矩阵：
 *   C-bet 取加注者的首次下注/过牌；跟注者应对取对手下注之后的 call/fold/raise。
 *   普通桌 SB 先动，真正两人桌 BB 先动；具体归属与排除条件由 deriveFlopDecision 统一定义。
 * @returns {{ observations: Array, stats: {total, namedScenario, noActionLine, streetEndedEarly, donkExcluded, checkedThroughExcluded, attributed} }}
 */
export function buildFlopObservations(hands) {
  var stats = {
    total: 0, namedScenario: 0, noActionLine: 0, streetEndedEarly: 0,
    donkExcluded: 0, checkedThroughExcluded: 0, attributed: 0, unknownOrder: 0, ambiguousLine: 0,
  };
  var observations = [];
  (hands || []).forEach(function (raw) {
    stats.total++;
    var h = normalizeLearningHand(raw);
    var profile = getObservedProfile(h);
    if (!SCENARIO_FLOP_ORDER[h.preflopScenario]) return;
    stats.namedScenario++;
    var action = deriveFlopDecision(h);
    if (action.excluded) {
      if (Object.hasOwn(stats, action.excluded)) stats[action.excluded]++;
      return;
    }
    stats.attributed++;
    observations.push({
      handId: h.id,
      date: h.date,
      sessionId: h.sessionId,
      scenario: h.preflopScenario,
      boardCategory: h.boardCategory,
      role: action.role,
      question: action.question,
      actionClass: action.actionClass,
      sizingBucket: action.sizingBucket,
      didBet: action.actionClass === 'bet',
      didFold: action.actionClass === 'fold',
      pBB: h.pBB != null ? h.pBB : null,
      profileKey: profile.key,
      profileLabel: profile.label,
      observationVersion: OBSERVATION_VERSION,
    });
  });
  return { observations: observations, stats: stats };
}
