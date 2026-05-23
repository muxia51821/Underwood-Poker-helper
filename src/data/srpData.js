// [V7.7.0] 从 gtoRaw 自动生成策略速查数据（原 818 行硬编码 → ~35 行）
import { Utils } from '../utils.js';
import SBvsBB from './strategy/gtoRaw/SBvsBB_SRP_flop.js';
import BTNvsBB from './strategy/gtoRaw/BTNvsBB_SRP_flop.js';

var ACTION_SHORT = {
  bet75: { code: 'BB', label: '大注75%' },
  bet50: { code: 'BM', label: '中注50%' },
  bet33: { code: 'BS', label: '小注33%' },
  check:  { code: 'X',  label: '过牌' },
};

function _getHighCard(code) {
  var order = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
  var ranks = [code.charAt(0), code.charAt(2), code.charAt(4)];
  var highest = ranks[0];
  for (var i = 1; i < ranks.length; i++) {
    if (order.indexOf(ranks[i]) < order.indexOf(highest)) highest = ranks[i];
  }
  if (['A','K','Q','J','T'].indexOf(highest) >= 0) return highest + '-High';
  return 'Low';
}

function _buildSrpEntries(data) {
  return data.boards.map(function (b) {
    var actions = [
      { key: 'bet75', freq: b.bet75 || 0 },
      { key: 'bet50', freq: b.bet50 || 0 },
      { key: 'bet33', freq: b.bet33 || 0 },
      { key: 'check', freq: b.check || 0 },
    ].sort(function (a, b) { return b.freq - a.freq; });
    return {
      scenario: data.scenario,
      flop: b.code,
      high: _getHighCard(b.code),
      category: Utils.classifyBoard(b.code),
      dominant: actions[0],
      secondary: actions[1],
      actions: actions,
    };
  });
}

export var srpData = [
  ..._buildSrpEntries(SBvsBB),
  ..._buildSrpEntries(BTNvsBB),
];

export { ACTION_SHORT };
