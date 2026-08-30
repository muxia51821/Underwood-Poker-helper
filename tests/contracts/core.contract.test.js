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

const { Store, SessionRepo, HandRepo, BaseRepo, initStorage, MarksRepo, ClosureRepo, DossierRepo, EvidencePackRepo, StrategyRepo } = await import('../../src/store/store.js');
const { LocalStorageAdapter, PersistenceCoordinator } = await import('../../src/store/storage.js');
const { buildImportPlan, createOverwritePatch } = await import('../../src/modules/ggImportCoordinator.js');
const { normalizeLearningHand, createLearningSnapshot, getLearningTarget } = await import('../../src/modules/analysisReadModel.js');
const { HandReplay } = await import('../../src/modules/handReplay.js');

const uncalledHand = [
  'Poker Hand #RC100001',
  '2026/05/01 12:00:00',
  'Seat 1: Hero ($10.00 in chips)',
  'Seat 2: Villain ($10.00 in chips)',
  'Seat #2 is the button',
  'Villain posts small blind $0.02',
  'Hero posts big blind $0.05',
  '*** HOLE CARDS ***',
  'Dealt to Hero [Ah Kh]',
  'Villain raises $0.10 to $0.15',
  'Hero raises $0.30 to $0.45',
  'Villain folds',
  'Uncalled bet ($0.30) returned to Hero',
  'Hero collected $0.33 from pot',
  '*** SUMMARY ***',
].join('\n');

const anteAndBoardHand = [
  'Poker Hand #HD2815913697: Hold\'em No Limit ($0.02/$0.05($0.01)) - 2026/04/10 23:37:51',
  'Table \'NLHAYellow5\' 9-max Seat #6 is the button',
  'Seat 2: Villain ($26.04 in chips)',
  'Seat 5: Hero ($13.85 in chips)',
  'Seat 6: Opponent ($10.55 in chips)',
  'Hero: posts the ante $0.01',
  'Villain: posts the ante $0.01',
  'Opponent: posts the ante $0.01',
  'Villain: posts small blind $0.02',
  'Opponent: posts big blind $0.05',
  '*** HOLE CARDS ***',
  'Dealt to Hero [Qs Jd]',
  'Villain: folds',
  'Hero: calls $0.2',
  'Opponent: folds',
  '*** FLOP *** [Ah 2h Jh]',
  'Hero: bets $0.16',
  'Villain: folds',
  'Uncalled bet ($0.16) returned to Hero',
  '*** SHOWDOWN ***',
  'Hero collected $0.52 from pot',
  '*** SUMMARY ***',
  'Total pot $0.54 | Rake $0.02 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0',
  'Board [Ah 2h Jh]',
].join('\n');

const btnVsBbHand = [
  'Poker Hand #SC100001: Hold\'em No Limit ($0.02/$0.05) - 2026/04/11 12:00:00',
  'Table \'NLH\' 2-max Seat #1 is the button',
  'Seat 1: Hero ($5.00 in chips)',
  'Seat 2: Villain ($5.00 in chips)',
  'Hero: posts small blind $0.02',
  'Villain: posts big blind $0.05',
  '*** HOLE CARDS ***',
  'Dealt to Hero [As Kd]',
  'Hero: raises $0.10 to $0.15',
  'Villain: calls $0.10',
  '*** FLOP *** [Ah 7c 2d]',
  'Villain: checks',
  'Hero: bets $0.10',
  'Villain: folds',
  'Uncalled bet ($0.10) returned to Hero',
  'Hero collected $0.25 from pot',
  '*** SUMMARY ***',
  'Total pot $0.25 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0',
  'Board [Ah 7c 2d]',
].join('\n');

const runoutHand = anteAndBoardHand
  .replace(
    '*** SHOWDOWN ***',
    '*** TURN *** [7c]\nHero: checks\nVillain: checks\n*** RIVER *** [3s]\nHero: checks\nVillain: checks\n*** SHOWDOWN ***'
  )
  .replace('Board [Ah 2h Jh]', 'Board [Ah 2h Jh 7c 3s]');

test('GG parser preserves uncalled-bet profit semantics', () => {
  const [hand] = GGParser.parse(uncalledHand);
  assert.ok(hand);
  assert.equal(hand.handId, 'RC100001');
  assert.equal(hand.heroPosition, 'BB');
  assert.equal(hand.potType, '3IA');
  assert.ok(Math.abs(hand.profit - 0.13) < 0.01);
  assert.ok(Math.abs(hand.profitBB - 2.6) < 0.1);
});

test('GG parser preserves ante, board, rake, and board metadata', () => {
  const [hand] = GGParser.parse(anteAndBoardHand);
  assert.ok(hand);
  assert.equal(hand.handId, 'HD2815913697');
  assert.equal(hand.heroCards, 'Qs Jd');
  assert.ok(hand.boardCards.includes('Ah'));
  assert.ok(hand.rake >= 0.02);
  assert.ok(Math.abs(hand.profit - 0.31) < 0.02);
  assert.ok(Math.abs(hand.profitBB - 6.2) < 0.5);
  assert.ok(hand.boardCode);
  assert.ok(hand.boardCategory);
});

test('GG parser identifies BTN vs BB from a heads-up hand', () => {
  const [hand] = GGParser.parse(btnVsBbHand);
  assert.ok(hand);
  assert.equal(hand.heroPosition, 'BTN');
  assert.equal(hand.preflopScenario, 'BTNvsBB');
});

test('GG parser keeps GTO boardCode at the flop street', () => {
  const [hand] = GGParser.parse(runoutHand);
  assert.ok(hand);
  assert.equal(hand.boardCards.split(' ').length, 5);
  assert.equal(hand.boardCode, 'AhJh2h');
  assert.equal(hand.boardCategory, 'monotone');
});

test('GG parser detailed result reports unsupported blocks', () => {
  const result = GGParser.parseDetailed('Poker Hand #BAD001\nnot a complete hand');
  assert.equal(result.hands.length, 0);
  assert.equal(result.total, 1);
  assert.ok(result.failures.some((failure) => failure.reason.includes('Hero')));
});

test('GG import plan separates duplicates, session assignment, and record mapping', () => {
  let nextId = 0;
  const generateId = () => 'generated-' + (++nextId);
  const parsedHands = [
    { handId: 'new-1', date: '2026-05-01 10:00', profitBB: 2, boardCode: 'AhJh2h', boardCategory: 'monotone' },
    { handId: 'existing-1', date: '2026-05-01 10:10', profitBB: -1 },
  ];
  const existingReviews = [
    { id: 'review-1', ggId: 'existing-1', sessionId: 'session-1', decision: 'call', mistake: 'overcall', reflection: 'keep this reflection' },
  ];
  const existingSessions = [{ id: 'session-1', date: '2026-05-01', level: 'NL5' }];
  const plan = buildImportPlan(parsedHands, existingReviews, existingSessions, {
    targetSessionId: 'session-1',
    generateId,
  });

  assert.equal(plan.valid, true);
  assert.equal(plan.summary.duplicates, 1);
  assert.equal(plan.summary.imported, 1);
  assert.equal(plan.records[0].sessionId, 'session-1');
  assert.equal(plan.records[0].boardCode, 'AhJh2h');

  const patch = createOverwritePatch({
    handId: 'existing-1', date: '2026-05-02', profitBB: 4, board: 'A-high',
    boardCode: 'AsKd2c', boardCategory: 'dryAHigh', opponentId: 'Villain',
  });
  assert.equal(patch.date, '2026-05-02');
  assert.equal('decision' in patch, false);
  assert.equal('mistake' in patch, false);
  assert.equal('reflection' in patch, false);
  assert.equal('sessionId' in patch, false);
});

test('learning read model derives analysis fields without mutating stored hands', () => {
  const sourceHand = {
    id: 'learning-1',
    boardCode: 'AhJh2h',
    desc: 'preflop 行动：Hero BTN/[As Kd] raises to 3.0bb\nOTF翻牌 Ah Jh 2h    行动：B59 (3.2bb) F',
  };
  const foldHand = {
    id: 'learning-2',
    boardCode: 'AsKd2c',
    desc: 'preflop 行动：Hero BTN/[Qs Jd] folds',
  };
  const normalized = normalizeLearningHand(sourceHand);
  const snapshot = createLearningSnapshot([sourceHand, foldHand]);

  assert.equal(sourceHand.boardCategory, undefined);
  assert.equal(sourceHand.actionLineOTF, undefined);
  assert.equal(normalized.boardCategory, 'monotone');
  assert.equal(normalized.actionLineOTF, 'B59-(3.2bb)-F');
  assert.equal(normalized.preflopScenario, 'other');
  assert.equal(snapshot.totalHands, 2);
  assert.deepEqual(snapshot.eligibleHands.map((hand) => hand.id), ['learning-1']);
});

test('learning finding converts to a stable Discover to Quiz target', () => {
  const target = getLearningTarget({
    id: 'self_monotone|BTNvsBB',
    type: 'self_contradiction',
    category: 'monotone',
    scenario: 'BTNvsBB',
    handIds: ['hand-1', 'hand-2'],
  });

  assert.deepEqual(target, {
    findingId: 'self_monotone|BTNvsBB',
    type: 'self_contradiction',
    scenario: 'BTNvsBB',
    boardCategory: 'monotone',
    handIds: ['hand-1', 'hand-2'],
  });
});

test('storage import merges records without overwriting local records', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });

  Store.importAll({
    sessions: [{ id: 'session-1', profit: 10 }],
    handReviews: [{ id: 'hand-1', decision: 'call' }],
  });
  Store.importAll({
    sessions: [{ id: 'session-1', profit: 999 }, { id: 'session-2', profit: -5 }],
    handReviews: [{ id: 'hand-2', decision: 'fold' }],
  });

  assert.deepEqual(SessionRepo.getAll(), [
    { id: 'session-1', profit: 10 },
    { id: 'session-2', profit: -5 },
  ]);
  assert.deepEqual(HandRepo.getAll(), [
    { id: 'hand-1', decision: 'call' },
    { id: 'hand-2', decision: 'fold' },
  ]);
  assert.ok(localStorage.keys().every((key) => key.startsWith('pa_')));
});

test('storage import rejects malformed collection shapes', () => {
  assert.throws(() => Store.importAll({ sessions: {} }), /sessions 应为数组/);
  assert.throws(() => Store.importAll({ handReviews: {} }), /handReviews 应为数组/);
});

test('storage migration derives board fields from legacy hand descriptions', async () => {
  localStorage.clear();
  localStorage.setItem('pa_handReviews', JSON.stringify([
    {
      id: 'legacy-hand-1',
      desc: 'preflop 行动：Hero BTN/[As Kd] raises to 3.0bb\nOTF翻牌 Ah Jh 2h    行动：B59 (3.2bb) F',
    },
  ]));
  localStorage.removeItem('pa_migrated_board_v2');

  await initStorage({ safeMode: true });

  const [hand] = HandRepo.getAll();
  assert.equal(hand.boardCode, 'AhJh2h');
  assert.equal(hand.boardCategory, 'monotone');
  assert.equal(hand.actionLineOTF, 'B59-(3.2bb)-F');
  assert.equal(localStorage.getItem('pa_migrated_board_v2'), 'true');
});

test('storage falls back to localStorage when IndexedDB write fails', async () => {
  localStorage.clear();
  const failingIndexedDB = {
    isReady() { return true; },
    readAll() { return Promise.resolve([]); },
    writeAll() { return Promise.reject(new Error('simulated IndexedDB failure')); },
    count() { return Promise.resolve(0); },
  };
  const testPersistence = new PersistenceCoordinator({
    local: new LocalStorageAdapter(localStorage),
    indexedDB: failingIndexedDB,
  });
  const repo = new BaseRepo('handReviews', 'id', testPersistence);
  repo.markIndexedDBReady();

  repo.saveAll([{ id: 'fallback-hand-1', decision: 'check' }]);
  await new Promise(function (resolve) { setTimeout(resolve, 350); });

  assert.deepEqual(JSON.parse(localStorage.getItem('pa_handReviews')), [
    { id: 'fallback-hand-1', decision: 'check' },
  ]);
  assert.equal(repo.isIndexedDBReady(), false);
});

test('repo persistNow resolves after IndexedDB write completes', async () => {
  localStorage.clear();
  let writeCount = 0;
  const countingIndexedDB = {
    isReady() { return true; },
    readAll() { return Promise.resolve([]); },
    writeAll() {
      return new Promise((resolve) => { setTimeout(() => { writeCount++; resolve(); }, 50); });
    },
    count() { return Promise.resolve(writeCount); },
  };
  const testPersistence = new PersistenceCoordinator({
    local: new LocalStorageAdapter(localStorage),
    indexedDB: countingIndexedDB,
  });
  const repo = new BaseRepo('handReviews', 'id', testPersistence);
  repo.markIndexedDBReady();
  repo.saveAll([{ id: 'persist-now-1' }]);
  assert.equal(writeCount, 0);  // 防抖尚未触发
  const result = await repo.persistNow();
  assert.equal(writeCount, 1);
  assert.equal(result.backend, 'indexeddb');
  assert.equal(result.ok, true);
});

test('repo persistNow falls back to localStorage immediately when IndexedDB write fails', async () => {
  localStorage.clear();
  const failingIndexedDB = {
    isReady() { return true; },
    readAll() { return Promise.resolve([]); },
    writeAll() { return Promise.reject(new Error('simulated IndexedDB failure')); },
    count() { return Promise.resolve(0); },
  };
  const testPersistence = new PersistenceCoordinator({
    local: new LocalStorageAdapter(localStorage),
    indexedDB: failingIndexedDB,
  });
  const repo = new BaseRepo('handReviews', 'id', testPersistence);
  repo.markIndexedDBReady();
  repo.saveAll([{ id: 'persist-now-2', decision: 'check' }]);
  const result = await repo.persistNow();
  assert.equal(result.backend, 'localstorage');
  assert.deepEqual(JSON.parse(localStorage.getItem('pa_handReviews')), [
    { id: 'persist-now-2', decision: 'check' },
  ]);
  assert.equal(repo.isIndexedDBReady(), false);
});

// [V7.9.1 新增] Phase 1 Session Closure：Mark 匹配、候选手牌、收尾生命周期、备份合并

test('session closure proposes time-proximity matches with same-session priority', async () => {
  const { SessionClosure } = await import('../../src/modules/sessionClosure.js');
  const mark = { id: 'm1', time: '2026-06-01 21:30', sessionId: 's1' };
  const hands = [
    { id: 'h-far-other', date: '2026-06-01 21:34', sessionId: 's2' },
    { id: 'h-near-other', date: '2026-06-01 21:28', sessionId: 's2' },
    { id: 'h-near-same', date: '2026-06-01 21:31', sessionId: 's1' },
    { id: 'h-out', date: '2026-06-01 21:50', sessionId: 's1' },
  ];
  const proposals = SessionClosure.proposeMatches(mark, hands);
  assert.deepEqual(proposals.map((p) => p.hand.id), ['h-near-same', 'h-near-other', 'h-far-other']);
  assert.equal(proposals[0].deltaMin, 1);
  assert.equal(proposals[0].sameSession, true);
  const narrow = SessionClosure.proposeMatches(mark, hands, 1);
  assert.deepEqual(narrow.map((p) => p.hand.id), ['h-near-same']);
  const broken = SessionClosure.proposeMatches({ id: 'm2', time: '' }, hands);
  assert.deepEqual(broken, []);
});

test('buildCandidates dedupes by source priority with a cap', async () => {
  const { SessionClosure } = await import('../../src/modules/sessionClosure.js');
  const marks = [{ id: 'm1', status: 'matched', matchedHandId: 'h-mark' }];
  const hands = [
    { id: 'h-mark', pBB: 5 },
    { id: 'h-both', pBB: -50, marked: true },
    { id: 'h-big', pBB: -41 },
    { id: 'h-lev1', pBB: 120 },
    { id: 'h-lev2', pBB: 80 },
    { id: 'h-lev3', pBB: 60 },
    { id: 'h-lev4', pBB: 45 },
    { id: 'h-star', marked: true },
  ];
  const list = SessionClosure.buildCandidates(hands, marks);
  assert.equal(list.length, 7);  // h-lev4 不在 |pBB| 前 3，被排除
  const byId = {};
  list.forEach((c) => { byId[c.hand.id] = c.reasons; });
  assert.deepEqual(byId['h-mark'], ['mark']);
  assert.deepEqual(byId['h-both'], ['bigloss', 'star']);
  assert.equal(list[0].hand.id, 'h-mark');
  const capped = SessionClosure.buildCandidates(hands, marks, { limit: 3 });
  assert.deepEqual(capped.map((c) => c.hand.id), ['h-mark', 'h-both', 'h-big']);
});

test('closure lifecycle: unfinished list, draft toggle, mark match, confirm', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const { SessionClosure } = await import('../../src/modules/sessionClosure.js');
  SessionRepo.saveAll([{ id: 's-1', date: '2026-06-01', level: 'NL5', hands: 2, profit: 3 }]);
  HandRepo.saveAll([
    { id: 'c1', sessionId: 's-1', date: '2026-06-01 21:00', pBB: 2 },
    { id: 'c2', sessionId: 's-1', date: '2026-06-01 21:05', pBB: 1 },
  ]);
  assert.deepEqual(
    SessionClosure.getUnfinishedSessions(SessionRepo.getAll(), HandRepo.getAll(), ClosureRepo.getAll()).map((s) => s.id),
    ['s-1']
  );

  SessionClosure.toggleReviewedHand('s-1', 'c1');
  let closure = SessionClosure.getClosureFor('s-1');
  assert.equal(closure.status, 'draft');
  assert.deepEqual(closure.reviewedHandIds, ['c1']);
  SessionClosure.toggleReviewedHand('s-1', 'c1');
  assert.deepEqual(SessionClosure.getClosureFor('s-1').reviewedHandIds, []);

  MarksRepo.saveAll([{ id: 'mk-1', time: '2026-06-01 21:01', note: 'x', sessionId: 's-1', status: 'open', matchedHandId: null }]);
  SessionClosure.matchMark('mk-1', 'c1', 's-1');
  assert.equal(MarksRepo.getAll()[0].status, 'matched');
  assert.equal(MarksRepo.getAll()[0].matchedHandId, 'c1');
  assert.deepEqual(SessionClosure.getClosureFor('s-1').matchedMarkIds, ['mk-1']);
  SessionClosure.reopenMark('mk-1');
  assert.equal(MarksRepo.getAll()[0].status, 'open');
  assert.deepEqual(SessionClosure.getClosureFor('s-1').matchedMarkIds, []);
  SessionClosure.matchMark('mk-1', 'c1', 's-1');
  SessionClosure.dismissMark('mk-1');
  assert.equal(MarksRepo.getAll()[0].status, 'dismissed');

  SessionClosure.confirmClosure('s-1');
  closure = SessionClosure.getClosureFor('s-1');
  assert.equal(closure.status, 'closed');
  assert.ok(closure.closedAt);
  assert.deepEqual(SessionClosure.getUnfinishedSessions(SessionRepo.getAll(), HandRepo.getAll(), ClosureRepo.getAll()), []);
});

test('storage export/import covers marks and closures with merge-without-overwrite', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const data = Store.exportAll();
  assert.ok(Array.isArray(data.marks));
  assert.ok(Array.isArray(data.sessionClosures));
  assert.throws(() => Store.importAll({ marks: {} }), /marks 应为数组/);
  Store.importAll({
    marks: [{ id: 'mk-9', note: 'keep' }],
    sessionClosures: [{ id: 'cl-9', sessionId: 's-x', status: 'closed' }],
  });
  Store.importAll({
    marks: [{ id: 'mk-9', note: 'imported-version' }, { id: 'mk-10' }],
    sessionClosures: [{ id: 'cl-10' }],
  });
  assert.equal(MarksRepo.getAll().length, 2);
  assert.equal(MarksRepo.getAll().filter((m) => m.id === 'mk-9')[0].note, 'keep');
  assert.equal(ClosureRepo.getAll().length, 2);
});

// [V7.9.2 新增] Phase 2 Decision Radar：观察派生、信号阈值、Dossier 持久化

test('flop observations attribute hero actions by scenario flop order', async () => {
  const { buildFlopObservations, OBSERVATION_VERSION } = await import('../../src/modules/analysisReadModel.js');
  const hands = [
    // BTNvsBB 加注者（后行动）：BB 过牌 → 第二 token 是 C-bet 决策
    { id: 'o1', heroPosition: 'BTN', preflopScenario: 'BTNvsBB', boardCategory: 'monotone', actionLineOTF: 'X-B60-C', pBB: 5 },
    // BTNvsBB 加注者：BB 先下注（donk）→ v1 排除
    { id: 'o2', heroPosition: 'BTN', preflopScenario: 'BTNvsBB', boardCategory: 'monotone', actionLineOTF: 'B40-C', pBB: -2 },
    // BTNvsBB 加注者：过牌到底
    { id: 'o3', heroPosition: 'BTN', preflopScenario: 'BTNvsBB', boardCategory: 'monotone', actionLineOTF: 'X-C', pBB: 1 },
    // BTNvsBB 跟注者（先行动，OOP）：过牌后面对 C-bet 弃牌
    { id: 'o4', heroPosition: 'BB', preflopScenario: 'BTNvsBB', boardCategory: 'dryAHigh', actionLineOTF: 'X-B60-F', pBB: -3 },
    // COvsBTN 加注者（先行动，OOP）：直接 C-bet
    { id: 'o5', heroPosition: 'CO', preflopScenario: 'COvsBTN', boardCategory: 'monotone', actionLineOTF: 'B60-C', pBB: 4 },
    // SBvsBB 加注者（后行动）：BB 过牌后 C-bet
    { id: 'o11', heroPosition: 'SB', preflopScenario: 'SBvsBB', boardCategory: 'monotone', actionLineOTF: 'X-B60-C', pBB: 4 },
    // SBvsBB 加注者：BB 先下注 → donk 排除
    { id: 'o10', heroPosition: 'SB', preflopScenario: 'SBvsBB', boardCategory: 'monotone', actionLineOTF: 'B60-C', pBB: 2 },
    // SBvsBB 跟注者（BB，先行动）→ 翻牌先行动无"面对下注"，排除
    { id: 'o6', heroPosition: 'BB', preflopScenario: 'SBvsBB', boardCategory: 'monotone', actionLineOTF: 'X-C', pBB: 0 },
    // 场景 other → 排除
    { id: 'o7', heroPosition: 'MP', preflopScenario: 'other', boardCategory: 'monotone', actionLineOTF: 'B60-C', pBB: 2 },
    // 尺寸分桶：低 / 高
    { id: 'o8', heroPosition: 'BTN', preflopScenario: 'BTNvsBB', boardCategory: 'dryAHigh', actionLineOTF: 'X-B30-C', pBB: 2 },
    { id: 'o9', heroPosition: 'BTN', preflopScenario: 'BTNvsBB', boardCategory: 'dryAHigh', actionLineOTF: 'X-B80-C', pBB: 2 },
  ];
  const { observations, stats } = buildFlopObservations(hands);
  assert.equal(stats.total, 11);
  assert.equal(stats.attributed, 7);
  assert.equal(stats.donkExcluded, 2);
  assert.equal(stats.checkedThroughExcluded, 1);
  const byId = {};
  observations.forEach((o) => { byId[o.handId] = o; });
  assert.equal(byId['o1'].didBet, true);
  assert.equal(byId['o1'].sizingBucket, 'mid');
  assert.equal(byId['o1'].question, 'cbet');
  assert.equal(byId['o1'].role, 'aggressor');
  assert.equal(byId['o3'].didBet, false);
  assert.equal(byId['o4'].question, 'facebet');
  assert.equal(byId['o4'].didFold, true);
  assert.equal(byId['o5'].question, 'cbet');
  assert.equal(byId['o11'].question, 'cbet');
  assert.equal(byId['o8'].sizingBucket, 'low');
  assert.equal(byId['o9'].sizingBucket, 'high');
  assert.equal(observations.every((o) => o.observationVersion === OBSERVATION_VERSION), true);
});

test('radar signals use deterministic ids and deviation thresholds', async () => {
  const { DecisionRadar } = await import('../../src/modules/decisionRadar.js');
  const obs = [];
  // 8 手 BTNvsBB·monotone 全 C-bet
  for (let i = 0; i < 8; i++) {
    obs.push({ handId: 'sig' + i, scenario: 'BTNvsBB', boardCategory: 'monotone', question: 'cbet', didBet: true, didFold: false, pBB: 4 });
  }
  // 基线补充 12 手其他牌面（8 手 C-bet，使该 spot 自身偏差 <15pp）
  for (let i = 0; i < 12; i++) {
    obs.push({ handId: 'base' + i, scenario: 'BTNvsBB', boardCategory: 'dryAHigh', question: 'cbet', didBet: i < 8, didFold: false, pBB: 1 });
  }
  const signals = DecisionRadar.buildSignals(obs);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].id, 'radar|BTNvsBB|flop|monotone|cbet');
  assert.equal(signals[0].spotFreq, 100);
  assert.equal(signals[0].baselineFreq, 80);
  assert.equal(signals[0].deviationPP, 20);
  assert.equal(signals[0].sampleHandIds.length, 8);
  // 样本不足（7 手 spot）→ 无信号
  assert.equal(DecisionRadar.buildSignals(obs.slice(1)).length, 0);
  // 偏差不足（基线同样全 C-bet）→ 无信号
  const flat = obs.map((o) => Object.assign({}, o, { didBet: true }));
  assert.equal(DecisionRadar.buildSignals(flat).length, 0);
});

test('dossier lifecycle persists through export/import merge', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const { OBSERVATION_VERSION } = await import('../../src/modules/analysisReadModel.js');
  DossierRepo.saveAll([{
    id: 'd-1', signalId: 'radar|X', spotKey: 'X', title: 'T', status: 'open',
    hypothesis: 'h1', counterexamples: '', nextSteps: '', sampleHandIds: ['a'],
    observationVersion: OBSERVATION_VERSION, createdAt: '2026-08-30 10:00', updatedAt: '2026-08-30 10:00',
  }]);
  const data = Store.exportAll();
  assert.ok(Array.isArray(data.dossiers));
  assert.throws(() => Store.importAll({ dossiers: {} }), /dossiers 应为数组/);
  Store.importAll({ dossiers: [{ id: 'd-1', status: 'open' }, { id: 'd-2', signalId: 'radar|Y' }] });
  const all = DossierRepo.getAll();
  assert.equal(all.length, 2);
  assert.equal(all.filter((d) => d.id === 'd-1')[0].hypothesis, 'h1');  // 合并不覆盖
  assert.ok(all.filter((d) => d.id === 'd-2')[0]);
});

test('storage coordinator prefers IndexedDB and falls back on read failure', async () => {
  localStorage.clear();
  localStorage.setItem('pa_sessions', JSON.stringify([{ id: 'local-1' }]));
  const indexedDB = {
    isReady() { return true; },
    readAll() { return Promise.resolve([{ id: 'indexed-1' }]); },
    writeAll() { return Promise.resolve(); },
    count() { return Promise.resolve(1); },
  };
  const primary = new PersistenceCoordinator({
    local: new LocalStorageAdapter(localStorage),
    indexedDB,
  });
  assert.deepEqual(await primary.loadCollection('sessions'), {
    items: [{ id: 'indexed-1' }],
    backend: 'indexeddb',
  });

  const failing = new PersistenceCoordinator({
    local: new LocalStorageAdapter(localStorage),
    indexedDB: {
      isReady() { return true; },
      readAll() { return Promise.reject(new Error('simulated IndexedDB read failure')); },
      writeAll() { return Promise.resolve(); },
      count() { return Promise.resolve(0); },
    },
  });
  assert.deepEqual(await failing.loadCollection('sessions'), {
    items: [{ id: 'local-1' }],
    backend: 'localstorage',
  });
});

test('safe-mode startup is idempotent and preserves imported data', async () => {
  localStorage.clear();
  localStorage.setItem('pa_sessions', JSON.stringify([{ id: 'stable-session', profit: 3 }]));
  await initStorage({ safeMode: true });
  await initStorage({ safeMode: true });
  assert.deepEqual(SessionRepo.getAll(), [{ id: 'stable-session', profit: 3 }]);
});

// [V7.9.0 新增] Phase 0a：按块盲注 / 去重 / 事实落库 / Session 等级派生 / Discover 缓存失效

const nl5MergedHand = [
  'Poker Hand #MIXNL5A: Hold\'em No Limit ($0.02/$0.05) - 2026/06/01 10:00:00',
  'Table \'T5\' 9-max Seat #1 is the button',
  'Seat 1: Hero ($5.00 in chips)',
  'Seat 2: Villain ($5.00 in chips)',
  'Villain: posts small blind $0.02',
  'Hero: posts big blind $0.05',
  '*** HOLE CARDS ***',
  'Dealt to Hero [Ah Kh]',
  'Villain: folds',
  'Hero collected $0.07 from pot',
  '*** SUMMARY ***',
].join('\n');

const nl10MergedHand = [
  'Poker Hand #MIXNL10A: Hold\'em No Limit ($0.05/$0.1) - 2026/06/01 10:05:00',
  'Table \'T10\' 9-max Seat #1 is the button',
  'Seat 1: Hero ($10.00 in chips)',
  'Seat 2: Villain ($10.00 in chips)',
  'Villain: posts small blind $0.05',
  'Hero: posts big blind $0.10',
  '*** HOLE CARDS ***',
  'Dealt to Hero [As Kd]',
  'Villain: folds',
  'Hero collected $0.15 from pot',
  '*** SUMMARY ***',
].join('\n');

test('GG parser derives big blind per block for mixed-stake merges', () => {
  const hands = GGParser.parse(nl5MergedHand + '\n\n' + nl10MergedHand);
  assert.equal(hands.length, 2);
  assert.equal(hands[0].bbValue, 0.05);
  assert.ok(Math.abs(hands[0].profitBB - 0.4) < 0.01);
  assert.equal(hands[1].bbValue, 0.1);
  assert.ok(Math.abs(hands[1].profitBB - 0.5) < 0.01);
});

test('GG parser falls back to the posts line when the header big blind is anomalous', () => {
  const anomalous = nl10MergedHand
    .replace('($0.05/$0.1)', '($0.05/$0.0)')
    .replace('#MIXNL10A', '#MIXBADB');
  const [hand] = GGParser.parse(anomalous);
  assert.equal(hand.bbValue, 0.1);
  assert.ok(Math.abs(hand.profitBB - 0.5) < 0.01);
});

test('GG parser records tableMax from the -max marker and stays 0 when absent', () => {
  const [nineMax] = GGParser.parse(anteAndBoardHand);
  assert.equal(nineMax.tableMax, 9);
  const [headsUp] = GGParser.parse(btnVsBbHand);
  assert.equal(headsUp.tableMax, 2);
  const [unknown] = GGParser.parse(anteAndBoardHand.replace(' 9-max ', ' '));
  assert.equal(unknown.tableMax, 0);
});

test('GG parser reports hands with unparseable dates as failures instead of silent drops', () => {
  const result = GGParser.parseDetailed(nl5MergedHand.replace('2026/06/01', '2026/06/100'));
  assert.equal(result.hands.length, 0);
  assert.equal(result.total, 1);
  assert.ok(result.failures.some((failure) => failure.reason.includes('时间')));
});

test('import plan deduplicates hands repeated across merged files', () => {
  let nextId = 0;
  const generateId = () => 'gen-' + (++nextId);
  const plan = buildImportPlan(
    [
      { handId: 'same-1', date: '2026-05-01 10:00', profitBB: 2 },
      { handId: 'same-1', date: '2026-05-01 10:05', profitBB: 2 },
    ],
    [],
    [],
    { generateId }
  );
  assert.equal(plan.summary.duplicates, 1);
  assert.equal(plan.summary.imported, 1);
  assert.equal(plan.records.length, 1);
});

test('import records persist hero fact fields and overwrite patch refreshes them', () => {
  let nextId = 0;
  const generateId = () => 'gen-' + (++nextId);
  const parsedHand = {
    handId: 'facts-1', date: '2026-05-01 10:00', profitBB: 3,
    boardCode: 'AhJh2h', boardCategory: 'monotone', opponentId: 'Villain',
    heroPosition: 'BB', heroCards: 'Ah Kh', bbValue: 0.05,
    heroStartStack: 10, heroEndStack: 10.15, tableMax: 9,
  };
  const plan = buildImportPlan([parsedHand], [], [], { generateId });
  const record = plan.records[0];
  assert.equal(record.heroPosition, 'BB');
  assert.equal(record.heroCards, 'Ah Kh');
  assert.equal(record.bbValue, 0.05);
  assert.equal(record.heroStartStack, 10);
  assert.equal(record.heroEndStack, 10.15);
  assert.equal(record.tableMax, 9);
  assert.equal(record.marked, false);

  const patch = createOverwritePatch(parsedHand);
  assert.equal(patch.heroPosition, 'BB');
  assert.equal(patch.heroCards, 'Ah Kh');
  assert.equal(patch.bbValue, 0.05);
  assert.equal(patch.heroStartStack, 10);
  assert.equal(patch.heroEndStack, 10.15);
  assert.equal(patch.tableMax, 9);
  assert.equal('decision' in patch, false);
  assert.equal('mistake' in patch, false);
  assert.equal('reflection' in patch, false);
  assert.equal('sessionId' in patch, false);
  assert.equal('marked' in patch, false);
});

test('import derives session level from blinds and splits stake changes', () => {
  let nextId = 0;
  const generateId = () => 'gen-' + (++nextId);
  const nl10Hands = [
    { handId: 'l1', date: '2026-05-01 10:00', profitBB: 1, bbValue: 0.1 },
    { handId: 'l2', date: '2026-05-01 10:20', profitBB: 2, bbValue: 0.1 },
  ];
  // 同日同档位的既有 Session 被复用
  const planMatched = buildImportPlan(nl10Hands, [], [{ id: 's-old', date: '2026-05-01', level: 'NL10' }], { generateId });
  assert.equal(planMatched.sessionMappings[0].session.id, 's-old');
  assert.equal(planMatched.summary.newSessions, 0);
  // 同日但档位不同的既有 Session 不再被错并，按盲注新建 NL10
  const planSplit = buildImportPlan(nl10Hands, [], [{ id: 's-nl5', date: '2026-05-01', level: 'NL5' }], { generateId });
  assert.equal(planSplit.summary.newSessions, 1);
  assert.equal(planSplit.sessionMappings[0].session.level, 'NL10');
  // 同小时内档位变化强制切组
  const planMixed = buildImportPlan(
    [
      { handId: 'm1', date: '2026-05-01 10:00', profitBB: 1, bbValue: 0.1 },
      { handId: 'm2', date: '2026-05-01 10:10', profitBB: 1, bbValue: 0.25 },
    ],
    [],
    [],
    { generateId }
  );
  assert.equal(planMixed.summary.newSessions, 2);
  assert.deepEqual(planMixed.sessionMappings.map((mapping) => mapping.session.level), ['NL10', 'NL25']);
});

test('import aggregates session hands and profit across split groups', () => {
  let nextId = 0;
  const generateId = () => 'gen-' + (++nextId);
  // 同日同档位被 >1h 间隔切成两个分组：Session 统计应取总和而非首个分片
  const hands = [
    { handId: 'g1', date: '2026-05-01 10:00', profitBB: 1, bbValue: 0.1 },
    { handId: 'g2', date: '2026-05-01 15:00', profitBB: 2.5, bbValue: 0.1 },
    { handId: 'g3', date: '2026-05-01 15:10', profitBB: -0.5, bbValue: 0.1 },
  ];
  const plan = buildImportPlan(hands, [], [], { generateId });
  assert.equal(plan.summary.newSessions, 1);
  assert.equal(plan.sessionMappings[0].session.hands, 3);
  assert.equal(plan.sessionMappings[0].session.profit, 3);
  // 同日混档位各自成场，互不串数
  const mixed = buildImportPlan(
    [
      { handId: 'm1', date: '2026-05-02 10:00', profitBB: 1, bbValue: 0.1 },
      { handId: 'm2', date: '2026-05-02 10:05', profitBB: 2, bbValue: 0.25 },
    ],
    [],
    [],
    { generateId }
  );
  assert.equal(mixed.summary.newSessions, 2);
  const byLevel = {};
  mixed.sessionMappings.forEach((mapping) => { byLevel[mapping.session.level] = mapping.session; });
  assert.equal(byLevel.NL10.hands, 1);
  assert.equal(byLevel.NL10.profit, 1);
  assert.equal(byLevel.NL25.hands, 1);
  assert.equal(byLevel.NL25.profit, 2);
});

test('discover scan cache invalidates on hand data changes with unchanged count', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const { Discover } = await import('../../src/modules/discover.js');
  const losingHands = [];
  for (let i = 0; i < 55; i++) {
    losingHands.push({
      id: 'dh' + i,
      boardCategory: 'monotone',
      preflopScenario: 'BTNvsBB',
      actionLineOTF: 'B60',
      pBB: -2,
      desc: '',
    });
  }
  HandRepo.saveAll(losingHands);
  Discover.init();
  const firstScan = Discover.scan();
  assert.ok(firstScan.some((finding) => finding.type === 'profit_anomaly'));

  // 手牌数量不变、仅修改内容：修复前 Discover 会返回陈旧缓存
  const winningHands = losingHands.map(function (hand) {
    return Object.assign({}, hand, { pBB: 5 });
  });
  HandRepo.saveAll(winningHands);
  const secondScan = Discover.scan();
  assert.ok(!secondScan.some((finding) => finding.type === 'profit_anomaly'));
  assert.equal(Discover.getScanHandCount(), 55);
});

// ---- Hand Replay（V7.10.0）：回放解析纯函数与只读约束 ----

// [V7.10.0 新增] 把 GG 解析结果映射成 handReviews 存储记录形状（_makeReviewRecord 同构）
function buildStoredRecordFromParser(block, id) {
  const parsed = GGParser.parseDetailed(block).hands[0];
  return {
    id: id,
    sessionId: null,
    date: parsed.date,
    potType: parsed.potType,
    board: parsed.board,
    boardCode: parsed.boardCode || '',
    boardCategory: parsed.boardCategory || '',
    preflopScenario: parsed.preflopScenario || 'other',
    actionLineOTF: parsed.actionLineOTF || '',
    actionLineOTT: parsed.actionLineOTT || '',
    actionLineOTR: parsed.actionLineOTR || '',
    desc: parsed.desc,
    pBB: parsed.profitBB != null ? parsed.profitBB : null,
    gg: true,
    ggId: parsed.handId,
    oCards: parsed.opponentCards || '',
    heroPosition: parsed.heroPosition || '',
    heroCards: parsed.heroCards || '',
    bbValue: parsed.bbValue || 0,
    heroStartStack: parsed.heroStartStack || 0,
    heroEndStack: parsed.heroEndStack || 0,
    tableMax: parsed.tableMax || 0,
  };
}

const fullStreetBlock = [
  "Poker Hand #RP900: Hold'em No Limit ($0.02/$0.05) - 2026/06/01 10:00:00",
  "Table 'NLH' 6-max Seat #1 is the button",
  'Seat 1: Hero ($5.00 in chips)',
  'Seat 2: Villain ($5.00 in chips)',
  'Seat 3: Fish ($5.00 in chips)',
  'Hero: posts small blind $0.02',
  'Villain: posts big blind $0.05',
  'Fish: folds',
  '*** HOLE CARDS ***',
  'Dealt to Hero [Ah Kd]',
  'Villain: raises $0.10 to $0.15',
  'Hero: calls $0.10',
  '*** FLOP *** [Ah 7c 2d]',
  'Hero: checks',
  'Villain: bets $0.16',
  'Hero: calls $0.16',
  '*** TURN *** [Qs]',
  'Hero: checks',
  'Villain: bets $0.25',
  'Hero: calls $0.25',
  '*** RIVER *** [3h]',
  'Hero: checks',
  'Villain: bets $0.50',
  'Hero: folds',
  '*** SUMMARY ***',
  'Total pot $1.34 | Rake $0.02',
  'Board [Ah 7c 2d Qs 3h]',
].join('\n');

test('hand replay parses a full four-street GG hand with accumulated board', () => {
  const record = buildStoredRecordFromParser(fullStreetBlock, 'replay-full');
  const model = HandReplay.parseReplay(record);
  assert.equal(model.degraded, false);
  assert.deepEqual(model.streets.map((s) => s.key), ['preflop', 'flop', 'turn', 'river']);
  const heroSeg = model.streets[0].actions.find((a) => a.kind === 'hero');
  assert.ok(heroSeg && heroSeg.pos, 'preflop hero segment carries a position');
  assert.deepEqual(model.hero.cards, ['Ah', 'Kd']);
  assert.deepEqual(model.streets[1].actions.map((a) => a.kind), ['check', 'bet', 'call']);
  assert.ok(model.streets[1].investedBB > 0);
  const flopAcc = [];
  model.streets.slice(0, 2).forEach((s) => flopAcc.push(...s.newCards));
  assert.equal(flopAcc.length, 3);
  assert.deepEqual(model.board, ['Ah', '7c', '2d', 'Qs', '3h']);
  assert.equal(model.result.pBB, record.pBB);
});

test('hand replay degrades on manual records and unknown hole cards without throwing', () => {
  const manual = HandReplay.parseReplay({
    id: 'replay-manual',
    desc: 'preflop 行动：Hero /[Xx Xx] \nOTF翻牌 牌面：    行动：\nOTT转牌 牌面：    行动：\nOTR河牌 牌面：    行动：',
    pBB: null,
  });
  assert.equal(manual.degraded, true);
  assert.equal(manual.degradedReason, 'manual_record');
  const unknownCards = HandReplay.parseReplay({
    id: 'replay-unknown',
    gg: true,
    desc: 'preflop 行动：Hero BTN/[??] raises to 2.5bb, BB Call',
    heroCards: '??',
  });
  assert.equal(unknownCards.degraded, true);
  assert.equal(unknownCards.degradedReason, 'no_hero_cards');
  assert.equal(HandReplay.parseReplay(null).degraded, true);
  assert.equal(HandReplay.parseReplay({ gg: true, desc: '' }).degraded, true);
});

test('hand replay degrades safely on inconsistent streets and renders partial runouts', () => {
  const conflict = HandReplay.parseReplay({
    id: 'replay-conflict',
    gg: true,
    heroCards: 'Ah Kd',
    desc: 'preflop 行动：Hero BTN/[Ah Kd] calls 2.0bb, SB Raise 3.0bb\nOTF翻牌 Ah 7c 2d    行动：X C\nOTT转牌 Ah    行动：X',
  });
  assert.equal(conflict.degraded, true);
  assert.equal(conflict.degradedReason, 'board_conflict');
  const partial = HandReplay.parseReplay({
    id: 'replay-partial',
    gg: true,
    heroCards: 'Ah Kd',
    heroPosition: 'BTN',
    pBB: -3.2,
    desc: 'preflop 行动：Hero BTN/[Ah Kd] calls 2.0bb, SB Raise 3.0bb\nOTF翻牌 Ah 7c 2d    行动：X C',
  });
  assert.equal(partial.degraded, false);
  assert.deepEqual(partial.streets.map((s) => s.key), ['preflop', 'flop']);
});

test('hand replay parsing never mutates the hand record or stored data', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const record = buildStoredRecordFromParser(fullStreetBlock, 'replay-readonly');
  HandRepo.saveAll([record]);
  const beforeRepo = JSON.stringify(HandRepo.getAll());
  const beforeLS = localStorage.getItem('pa_handReviews');
  const beforeHand = JSON.stringify(record);
  const model = HandReplay.parseReplay(record);
  assert.equal(model.degraded, false);
  assert.equal(JSON.stringify(record), beforeHand);
  assert.equal(JSON.stringify(HandRepo.getAll()), beforeRepo);
  assert.equal(localStorage.getItem('pa_handReviews'), beforeLS);
  // 结构性只读保证：回放模块源码不 import store 模块、不调用任何写路径方法
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../src/modules/handReplay.js', import.meta.url), 'utf8');
  assert.ok(!/from ['"].*store|saveAll|persistNow/.test(src), 'handReplay.js must not import store or call write paths');
});

// [V7.10.1 新增] Phase 3 Evidence & Strategy

test('strategy desk converts a dossier into a strategy draft', async () => {
  const { StrategyDesk } = await import('../../src/modules/strategyDesk.js');
  const draft = StrategyDesk.buildDraftFromDossier({
    id: 'dossier-1',
    spotKey: 'BTNvsBB|flop|monotone|cbet',
    title: 'C-Bet · monotone · BTNvsBB',
    nextSteps: '补 30 手干燥面样本',
  });
  assert.equal(draft.familyKey, 'BTNvsBB|flop');
  assert.deepEqual(draft.spotKeys, ['BTNvsBB|flop|monotone|cbet']);
  assert.deepEqual(draft.dossierIds, ['dossier-1']);
  assert.equal(draft.status, 'candidate-adjustment');
  assert.ok(draft.reviewCondition.includes('30 手'));
});

test('evidence packs and strategy revisions persist through export/import merge', async () => {
  localStorage.clear();
  await initStorage({ safeMode: true });
  const now = '2026-08-30 10:00';
  EvidencePackRepo.saveAll([{
    id: 'ev-1', title: '视频笔记', sourceType: 'video', sourceRef: 'https://example.com/v1',
    conditions: '6max 100bb', methodSample: '样本 500 手', capturedAt: '2026-08-01',
    transferBoundary: '勿直接用于 9max', keyPoints: 'BTN 开池尺寸', createdAt: now, updatedAt: now,
  }]);
  StrategyRepo.saveAll([{
    id: 'st-1', familyKey: 'BTNvsBB|flop', spotKeys: ['BTNvsBB|flop|monotone|cbet'],
    title: 'BTNvsBB 翻牌策略', status: 'candidate-adjustment', scope: '9max 100-200bb',
    statement: '天花面高频 C-bet', evidenceIds: ['ev-1'], dossierIds: ['d-1'],
    reviewCondition: '样本 +50', baselineSnapshot: null, createdAt: now, updatedAt: now,
  }]);
  const data = Store.exportAll();
  assert.ok(Array.isArray(data.evidencePacks));
  assert.ok(Array.isArray(data.strategyRevisions));
  assert.throws(() => Store.importAll({ evidencePacks: 'x' }), /evidencePacks 应为数组/);
  assert.throws(() => Store.importAll({ strategyRevisions: 'x' }), /strategyRevisions 应为数组/);
  Store.importAll({
    evidencePacks: [{ id: 'ev-1', title: '导入版' }, { id: 'ev-2' }],
    strategyRevisions: [{ id: 'st-2', familyKey: 'SBvsBB|flop' }],
  });
  assert.equal(EvidencePackRepo.getAll().length, 2);
  assert.equal(EvidencePackRepo.getAll().find((p) => p.id === 'ev-1').title, '视频笔记');  // 合并不覆盖
  assert.equal(StrategyRepo.getAll().length, 2);
  assert.equal(StrategyRepo.getAll().find((s) => s.id === 'st-1').evidenceIds[0], 'ev-1');
});

const showdownBlock = [
  "Poker Hand #RP980: Hold'em No Limit ($0.02/$0.05) - 2026/06/01 10:00:00",
  "Table 'NLH' 6-max Seat #1 is the button",
  'Seat 1: Hero ($5.00 in chips)',
  'Seat 2: Villain ($5.00 in chips)',
  'Hero: posts small blind $0.02',
  'Villain: posts big blind $0.05',
  '*** HOLE CARDS ***',
  'Dealt to Hero [Ah Kd]',
  'Villain: raises $0.10 to $0.15',
  'Hero: calls $0.10',
  '*** FLOP *** [Ah 7c 2d]',
  'Hero: checks',
  'Villain: bets $0.16',
  'Hero: calls $0.16',
  '*** TURN *** [Qs]',
  'Hero: checks',
  'Villain: bets $0.25',
  'Hero: calls $0.25',
  '*** RIVER *** [3h]',
  'Hero: checks',
  'Villain: bets $0.50',
  'Hero: calls $0.50',
  'Hero shows [Ah Kd] (one pair)',
  'Villain: shows [Qh Jh] (flush)',
  '*** SHOWDOWN ***',
  'Villain collected $1.84 from pot',
  '*** SUMMARY ***',
  'Total pot $1.84 | Rake $0.02',
  'Board [Ah 7c 2d Qs 3h]',
  'Seat 2: Villain ($5.13 in chips) showed [Qh Jh] and won ($1.84) with (a flush)',
].join('\n');

test('hand replay extracts showdown shows suffix and opponent lines', () => {
  const record = buildStoredRecordFromParser(showdownBlock, 'replay-showdown');
  const model = HandReplay.parseReplay(record);
  assert.equal(model.degraded, false);
  // 末街行尾 shows 后缀已剥离，不混入动作 token
  assert.deepEqual(model.streets[3].actions.map((a) => a.kind), ['check', 'bet', 'call']);
  assert.deepEqual(model.showdown.hero.cards, ['Ah', 'Kd']);
  assert.equal(model.showdown.hero.desc, 'one pair');
  assert.equal(model.showdown.opponents.length, 1);
  const opp = model.showdown.opponents[0];
  assert.equal(opp.who, 'BB');
  assert.deepEqual(opp.cards, ['Qh', 'Jh']);
  assert.equal(opp.result, 'won');
  assert.ok(opp.amountText.indexOf('$1.84') !== -1);
});
