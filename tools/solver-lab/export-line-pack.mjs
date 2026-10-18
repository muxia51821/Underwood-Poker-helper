import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here=new URL('./',import.meta.url);
const read=async file=>JSON.parse(await readFile(new URL(file,here),'utf8'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const artifactHash=bytes=>createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n','\n')).digest('hex');
const report=await read('line-verification.json');
if(!report.passed||report.cases.length!==4||report.cases.some(c=>!c.passed))throw new Error('Two-street numerical gate has not passed.');
for(const [file,digest] of Object.entries(report.artifacts))if(artifactHash(await readFile(new URL(file,here)))!==digest)throw new Error('Verification artifact changed: '+file);
const conditions=await read('line-fixture.json');
const primary=await read('results/'+conditions.id+'.primary.json');
const old=await read('../../src/data/solutions/river-half-pot.json');
const round=v=>Math.round(v*1e7)/1e7;
const nodes=primary.nodes.map(n=>({...n,actions:n.actions.map(a=>({...a,amountBb:a.id.startsWith('bet:')?Number(a.id.slice(4)):a.id==='call'?Math.abs(n.stacksBb[0]-n.stacksBb[1]):0})),
  combos:n.combos.map(c=>({...c,reachWeight:round(c.reachWeight),opponentMass:round(c.opponentMass),frequency:c.frequency.map(round),evBb:c.evBb.map(v=>v===null?null:round(v)),
    status:c.opponentMass===0?'no-compatible-opponent':c.reachWeight===0?'unreachable':'reachable'}))}));
// Keep tiny positive reaches positive: rounding must not change coverage status.
for(const [j,n] of nodes.entries()) for(const [i,c] of n.combos.entries()) {
  if(c.reachWeight===0&&primary.nodes[j].combos[i].reachWeight>0)c.reachWeight=primary.nodes[j].combos[i].reachWeight;
  if(c.opponentMass===0&&primary.nodes[j].combos[i].opponentMass>0)c.opponentMass=primary.nodes[j].combos[i].opponentMass;
}
const chances=primary.chanceNodes.map(n=>{
  const masses=n.outcomes.map(o=>primary.nodes.find(v=>v.path===o.child).combos.reduce((sum,c)=>sum+c.reachWeight*c.opponentMass,0));
  const total=masses.reduce((a,b)=>a+b,0);
  return {...n,pairProbability:1/44,outcomes:n.outcomes.map((o,i)=>({...o,probability:total?masses[i]/total:null}))};
});
const pack={format:'poker-solution-pack',version:1,id:conditions.id,revision:1,title:'两街样例 D · 转牌到河牌',modelLabel:'受限两街研究样例',
  boundary:'双方范围为手工选择的转牌研究假设，未求解翻前或翻牌。转牌和河牌双方可过牌或下注半池，面对下注只能弃牌或跟注，无加注、无抽水。不是完整单加注底池策略，不匹配或评价来源手牌。',
  conditions,ev:old.ev,provenance:old.provenance,rootEvBb:primary.rootEvBb,
  ranges:[nodes.find(n=>n.path==='root'),nodes.find(n=>n.path==='root/check')].map((n,player)=>({player,combos:n.combos.map(c=>({cards:c.cards,weight:1}))})),
  comboEncoding:'tuple-v1',
  nodes:nodes.map(n=>({...n,combos:n.combos.map(c=>[c.cards,c.reachWeight,c.opponentMass,...c.frequency,...c.evBb])})),chanceNodes:chances,terminals:primary.terminals.map(t=>({path:t.path,kind:t.path.endsWith('/fold')?'fold':'showdown'})),
  verification:{passed:true,reportHash:hash(report),report,scope:report.evScope}};
await writeFile(new URL('../../src/data/solutions/'+pack.id+'.json',here),JSON.stringify({...pack,contentHash:hash(pack)})+'\n');
console.log(pack.id,hash(pack));
