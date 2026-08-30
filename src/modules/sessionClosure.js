// [V7.9.1 新增] Session Closure — 每场收尾的领域模块：Mark 匹配、候选手牌、收尾记录
// 领域原则：Mark 通过 matchedHandId 链接手牌，标注与备注不写回手牌记录（Hand Fact 不可回写）。
// Timer 保持纯计时，本模块只读手牌/Mark 的分钟级时间事实。
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { HandRepo, MarksRepo, ClosureRepo } from '../store/store.js';

var REASON_LABELS = { mark: 'Mark', bigloss: '大亏损', leverage: '高杠杆', star: '星标' };
var MATCH_WINDOW_MIN = 5;       // Mark 与手牌的默认匹配窗口（分钟）
var SESSION_RANGE_PAD_MIN = 30; // 收尾时纳入本场 Mark 的时间外扩（分钟）
var CANDIDATE_LIMIT = 8;        // 候选手牌上限
var LEVERAGE_TOP = 3;           // 高杠杆取 |pBB| 前 N

function _toMs(dateStr) {
  if (!dateStr) return NaN;
  return new Date(String(dateStr).replace(' ', 'T') + ':00').getTime();
}

function _cardsHtml(hand) {
  var match = (hand.desc || '').match(/Hero[^\n\[]*\[([^\]]+)\]/);
  if (!match) return '--';
  var html = Utils.renderCardBadges(match[1], { style: 'margin-right:2px' });
  if (hand.oCards) {
    html += ' <span style="color:#a8afba;font-size:0.7em">vs ' + Utils.escapeHtml(hand.oCards) + '</span>';
  }
  return html;
}

function _profitHtml(pBB) {
  if (pBB == null) return '<span style="color:#a8afba">--</span>';
  var color = pBB >= 0 ? '#6baf7e' : '#c06060';
  return '<span style="font-weight:bold;color:' + color + '">' + (pBB >= 0 ? '+' : '') + Utils.safeFixed(pBB, 1) + ' BB</span>';
}

export var SessionClosure = {
  REASON_LABELS: REASON_LABELS,
  MATCH_WINDOW_MIN: MATCH_WINDOW_MIN,

  // ---- 纯函数（契约测试 seam，不触 Repo）----

  // Mark 与手牌按时间邻近 proposing：窗口内候选，同 sessionId 优先，再按 |Δt| 升序。
  // 返回 [{ hand, deltaMin, sameSession }]
  proposeMatches: function (mark, hands, windowMin) {
    var windowMs = (windowMin || MATCH_WINDOW_MIN) * 60000;
    var markMs = _toMs(mark && mark.time);
    if (isNaN(markMs)) return [];
    var out = [];
    (hands || []).forEach(function (hand) {
      var handMs = _toMs(hand && hand.date);
      if (isNaN(handMs)) return;
      var delta = Math.abs(handMs - markMs);
      if (delta > windowMs) return;
      out.push({
        hand: hand,
        deltaMin: Math.round(delta / 60000),
        sameSession: Boolean(mark.sessionId) && hand.sessionId === mark.sessionId,
      });
    });
    out.sort(function (a, b) {
      if (a.sameSession !== b.sameSession) return a.sameSession ? -1 : 1;
      return a.deltaMin - b.deltaMin;
    });
    return out;
  },

  // 候选手牌：Mark 关联 > 大亏损 > 高杠杆(|pBB| 前 N) > 星标，去重、按最优来源排序、上限 limit。
  // 返回 [{ hand, reasons: ['mark'|'bigloss'|'leverage'|'star'] }]
  buildCandidates: function (hands, marks, opts) {
    opts = opts || {};
    var leverageTop = opts.leverageTop || LEVERAGE_TOP;
    var limit = opts.limit || CANDIDATE_LIMIT;
    var byId = {};
    function add(hand, reason) {
      if (!hand || !hand.id) return;
      if (!byId[hand.id]) byId[hand.id] = { hand: hand, reasons: [] };
      if (byId[hand.id].reasons.indexOf(reason) === -1) byId[hand.id].reasons.push(reason);
    }
    var matchedIds = {};
    (marks || []).forEach(function (m) {
      if (m.status === 'matched' && m.matchedHandId) matchedIds[m.matchedHandId] = true;
    });
    (hands || []).forEach(function (h) {
      if (matchedIds[h.id]) add(h, 'mark');
      var bb = h.pBB != null ? h.pBB : null;
      if (h.isBigLoss === true || (bb != null && bb <= -CONSTANTS.BIG_LOSS_THRESHOLD_BB)) add(h, 'bigloss');
      if (h.marked === true) add(h, 'star');
    });
    (hands || [])
      .filter(function (h) { return h.pBB != null; })
      .slice()
      .sort(function (a, b) { return Math.abs(b.pBB) - Math.abs(a.pBB); })
      .slice(0, leverageTop)
      .forEach(function (h) { add(h, 'leverage'); });
    var priority = { mark: 0, bigloss: 1, leverage: 2, star: 3 };
    var list = Object.keys(byId).map(function (k) { return byId[k]; });
    list.sort(function (a, b) {
      var pa = Math.min.apply(null, a.reasons.map(function (r) { return priority[r]; }));
      var pb = Math.min.apply(null, b.reasons.map(function (r) { return priority[r]; }));
      if (pa !== pb) return pa - pb;
      return Math.abs(b.hand.pBB || 0) - Math.abs(a.hand.pBB || 0);
    });
    return list.slice(0, limit);
  },

  // 未收尾场次：有关联手牌且无 closed 收尾记录，按日期倒序。
  getUnfinishedSessions: function (sessions, hands, closures) {
    var closed = {};
    (closures || []).forEach(function (c) {
      if (c.status === 'closed') closed[c.sessionId] = true;
    });
    var hasHands = {};
    (hands || []).forEach(function (h) {
      if (h.sessionId) hasHands[h.sessionId] = true;
    });
    return (sessions || [])
      .filter(function (s) { return hasHands[s.id] && !closed[s.id]; })
      .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  },

  // ---- Repo 操作 ----

  getClosureFor: function (sessionId) {
    return ClosureRepo.getAll().filter(function (c) { return c.sessionId === sessionId; })[0] || null;
  },

  ensureDraft: function (sessionId) {
    var closure = this.getClosureFor(sessionId);
    if (closure) return closure;
    closure = {
      id: Utils.generateUUID(),
      sessionId: sessionId,
      status: 'draft',
      closedAt: null,
      reviewedHandIds: [],
      matchedMarkIds: [],
      note: '',
    };
    ClosureRepo.saveAll(ClosureRepo.getAll().concat([closure]));
    return closure;
  },

  toggleReviewedHand: function (sessionId, handId) {
    var closure = this.ensureDraft(sessionId);
    var idx = closure.reviewedHandIds.indexOf(handId);
    if (idx === -1) closure.reviewedHandIds.push(handId);
    else closure.reviewedHandIds.splice(idx, 1);
    ClosureRepo.saveAll(ClosureRepo.getAll());
    return closure;
  },

  matchMark: function (markId, handId, sessionId) {
    var marks = MarksRepo.getAll();
    var mark = marks.filter(function (m) { return m.id === markId; })[0];
    if (!mark) return;
    mark.status = 'matched';
    mark.matchedHandId = handId;
    if (!mark.sessionId && sessionId) mark.sessionId = sessionId;
    MarksRepo.saveAll(marks);
    var closure = this.ensureDraft(mark.sessionId || sessionId);
    if (closure.matchedMarkIds.indexOf(markId) === -1) closure.matchedMarkIds.push(markId);
    ClosureRepo.saveAll(ClosureRepo.getAll());
  },

  dismissMark: function (markId) {
    var marks = MarksRepo.getAll();
    var mark = marks.filter(function (m) { return m.id === markId; })[0];
    if (!mark) return;
    mark.status = 'dismissed';
    MarksRepo.saveAll(marks);
  },

  reopenMark: function (markId) {
    var marks = MarksRepo.getAll();
    var mark = marks.filter(function (m) { return m.id === markId; })[0];
    if (!mark) return;
    mark.status = 'open';
    mark.matchedHandId = null;
    MarksRepo.saveAll(marks);
    var closures = ClosureRepo.getAll();
    var closure = closures.filter(function (c) { return c.sessionId === mark.sessionId; })[0];
    if (closure) {
      var idx = closure.matchedMarkIds.indexOf(markId);
      if (idx !== -1) closure.matchedMarkIds.splice(idx, 1);
      ClosureRepo.saveAll(closures);
    }
  },

  confirmClosure: function (sessionId) {
    var closure = this.ensureDraft(sessionId);
    closure.status = 'closed';
    closure.closedAt = Utils.getLocalDatetime();
    ClosureRepo.saveAll(ClosureRepo.getAll());
    return closure;
  },

  // ---- 渲染：Session 展开行内的收尾工作区 ----

  renderInto: function (td, session) {
    var self = this;
    var hands = HandRepo.getAll().filter(function (h) { return h.sessionId === session.id; });
    var marks = MarksRepo.getAll();
    var closure = this.getClosureFor(session.id);
    var reviewed = closure ? closure.reviewedHandIds : [];

    // 本场 Mark：sessionId 匹配，或时间落在本场手牌时间范围 ± 外扩
    var times = hands.map(function (h) { return _toMs(h.date); }).filter(function (t) { return !isNaN(t); });
    var rangeMin = times.length ? Math.min.apply(null, times) - SESSION_RANGE_PAD_MIN * 60000 : null;
    var rangeMax = times.length ? Math.max.apply(null, times) + SESSION_RANGE_PAD_MIN * 60000 : null;
    var sessionMarks = marks.filter(function (m) {
      if (m.sessionId === session.id) return true;
      if (m.sessionId) return false;
      if (rangeMin == null) return false;
      var t = _toMs(m.time);
      return !isNaN(t) && t >= rangeMin && t <= rangeMax;
    });
    var openMarks = sessionMarks.filter(function (m) { return m.status === 'open'; });
    var matchedMarks = sessionMarks.filter(function (m) { return m.status === 'matched'; });
    var dismissedCount = sessionMarks.filter(function (m) { return m.status === 'dismissed'; }).length;
    var candidates = this.buildCandidates(hands, sessionMarks);
    var reviewedCount = candidates.filter(function (c) { return reviewed.indexOf(c.hand.id) !== -1; }).length;

    var html = '';
    html += '<div data-closure-session="' + Utils.escapeHtml(session.id) + '" style="padding:10px 12px">';
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
    html += '<span style="color:#cbd5e1;font-weight:bold">🏁 收尾 · ' + Utils.escapeHtml(session.date) + ' ' + Utils.escapeHtml(session.level) + '</span>';
    html += '<span style="color:#a8afba;font-size:0.75em">' + hands.length + ' 手 · ' + _profitHtml(session.profit) + '</span>';
    if (closure && closure.status === 'closed') {
      html += '<span class="status-inline status-inline--success">已收尾 ' + Utils.escapeHtml(closure.closedAt || '') + '</span>';
    } else {
      html += '<span class="status-inline status-inline--danger">未收尾</span>';
    }
    html += '</div>';

    // Mark 匹配区
    html += '<div style="margin-bottom:10px">';
    html += '<div style="color:#a8afba;font-size:0.75em;margin-bottom:4px">⚡ Mark 匹配（待处理 ' + openMarks.length + ' · 已关联 ' + matchedMarks.length + (dismissedCount ? ' · 无对应 ' + dismissedCount : '') + '）</div>';
    if (!hands.length) {
      html += '<div style="color:#a8afba;font-size:0.75em">本场暂无手牌，先「导入牌谱到此 Session」再匹配 Mark。</div>';
    } else if (!sessionMarks.length) {
      html += '<div style="color:#a8afba;font-size:0.75em">本场时间范围内没有 Mark。</div>';
    }
    openMarks.forEach(function (m) {
      html += '<div style="border:1px solid #1e3a5f;border-radius:6px;padding:6px 8px;margin-bottom:6px">';
      html += '<div style="font-size:0.75em;color:#cbd5e1;margin-bottom:4px"><span style="color:#5a9e8f">' + Utils.escapeHtml(m.time) + '</span> ' + Utils.escapeHtml(m.note || '(无备注)') + (m.mistake ? ' · <span style="color:#c06060">' + Utils.escapeHtml(m.mistake) + '</span>' : '') + '</div>';
      var proposals = self.proposeMatches(m, hands);
      if (!proposals.length) {
        html += '<div style="font-size:0.7em;color:#a8afba;margin-bottom:4px">±' + MATCH_WINDOW_MIN + ' 分钟内没有手牌。</div>';
      } else {
        proposals.slice(0, 3).forEach(function (p) {
          html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.75em;padding:2px 0">';
          html += '<span style="color:#a8afba;width:88px;white-space:nowrap">' + Utils.escapeHtml(p.hand.date) + '（差' + p.deltaMin + '分）</span>';
          html += '<span style="flex:1">' + _cardsHtml(p.hand) + ' ' + _profitHtml(p.hand.pBB) + '</span>';
          html += '<button class="btn--mini" data-mark-match="' + Utils.escapeHtml(m.id) + '|' + Utils.escapeHtml(p.hand.id) + '">确认关联</button>';
          html += '</div>';
        });
        if (proposals.length > 3) {
          html += '<div style="font-size:0.7em;color:#a8afba">另有 ' + (proposals.length - 3) + ' 个候选未展开。</div>';
        }
      }
      html += '<button class="btn--mini" data-mark-dismiss="' + Utils.escapeHtml(m.id) + '" style="margin-top:4px">无对应手牌</button>';
      html += '</div>';
    });
    matchedMarks.forEach(function (m) {
      var hand = hands.filter(function (h) { return h.id === m.matchedHandId; })[0];
      html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.75em;padding:4px 8px;margin-bottom:4px;border-left:3px solid #5a9e8f;background:rgba(90,158,143,0.08)">';
      html += '<span style="color:#5a9e8f">' + Utils.escapeHtml(m.time) + '</span>';
      html += '<span style="flex:1;color:#cbd5e1">' + Utils.escapeHtml(m.note || '(无备注)') + '</span>';
      html += hand ? '<span>' + _cardsHtml(hand) + ' ' + _profitHtml(hand.pBB) + '</span>' : '<span style="color:#c06060">关联手牌已删除</span>';
      html += '<button class="btn--mini" data-mark-reopen="' + Utils.escapeHtml(m.id) + '">取消关联</button>';
      html += '</div>';
    });
    html += '</div>';

    // 候选手牌区
    html += '<div style="margin-bottom:10px">';
    html += '<div style="color:#a8afba;font-size:0.75em;margin-bottom:4px">🎯 候选手牌（已看 ' + reviewedCount + '/' + candidates.length + '，盈亏只提供语境）</div>';
    if (!candidates.length) {
      html += '<div style="color:#a8afba;font-size:0.75em">本场没有命中候选条件的手牌。</div>';
    }
    candidates.forEach(function (c) {
      var isReviewed = reviewed.indexOf(c.hand.id) !== -1;
      html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.75em;padding:4px 8px;margin-bottom:4px;border:1px solid #1e3a5f;border-radius:6px' + (isReviewed ? ';opacity:0.55' : '') + '">';
      html += '<span style="display:flex;gap:4px">';
      c.reasons.forEach(function (r) {
        var color = r === 'mark' ? '#5a9e8f' : r === 'bigloss' ? '#c06060' : r === 'leverage' ? '#d4a853' : '#8b949e';
        html += '<span style="background:' + color + ';color:#0a1624;font-size:0.7em;font-weight:bold;padding:1px 5px;border-radius:4px">' + REASON_LABELS[r] + '</span>';
      });
      html += '</span>';
      html += '<span style="color:#a8afba;width:112px;white-space:nowrap">' + Utils.escapeHtml(c.hand.date || '') + '</span>';
      html += '<span style="flex:1">' + _cardsHtml(c.hand) + '</span>';
      html += '<span>' + _profitHtml(c.hand.pBB) + '</span>';
      html += '<button class="btn--mini" data-cand-view="' + Utils.escapeHtml(c.hand.id) + '">查看</button>';
      html += '<button class="btn--mini" data-cand-review="' + Utils.escapeHtml(c.hand.id) + '" style="' + (isReviewed ? 'background:#5a9e8f;color:#0a1624' : '') + '">' + (isReviewed ? '✓ 已看' : '标为已看') + '</button>';
      html += '</div>';
    });
    html += '</div>';

    // 收尾操作
    if (!closure || closure.status !== 'closed') {
      html += '<button class="btn" data-closure-confirm style="font-size:0.8em">🏁 确认收尾</button>';
      html += '<span style="color:#a8afba;font-size:0.7em;margin-left:8px">已看 ' + reviewedCount + '/' + candidates.length + ' · Mark 待处理 ' + openMarks.length + '（可随时回来继续，进度自动保存）</span>';
    }
    html += '</div>';
    td.innerHTML = html;
  },
};
