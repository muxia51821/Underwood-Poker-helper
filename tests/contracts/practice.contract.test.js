import test from 'node:test';
import assert from 'node:assert/strict';
import { blindQuestion, startPractice, submitPractice, nextPractice, repeatPractice, evaluateAnswer } from '../../src/modules/practiceModel.js';
import { createPracticeStore, exportLearningState, planLearningImport, applyLearningImport, validatePracticeState, PRACTICE_KEY } from '../../src/store/practiceStore.js';
import { decisionContext } from '../../src/modules/decisionContext.js';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const hand = { id: 'synthetic-blind', gg: true, date: '2026-10-01', tableMax: 9, heroPosition: 'BTN', heroCards: 'Ah Kh', preflopScenario: 'BTNvsBB', pBB: -12,
  desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C\nOTT转牌 9s 行动：X X\nOTR河牌 4h 行动：X B50 (3bb) F', reflection: 'FUTURE_NOTE' };
const config = { type: 'concept', topicId: 'defense', count: 5, learningQuestion: '价格与范围' };

test('postflop plans freeze behind submission and round trip alongside old personal exercises', () => {
  const node = decisionContext(hand, { street: 'turn', actionIndex: 0 });
  const draft = { potBb: '10', effectiveStackBb: '20', conditionNote: 'manual', streetPlan: 'PRIOR_PLAN', nextStreetPlan: 'PRIOR_NEXT', rangeHypothesis: 'PRIOR_RANGE', insight: 'PRIOR_INSIGHT' };
  const c = { type: 'personal', handId: hand.id, street: 'turn', decisionIndex: 0, decisionKind: 'initiative', confirmed: true,
    personalReview: { handId: hand.id, revision: node.revision, key: node.key, draft } };
  const session = startPractice(c, [hand]); const q = session.questions[0];
  assert.equal(q.context.pot, 10); assert.equal(q.context.effectiveStack, 20);
  assert.equal(q.reveal.review.streetPlan, 'PRIOR_PLAN');
  assert.ok(!JSON.stringify(q.context).includes('PRIOR'));
  assert.ok(!JSON.stringify(session.config).includes('PRIOR'));
  draft.streetPlan = 'MODIFIED'; assert.equal(q.reveal.review.streetPlan, 'PRIOR_PLAN');
  const submitted = submitPractice(session, { choice: '过牌', reason: 'new reasoning', nextStreetPlan: 'new river plan' });
  assert.equal(submitted.responses[q.id].nextStreetPlan, 'new river plan');
  assert.equal(submitted.responses[q.id].evaluation.kind, 'reflection');
  assert.equal(submitted.responses[q.id].evaluation.correct, undefined);
  const memory = storage(), restored = storage();
  createPracticeStore(memory).save({ version: 1, presets: [], sessions: [submitted], activeId: session.id });
  applyLearningImport(planLearningImport(exportLearningState(memory), restored), restored);
  assert.deepEqual(createPracticeStore(restored).load().sessions[0], submitted);
  const changed = structuredClone(submitted); changed.questions[0].context.pot = 100;
  assert.throws(() => validatePracticeState({ version: 1, presets: [], sessions: [changed], activeId: session.id }), /条件/);
  assert.throws(() => startPractice({ ...c, street: 'flop' }, [hand]), /不一致/);
});

test('manual decision projection excludes every future field and needs explicit attribution', () => {
  const node = { street: 'flop', decisionIndex: 1, decisionKind: 'initiative', confirmed: true };
  assert.throws(() => blindQuestion(hand, { ...node, confirmed: false }), /确认/);
  assert.throws(() => blindQuestion(hand, { ...node, decisionIndex: 9 }), /时点/);
  const q = blindQuestion(hand, node);
  const visible = JSON.stringify(q.context);
  assert.ok(!visible.includes('9s') && !visible.includes('4h') && !visible.includes('FUTURE_NOTE') && !visible.includes('-12'));
  assert.deepEqual(q.context.board, ['As', '7d', '2c']);
  assert.deepEqual(q.context.prefix.at(-1).actions, ['过牌']);
  assert.equal(q.context.effectiveStack, null);
  assert.equal(q.reveal.reflection, 'FUTURE_NOTE');
  assert.deepEqual(q.reveal.continuation.map(street => street.street), ['翻牌', '转牌', '河牌']);
  assert.equal(q.reveal.continuation.at(-1).actions.at(-1), '弃牌');
  assert.equal(evaluateAnswer(q, { choice: '过牌', reason: '保留范围' }).correct, undefined);
  const session = startPractice({ ...node, type: 'personal', handId: hand.id, street: 'turn', decisionIndex: 0, learningQuestion: 'turn question' }, [hand]);
  assert.equal(session.config.sourceDecision.street, 'turn');
  assert.deepEqual(session.config.sourceDecision.board, ['As', '7d', '2c', '9s']);
});

test('restoration merges independent learning items while retaining local conflicts', () => {
  const memory = storage();
  memory.setItem('pa_concept_quiz_mastery', '{"A":{"asked":3}}');
  memory.setItem('pa_concept_quiz_errors', '[{"id":"A","chosen":"local"}]');
  memory.setItem('pa_quizState', '{"scenario":"BTNvsBB","records":{"A":{"picks":{"check":2}}}}');
  const backup = { version: 1, values: {
    pa_concept_quiz_mastery: '{"A":{"asked":1},"B":{"asked":2}}',
    pa_concept_quiz_errors: '[{"id":"A","chosen":"backup"},{"id":"B"}]',
    pa_quizState: '{"scenario":"SBvsBB","records":{"A":{"picks":{"check":1}},"B":{"picks":{"bet33":1}}}}',
  } };
  const plan = planLearningImport(backup, memory); applyLearningImport(plan, memory);
  assert.deepEqual(JSON.parse(memory.getItem('pa_concept_quiz_mastery')), { A: { asked: 3 }, B: { asked: 2 } });
  assert.deepEqual(JSON.parse(memory.getItem('pa_concept_quiz_errors')), [{ id: 'A', chosen: 'local' }, { id: 'B' }]);
  const quiz = JSON.parse(memory.getItem('pa_quizState'));
  assert.equal(quiz.scenario, 'BTNvsBB'); assert.equal(quiz.records.A.picks.check, 2); assert.equal(quiz.records.B.picks.bet33, 1);
  applyLearningImport(planLearningImport(backup, memory), memory);
  assert.deepEqual(JSON.parse(memory.getItem('pa_concept_quiz_errors')), [{ id: 'A', chosen: 'local' }, { id: 'B' }]);
});

test('invalid submitted answers and foreign response ids are rejected before restore', () => {
  const session = startPractice(config), q = session.questions[0];
  for (const response of [{ submitted: true }, { submitted: true, choice: q.expected, evaluation: {} }, { submitted: 'yes' }]) {
    const state = { version: 1, presets: [], sessions: [{ ...session, responses: { [q.id]: response } }], activeId: session.id };
    assert.throws(() => validatePracticeState(state), /回答/);
    assert.throws(() => planLearningImport({ version: 1, values: { [PRACTICE_KEY]: JSON.stringify(state) } }, storage()), /回答/);
  }
  assert.throws(() => validatePracticeState({ version: 1, presets: [], sessions: [{ ...session, responses: { foreign: { submitted: false } } }], activeId: session.id }), /回答/);
  const submitted = submitPractice(session, { choice: q.expected });
  assert.doesNotThrow(() => validatePracticeState({ version: 1, presets: [], sessions: [submitted], activeId: session.id }));
});
test('session submissions are idempotent, explicit and versioned; repetition preserves the frozen question', () => {
  const session = startPractice(config, [], () => 0.5);
  assert.equal(session.questions.length, 5);
  assert.throws(() => nextPractice(session), /提交/);
  const q = session.questions[0];
  const submitted = submitPractice(session, { choice: q.expected, reason: 'reason' });
  assert.equal(submitPractice(submitted, { choice: 'different' }), submitted);
  assert.equal(submitted.index, 0);
  assert.equal(submitted.responses[q.id].evaluation.correct, true);
  assert.equal(nextPractice(submitted).index, 1);
  const repeated = repeatPractice({ ...submitted, status: 'stopped' });
  assert.deepEqual(repeated.questions, session.questions);
  assert.deepEqual(repeated.responses, {});
  assert.notEqual(repeated.id, session.id);
  assert.equal(q.scoringVersion, 'concept-answer-v1');
  const wrong = submitPractice(session, { choice: q.choices.find(choice => choice !== q.expected) });
  assert.equal(wrong.responses[q.id].review, true);
});
test('range answers compare aggregate frequencies without creating correctness or EV', () => {
  const session = startPractice({ type: 'range', scenario: 'BTNvsBB', category: 'monotone', input: 'frequency', detail: 'simple', count: 20 });
  assert.ok(session.questions.length > 0 && session.questions.length <= 20);
  assert.equal(new Set(session.questions.map(q => q.id)).size, session.questions.length);
  const q = session.questions[0];
  assert.throws(() => evaluateAnswer(q, { frequencies: { bet: 25, check: 25 } }), /100/);
  const result = evaluateAnswer(q, { frequencies: { bet: 50, check: 50 } });
  assert.equal(result.correct, undefined);
  assert.equal(result.evLoss, undefined);
  assert.ok(Number.isFinite(result.differences.bet));
  assert.equal(q.context.profile, '桌型与有效筹码未记录');
});
test('failed persistence preserves the saved session and malformed data is not silently replaced', () => {
  const memory = storage(); const repo = createPracticeStore(memory);
  const session = startPractice(config);
  repo.save({ version: 1, presets: [], sessions: [session], activeId: session.id });
  const before = memory.getItem(PRACTICE_KEY);
  const failing = createPracticeStore({ ...memory, setItem() { throw new Error('quota'); } });
  assert.throws(() => failing.change(state => ({ ...state, presets: [{ id: 'p', name: 'preset', config }] })), /未能保存/);
  assert.equal(memory.getItem(PRACTICE_KEY), before);
  memory.setItem(PRACTICE_KEY, '{bad');
  assert.throws(() => repo.load(), /无法读取/);
  assert.equal(memory.getItem(PRACTICE_KEY), '{bad');
});
test('learning backups round trip drafts and legacy keys, merge idempotently and reject invalid supplements', () => {
  const from = storage(), to = storage(); const session = startPractice(config);
  session.responses[session.questions[0].id] = { submitted: false, choice: session.questions[0].choices[0], reason: 'unfinished draft' };
  createPracticeStore(from).save({ version: 1, presets: [], sessions: [session], activeId: session.id });
  from.setItem('pa_concept_quiz_mastery', '{"stable-id":{"asked":2,"correct":1}}');
  from.setItem('pa_concept_quiz_errors', '[{"id":"stable-id"}]');
  from.setItem('pa_colorScheme', 'nimbus');
  const exported = exportLearningState(from);
  applyLearningImport(planLearningImport(exported, to), to);
  assert.deepEqual(exportLearningState(to), exported);
  applyLearningImport(planLearningImport(exported, to), to);
  assert.equal(createPracticeStore(to).load().sessions.length, 1);
  const snapshot = to.getItem(PRACTICE_KEY);
  assert.throws(() => planLearningImport({ version: 1, values: { [PRACTICE_KEY]: '{"version":99}' } }, to), /格式/);
  assert.equal(to.getItem(PRACTICE_KEY), snapshot);
  createPracticeStore(to).change(state => ({ ...state, activeId: null, sessions: state.sessions.map(item => ({ ...item, status: 'stopped' })) }));
  applyLearningImport(planLearningImport(exported, to), to);
  assert.equal(createPracticeStore(to).load().activeId, null);
  assert.equal(createPracticeStore(to).load().sessions[0].status, 'stopped');
});
