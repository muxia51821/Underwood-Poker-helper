// #region StatsEngine
// [V6.13.0 新增] 声明式扑克统计引擎 — 借鉴 GGPoker-Hand-Analyzer 的 STAT_DEFINITIONS 架构
import { CONSTANTS } from '../constants.js';

/**
 * 统计指标定义 — 每个指标是一个独立对象：
 *   name: 显示名（中文）
 *   type: 'money' | 'bb' | 'percent' | 'int' | 'string'
 *   init: () => 初始状态
 *   process: (handReview, stats, idx, allHands) => void — 更新 stats 对象
 *   finalize: (stats, totalHands, bbSize) => 衍生值（percent 等）
 */
export const STAT_DEFINITIONS = {
  // ===== 基础指标 =====
  totalHands: {
    name: '总手数', type: 'int',
    init: () => ({ value: 0 }),
    process: function (_ctx, s) { s.value++; },
  },
  totalProfit: {
    name: '总盈利（扣水后）', type: 'bb',
    init: () => ({ value: 0 }),
    process: function (ctx, s) { s.value += (ctx.hand.pBB || 0); },
  },
  totalRake: {
    name: '总水钱', type: 'money',
    init: () => ({ value: 0 }),
    process: function (ctx, s) {
      if (ctx.hand.pBB > 0) s.value += (ctx.hand.rake || 0) + (ctx.hand.jackpot || 0);
    },
  },
  totalJackpot: {
    name: '总 Jackpot', type: 'money',
    init: () => ({ value: 0 }),
    process: function (ctx, s) {
      if (ctx.hand.pBB > 0) s.value += (ctx.hand.jackpot || 0);
    },
  },
  profitWithRake: {
    name: '总盈利（扣水前）', type: 'bb',
    init: () => ({ value: 0 }),
    process: function (ctx, s) {
      var rakeBack = ctx.hand.pBB > 0 ? (ctx.hand.rake || 0) + (ctx.hand.jackpot || 0) : 0;
      s.value += (ctx.hand.pBB || 0) + rakeBack;
    },
  },
  bbPer100: {
    name: 'bb/100（扣水后）', type: 'bb',
    dependsOn: ['totalProfit', 'totalHands'],
  },
  bbPer100WithRake: {
    name: 'bb/100（扣水前）', type: 'bb',
    dependsOn: ['profitWithRake', 'totalHands'],
  },
  // ===== 翻前指标 =====
  vpip: {
    name: 'VPIP', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      s.opportunities++;
      if (pf.heroAction === 'raises' || pf.heroAction === 'calls') s.actions++;
    },
  },
  pfr: {
    name: 'PFR', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.firstRaiserIdx === -1) {
        s.opportunities++;
        if (pf.heroAction === 'raises') s.actions++;
      }
    },
  },
  threeBet: {
    name: '3-Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.firstRaiserIdx >= 0 && pf.firstRaiserIdx === pf.lastRaiserIdx && pf.lastRaiserIdx < pf.heroIdx) {
        s.opportunities++;
        if (pf.heroAction === 'raises') s.actions++;
      }
    },
  },
  squeeze: {
    name: 'Squeeze', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.firstRaiserIdx >= 0 && pf.callersBeforeHero > 0) {
        s.opportunities++;
        if (pf.heroAction === 'raises') s.actions++;
      }
    },
  },
  // [V6.18.0] 翻前新增指标
  limp: {
    name: 'Limp', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (!pf.faced3Bet && pf.firstRaiserIdx === -1) {
        s.opportunities++;
        if (pf.heroAction === 'calls') s.actions++;
      }
    },
  },
  coldCall: {
    name: 'Cold Call', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.raisedBeforeHero === 1 && pf.callersBeforeHero === 0) {
        s.opportunities++;
        if (pf.heroAction === 'calls') s.actions++;
      }
    },
  },
  fourBet: {
    name: '4-Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.raisedBeforeHero >= 2) {
        s.opportunities++;
        if (pf.heroAction === 'raises') s.actions++;
      }
    },
  },
  stealAttempt: {
    name: 'Steal', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.firstRaiserIdx === -1 && (pf.heroPosition === 'CO' || pf.heroPosition === 'BTN')) {
        s.opportunities++;
        if (pf.heroAction === 'raises') s.actions++;
      }
    },
  },
  foldTo3bet: {
    name: 'Fold to 3-Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.heroWasRaiser && pf.faced3Bet) {
        s.opportunities++;
        if (pf.heroAction === 'folds') s.actions++;
      }
    },
  },
  // [V6.18.1]
  foldToSteal: {
    name: 'Fold to Steal', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      var isBlind = pf.heroPosition === 'SB' || pf.heroPosition === 'BB';
      var isStealPos = pf.firstRaiserPosition === 'CO' || pf.firstRaiserPosition === 'BTN';
      if (isBlind && pf.raisedBeforeHero === 1 && isStealPos) {
        s.opportunities++;
        if (pf.heroAction === 'folds') s.actions++;
      }
    },
  },
  // [V6.18.3] 补全指标
  foldTo4bet: {
    name: 'Fold to 4-Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      if (!pf) return;
      if (pf.heroWasRaiser && pf.raisedBeforeHero === 1 && pf.faced3Bet) {
        s.opportunities++;
        if (pf.heroAction === 'folds') s.actions++;
      }
    },
  },
  // ===== 翻后指标 =====
  cbetFlop: {
    name: 'C-Bet 翻牌', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      var flop = ctx.flop;
      if (!pf || !flop) return;
      if (pf.heroAction === 'raises' && pf.heroIdx >= pf.lastRaiserIdx && flop.heroActions.length > 0) {
        s.opportunities++;
        if (flop.heroActions[0] && flop.heroActions[0][0] === 'B') s.actions++;
      }
    },
  },
  foldToCbet: {
    name: 'Fold to C-Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var pf = ctx.preflop;
      var flop = ctx.flop;
      if (!pf || !flop || flop.actions.length < 2) return;
      if ((pf.heroAction === 'calls') && flop.firstNonHeroAction && flop.firstNonHeroAction[0] === 'B') {
        s.opportunities++;
        if (flop.heroActions[0] && flop.heroActions[0][0] === 'F') s.actions++;
      }
    },
  },
  // [V6.18.0] 翻后新增指标
  cbetTurn: {
    name: 'C-Bet 转牌', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.isHeroPreflopAggressor || !ctx.sawTurn) return;
      var wasFlopCbet = ctx.flop && ctx.flop.heroActions[0] && ctx.flop.heroActions[0][0] === 'B';
      if (wasFlopCbet) {
        s.opportunities++;
        if (ctx.turn && ctx.turn.heroActions[0] && ctx.turn.heroActions[0][0] === 'B') s.actions++;
      }
    },
  },
  cbetRiver: {
    name: 'C-Bet 河牌', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.isHeroPreflopAggressor || !ctx.sawRiver) return;
      var wasFlopCbet = ctx.flop && ctx.flop.heroActions[0] && ctx.flop.heroActions[0][0] === 'B';
      var wasTurnCbet = ctx.turn && ctx.turn.heroActions[0] && ctx.turn.heroActions[0][0] === 'B';
      if (wasFlopCbet && wasTurnCbet) {
        s.opportunities++;
        if (ctx.river && ctx.river.heroActions[0] && ctx.river.heroActions[0][0] === 'B') s.actions++;
      }
    },
  },
  raiseCbetFlop: {
    name: 'Raise CBet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var flop = ctx.flop;
      if (!ctx.isHeroPreflopCaller || !flop || flop.actions.length < 2) return;
      if (flop.firstNonHeroAction && flop.firstNonHeroAction[0] === 'B') {
        s.opportunities++;
        if (flop.heroActions.some(function (a) { return a && a[0] === 'R'; })) s.actions++;
      }
    },
  },
  donkBetFlop: {
    name: 'Donk Bet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var flop = ctx.flop;
      if (!ctx.isHeroPreflopCaller || !flop || flop.actions.length < 1) return;
      s.opportunities++;
      if (flop.heroActions[0] && flop.heroActions[0][0] === 'B') s.actions++;
    },
  },
  betVsMissedCbet: {
    name: 'Bet vs Missed CBet', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var flop = ctx.flop;
      if (!ctx.isHeroPreflopCaller || !flop || flop.actions.length < 2) return;
      if (flop.firstNonHeroAction === 'X') {
        s.opportunities++;
        if (flop.heroActions[0] && flop.heroActions[0][0] === 'B') s.actions++;
      }
    },
  },
  // [V6.18.3] 翻后补全
  checkRaiseFlop: {
    name: 'Check-Raise Flop', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var flop = ctx.flop;
      if (!ctx.isHeroPreflopCaller || !flop || flop.actions.length < 2) return;
      if (flop.heroActions[0] && flop.heroActions[0][0] === 'X' && flop.firstNonHeroAction && flop.firstNonHeroAction[0] === 'B') {
        s.opportunities++;
        if (flop.heroActions[1] && flop.heroActions[1][0] === 'R') s.actions++;
      }
    },
  },
  probeBetTurn: {
    name: 'Probe Bet Turn', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      var flop = ctx.flop;
      var turn = ctx.turn;
      if (!ctx.isHeroPreflopCaller || !flop || !ctx.sawTurn) return;
      var allChecks = flop.actions.every(function (a) { return a && a[0] === 'X'; });
      if (allChecks && flop.actions.length > 0) {
        s.opportunities++;
        if (turn && turn.heroActions[0] && turn.heroActions[0][0] === 'B') s.actions++;
      }
    },
  },
  // ===== 摊牌指标 =====
  wtsd: {
    name: 'WTSD（进摊牌率）', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.is_WTSD_base_hand) return;
      s.opportunities++;
      if (ctx.reachedShowdown) s.actions++;
    },
  },
  wwsf: {
    name: 'WWSF（VPIP后赢率）', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.is_WTSD_base_hand) return;
      s.opportunities++;
      if (ctx.isHeroWinner) s.actions++;
    },
  },
  // [V6.18.0] 摊牌新增指标
  wtsdWon: {
    name: 'WTSD 胜率', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.reachedShowdown) return;
      s.opportunities++;
      if (ctx.isHeroWinner) s.actions++;
    },
  },
  wtsdAfterCbet: {
    name: 'CBet 后进摊牌', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.isHeroPreflopAggressor || !ctx.flop) return;
      if (!ctx.flop.heroActions[0] || ctx.flop.heroActions[0][0] !== 'B') return;
      s.opportunities++;
      if (ctx.reachedShowdown) s.actions++;
    },
  },
  wwsfAsPfr: {
    name: 'WWSF（攻击者）', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.isHeroPreflopAggressor) return;
      s.opportunities++;
      if (ctx.isHeroWinner) s.actions++;
    },
  },
  wwsfAsCaller: {
    name: 'WWSF（跟注者）', type: 'percent',
    init: () => ({ opportunities: 0, actions: 0 }),
    process: function (ctx, s) {
      if (!ctx.isHeroPreflopCaller) return;
      s.opportunities++;
      if (ctx.isHeroWinner) s.actions++;
    },
  },
  // [V6.18.0] 攻击性指标
  afqFlop: {
    name: 'AFQ 翻牌', type: 'percent',
    init: () => ({ bets: 0, raises: 0, calls: 0, checks: 0 }),
    process: function (ctx, s) {
      if (!ctx.flop) return;
      ctx.flop.heroActions.forEach(function (a) {
        var action = (a && a[0]) || ''; // first char: B/R/C/X/F
        if (action === 'B' || action === 'b') s.bets++;
        else if (action === 'R' || action === 'r') s.raises++;
        else if (action === 'C' || action === 'c') s.calls++;
        else if (action === 'X' || action === 'x') s.checks++;
      });
    },
  },
  afqTurn: {
    name: 'AFQ 转牌', type: 'percent',
    init: () => ({ bets: 0, raises: 0, calls: 0, checks: 0 }),
    process: function (ctx, s) {
      if (!ctx.turn) return;
      ctx.turn.heroActions.forEach(function (a) {
        var action = (a && a[0]) || '';
        if (action === 'B' || action === 'b') s.bets++;
        else if (action === 'R' || action === 'r') s.raises++;
        else if (action === 'C' || action === 'c') s.calls++;
        else if (action === 'X' || action === 'x') s.checks++;
      });
    },
  },
  afqRiver: {
    name: 'AFQ 河牌', type: 'percent',
    init: () => ({ bets: 0, raises: 0, calls: 0, checks: 0 }),
    process: function (ctx, s) {
      if (!ctx.river) return;
      ctx.river.heroActions.forEach(function (a) {
        var action = (a && a[0]) || '';
        if (action === 'B' || action === 'b') s.bets++;
        else if (action === 'R' || action === 'r') s.raises++;
        else if (action === 'C' || action === 'c') s.calls++;
        else if (action === 'X' || action === 'x') s.checks++;
      });
    },
  },
};

// ========== 辅助解析函数 ==========

/**
 * 从 HandReview.desc 解析翻前信息
 */
function _parsePreflop(h) {
  var desc = h.desc || '';
  var pfMatch = desc.match(/^preflop 行动：(.+)$/m);
  if (!pfMatch) return null;
  var line = pfMatch[1].trim();
  var parts = line.split(/,\s*/);
  var heroIdx = -1;
  var heroAction = '';
  var heroPosition = '';
  var firstRaiserIdx = -1;
  var lastRaiserIdx = -1;
  var callersBeforeHero = 0;
  var raisedBeforeHero = 0;    // [V6.18.0] Hero 前不同加注者数量
  var faced3Bet = false;        // [V6.18.0] Hero 加注后被再加注
  var firstRaiserPosition = ''; // [V6.18.1] 第一个加注者的位置
  var heroWasRaiser = false;    // [V6.18.2] Hero 在翻前曾经加注过
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (/^Hero\b/i.test(p)) {
      heroIdx = i;
      var posM = p.match(/^Hero\s+(\w+)\//);
      if (posM) heroPosition = posM[1];
      if (/\braises\b/i.test(p)) { heroAction = 'raises'; heroWasRaiser = true; }
      else if (/\bcalls\b/i.test(p)) heroAction = 'calls';
      else if (/\bcheck\b/i.test(p)) heroAction = 'check';
      else if (/\bfolds\b/i.test(p)) heroAction = 'folds';
      // [V6.18.0] 统计 Hero 前不同加注者
      if (firstRaiserIdx >= 0) {
        raisedBeforeHero = lastRaiserIdx >= 0 && lastRaiserIdx !== firstRaiserIdx ? 2 : 1;
      }
    } else {
      if (/\bRaise\b/i.test(p)) {
        if (firstRaiserIdx === -1) { firstRaiserIdx = i; firstRaiserPosition = p.split(/\s+/)[0]; }
        lastRaiserIdx = i;
      }
      if (heroIdx === -1 && /\bCall\b/i.test(p)) {
        callersBeforeHero++;
      }
    }
  }
  // [V6.18.2] Hero 曾经加注后被他人再加注 = faced 3-bet
  if (heroIdx >= 0 && heroWasRaiser) {
    for (var j = heroIdx + 1; j < parts.length; j++) {
      if (/\bRaise\b/i.test(parts[j])) { faced3Bet = true; break; }
    }
  }
  return {
    heroIdx: heroIdx,
    heroAction: heroAction,
    heroPosition: heroPosition,
    firstRaiserIdx: firstRaiserIdx,
    lastRaiserIdx: lastRaiserIdx,
    callersBeforeHero: callersBeforeHero,
    raisedBeforeHero: raisedBeforeHero,
    faced3Bet: faced3Bet,
    firstRaiserPosition: firstRaiserPosition,
    heroWasRaiser: heroWasRaiser,
  };
}

/**
 * 从 HandReview.desc 解析翻牌信息
 */
function _parseFlop(h) {
  var desc = h.desc || '';
  var flopMatch = desc.match(/^OTF翻牌[^行]*行动：(.+)$/m);
  if (!flopMatch) return null;
  var actionsStr = flopMatch[1].trim();
  var actionTokens = actionsStr.split(/\s+/);
  // [V7.0.3] 对齐 Turn/River 的 i%2===0 遍历模式
  var heroActions = [];
  var firstNonHeroAction = '';
  for (var i = 0; i < actionTokens.length; i++) {
    if (i % 2 === 0) heroActions.push(actionTokens[i]);
  }
  if (actionTokens.length >= 2) {
    firstNonHeroAction = actionTokens[1];
  }
  return {
    actions: actionTokens,
    heroActions: heroActions,
    firstNonHeroAction: firstNonHeroAction,
  };
}

// [V6.18.0] 从 desc 解析转牌/河牌行动
function _parseTurn(h) {
  var desc = h.desc || '';
  var turnMatch = desc.match(/^OTT转牌[^行]*行动：(.+)$/m);
  if (!turnMatch) return null;
  var actionTokens = turnMatch[1].trim().split(/\s+/);
  var heroActions = [];
  for (var i = 0; i < actionTokens.length; i++) {
    if (i % 2 === 0) heroActions.push(actionTokens[i]);
  }
  return { actions: actionTokens, heroActions: heroActions };
}
function _parseRiver(h) {
  var desc = h.desc || '';
  var riverMatch = desc.match(/^OTR河牌[^行]*行动：(.+)$/m);
  if (!riverMatch) return null;
  var actionTokens = riverMatch[1].trim().split(/\s+/);
  var heroActions = [];
  for (var i = 0; i < actionTokens.length; i++) {
    if (i % 2 === 0) heroActions.push(actionTokens[i]);
  }
  return { actions: actionTokens, heroActions: heroActions };
}

// [V6.18.0] 预计算手牌上下文 — 每手牌解析一次，所有 stat definition 共享
function createHandContext(hand) {
  var preflop = _parsePreflop(hand);
  var flop = _parseFlop(hand);
  var turn = _parseTurn(hand);
  var river = _parseRiver(hand);
  var vpipHand = preflop && (preflop.heroAction === 'raises' || preflop.heroAction === 'calls');
  var isHeroPFA = preflop && preflop.heroAction === 'raises' && preflop.heroIdx >= preflop.lastRaiserIdx;
  var isHeroPreflopCaller = !!(flop && vpipHand && !isHeroPFA);
  var desc = hand.desc || '';
  var reachedShowdown = !!(/\bshows \[/i.test(desc) || /\bHero shows\b/i.test(desc) || /\bHero mucks\b/i.test(desc));
  return {
    hand: hand,
    preflop: preflop,
    flop: flop,
    turn: turn,
    river: river,
    // Hero
    heroPosition: preflop ? preflop.heroPosition : '',
    isHeroPreflopAggressor: isHeroPFA,
    isHeroPreflopCaller: isHeroPreflopCaller,
    isHeroWinner: (hand.pBB || 0) > 0,
    // Streets
    sawFlop: !!flop,
    sawTurn: !!turn,
    sawRiver: !!river,
    reachedShowdown: reachedShowdown,
    is_WTSD_base_hand: !!(vpipHand && flop),
    // backwards compat
    vpipHand: vpipHand,
    isHeroPFA: isHeroPFA,
  };
}

// ========== 核心计算函数 ==========

// [V6.19.8] createHandContext 缓存，避免重复解析
var _contextCache = new Map();
// [V7.0.0] analyze() 结果缓存 — 避免跨面板重复统计计算
var _analyzeCache = new Map();

export function clearStatsCache() {
  _contextCache = new Map();
  _analyzeCache = new Map();
}

export function calculateStats(hands, opts) {
  var raw = {};
  Object.keys(STAT_DEFINITIONS).forEach(function (key) {
    var def = STAT_DEFINITIONS[key];
    if (def.init) {
      raw[key] = def.init();
    }
  });

  if (!hands || !hands.length) return raw;

  var filtered = hands;
  if (opts && opts.sessionId) {
    filtered = hands.filter(function (h) { return h.sessionId === opts.sessionId; });
  }
  // [V6.18.2] 按对手 ID 过滤（对手画像面板用）
  if (opts && opts.oId) {
    filtered = filtered.filter(function (h) { return h.oId === opts.oId; });
  }

  var sorted = filtered.slice().sort(function (a, b) {
    return (a.date || '').localeCompare(b.date || '');
  });

  // [V6.17.2] 预计算 context，每手牌只解析一次
  for (var i = 0; i < sorted.length; i++) {
    var hand = sorted[i];
    if (hand.pBB == null) continue;
    var ctx = _contextCache.get(hand.id);
    if (!ctx) {
      ctx = createHandContext(hand);
      _contextCache.set(hand.id, ctx);
    }
    Object.keys(STAT_DEFINITIONS).forEach(function (key) {
      var def = STAT_DEFINITIONS[key];
      if (def.process) {
        def.process(ctx, raw[key], i, sorted);
      }
    });
  }
  raw._totalHands = sorted.filter(function (h) { return h.pBB != null; }).length;
  return raw;
}

/**
 * 估算大盲金额（从手牌数据中推断）
 */

/**
 * 最终化统计：将计数转为百分比，计算衍生指标
 * @param {object} raw — calculateStats() 的输出
 * @returns {object} finalized stats（可直接用于显示）
 */
export function finalizeStats(raw) {
  var totalHands = raw._totalHands || 0;
  var result = {};

  Object.keys(STAT_DEFINITIONS).forEach(function (key) {
    var def = STAT_DEFINITIONS[key];
    if (def.dependsOn) return;
    var rawStat = raw[key];
    if (!rawStat) return;
    // [V6.18.0] AFQ 型统计：bets/raises/calls/checks → 百分比
    if (typeof rawStat.bets === 'number') {
      var totalAgg = (rawStat.bets || 0) + (rawStat.raises || 0);
      var totalAct = totalAgg + (rawStat.calls || 0) + (rawStat.checks || 0);
      result[key] = {
        value: totalAct > 0 ? parseFloat((totalAgg / totalAct * 100).toFixed(1)) : 0,
        type: 'percent', name: def.name,
      };
      return;
    }
    if (def.type === 'percent') {
      var opp = rawStat.opportunities || 0;
      var act = rawStat.actions || 0;
      result[key] = {
        value: opp > 0 ? parseFloat((act / opp * 100).toFixed(1)) : 0,
        opportunities: opp, actions: act,
        type: 'percent', name: def.name,
      };
    } else {
      result[key] = {
        value: rawStat.value || 0,
        type: def.type, name: def.name,
      };
    }
  });

  // 衍生指标
  result.bbPer100 = {
    value: totalHands > 0 ? parseFloat((raw.totalProfit.value / (totalHands / 100)).toFixed(1)) : 0,
    type: 'bb', name: STAT_DEFINITIONS.bbPer100.name,
  };
  result.bbPer100WithRake = {
    value: totalHands > 0 ? parseFloat((raw.profitWithRake.value / (totalHands / 100)).toFixed(1)) : 0,
    type: 'bb', name: STAT_DEFINITIONS.bbPer100WithRake.name,
  };

  return result;
}

// ===== 阈值范围（用于颜色标记和优化建议） =====
export const STAT_RANGES = {
  // 翻前
  vpip:         { good: [20, 25],  acceptable: [18, 28],  warn: [15, 32] },
  pfr:          { good: [15, 23],  acceptable: [13, 26],  warn: [10, 30] },
  threeBet:     { good: [8, 13],   acceptable: [6, 15],   warn: [3, 17] },
  squeeze:      { good: [10, 16],  acceptable: [8, 18],   warn: [5, 20] },
  limp:         { good: [0, 3.5],  acceptable: [3.5, 5.5], warn: [5.5, 10] },
  coldCall:     { good: [0, 9],    acceptable: [9, 13],   warn: [13, 15] },
  fourBet:      { good: [4, 8],    acceptable: [3, 10],   warn: [2, 12] },
  stealAttempt: { good: [45],      acceptable: [38],      warn: [30] },
  foldTo3bet:   { good: [35, 55],  acceptable: [30, 60],  warn: [25, 65] },
  foldToSteal:  { good: [60, 75],  acceptable: [50, 80],  warn: [45, 85] },
  // 翻后
  cbetFlop:     { good: [55, 75],  acceptable: [45, 80],  warn: [35, 85] },
  cbetTurn:     { good: [45, 65],  acceptable: [35, 70],  warn: [25, 75] },
  cbetRiver:    { good: [35, 55],  acceptable: [25, 60],  warn: [20, 65] },
  foldToCbet:   { good: [35, 55],  acceptable: [30, 60],  warn: [25, 65] },
  raiseCbetFlop:{ good: [5, 20],   acceptable: [3, 25],   warn: [1, 30] },
  donkBetFlop:  { good: [0, 5],    acceptable: [5, 7],    warn: [7, 100] },
  betVsMissedCbet:{ good: [20, 60],acceptable: [10, 20],  warn: [0, 10] },
	checkRaiseFlop:{ good: [8, 15],   acceptable: [5, 20],   warn: [3, 25] },
	probeBetTurn: { good: [35, 55],  acceptable: [25, 65],  warn: [15, 75] },
  // 摊牌
  wtsd:         { good: [25, 28],  acceptable: [23, 35],  warn: [20, 40] },
  wtsdWon:      { good: [55],      acceptable: [50, 55],  warn: [48] },
  wwsf:         { good: [40],      acceptable: [30, 40],  warn: [25, 30] },
  wtsdAfterCbet:{ good: [25, 50],  acceptable: [20, 55],  warn: [15, 60] },
  wwsfAsPfr:    { good: [45, 70],  acceptable: [40, 45],  warn: [35, 40] },
  wwsfAsCaller: { good: [25, 50],  acceptable: [20, 55],  warn: [15, 60] },
  // 攻击性
  afqFlop:      { good: [30, 45],  acceptable: [25, 50],  warn: [20, 55] },
  afqTurn:      { good: [35, 50],  acceptable: [30, 55],  warn: [25, 60] },
  afqRiver:     { good: [40, 60],  acceptable: [35, 65],  warn: [30, 70] },
};

// ===== 优化建议规则 =====
// 每条规则：{ statKey, threshold, type ('>'|'<'), recKey (建议文案键) }
export const RECOMMENDATION_RULES = [
  // 翻前
  { statKey: 'vpip', threshold: 28, type: '>', recKey: 'rec_vpip_high' },
  { statKey: 'vpip', threshold: 20, type: '<', recKey: 'rec_vpip_low' },
  { statKey: 'pfr', threshold: 10, type: '<', recKey: 'rec_pfr_low' },
  { statKey: 'threeBet', threshold: 7, type: '<', recKey: 'rec_3bet_low' },
  { statKey: 'squeeze', threshold: 8, type: '<', recKey: 'rec_squeeze_low' },
  { statKey: 'limp', threshold: 5, type: '>', recKey: 'rec_limp_high' },
  { statKey: 'coldCall', threshold: 12, type: '>', recKey: 'rec_coldcall_high' },
  { statKey: 'fourBet', threshold: 4, type: '<', recKey: 'rec_4bet_low' },
  { statKey: 'stealAttempt', threshold: 38, type: '<', recKey: 'rec_steal_low' },
  { statKey: 'foldTo3bet', threshold: 60, type: '>', recKey: 'rec_fold_to_3bet_high' },
  { statKey: 'foldTo3bet', threshold: 35, type: '<', recKey: 'rec_fold_to_3bet_low' },
  { statKey: 'foldToSteal', threshold: 75, type: '>', recKey: 'rec_foldtosteal_high' },
  // 翻后
  { statKey: 'cbetFlop', threshold: 55, type: '<', recKey: 'rec_cbet_low' },
  { statKey: 'cbetFlop', threshold: 80, type: '>', recKey: 'rec_cbet_high' },
  { statKey: 'cbetTurn', threshold: 35, type: '<', recKey: 'rec_cbetturn_low' },
  { statKey: 'foldToCbet', threshold: 60, type: '>', recKey: 'rec_fold_to_cbet_high' },
  { statKey: 'donkBetFlop', threshold: 7, type: '>', recKey: 'rec_donk_high' },
  // 摊牌
  { statKey: 'wtsd', threshold: 24, type: '<', recKey: 'rec_wtsd_low' },
  { statKey: 'wtsdWon', threshold: 50, type: '<', recKey: 'rec_wtsdwon_low' },
  { statKey: 'wwsf', threshold: 35, type: '<', recKey: 'rec_wwsf_low' },
  { statKey: 'squeeze', threshold: 18, type: '>', recKey: 'rec_squeeze_high' },
  { statKey: 'fourBet', threshold: 10, type: '>', recKey: 'rec_4bet_high' },
  { statKey: 'cbetTurn', threshold: 70, type: '>', recKey: 'rec_cbetturn_high' },
  { statKey: 'cbetRiver', threshold: 25, type: '<', recKey: 'rec_cbetriver_low' },
  { statKey: 'cbetRiver', threshold: 60, type: '>', recKey: 'rec_cbetriver_high' },
  { statKey: 'checkRaiseFlop', threshold: 5, type: '<', recKey: 'rec_crflop_low' },
  { statKey: 'wtsd', threshold: 35, type: '>', recKey: 'rec_wtsd_high' },
  { statKey: 'afqFlop', threshold: 25, type: '<', recKey: 'rec_afqflop_low' },
  { statKey: 'afqFlop', threshold: 50, type: '>', recKey: 'rec_afqflop_high' },
  { statKey: 'afqTurn', threshold: 30, type: '<', recKey: 'rec_afqturn_low' },
  { statKey: 'afqTurn', threshold: 55, type: '>', recKey: 'rec_afqturn_high' },
  { statKey: 'afqRiver', threshold: 35, type: '<', recKey: 'rec_afqriver_low' },
  { statKey: 'afqRiver', threshold: 65, type: '>', recKey: 'rec_afqriver_high' },
];

export const RECOMMENDATION_TEXTS = {
  // 翻前
  rec_vpip_high: 'VPIP {value}% 偏高，入池过于频繁。多数牌局中你的起手牌处于范围劣势。建议收紧前位(EP/MP)开池范围，减少投机牌平跟入池。',
  rec_vpip_low: 'VPIP {value}% 偏低，可能错过了后位的盈利机会。建议在 CO/BTN 放宽开池范围至 35-45%，利用位置优势多入池。',
  rec_pfr_low: 'PFR {value}% 偏低，跟注多于加注，失去了主动权。翻前以跟注代替加注会让你频繁在不利条件下看翻牌。建议跟注转加注，尤其在无人开池时。',
  rec_3bet_low: '3-Bet {value}% 偏低。3-Bet 不仅是价值，也是重要的诈唬武器。建议增加 BTN vs CO、SB vs BTN 的 3-Bet 诈唬频率。',
  rec_squeeze_low: 'Squeeze {value}% 偏低。挤压位有额外死钱，诈唬 EV 高于普通 3-Bet。当有人加注且有跟注者时，考虑用较宽范围挤压。',
  rec_squeeze_high: 'Squeeze {value}% 偏高。过度挤压可能被对手识别并 4-Bet 反击。建议减少对前位开池者的挤压，优先选择 LP vs LP 的场景。',
  rec_limp_high: 'Limp {value}% 偏高，平跟入池让你的范围完全暴露为中等牌力。建议：无人开池时一律加注（而非跟注），否则弃牌。',
  rec_coldcall_high: 'Cold Call {value}% 偏高。冷跟注让你在没主动权的情况下打翻后，容易被 C-Bet 压制。建议转为 3-Bet 或弃牌。',
  rec_4bet_low: '4-Bet {value}% 偏低。面对 3-Bet 只用 AA/KK 反击过于可预测。建议加入 A5s/A4s 类阻断诈唬 4-Bet，让对手不敢肆意 3-Bet 你。',
  rec_4bet_high: '4-Bet {value}% 偏高。过度 4-Bet 意味着你用太多中等牌推出去。4-Bet 后底池已膨胀，对手跟注范围很强。减少用 TT/JJ/AQ 类牌 4-Bet。',
  rec_steal_low: 'Steal {value}% 偏低，CO/BTN 偷盲是稳定的盈利来源。建议在 CO 开池到 28%+、BTN 开池到 42%+，尤其是盲注位对手 fold-to-steal 偏高时。',
  rec_fold_to_3bet_high: 'Fold to 3-Bet {value}% 偏高。被 3-Bet 后弃牌太多等于邀请对手肆意 3-Bet 你。建议在有位置时至少防守 40% 的开池范围。',
  rec_fold_to_3bet_low: 'Fold to 3-Bet {value}% 偏低。面对紧凶对手的 3-Bet 范围很强，用边缘牌防守只会损失更多。建议对 UTG/MP 的 3-Bet 多弃牌。',
  rec_foldtosteal_high: 'Fold to Steal {value}% 偏高。盲注面对偷盲弃牌过多等于免费送钱。建议 BB 至少防守 40-50%，包括 3-Bet 和跟注防守。',

  // 翻后
  rec_cbet_low: 'C-Bet {value}% 偏低。作为翻前攻击者，错过翻牌就放弃是常见漏洞。干燥牌面(A/K-high)应继续施压，湿润牌面选择放弃。关键：根据牌面决定是否 C-Bet。',
  rec_cbet_high: 'C-Bet {value}% 偏高。无差别 C-Bet 是明显的剥削信号。在连通性高的牌面(如 9TJ/QT8)减少 C-Bet，这类牌面对跟注者有利。',
  rec_cbetturn_low: '转牌 C-Bet {value}% 偏低。翻牌 C-Bet 后转牌放弃说明翻牌选错了诈唬。做翻牌 C-Bet 时就应有转牌继续下注的计划(至少部分牌面)。',
  rec_cbetturn_high: '转牌 C-Bet {value}% 偏高。转牌被跟注后河牌 SPR 会很浅，剩最后一枪的空间很小。建议在不利转牌(完成听牌的牌面)减少二枪频率。',
  rec_cbetriver_low: '河牌 C-Bet {value}% 偏低。能坚持到河牌说明牌力或诈唬逻辑支撑足够。检查是否在河牌犹豫——价值下注不足可能损失大量 EV。',
  rec_cbetriver_high: '河牌 C-Bet {value}% 偏高。三枪诈唬代价极大(被跟注输整个底池)。建议只在牌面支持两极分化时打第三枪，中间牌力控池。',
  rec_fold_to_cbet_high: '面对 C-Bet 弃牌率 {value}% 偏高。翻前跟注后翻牌面对一枪就弃牌等于送钱。至少在有后门听牌/高牌时跟注一枪看转牌。',
  rec_donk_high: 'Donk Bet {value}% 偏高。领打不是 GTO 中的常规武器(翻前跟注者应过牌给攻击者)。建议将多数领打转为过牌-加注或过牌-跟注。',
  rec_crflop_low: 'Check-Raise Flop {value}% 偏低。翻牌过牌-加注是强大的半诈唬武器。建议在有利牌面(有听牌+高牌的组合)增加过牌-加注诈唬比例。',

  // 摊牌
  rec_wtsd_low: 'WTSD {value}% 偏低。进摊牌率过低说明可能过度弃牌。检查是否在某些中等牌力时刻放弃了太多底池——对手的河牌下注并不总是强牌。',
  rec_wtsd_high: 'WTSD {value}% 偏高。进摊牌率过高通常是"好奇心太重"——用中等牌力频繁支付对手的价值下注。建议河牌面对大注时多信对手有牌。',
  rec_wtsdwon_low: 'WTSD 胜率 {value}% 偏低。进摊牌了但赢不了=你的摊牌范围太弱。检查翻前起手牌选择和翻后追牌的纪律。',
  rec_wwsf_low: 'WWSF {value}% 偏低。入池后赢率不足说明需要提高攻击性。入池后要主动争夺底池(下注或加注)，而非等待摊牌。',
  // 攻击性
  rec_afqflop_low: 'AFQ Flop {value}% 偏低。翻牌攻击频率过低说明过度被动——过多跟注或过牌而非下注或加注。建议增加翻牌半诈唬下注频率，尤其在有利牌面上。',
  rec_afqflop_high: 'AFQ Flop {value}% 偏高。翻牌过于激进意味着你几乎从不过牌-跟注。中等牌力需要控池保留河牌判断空间。',
  rec_afqturn_low: 'AFQ Turn {value}% 偏低。转牌攻击频率不足暗示你只用强牌出手。建议在转牌增加试探下注和半诈唬，不让对手免费看河牌。',
  rec_afqturn_high: 'AFQ Turn {value}% 偏高。转牌几乎全攻全守=范围透明。加入一些中等牌的过牌-跟注以保护过牌范围。',
  rec_afqriver_low: 'AFQ River {value}% 偏低。河牌攻击频率过低可能=价值下注不足。中等强牌也应寻求价值（薄价值下注），而非总是过牌。',
  rec_afqriver_high: 'AFQ River {value}% 偏高。河牌过度攻击=诈唬过多。检查河牌诈唬是否选对了阻挡牌，减少无阻挡的纯空气诈唬。',
};

/**
 * 根据 finalizeStats 结果生成建议列表
 * @param {object} stats — finalizeStats() 的输出
 * @returns {Array<{text: string}>}
 */
export function generateRecommendations(stats) {
  var recs = [];
  if (!stats) return recs;
  for (var i = 0; i < RECOMMENDATION_RULES.length; i++) {
    var rule = RECOMMENDATION_RULES[i];
    var stat = stats[rule.statKey];
    if (!stat || stat.type !== 'percent') continue;
    var value = stat.value;
    var matches = false;
    if (rule.type === '>') matches = value > rule.threshold;
    else matches = value < rule.threshold;
    if (matches) {
      var template = RECOMMENDATION_TEXTS[rule.recKey];
      if (template) {
        recs.push({
          statKey: rule.statKey,
          text: template.replace('{value}', value),
          value: value,
        });
      }
    }
  }
  return recs;
}

/**
 * 一站式：从 HandReview 数组生成最终统计 + 建议
 * @param {Array} hands — HandReview 数组
 * @param {object} [opts] — 可选过滤参数 { sessionId?: string }
 * @returns {{ stats: object, recommendations: Array }}
 */
export function analyze(hands, opts) {
  // [V7.0.0] 指纹缓存：首尾手牌ID + 数量 + 过滤条件，避免跨面板重复计算
  var fp = '' + hands.length;
  if (hands.length > 0) {
    fp += '|' + hands[0].id + '|' + hands[hands.length - 1].id;
  }
  if (opts) {
    fp += '|s=' + (opts.sessionId || '') + '|o=' + (opts.oId || '');
  }
  var cached = _analyzeCache.get(fp);
  if (cached) return cached;

  var raw = calculateStats(hands, opts);
  var stats = finalizeStats(raw);
  var recommendations = generateRecommendations(stats);
  var result = { stats: stats, recommendations: recommendations };
  _analyzeCache.set(fp, result);
  return result;
}

// [V6.17.2] 统计颜色编码 — 根据 STAT_RANGES 返回 CSS 类名
// [V6.18.1] 支持单值阈值：单元素数组表示"≥N"（如 [40] 表示≥40为好）
function _inRange(value, range) {
  if (!range) return false;
  if (range.length === 1) return value >= range[0];
  return value >= range[0] && value <= range[1];
}
export function getStatColor(value, statKey) {
  var range = STAT_RANGES[statKey];
  if (!range) return '';
  if (_inRange(value, range.good)) return 'stat-good';
  if (_inRange(value, range.acceptable)) return 'stat-acceptable';
  return 'stat-warn';
}

// [V6.18.0] 技术统计展示顺序（翻前 → 翻后 → 摊牌 → 攻击性）
export var PERCENT_STAT_KEYS = ['vpip', 'pfr', 'threeBet', 'squeeze', 'limp', 'coldCall', 'fourBet', 'stealAttempt', 'foldTo3bet', 'foldTo4bet', 'foldToSteal', 'cbetFlop', 'cbetTurn', 'cbetRiver', 'foldToCbet', 'raiseCbetFlop', 'donkBetFlop', 'betVsMissedCbet', 'checkRaiseFlop', 'probeBetTurn', 'wtsd', 'wtsdWon', 'wwsf', 'wtsdAfterCbet', 'wwsfAsPfr', 'wwsfAsCaller', 'afqFlop', 'afqTurn', 'afqRiver'];

// [V6.18.4] 统计点击说明
export const STAT_TOOLTIPS = {
  totalHands: '总手数：所有记录了盈亏的有效手牌总数。',
  totalProfit: '总盈利（扣水后）：所有手牌盈亏之和，已扣除水钱和Jackpot。',
  totalRake: '总水钱：Hero赢的牌局中平台收取的水钱总和。',
  totalJackpot: '总Jackpot：Hero赢的牌局中缴纳的Jackpot总和。',
  profitWithRake: '扣水前总盈利：盈亏+水钱+Jackpot，反映不考虑抽水的真实盈利。',
  bbPer100: 'bb/100（扣水后）：每100手牌的盈利（大盲单位）。核心盈利效率指标。',
  bbPer100WithRake: 'bb/100（扣水前）：不考虑抽水的每100手牌盈利。',
  vpip: 'VPIP（Voluntarily Put $ In Pot）：主动入池率。Hero主动跟注或加注入池的手牌占比。理想20-25%。',
  pfr: 'PFR（Preflop Raise）：翻前加注率。Hero在无人加注时选择加注入池的比例。理想15-23%。',
  threeBet: '3-Bet：翻前再加注率。前面恰好有1人加注时Hero选择再加注的比例。理想8-13%。',
  squeeze: 'Squeeze：挤压频率。前面有1人加注+至少1人跟注时Hero再加注的比例。理想8-13%。',
  limp: 'Limp：平跟入池率。无人加注时Hero选择跟注（而非加注）的比例。越低越好，理想<3.5%。',
  coldCall: 'Cold Call：冷跟注率。前面仅有1人加注且无人跟注时Hero跟注的比例。越低越好，理想<9%。',
  fourBet: '4-Bet：Hero面对3-Bet时选择再加注的比例。理想8-13%。',
  stealAttempt: 'Steal：偷盲率。Hero在CO/BTN无人加注时开池加注的比例。越高越好，理想>40%。',
  foldTo3bet: 'Fold to 3-Bet：Hero加注后被3-Bet后选择弃牌的比例。理想35-55%。',
  foldTo4bet: 'Fold to 4-Bet：Hero 3-Bet后被4-Bet后选择弃牌的比例。',
  foldToSteal: 'Fold to Steal：盲位面对偷盲弃牌率。Hero在SB/BB面对CO/BTN加注时弃牌的比例。理想60-75%。',
  cbetFlop: 'C-Bet Flop：翻牌持续下注率。Hero是翻前攻击者时在翻牌下注的比例。理想50-75%。',
  cbetTurn: 'C-Bet Turn：转牌持续下注率。Hero翻牌CBet后在转牌继续下注的比例。',
  cbetRiver: 'C-Bet River：河牌持续下注率。Hero翻牌+转牌CBet后在河牌三枪的比例。',
  foldToCbet: 'Fold to C-Bet：面对CBet弃牌率。Hero翻前跟注后面临CBet时弃牌的比例。理想35-55%。',
  raiseCbetFlop: 'Raise CBet：面对CBet加注率。Hero翻前跟注后面临CBet时加注的比例。',
  donkBetFlop: 'Donk Bet：领打率。Hero翻前跟注后在翻牌率先下注（非标准打法）。越低越好，理想<5%。',
  betVsMissedCbet: 'Bet vs Missed CBet：PFA翻牌过牌后Hero下注的比例。利用对手软弱的机会。',
  checkRaiseFlop: 'Check-Raise Flop：翻牌过牌-加注率。Hero翻前跟注，翻牌过牌后面对CBet加注的比例。',
  probeBetTurn: 'Probe Bet Turn：转牌试探下注。翻牌全部过牌后Hero在转牌下注的比例。',
  wtsd: 'WTSD（Went To Showdown）：进摊牌率。看到翻牌且VPIP的手牌中最终进入摊牌的比例。理想25-28%。',
  wtsdWon: 'WTSD Won：摊牌胜率。进入摊牌后Hero赢下底池的比例。理想>55%。',
  wwsf: 'WWSF（Won When Saw Flop）：VPIP后赢率。Hero主动入池后赢得底池的比例（含非摊牌赢）。理想>40%。',
  wtsdAfterCbet: 'WTSD After CBet：CBet后进摊牌率。Hero CBet翻牌后坚持到摊牌的比例。',
  wwsfAsPfr: 'WWSF as PFR：作为翻前攻击者时的VPIP后赢率。',
  wwsfAsCaller: 'WWSF as Caller：作为翻前跟注者时的VPIP后赢率。',
  afqFlop: 'AFQ Flop：翻牌攻击频率。(下注+加注)/(下注+加注+跟注+过牌)。理想25-35%。',
  afqTurn: 'AFQ Turn：转牌攻击频率。同翻牌计算方式。理想25-35%。',
  afqRiver: 'AFQ River：河牌攻击频率。同翻牌计算方式。理想25-35%。',
};
// #endregion
