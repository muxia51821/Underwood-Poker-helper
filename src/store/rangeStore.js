// [V7.17.0 新增] Persist both committed charts and unfinished editor text without treating either as solver data.
import { validatePreflopRange, RANGE_HANDS, RANGE_ACTIONS } from '../modules/preflopRangeModel.js';
export const RANGE_LIBRARY_KEY = 'pa_ranges_v1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
export function emptyRangeState() { return { version: 1, ranges: [], drafts: {}, editors: {}, selectedId: null }; }
export function validateRangeState(state) {
  if (!object(state) || state.version !== 1 || !Array.isArray(state.ranges) || !object(state.drafts) || !object(state.editors)) throw new Error('范围库格式无效。');
  const ids = new Set();
  for (const range of state.ranges) { validatePreflopRange(range); if (ids.has(range.id)) throw new Error('范围编号重复。'); ids.add(range.id); }
  for (const [id, range] of Object.entries(state.drafts)) { validatePreflopRange(range); if (range.id !== id || range.kind !== 'personal' || state.ranges.some(item => item.id === id && item.kind === 'reference')) throw new Error('范围草稿无效。'); ids.add(id); }
  for (const [id, editor] of Object.entries(state.editors)) {
    if (!ids.has(id) || !object(editor) || !object(editor.values) || !RANGE_HANDS.includes(editor.hand)) throw new Error('范围编辑位置无效。');
    if (editor.text !== undefined && (typeof editor.text !== 'string' || editor.text.length > 100000)
      || editor.action !== undefined && !RANGE_ACTIONS.some(action => action.id === editor.action)) throw new Error('批量范围输入无效。');
    for (const [hand, values] of Object.entries(editor.values)) if (!RANGE_HANDS.includes(hand) || !object(values)
      || Object.keys(values).some(key => !['weight', ...RANGE_ACTIONS.map(action => action.id)].includes(key))
      || Object.values(values).some(value => typeof value !== 'string' || value.length > 100)) throw new Error('范围输入草稿无效。');
  }
  if (state.selectedId !== null && !ids.has(state.selectedId)) throw new Error('所选范围不存在。');
  return state;
}
export function mergeRangeStates(preferred, addition) {
  validateRangeState(preferred); validateRangeState(addition);
  const ids = new Set([...preferred.ranges.map(range => range.id), ...Object.keys(preferred.drafts)]);
  const result = clone(preferred);
  result.ranges.push(...clone(addition.ranges.filter(range => !ids.has(range.id))));
  for (const id of new Set([...addition.ranges.map(range => range.id), ...Object.keys(addition.drafts)])) if (!ids.has(id)) {
    if (Object.hasOwn(addition.drafts, id)) result.drafts[id] = clone(addition.drafts[id]);
    if (Object.hasOwn(addition.editors, id)) result.editors[id] = clone(addition.editors[id]);
  }
  return validateRangeState(result);
}
export function createRangeStore(storage = globalThis.localStorage) {
  let baseline;
  return {
    read() { baseline = storage.getItem(RANGE_LIBRARY_KEY); return baseline === null ? emptyRangeState() : clone(validateRangeState(JSON.parse(baseline))); },
    write(state) {
      validateRangeState(state);
      if (storage.getItem(RANGE_LIBRARY_KEY) !== baseline) throw new Error('范围库已在其他页面变化，请重新打开翻前范围后再编辑。');
      const raw = JSON.stringify(state); storage.setItem(RANGE_LIBRARY_KEY, raw);
      if (storage.getItem(RANGE_LIBRARY_KEY) !== raw) throw new Error('范围尚未可靠保存，请导出当前草稿。');
      baseline = raw;
    }
  };
}
