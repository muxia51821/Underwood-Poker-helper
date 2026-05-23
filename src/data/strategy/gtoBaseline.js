// [V7.4.0] GTO 极端阈值 — 从 gtoRaw 自动编译，不手动定义
// 原理：遍历所有场景的 184 行 GTO 频率，标记频率 < 5% 或 > 90% 的极端节点
// L1 检测：用户手牌 → boardCode → 匹配 GTO 极端节点 → 对比用户实际 CBet

import BTNvsBB from './gtoRaw/BTNvsBB_SRP_flop.js';
import SBvsBB from './gtoRaw/SBvsBB_SRP_flop.js';

var SCENARIOS = { BTNvsBB: BTNvsBB, SBvsBB: SBvsBB };

/**
 * 从 gtoRaw 编译极端阈值表
 * 返回 { [scenario]: { [actionKey]: { extremeHigh: Set<boardCode>, extremeLow: Set<boardCode> } } }
 */
function _compileExtremes() {
  var result = {};
  Object.keys(SCENARIOS).forEach(function (scKey) {
    var sc = SCENARIOS[scKey];
    var scExtremes = {};
    sc.actionColumns.forEach(function (col) {
      var extremeHigh = [];
      var extremeLow = [];
      sc.boards.forEach(function (b) {
        var freq = b[col.key] || 0;
        if (freq >= 90) extremeHigh.push(b.code);
        if (freq <= 5) extremeLow.push(b.code);
      });
      scExtremes[col.key] = { extremeHigh: extremeHigh, extremeLow: extremeLow };
    });
    result[scKey] = scExtremes;
  });
  return result;
}

var _extremes = _compileExtremes();

/**
 * L1 极端检测：给定一手牌，检测是否存在极端 GTO 偏离
 * @param {object} hand — 包含 preflopScenario, boardCode, actionLineOTF 的 HandReview
 * @returns {Array|null} — 极端偏离描述数组，或 null
 */
export function detectExtremes(hand) {
  var scKey = hand.preflopScenario;
  if (!scKey || !_extremes[scKey]) return null;
  var scExtremes = _extremes[scKey];
  var boardCode = hand.boardCode;
  if (!boardCode) return null;

  var results = [];
  // 从 actionLineOTF 推断用户实际动作
  var userAction = _parseUserFlopAction(hand.actionLineOTF);

  Object.keys(scExtremes).forEach(function (actionKey) {
    var ext = scExtremes[actionKey];
    var inHigh = ext.extremeHigh.indexOf(boardCode) !== -1;
    var inLow = ext.extremeLow.indexOf(boardCode) !== -1;

    if (inHigh && userAction !== actionKey) {
      results.push(
        'GTO 在此牌面几乎总是 ' + actionKey.toUpperCase() + '（>' + (ext.extremeHigh.length ? '90' : '') + '%），你选择了其他动作。建议检查此类牌面的策略。'
      );
    }
    if (inLow && userAction === actionKey) {
      results.push(
        'GTO 在此牌面几乎不做 ' + actionKey.toUpperCase() + '（<' + (ext.extremeLow.length ? '5' : '') + '%），但你做了。可能是策略偏差。'
      );
    }
  });

  return results.length ? results : null;
}

/**
 * 查询某个场景+牌面的 GTO 参考频率
 */
export function getGTOReference(scenarioKey, boardCode) {
  var sc = SCENARIOS[scenarioKey];
  if (!sc) return null;
  for (var i = 0; i < sc.boards.length; i++) {
    if (sc.boards[i].code === boardCode) return sc.boards[i];
  }
  return null;
}

/**
 * 获取所有可用场景列表
 */
export function getAvailableScenarios() {
  return Object.keys(SCENARIOS).map(function (k) {
    return { key: k, label: SCENARIOS[k].description, hero: SCENARIOS[k].heroPosition, villain: SCENARIOS[k].villainPosition };
  });
}

// 从 actionLineOTF 推断用户翻牌动作
function _parseUserFlopAction(actionLine) {
  if (!actionLine) return null;
  if (/^B/i.test(actionLine)) {
    // 检测下注大小类型
    if (/^B7[0-9]|^B8[0-9]/.test(actionLine)) return 'bet75';
    if (/^B[4-6][0-9]/.test(actionLine)) return 'bet50';
    return 'bet33';
  }
  if (/^X/.test(actionLine) || /^C/.test(actionLine)) return 'check';
  return null;
}
