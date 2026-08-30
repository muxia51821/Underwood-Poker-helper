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
export var OBSERVATION_VERSION = 1;

// 命名场景的翻牌行动顺序：first = 翻牌先行动方（OOP），second = 后行动方（IP，持按钮位）
var SCENARIO_FLOP_ORDER = {
  BTNvsBB: { first: 'BB', second: 'BTN' },
  SBvsBB: { first: 'BB', second: 'SB' },
  COvsBTN: { first: 'CO', second: 'BTN' },
};

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
 *   加注者 + 先行动（SBvsBB 的 SB）→ 首个 token 即 C-bet 决策；
 *   加注者 + 后行动（BTNvsBB/COvsBTN 的加注者）→ 对方过牌（首 token X）时取第二 token 作 C-bet 决策；
 *     对方先下注（donk）→ 本 v1 不纳入（donkExcluded）；
 *   跟注者 + 后行动（BTNvsBB/COvsBTN 的跟注者）→ 对方下注（首 token B/R）后取第二 token 作应对；
 *     对方过牌（checked through）→ 不纳入；
 *   跟注者 + 先行动（SBvsBB 的 BB）→ 翻牌先行动无"面对下注"，不纳入。
 * @returns {{ observations: Array, stats: {total, namedScenario, noActionLine, streetEndedEarly, donkExcluded, checkedThroughExcluded, attributed} }}
 */
export function buildFlopObservations(hands) {
  var stats = {
    total: 0, namedScenario: 0, noActionLine: 0, streetEndedEarly: 0,
    donkExcluded: 0, checkedThroughExcluded: 0, attributed: 0,
  };
  var observations = [];
  (hands || []).forEach(function (raw) {
    stats.total++;
    var h = normalizeLearningHand(raw);
    var profile = getObservedProfile(h);
    var order = SCENARIO_FLOP_ORDER[h.preflopScenario];
    if (!order) return;
    stats.namedScenario++;
    var tokens = _flopTokens(h.actionLineOTF);
    if (!tokens.length) { stats.noActionLine++; return; }
    var isAggressor = h.heroPosition === h.preflopScenario.split('vs')[0];
    if (!isAggressor && h.heroPosition !== h.preflopScenario.split('vs')[1]) return;  // 角色不符（如 limper）
    var heroActsFirst = h.heroPosition === order.first;
    var heroToken = null;
    var question = null;
    if (isAggressor) {
      if (heroActsFirst) {
        heroToken = tokens[0];
        question = 'cbet';
      } else if (_actionFromToken(tokens[0]).actionClass === 'check') {
        heroToken = tokens[1];
        question = 'cbet';
      } else {
        stats.donkExcluded++;
        return;
      }
    } else {
      // 跟注者：定位对方的首个下注 token，其后一 token = Hero 应对（命名场景按两人池启发式）
      if (heroActsFirst) {
        var preAction = _actionFromToken(tokens[0]);
        if (preAction && (preAction.actionClass === 'bet' || preAction.actionClass === 'raise')) {
          stats.donkExcluded++;  // Hero 先行 lead/donk，不属"面对下注"
          return;
        }
        var betIdx = -1;
        for (var ti = 1; ti < tokens.length; ti++) {
          var tokenAction = _actionFromToken(tokens[ti]);
          if (tokenAction && (tokenAction.actionClass === 'bet' || tokenAction.actionClass === 'raise')) { betIdx = ti; break; }
        }
        if (betIdx === -1) { stats.checkedThroughExcluded++; return; }
        heroToken = tokens[betIdx + 1];
      } else {
        var firstAction = _actionFromToken(tokens[0]);
        if (firstAction.actionClass !== 'bet' && firstAction.actionClass !== 'raise') {
          stats.checkedThroughExcluded++;
          return;
        }
        heroToken = tokens[1];
      }
      question = 'facebet';
    }
    var action = _actionFromToken(heroToken);
    if (!action) { stats.streetEndedEarly++; return; }
    stats.attributed++;
    observations.push({
      handId: h.id,
      date: h.date,
      sessionId: h.sessionId,
      scenario: h.preflopScenario,
      boardCategory: h.boardCategory,
      role: isAggressor ? 'aggressor' : 'caller',
      question: question,
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
