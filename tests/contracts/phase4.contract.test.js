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

const { Store, initStorage, LearningUnitRepo, OpponentNoteRepo, EvidencePackRepo, GtoBaselineRepo } = await import('../../src/store/store.js');
const { DecisionRadar } = await import('../../src/modules/decisionRadar.js');
const { OBSERVATION_VERSION } = await import('../../src/modules/analysisReadModel.js');
const { GTO_BASELINE_SEEDS, GTO_BASELINE_SEED_VERSION } = await import('../../src/data/gtoBaselineSeed.js');
const { EXTERNAL_EVIDENCE_SEEDS, EXTERNAL_EVIDENCE_SEED_VERSION } = await import('../../src/data/externalEvidenceSeed.js');

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

// [V7.10.8 新增] 场景级种子完整性：按 Radar spot 落位的条目必须有来源/边界，facebet 条目不带 overall。
test('v7.10.8 scenario seeds stay spot-scoped and honestly typed', () => {
  assert.equal(GTO_BASELINE_SEED_VERSION, 'v4');
  assert.equal(GTO_BASELINE_SEEDS.length, 17);
  const ids = GTO_BASELINE_SEEDS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'seed ids must be unique');
  GTO_BASELINE_SEEDS.forEach((seed) => {
    assert.ok(seed.source && seed.source.url, seed.id + ' must carry a source url');
    assert.ok(seed.transferBoundary, seed.id + ' must carry a transfer boundary');
    assert.ok(['cbet', 'facebet'].includes(seed.question), seed.id + ' question must match radar vocabulary');
  });
  const facebet = GTO_BASELINE_SEEDS.filter((s) => s.question === 'facebet');
  assert.equal(facebet.length, 5);
  facebet.forEach((seed) => {
    assert.equal(seed.overall, null, seed.id + ' must not fake a cbet frequency');
    assert.ok(seed.sizingContext, seed.id + ' must state the sizing it responds to');
    assert.ok(seed.textureNotes.includes('正文核验') || seed.textureNotes.includes('aggregate'), seed.id + ' must state verification basis');
  });
  const sbSeed = GTO_BASELINE_SEEDS.find((s) => s.id === 'gto-baseline-sbvsbb-cbet-directional');
  assert.equal(sbSeed.seedRevision, 3);
  assert.equal(sbSeed.overall.betFreq, 54.3);
  assert.equal(sbSeed.overall.sizingSplit.small, 42.9);
  assert.ok(sbSeed.textureNotes.includes('文章表格直读'));
  const rangeConverter = GTO_BASELINE_SEEDS.find((s) => s.id === 'gto-baseline-btnvsbb-cbet-100bb-6max');
  assert.equal(rangeConverter.overall.betFreq, 63);
  const oopFramework = GTO_BASELINE_SEEDS.find((s) => s.id === 'gto-baseline-covsbtn-cbet-oop-framework-100bb');
  assert.equal(oopFramework.overall.betFreq, 28);
});

// [V7.10.8 新增] 播种升级三态：旧记录升级保留启用状态；用户编辑过（有 updatedAt）的记录不被覆盖。
test('scenario seed upgrades rewrite unedited rows and protect edited rows', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const seeded = JSON.parse(JSON.stringify(GtoBaselineRepo.getAll()));
  assert.equal(seeded.length, 17);

  // 模拟旧库：sbvsbb 回退到 v2 内容（无 updatedAt），并清掉播种 gate 后重播
  const repo = GtoBaselineRepo;
  const rows = repo.getAll();
  const sbRow = rows.find((b) => b.id === 'gto-baseline-sbvsbb-cbet-directional');
  sbRow.overall = null;
  sbRow.seedRevision = 2;
  sbRow.isActive = false;
  const editedRow = rows.find((b) => b.id === 'gto-baseline-btnvsbb-cbet-100bb-6max');
  editedRow.updatedAt = '2026-08-30 12:00';
  editedRow.textureNotes = '用户手工批注';
  repo.saveAll(rows);
  localStorage.removeItem('pa_gto_baseline_seed_' + GTO_BASELINE_SEED_VERSION);
  await initStorage({ safeMode: true });

  const after = repo.getAll();
  const sbAfter = after.find((b) => b.id === 'gto-baseline-sbvsbb-cbet-directional');
  assert.equal(sbAfter.seedRevision, 3);
  assert.equal(sbAfter.overall.betFreq, 54.3);
  assert.equal(sbAfter.isActive, false, 'upgrade must preserve user toggled isActive');
  const editedAfter = after.find((b) => b.id === 'gto-baseline-btnvsbb-cbet-100bb-6max');
  assert.equal(editedAfter.textureNotes, '用户手工批注', 'user-edited rows must not be overwritten');
  assert.equal(after.length, 17, 're-seeding must not duplicate rows');
});

// [V7.10.8 新增] 两级匹配：texture 专项优先、facebet 只命中 facebet、无专项时回落场景级。
test('gto matching prefers texture-specific rows and routes facebet separately', () => {
  const signalMonotoneCbet = { scenario: 'BTNvsBB', question: 'cbet', boardCategory: 'monotone' };
  const monotone = DecisionRadar.matchGtoBaselines(GTO_BASELINE_SEEDS, signalMonotoneCbet);
  assert.deepEqual(monotone.map((b) => b.id), ['gto-baseline-btnvsbb-cbet-monotone-100bb']);

  const signalMonotoneFacebet = { scenario: 'BTNvsBB', question: 'facebet', boardCategory: 'monotone' };
  const facebet = DecisionRadar.matchGtoBaselines(GTO_BASELINE_SEEDS, signalMonotoneFacebet);
  assert.deepEqual(facebet.map((b) => b.id), ['gto-baseline-btnvsbb-facebet-monotone-100bb']);
  assert.ok(facebet[0].textureNotes.includes('fold 37 / call 53 / raise 9'));

  const signalDryCbet = { scenario: 'BTNvsBB', question: 'cbet', boardCategory: 'dry_low' };
  const fallback = DecisionRadar.matchGtoBaselines(GTO_BASELINE_SEEDS, signalDryCbet);
  assert.ok(fallback.length >= 2, 'scenario-level rows must remain as fallback');
  assert.ok(fallback.every((b) => !b.scope || !b.scope.boardCategories || !b.scope.boardCategories.length));
  assert.ok(fallback.some((b) => b.id === 'gto-baseline-btnvsbb-cbet-100bb-6max'));
});

// [V7.10.8 新增] 外部证据补充：人群线索保持 lead，MTT heuristics 保持 structural 且带 spot scope。
// [V7.10.9 修改] 版本号断言移交批次测试（升版不回改旧批断言）。
test('v7.10.8 external evidence additions keep level discipline', () => {
  const population = EXTERNAL_EVIDENCE_SEEDS.find((s) => s.id === 'ev-pokercopilot-fold-to-cbet-population');
  assert.equal(population.evidenceLevel, 'lead');
  assert.ok(population.conditions.includes('42–57%'));
  assert.equal(population.reviewDueAt, '2027-02-28');
  const ipMtt = EXTERNAL_EVIDENCE_SEEDS.find((s) => s.id === 'ev-gto-wizard-ip-mtt-heuristics-40bb');
  assert.equal(ipMtt.evidenceLevel, 'structural');
  assert.equal(ipMtt.scope.relation, 'context');
  assert.equal(ipMtt.scope.scenario, 'BTNvsBB');
  const oopMtt = EXTERNAL_EVIDENCE_SEEDS.find((s) => s.id === 'ev-gto-wizard-oop-mtt-heuristics-40bb');
  assert.equal(oopMtt.scope.scenario, 'COvsBTN');
  assert.ok(oopMtt.keyPoints.includes('93.67%'));
  const ids = EXTERNAL_EVIDENCE_SEEDS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

// [V7.10.9 新增] 河牌证据域：street:'river' 条目不进翻牌信号匹配；Radar v1 只扫翻牌，河牌证据仅供 Dossier/策略复盘。
test('v7.10.9 river evidence seeds stay off flop signals', () => {
  assert.equal(EXTERNAL_EVIDENCE_SEED_VERSION, 'v5');
  const riverSeeds = EXTERNAL_EVIDENCE_SEEDS.filter((s) => s.scope && s.scope.street === 'river');
  assert.equal(riverSeeds.length, 4);
  riverSeeds.forEach((seed) => {
    assert.ok(seed.transferBoundary, seed.id + ' must carry a transfer boundary');
    assert.ok(seed.keyPoints, seed.id + ' must carry key points');
    assert.equal(seed.scope.relation, 'context');
  });
  assert.deepEqual(
    Array.from(new Set(riverSeeds.map((s) => s.scope.scenario))).sort(),
    ['BTNvsBB', 'COvsBTN', 'SBvsBB'],
  );

  // 翻牌信号绝不能命中河牌条目（matchEvidenceForSignal 的 street 过滤是唯一闸门）
  const flopSignal = { scenario: 'BTNvsBB', question: 'cbet', boardCategory: 'monotone' };
  const matches = DecisionRadar.matchEvidenceForSignal(EXTERNAL_EVIDENCE_SEEDS, flopSignal);
  assert.ok(matches.directMda.every((p) => p.scope.street === 'flop'));
  assert.ok(matches.contextual.every((p) => p.scope.street === 'flop'));
});
