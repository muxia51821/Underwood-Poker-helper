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

const { Store, initStorage, LearningUnitRepo, OpponentNoteRepo, EvidencePackRepo } = await import('../../src/store/store.js');
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

// [V7.10.5 新增] 公共证据进入既有 Evidence Pack，带等级与复查时间，不另建静态资料页。
test('external evidence seeds preserve source conditions and user-editable records', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const packs = EvidencePackRepo.getAll();
  const mda = packs.find((pack) => pack.id === 'ev-mda-freebetrange-cash-preflop');
  const deepStack = packs.find((pack) => pack.id === 'ev-gto-wizard-deep-4bet-cash');
  const community = packs.find((pack) => pack.id === 'ev-community-twoplustwo-mda-micros');
  const sbContext = packs.find((pack) => pack.id === 'ev-gto-sbvsbb-flushy-dry-context');
  assert.equal(mda.evidenceLevel, 'lead');
  assert.ok(mda.conditions.includes('3-6 max'));
  assert.ok(mda.methodSample.includes('300M+'));
  assert.ok(mda.transferBoundary.includes('postflop'));
  assert.equal(mda.reviewDueAt, '2027-02-28');
  assert.equal(deepStack.evidenceLevel, 'structural');
  assert.ok(deepStack.transferBoundary.includes('SRP'));
  assert.equal(community.evidenceLevel, 'lead');
  assert.equal(sbContext.evidenceLevel, 'structural');
  assert.equal(sbContext.scope.relation, 'context');
  assert.deepEqual(sbContext.scope.boardCategories, ['flushy_dry']);
  const before = packs.length;
  await initStorage({ safeMode: true });
  assert.equal(EvidencePackRepo.getAll().length, before, 'repeated boot must not duplicate external sources');
});

test('radar only accepts fully scoped MDA as direct evidence and labels adjacent sources as context', () => {
  const signal = { scenario: 'SBvsBB', question: 'facebet', boardCategory: 'flushy_dry' };
  const matches = DecisionRadar.matchEvidenceForSignal([
    { id: 'generic-mda', sourceType: 'mda', evidenceLevel: 'conditional' },
    { id: 'wrong-question', sourceType: 'mda', evidenceLevel: 'conditional', scope: { scenario: 'SBvsBB', street: 'flop', question: 'cbet', boardCategories: ['flushy_dry'] } },
    { id: 'matching-mda', sourceType: 'mda', evidenceLevel: 'conditional', scope: { scenario: 'SBvsBB', street: 'flop', question: 'facebet', boardCategories: ['flushy_dry'] } },
    { id: 'adjacent', sourceType: 'solver', evidenceLevel: 'structural', scope: { scenario: 'SBvsBB', street: 'flop', boardCategories: ['flushy_dry'], relation: 'context' } },
  ], signal);
  assert.deepEqual(matches.directMda.map((pack) => pack.id), ['matching-mda']);
  assert.deepEqual(matches.contextual.map((pack) => pack.id), ['adjacent']);
});

// [V7.10.5 新增] Radar 信号必须给出可证伪的复盘层级和行动线核查路径，而不是宣告策略结论。
test('radar signals expose triage and investigation prompts', () => {
  const observations = [];
  for (let i = 0; i < 65; i++) {
    observations.push({
      handId: 'base-' + i, scenario: 'BTNvsBB', boardCategory: 'paired_low', question: 'cbet',
      actionClass: i < 30 ? 'bet' : 'check', didBet: i < 30, didFold: false, profileKey: '6max', profileLabel: '6max', pBB: 0,
    });
  }
  for (let i = 0; i < 30; i++) {
    observations.push({
      handId: 'spot-' + i, scenario: 'BTNvsBB', boardCategory: 'monotone', question: 'cbet',
      actionClass: i < 27 ? 'bet' : 'check', didBet: i < 27, didFold: false, profileKey: '6max', profileLabel: '6max', pBB: -1,
    });
  }
  const signal = DecisionRadar.buildSignals(observations).find((item) => item.boardCategory === 'monotone');
  assert.equal(signal.triage.key, 'external');
  assert.equal(signal.actionCounts.bet, 27);
  assert.equal(signal.actionCounts.check, 3);
  assert.ok(signal.investigationPrompt.includes('下注尺度'));
  assert.ok(!signal.investigationPrompt.includes('立刻改策略'));
});
