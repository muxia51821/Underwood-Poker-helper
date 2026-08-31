// [V7.11.0 新增] 单手牌 Spot 识别（复盘牌理参考的派生层，纯函数、零 store import）。
// 口径与 Decision Radar 的观察派生同源（启发式归属）：desc 行动 token 不带玩家名，
// 两人池按位置交替归属（OOP 先动）；token >3 且不含 R 视作多人池噪声不识别。
// 河牌惊悚/空白为启发式二分：完成 3 同花或 3 连张窗口=惊悚。识别结果仅供牌理参考展示，不写回手牌数据。
import { normalizeLearningHand } from './analysisReadModel.js';

export var SPOT_MATCHER_VERSION = 1;

var SCENARIO_ORDER = {
  BTNvsBB: { raiser: 'BTN', caller: 'BB', first: 'BB' },
  SBvsBB: { raiser: 'SB', caller: 'BB', first: 'BB' },
  COvsBTN: { raiser: 'CO', caller: 'BTN', first: 'CO' },
};

var RANK_ORDER = '23456789TJQKA';

function lineTokens(line) {
  return String(line || '').split('-').filter(function (t) { return /^[BCXFR]/.test(t); });
}

function streetTwoWay(line) {
  var tokens = lineTokens(line);
  if (!tokens.length || tokens.length > 5) return null;
  if (tokens.length > 3 && !tokens.some(function (t) { return t.charAt(0).toUpperCase() === 'R'; })) return null;
  return tokens;
}

function actionsAt(tokens, heroFirst) {
  var heroIdx = heroFirst ? [0, 2, 4] : [1, 3];
  var oppIdx = heroFirst ? [1, 3] : [0, 2, 4];
  var at = function (i) { return tokens[i] ? tokens[i].charAt(0).toUpperCase() : null; };
  return {
    hero: heroIdx.map(at).filter(Boolean),
    opp: oppIdx.map(at).filter(Boolean),
  };
}

function heroSide(tokens, heroFirst) {
  var a = actionsAt(tokens, heroFirst);
  var bet = function (x) { return x === 'B' || x === 'R'; };
  if (a.hero.some(bet)) return 'agg';
  if (a.opp.some(bet)) return 'def';
  return 'chk';
}

function riverQuestion(tokens, heroFirst) {
  var a = actionsAt(tokens, heroFirst);
  if (!a.hero.length) return null;
  var h0 = a.hero[0];
  if (h0 === 'B' || h0 === 'R') return 'bet';
  var o0 = a.opp[0];
  if (o0 === 'B' || o0 === 'R') return 'facebet';
  return 'check';
}

export function riverThreat(prev4, riverCard) {
  if (!prev4 || prev4.length !== 4 || !riverCard) return null;
  var suit = riverCard.charAt(1);
  var flushThreat = prev4.filter(function (c) { return c.charAt(1) === suit; }).length >= 2;
  var rIdx = RANK_ORDER.indexOf(riverCard.charAt(0));
  var prevIdx = prev4.map(function (c) { return RANK_ORDER.indexOf(c.charAt(0)); });
  var straightThreat = false;
  for (var start = rIdx - 2; start <= rIdx; start++) {
    if (start < 0 || start + 2 >= RANK_ORDER.length) continue;
    var need = [start, start + 1, start + 2];
    if (need.indexOf(rIdx) === -1) continue;
    var others = need.filter(function (i) { return i !== rIdx; });
    if (others.every(function (i) { return prevIdx.indexOf(i) !== -1; })) { straightThreat = true; break; }
  }
  return { flushThreat: flushThreat, straightThreat: straightThreat, scary: flushThreat || straightThreat };
}

function boardCardsFromDesc(desc) {
  var d = String(desc || '');
  var otfM = d.match(/OTF翻牌 ([AKQJT2-9][shdc]) ([AKQJT2-9][shdc]) ([AKQJT2-9][shdc])/);
  var ottM = d.match(/OTT转牌 ([AKQJT2-9][shdc])/);
  var otrM = d.match(/OTR河牌 ([AKQJT2-9][shdc])/);
  if (!otfM) return null;
  return {
    flop: [otfM[1], otfM[2], otfM[3]],
    turn: ottM ? ottM[1] : null,
    river: otrM ? otrM[1] : null,
  };
}

/**
 * 判定单手牌命中的牌理参考 spot。
 * @returns {{ spotId, street, scenario, role, question, line, riverType }|null}
 *   spotId 约定：翻牌 '<scenario>-<role>-<question>'（如 btnvsbb-raiser-cbet）；
 *   河牌 '<scenario>-<role>-river<question>'（如 btnvsbb-raiser-riverbet / btnvsbb-caller-riverfirst / sbvsbb-raiser-riverdual）。
 */
export function matchHandSpot(hand) {
  var h = normalizeLearningHand(hand);
  var order = SCENARIO_ORDER[h.preflopScenario];
  if (!order) return null;
  if (h.heroPosition !== order.raiser && h.heroPosition !== order.caller) return null;
  var role = h.heroPosition === order.raiser ? 'raiser' : 'caller';
  var heroFirst = h.heroPosition === order.first;

  var otf = streetTwoWay(h.actionLineOTF);
  if (!otf) return null;

  var riverType = null;
  var boards = boardCardsFromDesc(h.desc);
  if (boards && boards.river && boards.turn) {
    var t = riverThreat([boards.flop[0], boards.flop[1], boards.flop[2], boards.turn], boards.river);
    if (t) riverType = t.scary ? 'scary' : 'blank';
  }

  // 河牌命中最优先（到达河牌的手牌，翻牌/转牌线作为标注）
  var otR = streetTwoWay(h.actionLineOTR);
  if (otR) {
    var rq = riverQuestion(otR, heroFirst);
    if (rq === 'bet' || rq === 'facebet' || rq === 'check') {
      var ott = streetTwoWay(h.actionLineOTT);
      var spotId = null;
      if (h.preflopScenario === 'BTNvsBB' && role === 'raiser' && rq === 'bet') spotId = 'btnvsbb-raiser-riverbet';
      else if (h.preflopScenario === 'BTNvsBB' && role === 'caller') spotId = 'btnvsbb-caller-riverfirst';
      else if (h.preflopScenario === 'SBvsBB' && role === 'raiser' && (rq === 'bet' || rq === 'facebet')) spotId = 'sbvsbb-raiser-riverdual';
      if (spotId) {
        return {
          spotId: spotId,
          street: 'river',
          scenario: h.preflopScenario,
          role: role,
          question: rq,
          line: (heroSide(otf, heroFirst) || '?') + '→' + (ott ? (heroSide(ott, heroFirst) || '?') : '?'),
          riverType: riverType,
        };
      }
      return null;  // 到河牌但无对应牌理卡的组合（如 COvsBTN 防守河牌）
    }
  }

  // 翻牌 spot（与 Radar 五 spot 对齐；到达河牌但未命中河牌卡的不回落翻牌卡）
  var ottEarly = streetTwoWay(h.actionLineOTT);
  if (ottEarly) return null;  // 打过转牌的手牌不做翻牌牌理参考（复盘重点是当前街）
  var flopTokens = actionsAt(otf, heroFirst);
  var question = null;
  var heroToken = null;
  var bet = function (x) { return x === 'B' || x === 'R'; };
  if (role === 'raiser') {
    if (heroFirst) { heroToken = otf[0]; question = 'cbet'; }
    else if (flopTokens.opp.length && flopTokens.opp[0] === 'X' && !bet(flopTokens.opp[0])) { heroToken = otf[1]; question = 'cbet'; }
    else return null;
  } else {
    if (heroFirst) return null;  // SBvsBB 的 BB 先行动无"面对下注"（与 Radar 口径一致）
    if (!flopTokens.opp.length || !bet(flopTokens.opp[0])) return null;
    heroToken = otf[1];
    question = 'facebet';
  }
  if (!heroToken) return null;
  var action = heroToken.charAt(0).toUpperCase();
  if (action !== 'B' && action !== 'C' && action !== 'X' && action !== 'F' && action !== 'R') return null;
  var spotKey = h.preflopScenario.toLowerCase() + '-' + role + '-' + question;
  return { spotId: spotKey, street: 'flop', scenario: h.preflopScenario, role: role, question: question, line: null, riverType: null };
}
