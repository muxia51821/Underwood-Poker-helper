// Persist each immutable answer once; callers keep the established session shape.
import { validateSolutionPack } from '../modules/solutionPackModel.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const verified = new WeakSet();
const hashPattern = /^[a-f0-9]{64}$/;
const fail = () => { throw new Error('练习答案库缺失、损坏或引用不一致，原数据未覆盖。'); };
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function immutableSolutionSnapshot(pack) {
  if (!record(pack)) fail();
  // Only this module's deeply frozen objects can skip a later content check.
  if (!verified.has(pack)) { validateSolutionPack(pack); freeze(pack); verified.add(pack); }
  return pack;
}

export function decodePracticeRecord(value) {
  if (!record(value)) fail();
  if (value.version === 1) {
    if (Object.hasOwn(value, 'solutionSnapshots') || (Array.isArray(value.sessions) && value.sessions.some(s => s && Object.hasOwn(s, 'solutionSnapshotHash')))) fail();
    return value;
  }
  if (value.version !== 2) throw new Error('练习记录格式不受支持，原数据未覆盖。');
  if (!record(value.solutionSnapshots) || !Array.isArray(value.sessions)) fail();
  const pool = value.solutionSnapshots, used = new Set();
  for (const [hash, pack] of Object.entries(pool)) {
    if (!hashPattern.test(hash) || !record(pack) || pack.contentHash !== hash) fail();
    immutableSolutionSnapshot(pack);
  }
  const sessions = value.sessions.map(session => {
    if (!record(session)) fail();
    if (session.config?.type !== 'solution') {
      if (Object.hasOwn(session, 'solutionSnapshotHash') || Object.hasOwn(session, 'solutionSnapshot')) fail();
      return session;
    }
    const { solutionSnapshotHash: hash, ...rest } = session;
    if (typeof hash !== 'string' || !hashPattern.test(hash) || !Object.hasOwn(pool, hash) || Object.hasOwn(session, 'solutionSnapshot')) fail();
    used.add(hash);
    return { ...rest, solutionSnapshot: pool[hash] };
  });
  if (used.size !== Object.keys(pool).length) fail();
  const { solutionSnapshots, ...rest } = value;
  return { ...rest, version: 1, sessions };
}

export function encodePracticeRecord(state) {
  const solutionSnapshots = {};
  const sessions = state.sessions.map(session => {
    if (Object.hasOwn(session, 'solutionSnapshotHash')) fail();
    if (session.config.type !== 'solution') {
      if (Object.hasOwn(session, 'solutionSnapshot')) fail();
      return session;
    }
    const { solutionSnapshot, ...rest } = session;
    const pack = immutableSolutionSnapshot(solutionSnapshot);
    solutionSnapshots[pack.contentHash] ||= pack;
    return { ...rest, solutionSnapshotHash: pack.contentHash };
  });
  return { ...state, version: 2, sessions, solutionSnapshots };
}
