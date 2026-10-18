import { Utils } from '../utils.js';

const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const finitePBB = hand => typeof hand?.pBB === 'number' && Number.isFinite(hand.pBB);
const hasText = value => String(value ?? '').trim().length > 0;
const SUMMARY_LIMIT = 96;

function renderSummary(label, value, id) {
  if (!hasText(value)) return '';
  const full = String(value);
  const summary = full.length > SUMMARY_LIMIT ? full.slice(0, SUMMARY_LIMIT) + '…' : full;
  return '<details class="session-hand-row__detail"><summary>' + esc(label) + '：' + esc(summary) + '</summary>' +
    '<p class="session-hand-row__full-text" id="' + esc(id) + '">' + esc(full) + '</p></details>';
}

function renderControls(filter) {
  return '<div class="session-hand-browser__toolbar">' +
    '<label class="session-hand-browser__query">搜索手牌<input type="search" data-session-pick-filter="query" value="' + esc(filter.query) + '" placeholder="手牌编号、日期、底牌、牌面或复盘文字" /></label>' +
    '<label class="session-hand-browser__scope">筛选<select data-session-pick-filter="scope">' +
    ['all', 'marked', 'matched', 'mistake'].map(value => '<option value="' + value + '"' + (filter.scope === value ? ' selected' : '') + '>' +
      ({ all: '全部手牌', marked: '已标记重点', matched: '已有快记关联', mistake: '有错误记录' }[value]) + '</option>').join('') + '</select></label>' +
    '<label class="session-hand-browser__sort">排序<select data-session-pick-filter="sort">' +
    ['time', 'loss', 'swing'].map(value => '<option value="' + value + '"' + (filter.sort === value ? ' selected' : '') + '>' +
      ({ time: '日期从早到晚', loss: '盈亏从低到高', swing: '盈亏幅度从大到小' }[value]) + '</option>').join('') + '</select></label>' +
    '</div>';
}

function renderHand(hand, matchedIds) {
  const marked = Boolean(hand.marked);
  const matched = matchedIds.has(hand.id);
  const cardBadges = Utils.renderCardBadges(String(hand.heroCards || ''), {});
  const boardBadges = Utils.renderCardBadges(String(hand.boardCode || ''), {});
  const profit = finitePBB(hand)
    ? '<span class="session-hand-row__profit">' + (hand.pBB > 0 ? '+' : '') + Utils.safeFixed(hand.pBB, 1) + ' BB</span>'
    : '<span class="session-hand-row__profit">盈亏未知</span>';
  return '<article class="session-hand-row" role="listitem" data-session-hand-row="' + esc(hand.id) + '">' +
    '<div class="session-hand-row__identity"><time>' + esc(hand.date || '日期未记录') + '</time><span>' + esc(hand.ggId || hand.id || 'ID 未记录') + '</span></div>' +
    '<div class="session-hand-row__facts"><span class="session-hand-row__hero">你的底牌 ' + (cardBadges || esc(hand.heroCards || '底牌未记录')) + '</span>' +
    '<span class="session-hand-row__position">' + esc(hand.heroPosition || '位置未记录') + '</span>' +
    '<span class="session-hand-row__board">' + (boardBadges || esc(hand.boardCode || '公共牌未记录')) + '</span>' +
    '<span class="session-hand-row__scenario">' + esc(hand.preflopScenario || '翻前场景未记录') + '</span>' + profit +
    '</div><div class="session-hand-row__summaries">' + renderSummary('错误记录', hand.mistake, 'session-hand-mistake-' + hand.id) +
    renderSummary('复盘反思', hand.reflection, 'session-hand-reflection-' + hand.id) + '</div>' +
    '<div class="session-hand-row__signals">' + (marked ? '<span class="session-hand-row__marked">已标记重点</span>' : '') +
    (matched ? '<span class="session-hand-row__matched">快记已关联</span>' : '') + '</div>' +
    '<div class="session-hand-row__actions"><button type="button" class="ws-button" data-session-pick-toggle="' + esc(hand.id) + '" aria-pressed="' + String(marked) + '">' +
    (marked ? '已标记' : '标记重点') + '</button><button type="button" class="ws-button" data-review-hand="' + esc(hand.id) + '">深入复盘</button></div></article>';
}

export function renderSessionHandBrowser({ hands = [], marks = [], filter = { query: '', scope: 'all', sort: 'time' }, page = 1, pageSize = 25 } = {}) {
  const safeFilter = {
    query: String(filter?.query ?? ''),
    scope: ['all', 'marked', 'matched', 'mistake'].includes(filter?.scope) ? filter.scope : 'all',
    sort: ['time', 'loss', 'swing'].includes(filter?.sort) ? filter.sort : 'time',
  };
  const query = safeFilter.query.trim().toLocaleLowerCase();
  const matchedIds = new Set((marks || []).filter(mark => mark.status === 'matched' && mark.matchedHandId).map(mark => mark.matchedHandId));
  const indexed = (hands || []).map((hand, index) => ({ hand, index })).filter(({ hand }) => {
    if (safeFilter.scope === 'marked' && hand.marked !== true) return false;
    if (safeFilter.scope === 'matched' && !matchedIds.has(hand.id)) return false;
    if (safeFilter.scope === 'mistake' && !hasText(hand.mistake)) return false;
    if (!query) return true;
    return [hand.id, hand.ggId, hand.date, hand.heroCards, hand.boardCode, hand.reflection, hand.mistake, hand.preflopScenario]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query));
  });
  const dateValue = hand => String(hand.date || '');
  indexed.sort((left, right) => {
    const a = left.hand; const b = right.hand;
    if (safeFilter.sort === 'loss') {
      const aKnown = finitePBB(a); const bKnown = finitePBB(b);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      if (aKnown && a.pBB !== b.pBB) return a.pBB - b.pBB;
    } else if (safeFilter.sort === 'swing') {
      const aKnown = finitePBB(a); const bKnown = finitePBB(b);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      if (aKnown && Math.abs(a.pBB) !== Math.abs(b.pBB)) return Math.abs(b.pBB) - Math.abs(a.pBB);
    } else {
      const aDate = dateValue(a); const bDate = dateValue(b);
      if (aDate !== bDate) {
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      }
    }
    return left.index - right.index;
  });

  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25;
  const pageCount = Math.max(1, Math.ceil(indexed.length / size));
  const currentPage = Math.min(pageCount, Math.max(1, Number.isInteger(page) ? page : 1));
  const start = (currentPage - 1) * size;
  const visible = indexed.slice(start, start + size);
  const first = indexed.length ? start + 1 : 0;
  const last = start + visible.length;
  const count = '<p class="session-hand-browser__count" data-session-pick-count role="status">' +
    (indexed.length ? '显示第 ' + first + '–' + last + ' 手，共 ' + indexed.length + ' 手' : '当前条件下没有手牌') + '</p>';
  const empty = '<div class="session-hand-browser__empty"><p>没有符合当前条件的手牌。可以清除筛选后重新挑选。</p><button type="button" class="ws-button" data-session-pick-reset>清除挑牌筛选</button></div>';
  const rows = visible.map(({ hand }) => renderHand(hand, matchedIds)).join('');
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(pageCount, currentPage + 1);
  const pagination = indexed.length > size ? '<nav class="session-hand-browser__pagination" aria-label="手牌分页">' +
    '<button type="button" class="ws-button" data-session-pick-page="' + previousPage + '"' + (currentPage === 1 ? ' disabled' : '') + '>上一页</button>' +
    '<span>第 ' + currentPage + ' / ' + pageCount + ' 页</span>' +
    '<button type="button" class="ws-button" data-session-pick-page="' + nextPage + '"' + (currentPage === pageCount ? ' disabled' : '') + '>下一页</button></nav>' : '';

  return '<section class="session-hand-browser">' + renderControls(safeFilter) +
    '<div class="session-hand-browser__results" data-session-pick-results>' + count +
    (rows ? '<div class="session-hand-browser__list" role="list">' + rows + '</div>' : empty) + pagination + '</div></section>';
}
