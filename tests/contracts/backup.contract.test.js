import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_COLLECTIONS, attachBackupMetadata, readBackup, planRestore, applyRestore } from '../../src/store/backup.js';
import { Utils } from '../../src/utils.js';
import { startPractice, submitPractice } from '../../src/modules/practiceModel.js';
import { createPracticeStore, PRACTICE_KEY } from '../../src/store/practiceStore.js';

function storage() {
  const values = new Map();
  return { get length() { return values.size; }, key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function fixture() {
  const local = storage(), collections = Object.fromEntries(Object.keys(BACKUP_COLLECTIONS).map(key => [key, []]));
  let checkpoint;
  const io = { storage: local, snapshot: () => attachBackupMetadata(structuredClone(collections), local),
    readCollection: async key => structuredClone(collections[key]),
    async writeCollection(key, value) { collections[key] = structuredClone(value); return { ok: true }; },
    async saveCheckpoint(value) { checkpoint = structuredClone(value); } };
  return { local, collections, io, checkpoint: () => checkpoint };
}

test('complete backup carries shared answers and rejects missing answers before writes', async () => {
  const source = fixture(), target = fixture();
  const config = { type: 'solution', solutionPackId: 'river-half-pot', solutionNodePath: 'root', count: 5 };
  const answered = { ...submitPractice(startPractice(config, [], () => 0), { choice: 'check' }), status: 'stopped' };
  const sessions = [answered, { ...structuredClone(answered), id: 'second-round' }];
  createPracticeStore(source.local).save({ version: 1, presets: [], sessions, activeId: null });
  const backup = source.io.snapshot();
  const record = JSON.parse(backup.localState.values[PRACTICE_KEY]);
  assert.equal(Object.keys(record.solutionSnapshots).length, 1);
  await applyRestore(planRestore(backup, target.io.snapshot()), target.io);
  assert.deepEqual(createPracticeStore(target.local).load().sessions, sessions);
  const before = target.local.getItem(PRACTICE_KEY), damaged = structuredClone(backup);
  record.solutionSnapshots = {};
  damaged.localState.values[PRACTICE_KEY] = JSON.stringify(record);
  const plan = planRestore(damaged, target.io.snapshot());
  assert.ok(plan.issues.some(issue => issue.includes('答案库')));
  await assert.rejects(applyRestore(plan, target.io), /问题/);
  assert.equal(target.local.getItem(PRACTICE_KEY), before);
});

test('complete backup restores every collection and independent learning keys without copying migration gates', async () => {
  const source = fixture(), target = fixture();
  for (const [name, key] of Object.entries(BACKUP_COLLECTIONS)) source.collections[name] = [{ [key]: name + '-key', extra: { preserved: name } }];
  source.collections.strategyRevisions[0].scope = 'BTN vs BB, 100bb';
  source.collections.evidencePacks[0].scope = { scenario: 'BTNvsBB' };
  const values = { pa_settings: '{"sound":false,"vibrate":false,"extra":"preserved"}',
    pa_standup: '{"date":"2026-10-16","count":7}', pa_colorScheme: 'future-theme',
    pa_quizState: '{"scenario":"BTNvsBB","records":{"old":{"picks":{"check":1}}}}',
    pa_quiz_mastery: '{"old":{"totalAttempts":3}}', pa_quiz_errors: '[{"id":"range-error"}]',
    pa_concept_quiz_mastery: '{"concept":{"asked":2,"correct":1}}', pa_concept_quiz_errors: '[{"id":"concept-error"}]',
    pa_discoverState: '{"archive":[{"id":"finding","improved":true}]}',
    pa_opponentAliases: '{"villain":"Synthetic"}', pa_opponentLiveFlags: '{"villain":true}', pa_opponentMerges: '{"villain":["other"]}',
    pa_log_2026_ignored: 'outside registry', 'pa_log_2026-10-16': '[{"workStart":"2026-10-16T10:00:00Z","note":"preserved"}]',
    pa_migrated_v1: 'true', pa_gto_baseline_seed_example: 'true', pokerAssistantData: '{"sessions":[]}' };
  for (const [key, value] of Object.entries(values)) source.local.setItem(key, value);
  source.local.setItem('pa_timerState', JSON.stringify({ status: 'running', phase: 'work', endTime: Date.now() + 180000 }));
  source.local.setItem('unrelated-secret', 'never export');
  const backup = source.io.snapshot();
  assert.equal(backup.localState.values['unrelated-secret'], undefined);
  const plan = planRestore(backup, target.io.snapshot());
  assert.deepEqual(plan.issues, []);
  const result = await applyRestore(plan, target.io);
  assert.equal(result.ok, true);
  assert.deepEqual(target.collections, source.collections);
  for (const [key, value] of Object.entries(values)) {
    if (key === 'pokerAssistantData' || /migrated|seed|ignored/.test(key)) assert.equal(target.local.getItem(key), null);
    else assert.equal(target.local.getItem(key), value);
  }
  const timer = JSON.parse(target.local.getItem('pa_timerState'));
  assert.equal(timer.status, 'paused'); assert.equal(timer.endTime, null); assert.equal(timer.restorePending, true);
  assert.ok(timer.remainingMs >= 179000 && timer.remainingMs <= 180000);
});

test('legacy JSON and clipboard backups restore settings and safely pause an undated timer', async () => {
  const f = fixture();
  const data = { sessions: [], settings: { sound: false, vibrate: false }, timerState: { phase: 'work', endTime: 1000 } };
  assert.deepEqual(readBackup(Utils.encodeBase64(data)), data);
  assert.deepEqual(readBackup('\uFEFF' + JSON.stringify(data)), data);
  const result = await applyRestore(planRestore(data, f.io.snapshot()), f.io);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(f.local.getItem('pa_settings')), data.settings);
  assert.equal(JSON.parse(f.local.getItem('pa_timerState')).remainingMs, 0);
  assert.throws(() => readBackup({ backupMeta: { format: 'poker-table-agent', version: 99 }, sessions: [] }), /版本/);
});

test('preview preserves local conflicts and unknown fields, and only explicit selections replace them', async () => {
  const f = fixture(); f.collections.handReviews = [{ id: 'shared', reflection: 'local', extension: { source: true } }];
  const input = { handReviews: [{ id: 'shared', reflection: 'incoming', future: true }, { id: 'new', future: 7 }] };
  const untouched = f.io.snapshot();
  const first = planRestore(input, untouched);
  assert.equal(f.collections.handReviews.length, 1);
  assert.equal(first.rows[0].value[0].reflection, 'local');
  assert.equal(first.conflicts[0].token, 'handReviews:"shared"');
  const selected = planRestore(input, untouched, { preferIncoming: ['handReviews:"shared"'] });
  await applyRestore(selected, f.io);
  assert.equal(f.collections.handReviews[0].future, true);
  assert.equal(f.collections.handReviews[1].future, 7);
  assert.deepEqual(f.checkpoint().before.handReviews, untouched.handReviews);
});

test('invalid identities and corrupt independent records require an explicit skip and preserve raw source', async () => {
  const f = fixture();
  const source = { sessions: [{ id: 'valid' }, { date: 'missing' }, { id: 'valid' }],
    localState: { version: 1, values: { pa_concept_quiz_mastery: '{broken' } } };
  const first = planRestore(source, f.io.snapshot());
  assert.equal(first.issues.length, 3);
  await assert.rejects(applyRestore(first, f.io), /问题/);
  assert.equal(f.checkpoint(), undefined);
  assert.equal(first.incoming.localState.values.pa_concept_quiz_mastery, '{broken');
  const selected = planRestore(source, f.io.snapshot(), { skipInvalid: true });
  assert.equal((await applyRestore(selected, f.io)).ok, true);
  assert.deepEqual(f.collections.sessions, [{ id: 'valid' }]);
  assert.equal(f.local.getItem('pa_concept_quiz_mastery'), null);
});

test('stale memory or durable collections reject a plan before checkpoint or writes', async () => {
  const f = fixture(); let plan = planRestore({ sessions: [{ id: 'incoming' }] }, f.io.snapshot());
  f.local.setItem('pa_colorScheme', 'ember');
  await assert.rejects(applyRestore(plan, f.io), /已变化/);
  plan = planRestore({ sessions: [{ id: 'incoming' }] }, f.io.snapshot());
  f.io.readCollection = async () => [{ id: 'another-tab' }];
  await assert.rejects(applyRestore(plan, f.io), /已变化/);
  assert.equal(f.checkpoint(), undefined);
});

test('checkpoint failure prevents mutations; partial failure can retry or restore the original snapshot', async () => {
  const f = fixture(); f.collections.sessions = [{ id: 'local' }];
  const original = f.io.snapshot(); const input = { sessions: [{ id: 'new' }], handReviews: [{ id: 'new-hand' }] };
  const save = f.io.saveCheckpoint;
  f.io.saveCheckpoint = async () => { throw new Error('quota'); };
  await assert.rejects(applyRestore(planRestore(input, original), f.io), /quota/);
  assert.equal(f.collections.sessions.length, 1);
  f.io.saveCheckpoint = save;
  const write = f.io.writeCollection;
  f.io.writeCollection = async (key, value) => key === 'handReviews' ? { ok: false } : write(key, value);
  const partial = await applyRestore(planRestore(input, original), f.io);
  assert.equal(partial.ok, false); assert.deepEqual(partial.completed, ['sessions']);
  assert.deepEqual(partial.pending, ['handReviews']); assert.deepEqual(partial.before.sessions, original.sessions);
  f.io.writeCollection = write;
  const retry = planRestore(input, f.io.snapshot()); retry.recoveryBefore = partial.before;
  assert.equal((await applyRestore(retry, f.io)).ok, true);
  assert.deepEqual(f.checkpoint().before.sessions, original.sessions);
  f.local.setItem('pa_colorScheme', 'ember');
  const rollback = planRestore(original, f.io.snapshot(), { rollback: true });
  assert.equal((await applyRestore(rollback, f.io)).ok, true);
  assert.deepEqual(f.collections.sessions, [{ id: 'local' }]);
  assert.deepEqual(f.collections.handReviews, []); assert.equal(f.local.getItem('pa_colorScheme'), null);
});

test('learning merges unique identities without adding counters and supports explicit incoming conflicts', async () => {
  const f = fixture(); f.local.setItem('pa_concept_quiz_mastery', '{"shared":{"asked":2},"local":{"asked":1}}');
  const source = { learningState: { version: 1, values: { pa_concept_quiz_mastery: '{"shared":{"asked":8},"incoming":{"asked":3}}' } } };
  await applyRestore(planRestore(source, f.io.snapshot()), f.io);
  assert.deepEqual(JSON.parse(f.local.getItem('pa_concept_quiz_mastery')), { shared: { asked: 2 }, local: { asked: 1 }, incoming: { asked: 3 } });
  await applyRestore(planRestore(source, f.io.snapshot(), { preferIncoming: ['pa_concept_quiz_mastery'] }), f.io);
  assert.equal(JSON.parse(f.local.getItem('pa_concept_quiz_mastery')).shared.asked, 8);
});

test('invalid timer or unowned raw keys never become live local state', () => {
  const f = fixture();
  const plan = planRestore({ sessions: [], timerState: { phase: 'work', longBreak: 'broken' } }, f.io.snapshot());
  assert.equal(plan.issues.length, 1);
  assert.throws(() => planRestore({ localState: { version: 1, values: { authToken: 'secret' } } }, f.io.snapshot()), /键值无效/);
});

test('durable collection verification respects identities rather than IndexedDB key ordering', async () => {
  const f = fixture(); f.collections.sessions = [{ id: 'z' }, { id: 'a' }];
  f.io.readCollection = async key => structuredClone(f.collections[key]).reverse();
  assert.equal((await applyRestore(planRestore({ sessions: [{ id: 'middle' }] }, f.io.snapshot()), f.io)).ok, true);
});

test('a refreshed retry retains the original checkpoint and isolates unknown poker keys', async () => {
  const f = fixture(); f.collections.sessions = [{ id: 'original' }];
  const source = { sessions: [{ id: 'added' }], handReviews: [{ id: 'added-hand' }], localState: { version: 1, values: { pa_future_user_note: 'source bytes' } } };
  const write = f.io.writeCollection;
  f.io.getCheckpoint = async () => f.checkpoint();
  f.io.writeCollection = async (key, value) => key === 'handReviews' ? { ok: false } : write(key, value);
  await applyRestore(planRestore(source, f.io.snapshot()), f.io);
  f.io.writeCollection = write;
  await applyRestore(planRestore(source, f.io.snapshot()), f.io);
  assert.deepEqual(f.checkpoint().before.sessions, [{ id: 'original' }]);
  assert.equal(f.checkpoint().source.localState.values.pa_future_user_note, 'source bytes');
  assert.equal(f.local.getItem('pa_future_user_note'), null);
});

test('known collection field damage is reported before restoring while extension fields remain intact', () => {
  const f = fixture();
  const plan = planRestore({ sessionClosures: [{ id: 'broken', sessionId: 'session', reviewedHandIds: null, matchedMarkIds: null }],
    strategyRevisions: [{ id: 'broken-strategy', dossierIds: {} }], handReviews: [{ id: 'broken-hand', desc: {} }, { id: 'valid', future: { keep: true } }] }, f.io.snapshot());
  assert.equal(plan.issues.length, 3);
  assert.deepEqual(plan.rows.find(row => row.key === 'handReviews').value, [{ id: 'valid', future: { keep: true } }]);
});

test('unsupported numeric collection identifiers are isolated without rewriting relationships', () => {
  const f = fixture();
  const plan = planRestore({ sessions: [{ id: 123 }, { id: 124 }], handReviews: [{ id: 'hand', sessionId: 123 }] }, f.io.snapshot());
  assert.equal(plan.issues.length, 3);
});

test('an explicitly selected valid learning backup can repair corrupt local progress', async () => {
  const f = fixture(); f.local.setItem('pa_quiz_mastery', '{broken');
  const data = { learningState: { version: 1, values: { pa_quiz_mastery: '{"synthetic":{"totalAttempts":3}}' } } };
  const plan = planRestore(data, f.io.snapshot(), { preferIncoming: ['pa_quiz_mastery'] });
  assert.deepEqual(plan.issues, []);
  assert.equal((await applyRestore(plan, f.io)).ok, true);
  assert.equal(f.checkpoint().before.localState.values.pa_quiz_mastery, '{broken');
  assert.equal(JSON.parse(f.local.getItem('pa_quiz_mastery')).synthetic.totalAttempts, 3);
});

test('opponent conflicts are chosen per identity while unique entries merge', async () => {
  const f = fixture(); f.local.setItem('pa_opponentAliases', '{"A":"local-a","B":"local-b","local":"keep"}');
  const data = { sessions: [], opponentAliases: { A: 'incoming-a', B: 'incoming-b', incoming: 'new' } };
  const plan = planRestore(data, f.io.snapshot());
  assert.equal(plan.conflicts.length, 2);
  const chosen = planRestore(data, f.io.snapshot(), { preferIncoming: [plan.conflicts.find(item => item.id === 'A').token] });
  await applyRestore(chosen, f.io);
  assert.deepEqual(JSON.parse(f.local.getItem('pa_opponentAliases')), { A: 'incoming-a', B: 'local-b', local: 'keep', incoming: 'new' });
});

test('restore checkpoints remain available after switching between local and database backends', async () => {
  const f = fixture(); globalThis.localStorage = f.local; globalThis.window = { addEventListener() {} };
  const { Store } = await import('../../src/store/store.js');
  const { DB } = await import('../../src/store/db.js');
  const ready = DB.isReady, get = DB.getRestoreCheckpoint, put = DB.saveRestoreCheckpoint;
  let database = null;
  const currentStart = new Date(Date.now() - 1000).toISOString(), oldStart = new Date(Date.now() - 60000).toISOString();
  try {
    DB.isReady = () => false;
    await Store.saveRestoreCheckpoint({ before: { sessions: [{ id: 'original' }] }, status: 'partial', startedAt: currentStart });
    DB.isReady = () => true; DB.getRestoreCheckpoint = async () => database;
    DB.saveRestoreCheckpoint = async value => { database = { ...value, id: 'latest' }; };
    assert.equal((await Store.getRestoreCheckpoint()).status, 'partial');
    database = { before: { sessions: [] }, status: 'complete', startedAt: oldStart };
    assert.equal((await Store.getRestoreCheckpoint()).status, 'partial');
    await Store.saveRestoreCheckpoint({ before: { sessions: [{ id: 'original' }] }, status: 'complete', startedAt: currentStart });
    assert.equal((await Store.getRestoreCheckpoint()).status, 'complete');
  } finally { DB.isReady = ready; DB.getRestoreCheckpoint = get; DB.saveRestoreCheckpoint = put; }
});
