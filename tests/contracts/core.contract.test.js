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

const { Store, SessionRepo, HandRepo } = await import('../../src/store/store.js');

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

test('storage import merges records without overwriting local records', () => {
  localStorage.clear();
  SessionRepo._cache = [];
  HandRepo._cache = [];
  SessionRepo._dbReady = false;
  HandRepo._dbReady = false;

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
