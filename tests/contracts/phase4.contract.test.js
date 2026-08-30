// [V7.10.2 新增] Phase 4 Mastery & Ecology 契约测试
// 独立文件原因：并行 Session 正在编辑 core.contract.test.js（手牌回放分支），避免实时编辑冲突。
import assert from 'node:assert/strict';
import test from 'node:test';
import { GGParser } from '../../src/parsers/ggParser.js';

function createLocalStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    key(index) { return Array.from(values.keys())[index] || null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(String(key), String(value)); },
    keys() { return Array.from(values.keys()); },
  };
}

const localStorage = createLocalStorage();
globalThis.localStorage = localStorage;
globalThis.window = { addEventListener() {} };

const { Store, initStorage, LearningUnitRepo, OpponentNoteRepo } = await import('../../src/store/store.js');
const { DecisionRadar } = await import('../../src/modules/decisionRadar.js');
const { OBSERVATION_VERSION } = await import('../../src/modules/analysisReadModel.js');

test('retest evaluation compares baseline snapshot against current signal', () => {
  assert.equal(DecisionRadar.evaluateRetest(null, null).due, false);
  const goneResult = DecisionRadar.evaluateRetest({ freq: 80, sample: 10, capturedAt: '2026-08-01' }, null);
  assert.equal(goneResult.due, true);  // 信号消失 → 复查是否已改善
  const freqDue = DecisionRadar.evaluateRetest({ freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 60, spotCount: 12 });
  assert.equal(freqDue.due, true);
  assert.ok(freqDue.reasons[0].includes('频率'));
  const sampleDue = DecisionRadar.evaluateRetest({ freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 82, spotCount: 16 });
  assert.equal(sampleDue.due, true);
  assert.ok(sampleDue.reasons[0].includes('样本'));
  const same = DecisionRadar.evaluateRetest({ freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 82, spotCount: 12 });
  assert.equal(same.due, false);
});

test('learning units and opponent notes persist through export/import merge', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const now = '2026-08-30 10:00';
  LearningUnitRepo.saveAll([{
    id: 'lu-1', strategyId: 'st-1', familyKey: 'BTNvsBB|flop', spotKeys: ['BTNvsBB|flop|monotone|cbet'],
    type: 'quiz', title: '训练 · BTNvsBB', quizScenario: 'BTNvsBB', reviewCondition: '样本 +50',
    status: 'active', baselineSnapshot: { freq: 80, sample: 10, capturedAt: '2026-08-01' }, lastCheckedAt: null,
    createdAt: now, updatedAt: now, observationVersion: OBSERVATION_VERSION,
  }]);
  OpponentNoteRepo.saveAll([{ id: 'on-1', oHash: 'hash-a', note: '河牌爱超池', createdAt: now, expiresAt: null }]);
  const data = Store.exportAll();
  assert.ok(Array.isArray(data.learningUnits));
  assert.ok(Array.isArray(data.opponentNotes));
  assert.throws(() => Store.importAll({ learningUnits: 'x' }), /learningUnits 应为数组/);
  assert.throws(() => Store.importAll({ opponentNotes: 'x' }), /opponentNotes 应为数组/);
  Store.importAll({
    learningUnits: [{ id: 'lu-2', type: 'retest' }],
    opponentNotes: [{ id: 'on-2', oHash: 'hash-b', note: 'n2' }],
  });
  assert.equal(LearningUnitRepo.getAll().length, 2);
  assert.equal(LearningUnitRepo.getAll().find((u) => u.id === 'lu-1').quizScenario, 'BTNvsBB');
  assert.equal(OpponentNoteRepo.getAll().length, 2);
  // pa_ 前缀契约
  assert.ok(localStorage.keys().every((key) => key.startsWith('pa_')));
});
