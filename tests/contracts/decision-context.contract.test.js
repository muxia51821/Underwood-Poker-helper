import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionContext, updateDecisionReview } from '../../src/modules/decisionContext.js';
import { validateWorkbenchState, WORKBENCH_KEY } from '../../src/store/decisionWorkspaceStore.js';
import { exportLearningState, planLearningImport, applyLearningImport } from '../../src/store/practiceStore.js';
import { postflopReview, postflopFacts } from '../../src/modules/postflopReviewModel.js';
import course from '../../src/data/solutions/turn-river-course.json' with { type: 'json' };
import { startCourseRound, answerCourseRound, nextCourseDecision, courseNode, validateCourseLibrary, mergeCourseLibraries } from '../../src/modules/postflopCourseModel.js';
const hand = { id: 'decision-fixture', ggId: 'SYNTHETIC', gg: true, heroPosition: 'BTN', heroCards: 'Ah Kh', tableMax: 9, preflopScenario: 'BTNvsBB', pBB: -12,
  desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C\nOTT转牌 9s 行动：X X\nOTR河牌 4h 行动：X B50 (3bb) F', reflection: 'original', custom: { value: 'preserve' } };

test('research course keeps a held hand, hides future decisions until continuing, and never creates a grade', () => {
  let r = startCourseRound(course, 'AhQh');
  assert.equal(course.scoringEligible, false);
  assert.equal(r.riverCard, undefined); assert.equal(r.events.length, 0);
  assert.throws(() => nextCourseDecision(course, r), /不完整/);
  r = answerCourseRound(course, r, 'check', 'showdown or draw', 'change plan on a heart');
  assert.equal(r.nodeId, 'root'); assert.equal(r.responses.root.correct, undefined);
  r = nextCourseDecision(course, r, () => 0);
  assert.equal(r.cards, 'AhQh'); assert.equal(courseNode(course, r.nodeId).board.at(-1), 'Ac');
  assert.equal(r.responses.root.plan, 'change plan on a heart');
  assert.equal(r.status, 'active');
  r = nextCourseDecision(course, answerCourseRound(course, r, 'check', 'river reasoning', ''), () => 0);
  assert.equal(r.status, 'completed'); assert.equal(Object.keys(r.responses).length, 2);
  assert.doesNotThrow(() => validateCourseLibrary({ [course.contentHash]: { snapshot: course, rounds: [r], selectedId: r.id } }));
  const broken = structuredClone(r); broken.events[0].actionId = 'not-an-action';
  assert.throws(() => validateCourseLibrary({ [course.contentHash]: { snapshot: course, rounds: [broken], selectedId: r.id } }));
});

test('course snapshots and drafts round trip in the existing complete learning backup and merge by round identity', () => {
  const values = new Map(), memory = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const first = startCourseRound(course, 'AhQh'), other = startCourseRound(course, 'KhQd');
  first.responses.root = { submitted: false, reason: 'unfinished reason', plan: 'unfinished plan' };
  const entry = { snapshot: course, rounds: [first], selectedId: first.id };
  const original = { version: 1, selectedId: '', attached: false, filters: {}, positions: {}, drafts: {}, turnRiverCourses: { [course.contentHash]: entry } };
  memory.setItem(WORKBENCH_KEY, JSON.stringify(original));
  const backup = exportLearningState(memory), restoredValues = new Map();
  const restored = { getItem: k => restoredValues.get(k) ?? null, setItem: (k, v) => restoredValues.set(k, v), removeItem: k => restoredValues.delete(k) };
  applyLearningImport(planLearningImport(backup, restored), restored);
  assert.deepEqual(validateWorkbenchState(JSON.parse(restored.getItem(WORKBENCH_KEY))), original);
  const incoming = structuredClone(original); incoming.turnRiverCourses[course.contentHash].rounds = [other, { ...first, summary: 'incoming conflict' }];
  incoming.turnRiverCourses[course.contentHash].selectedId = other.id;
  applyLearningImport(planLearningImport({ version: 1, values: { [WORKBENCH_KEY]: JSON.stringify(incoming) } }, restored), restored);
  const merged = JSON.parse(restored.getItem(WORKBENCH_KEY)).turnRiverCourses[course.contentHash];
  assert.deepEqual(merged.rounds, [first, other]); assert.equal(merged.selectedId, first.id);
  assert.equal(mergeCourseLibraries({ [course.contentHash]: entry }, { [course.contentHash]: entry })[course.contentHash].rounds.length, 1);
  incoming.turnRiverCourses[course.contentHash].snapshot.title = 'changed without hash';
  const before = restored.getItem(WORKBENCH_KEY);
  assert.throws(() => planLearningImport({ version: 1, values: { [WORKBENCH_KEY]: JSON.stringify(incoming) } }, restored), /专项/);
  assert.equal(restored.getItem(WORKBENCH_KEY), before);
});
test('viewed street and selected prefix determine learning without future outcome or automatic attribution', () => {
  const source = JSON.stringify(hand);
  const context = decisionContext(hand, { street: 'flop', actionIndex: 1, decisionKind: 'facingBet', question: 'price?' });
  assert.equal(context.topicId, 'defense'); assert.equal(context.street, 'flop');
  assert.deepEqual(context.board, ['As', '7d', '2c']); assert.deepEqual(context.prefix.at(-1).actions, ['过牌']);
  assert.equal(context.attribution, 'unconfirmed'); assert.equal(context.effectiveStack, null);
  assert.ok(!JSON.stringify(context).includes('9s') && !JSON.stringify(context).includes('4h'));
  assert.equal(decisionContext(hand, { street: 'turn' }).topicId, 'turn');
  assert.equal(decisionContext(hand, { street: 'preflop' }).topicId, 'preflop');
  assert.equal(decisionContext(hand, { street: 'flop', actionIndex: 99 }).eligible, false);
  assert.equal(JSON.stringify(hand), source);
});
test('decision reflections preserve imported facts and old notes; changed sources require confirmation', () => {
  const context = decisionContext(hand, { street: 'flop', actionIndex: 1 });
  const updated = updateDecisionReview(hand, context, { question: 'why?', reason: 'my assumption', insight: 'boundary', reflection: 'updated', reflectionDirty: true });
  for (const key of ['id', 'ggId', 'gg', 'heroCards', 'tableMax', 'pBB', 'desc', 'custom']) assert.deepEqual(updated[key], hand[key]);
  assert.equal(updated.decisionReviews[context.key].question, 'why?'); assert.equal(updated.reflection, 'updated');
  const turn = decisionContext(updated, { street: 'turn', actionIndex: 0 });
  assert.equal(Object.keys(updateDecisionReview(updated, turn, { insight: 'turn thought' }).decisionReviews).length, 2);
  assert.equal(updateDecisionReview(updated, turn, { reflection: 'stale draft', question: 'why turn?' }).reflection, 'updated');
  assert.throws(() => updateDecisionReview({ ...hand, desc: hand.desc + '\nchanged' }, context, {}), /牌谱已变更/);
});
test('workspace drafts participate in compatible backups and reject invalid locations', () => {
  const state = { version: 1, selectedId: hand.id, attached: true, filters: { flag: 'marked' }, positions: { [hand.id]: { street: 'flop', actionIndex: 1 } }, drafts: { draft: { question: 'keep me' } } };
  assert.equal(validateWorkbenchState(state), state);
  assert.throws(() => validateWorkbenchState({ ...state, positions: { bad: { street: 'other', actionIndex: 0 } } }), /位置/);
  assert.throws(() => validateWorkbenchState({ ...state, drafts: { broken: { references: 'bad' } } }), /来源/);
  const values = new Map(); const memory = { getItem: key => values.get(key) ?? null, setItem: (k, v) => values.set(k, v), removeItem: key => values.delete(key) };
  applyLearningImport(planLearningImport({ version: 1, values: { [WORKBENCH_KEY]: JSON.stringify(state) } }, memory), memory);
  assert.deepEqual(JSON.parse(exportLearningState(memory).values[WORKBENCH_KEY]), state);
  const incoming = { ...state, drafts: { draft: { question: 'backup conflict' }, other: { insight: 'backup only' } } };
  applyLearningImport(planLearningImport({ version: 1, values: { [WORKBENCH_KEY]: JSON.stringify(incoming) } }, memory), memory);
  assert.deepEqual(JSON.parse(memory.getItem(WORKBENCH_KEY)).drafts, { draft: { question: 'keep me' }, other: { insight: 'backup only' } });
});

test('postflop cards preserve entered facts without inferring missing amounts or changing hand facts', () => {
  const draft = { potBb: '5.50', effectiveStackBb: '0', conditionNote: 'manual source', rangeHypothesis: 'value and draws', streetPlan: 'check', nextStreetPlan: 'classify unknown turn cards' };
  assert.deepEqual(postflopFacts(draft), { pot: 5.5, effectiveStack: 0, conditionSource: 'user-entered', conditionNote: 'manual source' });
  assert.equal(postflopFacts({}).pot, null);
  assert.equal(postflopFacts({ effectiveStackBb: '-' }).effectiveStack, null);
  for (const potBb of ['0', '-2', 'NaN', '1e3', '5.']) assert.throws(() => postflopReview({ potBb }, true), /底池/);
  assert.throws(() => postflopReview({ nextStreetPlan: [] }), /字段/);
  const context = decisionContext(hand, { street: 'turn', actionIndex: 0 });
  const updated = updateDecisionReview(hand, context, draft);
  assert.equal(updated.decisionReviews[context.key].nextStreetPlan, draft.nextStreetPlan);
  assert.equal(updated.desc, hand.desc); assert.equal(updated.potBb, undefined);
  assert.throws(() => updateDecisionReview(hand, context, { potBb: '0' }), /底池/);
  const state = { version: 1, selectedId: hand.id, attached: true, filters: {}, positions: {}, drafts: { draft: { ...draft, potBb: '5.' } } };
  assert.doesNotThrow(() => validateWorkbenchState(state));
  const values = new Map(); const memory = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  applyLearningImport(planLearningImport({ version: 1, values: { [WORKBENCH_KEY]: JSON.stringify(state) } }, memory), memory);
  assert.deepEqual(JSON.parse(exportLearningState(memory).values[WORKBENCH_KEY]).drafts, state.drafts);
});
