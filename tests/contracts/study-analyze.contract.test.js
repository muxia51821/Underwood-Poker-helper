import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisQueue, handLearningContext, referenceAverage, studyBoards, STUDY_SCENARIOS } from '../../src/modules/studyAnalyzeModel.js';

// [V7.13.0 新增] The queue must preserve hand facts and never promote winnings to decision quality.
test('analysis filtering keeps unknown profiles and missing profit distinct without modifying facts', () => {
  const hands = [
    { id: 'nine', date: '2026-10-15', tableMax: 9, marked: true, pBB: -12, preflopScenario: 'BTNvsBB', reflection: '价格与范围' },
    { id: 'six', date: '2026-10-16', tableMax: 6, marked: false, pBB: 30, preflopScenario: 'SBvsBB', mistake: '尺寸' },
    { id: 'unknown', date: '2026-10-14', pBB: null },
    { id: 'zero', date: '2026-10-13', tableMax: 9, pBB: 0 },
  ];
  const snapshot = JSON.stringify(hands);
  assert.deepEqual(analysisQueue(hands, { profile: '9max' }).map(h => h.id), ['nine', 'zero']);
  assert.deepEqual(analysisQueue(hands, { profile: 'unknown-table' }).map(h => h.id), ['unknown']);
  assert.deepEqual(analysisQueue(hands, { flag: 'marked' }).map(h => h.id), ['nine']);
  assert.deepEqual(analysisQueue(hands, { flag: 'mistake' }).map(h => h.id), ['six']);
  assert.deepEqual(analysisQueue(hands, { query: '  价格 ' }).map(h => h.id), ['nine']);
  assert.deepEqual(analysisQueue(hands, { scenario: 'SBvsBB', profile: '9max' }), []);
  assert.deepEqual(analysisQueue(hands, { sort: 'loss' }).map(h => h.id), ['nine', 'zero', 'six', 'unknown']);
  assert.deepEqual(analysisQueue(hands, { sort: 'swing' }).map(h => h.id), ['six', 'nine', 'zero', 'unknown']);
  assert.equal(JSON.stringify(hands), snapshot);
});

test('learning routes keep defense separate from aggregate attacking references and do not infer stack depth', () => {
  const context = handLearningContext({ id: 'defense', tableMax: 9, preflopScenario: 'BTNvsBB', heroPosition: 'BB',
    actionLineOTF: 'X-B33-C', boardCode: 'As 7d 2c', heroStartStack: 200 });
  assert.deepEqual(context, { handId: 'defense', topicId: 'defense', scenario: 'BTNvsBB', boardCode: 'As7d2c' });
  assert.equal(handLearningContext({ id: 'unknown', preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'X-B33-C' }).topicId, 'ranges');
  assert.equal(handLearningContext({ id: 'river', actionLineOTR: 'B50-C' }).topicId, 'river');
});

test('board filters and sorting preserve source frequencies and distinguish a subset mean from weighted strategy', () => {
  const snapshot = JSON.stringify(STUDY_SCENARIOS);
  const all = studyBoards('BTNvsBB');
  assert.equal(all.length, 183);
  assert.equal(studyBoards('unknown').length, 0);
  const mono = studyBoards('BTNvsBB', { category: 'monotone', sort: 'bet' });
  assert.ok(mono.length > 1 && mono.every(board => board.category === 'monotone'));
  assert.ok(mono.every((board, index) => index === 0 || board.bet <= mono[index - 1].bet));
  assert.equal(studyBoards('BTNvsBB', { query: ' Ts Td Tc ' })[0].code, 'TsTdTc');
  assert.equal(studyBoards('BTNvsBB', { query: 'not-a-board' }).length, 0);
  assert.equal(referenceAverage([]), null);
  const average = referenceAverage([{ bet75: 10, bet50: 0, bet33: 20, check: 70 }, { bet75: 20, bet50: 10, bet33: 50, check: 20 }]);
  assert.deepEqual(average, { bet75: 15, bet50: 5, bet33: 35, check: 45, count: 2, weighting: 'unweighted-recorded-boards' });
  assert.equal(JSON.stringify(STUDY_SCENARIOS), snapshot);
});
