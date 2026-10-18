import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SOLUTION_PACKS } from '../../src/data/solutions/index.js';
import { sha256, solutionContent, validateSolutionPack, aggregateSolutionClasses, trainableSolutionCombos, evaluateSolutionAnswer, solutionNode } from '../../src/modules/solutionPackModel.js';
import { startPractice, submitPractice, repeatPractice } from '../../src/modules/practiceModel.js';
import { validatePracticeState, createPracticeStore, exportLearningState, planLearningImport, applyLearningImport, PRACTICE_KEY } from '../../src/store/practiceStore.js';
const copy = value => JSON.parse(JSON.stringify(value));
const state = session => ({version:1,presets:[],sessions:[session],activeId:session.id});
const config = (id='river-half-pot',path='root') => ({type:'solution',solutionPackId:id,solutionNodePath:path,count:5});
const memory = () => { const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };

test('offline SHA-256 and canonical packs match Node and the checked native evidence',async () => {
  for (const text of ['', 'abc', '木下的河牌', 'x'.repeat(64), 'y'.repeat(100000)]) assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
  const report=JSON.parse(await readFile(new URL('../../tools/solver-lab/verification.json',import.meta.url),'utf8'));
  assert.equal(report.passed,true);assert.equal(report.cases.length,4);
  for (const c of report.cases) {assert.equal(c.passed,true);assert.ok(c.checks.every(c=>c.pass&&c.actual<=c.maximum));}
  for (const pack of SOLUTION_PACKS) {
    validateSolutionPack(pack);
    assert.equal(sha256(solutionContent(pack)),pack.contentHash);
    const raw=JSON.parse(await readFile(new URL('../../tools/solver-lab/results/'+pack.id+'.primary.json',import.meta.url),'utf8'));
    assert.deepEqual(pack.rootEvBb,raw.rootEvBb);
    assert.ok(pack.nodes.every(n=>solutionNode(pack,n.path).combos.every(c=>c.evBb.every(v=>pack.id==='turn-river-half-pot'?v===null||Number.isFinite(v):Number.isFinite(v)))));
    if(pack.id==='turn-river-half-pot')continue;
    const ideal=pack.id==='river-half-pot'?-15/11:pack.id==='river-pot'?-10/11:-409/484;
    assert.ok(Math.abs(pack.rootEvBb[0]-ideal)<0.001);
  }
  const broken=copy(SOLUTION_PACKS[0]);broken.nodes[0].combos[0].evBb[0]=999;
  assert.throws(()=>validateSolutionPack(broken),/校验/);
  const incomplete=copy(SOLUTION_PACKS[0]);delete incomplete.provenance.primary;
  incomplete.contentHash=sha256(solutionContent(incomplete));assert.throws(()=>validateSolutionPack(incomplete),/不完整/);
});

test('class aggregation respects both reach and opponent mass; missing EV stays distinct from zero',() => {
  const node={actions:[{id:'check'},{id:'bet:5'}],combos:[
    {cards:'As4s',reachWeight:0.2,opponentMass:2,frequency:[1,0],evBb:[null,0],status:'reachable'},
    {cards:'Ah4h',reachWeight:0.8,opponentMass:1,frequency:[0,1],evBb:[2,0],status:'reachable'},
    {cards:'Ad5d',reachWeight:1,opponentMass:0,frequency:[0.5,0.5],evBb:[null,null],status:'no-compatible-opponent'},
  ]};
  const [a4,a5]=aggregateSolutionClasses(node);
  assert.ok(Math.abs(a4.frequency[0]-1/3)<1e-10);assert.deepEqual(a4.evBb,[null,0]);
  assert.equal(a5.weight,0);assert.deepEqual(a5.frequency,[null,null]);assert.deepEqual(a5.evBb,[null,null]);
  assert.deepEqual(trainableSolutionCombos(node).map(c=>c.cards),['Ah4h']);
});

test('solution rounds sample by compatible reach and retain exactly one complete snapshot',() => {
  const pack=copy(SOLUTION_PACKS[0]);
  const root=pack.nodes.find(n=>n.path==='root');
  root.combos.forEach((c,i)=>{c.reachWeight=i===0?0:0.01;});root.combos.at(-1).reachWeight=1;
  root.combos[0].status='unreachable';pack.contentHash=sha256(solutionContent(pack));
  const s=startPractice(config(),[],()=>0.5,pack);
  assert.equal(s.questions[0].solution.combo,root.combos.at(-1).cards);
  assert.ok(s.questions.every(q=>q.solution.combo!==root.combos[0].cards));
  assert.equal(new Set(s.questions.map(q=>q.id)).size,5);
  assert.ok(s.questions.every(q=>!('evBb' in q)&&!('frequency' in q)&&!('solutionSnapshot' in q)));
  const before=JSON.stringify(s.solutionSnapshot);pack.title='Changed after starting';
  assert.equal(JSON.stringify(s.solutionSnapshot),before);
  assert.throws(()=>startPractice(config('river-half-pot','root/check')),/没有可用/);
});

test('mixed actions are compared by EV rather than frequency and saved feedback is snapshot bound',() => {
  let s=startPractice(config(),[],()=>0);
  const bluff=s.questions.find(q=>q.solution.combo.startsWith('A'));
  const low=evaluateSolutionAnswer(s.solutionSnapshot,bluff,'bet:5');
  const high=evaluateSolutionAnswer(s.solutionSnapshot,bluff,'check');
  assert.equal(low.approximateEquivalent,true);assert.equal(high.approximateEquivalent,true);
  assert.ok(low.lossBb<=0.002);
  s={...s,index:s.questions.findIndex(q=>q.id===bluff.id)};
  s=submitPractice(s,{choice:'bet:5',reason:'mixed'});validatePracticeState(state(s));
  const repeated=repeatPractice(s);assert.deepEqual(repeated.solutionSnapshot,s.solutionSnapshot);assert.deepEqual(repeated.responses,{});
  const broken=copy(s);broken.questions[0].solution.packHash='0'.repeat(64);assert.throws(()=>validatePracticeState(state(broken)),/冻结/);
  const badFeedback=copy(s);badFeedback.responses[bluff.id].evaluation.lossBb=99;assert.throws(()=>validatePracticeState(state(badFeedback)),/回答/);
  const badContext=copy(s);badContext.questions[0].context.pot=200;assert.throws(()=>validatePracticeState(state(badContext)),/冻结/);
});

test('complete learning backup restores frozen solutions and failed quota writes keep the old bytes',() => {
  const storage=memory(),store=createPracticeStore(storage);
  let s=startPractice(config('river-pot','root/bet:10'),[],()=>0.4);
  s=submitPractice(s,{choice:'call'});store.save(state(s));
  const before=storage.getItem(PRACTICE_KEY),target=memory();
  applyLearningImport(planLearningImport(exportLearningState(storage),target),target);
  assert.deepEqual(createPracticeStore(target).load(),state(s));
  storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>store.save(state({...s,note:'unsaved'})),/未能保存/);
  assert.equal(storage.getItem(PRACTICE_KEY),before);
  assert.doesNotThrow(()=>validatePracticeState({version:1,presets:[],sessions:[],activeId:null}));
});

test('repeated rounds store one immutable answer and prune only answers without sessions', () => {
  const storage = memory(), store = createPracticeStore(storage);
  const first = { ...startPractice(config(), [], () => 0), status: 'stopped' };
  const sessions = Array.from({ length: 8 }, (_, i) => ({ ...copy(first), id: 'repeat-' + i }));
  const expanded = { version: 1, presets: [], sessions, activeId: null };
  store.save(expanded);
  const raw = JSON.parse(storage.getItem(PRACTICE_KEY));
  assert.equal(raw.version, 2);
  assert.deepEqual(Object.keys(raw.solutionSnapshots), [first.solutionSnapshot.contentHash]);
  assert.ok(raw.sessions.every(s => !Object.hasOwn(s, 'solutionSnapshot') && s.solutionSnapshotHash === first.solutionSnapshot.contentHash));
  assert.ok(JSON.stringify(raw).length < JSON.stringify(expanded).length / 2);
  const loaded = store.load();
  assert.deepEqual(loaded, expanded);
  assert.equal(loaded.sessions[0].solutionSnapshot, loaded.sessions[7].solutionSnapshot);
  assert.equal(Object.isFrozen(loaded.sessions[0].solutionSnapshot.nodes[0].combos[0].frequency), true);
  assert.throws(() => { loaded.sessions[0].solutionSnapshot.nodes[0].combos[0].frequency[0] = 99; }, TypeError);
  store.change(s => ({ ...s, sessions: s.sessions.slice(1) }));
  assert.equal(Object.keys(JSON.parse(storage.getItem(PRACTICE_KEY)).solutionSnapshots).length, 1);
  store.change(s => ({ ...s, sessions: [] }));
  assert.deepEqual(JSON.parse(storage.getItem(PRACTICE_KEY)).solutionSnapshots, {});
});

test('legacy reads do not write and failed compaction preserves old bytes for a retry', () => {
  const storage = memory(), originalSet = storage.setItem;
  const s = submitPractice(startPractice(config(), [], () => 0), { choice: 'check' });
  const legacy = JSON.stringify(state(s));
  storage.setItem(PRACTICE_KEY, legacy);
  let writes = 0;
  storage.setItem = (k, v) => { writes++; originalSet(k, v); };
  const store = createPracticeStore(storage);
  assert.deepEqual(store.load(), state(s)); assert.equal(writes, 0);
  let failOnce = true;
  storage.setItem = (k, v) => { if (failOnce) { failOnce = false; throw new Error('quota'); } originalSet(k, v); };
  assert.throws(() => store.change(x => x), /未能保存/);
  assert.equal(storage.getItem(PRACTICE_KEY), legacy);
  // A browser/backend that silently saves the wrong bytes also needs rollback.
  failOnce = true;
  storage.setItem = (k, v) => { originalSet(k, failOnce ? (failOnce = false, 'truncated') : v); };
  assert.throws(() => store.change(x => x), /未能保存/);
  assert.equal(storage.getItem(PRACTICE_KEY), legacy);
  storage.setItem = originalSet;
  store.change(x => x);
  assert.equal(JSON.parse(storage.getItem(PRACTICE_KEY)).version, 2);
  assert.deepEqual(store.load(), state(s));
});

test('mixed old and compact backups retain both answer revisions and local identity conflicts', () => {
  const target = memory(), source = memory(), store = createPracticeStore(target);
  const original = { ...startPractice(config(), [], () => 0), status: 'stopped' };
  const revisedPack = copy(original.solutionSnapshot);
  revisedPack.title = 'Synthetic second revision'; revisedPack.revision++;
  revisedPack.contentHash = sha256(solutionContent(revisedPack));
  const revised = { ...startPractice(config(), [], () => 0, revisedPack), id: 'revised', status: 'stopped' };
  const oldState = { ...state(original), activeId: null };
  target.setItem(PRACTICE_KEY, JSON.stringify(oldState));
  createPracticeStore(source).save({ version: 1, presets: [], sessions: [revised, { ...original, note: 'incoming conflict' }], activeId: null });
  const backup = exportLearningState(source);
  applyLearningImport(planLearningImport(backup, target), target);
  assert.deepEqual(store.load().sessions, [original, revised]);
  const compact = target.getItem(PRACTICE_KEY);
  assert.equal(Object.keys(JSON.parse(compact).solutionSnapshots).length, 2);
  applyLearningImport(planLearningImport(backup, target), target);
  assert.equal(target.getItem(PRACTICE_KEY), compact);
  const restored = memory();
  applyLearningImport(planLearningImport(exportLearningState(target), restored), restored);
  assert.deepEqual(createPracticeStore(restored).load(), store.load());
  store.change(s => ({ ...s, sessions: s.sessions.filter(s => s.id === revised.id) }));
  assert.deepEqual(Object.keys(JSON.parse(target.getItem(PRACTICE_KEY)).solutionSnapshots), [revisedPack.contentHash]);
});

test('invalid answer references and forged contents are rejected before replacing any data', () => {
  const storage = memory(), store = createPracticeStore(storage);
  const session = startPractice(config(), [], () => 0);
  store.save(state(session));
  const original = storage.getItem(PRACTICE_KEY), hash = session.solutionSnapshot.contentHash;
  const mutations = [
    r => { delete r.solutionSnapshots; },
    r => { delete r.solutionSnapshots[hash]; },
    r => { r.sessions[0].solutionSnapshotHash = '0'.repeat(64); },
    r => { r.sessions[0].solutionSnapshotHash = [hash]; },
    r => { r.sessions[0].solutionSnapshot = session.solutionSnapshot; },
    r => { r.solutionSnapshots[hash].title = 'forged'; },
    r => { r.solutionSnapshots.bad = r.solutionSnapshots[hash]; },
    r => { r.solutionSnapshots[SOLUTION_PACKS[1].contentHash] = copy(SOLUTION_PACKS[1]); },
    r => { r.version = 99; },
    r => { r.sessions[0].config.type = 'concept'; },
  ];
  for (const mutate of mutations) {
    const record = JSON.parse(original); mutate(record); const bad = JSON.stringify(record);
    assert.throws(() => planLearningImport({ version: 1, values: { [PRACTICE_KEY]: bad } }, storage));
    assert.equal(storage.getItem(PRACTICE_KEY), original);
    storage.setItem(PRACTICE_KEY, bad);
    assert.throws(() => store.change(s => s));
    assert.equal(storage.getItem(PRACTICE_KEY), bad);
    storage.setItem(PRACTICE_KEY, original);
  }
  const legacy = state(copy(session)); legacy.sessions[0].solutionSnapshotHash = hash;
  storage.setItem(PRACTICE_KEY, JSON.stringify(legacy));
  assert.throws(() => store.load(), /引用/);
  storage.setItem(PRACTICE_KEY, original);
  const forged = copy(session); forged.solutionSnapshot.title = 'unverified frozen object';
  Object.freeze(forged.solutionSnapshot);
  assert.throws(() => store.save(state(forged)), /校验/);
  assert.equal(storage.getItem(PRACTICE_KEY), original);
});

test('turn report passes with reproducible artifact hashes while old river packs retain their exact identity',async()=>{
  const report=JSON.parse(await readFile(new URL('../../tools/solver-lab/turn-verification.json',import.meta.url),'utf8'));
  assert.equal(report.passed,true);assert.equal(report.cases.length,4);
  assert.ok(report.cases.every(c=>c.passed&&c.checks.every(v=>v.pass&&v.actual<=v.maximum)));
  for(const [file,expected] of Object.entries(report.artifacts)) {
    const bytes=await readFile(new URL('../../tools/solver-lab/'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  }
  assert.equal(SOLUTION_PACKS[0].contentHash,'6a4851eec3956f85c488d4f9f305b05cf84765464c8f2b96807019f08006c5cd');
  assert.equal(SOLUTION_PACKS[1].contentHash,'164301becf9adcd767b0795ee3997af28e7c080dae6d16548fdc83c34085aadc');
});

test('each river probability and conditional showdown EV uses the actual branch posterior and blockers',()=>{
  const p=SOLUTION_PACKS.find(p=>p.conditions.street==='turn');
  const root=p.nodes.find(n=>n.path==='root'),ip=p.nodes.find(n=>n.path==='root/bet:5');
  for(const chance of p.chanceNodes) {
    const called=chance.path.endsWith('/call'),pairs=[];
    for(const o of root.combos) for(const i of ip.combos) pairs.push({o:o.cards,i:i.cards,weight:called?o.frequency[1]*i.frequency[1]:1-o.frequency[1]});
    const total=pairs.reduce((s,p)=>s+p.weight,0);
    assert.equal(chance.outcomes.length,48);
    for(const outcome of chance.outcomes) {
      const possible=pairs.filter(p=>!p.o.includes(outcome.card)&&!p.i.includes(outcome.card));
      const mass=possible.reduce((s,p)=>s+p.weight,0);
      assert.ok(Math.abs(outcome.probability-mass/(44*total))<1e-7);
      assert.equal(outcome.compatiblePairs,possible.length);
      const ev=possible.reduce((s,p)=>s+p.weight*(p.o.startsWith('K')||outcome.card.startsWith('A')?1:-1)*(called?10:5),0)/mass;
      assert.ok(Math.abs(outcome.rootEvBb[0]-ev)<0.00001);
      assert.ok(outcome.ranges.every(r=>r.combos.every(h=>!h.includes(outcome.card))));
    }
    assert.ok(Math.abs(chance.outcomes.reduce((s,o)=>s+o.probability,0)-1)<1e-8);
    assert.ok(chance.outcomes.some(o=>Math.abs(o.probability-1/48)>0.001));
  }
  const broken=copy(p);broken.chanceNodes[0].outcomes[0].card='Ks';broken.contentHash=sha256(solutionContent(broken));
  assert.throws(()=>validateSolutionPack(broken),/答案包/);
});

test('turn questions state the continuation, freeze one version, and keep old river histories readable',()=>{
  let session=startPractice(config('turn-checkdown-half-pot'),[],()=>0);
  assert.equal(session.questions[0].context.street,'turn');assert.equal(session.questions[0].context.board.length,4);
  assert.equal(session.questions[0].context.continuation,'river-checkdown');
  assert.ok(session.questions.every(q=>!('evBb'in q)&&!('frequency'in q)));
  session=submitPractice(session,{choice:session.questions[0].choices[0]});validatePracticeState(state(session));
  const storage=memory();createPracticeStore(storage).save(state(session));const target=memory();
  applyLearningImport(planLearningImport(exportLearningState(storage),target),target);
  assert.deepEqual(createPracticeStore(target).load(),state(session));
  for(const c of session.solutionSnapshot.chanceNodes) assert.throws(()=>startPractice(config(session.solutionSnapshot.id,c.path)),/没有可用题目/);
  const bad=copy(session);bad.questions[0].context.street='river';assert.throws(()=>validatePracticeState(state(bad)),/冻结/);
  const legacy=startPractice(config('river-half-pot'),[],()=>0);
  assert.ok(!('continuation'in legacy.questions[0].context));validatePracticeState(state(legacy));
});
