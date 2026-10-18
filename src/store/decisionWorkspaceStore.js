// [V7.15.0 新增] Navigation and unsaved decision drafts are local; hand facts stay in HandRepo.
import { postflopReview } from '../modules/postflopReviewModel.js'; // [V7.19.0 新增]
import { validateCourseLibrary } from '../modules/postflopCourseModel.js';
export const WORKBENCH_KEY = 'pa_decision_workspace_v1';
const fresh = () => ({ version: 1, selectedId: '', attached: false, filters: {}, positions: {}, drafts: {} });
export function validateDecisionReference(value) {
  const object = item => item && typeof item === 'object' && !Array.isArray(item);
  if (!object(value) || typeof value.handId !== 'string' || typeof value.revision !== 'string' || !['preflop', 'flop', 'turn', 'river', 'result'].includes(value.street)
    || (value.actionIndex !== null && (!Number.isInteger(value.actionIndex) || value.actionIndex < 0))
    || !Array.isArray(value.board) || value.board.some(card => typeof card !== 'string')
    || !Array.isArray(value.prefix) || value.prefix.some(street => !object(street) || !Array.isArray(street.actions) || street.actions.some(action => typeof action !== 'string')))
    throw new Error('练习的来源决策快照无效。');
  return value;
}
export function validateWorkbenchState(value) {
  const object = item => item && typeof item === 'object' && !Array.isArray(item);
  if (!object(value) || value.version !== 1 || typeof value.selectedId !== 'string' || typeof value.attached !== 'boolean'
    || !object(value.filters) || !object(value.positions) || !object(value.drafts)) throw new Error('决策工作区记录无效，请保留备份后重试。');
  if (Object.values(value.filters).some(field => typeof field !== 'string')) throw new Error('手牌筛选记录无效。');
  for (const position of Object.values(value.positions)) {
    if (!object(position) || !['preflop', 'flop', 'turn', 'river', 'result'].includes(position.street)
      || (position.actionIndex !== null && (!Number.isInteger(position.actionIndex) || position.actionIndex < 0))) throw new Error('决策位置记录无效。');
    if (position.decisionKind !== undefined && !['', 'initiative', 'facingBet'].includes(position.decisionKind)) throw new Error('决策类型记录无效。');
  }
  if (value.turnRiverCourses !== undefined) validateCourseLibrary(value.turnRiverCourses);
  for (const draft of Object.values(value.drafts)) {
    if (!object(draft) || ['question', 'reason', 'insight', 'reflection'].some(key => draft[key] !== undefined && typeof draft[key] !== 'string')) throw new Error('决策草稿记录无效。');
    if (draft.reflectionDirty !== undefined && typeof draft.reflectionDirty !== 'boolean') throw new Error('整手反思的草稿状态无效。');
    postflopReview(draft);
    if (draft.references !== undefined && (!Array.isArray(draft.references) || draft.references.some(ref => !object(ref) || typeof ref.topicId !== 'string' || typeof ref.title !== 'string' || !Array.isArray(ref.sources)
      || ref.sources.some(source => !object(source) || typeof source.title !== 'string' || (source.url !== undefined && typeof source.url !== 'string'))))) throw new Error('决策学习来源记录无效。');
  }
  return value;
}
export const DecisionWorkspaceStore = {
  read() {
    const raw = localStorage.getItem(WORKBENCH_KEY);
    if (raw === null) return fresh();
    try { return validateWorkbenchState(JSON.parse(raw)); } catch { throw new Error('决策位置或草稿无法读取，请先下载备份，勿清空浏览器数据。'); }
  },
  change(transform) {
    const next = validateWorkbenchState(transform(this.read()));
    const raw = JSON.stringify(next), before = localStorage.getItem(WORKBENCH_KEY);
    try { localStorage.setItem(WORKBENCH_KEY, raw); if (localStorage.getItem(WORKBENCH_KEY) !== raw) throw new Error('读回失败'); }
    catch { try { if (before === null) localStorage.removeItem(WORKBENCH_KEY); else localStorage.setItem(WORKBENCH_KEY, before); } catch { /* Preserve the visible draft and report failure. */ } throw new Error('决策草稿尚未保存，请保留当前输入并下载备份，释放空间后重试。'); }
    return next;
  },
};
