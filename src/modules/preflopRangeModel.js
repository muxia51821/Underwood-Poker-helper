// [V7.17.0 新增] A partial hand-class chart is not a complete strategy or a solver answer.
import prange from '../vendor/prange.js';

export const RANGE_RANKS = 'AKQJT98765432';
export const RANGE_HANDS = [...RANGE_RANKS].flatMap((a, row) => [...RANGE_RANKS].map((b, col) => row === col ? a + b : row < col ? a + b + 's' : b + a + 'o'));
export const RANGE_ACTIONS = [{ id: 'fold', label: '弃牌', color: '#65717e' }, { id: 'call', label: '跟注', color: '#539e82' },
  { id: 'raise', label: '加注', color: '#c48643' }, { id: 'allin', label: '全下', color: '#bb5966' }];
const ids = RANGE_ACTIONS.map(action => action.id);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const finiteWeight = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function rangeCombos(hand) { return hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12; }
export function newPreflopRange(id, context = {}) {
  return { id, name: '新范围', revision: 0, kind: 'personal', conditions: {
    format: 'cash', tableMax: 9, effectiveStack: 200, heroPosition: '', opponentPosition: '', actionLine: '', rake: '', ante: '',
    ...context }, source: { title: '', url: '', method: '', rights: '' }, hands: [] };
}
export function validatePreflopRange(value) {
  if (!object(value) || typeof value.id !== 'string' || !value.id || ['__proto__', 'constructor', 'prototype'].includes(value.id) || typeof value.name !== 'string' || value.name.length > 200
    || !Number.isInteger(value.revision) || value.revision < 0 || !['personal', 'reference'].includes(value.kind)
    || !object(value.conditions) || !object(value.source) || !Array.isArray(value.hands)) throw new Error('范围记录格式无效。');
  const c = value.conditions;
  if (!['cash', 'mtt', 'unknown'].includes(c.format) || (c.tableMax !== null && (!Number.isInteger(c.tableMax) || c.tableMax < 2 || c.tableMax > 10))
    || (c.effectiveStack !== null && (typeof c.effectiveStack !== 'number' || !Number.isFinite(c.effectiveStack) || c.effectiveStack <= 0))) throw new Error('桌型或有效筹码无效。');
  for (const key of ['heroPosition', 'opponentPosition', 'actionLine', 'rake', 'ante']) if (typeof c[key] !== 'string' || c[key].length > 2000) throw new Error('局面条件无效：' + key);
  for (const key of ['title', 'url', 'method', 'rights']) if (typeof value.source[key] !== 'string' || value.source[key].length > 4000) throw new Error('来源说明无效：' + key);
  const seen = new Set();
  for (const entry of value.hands) {
    if (!object(entry) || !RANGE_HANDS.includes(entry.hand) || seen.has(entry.hand) || !finiteWeight(entry.weight) || !object(entry.frequencies)) throw new Error('存在无效或重复手牌、权重。');
    seen.add(entry.hand);
    if (Object.keys(entry.frequencies).some(key => !ids.includes(key)) || ids.some(key => !finiteWeight(entry.frequencies[key]))) throw new Error(entry.hand + ' 的动作频率无效。');
    const sum = ids.reduce((total, key) => total + entry.frequencies[key], 0);
    if (Math.abs(sum - (entry.weight === 0 ? 0 : 1)) > 0.000001) throw new Error(entry.hand + ' 的动作频率需合计为 100%；范围权重为零时动作均为零。');
  }
  return value;
}
export function rangeSummary(value) {
  const result = { classes: value.hands.length, knownCombos: 0, weightedCombos: 0, actions: Object.fromEntries(ids.map(key => [key, 0])) };
  for (const entry of value.hands) {
    const combos = rangeCombos(entry.hand); result.knownCombos += combos; result.weightedCombos += combos * entry.weight;
    for (const key of ids) result.actions[key] += combos * entry.weight * entry.frequencies[key];
  }
  return result;
}
export function rangeConditionGaps(range) {
  const c = range.conditions;
  return [c.format === 'unknown' && '游戏类型', c.tableMax === null && '桌型', c.effectiveStack === null && '有效筹码', !c.heroPosition && '自身位置',
    !c.actionLine.trim() && '行动与尺寸', !c.rake.trim() && '抽水', !c.ante.trim() && 'Ante / Straddle'].filter(Boolean);
}
export function sameRangeConditions(a, b) {
  return Object.keys(a.conditions).length === Object.keys(b.conditions).length && Object.keys(a.conditions).every(key => a.conditions[key] === b.conditions[key]);
}
export function withRangeHand(range, hand, entry) {
  const value = { ...clone(range), hands: range.hands.filter(item => item.hand !== hand) };
  if (entry) value.hands.push({ ...entry, hand });
  return validatePreflopRange(value);
}
export function parseRangeText(text) {
  if (!text.trim()) throw new Error('请先输入范围，例如 QQ+, AKs, A5s-A2s:0.5。');
  const tokens = text.trim().replace(/\s*-\s*/g, '-').replace(/\s*\+/g, '+').replace(/\s*:\s*/g, ':').split(/[,;\s]+/);
  const entries = [], seen = new Set();
  for (const token of tokens) {
    const parts = token.split(':');
    const notation = parts[0].toUpperCase().replace(/[SO]/g, char => char.toLowerCase());
    if (parts.length > 2 || !/^[AKQJT2-9]{2}[so]?(?:\+|-[AKQJT2-9]{2}[so]?)?$/.test(notation)) throw new Error('不支持的范围写法：' + token);
    const weight = parts.length === 1 ? 1 : /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(parts[1]) ? Number(parts[1]) : NaN;
    if (!finiteWeight(weight)) throw new Error('权重需在 0–1 之间：' + token);
    const ends = notation.replace(/\+$/, '').split('-');
    for (const end of ends) if (RANGE_RANKS.indexOf(end[0]) > RANGE_RANKS.indexOf(end[1]) || end[0] === end[1] && end.length !== 2) throw new Error('手牌需按高牌在前书写：' + token);
    if (ends.length === 2) {
      const [a, b] = ends, first = RANGE_RANKS.indexOf(b[0]) - RANGE_RANKS.indexOf(a[0]), second = RANGE_RANKS.indexOf(b[1]) - RANGE_RANKS.indexOf(a[1]);
      // Signed steps matter: crossing intervals otherwise silently lose both endpoints upstream.
      if (a.slice(2) !== b.slice(2) || first !== 0 && first !== second) throw new Error('区间只支持对子、同首牌或同向等距牌点：' + token);
    }
    // The upstream parser expands a repeated pair interval as suited/offsuit; normalize this one unambiguous case.
    const expanded = ends.length === 2 && ends[0] === ends[1] ? [ends[0]] : prange(notation);
    for (const hand of expanded) {
      if (!RANGE_HANDS.includes(hand) || seen.has(hand)) throw new Error('展开后存在重复或无效手牌：' + hand);
      seen.add(hand); entries.push({ hand, weight });
    }
  }
  return entries;
}
export function rangeTextEntries(text, action) {
  if (!ids.includes(action)) throw new Error('请选择导入动作。');
  return parseRangeText(text).map(entry => ({ ...entry, frequencies: Object.fromEntries(ids.map(key => [key, entry.weight > 0 && key === action ? 1 : 0])) }));
}
export function readRangeFile(input) {
  let value;
  try { value = typeof input === 'string' ? JSON.parse(input.replace(/^\uFEFF/, '')) : clone(input); }
  catch { throw new Error('范围文件不是有效的 JSON。'); }
  if (!object(value) || value.format !== 'poker-preflop-range' || value.version !== 1) throw new Error('暂不支持此范围文件格式。请选择本应用导出的范围，或粘贴范围文本。');
  return clone(validatePreflopRange(value.range));
}
export function rangeFile(range) { return { format: 'poker-preflop-range', version: 1, range: clone(validatePreflopRange(range)) }; }
