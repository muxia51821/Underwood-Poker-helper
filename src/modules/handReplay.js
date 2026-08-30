// [V7.10.0 新增] Hand Replay — 手牌可视化回放（只读派生层）
// 领域原则：回放是 handReviews 的只读可视化派生——不新增持久化对象、不写回任何手牌字段、
// 不做胜率/solver/GTO 提示、不做动画；本模块不 import 任何 store/Repo（结构性保证零写路径）。
// desc 格式由 ggParser 生成（见 docs/handoff-hand-replay-ui.md 第三节）；解析异常一律走降级视图，不抛错。
// 翻后动作 token 不含玩家名（解析器已知信息损耗），按匿名序列展示，不臆造归属。
import { Utils } from '../utils.js';

var STREET_LABELS = { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌' };
// 座位角度静态映射：0°=12点方向顺时针，BTN 固定顶部，行动顺序沿角度递增
var POS_ANGLES_6 = { BTN: 0, SB: 60, BB: 120, UTG: 180, MP: 240, CO: 300 };
var POS_ANGLES_9 = { BTN: 0, SB: 40, BB: 80, UTG: 120, 'UTG+1': 160, MP: 200, 'MP+1': 240, HJ: 280, CO: 320 };
var POS_ALL = {};
Object.keys(POS_ANGLES_6).forEach(function (p) { POS_ALL[p] = true; });
Object.keys(POS_ANGLES_9).forEach(function (p) { POS_ALL[p] = true; });

var DEGRADE_LABELS = {
  manual_record: '手工记录，无逐街牌局数据',
  no_desc: '无牌局描述',
  no_preflop_line: '缺少翻前行动记录',
  no_hero_cards: '缺少有效 Hero 底牌',
  board_conflict: '街道牌面信息自相矛盾',
  parse_error: '解析异常',
};

function _normCard(tok) {
  if (!/^[2-9TJQKAtjqka][shdcSHDC]$/.test(tok)) return null;
  return tok.charAt(0).toUpperCase() + tok.charAt(1).toLowerCase();
}

function _extractCards(str) {
  var out = [];
  var re = /[2-9TJQKAtjqka][shdcSHDC]/g;
  var m;
  while ((m = re.exec(String(str || ''))) !== null) {
    var c = _normCard(m[0]);
    if (c) out.push(c);
  }
  return out;
}

function _validHeroCards(str) {
  var parts = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return null;
  var a = _normCard(parts[0]);
  var b = _normCard(parts[1]);
  if (!a || !b) return null;
  return [a, b];
}

// 翻后 token 切分：生成器以空格连接 token，但 "B64 (3.2bb)" 与 "B 12.0bb" 内含空格需回拼
function _splitTokens(str) {
  var raw = String(str || '').trim().split(/\s+/).filter(Boolean);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var prev = out[out.length - 1];
    if (prev && /^\(/.test(raw[i])) out[out.length - 1] = prev + ' ' + raw[i];
    else if (prev === 'B' && /^[\d.]+bb$/.test(raw[i])) out[out.length - 1] = 'B ' + raw[i];
    else out.push(raw[i]);
  }
  return out;
}

function _parseToken(tok) {
  if (tok === 'X') return { raw: tok, label: '过牌', kind: 'check' };
  if (tok === 'F') return { raw: tok, label: '弃牌', kind: 'fold' };
  if (tok === 'C') return { raw: tok, label: '跟注', kind: 'call' };
  var m = tok.match(/^B(\d+) \(([\d.]+)bb\)$/);
  if (m) return { raw: tok, label: '下注 ' + m[1] + '%（' + m[2] + 'bb）', kind: 'bet', bb: parseFloat(m[2]) };
  m = tok.match(/^B ([\d.]+)bb$/);
  if (m) return { raw: tok, label: '下注 ' + m[1] + 'bb', kind: 'bet', bb: parseFloat(m[1]) };
  m = tok.match(/^R([\d.]+)bb$/);
  if (m) return { raw: tok, label: '加注到 ' + m[1] + 'bb', kind: 'raise', bb: parseFloat(m[1]) };
  return { raw: tok, label: tok, kind: 'raw' };
}

// 翻前行片段：Hero 段自带位置+底牌，对手段按位置白名单匹配，匹配不到原样保留（不臆造）
function _parsePreflopSegments(body) {
  var hero = null;
  var segments = [];
  var rawSegs = String(body || '').split(', ');
  for (var i = 0; i < rawSegs.length; i++) {
    var seg = rawSegs[i].trim();
    if (!seg) continue;
    var hm = seg.match(/^Hero\s*([A-Z0-9+]*)\/\[([^\]]*)\]\s*(.*)$/);
    if (hm) {
      var item = { kind: 'hero', pos: hm[1], cardsStr: hm[2] || '', act: (hm[3] || '').trim(), raw: seg };
      if (!hero) hero = item;
      segments.push(item);
      continue;
    }
    var om = seg.match(/^([A-Z][A-Z0-9+]{0,5})\s+(.+)$/);
    if (om && POS_ALL[om[1]]) segments.push({ kind: 'opp', pos: om[1], act: om[2].trim(), raw: seg });
    else segments.push({ kind: 'text', pos: '', act: '', raw: seg });
  }
  return { hero: hero, segments: segments };
}

function _parseStreetLine(label, rest) {
  var key = label === 'OTF翻牌' ? 'flop' : label === 'OTT转牌' ? 'turn' : 'river';
  var sepIdx = rest.indexOf('行动：');
  var cardsPart = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest;
  var tokensPart = sepIdx >= 0 ? rest.slice(sepIdx + '行动：'.length) : '';
  var actions = _splitTokens(tokensPart).map(_parseToken);
  var invested = 0;
  for (var i = 0; i < actions.length; i++) {
    if (actions[i].bb) invested += actions[i].bb;
  }
  return {
    key: key,
    label: STREET_LABELS[key],
    newCards: _extractCards(cardsPart),
    actions: actions,
    investedBB: Math.round(invested * 10) / 10,
  };
}

function _parseOppShowdownLine(line) {
  var m = line.match(/^([^\s\[]+) \[([^\]]+)\](?: \(([^)]*)\))? and (won|lost)( \([^)]*\))?(?: with (.+))?$/);
  if (m) {
    return {
      who: m[1],
      cards: _extractCards(m[2]),
      desc: m[3] || '',
      result: m[4],
      amountText: (m[5] || '').trim(),
      handName: (m[6] || '').trim(),
    };
  }
  m = line.match(/^([^\s\[]+) \[([^\]]+)\](?: \(([^)]*)\))?$/);
  if (m) return { who: m[1], cards: _extractCards(m[2]), desc: m[3] || '', result: '', amountText: '', handName: '' };
  return null;
}

function _stackToBB(value, bbValue) {
  var num = parseFloat(value);
  if (bbValue <= 0 || isNaN(num)) return null;
  return Math.round((num / bbValue) * 10) / 10;
}

function _degraded(hand, reason) {
  hand = hand && typeof hand === 'object' ? hand : {};
  var desc = typeof hand.desc === 'string' ? hand.desc : '';
  var pm = desc.match(/Hero\s*([A-Z0-9+]*)\/\[([^\]]*)\]/);
  var cardsStr = _validHeroCards(hand.heroCards) ? String(hand.heroCards).trim() : (pm ? pm[2].trim() : '');
  var pos = hand.heroPosition || (pm ? pm[1] : '') || '';
  return {
    degraded: true,
    degradedReason: reason,
    degradedLabel: DEGRADE_LABELS[reason] || reason,
    hero: { position: pos, cards: _validHeroCards(cardsStr), cardsStr: cardsStr, startStackBB: null, endStackBB: null },
    tableMax: hand.tableMax || 0,
    seats: [],
    extraPositions: [],
    streets: [],
    board: [],
    showdown: { hero: null, opponents: [] },
    result: { pBB: hand.pBB != null ? hand.pBB : null, endStackBB: null },
    bigLoss: desc.indexOf('⚠️') !== -1,
    summary: {
      boardStr: hand.boardCode || '',
      actionLines: { flop: hand.actionLineOTF || '', turn: hand.actionLineOTT || '', river: hand.actionLineOTR || '' },
    },
  };
}

/**
 * 解析手牌记录为回放模型（纯函数，不触 Repo，永不抛错）。
 * 返回 { degraded, degradedReason, degradedLabel, hero, tableMax, seats, extraPositions,
 *        streets, board, showdown, result, bigLoss, summary? }
 * streets: [{ key:'preflop'|'flop'|'turn'|'river', label, newCards:[], actions:[], investedBB }]
 */
function parseReplay(hand) {
  try {
    if (!hand || typeof hand !== 'object') return _degraded(hand, 'no_desc');
    if (hand.gg !== true) return _degraded(hand, 'manual_record');
    var desc = typeof hand.desc === 'string' ? hand.desc : '';
    if (!desc.trim()) return _degraded(hand, 'no_desc');

    var lines = desc.split('\n');
    var heroShow = null;
    var bigLoss = false;
    var oppShowdowns = [];
    var preflop = null;
    var streets = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('⚠️') !== -1) { bigLoss = true; continue; }
      // Hero shows 后缀由生成器追加在最后一条街（或无街时的翻前）行尾，逐行剥离
      var showsM = line.match(/\s{2,}shows\s*\[([^\]]*)\](?:\s*\(([^)]*)\))?\s*$/);
      if (showsM) {
        heroShow = { cards: _extractCards(showsM[1]), desc: showsM[2] || '' };
        line = line.slice(0, showsM.index);
      }
      if (!line.trim()) continue;
      if (/^preflop 行动：/.test(line)) {
        if (!preflop) preflop = _parsePreflopSegments(line.replace(/^preflop 行动：/, ''));
        continue;
      }
      var stM = line.match(/^(OTF翻牌|OTT转牌|OTR河牌)\s*/);
      if (stM) {
        streets.push(_parseStreetLine(stM[1], line.slice(stM[0].length)));
        continue;
      }
      var opp = _parseOppShowdownLine(line.trim());
      if (opp) oppShowdowns.push(opp);
      // 其余行忽略——desc 原文仍在展开区可见，不臆造内容
    }

    if (!preflop) return _degraded(hand, 'no_preflop_line');
    var heroCards = _validHeroCards(hand.heroCards) ||
      (preflop.hero ? _validHeroCards(preflop.hero.cardsStr) : null);
    if (!heroCards) return _degraded(hand, 'no_hero_cards');

    var preflopStreet = {
      key: 'preflop',
      label: STREET_LABELS.preflop,
      newCards: [],
      actions: preflop.segments.map(function (seg) {
        if (seg.kind === 'hero') {
          return {
            kind: 'hero',
            pos: seg.pos,
            act: seg.act,
            raw: seg.raw,
            label: 'Hero' + (seg.pos ? '·' + seg.pos : '') + (seg.act ? ' ' + seg.act : ''),
          };
        }
        if (seg.kind === 'opp') return { kind: 'opp', pos: seg.pos, act: seg.act, raw: seg.raw, label: seg.pos + ' ' + seg.act };
        return { kind: 'text', pos: '', act: '', raw: seg.raw, label: seg.raw };
      }),
      investedBB: null,
    };

    // 街道牌面自洽校验：同一张公共牌出现两次视为数据异常（run-it-twice 等残缺场景的兜底）
    var seen = {};
    var board = [];
    var orderedStreets = [preflopStreet].concat(streets);
    for (var s = 1; s < orderedStreets.length; s++) {
      var nc = orderedStreets[s].newCards;
      for (var c = 0; c < nc.length; c++) {
        if (seen[nc[c]]) return _degraded(hand, 'board_conflict');
        seen[nc[c]] = true;
        board.push(nc[c]);
      }
    }

    var heroPos = (preflop.hero && preflop.hero.pos) || hand.heroPosition || '';
    var positions = [];
    var addPos = function (p) {
      if (p && POS_ALL[p] && positions.indexOf(p) === -1) positions.push(p);
    };
    orderedStreets[0].actions.forEach(function (a) { if (a.kind === 'hero' || a.kind === 'opp') addPos(a.pos); });
    addPos(heroPos);
    var tableMax = hand.tableMax === 6 || hand.tableMax === 9 ? hand.tableMax : 0;
    var angles = tableMax === 9 ? POS_ANGLES_9
      : tableMax === 6 ? POS_ANGLES_6
        : (positions.some(function (p) { return !(p in POS_ANGLES_6); }) ? POS_ANGLES_9 : POS_ANGLES_6);
    var seats = positions
      .filter(function (p) { return p in angles; })
      .map(function (p) { return { pos: p, angle: angles[p], isHero: p === heroPos }; })
      .sort(function (a, b) { return a.angle - b.angle; });
    var extraPositions = positions.filter(function (p) { return !(p in angles); });

    var bbValue = parseFloat(hand.bbValue) || 0;
    return {
      degraded: false,
      degradedReason: '',
      degradedLabel: '',
      hero: {
        position: heroPos,
        cards: heroCards,
        startStackBB: _stackToBB(hand.heroStartStack, bbValue),
        endStackBB: _stackToBB(hand.heroEndStack, bbValue),
      },
      tableMax: tableMax,
      seats: seats,
      extraPositions: extraPositions,
      streets: orderedStreets,
      board: board,
      showdown: { hero: heroShow, opponents: oppShowdowns },
      result: { pBB: hand.pBB != null ? hand.pBB : null, endStackBB: _stackToBB(hand.heroEndStack, bbValue) },
      bigLoss: bigLoss,
    };
  } catch (e) {
    return _degraded(hand, 'parse_error');
  }
}

// ---- 渲染（DOM API + 文档片段；用户文本一律 textContent，卡牌走 renderCardBadges）----

function _el(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}

function _badgesHtml(cards) {
  return Utils.renderCardBadges((cards || []).join(' '), {});
}

function _seatXY(angle) {
  var rad = (angle * Math.PI) / 180;
  return {
    x: Math.round((50 + 46 * Math.sin(rad)) * 100) / 100,
    y: Math.round((50 - 42 * Math.cos(rad)) * 100) / 100,
  };
}

function _tableEl(model, boardCards, highlightFrom) {
  var table = _el('div', 'replay-table');
  model.seats.forEach(function (seat) {
    var xy = _seatXY(seat.angle);
    var s = _el('div', 'replay-seat' + (seat.isHero ? ' replay-seat--hero' : ''));
    s.style.left = xy.x + '%';
    s.style.top = xy.y + '%';
    if (seat.isHero) s.title = 'Hero';
    s.appendChild(_el('span', 'replay-seat__pos', seat.isHero && seat.pos ? 'Hero·' + seat.pos : seat.pos));
    table.appendChild(s);
  });
  var board = _el('div', 'replay-board');
  if (boardCards.length) {
    var oldStr = boardCards.slice(0, highlightFrom).join(' ');
    var newStr = boardCards.slice(highlightFrom).join(' ');
    if (oldStr) {
      var oldWrap = _el('span', 'replay-board__cards');
      oldWrap.innerHTML = _badgesHtml(boardCards.slice(0, highlightFrom));
      board.appendChild(oldWrap);
    }
    if (newStr) {
      var newWrap = _el('span', 'replay-board__cards replay-board__cards--new');
      newWrap.innerHTML = _badgesHtml(boardCards.slice(highlightFrom));
      board.appendChild(newWrap);
    }
  } else {
    board.appendChild(_el('span', 'replay-board__empty', '暂无公共牌'));
  }
  table.appendChild(board);
  return table;
}

function _streetStage(model, street) {
  var wrap = _el('div', 'replay-street');
  var idx = model.streets.indexOf(street);
  var acc = [];
  for (var i = 0; i <= idx; i++) acc = acc.concat(model.streets[i].newCards);
  var beforeCount = 0;
  for (var j = 0; j < idx; j++) beforeCount += model.streets[j].newCards.length;
  wrap.appendChild(_tableEl(model, acc, beforeCount));
  if (street.key !== 'preflop' && street.investedBB > 0) {
    wrap.appendChild(_el('div', 'replay-pot', '本街已知投入 ≈' + Utils.safeFixed(street.investedBB, 1) + 'bb'));
  }
  var acts = _el('div', 'replay-actions');
  if (!street.actions.length) {
    acts.appendChild(_el('span', 'replay-pot', street.key === 'preflop' ? '（无翻前动作记录）' : '（本街无动作记录）'));
  }
  street.actions.forEach(function (a) {
    var chip = _el('span', 'replay-chip' + (a.kind === 'hero' ? ' replay-chip--hero' : ''), a.label);
    chip.title = a.raw;
    acts.appendChild(chip);
  });
  wrap.appendChild(acts);
  return wrap;
}

function _resultStage(model) {
  var wrap = _el('div', 'replay-resultstage');
  wrap.appendChild(_tableEl(model, model.board, model.board.length));
  var sd = _el('div', 'replay-showdown');
  if (model.showdown.hero && model.showdown.hero.cards.length) {
    var hRow = _el('div', 'replay-showdown__row');
    hRow.appendChild(_el('span', 'replay-showdown__who', 'Hero 摊牌'));
    var hCards = _el('span');
    hCards.innerHTML = _badgesHtml(model.showdown.hero.cards);
    hRow.appendChild(hCards);
    if (model.showdown.hero.desc) hRow.appendChild(_el('span', null, model.showdown.hero.desc));
    sd.appendChild(hRow);
  }
  model.showdown.opponents.forEach(function (o) {
    var row = _el('div', 'replay-showdown__row');
    row.appendChild(_el('span', 'replay-showdown__who', o.who));
    if (o.cards.length) {
      var oCards = _el('span');
      oCards.innerHTML = _badgesHtml(o.cards);
      row.appendChild(oCards);
    }
    if (o.desc) row.appendChild(_el('span', null, o.desc));
    if (o.result) {
      row.appendChild(_el('span', o.result === 'won' ? 'replay-showdown__win' : 'replay-showdown__lose', o.result === 'won' ? '赢' : '输'));
    }
    if (o.amountText) row.appendChild(_el('span', null, o.amountText));
    if (o.handName) row.appendChild(_el('span', null, '· ' + o.handName));
    sd.appendChild(row);
  });
  if (!model.showdown.hero && !model.showdown.opponents.length) {
    sd.appendChild(_el('span', 'replay-pot', '本手无摊牌信息'));
  }
  wrap.appendChild(sd);

  var res = _el('div', 'replay-result');
  res.appendChild(_el('span', null, '盈亏：'));
  var pbb = _el('span');
  pbb.innerHTML = Utils.formatProfitHTML(model.result.pBB);
  res.appendChild(pbb);
  if (model.result.endStackBB != null) {
    res.appendChild(_el('span', null, '结束筹码 ≈' + Utils.safeFixed(model.result.endStackBB, 1) + 'bb'));
  }
  wrap.appendChild(res);
  if (model.bigLoss) wrap.appendChild(_el('div', 'replay-bigloss', '⚠️ 大底池亏损手牌，请详细复盘'));
  return wrap;
}

function _buildReplayView(model) {
  var root = _el('div', 'replay-view');
  var stepCount = model.streets.length + 1;
  var stepIdx = 0;

  var bar = _el('div', 'replay-steps');
  var prevBtn = _el('button', 'replay-step replay-step--nav', '◀ 上一步');
  prevBtn.type = 'button';
  var nextBtn = _el('button', 'replay-step replay-step--nav', '下一步 ▶');
  nextBtn.type = 'button';
  bar.appendChild(prevBtn);
  var stepBtns = [];
  for (var i = 0; i < stepCount; i++) {
    (function (idx) {
      var b = _el('button', 'replay-step', idx < model.streets.length ? model.streets[idx].label : '结果');
      b.type = 'button';
      b.addEventListener('click', function () { stepIdx = idx; _paint(); });
      stepBtns.push(b);
      bar.appendChild(b);
    })(i);
  }
  bar.appendChild(nextBtn);
  root.appendChild(bar);

  var stage = _el('div', 'replay-stage');
  root.appendChild(stage);

  var heroLine = _el('div', 'replay-heroline');
  heroLine.appendChild(_el('span', null, 'Hero' + (model.hero.position ? ' · ' + model.hero.position : '') + ' ·'));
  var heroCards = _el('span');
  heroCards.innerHTML = _badgesHtml(model.hero.cards);
  heroLine.appendChild(heroCards);
  root.appendChild(heroLine);
  if (model.extraPositions.length) {
    root.appendChild(_el('div', 'replay-legend', '其他出现位置：' + model.extraPositions.join('、')));
  }
  root.appendChild(_el('div', 'replay-legend',
    '图例：X=过牌 · F=弃牌 · C=跟注 · B{n}({b}bb)=按底池百分比下注 · R{b}bb=加注到；已知投入不含跟注/过牌与未返还部分，精确结果以最终盈亏为准'));

  function _paint() {
    prevBtn.disabled = stepIdx <= 0;
    nextBtn.disabled = stepIdx >= stepCount - 1;
    for (var j = 0; j < stepBtns.length; j++) stepBtns[j].classList.toggle('replay-step--active', j === stepIdx);
    stage.replaceChildren();
    stage.appendChild(stepIdx < model.streets.length
      ? _streetStage(model, model.streets[stepIdx])
      : _resultStage(model));
  }
  prevBtn.addEventListener('click', function () { if (stepIdx > 0) { stepIdx--; _paint(); } });
  nextBtn.addEventListener('click', function () { if (stepIdx < stepCount - 1) { stepIdx++; _paint(); } });
  _paint();
  return root;
}

function _buildFullReview(model) {
  var root = _el('div', 'replay-review');
  root.appendChild(_el('div', 'replay-review__title', '全街回顾'));
  model.streets.forEach(function (st) {
    var row = _el('div', 'replay-review__row');
    row.appendChild(_el('span', 'replay-review__street', st.label));
    if (st.key === 'preflop') {
      row.appendChild(_el('span', null, st.actions.map(function (a) { return a.raw; }).join('，') || '（无记录）'));
    } else {
      if (st.newCards.length) {
        var b = _el('span');
        b.innerHTML = _badgesHtml(st.newCards);
        row.appendChild(b);
      }
      var text = st.actions.map(function (a) { return a.label; }).join('，') || '（无动作记录）';
      if (st.investedBB > 0) text += ' · 已知投入≈' + Utils.safeFixed(st.investedBB, 1) + 'bb';
      row.appendChild(_el('span', null, text));
    }
    root.appendChild(row);
  });
  if (model.showdown.hero && model.showdown.hero.cards.length) {
    var hRow = _el('div', 'replay-review__row');
    hRow.appendChild(_el('span', 'replay-review__street', '摊牌'));
    hRow.appendChild(_el('span', null, 'Hero shows'));
    var hCards = _el('span');
    hCards.innerHTML = _badgesHtml(model.showdown.hero.cards);
    hRow.appendChild(hCards);
    if (model.showdown.hero.desc) hRow.appendChild(_el('span', null, model.showdown.hero.desc));
    root.appendChild(hRow);
  }
  model.showdown.opponents.forEach(function (o) {
    var row = _el('div', 'replay-review__row');
    row.appendChild(_el('span', 'replay-review__street', '摊牌'));
    row.appendChild(_el('span', null, o.who));
    if (o.cards.length) {
      var oCards = _el('span');
      oCards.innerHTML = _badgesHtml(o.cards);
      row.appendChild(oCards);
    }
    var parts = [];
    if (o.desc) parts.push(o.desc);
    if (o.result) parts.push(o.amountText ? o.result + ' ' + o.amountText : o.result);
    if (o.handName) parts.push('with ' + o.handName);
    if (parts.length) row.appendChild(_el('span', null, parts.join(' ')));
    root.appendChild(row);
  });
  var lastRow = _el('div', 'replay-review__row');
  lastRow.appendChild(_el('span', 'replay-review__street', '结果'));
  var pbb = _el('span');
  pbb.innerHTML = Utils.formatProfitHTML(model.result.pBB);
  lastRow.appendChild(pbb);
  if (model.result.endStackBB != null) {
    lastRow.appendChild(_el('span', null, '结束筹码 ≈' + Utils.safeFixed(model.result.endStackBB, 1) + 'bb'));
  }
  if (model.bigLoss) lastRow.appendChild(_el('span', 'replay-bigloss', '⚠️ 大底池亏损手牌'));
  root.appendChild(lastRow);
  return root;
}

function _kvRow(parent, label, text) {
  var row = _el('div', 'replay-degraded__row');
  row.appendChild(_el('span', 'replay-degraded__label', label));
  row.appendChild(_el('span', null, text));
  parent.appendChild(row);
}

function _buildDegraded(model) {
  var root = _el('div', 'replay-degraded');
  root.appendChild(_el('div', 'replay-degraded__banner',
    '该手牌暂无完整回放数据（' + model.degradedLabel + '）。以下为记录中可用的结构化信息，牌局描述原文见下方。'));
  var sum = _el('div', 'replay-degraded__summary');
  _kvRow(sum, '位置', model.hero.position || '--');
  if (model.hero.cards) {
    var cardsRow = _el('div', 'replay-degraded__row');
    cardsRow.appendChild(_el('span', 'replay-degraded__label', '底牌'));
    var cardsSpan = _el('span');
    cardsSpan.innerHTML = _badgesHtml(model.hero.cards);
    cardsRow.appendChild(cardsSpan);
    sum.appendChild(cardsRow);
  } else {
    _kvRow(sum, '底牌', '--');
  }
  if (model.summary.boardStr && _extractCards(model.summary.boardStr).length) {
    var boardRow = _el('div', 'replay-degraded__row');
    boardRow.appendChild(_el('span', 'replay-degraded__label', '翻牌面'));
    var boardSpan = _el('span');
    boardSpan.innerHTML = Utils.renderCardBadges(model.summary.boardStr, {});
    boardRow.appendChild(boardSpan);
    sum.appendChild(boardRow);
  }
  var al = model.summary.actionLines;
  if (al.flop || al.turn || al.river) {
    var parts = [];
    if (al.flop) parts.push('翻牌 ' + al.flop);
    if (al.turn) parts.push('转牌 ' + al.turn);
    if (al.river) parts.push('河牌 ' + al.river);
    _kvRow(sum, '行动线', parts.join(' · '));
  }
  var pbbRow = _el('div', 'replay-degraded__row');
  pbbRow.appendChild(_el('span', 'replay-degraded__label', '盈亏'));
  var pbbSpan = _el('span');
  pbbSpan.innerHTML = Utils.formatProfitHTML(model.result.pBB);
  pbbRow.appendChild(pbbSpan);
  sum.appendChild(pbbRow);
  root.appendChild(sum);
  if (model.bigLoss) root.appendChild(_el('div', 'replay-bigloss', '⚠️ 大底池亏损手牌，请详细复盘'));
  return root;
}

export var HandReplay = {
  parseReplay: parseReplay,
  render: function (container, hand) {
    if (!container) return;
    var model = parseReplay(hand);
    container.replaceChildren();
    container.className = 'hand-replay';
    if (model.degraded) {
      container.appendChild(_buildDegraded(model));
      return;
    }
    container.appendChild(_buildReplayView(model));
    container.appendChild(_buildFullReview(model));
  },
};
