import { sha256, solutionContent } from './solutionPackModel.js';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const checked = new WeakSet();
const validCard = v => typeof v === 'string' && /^[2-9TJQKA][cdhs]$/.test(v);
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const fail = () => { throw new Error('转牌专项记录不完整，请保留备份后重试。'); };
export function validateCourse(course) {
  if (checked.has(course)) return course;
  if (!object(course) || course.format !== 'poker-turn-river-course' || course.version !== 1
    || course.scoringEligible !== false || course.numericalVerification !== 'pending'
    || !/^[a-f0-9]{64}$/.test(course.contentHash || '') || sha256(solutionContent(course)) !== course.contentHash
    || !Array.isArray(course.hands) || !course.hands.length || !Array.isArray(course.nodes)
    || course.hands.some(h => typeof h !== 'string' || h.length !== 4 || !validCard(h.slice(0, 2)) || !validCard(h.slice(2)) || h.slice(0, 2) === h.slice(2))
    || typeof course.title !== 'string' || typeof course.boundary !== 'string' || !object(course.source)
    || !object(course.conditions) || !Array.isArray(course.conditions.board) || course.conditions.board.some(c => !validCard(c))
    || !Array.isArray(course.conditions.rangeSource?.flopEntryClasses)) fail();
  const ids = new Set(course.nodes.map(n => n.id));
  if (ids.size !== course.nodes.length || !ids.has('root')) fail();
  for (const n of course.nodes) {
    if (!object(n) || !['decision', 'chance', 'terminal'].includes(n.kind) || !Array.isArray(n.board)
      || ![4, 5].includes(n.board.length) || n.board.some(c => !validCard(c)) || new Set(n.board).size !== n.board.length
      || !Number.isFinite(n.potBb) || !Array.isArray(n.stacksBb) || n.stacksBb.length !== 2
      || n.stacksBb.some(v => !Number.isFinite(v) || v < 0)) fail();
    if (n.kind !== 'terminal' && (!Array.isArray(n.actions) || !n.actions.length
      || new Set(n.actions.map(a => a.id)).size !== n.actions.length
      || n.actions.some(a => typeof a.id !== 'string' || !ids.has(a.child) || !a.child.startsWith(n.id + '/')))) fail();
    if (n.kind === 'decision' && (![0, 1].includes(n.actor) || !Array.isArray(n.hands) || n.hands.length !== course.hands.length
      || new Set(n.hands.map(h => h.cards)).size !== course.hands.length
      || n.hands.some(h => !course.hands.includes(h.cards) || !Array.isArray(h.frequency) || h.frequency.length !== n.actions.length
        || h.frequency.some(v => v !== null && !Number.isFinite(v)) || !Number.isFinite(h.reachWeight) || !Number.isFinite(h.opponentMass)
        || !Array.isArray(h.nativeEvBb) || h.nativeEvBb.length !== (n.actor === 1 ? n.actions.length : 0)
        || h.nativeEvBb.some(v => v !== null && !Number.isFinite(v)))
      || !Array.isArray(n.ranges) || n.ranges.length !== 2
      || n.ranges.some(r => !Array.isArray(r) || r.some(v => !Array.isArray(v) || typeof v[0] !== 'string' || !Number.isFinite(v[1]))))) fail();
  }
  if (course.nodes.find(n => n.id === 'root').actor !== 1) fail();
  freeze(course); checked.add(course); return course;
}
const nodeIndexes = new WeakMap();
export function courseNode(course, id) {
  if (!nodeIndexes.has(course)) nodeIndexes.set(course, new Map(course.nodes.map(n => [n.id, n])));
  return nodeIndexes.get(course).get(id);
}
export const courseHand = (node, cards) => node.hands?.find(h => h.cards === cards);
export const courseReachable = hand => hand?.reachWeight > 0 && hand.opponentMass > 0;
export function courseActionLabel(id, node) {
  if (id === 'check') return '过牌';
  if (id === 'fold') return '弃牌';
  if (id === 'call') return '跟注';
  if (id === 'allin') return '全下';
  if (id.startsWith('raise:')) return '加注至 ' + id.slice(6) + 'bb';
  if (id.startsWith('bet:')) return '下注 ' + id.slice(4) + 'bb';
  return id;
}
export function courseReference(course, nodeId, cards) {
  const n = courseNode(course, nodeId), hand = courseHand(n, cards);
  if (!courseReachable(hand)) return [];
  const values = hand.nativeEvBb;
  const best = values?.length && values.every(Number.isFinite) ? Math.max(...values) : null;
  return n.actions.map((a, i) => ({ ...a, frequency: hand.frequency[i],
    relativeEvBb: best === null ? null : values[i] - best }));
}
const uid = () => globalThis.crypto?.randomUUID?.() || 'course-' + Date.now() + '-' + Math.random().toString(36).slice(2);
export function startCourseRound(course, cards, fixedRiver = null) {
  validateCourse(course);
  if (!course.hands.includes(cards) || !courseReachable(courseHand(courseNode(course, 'root'), cards))) fail();
  return { id: uid(), courseHash: course.contentHash, cards, nodeId: 'root', status: 'active',
    startedAt: new Date().toISOString(), events: [], responses: {}, summary: '', fixedRiver };
}
export function answerCourseRound(course, round, choice, reason = '', plan = '') {
  const node = courseNode(course, round.nodeId);
  if (round.status !== 'active' || node?.actor !== 1 || !node.actions.some(a => a.id === choice)) fail();
  if (round.responses[node.id]?.submitted) return round;
  return { ...round, responses: { ...round.responses, [node.id]: { submitted: true, choice, reason, plan } } };
}
function weighted(actions, weights, rng) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let cursor = rng() * sum;
  return actions.find((_, i) => (cursor -= weights[i]) < 0) || actions.at(-1);
}
export function nextCourseDecision(course, round, rng = Math.random) {
  const answer = round.responses[round.nodeId], start = courseNode(course, round.nodeId);
  if (round.status !== 'active' || !answer?.submitted) fail();
  const copy = { ...round, events: [...round.events] };
  let action = start.actions.find(a => a.id === answer.choice), node = start;
  for (let limit = 0; limit < 40; limit++) {
    copy.events.push({ nodeId: node.id, actionId: action.id, actor: node.kind === 'chance' ? 'deal' : node.actor });
    node = courseNode(course, action.child); copy.nodeId = node.id;
    if (node.kind === 'terminal') return { ...copy, status: 'completed', endedAt: new Date().toISOString(), endReason: '行动线已结束' };
    if (node.kind === 'chance') {
      const legal = node.actions.filter(a => !copy.cards.includes(a.id));
      if (!legal.length) break;
      action = legal.find(a => a.id === copy.fixedRiver) || legal[Math.min(legal.length - 1, Math.floor(rng() * legal.length))];
      copy.riverCard = action.id; continue;
    }
    const hand = courseHand(node, copy.cards);
    if (!courseReachable(hand) || hand.frequency.some(v => !Number.isFinite(v)) || hand.frequency.reduce((a, b) => a + b, 0) <= 0) break;
    if (node.actor === 1) return copy;
    action = weighted(node.actions, hand.frequency, rng);
  }
  return { ...copy, status: 'completed', endedAt: new Date().toISOString(), endReason: '此分支没有可继续使用的到达范围，保留本次判断供回看' };
}
export function validateCourseLibrary(library) {
  if (!object(library)) fail();
  for (const [hash, entry] of Object.entries(library)) {
    validateCourse(entry.snapshot);
    if (entry.snapshot.contentHash !== hash || !Array.isArray(entry.rounds) || new Set(entry.rounds.map(r => r.id)).size !== entry.rounds.length) fail();
    if (entry.selectedId !== null && !entry.rounds.some(r => r.id === entry.selectedId)) fail();
    for (const r of entry.rounds) {
      if (typeof r.id !== 'string' || r.courseHash !== hash || !entry.snapshot.hands.includes(r.cards)
        || !['active', 'completed', 'stopped'].includes(r.status) || !object(r.responses) || !Array.isArray(r.events)
        || typeof r.startedAt !== 'string' || typeof r.summary !== 'string' || !courseNode(entry.snapshot, r.nodeId)) fail();
      let path = 'root'; const visited = new Set(['root']);
      for (const e of r.events) {
        const n = courseNode(entry.snapshot, path), a = n.actions?.find(a => a.id === e.actionId);
        if (e.nodeId !== path || !a || e.actor !== (n.kind === 'chance' ? 'deal' : n.actor)
          || (n.actor === 1 && (!r.responses[path]?.submitted || r.responses[path].choice !== a.id))) fail();
        path = a.child; visited.add(path);
      }
      if (path !== r.nodeId) fail();
      for (const [id, response] of Object.entries(r.responses)) {
        const n = courseNode(entry.snapshot, id);
        if (!visited.has(id) || n?.actor !== 1 || typeof response.submitted !== 'boolean' || typeof response.reason !== 'string' || typeof response.plan !== 'string'
          || (response.submitted && !n.actions.some(a => a.id === response.choice))) fail();
      }
    }
  }
  return library;
}
export function mergeCourseLibraries(incoming = {}, local = {}) {
  validateCourseLibrary(incoming); validateCourseLibrary(local);
  const result = { ...incoming, ...local };
  for (const hash of Object.keys(incoming)) if (local[hash]) {
    const a = local[hash], b = incoming[hash];
    result[hash] = { ...a, rounds: [...a.rounds, ...b.rounds.filter(r => !a.rounds.some(s => s.id === r.id))] };
  }
  return validateCourseLibrary(result);
}
