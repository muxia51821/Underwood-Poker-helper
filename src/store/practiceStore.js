// [V7.14.0 新增] One versioned local record; failed writes retain the previous saved session.
import { WORKBENCH_KEY, validateWorkbenchState, validateDecisionReference } from './decisionWorkspaceStore.js';
import { resolveSolutionQuestion, evaluateSolutionAnswer } from '../modules/solutionPackModel.js'; // [V7.18.0 新增]
import { decodePracticeRecord, encodePracticeRecord, immutableSolutionSnapshot } from './practiceSnapshotCodec.js';
import { postflopReview, postflopFacts } from '../modules/postflopReviewModel.js'; // [V7.19.0 新增]
import { validateSolutionLine } from '../modules/solutionLineModel.js';
import { mergeCourseLibraries } from '../modules/postflopCourseModel.js';
export const PRACTICE_KEY = 'pa_practice_v1';
export const LEARNING_KEYS = [PRACTICE_KEY, WORKBENCH_KEY, 'pa_quizState', 'pa_quiz_errors', 'pa_quiz_mastery',
  'pa_concept_quiz_mastery', 'pa_concept_quiz_errors', 'pa_discoverState', 'pa_colorScheme'];
const empty = () => ({ version: 1, presets: [], sessions: [], activeId: null });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validateResponse(question, response, solutionSnapshot) {
  const fail = () => { throw new Error('练习回答不完整或不属于本轮题目。'); };
  if (!question || !record(response) || typeof response.submitted !== 'boolean') fail();
  for (const key of ['choice', 'reason', 'rangeHypothesis', 'nextStreetPlan']) if (response[key] !== undefined && typeof response[key] !== 'string') fail();
  if (response.frequencies !== undefined && (!record(response.frequencies) || Object.values(response.frequencies).some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v))))) fail();
  if (!response.submitted) return;
  const e = response.evaluation;
  if (!record(e) || e.scoringVersion !== question.scoringVersion || typeof response.submittedAt !== 'string' || typeof response.review !== 'boolean') fail();
  if (question.type !== 'range') {
    if (!question.choices.includes(response.choice)) fail();
    if (question.type === 'concept' && (e.kind !== 'concept' || typeof e.correct !== 'boolean')) fail();
    if (question.type === 'personal' && (e.kind !== 'reflection' || !response.reason?.trim())) fail();
    if (question.type === 'solution') {
      const expected = evaluateSolutionAnswer(solutionSnapshot, question, response.choice);
      if (Object.keys(expected).some(key => e[key] !== expected[key])) fail();
    }
  } else {
    const keys = question.detail === 'sizes' ? ['bet75', 'bet50', 'bet33', 'check'] : ['bet', 'check'];
    if (question.input === 'tendency') {
      if (!keys.includes(response.choice) || e.kind !== 'reference' || !Number.isFinite(e.chosenFrequency)) fail();
    } else if (e.kind !== 'distribution' || !record(e.differences) || !record(response.frequencies)
      || keys.some(key => !Number.isFinite(e.differences[key]) || !Number.isFinite(response.frequencies[key]) || response.frequencies[key] < 0 || response.frequencies[key] > 100)
      || Math.abs(keys.reduce((sum, key) => sum + response.frequencies[key], 0) - 100) > 0.1) fail();
  }
}
export function validatePracticeState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.presets) || !Array.isArray(state.sessions)) throw new Error('练习记录格式不受支持，原数据未覆盖。');
  for (const key of ['presets', 'sessions']) {
    const ids = new Set();
    for (const item of state[key]) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !item.config || !['concept', 'range', 'personal', 'solution'].includes(item.config.type)) throw new Error('练习记录包含无效或重复标识。');
      ids.add(item.id);
      if (item.config.sourceDecision != null) validateDecisionReference(item.config.sourceDecision);
      if (key === 'presets' && typeof item.name !== 'string') throw new Error('专项名称缺失。');
      if (key === 'sessions') {
        if (item.config.type === 'solution') {
          immutableSolutionSnapshot(item.solutionSnapshot);
          if (item.config.solutionPackId !== item.solutionSnapshot.id) throw new Error('练习答案包关联无效。');
        }
        if (!Array.isArray(item.questions) || !item.questions.length || !item.responses || typeof item.responses !== 'object'
          || Array.isArray(item.responses) || typeof item.startedAt !== 'string'
          || !Number.isInteger(item.index) || item.index < 0 || item.index >= item.questions.length
          || !['active', 'completed', 'stopped'].includes(item.status)) throw new Error('练习会话不完整。');
        const questionIds = new Set();
        for (const q of item.questions) {
          if (!q || typeof q.id !== 'string' || questionIds.has(q.id) || q.type !== item.config.type || typeof q.prompt !== 'string'
            || typeof q.scoringVersion !== 'string' || !record(q.context)) throw new Error('练习题目快照不完整。');
          if (['board', 'heroCards'].some(key => q.context[key] !== undefined && (!Array.isArray(q.context[key]) || q.context[key].some(card => typeof card !== 'string')))
            || (q.context.prefix !== undefined && (!Array.isArray(q.context.prefix) || q.context.prefix.some(street => !street || !Array.isArray(street.actions) || street.actions.some(action => typeof action !== 'string'))))) throw new Error('练习局面快照无效。');
          questionIds.add(q.id);
          if (q.type === 'solution') {
            const { node, combo } = resolveSolutionQuestion(item.solutionSnapshot,q);
            const c = q.context;
            const board=node.board||item.solutionSnapshot.conditions.board;
            if (q.scoringVersion !== 'solution-ev-v1' || (!['line','replay'].includes(item.config.solutionMode)&&q.solution.nodePath !== item.config.solutionNodePath)
              || c.street !== (board.length===4?'turn':'river')
              || (item.solutionSnapshot.conditions.futureCards && c.continuation !== item.solutionSnapshot.conditions.continuation)
              || JSON.stringify(c.board) !== JSON.stringify(board) || c.heroCards?.join('') !== combo.cards
              || JSON.stringify(c.ranges) !== JSON.stringify(item.solutionSnapshot.conditions.ranges) || c.pot !== node.potBb
              || JSON.stringify(c.stacksBb) !== JSON.stringify(node.stacksBb) || c.actionPath !== node.path) throw new Error('求解题目与冻结局面不一致。');
          }
          if (q.type === 'range' && (!q.reference || !['tendency', 'frequency'].includes(q.input) || !['simple', 'sizes'].includes(q.detail)
            || ['bet75', 'bet50', 'bet33', 'check'].some(k => !Number.isFinite(q.reference[k]) || q.reference[k] < 0 || q.reference[k] > 100))) throw new Error('参考频率无效。');
          if (q.type !== 'range' && (!Array.isArray(q.choices) || !q.choices.length)) throw new Error('题目选项缺失。');
          if (q.type === 'concept' && !q.choices.includes(q.expected)) throw new Error('概念答案缺失。');
          if (q.type === 'personal' && (!q.reveal || typeof q.reveal.playedAction !== 'string' || !Array.isArray(q.reveal.board))) throw new Error('个人复盘快照缺失。');
          if (q.type === 'personal') {
            if (q.reveal.review !== undefined) {
              if (!record(q.reveal.review) || ['question', 'reason', 'insight'].some(key => q.reveal.review[key] !== undefined && typeof q.reveal.review[key] !== 'string')) throw new Error('决策卡快照无效。');
              postflopReview(q.reveal.review, true);
              const facts = postflopFacts(q.reveal.review);
              if (Object.keys(facts).some(key => q.context[key] !== facts[key])) throw new Error('局面条件与冻结决策卡不一致。');
            }
            if (q.reveal.laterActions !== undefined && (!Array.isArray(q.reveal.laterActions) || q.reveal.laterActions.some(action => typeof action !== 'string'))) throw new Error('个人后续行动快照无效。');
            if (q.reveal.continuation !== undefined && (!Array.isArray(q.reveal.continuation) || q.reveal.continuation.some(street => !street || typeof street.street !== 'string' || !Array.isArray(street.actions) || street.actions.some(action => typeof action !== 'string')))) throw new Error('个人后续行动快照无效。');
          }
        }
        for (const [id, response] of Object.entries(item.responses)) validateResponse(item.questions.find(q => q.id === id), response, item.solutionSnapshot);
        if(item.config.solutionMode==='line')validateSolutionLine(item);
      }
    }
  }
  const active = state.sessions.filter(session => session.status === 'active');
  if (active.length > 1 || (state.activeId ? active.length !== 1 || active[0].id !== state.activeId : active.length !== 0)) throw new Error('未完成练习的关联无效。');
  return state;
}
export function createPracticeStore(storage = globalThis.localStorage) {
  return {
    load() {
      const raw = storage.getItem(PRACTICE_KEY);
      if (raw === null) return empty();
      let state;
      try { state = JSON.parse(raw); } catch { throw new Error('本地练习记录无法读取，请先导出备份，勿清空浏览器数据。'); }
      return validatePracticeState(decodePracticeRecord(state));
    },
    save(state) {
      validatePracticeState(state);
      const raw = JSON.stringify(encodePracticeRecord(state));
      const previous = storage.getItem(PRACTICE_KEY);
      try {
        storage.setItem(PRACTICE_KEY, raw);
        if (storage.getItem(PRACTICE_KEY) !== raw) throw new Error('读回不一致');
      } catch (error) {
        try { if (previous === null) storage.removeItem(PRACTICE_KEY); else storage.setItem(PRACTICE_KEY, previous); } catch { /* The original serialized value remains available to the caller's backup. */ }
        throw new Error('练习未能保存，请导出备份并释放空间后重试。');
      }
      return state;
    },
    change(transform) { return this.save(transform(this.load())); },
  };
}
export const PracticeStore = createPracticeStore();
export function exportLearningState(storage = globalThis.localStorage) {
  return { version: 1, values: Object.fromEntries(LEARNING_KEYS.map(key => [key, storage.getItem(key)]).filter(([, value]) => value !== null)) };
}
// [V7.14.0 新增] Merge identities, never add counters or replace an existing item's local progress.
function mergeLearningItems(local, incoming) {
  if (Array.isArray(local) && Array.isArray(incoming)) {
    const ids = new Set(local.map(item => item?.id));
    return [...local, ...incoming.filter(item => { if (!item || ids.has(item.id)) return false; ids.add(item.id); return true; })];
  }
  if (record(local) && record(incoming)) return Object.fromEntries([...new Set([...Object.keys(local), ...Object.keys(incoming)])]
    .map(key => [key, Object.hasOwn(local, key) ? local[key] : incoming[key]]));
  return local;
}
function mergeLegacyLearning(key, local, incoming) {
  if (key === 'pa_quizState' || key === 'pa_discoverState') {
    const merged = { ...incoming, ...local };
    for (const field of key === 'pa_quizState' ? ['records', 'stageStats'] : ['findings', 'archive']) {
      if (local[field] !== undefined && incoming[field] !== undefined) merged[field] = mergeLearningItems(local[field], incoming[field]);
    }
    return merged;
  }
  return mergeLearningItems(local, incoming);
}
export function planLearningImport(incoming, storage = globalThis.localStorage) {
  if (incoming === undefined) return {};
  if (!incoming || incoming.version !== 1 || !incoming.values || typeof incoming.values !== 'object') throw new Error('学习备份格式不受支持。');
  const plan = {};
  for (const key of LEARNING_KEYS) {
    if (!Object.hasOwn(incoming.values, key)) continue;
    const raw = incoming.values[key];
    if (typeof raw !== 'string') throw new Error('学习备份键值无效：' + key);
    if (key === 'pa_colorScheme') { if (storage.getItem(key) === null) plan[key] = raw; continue; }
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('学习备份无法解析：' + key); }
    if (!value || typeof value !== 'object' || (key.endsWith('_errors') ? !Array.isArray(value) : Array.isArray(value))) throw new Error('学习备份内容无效：' + key);
    if (key.endsWith('_errors') && value.some(item => !record(item) || typeof item.id !== 'string')) throw new Error('学习错题标识无效：' + key);
    if (key === WORKBENCH_KEY) {
      validateWorkbenchState(value);
      const localRaw = storage.getItem(key);
      if (localRaw === null) plan[key] = raw;
      else {
        const local = validateWorkbenchState(JSON.parse(localRaw));
        const merged = { ...value, ...local, positions: { ...value.positions, ...local.positions }, drafts: { ...value.drafts, ...local.drafts } };
        if (value.turnRiverCourses || local.turnRiverCourses) merged.turnRiverCourses = mergeCourseLibraries(value.turnRiverCourses, local.turnRiverCourses);
        plan[key] = JSON.stringify(validateWorkbenchState(merged));
      }
    } else if (key === PRACTICE_KEY) {
      value = validatePracticeState(decodePracticeRecord(value));
      const localRaw = storage.getItem(key);
      if (localRaw === null) plan[key] = JSON.stringify(encodePracticeRecord(value));
      else {
        const local = validatePracticeState(decodePracticeRecord(JSON.parse(localRaw)));
        const merge = name => [...local[name], ...value[name].filter(item => !local[name].some(existing => existing.id === item.id))];
        const merged = merge('sessions');
        const activeId = local.activeId || (merged.find(session => session.id === value.activeId)?.status === 'active' ? value.activeId : null);
        const sessions = merged.map(session => session.status === 'active' && session.id !== activeId ? { ...session, status: 'stopped' } : session);
        plan[key] = JSON.stringify(encodePracticeRecord(validatePracticeState({ ...local, presets: merge('presets'), sessions, activeId })));
      }
    } else {
      const localRaw = storage.getItem(key);
      if (localRaw === null) plan[key] = raw;
      else {
        let local;
        try { local = JSON.parse(localRaw); } catch { throw new Error('本地学习记录无法解析，请先保留备份：' + key); }
        if (Array.isArray(local) !== Array.isArray(value) || !local || typeof local !== 'object') throw new Error('本地学习记录格式异常，请先保留备份：' + key);
        plan[key] = JSON.stringify(mergeLegacyLearning(key, local, value));
      }
    }
  }
  return plan;
}
export function applyLearningImport(plan, storage = globalThis.localStorage) {
  const before = Object.fromEntries(Object.keys(plan).map(key => [key, storage.getItem(key)]));
  try { for (const [key, value] of Object.entries(plan)) { storage.setItem(key, value); if (storage.getItem(key) !== value) throw new Error('读回失败'); } }
  catch (error) {
    for (const [key, value] of Object.entries(before)) { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Report the incomplete restore instead of claiming success. */ } }
    throw new Error('学习记录未完整恢复，请保留备份后重试。');
  }
}
