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

const { Store, SessionRepo, HandRepo, BaseRepo, initStorage } = await import('../../src/store/store.js');
const { LocalStorageAdapter, PersistenceCoordinator } = await import('../../src/store/storage.js');
const { buildImportPlan, createOverwritePatch } = await import('../../src/modules/ggImportCoordinator.js');
const { normalizeLearningHand, createLearningSnapshot, getLearningTarget } = await import('../../src/modules/analysisReadModel.js');

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
