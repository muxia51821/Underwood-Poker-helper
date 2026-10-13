// [V7.10.2 新增] Phase 4 Mastery & Ecology 契约测试
// 独立文件原因：并行 Session 正在编辑 core.contract.test.js（手牌回放分支），避免实时编辑冲突。
import assert from 'node:assert/strict';
import test from 'node:test';
import { GGParser } from '../../src/parsers/ggParser.js';
import { Utils } from '../../src/utils.js';
import { STRATEGY_TOPICS, STRATEGY_HYPOTHESES, resolveTopic, resolveFrameworkSource, topicForSpot } from '../../src/data/strategyFramework.js';
import { getTopicHandReferences, getStrategyLearningTarget, POSITION_REFERENCES } from '../../src/modules/strategyStudy.js';

// [V7.11.15 新增] Exercise the stored strategy-to-learning path, not just the new topic button.
function strategyLearningRegression(t) {
  let units = [];
  const strategies = [
    { id: 'river-study', familyKey: 'BTNvsBB|river', title: 'River reasoning', spotKeys: [] },
    { id: 'defense-study', familyKey: 'BTNvsBB|flop', title: 'Facing a bet', spotKeys: ['BTNvsBB|flop|9max|dryAHigh|facebet'] },
    { id: 'flop-study', familyKey: 'BTNvsBB|flop', title: 'Cbet', spotKeys: ['BTNvsBB|flop|9max|monotone|cbet'] },
  ];
  t.mock.method(StrategyRepo, 'getAll', () => strategies);
  t.mock.method(LearningUnitRepo, 'getAll', () => units);
  t.mock.method(LearningUnitRepo, 'saveAll', (rows) => { units = rows; });
  t.mock.method(StrategyDesk, 'render', () => {});
  t.mock.method(Utils, 'showToast', () => {});
  for (const strategy of strategies) StrategyDesk.createLearningUnit(strategy.id);
  assert.equal(units.find((u) => u.strategyId === 'river-study').quizScenario, null);
  assert.equal(units.find((u) => u.strategyId === 'river-study').topicId, 'river');
  assert.equal(units.find((u) => u.strategyId === 'defense-study').topicId, 'defense');
  assert.equal(units.find((u) => u.strategyId === 'flop-study').quizScenario, 'BTNvsBB');
  const data = Store.exportAll();
  assert.equal(data.learningUnits.find((u) => u.strategyId === 'river-study').topicId, 'river');
}

// [V7.11.13 新增] Topic coverage and provenance must not depend on browser seed storage.
test('strategy framework covers each concept and action-line hypothesis without modifying seeds', async () => {
  const { CONCEPT_SEEDS } = await import('../../src/data/conceptSeed.js');
  const { POKER_LOGIC_SEEDS } = await import('../../src/data/pokerLogicSeed.js');
  const { underBluff, overBluff } = await import('../../src/data/actionLines.js');
  const snapshot = JSON.stringify([CONCEPT_SEEDS, POKER_LOGIC_SEEDS, underBluff, overBluff]);
  const ids = STRATEGY_TOPICS.flatMap((topic) => topic.conceptIds);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set(CONCEPT_SEEDS.map((c) => c.id)));
  for (const topic of STRATEGY_TOPICS) {
    const model = resolveTopic(topic.id);
    assert.ok(model.concepts.every(Boolean));
    assert.ok(model.sources.every((source) => source && source.conditions && source.boundary && safeSourceUrl(source.url)));
    assert.ok(model.summary && model.boundary);
  }
  for (const spot of POKER_LOGIC_SEEDS) assert.ok(resolveTopic(topicForSpot(spot.id)));
  assert.equal(topicForSpot('btnvsbb-caller-facebet'), 'defense');
  assert.equal(topicForSpot('sbvsbb-raiser-riverdual'), 'river');
  assert.equal(topicForSpot('unknown'), null);
  assert.equal(resolveTopic('unknown'), null);
  assert.equal(resolveFrameworkSource('unknown'), null);
  assert.deepEqual(STRATEGY_HYPOTHESES.map((h) => h.line), [...underBluff, ...overBluff].map((h) => h.line));
  assert.ok(STRATEGY_HYPOTHESES.every((h) => h.status === 'unverified' && resolveTopic(h.topicId) && h.assessment !== '尚未完成来源对照。'));
  assert.equal(STRATEGY_HYPOTHESES.find((h) => h.line === '3OA-Bs-XX-Bs-m').status, 'unverified');
  assert.equal(JSON.stringify([CONCEPT_SEEDS, POKER_LOGIC_SEEDS, underBluff, overBluff]), snapshot);
});

test('strategy library keeps source links safe and scopes uncertain textbook readings', (t) => {
  const previousDocument = globalThis.document;
  const elements = new Map();
  t.after(() => { globalThis.document = previousDocument; });
  globalThis.document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', focus() {} });
    return elements.get(id);
  } };
  t.mock.method(Utils, 'escapeHtml', (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///private.pdf', 'invalid']) assert.equal(safeSourceUrl(url), '');
  assert.equal(safeSourceUrl('https://example.com/'), 'https://example.com/');
  StrategyLibrary.select('preflop');
  let html = document.getElementById('strategyTopicBody').innerHTML;
  assert.ok(html.includes('三个例子分别读'));
  assert.ok(!html.includes('premium 手 preflop 价值上升'));
  assert.ok(html.includes('阅读器页 168-170'));
  StrategyLibrary.select('turn');
  html = document.getElementById('strategyTopicBody').innerHTML;
  assert.ok(html.includes('不等于没有强牌或陷阱'));
  assert.ok(html.includes('未经验证'));
  assert.ok(!html.includes('他的 range 不含强 trap'));
  assert.ok(!html.includes('data-strategy-edit'));
});

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

const { safeSourceUrl, StrategyLibrary } = await import('../../src/modules/strategyLibrary.js');

const { Store, initStorage, LearningUnitRepo, OpponentNoteRepo, EvidencePackRepo, GtoBaselineRepo } = await import('../../src/store/store.js');
const { DecisionRadar } = await import('../../src/modules/decisionRadar.js');
const { OBSERVATION_VERSION, buildFlopObservations } = await import('../../src/modules/analysisReadModel.js');
const { GTO_BASELINE_SEEDS, GTO_BASELINE_SEED_VERSION } = await import('../../src/data/gtoBaselineSeed.js');
const { EXTERNAL_EVIDENCE_SEEDS, EXTERNAL_EVIDENCE_SEED_VERSION } = await import('../../src/data/externalEvidenceSeed.js');
const { StrategyDesk } = await import('../../src/modules/strategyDesk.js');
const { StrategyRepo, DossierRepo, HandRepo } = await import('../../src/store/store.js');
test('strategy learning follows the street and decision instead of the scenario alone', strategyLearningRegression);

// [V7.11.15 新增] Parse complete synthetic histories before asserting ownership; labels alone cannot prove the parser path.
test('parsed nine-seat histories preserve hero decisions through observations and study links', () => {
  const cases = [
    { scenario: 'SBvsBB', heroSeat: 2, actions: ['SB: bets $0.10', 'BB: calls $0.10'], action: 'bet', topic: 'flop' },
    { scenario: 'SBvsBB', heroSeat: 2, actions: ['SB: checks', 'BB: bets $0.10', 'SB: calls $0.10'], action: 'check', topic: 'flop' },
    { scenario: 'SBvsBB', heroSeat: 3, actions: ['SB: bets $0.10', 'BB: calls $0.10'], action: 'call', topic: 'defense' },
    { scenario: 'SBvsBB', heroSeat: 3, actions: ['SB: bets $0.10', 'BB: folds'], action: 'fold', topic: 'defense' },
    { scenario: 'BTNvsBB', heroSeat: 1, actions: ['BB: checks', 'BTN: bets $0.10', 'BB: calls $0.10'], action: 'bet', topic: 'flop' },
    { scenario: 'BTNvsBB', heroSeat: 3, actions: ['BB: checks', 'BTN: bets $0.10', 'BB: calls $0.10'], action: 'call', topic: 'defense' },
  ];
  for (const [index, sample] of cases.entries()) {
    const names = ['BTN', 'SB', 'BB', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
    const hero = names[sample.heroSeat - 1];
    const [opener] = sample.scenario.split('vs');
    const folded = sample.actions.at(-1).endsWith('folds');
    const order = opener === 'SB' ? ['SB', 'BB'] : ['BB', 'BTN'];
    const pot = folded ? '0.30' : opener === 'SB' ? '0.50' : '0.52';
    const block = [
      `Poker Hand #SYNTH${index}: Hold'em No Limit ($0.02/$0.05) - 2026/10/08 20:00:00`,
      "Table 'Synthetic' 9-max Seat #1 is the button",
      ...names.map((name, i) => `Seat ${i + 1}: ${name === hero ? 'Hero' : name} ($10.00 in chips)`),
      'SB: posts small blind $0.02', 'BB: posts big blind $0.05',
      '*** HOLE CARDS ***', `Dealt to ${hero} [As Kd]`,
      ...names.slice(3).map((name) => `${name}: folds`),
      ...(opener === 'SB' ? ['BTN: folds'] : []),
      `${opener}: raises $${opener === 'SB' ? '0.13' : '0.10'} to $0.15`,
      ...(opener === 'BTN' ? ['SB: folds'] : []), 'BB: calls $0.10',
      '*** FLOP *** [Ah 7c 2d]', ...sample.actions,
      ...(folded ? ['Uncalled bet ($0.10) returned to ' + opener] : [
        '*** TURN *** [Ah 7c 2d] [4s]', ...order.map((name) => name + ': checks'),
        '*** RIVER *** [Ah 7c 2d 4s] [8h]', ...order.map((name) => name + ': checks'),
        '*** SHOWDOWN ***', 'Hero: shows [As Kd] (a pair of Aces)',
      ]),
      (folded ? opener : 'Hero') + ' collected $' + pot + ' from pot',
      '*** SUMMARY ***', 'Total pot $' + pot + ' | Rake $0',
      'Board [Ah 7c 2d' + (folded ? '' : ' 4s 8h') + ']',
    ].join('\n').replaceAll(hero + ':', 'Hero:').replace('Dealt to ' + hero, 'Dealt to Hero');
    const [hand] = GGParser.parse(block);
    assert.ok(hand, 'parsed sample ' + index);
    assert.equal(hand.tableMax, 9);
    assert.equal(hand.heroPosition, hero);
    assert.equal(hand.preflopScenario, sample.scenario);
    hand.id = 'imported-' + hand.ggId;
    const result = buildFlopObservations([hand]);
    assert.equal(result.observations.length, 1, 'sample ' + index);
    assert.equal(result.observations[0].actionClass, sample.action, 'sample ' + index);
    assert.equal(getTopicHandReferences(sample.topic, [hand], '9max').length, 1);
  }
});

test('legacy learning units route from their parent without rewriting stored records', (t) => {
  const strategy = { id: 'legacy-river', familyKey: 'BTNvsBB|river', spotKeys: [] };
  const unit = { id: 'old-quiz', strategyId: strategy.id, familyKey: strategy.familyKey, type: 'quiz', quizScenario: 'BTNvsBB' };
  const before = JSON.stringify(unit);
  t.mock.method(StrategyRepo, 'getAll', () => [strategy]);
  t.mock.method(LearningUnitRepo, 'getAll', () => [unit]);
  let opened;
  t.mock.method(StrategyLibrary, 'practice', (id) => { opened = id; return true; });
  assert.equal(StrategyDesk.startLearningUnit(unit.id), true);
  assert.equal(opened, 'river');
  assert.equal(JSON.stringify(unit), before);
  assert.equal(StrategyDesk.startLearningUnit('missing'), false);
});

test('learning destinations retain exact board filters and distinguish decision questions', () => {
  for (const key of ['BTNvsBB|flop|monotone|cbet', 'BTNvsBB|flop|9max|monotone|cbet']) {
    const target = getStrategyLearningTarget({ familyKey: 'BTNvsBB|flop', spotKeys: [key] });
    assert.equal(target.boardCategory, 'monotone');
    assert.equal(target.quizScenario, 'BTNvsBB');
  }
  assert.equal(getStrategyLearningTarget({ familyKey: 'SBvsBB|flop', spotKeys: ['SBvsBB|flop|dryAHigh|facebet'] }).topicId, 'defense');
  assert.equal(getStrategyLearningTarget({ familyKey: 'SBvsBB|turn' }).topicId, 'turn');
  assert.equal(getStrategyLearningTarget({ familyKey: 'COvsBTN|flop' }).quizScenario, null);
  assert.equal(getStrategyLearningTarget({ familyKey: 'BTNvsBB|flop' }).boardCategory, '');
  assert.deepEqual(POSITION_REFERENCES.UTGvsBB, { opener: 'UTG', defender: 'BB', ip: 'UTG', oop: 'BB' });
  assert.equal(POSITION_REFERENCES.SBvsBTN.opener, 'BTN');
  assert.equal(POSITION_REFERENCES.SBvsBB.ip, 'BB');
});

function mockStrategyEditor(t) {
  const elements = new Map();
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.document = previousDocument; });
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) {
        let value = '';
        elements.set(id, { get value() { return value; }, set value(v) { value = String(v ?? ''); },
          style: {}, dataset: {}, innerHTML: '', textContent: '', addEventListener() {} });
      }
      return elements.get(id);
    },
  };
  t.mock.method(Utils, 'showToast', () => {});
  t.mock.method(Utils, 'escapeHtml', (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'));
  t.mock.method(StrategyDesk, 'render', () => {});
  return document;
}

// [V7.11.12 新增] Exercise editor round trips, including fields absent from the form.
test('editing GTO source notes preserves decision and source metadata', (t) => {
  const doc = mockStrategyEditor(t);
  const records = structuredClone(GTO_BASELINE_SEEDS);
  t.mock.method(GtoBaselineRepo, 'getAll', () => records);
  const save = t.mock.method(GtoBaselineRepo, 'saveAll', () => {});
  for (const record of records) {
    const before = structuredClone(record);
    StrategyDesk.openGtoBaselineEditor(record.id);
    doc.getElementById('gtoTextureNotes').value = 'edited notes';
    StrategyDesk.saveGtoBaseline();
    assert.equal(record.textureNotes, 'edited notes', record.id);
    for (const key of ['question', 'street', 'scope', 'conditions', 'overall', 'source', 'capturedAt']) {
      assert.deepEqual(record[key], before[key], record.id + ': ' + key);
    }
  }
  assert.equal(save.mock.callCount(), records.length);
});

test('editing evidence notes preserves river and contextual scopes', (t) => {
  const doc = mockStrategyEditor(t);
  const records = structuredClone(EXTERNAL_EVIDENCE_SEEDS);
  t.mock.method(EvidencePackRepo, 'getAll', () => records);
  const save = t.mock.method(EvidencePackRepo, 'saveAll', () => {});
  for (const record of records) {
    const before = structuredClone(record.scope);
    StrategyDesk.editEvidence(record.id);
    doc.getElementById('evKeyPoints').value = 'edited notes';
    StrategyDesk.saveEvidence();
    assert.equal(record.keyPoints, 'edited notes', record.id);
    assert.deepEqual(record.scope, before ?? null, record.id);
  }
  assert.equal(save.mock.callCount(), records.length);
});

test('strategy references follow the stored decision and board instead of defaulting to cbet', (t) => {
  const doc = mockStrategyEditor(t);
  t.mock.method(DecisionRadar, 'scan', () => ({ signals: [] }));
  t.mock.method(LearningUnitRepo, 'getAll', () => []);
  t.mock.method(DossierRepo, 'getAll', () => []);
  t.mock.method(GtoBaselineRepo, 'getAll', () => [
    { id: 'wrong', scenario: 'BTNvsBB', question: 'cbet', isActive: true, source: { title: 'wrong-cbet-source' } },
    { id: 'right', scenario: 'BTNvsBB', question: 'facebet', isActive: true, scope: { boardCategories: ['monotone'] }, source: { title: 'right-facebet-source' } },
    { id: 'other', scenario: 'BTNvsBB', question: 'facebet', isActive: true, scope: { boardCategories: ['dry_low'] }, source: { title: 'wrong-board-source' } },
  ]);
  const strategies = [{ id: 's', familyKey: 'BTNvsBB|flop', spotKeys: ['BTNvsBB|flop|9max|monotone|facebet'] }];
  t.mock.method(StrategyRepo, 'getAll', () => strategies);
  for (const key of ['BTNvsBB|flop|9max|monotone|facebet', 'BTNvsBB|flop|monotone|facebet']) {
    strategies[0].spotKeys = [key];
    StrategyDesk.renderStrategyList();
    const html = doc.getElementById('strategyList').innerHTML;
    assert.ok(html.includes('right-facebet-source'));
    assert.ok(!html.includes('wrong-cbet-source'));
    assert.ok(!html.includes('wrong-board-source'));
  }
  strategies[0].spotKeys = [];
  StrategyDesk.renderStrategyList();
  assert.ok(!doc.getElementById('strategyList').innerHTML.includes('wrong-cbet-source'));
});

test('radar retains signals beyond the display limit for strategy retests', (t) => {
  const observations = [];
  for (const scenario of ['BTNvsBB', 'SBvsBB', 'COvsBTN']) {
    for (const profileKey of ['6max', '9max']) {
      for (let i = 0; i < 20; i++) observations.push({
        handId: scenario + profileKey + i, scenario, profileKey, question: 'cbet',
        boardCategory: i < 8 ? 'monotone' : 'dry_low', didBet: i < 8,
      });
    }
  }
  const signals = DecisionRadar.buildSignals(observations);
  const lookup = DecisionRadar.findSignalForStoredSpotKey(signals, 'COvsBTN|flop|9max|dry_low|cbet');
  assert.ok(lookup.signal, 'a lower-ranked signal still exists for retesting');
  assert.equal(DecisionRadar.evaluateRetest({ observationVersion: OBSERVATION_VERSION, freq: 0, sample: 12 }, lookup.signal).due, false);
  assert.equal(signals.length, 12);
  const doc = mockStrategyEditor(t);
  t.mock.method(DecisionRadar, 'scan', () => ({ signals, stats: { total: 120, attributed: 120 } }));
  t.mock.method(HandRepo, 'getAll', () => []);
  t.mock.method(DossierRepo, 'getAll', () => [{ id: 'tracked', signalId: lookup.signal.id }]);
  t.mock.method(GtoBaselineRepo, 'getAll', () => []);
  t.mock.method(EvidencePackRepo, 'getAll', () => []);
  DecisionRadar.renderInto();
  const html = doc.getElementById('radarBody').innerHTML;
  assert.equal((html.match(/<article /g) || []).length, DecisionRadar.THRESHOLDS.maxSignals);
  assert.ok(html.includes(lookup.signal.id), 'tracked signals get display priority before truncation');
});

test('retest evaluation compares baseline snapshot against current signal', () => {
  assert.equal(DecisionRadar.evaluateRetest(null, null).due, false);
  const goneResult = DecisionRadar.evaluateRetest({ observationVersion: OBSERVATION_VERSION, freq: 80, sample: 10, capturedAt: '2026-08-01' }, null);
  assert.equal(goneResult.due, true);  // 信号消失 → 复查是否已改善
  const freqDue = DecisionRadar.evaluateRetest({ observationVersion: OBSERVATION_VERSION, freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 60, spotCount: 12 });
  assert.equal(freqDue.due, true);
  assert.ok(freqDue.reasons[0].includes('频率'));
  const sampleDue = DecisionRadar.evaluateRetest({ observationVersion: OBSERVATION_VERSION, freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 82, spotCount: 16 });
  assert.equal(sampleDue.due, true);
  assert.ok(sampleDue.reasons[0].includes('样本'));
  const same = DecisionRadar.evaluateRetest({ observationVersion: OBSERVATION_VERSION, freq: 80, sample: 10, capturedAt: '2026-08-01' }, { spotFreq: 82, spotCount: 12 });
  assert.equal(same.due, false);
  const stale = DecisionRadar.evaluateRetest({ freq: 80, sample: 10 }, null);
  assert.equal(stale.due, true);
  assert.ok(stale.reasons.join('').includes('旧基线'));
  assert.ok(!stale.reasons.join('').includes('已改善'));
});

test('rebaselining is explicit, preserves old snapshots and survives export/import', (t) => {
  const oldConfirm = globalThis.confirm;
  t.after(() => { globalThis.confirm = oldConfirm; });
  const oldSnapshot = { freq: 80, sample: 10, capturedAt: '2026-08-01' };
  const record = { id: 'rebaseline', statement: 'Keep my strategy', spotKeys: ['BTNvsBB|flop|9max|dryAHigh|cbet'], baselineSnapshot: oldSnapshot };
  let records = [record];
  t.mock.method(StrategyRepo, 'getAll', () => records);
  t.mock.method(StrategyRepo, 'saveAll', (value) => { records = value; });
  t.mock.method(StrategyDesk, 'render', () => {});
  t.mock.method(Utils, 'showToast', () => {});
  const signal = { spotKey: record.spotKeys[0], spotFreq: 55, spotCount: 20, observationVersion: OBSERVATION_VERSION };
  let signals = [];
  t.mock.method(DecisionRadar, 'scan', () => ({ signals }));
  assert.equal(StrategyDesk.rebaselineStrategy(record.id), false);
  assert.equal(records[0], record);
  signals = [signal];
  globalThis.confirm = () => false;
  assert.equal(StrategyDesk.rebaselineStrategy(record.id), false);
  assert.equal(records[0], record);
  globalThis.confirm = () => true;
  assert.equal(StrategyDesk.rebaselineStrategy(record.id), true);
  assert.deepEqual(records[0].baselineHistory, [oldSnapshot]);
  assert.equal(records[0].baselineSnapshot.observationVersion, OBSERVATION_VERSION);
  assert.equal(records[0].statement, record.statement);
  assert.equal(StrategyDesk.rebaselineStrategy(record.id), false);
  const saved = Store.exportAll().strategyRevisions.find((item) => item.id === record.id);
  assert.deepEqual(saved.baselineHistory, [oldSnapshot]);
  const imported = structuredClone(saved);
  imported.id = 'rebaseline-imported';
  Store.importAll({ strategyRevisions: [imported] });
  assert.deepEqual(records.find((item) => item.id === imported.id).baselineHistory, [oldSnapshot]);
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

// [V7.11.0 新增] 复盘牌理参考：单手牌 spot 识别 + 种子完整性 + 证据引用可解析。
const { matchHandSpot, riverThreat, SPOT_MATCHER_VERSION } = await import('../../src/modules/spotMatcher.js');
const { POKER_LOGIC_SEEDS, POKER_LOGIC_SEED_VERSION } = await import('../../src/data/pokerLogicSeed.js');
const { CONCEPT_SEEDS, CONCEPT_SEED_VERSION, CONCEPT_APPLICATIONS } = await import('../../src/data/conceptSeed.js');

test('river applications retain their example lines and correct blocker direction', () => {
  const text = (id) => CONCEPT_APPLICATIONS.find((app) => app.id === id).text;
  assert.match(text('app-sb8-streets-1'), /XC-X/);
  assert.match(text('app-sb8-streets-1'), /不阻挡.*Tx/);
  assert.match(text('app-sb8-streets-1'), /阻挡.*Tx.*更倾向下注/);
  assert.match(text('app-sb8-lines-1'), /转牌/);
  assert.match(text('app-sb8-deviation-1'), /25bb Spin/);
  const river = POKER_LOGIC_SEEDS.find((seed) => seed.id === 'sbvsbb-raiser-riverdual');
  assert.ok(!river.steps.lines.note.includes('下注以小注为主'));
  assert.ok(!river.boundary.includes('镜像同构'));
});
const { ConceptQuiz, CONCEPT_QUIZ_VERSION } = await import('../../src/modules/conceptQuiz.js');
const { PokerLogic } = await import('../../src/modules/pokerLogic.js');
const { GTO_BASELINE_SEEDS: LOGIC_GTO_SEEDS } = await import('../../src/data/gtoBaselineSeed.js');

function syntheticHand(overrides) {
  return Object.assign({
    id: 't1', handId: 'H1', desc: '',
    preflopScenario: 'BTNvsBB', heroPosition: 'BTN', tableMax: 6,
    actionLineOTF: '', actionLineOTT: '', actionLineOTR: '',
  }, overrides);
}

// [V7.11.14 新增] Regression inputs reproduce actor attribution and source-scope conflicts.
test('postflop attribution distinguishes regular blind battles from heads-up tables', async () => {
  const { buildFlopObservations } = await import('../../src/modules/analysisReadModel.js');
  for (const tableMax of [6, 9]) {
    const sb = syntheticHand({ tableMax, preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'B40-C' });
    assert.equal(matchHandSpot(sb)?.spotId, 'sbvsbb-raiser-cbet');
    assert.equal(buildFlopObservations([sb]).observations[0]?.didBet, true);
    const checked = { ...sb, actionLineOTF: 'X-B40-C' };
    assert.equal(buildFlopObservations([checked]).observations[0]?.actionClass, 'check');
    assert.equal(matchHandSpot({ ...sb, heroPosition: 'BB' })?.spotId, 'sbvsbb-caller-facebet');
    const bb = syntheticHand({ tableMax, heroPosition: 'BB', actionLineOTF: 'X-B33-C' });
    assert.equal(matchHandSpot(bb)?.spotId, 'btnvsbb-caller-facebet');
    assert.equal(buildFlopObservations([bb]).observations[0]?.actionClass, 'call');
  }
  const hu = syntheticHand({ tableMax: 2, preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'X-B40-C' });
  assert.equal(buildFlopObservations([hu]).observations[0]?.didBet, true);
  const unknown = { ...hu, tableMax: 0 };
  assert.equal(matchHandSpot(unknown), null);
  assert.equal(buildFlopObservations([unknown]).observations.length, 0);
  assert.equal(buildFlopObservations([syntheticHand({ heroPosition: 'BB', actionLineOTF: 'X-X-B40-C-F' })]).observations.length, 0);
});

test('textbook scope is canonical across reading, logic cards and quizzes', () => {
  const depth = CONCEPT_SEEDS.find((c) => c.id === 'concept-stack-depth');
  assert.ok(depth.mechanism.includes('BTN 开局'));
  assert.ok(depth.applicability.includes('Spin'));
  assert.ok(ConceptQuiz.getItems().find((q) => q.id === depth.id).question.includes('BTN'));
  assert.ok(!CONCEPT_SEEDS.find((c) => c.id === 'concept-probe').mechanism.includes('不含强 trap'));
  assert.ok(!CONCEPT_SEEDS.find((c) => c.id === 'concept-rake-impact').mechanism.includes('如 GG'));
});

test('topic hand candidates include later streets without guessing evidence or mutating records', () => {
  const hands = [
    syntheticHand({ id: 'def-9', date: '2026-10-08', tableMax: 9, heroPosition: 'BB', actionLineOTF: 'X-B33-C', actionLineOTT: 'X-X', actionLineOTR: 'B40-C', pBB: -10 }),
    syntheticHand({ id: 'def-6', date: '2026-10-07', tableMax: 6, heroPosition: 'BB', actionLineOTF: 'X-B33-F', pBB: 10 }),
    syntheticHand({ id: 'sb', tableMax: 9, preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'B33-C' }),
    syntheticHand({ id: 'unknown', tableMax: 0, preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'B33-C' }),
    syntheticHand({ id: 'multi', heroPosition: 'BB', actionLineOTF: 'X-X-B33-C-F' }),
    null,
  ];
  const snapshot = JSON.stringify(hands);
  const refs = getTopicHandReferences('defense', hands);
  assert.deepEqual(refs.map((h) => h.id), ['def-9', 'def-6']);
  assert.deepEqual(getTopicHandReferences('defense', hands, '9max').map((h) => h.id), ['def-9']);
  assert.deepEqual(getTopicHandReferences('turn', hands).map((h) => h.id), ['def-9']);
  assert.deepEqual(getTopicHandReferences('flop', hands).map((h) => h.id), ['sb']);
  assert.ok(refs.every((h) => h.relation === 'candidate' && !('pBB' in h)));
  assert.deepEqual(getTopicHandReferences('unknown', hands), []);
  assert.deepEqual(getTopicHandReferences('special', hands), []);
  assert.equal(JSON.stringify(hands), snapshot);
});

test('topic quizzes filter concepts and wrong-answer views while preserving unrelated progress', () => {
  const ids = resolveTopic('preflop').conceptIds;
  const snapshot = JSON.stringify(ConceptQuiz.getMastery());
  const scopeItems = ConceptQuiz.getItems(ids);
  assert.ok(scopeItems.length > 0);
  assert.ok(scopeItems.every((q) => ids.includes(q.id.split('#')[0])));
  assert.deepEqual(ConceptQuiz.getItems([]), []);
  const savedItems = ConceptQuiz._items;
  const savedErrors = localStorage.getItem('pa_concept_quiz_errors');
  ConceptQuiz.recordError('concept-stack-depth', 'old-answer');
  ConceptQuiz.recordError('concept-probe', 'other-topic-answer');
  ConceptQuiz._items = scopeItems;
  assert.deepEqual(ConceptQuiz._scopedErrors().map((e) => e.id), ['concept-stack-depth']);
  ConceptQuiz._items = savedItems;
  assert.equal(JSON.stringify(ConceptQuiz.getMastery()), snapshot);
  if (savedErrors === null) localStorage.removeItem('pa_concept_quiz_errors');
  else localStorage.setItem('pa_concept_quiz_errors', savedErrors);
});

test('v7.11.0 spot matcher routes hands to logic cards by role and street', () => {
  assert.equal(SPOT_MATCHER_VERSION, 2);

  // 翻牌：BTN cbet（BB check 后 BTN 下注、BB 跟注）
  const flopCbet = syntheticHand({ actionLineOTF: 'X-B60-C' });
  assert.equal(matchHandSpot(flopCbet).spotId, 'btnvsbb-raiser-cbet');
  assert.equal(matchHandSpot(flopCbet).street, 'flop');

  // 翻牌止步 + 打过转牌的手牌不做翻牌牌理（复盘重点在当前街）
  const pastFlop = syntheticHand({ actionLineOTF: 'X-B60-C', actionLineOTT: 'X-X' });
  assert.equal(matchHandSpot(pastFlop), null);

  // 河牌：BTN 两街下注到河牌再下注（BB check 让路，空白河牌）
  const riverBet = syntheticHand({
    actionLineOTF: 'X-B60-C', actionLineOTT: 'X-B50-C', actionLineOTR: 'X-B75-C',
    desc: 'OTF翻牌 Ah 7d 2c    行动：X B60 (1.2bb) C\nOTT转牌 4s    行动：X B50 C\nOTR河牌 Kc    行动：X B75 C',
  });
  const m1 = matchHandSpot(riverBet);
  assert.equal(m1.spotId, 'btnvsbb-raiser-riverbet');
  assert.equal(m1.riverType, 'blank');
  assert.equal(m1.line, 'agg→agg');

  // 河牌：BB 防守转牌过牌、河牌首动 stab（2c/8c/3c 三张草花 → 惊悚河牌）
  const riverFirst = syntheticHand({
    preflopScenario: 'BTNvsBB', heroPosition: 'BB',
    actionLineOTF: 'X-B33-C', actionLineOTT: 'X-X', actionLineOTR: 'B50-C',
    desc: 'OTF翻牌 Ah 7d 2c    行动：X B33 (0.7bb) C\nOTT转牌 8c    行动：X X\nOTR河牌 3c    行动：B50 C',
  });
  const m2 = matchHandSpot(riverFirst);
  assert.equal(m2.spotId, 'btnvsbb-caller-riverfirst');
  assert.equal(m2.riverType, 'scary');
  assert.equal(m2.line, 'def→chk');

  // 河牌：SB cbet 被跟、转牌双过、河牌 BB 反打 SB 应对（facebet）
  const riverDual = syntheticHand({
    preflopScenario: 'SBvsBB', heroPosition: 'SB',
    actionLineOTF: 'B33-C', actionLineOTT: 'X-X', actionLineOTR: 'X-B40-C',
    desc: 'OTF翻牌 Kh 9d 3c    行动：B33 C\nOTT转牌 6s    行动：X X\nOTR河牌 2h    行动：X B40 C',
  });
  const m3 = matchHandSpot(riverDual);
  assert.equal(m3.spotId, 'sbvsbb-raiser-riverdual');
  assert.equal(m3.question, 'facebet');

  // COvsBTN 防守河牌无牌理卡（样本地图裁掉的场景）
  const covsCaller = syntheticHand({
    preflopScenario: 'COvsBTN', heroPosition: 'BTN',
    actionLineOTF: 'X-B33-C', actionLineOTT: 'X-X', actionLineOTR: 'X-B50-F',
  });
  assert.equal(matchHandSpot(covsCaller), null);

  // 多人池噪声（5 token 无 R）不识别
  assert.equal(matchHandSpot(syntheticHand({ actionLineOTF: 'X-X-B60-C-F' })), null);

  // 惊悚/空白启发式（3c 与 2c/8c 成三张草花 → 惊悚；Kh 不成花不成窗 → 空白）
  assert.equal(riverThreat(['Ah', '7d', '2c', '8c'], '3c').scary, true);
  assert.equal(riverThreat(['Ah', '7d', '2c', '8c'], 'Kh').scary, false);
});

test('v7.11.4 poker logic seeds assemble from resolvable applications, concepts and evidence', () => {
  assert.equal(POKER_LOGIC_SEED_VERSION, 'v4');
  assert.equal(POKER_LOGIC_SEEDS.length, 8);
  const ids = POKER_LOGIC_SEEDS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const resolvable = new Set(
    EXTERNAL_EVIDENCE_SEEDS.map((s) => s.id)
      .concat(LOGIC_GTO_SEEDS.map((s) => s.evidenceId)),
  );
  const conceptIds = new Set(CONCEPT_SEEDS.map((c) => c.id));
  const apps = new Map(CONCEPT_APPLICATIONS.map((a) => [a.id, a]));
  POKER_LOGIC_SEEDS.forEach((seed) => {
    assert.ok(seed.boundary, seed.id + ' needs boundary');
    assert.ok(seed.evidenceRefs.length, seed.id + ' needs evidence refs');
    seed.evidenceRefs.forEach((ref) => {
      assert.ok(resolvable.has(ref), seed.id + ' references unknown evidence ' + ref);
    });
    // v3：四步框架必须齐全，每格 = 导航语 + 至少 1 条应用条目（出处化内容）；概念引用可选但须可解析
    ['scope', 'lines', 'streets', 'deviation'].forEach((k) => {
      const step = seed.steps && seed.steps[k];
      assert.ok(step && typeof step.note === 'string' && step.note.length, seed.id + '.' + k + ' needs note');
      assert.ok(Array.isArray(step.conceptIds) && Array.isArray(step.applicationIds), seed.id + '.' + k + ' needs id arrays');
      assert.ok(step.applicationIds.length >= 1, seed.id + '.' + k + ' needs at least one sourced application');
      step.conceptIds.forEach((cid) => {
        assert.ok(conceptIds.has(cid), seed.id + '.' + k + ' references unknown concept ' + cid);
      });
      step.applicationIds.forEach((aid) => {
        const app = apps.get(aid);
        assert.ok(app, seed.id + '.' + k + ' references unknown application ' + aid);
        assert.equal(app.spotId, seed.id, aid + ' spotId mismatch');
        assert.equal(app.step, k, aid + ' step mismatch');
      });
    });
    assert.ok(!('rangeStory' in seed) && !('streetEffect' in seed) && !('lineNotes' in seed) && !('deviation' in seed), seed.id + ' must not carry v1 narrative fields');
  });
  // 三条河牌卡 + 五条翻牌卡
  assert.equal(POKER_LOGIC_SEEDS.filter((s) => s.street === 'river').length, 3);
  assert.equal(POKER_LOGIC_SEEDS.filter((s) => s.street === 'flop').length, 5);
});

test('v7.11.10 concept seeds carry teaching dimensions with source discipline', () => {
  assert.equal(CONCEPT_SEED_VERSION, 'v13');
  assert.equal(CONCEPT_SEEDS.length, 54);
  const ids = CONCEPT_SEEDS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'concept ids must be unique');
  const cardIds = new Set(POKER_LOGIC_SEEDS.map((s) => s.id));
  const clusters = new Set(['basic-math', 'calibration', 'equity-distribution', 'range-construction', 'defensive']);
  const extractions = new Set(['正文核验', '文章表格直读', '正文核验+文章表格直读', '图像复核', '图像复核（留待）']);
  const hasSource = (ref) => ref && ref.lesson && (
    (ref.kind === 'ddog' && ref.chapter && ref.readerPages) ||
    (ref.kind === 'gwblog' && ref.url)
  );
  CONCEPT_SEEDS.forEach((c) => {
    assert.ok(c.title && c.mechanism && c.misconception && c.applicability, c.id + ' needs content fields');
    assert.ok(clusters.has(c.cluster), c.id + ' unknown cluster ' + c.cluster);
    assert.ok(Array.isArray(c.relatedSpotIds) && Array.isArray(c.relatedConceptIds) && Array.isArray(c.relatedSources), c.id + ' needs relation arrays');
    assert.ok(!('updatedAt' in c), c.id + ' must not carry updatedAt (blocks seed upgrades)');
    assert.equal(c.seedRevision, 1, c.id + ' seedRevision');
    assert.ok(c.sourceRef && c.sourceRef.kind === 'ddog', c.id + ' needs ddog sourceRef');
    assert.ok(c.sourceRef.lesson && c.sourceRef.chapter && c.sourceRef.readerPages, c.id + ' sourceRef fields');
    assert.ok(extractions.has(c.sourceRef.extraction), c.id + ' extraction label: ' + c.sourceRef.extraction);
    // 教学维度：对比例 / 阈值 / 自测题（可缺省，存在则必须带出处）
    (c.contrastExamples || []).forEach((ex, i) => {
      assert.ok(ex.text, c.id + ' contrast ' + i + ' needs text');
      assert.ok(hasSource(ex.sourceRef), c.id + ' contrast ' + i + ' needs sourceRef');
    });
    (c.thresholds || []).forEach((t, i) => {
      assert.ok(t.text, c.id + ' threshold ' + i + ' needs text');
      if (t.sourceRef) assert.ok(hasSource(t.sourceRef), c.id + ' threshold ' + i + ' sourceRef malformed');
    });
    if (c.selfChecks) {
      assert.ok(Array.isArray(c.selfChecks) && c.selfChecks.length >= 1, c.id + ' selfChecks needs array');
      c.selfChecks.forEach((sc, si) => {
        assert.ok(sc.question, c.id + ' selfCheck ' + si + ' needs question');
        assert.ok(Array.isArray(sc.options) && sc.options.length >= 2, c.id + ' selfCheck ' + si + ' needs options');
        assert.ok((sc.options || []).includes(sc.answer), c.id + ' selfCheck ' + si + ' answer must be one of options');
        assert.ok(hasSource(sc.sourceRef), c.id + ' selfCheck ' + si + ' needs sourceRef');
      });
    }
    c.relatedSpotIds.forEach((sid) => assert.ok(cardIds.has(sid), c.id + ' references unknown spot ' + sid));
    c.relatedConceptIds.forEach((rid) => assert.ok(ids.includes(rid), c.id + ' references unknown related concept ' + rid));
  });
  // 概念层关键词汇必须在场：校准概念 + equity 分布四技术中的三项（分布图读法占位除外）
  assert.ok(ids.includes('concept-mdf-boundary'), 'calibration concept required');
  assert.ok(
    ids.includes('concept-equity-buckets') && ids.includes('concept-equity-realization') && ids.includes('concept-range-morphology'),
    'equity distribution vocabulary required',
  );
  // 教学维度覆盖广度：自测题与对比例是主要形态，至少 2/3 的概念具备其一
  const withTeaching = CONCEPT_SEEDS.filter((c) => (c.selfChecks || []).length || (c.contrastExamples || []).length).length;
  assert.ok(withTeaching >= Math.ceil(CONCEPT_SEEDS.length * 2 / 3), 'teaching dimensions must cover most concepts');
});

test('v7.11.2 spot applications are spot-scoped with provenance', () => {
  assert.ok(Array.isArray(CONCEPT_APPLICATIONS) && CONCEPT_APPLICATIONS.length >= 32, 'one application per card cell at minimum');
  const appIds = CONCEPT_APPLICATIONS.map((a) => a.id);
  assert.equal(new Set(appIds).size, appIds.length, 'application ids must be unique');
  const cardIds = new Set(POKER_LOGIC_SEEDS.map((s) => s.id));
  const conceptIds = new Set(CONCEPT_SEEDS.map((c) => c.id));
  const steps = new Set(['scope', 'lines', 'streets', 'deviation']);
  CONCEPT_APPLICATIONS.forEach((a) => {
    assert.ok(a.id.startsWith('app-'), a.id + ' id prefix');
    assert.ok(cardIds.has(a.spotId), a.id + ' unknown spotId ' + a.spotId);
    assert.ok(steps.has(a.step), a.id + ' unknown step ' + a.step);
    assert.ok(a.text && a.text.length >= 10, a.id + ' needs substantive text');
    assert.ok(a.sourceRef && a.sourceRef.lesson, a.id + ' needs provenance');
    assert.ok(
      a.sourceRef.kind === 'ddog' ? (a.sourceRef.chapter && a.sourceRef.readerPages) : a.sourceRef.kind === 'gwblog' ? a.sourceRef.url : false,
      a.id + ' sourceRef malformed',
    );
    (a.conceptIds || []).forEach((cid) => assert.ok(conceptIds.has(cid), a.id + ' references unknown concept ' + cid));
  });
  // 每个 spot×step 至少被一条应用覆盖（深度先行：32 格无空格）
  const covered = new Set(CONCEPT_APPLICATIONS.map((a) => a.spotId + '|' + a.step));
  POKER_LOGIC_SEEDS.forEach((s) => {
    ['scope', 'lines', 'streets', 'deviation'].forEach((k) => {
      assert.ok(covered.has(s.id + '|' + k), s.id + '|' + k + ' has no application coverage');
    });
  });
});

test('v7.11.10 concept quiz items derive from selfChecks with valid answers', () => {
  assert.equal(CONCEPT_QUIZ_VERSION, 4);
  const items = ConceptQuiz.getItems();
  const flatCount = CONCEPT_SEEDS.reduce((n, c) => n + (c.selfChecks || []).length, 0);
  assert.equal(items.length, flatCount, 'one quiz item per selfCheck entry (flattened)');
  assert.ok(items.length >= 10, 'quiz bank must be non-trivial');
  items.forEach((it) => {
    assert.ok(it.question, it.id + ' needs question');
    assert.ok(Array.isArray(it.options) && it.options.length >= 2, it.id + ' needs options');
    assert.ok(it.options.includes(it.answer), it.id + ' answer must be one of options');
    assert.ok(it.sourceRef && it.sourceRef.lesson, it.id + ' needs provenance');
    assert.ok(it.title && it.cluster, it.id + ' needs concept metadata');
  });
  // 确定性排序（cluster + id）
  const second = ConceptQuiz.getItems().map((i) => i.id);
  assert.deepEqual(items.map((i) => i.id), second, 'getItems must be deterministic');
});

test('v7.11.6 concept quiz error book records, dedupes and clears', () => {
  assert.equal(CONCEPT_QUIZ_VERSION, 4);
  ConceptQuiz.clearErrors();
  const items = ConceptQuiz.getItems();
  const it = items[0];
  // 答错入册
  ConceptQuiz.recordError(it.id, '错误选项A');
  assert.equal(ConceptQuiz.getErrors().length, 1);
  assert.equal(ConceptQuiz.getErrors()[0].item.id, it.id);
  assert.equal(ConceptQuiz.getErrors()[0].chosen, '错误选项A');
  // 同题重复答错去重（保留最新）
  ConceptQuiz.recordError(it.id, '错误选项B');
  assert.equal(ConceptQuiz.getErrors().length, 1);
  assert.equal(ConceptQuiz.getErrors()[0].chosen, '错误选项B');
  // 只保留题库内已知 id
  ConceptQuiz.recordError('concept-not-exist', 'x');
  assert.equal(ConceptQuiz.getErrors().length, 1);
  // 答对销账 / 清空
  ConceptQuiz.removeError(it.id);
  assert.equal(ConceptQuiz.getErrors().length, 0);
  ConceptQuiz.recordError(it.id, 'y');
  ConceptQuiz.clearErrors();
  assert.equal(ConceptQuiz.getErrors().length, 0);
});

test('v7.11.0 poker logic renders a framed card only for matched hands', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const riverBet = syntheticHand({
    id: 'logic-1',
    actionLineOTF: 'X-B60-C', actionLineOTT: 'X-B50-C', actionLineOTR: 'X-B75-C',
    desc: 'OTF翻牌 Ah 7d 2c    行动：X B60 (1.2bb) C\nOTT转牌 4s    行动：X B50 C\nOTR河牌 Kc    行动：X B75 C',
  });
  const html = PokerLogic.renderForHand(riverBet);
  assert.ok(html.includes('牌理参考'));
  assert.ok(html.includes('BTN 河牌下注'));
  assert.ok(html.includes('空白河牌'));
  assert.ok(html.includes('边界'));
  // v3：应用要点 + 概念卡（标题/机制/误解/对比例/自测折叠/出处行）
  assert.ok(html.includes('Equity Buckets'), 'streets step renders concept card');
  assert.ok(html.includes('常见误解'), 'concept misconception renders');
  assert.ok(html.includes('⚖'), 'contrast example renders');
  assert.ok(html.includes('考考自己'), 'self-check question renders');
  assert.ok(html.includes('来源：DDoG 第'), 'concept source line renders');
  assert.ok(html.includes('来源：GTO Wizard 博客') || html.includes('来源：DDoG'), 'application source line renders');
  assert.ok(!html.includes('<script'), 'card must not introduce script tags');
  const flopHtml = PokerLogic.renderForHand(syntheticHand({ id: 'logic-2', actionLineOTF: 'X-B60-C' }));
  assert.ok(flopHtml.includes('牌理参考') && flopHtml.includes('BTN C-bet'), 'flop match renders its card');
  assert.equal(PokerLogic.renderForHand(syntheticHand({ id: 'logic-3', preflopScenario: 'other' })), '');
});
