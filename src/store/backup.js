// [V7.16.0 新增] Plan against a snapshot; keep source bytes separate from values eligible for restore.
import { CONSTANTS } from '../constants.js';
import { LEARNING_KEYS, planLearningImport } from './practiceStore.js';
import { Utils } from '../utils.js';
import { RANGE_LIBRARY_KEY, validateRangeState, mergeRangeStates } from './rangeStore.js'; // [V7.17.0 新增]

export const BACKUP_COLLECTIONS = { sessions: 'id', handReviews: 'id', weeklyReviews: 'week', tiltLogs: 'time',
  marks: 'id', sessionClosures: 'id', dossiers: 'id', evidencePacks: 'id', strategyRevisions: 'id',
  learningUnits: 'id', opponentNotes: 'id', gtoBaselines: 'id' };
export const BACKUP_LABELS = { sessions: '场次', handReviews: '手牌', weeklyReviews: '周复盘', tiltLogs: '情绪记录',
  marks: '快记', sessionClosures: '场次收尾', dossiers: '研究问题', evidencePacks: '证据', strategyRevisions: '策略修订',
  learningUnits: '学习记录', opponentNotes: '对手笔记', gtoBaselines: '策略参考', pa_settings: '声音与振动设置',
  pa_timerState: '计时状态', pa_standup: '站立次数', pa_opponentAliases: '对手别名', pa_opponentLiveFlags: '对手关注',
  pa_opponentMerges: '对手合并', pa_practice_v1: '专项与练习历史', pa_decision_workspace_v1: '决策位置与草稿',
  pa_quizState: '旧范围练习', pa_quiz_errors: '范围错题', pa_quiz_mastery: '范围掌握度',
  pa_concept_quiz_mastery: '概念掌握度', pa_concept_quiz_errors: '概念错题', pa_discoverState: '发现与归档', pa_colorScheme: '外观' };
const fields = ['settings', 'timerState', 'standup', 'opponentAliases', 'opponentLiveFlags', 'opponentMerges'];
BACKUP_LABELS[RANGE_LIBRARY_KEY] = '翻前范围与草稿';
const fixedKeys = [...LEARNING_KEYS, RANGE_LIBRARY_KEY, ...fields.map(key => 'pa_' + key)];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const restorable = key => fixedKeys.includes(key) || /^pa_log_\d{4}-\d{2}-\d{2}$/.test(key);
const owned = key => key === 'pokerAssistantData' || key.startsWith('pa_') && key !== 'pa_restore_checkpoint_v1';
export function backupFingerprint(value) {
  const sort = (item, root = false) => Array.isArray(item) ? item.map(value => sort(value)) : object(item)
    ? Object.fromEntries(Object.keys(item).sort().filter(key => !root || key !== 'backupMeta').map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(value, true));
}
function collectionFingerprint(key, rows) {
  const id = BACKUP_COLLECTIONS[key];
  return backupFingerprint([...rows].sort((a, b) => JSON.stringify(a[id]).localeCompare(JSON.stringify(b[id]))));
}
export function captureLocalState(storage = globalThis.localStorage) {
  const values = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && owned(key)) values[key] = storage.getItem(key);
  }
  return { version: 1, values };
}
export function attachBackupMetadata(data, storage = globalThis.localStorage) {
  return { ...data, localState: captureLocalState(storage), backupMeta: {
    format: 'poker-table-agent', version: 1, appVersion: CONSTANTS.VERSION, createdAt: new Date().toISOString() } };
}
export function readBackup(input) {
  let data = input;
  if (typeof input === 'string') {
    try { data = JSON.parse(input.replace(/^\uFEFF/, '')); }
    catch { try { data = Utils.decodeBase64(input.trim()); } catch { throw new Error('无法读取备份，请选择 JSON 文件或原来的复制备份内容。'); } }
  }
  if (!object(data)) throw new Error('备份必须是一个数据对象。');
  if (data.backupMeta && (data.backupMeta.format !== 'poker-table-agent' || data.backupMeta.version !== 1)) throw new Error('这个备份版本暂不支持，原数据没有改动。');
  if (!Object.keys(BACKUP_COLLECTIONS).some(key => Object.hasOwn(data, key)) && !data.localState && !data.learningState) throw new Error('没有找到可恢复的扑克记录。');
  return JSON.parse(JSON.stringify(data));
}
function rawValues(data) {
  const values = {};
  for (const field of fields) if (Object.hasOwn(data, field)) values['pa_' + field] = JSON.stringify(data[field]);
  if (data.logs !== undefined) {
    if (!object(data.logs)) throw new Error('计时日志应按日期保存。');
    for (const [date, logs] of Object.entries(data.logs)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('计时日志日期无效：' + date);
      values['pa_log_' + date] = JSON.stringify(logs);
    }
  }
  for (const name of ['learningState', 'localState']) if (data[name] !== undefined) {
    const state = data[name];
    if (!object(state) || state.version !== 1 || !object(state.values)) throw new Error('独立记录备份格式不受支持：' + name);
    for (const [key, raw] of Object.entries(state.values)) {
      if (!owned(key) || typeof raw !== 'string') throw new Error('备份键值无效：' + key);
      if (restorable(key)) values[key] = raw;
    }
  }
  return values;
}
function validateLocal(key, raw) {
  if (key === 'pa_colorScheme') return raw;
  const value = JSON.parse(raw);
  if (key === RANGE_LIBRARY_KEY) return validateRangeState(value);
  if (LEARNING_KEYS.includes(key)) {
    planLearningImport({ version: 1, values: { [key]: raw } }, { getItem: () => null });
    return value;
  }
  if (key.startsWith('pa_log_')) {
    if (!Array.isArray(value) || value.some(row => !object(row) || typeof row.workStart !== 'string' || !row.workStart)) throw new Error('日志缺少开始时间');
  } else if (!object(value)) throw new Error('应为一个对象');
  if (key === 'pa_settings' && ['sound', 'vibrate'].some(name => value[name] !== undefined && typeof value[name] !== 'boolean')) throw new Error('声音与振动应为开关');
  if (key === 'pa_standup' && (typeof value.date !== 'string' || !Number.isInteger(value.count) || value.count < 0)) throw new Error('站立次数或日期无效');
  if (key === 'pa_timerState') {
    if (value.phase !== undefined && !['work', 'break'].includes(value.phase)) throw new Error('计时阶段无效');
    if (value.status !== undefined && !['idle', 'running', 'paused'].includes(value.status)) throw new Error('计时状态无效');
    for (const field of ['endTime', 'remainingMs', 'cycleCount']) if (value[field] != null && (!Number.isFinite(value[field]) || value[field] < 0)) throw new Error('计时数值无效');
    if (value.longBreak !== undefined && (!object(value.longBreak) || typeof value.longBreak.enabled !== 'boolean'
      || ['interval', 'minutes'].some(key => !Number.isFinite(value.longBreak[key]) || value.longBreak[key] <= 0))) throw new Error('长休息设置无效');
  }
  return value;
}
export function pauseRestoredTimer(value, exportedAt) {
  const active = value.status === 'running' || value.status === 'paused' || value.endTime != null;
  const at = Date.parse(exportedAt);
  const remaining = Number.isFinite(value.remainingMs) ? value.remainingMs
    : Number.isFinite(at) && Number.isFinite(value.endTime) ? Math.max(0, value.endTime - at) : 0;
  return { ...value, status: active ? 'paused' : 'idle', remainingMs: active ? remaining : null, endTime: null,
    workStart: null, breakStart: null, restorePending: active, restoredFrom: value.restoredFrom || value };
}
function mergeRows(local, incoming, idField, source, choices, conflicts) {
  const result = new Map(local.map(item => [item[idField], item]));
  for (const item of incoming) {
    const id = item[idField];
    if (result.has(id) && backupFingerprint(result.get(id)) !== backupFingerprint(item)) {
      const token = source + ':' + JSON.stringify(id);
      conflicts.push({ token, label: BACKUP_LABELS[source] || source, id: String(id) });
      if (!choices.includes(token)) continue;
    }
    result.set(id, item);
  }
  return [...result.values()];
}
function validateCollectionRecord(name, item) {
  // [V7.17.0 修改] DOM routing and repository consumers require string identities; never rewrite links independently.
  for (const key of ['sessionId', 'matchedHandId', 'strategyId']) if (item[key] != null && typeof item[key] !== 'string') throw new Error(key + ' 应为文字标识');
  const arrays = { sessionClosures: ['reviewedHandIds', 'matchedMarkIds'], dossiers: ['sampleHandIds'],
    strategyRevisions: ['evidenceIds', 'dossierIds', 'spotKeys'] };
  for (const key of arrays[name] || []) if (item[key] !== undefined && (!Array.isArray(item[key])
    || item[key].some(value => !['string', 'number'].includes(typeof value)))) throw new Error(key + ' 应为标识数组');
  const strings = { sessions: ['date', 'level', 'mistake', 'remark'], handReviews: ['date', 'desc', 'heroCards', 'heroPosition', 'reflection', 'mistake', 'preflopScenario'],
    weeklyReviews: ['weakness', 'plan'], tiltLogs: ['date', 'trigger', 'note'], marks: ['time', 'note', 'mistake', 'status'],
    sessionClosures: ['note', 'status'], dossiers: ['title', 'hypothesis', 'counterexamples', 'nextSteps'], strategyRevisions: ['scope'] };
  for (const key of strings[name] || []) if (item[key] != null && typeof item[key] !== 'string') throw new Error(key + ' 应为文字');
  const objects = { handReviews: ['decisionReviews'], evidencePacks: ['scope'], gtoBaselines: ['scope'] };
  for (const key of objects[name] || []) if (item[key] != null && !object(item[key])) throw new Error(key + ' 应为对象');
}
export function planRestore(input, current, options = {}) {
  const incoming = readBackup(input), rows = [], conflicts = [], issues = [];
  const choices = options.preferIncoming || [];
  for (const [name, idField] of Object.entries(BACKUP_COLLECTIONS)) {
    if (!Object.hasOwn(incoming, name)) continue;
    if (!Array.isArray(incoming[name])) throw new Error((BACKUP_LABELS[name] || name) + '应为数组。');
    const ids = new Set(), valid = [];
    incoming[name].forEach((item, index) => {
      const id = item?.[idField];
      if (!object(item) || typeof id !== 'string' || id.trim() === '' || ids.has(id)) {
        issues.push(name + '[' + index + ']：标识缺失、无效或重复'); return;
      }
      ids.add(id);
      try { validateCollectionRecord(name, item); valid.push(item); }
      catch (error) { issues.push(name + '[' + index + ']：' + error.message); }
    });
    const local = current[name] || [];
    const value = options.rollback ? valid : mergeRows(local, valid, idField, name, choices, conflicts);
    rows.push({ kind: 'collection', key: name, label: BACKUP_LABELS[name], value,
      added: valid.filter(item => !local.some(old => old[idField] === item[idField])).length,
      total: value.length, changed: backupFingerprint(local) !== backupFingerprint(value) });
  }
  const source = rawValues(incoming), local = current.localState
    ? Object.fromEntries(Object.entries(current.localState.values).filter(([key]) => restorable(key))) : rawValues(current);
  if (options.rollback) for (const key of Object.keys(local)) if (!Object.hasOwn(source, key)) source[key] = null;
  for (const [key, raw] of Object.entries(source)) {
    try {
      const localRaw = local[key] ?? null;
      let value = raw === null ? null : validateLocal(key, raw), merged = raw;
      if (raw !== null && !options.rollback && localRaw !== null && localRaw !== raw) {
        const token = key;
        if (!key.startsWith('pa_log_') && !key.startsWith('pa_opponent')) conflicts.push({ token, label: BACKUP_LABELS[key] || key, id: '' });
        const prefer = choices.includes(token);
        if (LEARNING_KEYS.includes(key) || key === RANGE_LIBRARY_KEY) {
          let validLocal = true;
          try { validateLocal(key, localRaw); }
          catch { if (!prefer) throw new Error('本地进度损坏；可勾选采用已验证的备份，原文会保留在恢复前副本。'); validLocal = false; }
          if (!validLocal) merged = raw;
          else {
            const base = prefer ? raw : localRaw, addition = prefer ? localRaw : raw;
            merged = key === RANGE_LIBRARY_KEY ? JSON.stringify(mergeRangeStates(JSON.parse(base), JSON.parse(addition)))
              : planLearningImport({ version: 1, values: { [key]: addition } }, { getItem: name => name === key ? base : null })[key] ?? base;
          }
        } else if (key.startsWith('pa_log_')) {
          const rows = mergeRows(JSON.parse(localRaw), value, 'workStart', key, choices, conflicts);
          merged = JSON.stringify(rows);
        } else if (key.startsWith('pa_opponent')) {
          const existing = JSON.parse(localRaw);
          // [V7.17.0 修改] Each opponent is an independent conflict choice.
          const result = { ...existing };
          for (const [id, entry] of Object.entries(value)) {
            const token = key + ':' + JSON.stringify(id);
            if (Object.hasOwn(existing, id) && backupFingerprint(existing[id]) !== backupFingerprint(entry)) {
              conflicts.push({ token, label: BACKUP_LABELS[key], id });
              if (!choices.includes(token)) continue;
            }
            Object.defineProperty(result, id, { value: entry, enumerable: true, writable: true, configurable: true });
          }
          merged = JSON.stringify(result);
        } else merged = prefer ? raw : localRaw;
      }
      if (key === 'pa_timerState' && merged !== null && merged !== localRaw) merged = JSON.stringify(pauseRestoredTimer(JSON.parse(merged), incoming.backupMeta?.createdAt));
      rows.push({ kind: 'local', key, label: BACKUP_LABELS[key] || key.replace('pa_log_', '计时日志 '), value: merged,
        added: localRaw === null && merged !== null ? 1 : 0, total: merged === null ? 0 : 1, changed: merged !== localRaw });
    } catch (error) { issues.push((BACKUP_LABELS[key] || key) + '：' + error.message); }
  }
  return { incoming, before: JSON.parse(JSON.stringify(current)), baseline: backupFingerprint(current), rows, conflicts, issues,
    archivedKeys: Object.keys(incoming.localState?.values || {}).filter(key => !restorable(key)),
    options: { ...options, preferIncoming: [...choices] } };
}
export async function applyRestore(plan, io) {
  if (plan.issues.length && !plan.options.skipInvalid) throw new Error('请先处理备份中的问题，或明确选择跳过问题项。');
  if (backupFingerprint(io.snapshot()) !== plan.baseline) throw new Error('本地记录已变化，请重新预览后恢复。');
  for (const row of plan.rows.filter(item => item.kind === 'collection')) {
    if (collectionFingerprint(row.key, await io.readCollection(row.key)) !== collectionFingerprint(row.key, plan.before[row.key] || [])) throw new Error('本地记录已变化，请重新预览后恢复。');
  }
  const previous = await io.getCheckpoint?.();
  const unfinished = previous && previous.status !== 'complete';
  const journal = { before: unfinished ? previous.before : plan.recoveryBefore || plan.before,
    source: plan.incoming,
    status: 'applying', startedAt: new Date().toISOString(), completed: [], failed: [] };
  await io.saveCheckpoint(journal);
  for (const row of plan.rows.filter(item => item.changed)) {
    try {
      if (row.kind === 'collection') {
        const result = await io.writeCollection(row.key, row.value);
        if (!result.ok || result.retryRequired) throw new Error('尚未可靠写入，请重试');
        if (collectionFingerprint(row.key, await io.readCollection(row.key)) !== collectionFingerprint(row.key, row.value)) throw new Error('读回与备份不一致');
      } else {
        if (row.value === null) io.storage.removeItem(row.key); else io.storage.setItem(row.key, row.value);
        if (io.storage.getItem(row.key) !== row.value) throw new Error('读回与备份不一致');
      }
      journal.completed.push(row.key);
    } catch (error) { journal.failed.push({ key: row.key, label: row.label, message: error.message }); break; }
  }
  journal.status = journal.failed.length ? 'partial' : 'complete';
  journal.pending = plan.rows.filter(row => row.changed && !journal.completed.includes(row.key)).map(row => row.key);
  try { await io.saveCheckpoint(journal); }
  catch { journal.failed.push({ key: 'checkpoint', label: '恢复报告', message: '报告未保存；恢复前副本仍可用于还原。' }); journal.status = 'partial'; }
  return { ...journal, ok: journal.status === 'complete' };
}
