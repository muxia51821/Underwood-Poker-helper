// [V6.9.2] 复盘模块（Session/手局/周级 + 统计 + 图表 + 数据迁徙）
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { Store, SessionRepo, HandRepo, WeeklyRepo, TiltLogRepo } from '../store/store.js';
import { analyze, getStatColor, STAT_TOOLTIPS, STAT_DEFINITIONS } from './statsEngine.js';  // [V6.18.4]
import { openGGImportForSession } from './ggImport.js';  // [V6.14.0]
import { HandPicker } from './handPicker.js';  // [V6.15.0]

// [V7.0.0] 对手统计缓存 — 避免排序/筛选时重复聚合全量手牌
var _oppStatsCache = null;
var _oppStatsCacheLen = -1;

// [V6.15.0] 切换手牌标记状态
function _toggleMarkHand(id, btnEl) {
  var reviews = HandRepo.getAll();
  var found = false;
  reviews.forEach(function (r) {
    if (r.id === id) {
      r.marked = !r.marked;
      found = true;
      if (btnEl) {
        btnEl.textContent = r.marked ? '★' : '☆';
        btnEl.style.color = r.marked ? '#facc15' : '#64748b';
      }
    }
  });
  if (found) {
    HandRepo.saveAll(reviews);
    HandPicker.render();
  }
}

// [V6.18.4] 可复用：渲染折叠统计面板 + 点击 tooltip
function _renderStatSection(targetEl, title, keys, es, isPercent) {
  var openAttr = (title === 'Overview') ? ' open' : '';
  var html = '<details class="stats-details"' + openAttr + '><summary class="stats-section-title">' + title + '</summary><div class="stats" style="flex-wrap:wrap">';
  keys.forEach(function (key) {
    var stat = es[key];
    if (!stat) return;
    if (isPercent && stat.type !== 'percent') return;
    var cls = isPercent ? getStatColor(stat.value, key) : (stat.type === 'bb' ? (stat.value >= 0 ? 'text-win' : 'text-lose') : '');
    var prefix = isPercent ? '' : (stat.type === 'bb' ? (stat.value >= 0 ? '+' : '') : '');
    var suffix = isPercent ? '%' : (stat.type === 'percent' ? '%' : (stat.type === 'bb' ? ' BB' : ''));
    html += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + cls + '">' + prefix + Utils.safeFixed(stat.value, 1) + suffix + '</div></div>';
  });
  html += '</div></details>';
  targetEl.insertAdjacentHTML('beforeend', html);
}
// [V6.18.4] 嵌套分组：一个父 details 包裹多个子 details
function _renderNestedGroup(targetEl, parentTitle, groups, es, isPercent) {
  var html = '<details class="stats-details"><summary class="stats-section-title">' + parentTitle + '</summary>';
  groups.forEach(function (g) {
    html += '<details class="stats-details" open><summary class="stats-section-title">' + g.title + '</summary><div class="stats" style="flex-wrap:wrap">';
    g.keys.forEach(function (key) {
      var stat = es[key];
      if (!stat) return;
      if (isPercent && stat.type !== 'percent') return;
      var cls = isPercent ? getStatColor(stat.value, key) : (stat.type === 'bb' ? (stat.value >= 0 ? 'text-win' : 'text-lose') : '');
      var prefix = isPercent ? '' : (stat.type === 'bb' ? (stat.value >= 0 ? '+' : '') : '');
      var suffix = isPercent ? '%' : (stat.type === 'percent' ? '%' : (stat.type === 'bb' ? ' BB' : ''));
      html += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + cls + '">' + prefix + Utils.safeFixed(stat.value, 1) + suffix + '</div></div>';
    });
    html += '</div></details>';
  });
  html += '</details>';
  targetEl.insertAdjacentHTML('beforeend', html);
}
// [V6.18.4] tooltip 事件委托 — 在 Total/Session 统计区统一处理
function _initStatTooltip(containerId) {
  var el = document.getElementById(containerId);
  if (!el || el.dataset.tooltipReady) return;
  el.dataset.tooltipReady = '1';
  el.addEventListener('click', function (e) {
    var item = e.target.closest('[data-stat-key]');
    if (!item) return;
    var key = item.dataset.statKey;
    var stat = STAT_DEFINITIONS[key];
    var name = stat ? stat.name : key;
    var tip = STAT_TOOLTIPS[key] || '暂无说明。';
    var modal = document.getElementById('statTooltip');
    document.getElementById('statTooltipTitle').textContent = name;
    document.getElementById('statTooltipText').textContent = tip;
    modal.style.display = 'flex';
  });
}

// [V6.18.5] 可复用：渲染引擎统计面板（Total/Session/Weekly 共用）
// opts.extraOverviewHtml — 可选，追加到 Overview 网格末尾的 HTML（如 Hands/Hour）
function renderStatsPanel(opts) {
  var el = opts.containerEl;
  var es = opts.es;
  var recs = opts.recs;
  var showExtras = opts.showExtras !== false;
  var overviewKeys = ['totalHands', 'bbPer100', 'profitWithRake', 'bbPer100WithRake'];
  var preflopOpenKeys = ['vpip', 'pfr', 'limp'];
  var vsRaiseKeys = ['threeBet', 'fourBet', 'foldTo3bet', 'foldTo4bet', 'squeeze', 'coldCall'];
  var stealKeys = ['stealAttempt', 'foldToSteal'];
  var pfaKeys = ['cbetFlop', 'cbetTurn', 'cbetRiver', 'wwsfAsPfr', 'wtsdAfterCbet'];
  var pfdKeys = ['foldToCbet', 'raiseCbetFlop', 'donkBetFlop', 'betVsMissedCbet', 'checkRaiseFlop', 'wwsfAsCaller'];
  var sdKeys = ['wtsd', 'wtsdWon', 'wwsf'];
  var aggKeys = ['probeBetTurn', 'afqFlop', 'afqTurn', 'afqRiver'];
  if (showExtras) {
    var rakeHtml = '<div class="stats" style="margin-top:8px">';
    rakeHtml += '<div class="stats__item"><div class="stats__label">Total Rake</div><div class="stats__value" style="color:#f87171">-$' + Utils.safeFixed(es.totalRake.value, 2) + '</div></div>';
    rakeHtml += '<div class="stats__item"><div class="stats__label">Total Jackpot</div><div class="stats__value">$' + Utils.safeFixed(es.totalJackpot.value, 2) + '</div></div>';
    rakeHtml += '<div class="stats__item stats__item--win"><div class="stats__label">Pre-Rake Profit</div><div class="stats__value text-win">' + (es.profitWithRake.value >= 0 ? '+' : '') + Utils.safeFixed(es.profitWithRake.value, 1) + ' BB</div></div>';
    rakeHtml += '<div class="stats__item ' + (es.bbPer100WithRake.value >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100 (Pre-Rake)</div><div class="stats__value ' + (es.bbPer100WithRake.value >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(es.bbPer100WithRake.value, 1) + '</div></div>';
    rakeHtml += '</div>';
    el.insertAdjacentHTML('beforeend', rakeHtml);
    _renderStatSection(el, 'Overview', overviewKeys, es, false);
    if (opts.extraOverviewHtml) {
      // 注入到最后一个 Overview details 的 .stats 网格中
      var overviewGrids = el.querySelectorAll('.stats-details .stats');
      if (overviewGrids.length > 0) {
        overviewGrids[overviewGrids.length - 1].insertAdjacentHTML('beforeend', opts.extraOverviewHtml);
      }
    }
  }
  _renderNestedGroup(el, 'Preflop', [
    { title: 'Preflop Open', keys: preflopOpenKeys },
    { title: 'Vs. Raise', keys: vsRaiseKeys },
    { title: 'Steal Dynamics', keys: stealKeys }
  ], es, true);
  _renderNestedGroup(el, 'Postflop', [
    { title: 'Preflop Aggressor', keys: pfaKeys },
    { title: 'Preflop Defender', keys: pfdKeys },
    { title: 'Showdown Stats', keys: sdKeys },
    { title: 'Aggression by Street', keys: aggKeys }
  ], es, true);
  // [V6.18.9] Position 位置统计
  if (opts.showPosition !== false) {
    var posGroups = { EP: ['UTG', 'UTG+1', 'UTG+2'], MP: ['MP', 'HJ'], CO: ['CO'], BTN: ['BTN'], SB: ['SB'], BB: ['BB'] };
    var posKeys = ['vpip', 'pfr', 'threeBet', 'cbetFlop', 'foldToCbet', 'wtsd', 'wwsf'];
    var posItems = [];
    Object.keys(posGroups).forEach(function (pos) {
      var posHands = HandRepo.getAll().filter(function (h) {
        var m = (h.desc || '').match(/^preflop.*Hero\s+(\w+)\//m);
        return m && posGroups[pos].indexOf(m[1]) !== -1;
      });
      if (posHands.length > 0) {
        var posResult = analyze(posHands);
        var posStats = posResult.stats;
        var posHtml = '<details class="stats-details"><summary class="stats-section-title">' + pos + ' (' + posHands.length + 'h)</summary><div class="stats" style="flex-wrap:wrap">';
        posKeys.forEach(function (key) {
          var stat = posStats[key];
          if (!stat || stat.type !== 'percent') return;
          var colorClass = getStatColor(stat.value, key);
          posHtml += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + colorClass + '">' + stat.value + '%</div></div>';
        });
        posHtml += '</div></details>';
        posItems.push(posHtml);
      }
    });
    if (posItems.length > 0) {
      var posParentHtml = '<details class="stats-details"><summary class="stats-section-title">Position</summary>' + posItems.join('') + '</details>';
      el.insertAdjacentHTML('beforeend', posParentHtml);
    }
  }
  if (showExtras) {
    var recHtml = '<div class="card" style="margin-top:12px"><div class="card__title">Recommendations</div>';
    if (recs.length === 0) {
      recHtml += '<div class="rec-good">各项指标均在理想范围，继续保持！</div>';
    } else {
      recs.forEach(function (r) { recHtml += '<div class="rec-card">' + r.text + '</div>'; });
    }
    recHtml += '</div>';
    el.insertAdjacentHTML('beforeend', recHtml);
  }
}

export const Review = {
  init() {
    document.getElementById('addSessionBtn').addEventListener('click', () => this.addSession());
    document.getElementById('clearSessionBtn').addEventListener('click', () => this.clearSessionForm());
    document.getElementById('refreshSessionsBtn').addEventListener('click', () => this.renderSessions());
    document.getElementById('filterLevel').addEventListener('change', () => this.renderSessions());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.importData(e));
    document.getElementById('saveHandBtn').addEventListener('click', () => this.saveHandReview());
    // [V6.15.1] 手牌筛选器
    var handPotFilter = document.getElementById('handPotSizeFilter');
    var handSessFilter = document.getElementById('handSessFilter');
    if (handPotFilter) { handPotFilter.addEventListener('change', () => { this.handCurrentPage = 1; this.renderHandReviews(); }); }
    if (handSessFilter) { handSessFilter.addEventListener('change', () => { this.handCurrentPage = 1; this.renderHandReviews(); }); }
    document.getElementById('saveWeeklyBtn').addEventListener('click', () => this.saveWeeklyReview());
    Utils.initDropdown(document.getElementById('migrateBtn'), document.getElementById('migrateMenu'));
    document.getElementById('sessDate').value = Utils.getLocalDate();
    Utils.initToggleGroup('sessMistakeGroup');
    Utils.initToggleGroup('handMistakeGroup');
    document.getElementById('sessionBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-delete-id]');
      if (delBtn) this.deleteSession(delBtn.dataset.deleteId);
      const editBtn = e.target.closest('[data-edit-id]');
      if (editBtn) this.editSession(editBtn.dataset.editId);
      const expandBtn = e.target.closest('[data-expand-id]');
      if (expandBtn) { this.toggleSessionExpand(expandBtn.dataset.expandId, expandBtn); this.updateStatsForSession(expandBtn.dataset.expandId); }
      // [V6.18.6] Session 展开区手牌编辑 → 跳转 Hand 面板
      const sessHandEditBtn = e.target.closest('[data-hand-edit]');
      if (sessHandEditBtn) {
        var handTab = document.querySelector('[data-sub="hand"]');
        if (handTab) handTab.click();
        setTimeout(function () { Review.editHandReview(sessHandEditBtn.dataset.handEdit); }, 100);
      }
      // [V6.15.0] Session 展开区域内的标记按钮
      const markBtn = e.target.closest('[data-hand-mark]');
      if (markBtn) { _toggleMarkHand(markBtn.dataset.handMark, markBtn); }
    });
    // [V6.15.1] Session 展开区域手牌筛选
    document.getElementById('sessionBody').addEventListener('change', (e) => {
      const sessFilter = e.target.closest('[data-sess-filter]');
      if (sessFilter) {
        var sid = sessFilter.dataset.sessFilter;
        var expandBtn = document.querySelector('[data-expand-id="' + sid + '"]');
        if (expandBtn) {
          // 关闭再重新展开以应用筛选
          var existingRow = document.getElementById('expand-row-' + sid);
          if (existingRow) existingRow.remove();
          expandBtn.textContent = '📋';
          Review.toggleSessionExpand(sid, expandBtn, sessFilter.value);
        }
      }
    });
    document.getElementById('handBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-hand-delete]');
      if (delBtn) this.deleteHandReview(delBtn.dataset.handDelete);
      const editBtn = e.target.closest('[data-hand-edit]');
      if (editBtn) this.editHandReview(editBtn.dataset.handEdit);
      // [V6.15.1] 手牌展开按钮
      const expandBtn = e.target.closest('[data-hand-expand]');
      if (expandBtn) { this.toggleHandExpand(expandBtn.dataset.handExpand, expandBtn); }
      // [V6.15.1] 展开行内的标记按钮
      const expMarkBtn = e.target.closest('[data-hand-mark]');
      if (expMarkBtn && expMarkBtn.dataset.handMark) { _toggleMarkHand(expMarkBtn.dataset.handMark, expMarkBtn); }
    });
    document.getElementById('weeklyBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-week-delete]');
      if (delBtn) this.deleteWeeklyReview(delBtn.dataset.weekDelete);
      const editBtn = e.target.closest('[data-week-edit]');
      if (editBtn) this.editWeeklyReview(editBtn.dataset.weekEdit);
    });
    // [V6.5.4] 手局批量操作 — [V6.16.0] 行点击选中替代 checkbox
    document.getElementById('handSelectAllBtn').addEventListener('click', function () {
      var allRows = document.querySelectorAll('#handBody tr[data-hand-id]');
      if (Review._selectedHandIds.size === allRows.length && allRows.length > 0) {
        Review._selectedHandIds.clear();
      } else {
        allRows.forEach(function (row) { Review._selectedHandIds.add(row.dataset.handId); });
      }
      Review._updateHandBatchUI();
    });
    document.getElementById('handBody').addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
      var row = e.target.closest('tr[data-hand-id]');
      if (!row) return;
      var id = row.dataset.handId;
      if (Review._selectedHandIds.has(id)) {
        Review._selectedHandIds.delete(id);
      } else {
        Review._selectedHandIds.add(id);
      }
      Review._updateHandBatchUI();
    });
    document.getElementById('handBatchDelBtn').addEventListener('click', function () {
      if (!Review._selectedHandIds.size) { Utils.showToast('请先点击行选择要删除的手牌'); return; }
      if (!confirm('确定删除选中的 ' + Review._selectedHandIds.size + ' 手牌局？此操作不可恢复。')) return;
      var ids = Review._selectedHandIds;
      var reviews = HandRepo.getAll().filter(function (r) { return !ids.has(r.id); });
      HandRepo.saveAll(reviews);
      Utils.showToast('已删除 ' + ids.size + ' 手牌');
      ids.clear();
      Review.handCurrentPage = 1;
      Review.renderHandReviews();
    });
    document.getElementById('handBatchLinkBtn').addEventListener('click', function () {
      if (!Review._selectedHandIds.size) { Utils.showToast('请先选择手牌'); return; }
      var sid = document.getElementById('handBatchSessionSelect').value;
      if (!sid) { Utils.showToast('请选择目标 Session'); return; }
      if (!confirm('将选中的 ' + Review._selectedHandIds.size + ' 手牌关联到选定 Session？')) return;
      var ids = Review._selectedHandIds;
      var reviews = HandRepo.getAll();
      reviews.forEach(function (r) { if (ids.has(r.id)) r.sessionId = sid; });
      HandRepo.saveAll(reviews);
      ids.clear();
      Review.renderHandReviews();
    });
    var handleHandDescInput = Utils.debounce(function () { Utils.updateHandVisual(); }, 150);
    document.getElementById('handDesc').addEventListener('input', handleHandDescInput);
    // [V6.10.0] 玩家数据分析 → 对手画像跳转按钮
    var gotoBtn = document.getElementById('gotoOpponentBtn');
    if (gotoBtn) gotoBtn.addEventListener('click', function () {
      document.querySelector('[data-sub="opponent"]').click();
    });
    // [V6.18.4] tooltip 关闭
    var tooltipModal = document.getElementById('statTooltip');
    if (tooltipModal) {
      document.getElementById('statTooltipClose').addEventListener('click', function () {
        tooltipModal.style.display = 'none';
      });
      tooltipModal.addEventListener('click', function (e) {
        if (e.target === tooltipModal) tooltipModal.style.display = 'none';
      });
    }
    // [V6.9.2] tiltLogSaved 事件在 app.js init 中通过 PubSub 绑定
  },
  renderAll() {
    this.renderSessions();
    this.updateTotalStats();
    this.populateHandSessionSelect();
    this.renderHandReviews();
    this.renderWeeklyReviews();
    this.generateWeeklyStats();
    this.renderTiltLogs();
  },
  getSessions() { return SessionRepo.getAll(); },
  saveSessions(s) { SessionRepo.saveAll(s); },
  addSession() {
    const date = document.getElementById('sessDate').value || Utils.getLocalDate(),
      level = document.getElementById('sessLevel').value.trim() || 'NL10',
      dur = parseFloat(document.getElementById('sessDur').value),
      hands = parseInt(document.getElementById('sessHands').value),
      profit = parseFloat(document.getElementById('sessProfit').value),
      tilt = parseInt(document.getElementById('sessTilt').value) || 5,
      remark = document.getElementById('sessRemark').value.trim();
    const btns = document.querySelectorAll('#sessMistakeGroup .toggle-btn.is-active');
    const mistakes = Array.from(btns).map((b) => b.dataset.mistake);
    const custom = document.getElementById('sessMistakeCustom').value.trim();
    if (custom) mistakes.push(custom);
    const mistakeStr = mistakes.join(', ') || '无';
    if (isNaN(dur) || isNaN(hands) || isNaN(profit) || dur <= 0 || hands <= 0) {
      Utils.showToast('请填写有效的时长、手数和盈亏'); return;
    }
    const s = { date, level, duration: dur, hands, profit, tilt, mistake: mistakeStr, remark };
    const sessions = this.getSessions();
    if (this.editingId) {
      const idx = sessions.findIndex(function (x) { return x.id === this.editingId; }.bind(this));
      if (idx !== -1) { s.id = this.editingId; sessions[idx] = s; }
      this.editingId = null;
      document.getElementById('addSessionBtn').textContent = '💾 保存';
      document.getElementById('clearSessionBtn').textContent = '🧹 清空';
      document.getElementById('addSessionBtn').style.background = '';
    } else {
      s.id = Utils.generateUUID(); sessions.push(s);
    }
    this.saveSessions(sessions);
    var self = this;
    var reviews = HandRepo.getAll();
    var unlinked = reviews.filter(function (r) { return (!r.sessionId || r.sessionId === '') && r.date === s.date; });
    if (unlinked.length > 0 && confirm('有 ' + unlinked.length + ' 手同日期未关联手牌，是否归入本场 Session？')) {
      unlinked.forEach(function (r) { r.sessionId = s.id; });
      HandRepo.saveAll(reviews);
    }
    this.clearSessionForm(); this.renderAll();
  },
  toggleSessionExpand(sessionId, btn, filterVal) {
    var existingRow = document.getElementById('expand-row-' + sessionId);
    if (existingRow) { existingRow.remove(); btn.textContent = '📋'; if (!filterVal) return; }
    btn.textContent = '▲';
    var handReviews = HandRepo.getAll();
    var linked = handReviews.filter(function (r) { return r.sessionId === sessionId; });
    // [V6.15.1] 应用筛选
    filterVal = filterVal || 'all';
    if (filterVal === 'above2') linked = linked.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 2; });
    else if (filterVal === 'above30') linked = linked.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 30; });
    var tr = document.createElement('tr');
    tr.id = 'expand-row-' + sessionId;
    var td = document.createElement('td');
    td.colSpan = 8;
    td.style.cssText = 'padding:8px 12px;background:#0a1628;font-size:0.75em;border-top:1px solid #1e3a5f';
    if (linked.length === 0) {
      td.innerHTML = '<span style="color:#64748b">📋 暂无关联手牌</span>';
    } else {
      // [V6.15.1] 筛选下拉 + 筛选逻辑
      var expandFilterId = 'sessHandFilter-' + sessionId;
      var parts = [
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">',
        '<span style="color:#94a3b8">📋 关联手牌 (' + linked.length + '手):</span>',
        '<select class="select" data-sess-filter="' + sessionId + '" id="' + expandFilterId + '" style="font-size:0.7em;padding:2px 6px;width:auto">',
        '<option value="all"' + (filterVal === 'all' ? ' selected' : '') + '>全部</option>',
        '<option value="above2"' + (filterVal === 'above2' ? ' selected' : '') + '>≥ 2 BB</option>',
        '<option value="above30"' + (filterVal === 'above30' ? ' selected' : '') + '>≥ 30 BB</option>',
        '</select>',
        '</div>'
      ];
      linked.forEach(function (r) {
        // [V6.15.2] 从 desc 提取 Hero 底牌渲染花色徽章，替代原来的 potType+board
        var handHtml = '';
        var heroCardsM = (r.desc || '').match(/Hero[^\n\[]*\[([^\]]+)\]/);
        if (heroCardsM) {
          handHtml += Utils.renderCardBadges(heroCardsM[1], { style: 'margin-right:2px' });
          // [V6.15.2] 对手牌灰色小字标注
          if (r.oCards) {
            handHtml += ' <span style="color:#64748b;font-size:0.7em">vs ' + Utils.escapeHtml(r.oCards) + '</span>';
          }
        } else {
          handHtml = '--';
        }
        var profitStr = r.pBB != null ? Utils.formatProfitHTML(r.pBB) : '--';
        var mistakeStr = r.mistake || '--';
        var ggMark = r.gg ? ' <span style="color:#64748b;font-size:0.85em">GG</span>' : '';
        parts.push('<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid #1e293b">');
        parts.push('<span style="min-width:80px">' + handHtml + '</span>');
        var markIcon = r.marked ? '★' : '☆';
        var markColor = r.marked ? '#facc15' : '#64748b';
        parts.push('<span style="flex:1;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + profitStr + ggMark + '</span>');
        parts.push('<span style="color:#94a3b8;min-width:60px;text-align:right">' + Utils.escapeHtml(mistakeStr) + '</span>');
        parts.push('<button class="btn--mini" data-hand-edit="' + r.id + '" style="font-size:0.85em">👁️</button>');
        parts.push('<button class="btn--mini hand-mark-btn" data-hand-mark="' + r.id + '" style="font-size:0.85em;color:' + markColor + '" title="标记">' + markIcon + '</button>');
        parts.push('</div>');
      });
      td.innerHTML = parts.join('');
    }
    tr.appendChild(td); btn.closest('tr').after(tr);
  },
  clearSessionForm() {
    ['sessDate','sessLevel','sessDur','sessHands','sessProfit','sessRemark','sessMistakeCustom'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('sessTilt').value = '5';
    document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach((b) => b.classList.remove('is-active'));
    this.editingId = null;
    document.getElementById('addSessionBtn').textContent = '💾 保存';
    document.getElementById('clearSessionBtn').textContent = '🧹 清空';
    document.getElementById('addSessionBtn').style.background = '';
  },
  editSession(id) {
    const sessions = this.getSessions();
    const s = sessions.find(function (x) { return x.id === id; });
    if (!s) return;
    this.editingId = id;
    document.getElementById('sessDate').value = s.date || '';
    document.getElementById('sessLevel').value = s.level || '';
    document.getElementById('sessDur').value = s.duration || '';
    document.getElementById('sessHands').value = s.hands || '';
    document.getElementById('sessProfit').value = s.profit || '';
    document.getElementById('sessTilt').value = s.tilt || 5;
    document.getElementById('sessRemark').value = s.remark || '';
    document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach(function (b) { b.classList.remove('is-active'); });
    if (s.mistake && s.mistake !== '无') {
      const parts = s.mistake.split(', ');
      document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach(function (b) {
        if (parts.indexOf(b.dataset.mistake) !== -1) b.classList.add('is-active');
      });
      const predefined = ['翻前结构错误','翻后认知错误','下注结构错误','Exploit偏移','心理错误'];
      const customParts = parts.filter(function (p) { return predefined.indexOf(p) === -1; });
      document.getElementById('sessMistakeCustom').value = customParts.join(', ');
    }
    document.getElementById('addSessionBtn').textContent = '💾 更新';
    document.getElementById('clearSessionBtn').textContent = '❌ 取消编辑';
    document.getElementById('addSessionBtn').style.background = '#0ea5e9';
    window.scrollTo({ top: document.getElementById('addSessionBtn').offsetTop - 100, behavior: 'smooth' });
  },
  deleteSession(id) {
    // confirmDelete is provided by app.js shell
    this._confirmDelete(() => this.getSessions(), (d) => this.saveSessions(d), () => this.renderAll(), 'id', id);
  },
  renderSessions() {
    var filter = document.getElementById('filterLevel').value;
    var sessions = Utils.sortByDateKey(this.getSessions());
    var levels = []; var seenLevels = {};
    sessions.forEach(function (s) { if (!seenLevels[s.level]) { seenLevels[s.level] = true; levels.push(s.level); } });
    var sel = document.getElementById('filterLevel');
    sel.innerHTML = '<option value="all">全部级别</option>';
    levels.forEach(function (l) { sel.innerHTML += '<option value="' + Utils.escapeHtml(l) + '">' + Utils.escapeHtml(l) + '</option>'; });
    var dl = document.getElementById('levelList');
    if (dl) { dl.innerHTML = levels.map(function (l) { return '<option value="' + Utils.escapeHtml(l) + '">'; }).join(''); }
    sel.value = filter;
    if (filter !== 'all') sessions = sessions.filter(function (s) { return s.level === filter; });
    var tmpl = document.getElementById('tmpl-session-row');
    var body = document.getElementById('sessionBody');
    var frag = document.createDocumentFragment();
    sessions.forEach(function (s) {
      var row = document.importNode(tmpl.content, true).firstElementChild;
      row.querySelector('[data-bind="date"]').textContent = s.date;
      row.querySelector('[data-bind="level"]').textContent = s.level;
      row.querySelector('[data-bind="duration"]').textContent = s.duration + 'h';
      row.querySelector('[data-bind="hands"]').textContent = s.hands;
      var profitEl = row.querySelector('[data-bind="profit"]');
      var profitStr = Utils.safeFixed(s.profit, 1);
      profitEl.textContent = (s.profit >= 0 ? '+' : '') + profitStr;
      profitEl.style.color = s.profit >= 0 ? '#4ade80' : '#f87171';
      row.querySelector('[data-bind="tilt"]').textContent = s.tilt;
      row.querySelector('[data-bind="mistake"]').textContent = s.mistake;
      row.querySelector('[data-expand-id]').setAttribute('data-expand-id', s.id);
      row.querySelector('[data-import-sid]').setAttribute('data-import-sid', s.id);
      row.querySelector('[data-edit-id]').setAttribute('data-edit-id', s.id);
      row.querySelector('[data-delete-id]').setAttribute('data-delete-id', s.id);
      // [V6.14.0] 导入按钮点击
      var importSessionBtn = row.querySelector('[data-import-sid]');
      importSessionBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openGGImportForSession(s.id);
      });
      frag.appendChild(row);
    });
    body.replaceChildren(frag);
  },
  // [V6.18.1] 全局统计 — 渲染到 Total 面板
  updateTotalStats() {
    const self = this;
    const sessions = this.getSessions();
    // [V7.0.0] 渲染指纹：Session/手牌数量未变则跳过全量 DOM 重建
    var allHands = HandRepo.getAll();
    var fp = sessions.length + '|' + allHands.length;
    if (this._totalFp === fp) return;
    this._totalFp = fp;
    const live = sessions.filter((s) => s.level.toLowerCase() === 'live');
    let tp = 0, th = 0, td = 0, tt = 0;
    sessions.forEach((s) => { tp += s.profit; th += s.hands; td += s.duration; tt += s.tilt; });
    const c = sessions.length, avgTilt = c ? Utils.safeFixed(tt / c, 1) : 'N/A',
      bb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A', hr = td ? Utils.safeFixed(tp / td, 2) : 'N/A';
    var hph = td > 0 ? Math.round(th / (td / 60)) : 0; // [V6.18.1] 手/小时
    var pph = td > 0 ? Utils.safeFixed(tp / (td / 60), 1) : 'N/A'; // [V6.18.1] BB/小时
    var tsa = document.getElementById('totalStatsArea');
    if (!tsa) return;
    Utils.setSafeHTML(tsa, '<div class="stats"><div class="stats__item"><div class="stats__label">Sessions</div><div class="stats__value">' + c + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Net Profit</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">Hands</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(bb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(bb100) >= 0 ? 'text-win' : 'text-lose') + '">' + bb100 + '</div></div><div class="stats__item ' + (parseFloat(hr) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Hourly</div><div class="stats__value ' + (parseFloat(hr) >= 0 ? 'text-win' : 'text-lose') + '">' + hr + ' BB/h</div></div><div class="stats__item"><div class="stats__label">Avg Tilt</div><div class="stats__value">' + avgTilt + '</div></div></div>');
    // 错误追踪
    const mistakeMap = new Map(), mistakeProfitMap = new Map();
    sessions.forEach((s) => {
      if (s.mistake !== '无') { s.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) { mistakeMap.set(t, (mistakeMap.get(t) || 0) + 1); mistakeProfitMap.set(t, (mistakeProfitMap.get(t) || 0) + s.profit); } }); }
    });
    let mh = '';
    if (mistakeMap.size) {
      const sorted = [...mistakeMap.entries()].map(([k, v]) => ({ name: k, count: v, avgProfit: Utils.safeFixed(mistakeProfitMap.get(k) / v, 1) })).sort((a, b) => parseFloat(a.avgProfit) - parseFloat(b.avgProfit));
      sorted.forEach((item) => { mh += '<span class="mistake-tag">' + Utils.escapeHtml(item.name) + ' x' + item.count + ' <span class="' + (parseFloat(item.avgProfit) >= 0 ? 'text-win' : 'text-lose') + '" style="font-size:0.85em">' + (parseFloat(item.avgProfit) >= 0 ? '+' : '') + item.avgProfit + ' BB</span></span> '; });
    } else { mh = '暂无错误记录'; }
    var tms = document.getElementById('totalMistakeStats');
    if (tms) Utils.setSafeHTML(tms, mh);
    // 统计引擎（allHands 已在指纹检查时获取）
    var engineResult = analyze(allHands);
    var es = engineResult.stats;
    var recs = engineResult.recommendations;
    // [V6.18.5] 引擎统计 — 公共渲染
    var extraOvHtml = '<div class="stats__item"><div class="stats__label">Hands/Hour</div><div class="stats__value">' + hph + '</div></div>';
    extraOvHtml += '<div class="stats__item ' + (parseFloat(pph) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">BB/Hour</div><div class="stats__value ' + (parseFloat(pph) >= 0 ? 'text-win' : 'text-lose') + '">' + (parseFloat(pph) >= 0 ? '+' : '') + pph + ' BB</div></div>';
    renderStatsPanel({ containerEl: tsa, es: es, recs: recs, extraOverviewHtml: extraOvHtml });
    this.renderChart('totalProfitChart');
    _initStatTooltip('totalStatsArea');
    // [V6.18.9] Live 数据更新（元素在 Villain 面板）
    var tlsEl2 = document.getElementById('totalLiveStats');
    if (tlsEl2) {
      var liveSessions = sessions.filter(function (s) { return s.level.toLowerCase() === 'live'; });
      var lh = '';
      if (liveSessions.length) {
        var lp = 0, lhI = 0, ld = 0, lt = 0;
        liveSessions.forEach(function (s) { lp += s.profit; lhI += s.hands; ld += s.duration; lt += s.tilt; });
        lh = '场次: ' + liveSessions.length + ' | 手数: ' + lhI + ' | 盈亏: ' + Utils.safeFixed(lp, 1) + ' BB | Tilt: ' + Utils.safeFixed(lt / liveSessions.length, 1) + ' | 时薪: ' + Utils.safeFixed(ld ? lp / ld : 0, 2) + ' BB/h';
      } else { lh = '暂无Live数据'; }
      tlsEl2.innerHTML = lh;
    }
  },
  // [V6.18.1] 向后兼容，重定向到 Total 面板
  updateStats() {
    this.updateTotalStats();
  },
  // [V6.16.5] 按 Session 过滤统计面板
  updateStatsForSession(sessionId) {
    var allSessions = this.getSessions();
    var target = allSessions.find(function (s) { return s.id === sessionId; });
    if (!target) return;
    // 使用单 Session 数组计算基础统计
    var sessions = [target];
    var tp = target.profit, th = target.hands, td = target.duration, tt = target.tilt;
    var c = 1, avgTilt = Utils.safeFixed(tt, 1),
      bb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A',
      hr = td ? Utils.safeFixed(tp / td, 2) : 'N/A';
    var titleHtml = '<div style="font-size:0.8em;color:#f97316;margin-bottom:6px">📌 仅显示: ' + Utils.escapeHtml(target.date) + ' ' + Utils.escapeHtml(target.level) + ' <button class="btn--mini" id="resetStatsFilterBtn" style="font-size:0.75em;margin-left:8px">↺ 全部</button></div>';
    Utils.setSafeHTML(document.getElementById('statsArea'), titleHtml + '<div class="stats"><div class="stats__item"><div class="stats__label">Session</div><div class="stats__value">' + c + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Profit</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">Hands</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(bb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(bb100) >= 0 ? 'text-win' : 'text-lose') + '">' + bb100 + '</div></div><div class="stats__item ' + (parseFloat(hr) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Hourly</div><div class="stats__value ' + (parseFloat(hr) >= 0 ? 'text-win' : 'text-lose') + '">' + hr + ' BB/h</div></div><div class="stats__item"><div class="stats__label">Tilt</div><div class="stats__value">' + avgTilt + '</div></div></div>');
    // 错误统计
    var mh = target.mistake && target.mistake !== '无' ? target.mistake : '暂无错误记录';
    var mhEl2 = document.getElementById('mistakeStats'); if (mhEl2) mhEl2.innerHTML = '<span class="mistake-tag">' + Utils.escapeHtml(mh) + '</span>';
    // 统计引擎 — 只算该 Session 的手牌
    var allHands = HandRepo.getAll();
    var engineResult = analyze(allHands, { sessionId: sessionId });
    var es = engineResult.stats;
    var recs = engineResult.recommendations;
    // [V6.18.5] 引擎统计 — 公共渲染
    var ssa = document.getElementById('statsArea');
    renderStatsPanel({ containerEl: ssa, es: es, recs: recs });
    _initStatTooltip('statsArea');
    var tlsEl = document.getElementById('totalLiveStats'); if (tlsEl) tlsEl.innerHTML = target.level.toLowerCase() === 'live' ? 'Live 场次' : '';
    var self = this;
    document.getElementById('resetStatsFilterBtn').addEventListener('click', function () {
      var totalTab = document.querySelector('[data-sub="total"]');
      if (totalTab) totalTab.click();
    });
    _initStatTooltip('statsArea');
  },
  // [V6.19.6] requestAnimationFrame 防抖，避免同一帧多次绘制
  _chartRAF: null,
  // [V6.18.1] canvasId 可选，默认 'profitChart'（向后兼容）
  renderChart(canvasId) {
    var self = this;
    if (self._chartRAF) cancelAnimationFrame(self._chartRAF);
    self._chartRAF = requestAnimationFrame(function () {
      self._chartRAF = null;
      self._doRenderChart(canvasId);
    });
  },
  _doRenderChart(canvasId) {
    var cid = canvasId || 'profitChart';
    const sessions = Utils.sortByDateKey(this.getSessions()).reverse().slice(0, 15).reverse();
    const canvas = document.getElementById(cid);
    if (!canvas) return;
    if (sessions.length < 2) {
      canvas.style.display = 'none';
      var chartParent = canvas.parentElement;
      if (chartParent && chartParent.querySelector('.chart-placeholder') === null) {
        var placeholder = document.createElement('div');
        placeholder.className = 'chart-placeholder text-muted';
        placeholder.textContent = '至少需要 2 场 Session 才能显示盈亏图表';
        placeholder.style.cssText = 'text-align:center;padding:20px 0;font-size:0.8em';
        chartParent.appendChild(placeholder);
      }
      return;
    }
    canvas.style.display = 'block';
    var placeholderEl = document.querySelector('.chart-placeholder');
    if (placeholderEl) placeholderEl.remove();
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth - 32;
    const H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const pad = { top: 20, right: 16, bottom: 40, left: 48 };
    const pw = W - pad.left - pad.right;
    const ph = H - pad.top - pad.bottom;
    const profits = sessions.map(function (s) { return s.profit; });
    const maxP = Math.max(Math.abs(Math.max.apply(null, profits)), Math.abs(Math.min.apply(null, profits)), 10);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#64748b'; ctx.font = '9px -apple-system,sans-serif'; ctx.textAlign = 'right';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.top + (ph / ySteps) * i;
      const val = maxP * (1 - (i / ySteps) * 2);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      if (i === 2) {
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5;
      }
      ctx.fillText(Math.round(val) + '', pad.left - 6, y + 3);
    }
    const barW = Math.max(6, Math.min(22, (pw / sessions.length) * 0.7));
    const gap = pw / sessions.length;
    sessions.forEach(function (s, i) {
      const x = pad.left + gap * i + (gap - barW) / 2;
      const h = (Math.abs(s.profit) / maxP) * (ph / 2);
      const y = s.profit >= 0 ? pad.top + ph / 2 - h : pad.top + ph / 2;
      ctx.fillStyle = s.profit >= 0 ? '#4ade80' : '#f87171';
      ctx.fillRect(x, y, barW, Math.max(1, h));
      if (i % 3 === 0 || i === sessions.length - 1) {
        ctx.fillStyle = '#94a3b8'; ctx.font = '8px -apple-system,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(s.date.slice(5) || s.date, x + barW / 2, pad.top + ph + 16);
      }
    });
    if (sessions.length >= 3) {
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 1; i < sessions.length - 1; i++) {
        const avg = (sessions[i - 1].profit + sessions[i].profit + sessions[i + 1].profit) / 3;
        const x = pad.left + gap * i + gap / 2;
        const y = pad.top + ph / 2 - (avg / maxP) * (ph / 2);
        if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#facc15'; ctx.font = '8px -apple-system,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('━ 3场滑动平均', pad.left, pad.top + 10);
    }
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(W - pad.right, pad.top + ph); ctx.stroke();
  },
  renderTiltLogs() {
    const logs = TiltLogRepo.getAll();
    const container = document.getElementById('tiltLogList');
    if (!container) return;
    if (logs.length === 0) { container.innerHTML = '暂无记录'; return; }
    const recent = logs.slice(-5).reverse();
    container.innerHTML = recent.map(function (l) {
      const timeStr = Utils.formatTime(l.time);
      return '<div style="margin-bottom:4px;background:#0f172a;padding:6px 10px;border-radius:8px"><span style="color:#f87171">' + Utils.escapeHtml(l.trigger) + '</span> | 强度:' + l.intensity + ' | ' + Utils.escapeHtml(l.note || '') + ' <span style="font-size:0.7em;color:#64748b">' + l.date + ' ' + timeStr + '</span></div>';
    }).join('');
  },
  // [V6.10.0] 对手画像：按对手名聚合统计
  // [V6.11.0] 增加 hands 数组，供详情展开
  getOpponentStats() {
    var allHands = HandRepo.getAll();
    // [V7.0.0] 缓存：排序/筛选切换时手牌总数未变则跳过聚合
    if (_oppStatsCache && allHands.length === _oppStatsCacheLen) return _oppStatsCache;
    _oppStatsCacheLen = allHands.length;
    var hands = allHands.filter(function (r) { return r.oId; });
    var map = {};
    hands.forEach(function (r) {
      var oid = r.oId;
      if (!map[oid]) {
        map[oid] = { name: oid, totalHands: 0, showdowns: 0, profit: 0, wins: 0, cards: [], lastDate: '', hands: [], _handRefs: [] };
      }
      var p = map[oid];
      p.totalHands++;
      p.profit += r.pBB || 0;
      if (r.pBB > 0) p.wins++;
      if (r.oCards) {
        p.showdowns++;
        if (p.cards.indexOf(r.oCards) === -1) p.cards.push(r.oCards);
      }
      if (r.date > p.lastDate) p.lastDate = r.date;
      // [V7.0.0] 保存完整手牌引用供懒加载统计
      p._handRefs.push(r);
      // [V6.13.0] 提取 Hero 手牌
      var hCards = '';
      var hm = r.desc ? r.desc.match(/Hero[^\n\[]*\[([^\]]+)\]/) : null;
      if (hm && hm[1]) hCards = hm[1];
      p.hands.push({ id: r.id, date: r.date, potType: r.potType, board: r.board, pBB: r.pBB, sessionId: r.sessionId, mistake: r.mistake, heroCards: hCards, oCards: r.oCards || '' });
    });
    var list = [];
    for (var k in map) { if (map.hasOwnProperty(k)) list.push(map[k]); }
    list.sort(function (a, b) { return b.totalHands - a.totalHands; });
    _oppStatsCache = list;
    return list;
  },
  // [V7.0.0] 按需构建单个对手的手牌列表 HTML（懒渲染回调）
  _buildOppHandListHtml(p, oppIdx, sessionsMap) {
    var html = '';
    p.hands.sort(function (a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; }).forEach(function (h, hi) {
      var dateFormatted = Utils.formatHandDate(h.date);
      var hProfitStr = h.pBB != null ? ((h.pBB >= 0 ? '+' : '') + Utils.safeFixed(h.pBB, 1) + ' BB') : '--';
      var hProfitColor = h.pBB >= 0 ? '#4ade80' : '#f87171';
      var heroCardsHtml = '';
      if (h.heroCards) {
        heroCardsHtml += Utils.renderCardBadges(h.heroCards, { style: 'margin-right:1px;font-size:0.85em' });
      } else { heroCardsHtml = '--'; }
      var filterClass = 'opp-filterable';
      if (h.pBB != null && Math.abs(h.pBB) >= 2) filterClass += ' above2';
      if (h.pBB != null && Math.abs(h.pBB) >= 30) filterClass += ' above30';
      html += '<div class="opp-hand-row ' + filterClass + '" style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #1e293b;cursor:pointer" data-opp-idx="' + oppIdx + '" data-hand-idx="' + hi + '">';
      html += '<span style="min-width:85px;color:#cbd5e1">' + dateFormatted + '</span>';
      html += '<span style="min-width:70px">' + heroCardsHtml + '</span>';
      html += '<span style="min-width:65px;color:' + hProfitColor + '">' + hProfitStr + '</span>';
      html += '<span style="flex:1;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Utils.escapeHtml(h.mistake || '--') + '</span>';
      html += '</div>';
      html += '<div class="opp-hand-detail ' + filterClass + '" id="oppHandDetail-' + oppIdx + '-' + hi + '" style="display:none;padding:6px 10px;background:#0a1628;border-radius:6px;margin-bottom:4px;font-size:0.9em">';
      html += '<div style="color:#94a3b8">底池类型: ' + Utils.escapeHtml(h.potType || '--') + '</div>';
      if (h.heroCards || h.oCards) {
        html += '<div style="color:#cbd5e1;margin-top:4px">';
        html += '<span style="color:#4ade80">我: ' + Utils.escapeHtml(h.heroCards || '--') + '</span>';
        html += '  <span style="color:#f87171">对手: ' + Utils.escapeHtml(h.oCards || '--') + '</span>';
        html += '</div>';
      }
      var hSession = sessionsMap.get(h.sessionId);
      if (hSession) {
        html += '<div style="color:#94a3b8">Session: ' + Utils.escapeHtml(hSession.date) + ' ' + Utils.escapeHtml(hSession.level) + '</div>';
      } else {
        html += '<div style="color:#64748b">未关联 Session</div>';
      }
      html += '<button class="btn--mini" data-hand-edit="' + h.id + '" style="margin-top:4px;font-size:0.85em">👁️ 查看手局</button>';
      html += '</div>';
    });
    return html;
  },
  // [V6.10.0] 渲染对手画像面板
  // [V6.11.0] 别名编辑 + 手牌列表展开
  // [V6.13.0] 多维度排序 + Hero/对手底牌
  renderOpponentProfiles(sortBy, sortDir, filterLive) {
    var self = this;
    var aliases = Store.opponentAliases.get();
    var liveFlags = Store.opponentLiveFlags.get();
    var stats = this.getOpponentStats();
    var sessions = SessionRepo.getAll();
    var bar = document.getElementById('opponentStatsBar');
    var list = document.getElementById('opponentList');
    if (!stats.length) {
      bar.textContent = '';
      list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">导入 GG 牌谱后自动生成对手画像</div>';
      return;
    }
    // [V6.12.3] Live 筛选
    if (filterLive) {
      stats = stats.filter(function (s) { return liveFlags[s.name]; });
    }
    // [V6.13.0] 排序
    sortBy = sortBy || 'lastDate';
    sortDir = sortDir || 'desc';
    stats.sort(function (a, b) {
      var va, vb;
      if (sortBy === 'profit') { va = a.profit; vb = b.profit; }
      else if (sortBy === 'winRate') { va = a.totalHands > 0 ? a.wins / a.totalHands : 0; vb = b.totalHands > 0 ? b.wins / b.totalHands : 0; }
      else { va = a.lastDate; vb = b.lastDate; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    if (!stats.length && filterLive) {
      bar.innerHTML = '暂无 Live 对手 &nbsp;' +
        '<button class="btn--mini sort-btn" data-sort="lastDate" style="font-size:0.7em">Recent</button> ' +
        '<button class="btn--mini sort-btn" data-sort="profit" style="font-size:0.7em">Net</button> ' +
        '<button class="btn--mini sort-btn" data-sort="winRate" style="font-size:0.7em">Win Rate</button> ' +
        '<button class="btn--mini live-filter-btn is-active" style="font-size:0.7em;background:#dc2626">Live</button>';
      list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">暂无标记为 Live 的对手</div>';
      self._bindOpponentSortAndFilter(bar, sortBy, sortDir, filterLive);
      return;
    }
    // [V7.0.0] 渲染指纹：数据/排序/筛选未变则跳过 DOM 重建
    var totalHands = 0;
    stats.forEach(function (s) { totalHands += s.totalHands; });
    var fp = stats.length + '|' + totalHands + '|' + sortBy + '|' + sortDir + '|' + (filterLive ? 1 : 0);
    if (self._villainFp === fp) return;
    self._villainFp = fp;
    bar.innerHTML = '共 ' + stats.length + ' 名对手，' + totalHands + ' 次交手 &nbsp;' +
      '<button class="btn--mini sort-btn' + (sortBy === 'lastDate' ? ' is-active' : '') + '" data-sort="lastDate" style="font-size:0.7em">Recent</button> ' +
      '<button class="btn--mini sort-btn' + (sortBy === 'profit' ? ' is-active' : '') + '" data-sort="profit" style="font-size:0.7em">Net</button> ' +
      '<button class="btn--mini sort-btn' + (sortBy === 'winRate' ? ' is-active' : '') + '" data-sort="winRate" style="font-size:0.7em">Win Rate</button> ' +
      '<button class="btn--mini live-filter-btn' + (filterLive ? ' is-active' : '') + '" style="font-size:0.7em;background:' + (filterLive ? '#dc2626' : '#334155') + '">Live</button>';
    // [V7.0.0] Session Map 预建 — O(1) 查找替代 O(n) find
    var sessionsMap = new Map();
    sessions.forEach(function (s) { sessionsMap.set(s.id, s); });
    var html = '';
    stats.forEach(function (p, i) {
      var displayName = Utils.getOpponentDisplayName(p.name, aliases);
      var hasAlias = aliases[p.name];
      var winRate = p.totalHands > 0 ? ((p.wins / p.totalHands) * 100).toFixed(0) : 0;
      var profitStr = (p.profit >= 0 ? '+' : '') + Utils.safeFixed(p.profit, 1) + ' BB';
      var profitColor = p.profit >= 0 ? '#4ade80' : '#f87171';
      html += '<div class="opponent-row" style="border:1px solid #334155;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;background:#0f172a" data-opp-idx="' + i + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      var isLive = liveFlags[p.name];
      html += '<div><span style="font-weight:bold;color:#facc15">' + (isLive ? '<span style="color:#dc2626;font-size:0.6em;vertical-align:middle">LIVE</span> ' : '') + Utils.escapeHtml(displayName) + '</span>' + (hasAlias ? ' <span style="font-size:0.65em;color:#64748b">' + Utils.escapeHtml(p.name) + '</span>' : '') + ' <span style="font-size:0.75em;color:#94a3b8">×' + p.totalHands + '</span></div>';
      html += '<div style="display:flex;align-items:center;gap:8px"><span style="color:' + profitColor + ';font-weight:bold">' + profitStr + '</span> <span style="font-size:0.75em;color:#94a3b8">' + winRate + '%胜</span> <button class="btn--mini alias-edit-btn" data-oid="' + Utils.escapeHtml(p.name) + '" style="font-size:0.65em;padding:2px 6px;cursor:pointer">✎</button></div>';
      html += '</div>';
      html += '<div class="opponent-detail" id="oppDetail-' + i + '" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #334155;font-size:0.75em;color:#94a3b8">';
      html += '摊牌 ' + p.showdowns + ' 次 | 最近 ' + p.lastDate.substring(0, 10);
      // [V7.0.0] 手牌列表 — 仅渲染筛选按钮和空容器，手牌行延迟到展开时构建
      if (p.hands.length) {
        var oppHandFilterId = 'oppHandFilter-' + i;
        html += '<div style="margin-top:8px;display:flex;align-items:center;gap:6px">';
        html += '<span style="font-weight:bold;color:#94a3b8">手牌 (' + p.hands.length + '):</span>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="all" style="font-size:0.65em;padding:2px 6px;background:#f97316">全部</button>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="above2" style="font-size:0.65em;padding:2px 6px">≥2 BB</button>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="above30" style="font-size:0.65em;padding:2px 6px">≥30 BB</button>';
        html += '</div>';
        html += '<div class="opp-hand-list" id="' + oppHandFilterId + '" data-opp-idx="' + i + '"></div>';
      }
      html += '<div id="oppStats-' + i + '" style="margin-top:8px"></div>';
      html += '</div></div>';
    });
    Utils.setSafeHTML(list, html);
    // [V7.0.0] 事件委托 — 先解绑旧 handler 防止重复绑定叠加
    if (list._clickHandler) list.removeEventListener('click', list._clickHandler);
    list._clickHandler = function (e) {
      // 1. 别名编辑
      var aliasBtn = e.target.closest('.alias-edit-btn');
      if (aliasBtn) {
        e.stopPropagation();
        var oid = aliasBtn.dataset.oid;
        var cur = aliases[oid] || '';
        var input = prompt('为 ' + oid + ' 设置昵称：', cur);
        if (input === null) return;
        if (input.trim()) { aliases[oid] = input.trim(); }
        else { delete aliases[oid]; }
        Store.opponentAliases.save(aliases);
        self.renderOpponentProfiles();
        return;
      }
      // 2. 查看手局
      var handEditBtn = e.target.closest('[data-hand-edit]');
      if (handEditBtn) {
        e.stopPropagation();
        self.editHandReview(handEditBtn.dataset.handEdit);
        document.querySelector('[data-sub="hand"]').click();
        return;
      }
      // 3. 手牌行展开
      var handRow = e.target.closest('.opp-hand-row');
      if (handRow) {
        e.stopPropagation();
        var hDetail = document.getElementById('oppHandDetail-' + handRow.dataset.oppIdx + '-' + handRow.dataset.handIdx);
        if (hDetail) hDetail.style.display = hDetail.style.display === 'none' ? 'block' : 'none';
        return;
      }
      // 4. 手牌筛选
      var filterBtn = e.target.closest('.opp-filter-btn');
      if (filterBtn) {
        e.stopPropagation();
        var oppIdx = filterBtn.dataset.oppIdx;
        var filter = filterBtn.dataset.filter;
        var container = document.getElementById('oppHandFilter-' + oppIdx);
        if (!container) return;
        container.parentElement.querySelectorAll('.opp-filter-btn').forEach(function (b) { b.style.background = ''; });
        filterBtn.style.background = '#f97316';
        container.querySelectorAll('.opp-filterable').forEach(function (el) {
          if (filter === 'all') { el.style.display = ''; }
          else if (filter === 'above2') { el.style.display = el.classList.contains('above2') ? '' : 'none'; }
          else if (filter === 'above30') { el.style.display = el.classList.contains('above30') ? '' : 'none'; }
        });
        return;
      }
      // 5. 对手展开/收起（仅标题区域，排除 detail 内部点击）
      if (e.target.closest('.opponent-detail')) return;
      var oppRow = e.target.closest('.opponent-row');
      if (oppRow) {
        var idx = oppRow.dataset.oppIdx;
        var detail = document.getElementById('oppDetail-' + idx);
        if (!detail) return;
        var isOpening = detail.style.display === 'none';
        detail.style.display = isOpening ? 'block' : 'none';
        if (isOpening) {
          // 懒渲染：手牌列表（首次展开时构建）
          var handListEl = document.getElementById('oppHandFilter-' + idx);
          if (handListEl && !handListEl.dataset.rendered && stats[idx] && stats[idx].hands && stats[idx].hands.length) {
            handListEl.innerHTML = self._buildOppHandListHtml(stats[idx], idx, sessionsMap);
            handListEl.dataset.rendered = '1';
          }
          // 懒渲染：Opponent Stats（首次展开时计算）
          var oppStatsEl = document.getElementById('oppStats-' + idx);
          if (oppStatsEl && !oppStatsEl.dataset.rendered && stats[idx] && stats[idx].totalHands >= 3 && stats[idx]._handRefs && stats[idx]._handRefs.length >= 3) {
            var oppResult = analyze(stats[idx]._handRefs);
            oppStatsEl.innerHTML = '<details class="stats-details"><summary class="stats-section-title">Opponent Stats</summary></details>';
            var statsContainer = oppStatsEl.querySelector('.stats-details');
            if (statsContainer) renderStatsPanel({ containerEl: statsContainer, es: oppResult.stats, recs: oppResult.recommendations, showExtras: false, showPosition: false });
            oppStatsEl.dataset.rendered = '1';
          }
        }
      }
    };
    list.addEventListener('click', list._clickHandler);
    // [V6.13.0] 排序 + Live 筛选按钮
    self._bindOpponentSortAndFilter(bar, sortBy, sortDir, filterLive);
  },
  _bindOpponentSortAndFilter: function (bar, sortBy, sortDir, filterLive) {
    var self = this;
    var curSortBy = sortBy || 'lastDate';
    var curSortDir = sortDir || 'desc';
    bar.querySelectorAll('.sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = this.dataset.sort;
        var dir = (field === curSortBy && curSortDir === 'desc') ? 'asc' : 'desc';
        self.renderOpponentProfiles(field, dir, filterLive);
      });
    });
    var liveBtn = bar.querySelector('.live-filter-btn');
    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        self.renderOpponentProfiles(curSortBy, curSortDir, !filterLive);
      });
    }
  },
  getHandReviews() { return HandRepo.getAll(); },
  saveHandReviews(r) { HandRepo.saveAll(r); },
  populateHandSessionSelect() {
    const sessions = Utils.sortByDateKey(this.getSessions()), sel = document.getElementById('handSessionSelect');
    sel.innerHTML = '<option value="">-- 不关联 --</option>';
    sessions.forEach((s) => { sel.innerHTML += '<option value="' + s.id + '">' + Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) + ' (' + (s.profit >= 0 ? '+' + Utils.safeFixed(s.profit, 1) : Utils.safeFixed(s.profit, 1)) + 'BB)</option>'; });
  },
  saveHandReview() {
    const sid = document.getElementById('handSessionSelect').value || null,
      desc = document.getElementById('handDesc').value.trim(),
      reflection = document.getElementById('handReflection').value.trim();
    const potType = document.getElementById('handPotType').value, board = document.getElementById('handBoard').value;
    const btns = document.querySelectorAll('#handMistakeGroup .toggle-btn.is-active');
    const mistakes = Array.from(btns).map((b) => b.dataset.mistake);
    const custom = document.getElementById('handMistakeCustom').value.trim();
    if (custom) mistakes.push(custom);
    const mistakeStr = mistakes.join(', ') || '';
    if (!desc && !reflection) { Utils.showToast('请至少填写一项内容'); return; }
    const r = { sessionId: sid || null, date: Utils.getLocalDatetime(), potType, board, desc, mistake: mistakeStr, reflection, pBB: null };
    const reviews = this.getHandReviews();
    if (this.handEditingId) {
      const idx = reviews.findIndex(function (x) { return x.id === this.handEditingId; }.bind(this));
      if (idx !== -1) { r.id = this.handEditingId; reviews[idx] = r; }
      this.handEditingId = null;
      document.getElementById('saveHandBtn').textContent = '💾 保存手局';
      document.getElementById('saveHandBtn').style.background = '';
    } else { r.id = Utils.generateUUID(); reviews.push(r); }
    this.saveHandReviews(reviews);
    document.getElementById('handDesc').value = 'preflop 行动：Hero /[Xx Xx] \nOTF翻牌 牌面：    行动：\nOTT转牌 牌面：    行动：\nOTR河牌 牌面：    行动：';
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
    document.getElementById('handReflection').value = '';
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach((b) => b.classList.remove('is-active'));
    document.getElementById('handMistakeCustom').value = '';
    this.renderHandReviews();
  },
  deleteHandReview(id) { this._confirmDelete(() => this.getHandReviews(), (d) => this.saveHandReviews(d), () => this.renderHandReviews(), 'id', id); },
  editHandReview(id) {
    const reviews = this.getHandReviews();
    const r = reviews.find(function (x) { return x.id === id; });
    if (!r) return;
    this.handEditingId = id;
    document.getElementById('handPotType').value = r.potType || '';
    document.getElementById('handBoard').value = r.board || '';
    document.getElementById('handSessionSelect').value = r.sessionId || '';
    document.getElementById('handDesc').value = r.desc || '';
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
    document.getElementById('handReflection').value = r.reflection || '';
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (b) { b.classList.remove('is-active'); });
    if (r.mistake) {
      const parts = r.mistake.split(', ');
      document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (b) { if (parts.indexOf(b.dataset.mistake) !== -1) b.classList.add('is-active'); });
      const predefined = ['open过宽','OOP defend过宽','4bet逻辑混乱','情绪型raise','错误CB','过多double barrel','river过度call/bluff','下注尺寸过大','下注尺寸过小','没计划三条街','对松弱bluff过多','对激进不够trap','未识别玩家类型','忽略HUD','情绪主导决策','不愿弃牌','想证明自己','追回损失'];
      const customParts = parts.filter(function (p) { return predefined.indexOf(p) === -1; });
      document.getElementById('handMistakeCustom').value = customParts.join(', ');
    }
    document.getElementById('saveHandBtn').textContent = '💾 更新手局';
    document.getElementById('saveHandBtn').style.background = '#0ea5e9';
    window.scrollTo({ top: document.getElementById('saveHandBtn').offsetTop - 100, behavior: 'smooth' });
  },
  handPageSize: 50, handCurrentPage: 1,
  _selectedHandIds: new Set(),
  // [V6.15.1] 手牌筛选状态
  _handPotFilter: 'all',
  _handSessFilter: 'all',
  // [V6.15.1] 切换手牌行展开/折叠
  toggleHandExpand: function (handId, btn) {
    var existingRow = document.getElementById('hand-expand-row-' + handId);
    if (existingRow) { existingRow.remove(); if (btn) btn.textContent = '▶'; return; }
    if (btn) btn.textContent = '▼';
    var reviews = HandRepo.getAll();
    var r = reviews.find(function (x) { return x.id === handId; });
    if (!r) return;
    var tr = document.createElement('tr');
    tr.id = 'hand-expand-row-' + handId;
    var td = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'padding:10px 14px;background:#0a1628;font-size:0.78em;border-top:1px solid #1e3a5f;line-height:1.6';
    var html = '';
    // 手牌详情
    html += '<div style="color:#cbd5e1;white-space:pre-wrap;margin-bottom:6px">' + Utils.escapeHtml(r.desc || '--') + '</div>';
    // 错误 + 反思
    if (r.mistake) html += '<div style="margin-bottom:4px"><span style="color:#94a3b8">错误：</span><span style="color:#f87171">' + Utils.escapeHtml(r.mistake) + '</span></div>';
    if (r.reflection) html += '<div style="margin-bottom:6px"><span style="color:#94a3b8">反思：</span><span style="color:#e2e8f0">' + Utils.escapeHtml(r.reflection) + '</span></div>';
    // 操作按钮
    html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">';
    html += '<button class="btn--mini" data-hand-edit="' + r.id + '">✎ 编辑</button>';
    html += '<button class="btn--mini btn--danger" data-hand-delete="' + r.id + '">✕ 删除</button>';
    var markIcon = r.marked ? '★' : '☆';
    var markColor = r.marked ? '#facc15' : '#64748b';
    html += '<button class="btn--mini hand-mark-btn" data-hand-mark="' + r.id + '" style="color:' + markColor + '">' + markIcon + ' 标记</button>';
    html += '</div>';
    td.innerHTML = html;
    tr.appendChild(td);
    btn.closest('tr').after(tr);
  },
  // [V6.16.0] 行点击选中——批量栏 UI 状态同步
  _updateHandBatchUI() {
    var selCount = Review._selectedHandIds.size;
    var allRows = document.querySelectorAll('#handBody tr[data-hand-id]');
    var totalVisible = allRows.length;
    var batchBar = document.getElementById('handBatchBar');
    var btn = document.getElementById('handSelectAllBtn');
    var countEl = document.getElementById('handBatchCount');
    if (selCount === 0) {
      batchBar.style.display = 'none';
    } else {
      batchBar.style.display = 'flex';
    }
    if (btn) {
      btn.textContent = (selCount === totalVisible && totalVisible > 0) ? 'Deselect All' : 'Select All';
    }
    if (countEl) countEl.textContent = selCount + ' selected';
    allRows.forEach(function (row) {
      if (Review._selectedHandIds.has(row.dataset.handId)) {
        row.classList.add('is-selected');
      } else {
        row.classList.remove('is-selected');
      }
    });
  },
  renderHandReviews() {
    var self = this;
    var pageSize = self.handPageSize; var pageNum = self.handCurrentPage;
    var allReviews = Utils.sortByDateKey(this.getHandReviews());
    // [V6.15.1] 读取筛选器并应用过滤
    var potFilter = document.getElementById('handPotSizeFilter');
    var sessFilter = document.getElementById('handSessFilter');
    if (potFilter) self._handPotFilter = potFilter.value;
    if (sessFilter) self._handSessFilter = sessFilter.value;
    // 更新 session 筛选下拉选项
    if (sessFilter && sessFilter.options.length <= 2) {
      var sessions = this.getSessions();
      sessions.forEach(function (s) {
        if (!sessFilter.querySelector('option[value="' + s.id + '"]')) {
          var opt = document.createElement('option');
          opt.value = s.id; opt.textContent = s.date + ' ' + s.level;
          sessFilter.appendChild(opt);
        }
      });
    }
    // 应用底池筛选
    if (self._handPotFilter === 'above2') {
      allReviews = allReviews.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 2; });
    } else if (self._handPotFilter === 'above30') {
      allReviews = allReviews.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 30; });
    }
    // 应用 Session 筛选
    if (self._handSessFilter === 'unlinked') {
      allReviews = allReviews.filter(function (r) { return !r.sessionId || r.sessionId === ''; });
    } else if (self._handSessFilter && self._handSessFilter !== 'all') {
      allReviews = allReviews.filter(function (r) { return r.sessionId === self._handSessFilter; });
    }
    // 更新筛选计数
    var countEl = document.getElementById('handFilteredCount');
    if (countEl) countEl.textContent = allReviews.length + ' 手';
    var totalPages = Math.ceil(allReviews.length / pageSize) || 1;
    if (pageNum > totalPages) { pageNum = totalPages; self.handCurrentPage = pageNum; }
    var pageReviews = allReviews.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    var sessions = this.getSessions();
    // [V6.9.3] 模板渲染手牌行
    var tmpl = document.getElementById('tmpl-hand-row');
    var body = document.getElementById('handBody');
    var frag = document.createDocumentFragment();
    pageReviews.forEach(function (r) {
      var s = sessions.find(function (x) { return x.id === r.sessionId; });
      var sessionLabel = s ? Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) : '无';
      var sProfit = s ? Utils.safeFixed(s.profit, 1) : '--';
      var typeLabel = r.potType ? r.potType + (r.board ? ' ' + r.board : '') : '--';
      var handHtml, profitHtml;
      var heroM = r.desc ? r.desc.match(/Hero[^\n\[]*\[([^\]]+)\]/) : null;
      if (heroM && heroM[1]) {
        var cards = heroM[1].split(' ');
        var validRe = /^[2-9TJQKA][shdc]$/i;
        var allValid = cards.every(function (c) { return validRe.test(c); });
        if (allValid) {
          handHtml = Utils.renderCardBadges(heroM[1]);
        } else { handHtml = Utils.escapeHtml((r.desc || '').substring(0, 20)) + '…'; }
      } else { handHtml = Utils.escapeHtml((r.desc || '').substring(0, 20)) + '…'; }
      if (r.pBB != null) { profitHtml = Utils.formatProfitHTML(r.pBB); }
      else { profitHtml = '--'; }
      var row = document.importNode(tmpl.content, true).firstElementChild;
      row.querySelector('[data-bind="date"]').textContent = Utils.formatHandDate(r.date);
      row.querySelector('[data-bind="typeLabel"]').textContent = typeLabel;
      row.querySelector('[data-bind="sessionCell"]').innerHTML = sessionLabel + ' (' + (s ? '±' + sProfit : '') + ')';
      row.querySelector('[data-bind="handHtml"]').innerHTML = handHtml;
      row.querySelector('[data-bind="profitHtml"]').innerHTML = profitHtml;
      row.querySelector('[data-bind="mistake"]').textContent = r.mistake || '--';
      row.setAttribute('data-hand-id', r.id);
      row.querySelector('[data-hand-edit]').setAttribute('data-hand-edit', r.id);
      row.querySelector('[data-hand-delete]').setAttribute('data-hand-delete', r.id);
      // [V6.15.1] 展开 / 标记按钮 — 事件由 #handBody 委托统一处理
      var expandBtn = row.querySelector('[data-hand-expand]');
      if (expandBtn) expandBtn.setAttribute('data-hand-expand', r.id);
      var markBtn = row.querySelector('[data-hand-mark]');
      if (markBtn) {
        markBtn.setAttribute('data-hand-mark', r.id);
        markBtn.textContent = r.marked ? '★' : '☆';
        markBtn.style.color = r.marked ? '#facc15' : '#64748b';
      }
      frag.appendChild(row);
    });
    body.replaceChildren(frag);
    self._renderHandPagination(allReviews.length, pageNum, totalPages);
    var batchBar = document.getElementById('handBatchBar');
    var sessSel = document.getElementById('handBatchSessionSelect');
    if (sessSel) {
      sessSel.innerHTML = '<option value="">-- Link to Session --</option>';
      sessions.forEach(function (s) { sessSel.innerHTML += '<option value="' + s.id + '">' + Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) + '</option>'; });
    }
    Review._selectedHandIds.clear(); batchBar.style.display = 'none'; document.getElementById('handBatchCount').textContent = '0 selected';
  },
  _renderHandPagination(total, pageNum, totalPages) {
    var self = this; var bar = document.getElementById('handPagination');
    if (!bar) return;
    if (total <= self.handPageSize) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    var html = '';
    html += '<button' + (pageNum <= 1 ? ' disabled' : '') + ' data-hand-page="1">«</button>';
    html += '<button' + (pageNum <= 1 ? ' disabled' : '') + ' data-hand-page="' + (pageNum - 1) + '">‹</button>';
    html += '<span class="page-num">第 ' + pageNum + '/' + totalPages + ' 页（共 ' + total + ' 条）</span>';
    html += '<button' + (pageNum >= totalPages ? ' disabled' : '') + ' data-hand-page="' + (pageNum + 1) + '">›</button>';
    html += '<button' + (pageNum >= totalPages ? ' disabled' : '') + ' data-hand-page="' + totalPages + '">»</button>';
    bar.innerHTML = html;
    bar.querySelectorAll('button[data-hand-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { self.handCurrentPage = parseInt(this.dataset.handPage); self.renderHandReviews(); document.getElementById('handBody').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
  },
  getWeekStr(d) {
    d = d || new Date();
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff); const m = new Date(d);
    const y = m.getFullYear(), w = Math.ceil(((m - new Date(y, 0, 1)) / 86400000 + 1) / 7);
    return y + '-W' + String(w).padStart(2, '0');
  },
  generateWeeklyStats() {
    const now = new Date(), day = now.getDay(), diff = now.getDate() - day + (day === 0 ? -6 : 1);
    now.setDate(diff); now.setHours(0, 0, 0, 0);
    const m = new Date(now), s = new Date(m);
    s.setDate(m.getDate() + 6); s.setHours(23, 59, 59, 999);
    const sessions = Utils.sortByDateKey(this.getSessions().filter((x) => { const d = new Date(x.date); return d >= m && d <= s; })),
      hrs = this.getHandReviews().filter((x) => { const d = new Date(x.date); return d >= m && d <= s; });
    let tp = 0, th = 0, tt = 0;
    sessions.forEach((x) => { tp += x.profit; th += x.hands; tt += x.tilt; });
    const mm = new Map();
    sessions.forEach((x) => { if (x.mistake !== '无') x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) mm.set(t, (mm.get(t) || 0) + 1); }); });
    hrs.forEach((x) => { if (x.mistake) x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) mm.set(t, (mm.get(t) || 0) + 1); }); });
    const topMistakes = [...mm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0] + '(' + e[1] + '次)').join(', ') || '无';
    const lwEnd = new Date(m); lwEnd.setDate(lwEnd.getDate() - 1); lwEnd.setHours(23, 59, 59, 999);
    const lwStart = new Date(lwEnd); lwStart.setDate(lwStart.getDate() - 6); lwStart.setHours(0, 0, 0, 0);
    const lwSessions = this.getSessions().filter((x) => { const d = new Date(x.date); return d >= lwStart && d <= lwEnd; });
    const lwHands = this.getHandReviews().filter((x) => { const d = new Date(x.date); return d >= lwStart && d <= lwEnd; });
    const lwMm = new Map();
    lwSessions.forEach((x) => { if (x.mistake !== '无') x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) lwMm.set(t, (lwMm.get(t) || 0) + 1); }); });
    lwHands.forEach((x) => { if (x.mistake) x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) lwMm.set(t, (lwMm.get(t) || 0) + 1); }); });
    let trendHtml = '';
    if (lwSessions.length > 0 && mm.size > 0) {
      const trends = [];
      [...mm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach((e) => {
        const lwCount = lwMm.get(e[0]) || 0; const diff = e[1] - lwCount;
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        const color = diff > 0 ? '#f87171' : diff < 0 ? '#4ade80' : '#94a3b8';
        trends.push('<span style="color:' + color + '">' + Utils.escapeHtml(e[0]) + ' ' + arrow + Math.abs(diff) + '</span>');
      });
      trendHtml = trends.length ? '<div style="margin-top:6px;font-size:0.7em;color:#94a3b8;text-align:center;line-height:1.6">📈 vs上周：' + trends.join(' · ') + '</div>' : '';
    }
    const autoSummary = this.generateWeeklySummary(sessions, tp, tt, topMistakes);
    const wBb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A';
    document.getElementById('weeklyAutoStats').innerHTML = '<div class="stats"><div class="stats__item"><div class="stats__label">本周场次</div><div class="stats__value">' + sessions.length + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">本周盈亏</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">总手数</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(wBb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(wBb100) >= 0 ? 'text-win' : 'text-lose') + '">' + wBb100 + '</div></div><div class="stats__item"><div class="stats__label">平均Tilt</div><div class="stats__value">' + (sessions.length ? Utils.safeFixed(tt / sessions.length, 1) : 'N/A') + '</div></div><div class="stats__item"><div class="stats__label">主要错误</div><div class="stats__value" style="font-size:0.8em">' + Utils.escapeHtml(topMistakes) + '</div></div></div>' + trendHtml;
    document.getElementById('weeklySummary').innerHTML = autoSummary ? '<b>🧠 本周总结</b><br>' + autoSummary : '';
    // [V6.18.5] 本周引擎统计
    var wEngineResult = analyze(hrs);
    var wes = document.getElementById('weeklyEngineStats');
    if (wes && wEngineResult.stats.totalHands && wEngineResult.stats.totalHands.value > 0) {
      wes.innerHTML = '<details class="stats-details"><summary class="stats-section-title">Weekly Stats</summary></details>';
      renderStatsPanel({ containerEl: wes.querySelector('.stats-details'), es: wEngineResult.stats, recs: wEngineResult.recommendations, showExtras: false });
      _initStatTooltip('weeklyEngineStats');
    } else if (wes) {
      wes.innerHTML = '';
    }
  },
  generateWeeklySummary(sessions, tp, tt, topMistakes) {
    if (sessions.length === 0) return '';
    const avgTilt = tt / sessions.length;
    let summary = '本周共 ' + sessions.length + ' 场，总盈亏 ' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB。';
    if (avgTilt >= 7) summary += ' 平均情绪评分 ≥ 7，说明本周心态非常冷静，决策质量较高。保持住这个节奏。';
    else if (avgTilt >= 5) summary += ' 平均情绪评分中等，有一些小波动但没有严重失控。注意识别让你情绪波动的具体场景。';
    else summary += ' 平均情绪评分偏低，可能出现了一些情绪失控的瞬间。建议下周重点做情绪急救练习。';
    if (topMistakes !== '无') summary += ' 主要错误集中在「' + topMistakes + '」，建议在下周的实战中刻意关注这些场景。';
    else summary += ' 你还没有记录具体的错误类型。尝试在每场Session后填写错误类型，几周后就能看到自己的主要漏洞了。';
    return summary;
  },
  getWeeklyReviews() { return WeeklyRepo.getAll(); },
  saveWeeklyReviews(r) { WeeklyRepo.saveAll(r); },
  saveWeeklyReview() {
    const week = this.getWeekStr(), weakness = document.getElementById('weeklyWeakness').value.trim(), plan = document.getElementById('weeklyPlan').value.trim();
    if (!weakness && !plan) { Utils.showToast('请至少填写一项'); return; }
    const reviews = this.getWeeklyReviews(), exist = reviews.find((r) => r.week === week);
    if (exist) { exist.weakness = weakness || exist.weakness; exist.plan = plan || exist.plan; }
    else reviews.push({ week, weakness, plan });
    this.saveWeeklyReviews(reviews);
    document.getElementById('weeklyWeakness').value = ''; document.getElementById('weeklyPlan').value = '';
    document.getElementById('saveWeeklyBtn').textContent = '💾 保存本周复盘';
    document.getElementById('saveWeeklyBtn').style.background = '';
    this.renderWeeklyReviews();
  },
  deleteWeeklyReview(week) { this._confirmDelete(() => this.getWeeklyReviews(), (d) => this.saveWeeklyReviews(d), () => this.renderWeeklyReviews(), 'week', week); },
  editWeeklyReview(week) {
    const reviews = this.getWeeklyReviews();
    const r = reviews.find(function (x) { return x.week === week; });
    if (!r) return;
    document.getElementById('weeklyWeakness').value = r.weakness || '';
    document.getElementById('weeklyPlan').value = r.plan || '';
    document.getElementById('saveWeeklyBtn').textContent = '💾 更新本周复盘';
    document.getElementById('saveWeeklyBtn').style.background = '#0ea5e9';
    window.scrollTo({ top: document.getElementById('saveWeeklyBtn').offsetTop - 100, behavior: 'smooth' });
  },
  renderWeeklyReviews() {
    const reviews = Utils.sortByDateKey(this.getWeeklyReviews(), 'week');
    const rows = [];
    reviews.forEach((r) => { rows.push('<tr><td>' + Utils.escapeHtml(r.week) + '</td><td>' + Utils.escapeHtml(r.weakness || '--') + '</td><td>' + Utils.escapeHtml(r.plan || '--') + '</td><td><button class="btn--mini" data-week-edit="' + r.week + '">✎</button> <button class="btn--mini btn--danger" data-week-delete="' + r.week + '">✕</button></td></tr>'); });
    document.getElementById('weeklyBody').innerHTML = rows.join('');
  },
  exportData() {
    const data = Store.exportAll(); const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'poker_backup_' + Utils.getLocalDate() + '.json';
    a.click(); URL.revokeObjectURL(url);
  },
  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imp = JSON.parse(reader.result);
        if (imp.sessions !== undefined) {
          if (confirm('将合并导入数据（不覆盖已有记录），确定继续？')) { Store.importAll(imp); alert('导入成功！页面将刷新。'); location.reload(); }
        } else Utils.showToast('文件格式不正确');
      } catch (ex) { Utils.showToast('解析失败'); }
    };
    reader.readAsText(file);
  },
};
