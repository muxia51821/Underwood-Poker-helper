import { Utils } from '../utils.js';

const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const finitePBB = hand => typeof hand?.pBB === 'number' && Number.isFinite(hand.pBB);

function renderSessionList(sessions, hands, marks, query) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  const bySession = new Map();
  for (const hand of hands) { const rows = bySession.get(hand.sessionId) || []; rows.push(hand); bySession.set(hand.sessionId, rows); }
  const markedIds = new Set((marks || []).filter(mark => mark.status === 'matched' && mark.matchedHandId).map(mark => mark.matchedHandId));
  const rows = (sessions || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).filter(session => {
    if (!needle) return true;
    return [session.date, session.level, session.remark, session.mistake]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
  }).map(session => {
    const related = bySession.get(session.id) || [];
    const markedCount = related.filter(hand => hand.marked === true || markedIds.has(hand.id)).length;
    const profit = typeof session.profit === 'number' && Number.isFinite(session.profit)
      ? Utils.safeFixed(session.profit, 1)
      : '未记录';
    const currency = session.currency ? ' ' + esc(session.currency) : '';
    return '<button class="session-review-row" data-review-session="' + esc(session.id) + '">' +
      '<span class="session-review-row__title"><strong>' + esc(session.date || '日期未记录') + '</strong><span>' + esc(session.level || '级别未记录') + '</span>' + (session.remark ? '<small>' + esc(session.remark) + '</small>' : '') + '</span>' +
      '<span class="session-review-row__meta"><strong>' + related.length + '</strong> 手牌<span>已标记重点 ' + markedCount + ' 手</span></span>' +
      '<span class="session-review-row__profit">场次记录盈亏<strong>' + profit + currency + '</strong><span>查看整场 →</span></span>' +
      '</button>';
  }).join('');
  return '<section class="session-review session-review--list"><header class="session-review__header"><div><p class="ws-eyebrow">01 / 选择场次</p><h2 tabindex="-1">选择要复盘的场次</h2></div><button class="ws-button" data-analyze-import>导入牌谱</button></header><div class="session-review__toolbar">' +
    '<label class="session-review__search">搜索场次<input type="search" data-review-session-search value="' + esc(query) + '" placeholder="日期、级别或备注" /></label>' +
    '<button class="ws-button" data-review-all-hands>跨场查找手牌</button></div><div class="session-review__list" data-review-session-list>' +
    (rows || '<p class="session-review__empty ws-muted">' + (sessions.length ? '没有符合条件的场次。修改搜索条件，或跨场查找手牌。' : '暂无场次。导入牌谱以创建场次，或跨场查看已有手牌。') + '</p>') + '</div></section>';
}

function renderSessionDetail(session, sessions, hands, marks, closures) {
  const related = (hands || []).filter(hand => hand.sessionId === session.id);
  const relatedIds = new Set(related.map(hand => hand.id));
  const markedIds = new Set((marks || []).filter(mark => mark.status === 'matched' && mark.matchedHandId && relatedIds.has(mark.matchedHandId)).map(mark => mark.matchedHandId));
  related.forEach(hand => { if (hand.marked === true) markedIds.add(hand.id); });
  const markedCount = markedIds.size;
  const reflectionCount = related.filter(hand => Boolean(String(hand.reflection || '').trim())).length;
  const knownProfit = related.filter(finitePBB).reduce((sum, hand) => sum + hand.pBB, 0);
  const knownProfitCount = related.filter(finitePBB).length;
  const ownMarks = (marks || []).filter(mark => !mark.matchedHandId && mark.status !== 'dismissed' && mark.sessionId === session.id);
  const closure = (closures || []).find(item => item.sessionId === session.id);
  const closeoutLabel = closure?.status === 'closed' ? '查看本场收尾' : closure ? '继续本场收尾' : '开始本场收尾';
  const statusText = status => ({ open: '待关联', matched: '已关联' }[status] || (status ? String(status) : '状态未记录'));
  const markHtml = ownMarks.length ? '<section class="session-review__marks"><h3>尚未关联的快记</h3>' + ownMarks.map(mark =>
    '<article class="session-review__mark"><p>' + esc(mark.time || '时间未记录') + ' · ' + esc(statusText(mark.status)) + '</p>' +
    (mark.note ? '<p class="session-review__preserved-text">' + esc(mark.note) + '</p>' : '<p class="ws-muted">没有备注</p>') +
    (mark.mistake ? '<p class="session-review__preserved-text">' + esc(mark.mistake) + '</p>' : '') + '</article>'
  ).join('') + '</section>' : '<section class="session-review__marks"><h3>尚未关联的快记</h3><p class="ws-muted">本场没有未关联的快记。其他快记可在收尾页处理。</p></section>';
  const noHands = related.length === 0;
  const notes = session.remark || session.mistake ? '<details class="ws-concept"><summary>本场备注与记录</summary><p class="session-review__preserved-text">' + esc([session.remark, session.mistake].filter(Boolean).join('\n')) + '</p></details>' : '';
  return '<section class="session-review session-review--detail">' +
    '<nav class="session-review-trail" aria-label="复盘位置"><button class="ws-button" data-review-sessions>返回所有场次</button><span>/ 整场总览</span></nav>' +
    '<header class="session-review__header"><div><p class="ws-eyebrow">02 / 整场总览</p><h2 tabindex="-1">' + esc(session.date || '日期未记录') + '</h2><p class="ws-muted">' + esc(session.level || '级别未记录') + (typeof session.duration === 'number' ? ' · ' + Utils.safeFixed(session.duration, 1) + ' 小时' : '') + '</p></div>' +
    '</header>' +
    '<div class="session-review__metrics"><div><strong>' + related.length + '</strong><span>关联手牌</span></div><div><strong>' + markedCount + '</strong><span>已标记重点</span></div><div><strong>' + reflectionCount + '</strong><span>有复盘笔记</span></div><div><strong>' + (knownProfitCount ? (knownProfit > 0 ? '+' : '') + Utils.safeFixed(knownProfit, 1) : '—') + '</strong><span>手牌盈亏（BB）</span></div></div><p class="ws-muted">有盈亏记录：' + knownProfitCount + ' / ' + related.length + ' 手。场次盈亏另列。</p>' +
    '<div class="session-review__actions"><button class="ws-button" data-review-session-hands="' + esc(session.id) + '">浏览本场手牌</button>' +
    '<button class="ws-button" data-review-closeout="' + esc(session.id) + '">' + closeoutLabel + '</button></div>' +
    (noHands ? '<div class="session-review__empty"><p>本场尚无关联手牌，可以导入牌谱。</p><button class="ws-button" data-analyze-import>导入牌谱</button></div>' : '') +
    '<div class="session-review__workarea"><section><h3>本场手牌</h3><p class="ws-muted">按行动顺序浏览，标记想深入复盘的手牌。</p><div data-session-hand-browser></div></section><aside>' + markHtml + notes + '</aside></div></section>';
}

export function renderSessionReview({ sessions = [], hands = [], marks = [], closures = [], sessionId = '', query = '' } = {}) {
  if (!sessionId) return renderSessionList(sessions, hands, marks, query);
  const session = sessions.find(item => item.id === sessionId);
  if (!session) {
    return '<section class="session-review session-review--missing"><button class="ws-button" data-review-sessions>返回所有场次</button><p class="ws-muted">找不到这场场次。</p></section>';
  }
  return renderSessionDetail(session, sessions, hands, marks, closures);
}
