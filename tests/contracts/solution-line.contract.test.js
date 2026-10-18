import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getSolutionPack } from '../../src/data/solutions/index.js';
import { solutionNode, validateSolutionPack, solutionContent, sha256, solutionTerminalLabel } from '../../src/modules/solutionPackModel.js';
import { advanceSolutionLine } from '../../src/modules/solutionLineModel.js';
import { startPractice, submitPractice, repeatPractice, nextPractice, repeatPracticeQuestion, solutionReviewQueue } from '../../src/modules/practiceModel.js';
import { compareRiverNodes, riverCardFeatures } from '../../src/modules/solutionComparisonModel.js';
import { validatePracticeState, createPracticeStore, exportLearningState, planLearningImport, applyLearningImport } from '../../src/store/practiceStore.js';
const pack=getSolutionPack('turn-river-half-pot');
const config={type:'solution',solutionPackId:pack.id,solutionNodePath:'root',solutionMode:'line',count:5};
const state=s=>({version:1,presets:[],sessions:[s],activeId:s.status==='active'?s.id:null});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};

test('switching from continuous solution settings to concepts keeps ordinary practice progression',()=>{
  const s=startPractice({...config,type:'concept',topicId:'turn'});
  assert.doesNotThrow(()=>validatePracticeState(state(s)));
  const answered=submitPractice(s,{choice:s.questions[0].expected});
  assert.doesNotThrow(()=>nextPractice(answered));
});

test('two-street answers bind to actual checked native artifacts with every suit and action value covered',async()=>{
  assert.equal(solutionTerminalLabel(pack,'root/check/bet:5/fold'),'OOP 弃牌，IP 赢得底池');
  assert.equal(solutionTerminalLabel(pack,'root/bet:5/fold'),'IP 弃牌，OOP 赢得底池');
  const report=JSON.parse(await readFile(new URL('../../tools/solver-lab/line-verification.json',import.meta.url)));
  assert.equal(report.passed,true);assert.equal(report.cases.length,4);
  for(const c of report.cases)assert.ok(c.checks.every(v=>v.pass));
  for(const [file,hash] of Object.entries(report.artifacts))assert.equal(createHash('sha256').update((await readFile(new URL('../../tools/solver-lab/'+file,import.meta.url))).toString('utf8').replaceAll('\r\n','\n')).digest('hex'),hash);
  const native=JSON.parse(await readFile(new URL('../../tools/solver-lab/results/'+pack.id+'.primary.json',import.meta.url)));
  for(const original of native.nodes) {
    const node=solutionNode(pack,original.path);assert.deepEqual(node.board,original.board);
    for(const [i,c] of node.combos.entries())for(let j=0;j<2;j++) {
      if(original.combos[i].evBb[j]===null)assert.equal(c.evBb[j],null);
      else assert.ok(Math.abs(c.evBb[j]-original.combos[i].evBb[j])<=0.000000051);
    }
  }
  const broken=structuredClone(pack);broken.nodes[0].actions[1].amountBb=10;broken.contentHash=sha256(solutionContent(broken));assert.throws(()=>validateSolutionPack(broken));
});

test('one held hand follows legal betting and river branches, freezes answers, and restores mid-line',()=>{
  let s=startPractice(config,[],()=>0);const hero=s.line.heroCombo;
  assert.equal(s.questions.length,1);assert.equal(s.questions[0].context.board.length,4);
  s=submitPractice(s,{choice:'check'});s=advanceSolutionLine(s,()=>0);
  assert.equal(s.status,'active');assert.equal(s.questions.at(-1).context.board.length,5);
  assert.equal(s.questions.at(-1).solution.combo,hero);
  assert.equal(s.questions.at(-1).context.board.at(-1),'2c');
  assert.doesNotThrow(()=>validatePracticeState(state(s)));
  const a=memory(),b=memory();createPracticeStore(a).save(state(s));applyLearningImport(planLearningImport(exportLearningState(a),b),b);
  assert.deepEqual(createPracticeStore(b).load(),state(s));
  const tampered=structuredClone(s);tampered.line.steps.find(v=>v.card).card=hero.slice(0,2);
  assert.throws(()=>validatePracticeState(state(tampered)),/发牌/);
  s=submitPractice(s,{choice:'check'});s=advanceSolutionLine(s,()=>0);
  assert.equal(s.status,'completed');assert.doesNotThrow(()=>validatePracticeState(state(s)));
  const repeat=repeatPractice(s);assert.equal(repeat.config.solutionMode,'replay');assert.equal(repeat.line,undefined);
  assert.deepEqual(repeat.questions,s.questions);assert.doesNotThrow(()=>validatePracticeState(state(repeat)));
});

test('different opponent responses and selected actions stay inside the frozen tree without scoring missing continuations',()=>{
  for(const randomValue of [0,0.25,0.5,0.75,0.99]) {
    let s=startPractice(config,[],()=>randomValue);
    for(let i=0;s.status==='active'&&i<6;i++) {
      const q=s.questions[s.index];const choice=q.choices.includes('call')?'call':q.choices[1];
      s=advanceSolutionLine(submitPractice(s,{choice}),()=>randomValue);
      assert.doesNotThrow(()=>validatePracticeState(state(s)));
      assert.ok(s.questions.every(q=>q.context.heroCards.join('')===s.line.heroCombo));
    }
    assert.equal(s.status,'completed');
  }
});

test('IP starts after a legal OOP response and keeps the same hand through river and restore',()=>{
  for(const seed of [0,0.2,0.5,0.8,0.99]) {
    let s=startPractice({...config,solutionPlayer:1},[],()=>seed);
    assert.equal(s.line.heroPlayer,1);assert.ok(s.line.steps.length>0);
    for(let i=0;s.status==='active'&&i<5;i++) {
      assert.doesNotThrow(()=>validatePracticeState(state(s)));
      const q=s.questions[s.index];assert.equal(solutionNode(pack,q.solution.nodePath).player,1);
      assert.equal(q.solution.combo,s.line.heroCombo);
      s=advanceSolutionLine(submitPractice(s,{choice:q.choices.includes('call')?'call':'check'}),()=>seed);
    }
    assert.equal(s.status,'completed');assert.doesNotThrow(()=>validatePracticeState(state(s)));
    const a=memory(),b=memory();createPracticeStore(a).save(state(s));applyLearningImport(planLearningImport(exportLearningState(a),b),b);
    assert.equal(createPracticeStore(b).load().sessions[0].line.heroPlayer,1);
  }
});

test('river comparisons keep branch and actor, weight real frequencies, and distinguish blockers',()=>{
  const path='root/check/check/river:3c';
  const result=compareRiverNodes(pack,path,'6c','Th9h');
  assert.equal(result.b.node.path,'root/check/check/river:6c');
  assert.equal(result.a.node.player,result.b.node.player);assert.equal(result.a.node.potBb,result.b.node.potBb);
  assert.ok(Math.abs(result.a.frequency.reduce((a,b)=>a+b,0)-1)<1e-6);
  assert.ok(result.b.features.includes('所选底牌完成顺子'));
  assert.ok(riverCardFeatures(pack.conditions.board,'Ah','Th9h').includes('所选底牌完成同花'));
  assert.ok(riverCardFeatures(pack.conditions.board,'7c','Th9h').includes('公共牌配对'));
  const blocked=compareRiverNodes(pack,path,'Th','Th9h');assert.equal(blocked.b.combo,null);
  const ip=compareRiverNodes(pack,path+'/check','Ah','JhTh');assert.equal(ip.b.node.player,1);
  assert.throws(()=>compareRiverNodes(pack,path,'Ks','Th9h'),/合法/);
});

test('marked nodes are deduplicated by frozen answer and replay exactly one old question',()=>{
  let s=startPractice(config,[],()=>0);const q=s.questions[0];
  s=submitPractice(s,{choice:'check'});s.responses[q.id].review=true;
  const other=structuredClone(s);other.id='another-session';
  const queue=solutionReviewQueue([s,other]);assert.equal(queue.length,1);assert.equal(queue[0].references.length,2);
  const replay=repeatPracticeQuestion(s,q.id);
  assert.equal(replay.questions.length,1);assert.deepEqual(replay.questions[0],q);assert.equal(replay.line,undefined);
  assert.deepEqual(replay.solutionSnapshot,s.solutionSnapshot);assert.equal(replay.config.solutionNodePath,q.solution.nodePath);
  assert.doesNotThrow(()=>validatePracticeState(state(replay)));
  const a=memory(),b=memory();createPracticeStore(a).save({...state(s),sessions:[{...s,status:'stopped'}],activeId:null});
  applyLearningImport(planLearningImport(exportLearningState(a),b),b);assert.equal(solutionReviewQueue(createPracticeStore(b).load().sessions).length,1);
});
