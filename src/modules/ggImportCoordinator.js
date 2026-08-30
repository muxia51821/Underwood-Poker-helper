import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';

function _cloneSession(session) {
  var copy = {};
  Object.keys(session || {}).forEach(function (key) { copy[key] = session[key]; });
  return copy;
}

function _groupBySessionGap(parsedHands, gapHours) {
  if (!parsedHands.length) return [];
  var sorted = parsedHands.slice().sort(function (a, b) {
    return (a.date || '').localeCompare(b.date || '');
  });
  var groups = [];
  var current = { hands: [], startTime: null, endTime: null };
  var gapMs = (gapHours || CONSTANTS.SESSION_GAP_HOURS || 3) * 3600000;
  sorted.forEach(function (hand) {
    var time = hand.date ? new Date(hand.date.replace(' ', 'T') + ':00') : null;
    var timeMs = time ? time.getTime() : 0;
    // [V7.9.0 修改] 档位（bbValue）变化时强制切组，防止混合档位手牌被并入同一场
    var sameStake =
      hand.bbValue == null || current.bbValue == null || hand.bbValue === current.bbValue;
    if (!current.startTime) {
      current = { hands: [hand], startTime: time, endTime: time, bbValue: hand.bbValue };
    } else if (timeMs - current.endTime.getTime() <= gapMs && sameStake) {
      current.endTime = time;
      current.hands.push(hand);
    } else {
      groups.push(current);
      current = { hands: [hand], startTime: time, endTime: time, bbValue: hand.bbValue };
    }
  });
  if (current.hands.length) groups.push(current);
  return groups;
}

function _makeReviewRecord(hand, sessionId, generateId) {
  return {
    id: generateId(),
    sessionId: sessionId,
    date: hand.date,
    potType: hand.potType,
    board: hand.board,
    boardCode: hand.boardCode || '',
    boardCategory: hand.boardCategory || '',
    preflopScenario: hand.preflopScenario || 'other',
    actionLineOTF: hand.actionLineOTF || '',
    actionLineOTT: hand.actionLineOTT || '',
    actionLineOTR: hand.actionLineOTR || '',
    desc: hand.desc,
    decision: '',
    mistake: '',
    reflection: hand.profitBB != null && hand.profitBB !== 0
      ? (hand.profitBB > 0 ? '盈利：+' + hand.profitBB + ' BB' : '亏损：' + hand.profitBB + ' BB')
      : '',
    pBB: hand.profitBB != null ? hand.profitBB : null,
    gg: true,
    ggId: hand.handId,
    oId: hand.opponentId,
    oCards: hand.opponentCards,
    oHash: hand.oHash || Utils.normalizeOpponentName(hand.opponentId),
    rake: hand.rake || 0,
    jackpot: hand.jackpot || 0,
    // [V7.9.0 新增] 持久化解析器已有的手牌事实，供后续结构化 Hero 决策派生使用
    heroPosition: hand.heroPosition || '',
    heroCards: hand.heroCards || '',
    bbValue: hand.bbValue || 0,
    heroStartStack: hand.heroStartStack || 0,
    heroEndStack: hand.heroEndStack || 0,
    tableMax: hand.tableMax || 0,
    marked: false,
  };
}

// [V7.9.0 新增] Session 等级按盲注派生：0.05→NL5、0.1→NL10、0.25→NL25；无盲注信息时回退 NL5（旧行为）
function _deriveSessionLevel(group) {
  var bb = null;
  for (var i = 0; i < group.hands.length; i++) {
    if (group.hands[i].bbValue != null && group.hands[i].bbValue > 0) {
      bb = group.hands[i].bbValue;
      break;
    }
  }
  return bb ? 'NL' + Math.round(bb * 100) : 'NL5';
}

function _makeSession(group, existingSessions, generateId) {
  var startStr = group.startTime ? group.startTime.toISOString().split('T')[0] : '';
  var hour = group.startTime ? group.startTime.getHours() : 0;
  var period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚间';
  var level = _deriveSessionLevel(group);  // [V7.9.0 修改] 取代硬编码 'NL5'
  var matched = existingSessions.find(function (session) {
    return session.date === startStr && session.level === level;
  });
  if (matched) return { session: matched, isNew: false };

  var totalProfit = 0;
  group.hands.forEach(function (hand) { totalProfit += hand.profitBB || 0; });
  return {
    session: {
      id: generateId(),
      date: startStr,
      level: level,
      duration: Math.max(0.5, Math.round(group.hands.length * 0.02 * 10) / 10),
      hands: group.hands.length,
      profit: parseFloat(totalProfit.toFixed(1)),
      tilt: 5,
      mistake: '',
      remark: startStr + ' ' + period,
    },
    isNew: true,
  };
}

export function annotateParsedHands(parsedHands, existingReviews) {
  var existingByGG = new Map();
  (existingReviews || []).forEach(function (review) {
    if (review.ggId) existingByGG.set(review.ggId, review);
  });
  var seen = new Set();
  return (parsedHands || []).map(function (hand) {
    var existing = hand.handId ? existingByGG.get(hand.handId) : null;
    var duplicateReason = existing ? 'existing' : (hand.handId && seen.has(hand.handId) ? 'input' : '');
    if (hand.handId) seen.add(hand.handId);
    var annotated = {};
    Object.keys(hand).forEach(function (key) { annotated[key] = hand[key]; });
    annotated.isDuplicate = Boolean(duplicateReason);
    annotated.duplicateReason = duplicateReason;
    annotated.duplicateOf = existing || null;
    return annotated;
  });
}

export function createOverwritePatch(hand) {
  return {
    date: hand.date,
    potType: hand.potType,
    board: hand.board,
    boardCode: hand.boardCode || '',
    boardCategory: hand.boardCategory || '',
    preflopScenario: hand.preflopScenario || 'other',
    actionLineOTF: hand.actionLineOTF || '',
    actionLineOTT: hand.actionLineOTT || '',
    actionLineOTR: hand.actionLineOTR || '',
    desc: hand.desc,
    pBB: hand.profitBB != null ? hand.profitBB : null,
    ggId: hand.handId,
    oId: hand.opponentId,
    oCards: hand.opponentCards,
    oHash: hand.oHash || Utils.normalizeOpponentName(hand.opponentId),
    rake: hand.rake || 0,
    jackpot: hand.jackpot || 0,
    // [V7.9.0 新增] 覆盖时同步刷新手牌事实字段；marked 与决策/反思/Session 关联一样保留用户数据，不进 patch
    heroPosition: hand.heroPosition || '',
    heroCards: hand.heroCards || '',
    bbValue: hand.bbValue || 0,
    heroStartStack: hand.heroStartStack || 0,
    heroEndStack: hand.heroEndStack || 0,
    tableMax: hand.tableMax || 0,
  };
}

export function buildImportPlan(parsedHands, existingReviews, existingSessions, options) {
  var opts = options || {};
  var generateId = opts.generateId || Utils.generateUUID;
  var annotated = annotateParsedHands(parsedHands, existingReviews);
  var selected = annotated.filter(function (hand) { return !hand.isDuplicate; });
  var sessions = (existingSessions || []).map(_cloneSession);
  var mappings = [];

  if (opts.targetSessionId) {
    var target = sessions.find(function (session) { return session.id === opts.targetSessionId; });
    if (!target) {
      return {
        valid: false,
        error: '目标 Session 不存在',
        parsedHands: annotated,
        records: [],
        sessions: sessions,
        sessionMappings: [],
        summary: { parsed: annotated.length, failed: 0, duplicates: annotated.length - selected.length, imported: 0, newSessions: 0 },
      };
    }
    mappings.push({ session: target, hands: selected, isNew: false });
  } else {
    _groupBySessionGap(selected, opts.sessionGapHours).forEach(function (group) {
      var mapping = _makeSession(group, sessions, generateId);
      if (mapping.isNew) sessions.push(mapping.session);
      mapping.hands = group.hands;
      mappings.push(mapping);
    });
  }

  var records = [];
  mappings.forEach(function (mapping) {
    mapping.hands.forEach(function (hand) {
      records.push(_makeReviewRecord(hand, mapping.session.id, generateId));
    });
  });
  // [V7.9.0 修改] 按唯一 Session 聚合手数/盈亏：多桌混档位或分批导入时，同一 Session 会由多个分组
  // 累积而成，只在创建时取首个分片会让 Session 统计严重偏小（真实语料实测暴露）。
  var preExistingIds = new Set((existingSessions || []).map(function (session) { return session.id; }));
  var agg = {};
  mappings.forEach(function (mapping) {
    var profit = 0;
    mapping.hands.forEach(function (hand) { profit += hand.profitBB || 0; });
    if (!agg[mapping.session.id]) agg[mapping.session.id] = { hands: 0, profit: 0 };
    agg[mapping.session.id].hands += mapping.hands.length;
    agg[mapping.session.id].profit += profit;
  });
  sessions.forEach(function (session) {
    var a = agg[session.id];
    if (!a) return;
    if (preExistingIds.has(session.id)) {
      session.hands = (session.hands || 0) + a.hands;
      session.profit = parseFloat(((session.profit || 0) + a.profit).toFixed(1));
    } else {
      session.hands = a.hands;
      session.profit = parseFloat(a.profit.toFixed(1));
      session.duration = Math.max(0.5, Math.round(session.hands * 0.02 * 10) / 10);
    }
  });
  return {
    valid: true,
    parsedHands: annotated,
    records: records,
    sessions: sessions,
    sessionMappings: mappings,
    summary: {
      parsed: annotated.length,
      failed: opts.failedCount || 0,
      duplicates: annotated.length - selected.length,
      imported: records.length,
      newSessions: mappings.filter(function (mapping) { return mapping.isNew; }).length,
    },
  };
}
