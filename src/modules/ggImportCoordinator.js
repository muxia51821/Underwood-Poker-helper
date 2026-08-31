import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';

function _cloneSession(session) {
  var copy = {};
  Object.keys(session || {}).forEach(function (key) { copy[key] = session[key]; });
  return copy;
}

function _parseLocalTime(value) {
  if (!value) return null;
  var normalized = String(value).replace(' ', 'T');
  if (normalized.length === 16) normalized += ':00';
  var time = new Date(normalized);
  return isNaN(time.getTime()) ? null : time;
}

function _sessionGapMs(gapHours) {
  return (gapHours || CONSTANTS.SESSION_GAP_HOURS || 3) * 3600000;
}

function _groupBySessionGap(parsedHands, gapHours) {
  if (!parsedHands.length) return [];
  var sorted = parsedHands.slice().sort(function (a, b) {
    return (a.date || '').localeCompare(b.date || '');
  });
  var groups = [];
  var current = { hands: [], startTime: null, endTime: null, startedAt: '', endedAt: '' };
  var gapMs = _sessionGapMs(gapHours);
  sorted.forEach(function (hand) {
    var time = _parseLocalTime(hand.date);
    var timeMs = time ? time.getTime() : NaN;
    if (!current.startTime) {
      current = { hands: [hand], startTime: time, endTime: time, startedAt: hand.date || '', endedAt: hand.date || '' };
    // [V7.10.6 修改] Session 是连续坐下打牌的时间窗口；换级别只记录为场内构成，不能强制拆场。
    } else if (time && current.endTime && timeMs - current.endTime.getTime() <= gapMs) {
      current.endTime = time;
      current.endedAt = hand.date || current.endedAt;
      current.hands.push(hand);
    } else {
      groups.push(current);
      current = { hands: [hand], startTime: time, endTime: time, startedAt: hand.date || '', endedAt: hand.date || '' };
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

function _stakeLevelOf(hand) {
  return hand.bbValue != null && hand.bbValue > 0 ? 'NL' + Math.round(hand.bbValue * 100) : 'NL5';
}

function _sortStakeLevels(levels) {
  return levels.slice().sort(function (a, b) {
    var aMatch = /^NL(\d+)$/.exec(a);
    var bMatch = /^NL(\d+)$/.exec(b);
    if (aMatch && bMatch) return Number(aMatch[1]) - Number(bMatch[1]);
    if (aMatch) return -1;
    if (bMatch) return 1;
    return a.localeCompare(b);
  });
}

function _stakeLevelsOf(group, priorLevels) {
  var seen = {};
  (priorLevels || []).forEach(function (level) { if (level) seen[level] = true; });
  group.hands.forEach(function (hand) { seen[_stakeLevelOf(hand)] = true; });
  return _sortStakeLevels(Object.keys(seen));
}

function _sessionStakeLevels(session) {
  if (Array.isArray(session.stakeLevels) && session.stakeLevels.length) return session.stakeLevels;
  return session.level ? String(session.level).split(' + ') : [];
}

function _formatSessionLevel(stakeLevels) {
  return stakeLevels.length ? stakeLevels.join(' + ') : 'NL5';
}

function _sessionDuration(startTime, endTime, handCount) {
  var duration = startTime && endTime ? (endTime.getTime() - startTime.getTime()) / 3600000 : 0;
  if (!isFinite(duration) || duration < 0) duration = (handCount || 0) * 0.02;
  return Math.max(0.5, Math.round(duration * 10) / 10);
}

function _findTimeBoundedSession(group, sessions, gapMs) {
  if (!group.startTime || !group.endTime) return null;
  var candidates = sessions.filter(function (session) {
    var start = _parseLocalTime(session.startedAt);
    var end = _parseLocalTime(session.endedAt);
    return start && end && group.startTime.getTime() <= end.getTime() + gapMs && group.endTime.getTime() >= start.getTime() - gapMs;
  });
  // 两个历史窗口都可匹配时不能静默合并其 Closure/Mark；留给用户明确选目标 Session。
  return candidates.length === 1 ? candidates[0] : null;
}

function _extendSessionWindow(session, group) {
  var sessionStart = _parseLocalTime(session.startedAt);
  var sessionEnd = _parseLocalTime(session.endedAt);
  var startsEarlier = !sessionStart || group.startTime.getTime() < sessionStart.getTime();
  var endsLater = !sessionEnd || group.endTime.getTime() > sessionEnd.getTime();
  session.startedAt = startsEarlier ? group.startedAt : session.startedAt;
  session.endedAt = endsLater ? group.endedAt : session.endedAt;
  var start = _parseLocalTime(session.startedAt);
  var end = _parseLocalTime(session.endedAt);
  session.date = session.startedAt ? session.startedAt.slice(0, 10) : session.date;
  session.stakeLevels = _stakeLevelsOf(group, _sessionStakeLevels(session));
  session.level = _formatSessionLevel(session.stakeLevels);
  session.duration = _sessionDuration(start, end, session.hands);
}

function _makeSession(group, existingSessions, generateId, gapMs) {
  var startStr = group.startedAt ? group.startedAt.slice(0, 10) : '';
  var hour = group.startTime ? group.startTime.getHours() : 0;
  var period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚间';
  var matched = _findTimeBoundedSession(group, existingSessions, gapMs);
  if (matched) {
    _extendSessionWindow(matched, group);
    return { session: matched, isNew: false };
  }

  var totalProfit = 0;
  group.hands.forEach(function (hand) { totalProfit += hand.profitBB || 0; });
  var stakeLevels = _stakeLevelsOf(group);
  return {
    session: {
      id: generateId(),
      date: startStr,
      level: _formatSessionLevel(stakeLevels),
      stakeLevels: stakeLevels,
      startedAt: group.startedAt,
      endedAt: group.endedAt,
      duration: _sessionDuration(group.startTime, group.endTime, group.hands.length),
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
  var gapHours = opts.sessionGapHours || CONSTANTS.SESSION_GAP_HOURS;
  var gapMs = _sessionGapMs(gapHours);

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
    _groupBySessionGap(selected, gapHours).forEach(function (group) {
      var mapping = _makeSession(group, sessions, generateId, gapMs);
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
  // [V7.10.6 修改] 按唯一连续 Session 聚合手数/盈亏：分批导入续接同一时间窗口时，
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
    }
    // [V7.10.6 新增] 自动导入场次已有精确起止时间时，时长以真实窗口为准；手工场次维持用户填写值。
    if (session.startedAt && session.endedAt) {
      session.duration = _sessionDuration(_parseLocalTime(session.startedAt), _parseLocalTime(session.endedAt), session.hands);
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
