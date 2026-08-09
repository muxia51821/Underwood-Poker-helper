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

