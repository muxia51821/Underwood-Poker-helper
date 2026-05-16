// [V6.15.0 新增] 手牌精选模块 — 管理标记手牌（Picks）的展示与操作
// [V6.16.0 修改] 移入 Hand 面板内，支持点击跳转手牌/Session
import { HandRepo, SessionRepo } from '../store/store.js';
import { Utils } from '../utils.js';
import { Review } from './review.js';  // [V6.16.0] 用于跳转导航

export const HandPicker = {
  init: function () {
    var self = this;
    document.getElementById('picksBody').addEventListener('click', function (e) {
      // 取消标记按钮
      var unmarkBtn = e.target.closest('[data-pick-unmark]');
      if (unmarkBtn) {
        e.stopPropagation();
        var id = unmarkBtn.getAttribute('data-pick-unmark');
        self.unmark(id);
        return;
      }
      // [V6.16.0] 点击手牌行 → 跳转到 Hand History 中展开
      var handNav = e.target.closest('[data-hand-nav]');
      if (handNav) {
        var handId = handNav.getAttribute('data-hand-nav');
        _navigateToHand(handId);
        return;
      }
      // [V6.16.0] 点击 Session 列 → 跳转到 Session 并展开
      var sessNav = e.target.closest('[data-sess-nav]');
      if (sessNav) {
        var sessId = sessNav.getAttribute('data-sess-nav');
        _navigateToSession(sessId);
        return;
      }
    });
  },

  getMarkedHands: function () {
    return HandRepo.getAll().filter(function (r) { return r.marked === true; });
  },

  render: function () {
    var marked = this.getMarkedHands();
    var card = document.getElementById('picksCard');
    var body = document.getElementById('picksBody');
    var countEl = document.getElementById('picksCount');
    // 无精选时隐藏整个卡片
    if (!marked.length) {
      if (card) card.style.display = 'none';
      if (body) body.replaceChildren();
      return;
    }
    if (card) card.style.display = '';
    if (countEl) countEl.textContent = '共 ' + marked.length + ' 手精选';
    // 按日期排序
    marked.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var sessions = SessionRepo.getAll();
    var frag = document.createDocumentFragment();
    marked.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-hand-nav', r.id);
      tr.style.cursor = 'pointer';
      tr.title = '点击跳转到手牌详情';
      // 日期
      var tdDate = document.createElement('td');
      tdDate.textContent = Utils.formatHandDate ? Utils.formatHandDate(r.date) : (r.date || '--');
      tdDate.style.cssText = 'font-size:0.75em;white-space:nowrap';
      tr.appendChild(tdDate);
      // Session（可点击跳转）
      var tdSess = document.createElement('td');
      var sess = sessions.find(function (s) { return s.id === r.sessionId; });
      if (sess) {
        tdSess.setAttribute('data-sess-nav', sess.id);
        tdSess.style.cursor = 'pointer';
        tdSess.title = '点击跳转到 Session';
        tdSess.innerHTML = '<span style="color:#5a9e8f;text-decoration:underline;text-underline-offset:2px">' + Utils.escapeHtml(sess.date) + ' ' + Utils.escapeHtml(sess.level) + '</span>';
      } else {
        tdSess.textContent = '未分类';
      }
      tdSess.style.cssText = 'font-size:0.75em;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis';
      tr.appendChild(tdSess);
      // 底牌
      var tdHand = document.createElement('td');
      tdHand.style.cssText = 'font-size:0.75em';
      tdHand.innerHTML = _renderCardsHtml(r);
      tr.appendChild(tdHand);
      // 盈亏
      var tdProfit = document.createElement('td');
      var pbb = r.pBB != null ? r.pBB : 0;
      tdProfit.textContent = (pbb >= 0 ? '+' : '') + Utils.safeFixed(pbb, 1) + ' BB';
      tdProfit.style.cssText = 'font-size:0.75em;font-weight:bold;color:' + (pbb >= 0 ? '#6baf7e' : '#c06060');
      tr.appendChild(tdProfit);
      // 错误
      var tdMistake = document.createElement('td');
      tdMistake.textContent = r.mistake || '--';
      tdMistake.style.cssText = 'font-size:0.7em;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      tr.appendChild(tdMistake);
      // 操作
      var tdOps = document.createElement('td');
      var unmarkBtn = document.createElement('button');
      unmarkBtn.className = 'btn--mini';
      unmarkBtn.setAttribute('data-pick-unmark', r.id);
      unmarkBtn.textContent = '★';
      unmarkBtn.style.cssText = 'color:#d4a853;font-size:0.85em';
      unmarkBtn.title = '取消标记';
      tdOps.appendChild(unmarkBtn);
      tr.appendChild(tdOps);
      frag.appendChild(tr);
    });
    body.replaceChildren(frag);
  },

  unmark: function (id) {
    var reviews = HandRepo.getAll();
    var found = false;
    reviews.forEach(function (r) {
      if (r.id === id) { r.marked = false; found = true; }
    });
    if (found) {
      HandRepo.saveAll(reviews);
      this.render();
      // [V6.16.0] 同步刷新 Hand History 中的标记按钮状态
      Review.renderHandReviews();
    }
  },
};

// [V6.16.5] 点击手牌 → 跳转到 Hand History 并展开 + 自动编辑
function _navigateToHand(handId) {
  var handTab = document.querySelector('[data-sub="hand"]');
  if (handTab) handTab.click();
  // 展开 Hand History
  var details = document.getElementById('handHistoryDetails');
  if (details) details.open = true;
  var allReviews = Utils.sortByDateKey(Review.getHandReviews());
  var idx = -1;
  for (var i = 0; i < allReviews.length; i++) {
    if (allReviews[i].id === handId) { idx = i; break; }
  }
  if (idx >= 0) {
    var pageNum = Math.floor(idx / Review.handPageSize) + 1;
    Review.handCurrentPage = pageNum;
    Review.renderHandReviews();
    setTimeout(function () {
      var expandBtn = document.querySelector('[data-hand-expand="' + handId + '"]');
      if (expandBtn) Review.toggleHandExpand(handId, expandBtn);
      var row = document.querySelector('[data-hand-id="' + handId + '"]');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // [V6.16.5] 自动触发编辑，填充表单显示 hand notes
      Review.editHandReview(handId);
    }, 150);
  }
}

// [V6.16.5] 点击 Session → 跳转到 Session 子 Tab 并展开 + 统计面板过滤到该 Session
function _navigateToSession(sessId) {
  var sessTab = document.querySelector('[data-sub="session"]');
  if (sessTab) sessTab.click();
  setTimeout(function () {
    var expandBtn = document.querySelector('[data-expand-id="' + sessId + '"]');
    if (expandBtn) Review.toggleSessionExpand(sessId, expandBtn);
    var row = document.querySelector('[data-expand-id="' + sessId + '"]');
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // [V6.16.5] 过滤统计面板只显示该 Session 数据
    Review.updateStatsForSession(sessId);
  }, 150);
}

// 从 desc 解析 Hero 底牌并渲染花色徽章
function _renderCardsHtml(r) {
  var desc = r.desc || '';
  var match = desc.match(/Hero[^\n\[]*\[([^\]]+)\]/);
  if (!match) return '--';
  var cards = match[1].split(' ');
  var html = Utils.renderCardBadges(match[1], { style: 'margin-right:2px' });
  if (r.oCards) {
    html += ' <span style="color:#a8afba;font-size:0.7em">vs ' + Utils.escapeHtml(r.oCards) + '</span>';
  }
  return html;
}
