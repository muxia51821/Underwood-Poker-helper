// [V7.14.0 新增] Frozen single-decision exercises; aggregate references never grade a specific holding.
import { ConceptQuiz, CONCEPT_QUIZ_VERSION } from './conceptQuiz.js';
import { resolveTopic } from '../data/strategyFramework.js';
import { studyBoards } from './studyAnalyzeModel.js';
import { HandReplay } from './handReplay.js';
import { getObservedProfile } from './analysisReadModel.js';
import { decisionContext } from './decisionContext.js'; // [V7.15.0 新增]
import { postflopReview, postflopFacts } from './postflopReviewModel.js'; // [V7.19.0 新增]
import { getSolutionPack } from '../data/solutions/index.js';
import { solutionNode, trainableSolutionCombos, solutionComboWeight, evaluateSolutionAnswer, validateSolutionPack, solutionQuestion } from './solutionPackModel.js';
import { startSolutionLine, advanceSolutionLine } from './solutionLineModel.js';

export const PRACTICE_TYPES = ['concept', 'range', 'personal', 'solution'];
export const SCORE_VERSIONS = { concept: 'concept-answer-v1', range: 'range-reference-v1', personal: 'personal-reflection-v1', solution: 'solution-ev-v1' };
const uid = () => globalThis.crypto?.randomUUID?.() || 'practice-' + Date.now() + '-' + Math.random().toString(36).slice(2);
export const newPracticeId = uid;
const clone = value => JSON.parse(JSON.stringify(value));

export function blindQuestion(hand, config) {
  if (!config.confirmed) throw new Error('请先确认这是 Hero 决策前的局面。');
  const replay = HandReplay.parseReplay(hand);
  if (replay.degraded) throw new Error('这手牌缺少完整回放资料，请先补充记录或使用普通复盘。');
  const knownCards = [...replay.hero.cards, ...replay.board];
  if (new Set(knownCards).size !== knownCards.length) throw new Error('底牌与公共牌资料存在冲突，请先核对记录。');
  const at = replay.streets.findIndex(street => street.key === config.street);
  const street = replay.streets[at];
  const index = Number(config.decisionIndex);
  if (at < 1 || !Number.isInteger(index) || index < 0 || index >= street.actions.length) throw new Error('请选择已有街道中的一个明确决策时点。');
  if (!['initiative', 'facingBet'].includes(config.decisionKind)) throw new Error('请选择当时是可主动行动，还是面对下注。');
  const visible = replay.streets.slice(0, at + 1);
  const board = visible.flatMap(item => item.newCards);
  if (board.length !== ({ flop: 3, turn: 4, river: 5 })[config.street]) throw new Error('公共牌资料不完整，不能建立这个决策题。');
  // [V7.19.0 新增] Freeze prior personal reasoning only in the post-submit reveal.
  const node = decisionContext(hand, { street: config.street, actionIndex: index });
  const supplied = config.personalReview;
  if (supplied && (supplied.handId !== hand.id || supplied.revision !== node.revision || supplied.key !== node.key)) throw new Error('决策卡与所选节点不一致，请返回原决策重新开始。');
  const previous = supplied?.draft || hand.decisionReviews?.[node.key];
  const review = previous ? { ...postflopReview(previous, true), question: previous.question || '', reason: previous.reason || '', insight: previous.insight || '' } : null;
  return {
    id: 'personal:' + hand.id + ':' + config.street + ':' + index,
    type: 'personal', scoringVersion: SCORE_VERSIONS.personal,
    prompt: '在你确认的 Hero 决策前，选择行动，并写下理由与对手范围假设。',
    context: { scenario: hand.preflopScenario || '场景未知', profile: getObservedProfile(hand).label,
      heroPosition: replay.hero.position, heroCards: replay.hero.cards, board,
      street: config.street, effectiveStack: null, pot: null, ...(review ? postflopFacts(review) : {}), attribution: 'user-confirmed',
      prefix: visible.map((item, n) => ({ street: item.label,
        actions: (n === at ? item.actions.slice(0, index) : item.actions).map(action => action.label) })) },
    choices: config.decisionKind === 'facingBet' ? ['弃牌', '跟注', '加注'] : ['过牌', '下注'],
    source: { handId: hand.id, reference: hand.ggId || hand.id, revision: 'user-confirmed-decision-v1' },
    reveal: { playedAction: street.actions[index].label, board: replay.board,
      laterActions: street.actions.slice(index).map(action => action.label),
      continuation: replay.streets.slice(at).map((item, n) => ({ street: item.label,
        actions: (n === 0 ? item.actions.slice(index) : item.actions).map(action => action.label) })),
      reflection: hand.reflection || '', mistake: hand.mistake || '', profit: hand.pBB ?? null, ...(review ? { review } : {}) },
  };
}

export function questionPool(config, hands = [], solutionPack = null) {
  // [V7.18.0 新增] Questions identify a combo; answers live once in the session snapshot.
  if (config.type === 'solution') {
    const pack = solutionPack || getSolutionPack(config.solutionPackId);
    const node = pack && solutionNode(pack, config.solutionNodePath || 'root');
    if (!node) return [];
    return trainableSolutionCombos(node).filter(combo=>!config.solutionCombo||combo.cards===config.solutionCombo).map(combo => solutionQuestion(pack,node,combo));
  }
  if (config.type === 'concept') {
    const topic = resolveTopic(config.topicId);
    if (!topic) return [];
    return ConceptQuiz.getItems(topic.conceptIds).map(item => ({ id: item.id, type: 'concept',
      scoringVersion: SCORE_VERSIONS.concept, prompt: item.question, title: item.title,
      choices: item.options, expected: item.answer, explanation: item.answerNote,
      source: { ...item.sourceRef, bankVersion: CONCEPT_QUIZ_VERSION }, boundary: topic.boundary,
      context: { topic: topic.title, scope: 'concept' } }));
  }
  if (config.type === 'range') {
    return studyBoards(config.scenario, { category: config.category }).map(board => ({
      id: config.scenario + ':' + board.code, type: 'range', scoringVersion: SCORE_VERSIONS.range,
      prompt: config.input === 'frequency' ? '估计整个范围在这张翻牌上的行动分布，总和为 100%。' : '判断这个牌面下整个范围更偏向哪类行动。',
      context: { scenario: config.scenario, actor: config.scenario === 'SBvsBB' ? 'SB' : 'BTN',
        board: board.code.match(/.{2}/g), category: board.category, profile: '桌型与有效筹码未记录', scope: 'aggregate-range' },
      source: { revision: 'legacy-flop-aggregate-v1', conditionStatus: 'legacy-reference' },
      reference: { bet75: board.bet75, bet50: board.bet50, bet33: board.bet33, check: board.check },
      input: config.input === 'frequency' ? 'frequency' : 'tendency', detail: config.detail === 'sizes' ? 'sizes' : 'simple',
    }));
  }
  if (config.type === 'personal') {
    const hand = hands.find(item => item.id === config.handId);
    return hand ? [blindQuestion(hand, config)] : [];
  }
  return [];
}

export function startPractice(config, hands = [], random = Math.random, solutionPack = null) {
  if (!PRACTICE_TYPES.includes(config.type)) throw new Error('请选择一种支持的练习。');
  const pack = config.type === 'solution' ? solutionPack || getSolutionPack(config.solutionPackId) : null;
  if (pack) validateSolutionPack(pack);
  const pool = questionPool(config, hands, pack);
  if (!pool.length) throw new Error('当前条件没有可用题目，请调整条件或补充资料。');
  if (pack) {
    const node = solutionNode(pack, config.solutionNodePath || 'root');
    const remaining = pool.slice(); pool.length = 0;
    while (remaining.length) {
      const weights = remaining.map(q => solutionComboWeight(node.combos.find(c => c.cards === q.solution.combo)));
      let draw = Math.min(1-Number.EPSILON, Math.max(0,random())) * weights.reduce((a,b) => a+b,0);
      let index = 0;
      while (index < weights.length-1 && draw >= weights[index]) { draw -= weights[index]; index++; }
      pool.push(...remaining.splice(index,1));
    }
  } else for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = [5, 10, 20].includes(Number(config.count)) ? Number(config.count) : 10;
  const frozenConfig = clone(config);
  delete frozenConfig.personalReview;
  if(config.type!=='solution')delete frozenConfig.solutionMode;
  if (pack) { frozenConfig.solutionPackId = pack.id; frozenConfig.solutionNodePath ||= 'root'; }
  if (config.type === 'personal') {
    const hand = hands.find(item => item.id === config.handId);
    frozenConfig.sourceDecision = { ...decisionContext(hand, { street: config.street, actionIndex: Number(config.decisionIndex), decisionKind: config.decisionKind }),
      ...(pool[0].reveal.review ? postflopFacts(pool[0].reveal.review) : {}), question: config.learningQuestion || '', attribution: 'user-confirmed' };
  }
  const session = { id: uid(), ...(pack ? { solutionSnapshot: clone(pack) } : {}), config: { ...frozenConfig, scope: 'single-decision', feedback: 'after-submit', pace: 'manual', rng: 'off' }, questions: clone(pool.slice(0, count)), responses: {},
    index: 0, status: 'active', startedAt: new Date().toISOString(), endedAt: null, note: '' };
  if(config.type==='solution'&&config.solutionMode==='line'){session.config.scope='decision-line';return startSolutionLine(session,random);}
  return session;
}

export function rangeActions(question) {
  return question.detail === 'sizes' ? [
    { key: 'bet75', label: '下注 75%' }, { key: 'bet50', label: '下注 50%' },
    { key: 'bet33', label: '下注 33%' }, { key: 'check', label: '过牌' },
  ] : [{ key: 'bet', label: '下注' }, { key: 'check', label: '过牌' }];
}
export function referenceValues(question) {
  const r = question.reference;
  return { ...r, bet: r.bet75 + r.bet50 + r.bet33 };
}
export function evaluateAnswer(question, answer, solutionSnapshot = null) {
  if (question.type === 'solution') return evaluateSolutionAnswer(solutionSnapshot, question, answer.choice);
  if (question.type === 'concept' || question.type === 'personal') {
    if (!question.choices.includes(answer.choice)) throw new Error('请先选择一个行动或答案。');
    if (question.type === 'personal' && !String(answer.reason || '').trim()) throw new Error('请写一句决策理由，再揭示后续。');
    return question.type === 'concept' ? { correct: answer.choice === question.expected, kind: 'concept', scoringVersion: question.scoringVersion }
      : { kind: 'reflection', scoringVersion: question.scoringVersion };
  }
  const actions = rangeActions(question);
  const reference = referenceValues(question);
  if (question.input === 'tendency') {
    if (!actions.some(action => action.key === answer.choice)) throw new Error('请选择整体范围倾向。');
    return { kind: 'reference', chosenFrequency: reference[answer.choice], scoringVersion: question.scoringVersion };
  }
  const values = actions.map(action => answer.frequencies?.[action.key]);
  if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) > 0.1) throw new Error('每项请填写 0–100 的数字，合计须为 100%。');
  return { kind: 'distribution', differences: Object.fromEntries(actions.map(action => [action.key, answer.frequencies[action.key] - reference[action.key]])), scoringVersion: question.scoringVersion };
}
export function submitPractice(session, answer) {
  const q = session.questions[session.index];
  if (!q || session.status !== 'active') throw new Error('这轮练习已结束。');
  if (session.responses[q.id]?.submitted) return session;
  const evaluation = evaluateAnswer(q, answer, session.solutionSnapshot);
  const response = { ...clone(answer), evaluation, submitted: true, submittedAt: new Date().toISOString(),
    review: evaluation.kind === 'concept' && !evaluation.correct };
  return { ...session, responses: { ...session.responses, [q.id]: response } };
}
export function nextPractice(session) {
  if (!session.responses[session.questions[session.index]?.id]?.submitted) throw new Error('请先提交当前题目。');
  if(session.config.type==='solution'&&session.config.solutionMode==='line')return advanceSolutionLine(session);
  if (session.index === session.questions.length - 1) return { ...session, status: 'completed', endedAt: new Date().toISOString() };
  return { ...session, index: session.index + 1 };
}
export function repeatPractice(session, reviewOnly = false) {
  const questions = session.questions.filter(q => !reviewOnly || session.responses[q.id]?.review);
  if (!questions.length) throw new Error('本轮没有标为待复习的题目。');
  const copy=clone(session);
  if(copy.line){delete copy.line;copy.config.solutionMode='replay';copy.config.scope='single-decision';}
  return { ...copy, id: uid(), questions: clone(questions), responses: {}, index: 0,
    status: 'active', startedAt: new Date().toISOString(), endedAt: null, note: '' };
}
export function repeatPracticeQuestion(session,questionId) {
  const q=session.questions.find(q=>q.id===questionId);
  if(!q||q.type!=='solution'||!session.responses[q.id]?.submitted)throw new Error('找不到已提交的求解节点，请重新选择。');
  const copy=repeatPractice({...session,questions:[q]});
  copy.config={...copy.config,solutionMode:'node',solutionNodePath:q.solution.nodePath,solutionCombo:q.solution.combo,count:1};
  return copy;
}
export function solutionReviewQueue(sessions) {
  const groups=new Map();
  for(const s of sessions)for(const q of s.questions) {
    if(q.type!=='solution'||!s.responses[q.id]?.submitted||!s.responses[q.id].review)continue;
    const key=q.solution.packHash+':'+q.solution.nodePath+':'+q.solution.combo;
    if(!groups.has(key))groups.set(key,{key,session:s,question:q,references:[]});
    const item=groups.get(key);item.references.push({sessionId:s.id,questionId:q.id});
    if(s.startedAt>item.session.startedAt){item.session=s;item.question=q;}
  }
  return [...groups.values()].sort((a,b)=>b.session.startedAt.localeCompare(a.session.startedAt));
}
