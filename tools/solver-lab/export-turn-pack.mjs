// [V7.18.1] Keep the verified river packs byte-identical; export this turn model only.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,here),'utf8'));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const artifactHash=bytes=>createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n','\n')).digest('hex');
const report=await read('turn-verification.json');
if(report.passed!==true||report.cases.length!==4||report.cases.some(c=>!c.passed)) throw new Error('The turn numerical gate has not passed.');
for(const [file,digest] of Object.entries(report.artifacts)) {
  if(artifactHash(await readFile(new URL(file,here)))!==digest) throw new Error('Verification artifact changed: '+file);
}
const fixture=(await read('turn-fixtures.json')).cases[0];
const primary=await read(`results/${fixture.id}.primary.json`),reference=await read(`results/${fixture.id}.reference.json`);
const old=await read('../../src/data/solutions/river-half-pot.json');
const turnNodes=primary.nodes.filter(n=>n.board.length===4);
const chanceNodes=primary.chanceNodes.map(chance=>{
  const outcomes=chance.outcomes.map(edge=>{
    const node=primary.nodes.find(n=>n.path===edge.child);
    const ip=primary.nodes.find(n=>n.path===edge.child+'/check');
    const mass=node.combos.reduce((s,c)=>s+c.reachWeight*c.opponentMass,0);
    const ev=mass?node.combos.reduce((s,c)=>s+c.reachWeight*c.opponentMass*(c.evBb[0]??0),0)/mass:null;
    const ranges=[node,ip].map((n,p)=>({player:p,combos:n.combos.map(c=>c.cards)}));
    let compatiblePairs=0;
    for(const a of ranges[0].combos) for(const b of ranges[1].combos) if(new Set([...a.match(/.{2}/g),...b.match(/.{2}/g)]).size===4) compatiblePairs++;
    return {card:edge.card,path:edge.child,board:node.board,mass,rootEvBb:ev===null?[null,null]:[ev,-ev],compatiblePairs,ranges};
  });
  const total=outcomes.reduce((s,o)=>s+o.mass,0);
  return {...chance,forcedActions:['check','check'],pairProbability:1/44,
    outcomes:outcomes.map(({mass,...outcome})=>({...outcome,probability:total?mass/total:null}))};
});
const pack={...old,id:fixture.id,revision:1,title:'转牌样例 C · 河牌只摊牌',
  conditions:{...fixture,players:2,street:'turn',futureCards:true,tableMax:null,originalStackBb:null},
  boundary:'只适用于给定双方范围、转牌与受限动作树。转牌过牌或下注 5bb，IP 面对下注只能弃牌或跟注；继续时随机发一张河牌，河牌双方只能过牌摊牌。不能加注或全下；不代表完整 9max／200bb 策略，也不评价来源手牌。',
  rootEvBb:primary.rootEvBb,
  ranges:turnNodes.filter(n=>n.path==='root'||n.path==='root/check').map(n=>({player:n.player,combos:n.combos.map(c=>({cards:c.cards,weight:1}))})),
  nodes:turnNodes.map(n=>({...n,actions:n.actions.map(a=>({...a,amountBb:a.id==='bet:5'||a.id==='call'?5:0})),combos:n.combos.map(c=>({...c,status:c.opponentMass===0?'no-compatible-opponent':c.reachWeight===0?'unreachable':'reachable'}))})),
  chanceNodes,terminals:primary.terminals.filter(t=>t.path==='root/bet:5/fold'),
  verification:{passed:true,fixtureHash:hash(fixture),primaryOutputHash:hash(primary),referenceOutputHash:hash(reference),reportHash:hash(report),report:report.cases.find(c=>c.id===fixture.id),
    engines:[primary,reference].map(r=>({name:r.engine,iterations:r.iterations,seconds:r.seconds,nashConvBb:r.nashConvBb})),
    scope:'All native nodes independently checked. Cross-engine action EV comparison applies to turn decisions; forced river nodes are display-only.'},
};
delete pack.contentHash;
await writeFile(new URL('../../src/data/solutions/'+pack.id+'.json',here),JSON.stringify({...pack,contentHash:hash(pack)},null,2)+'\n');
console.log(pack.id,hash(pack));
