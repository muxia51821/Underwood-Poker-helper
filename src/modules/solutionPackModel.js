// [V7.18.0 新增] Only verified, fixed river models supply combo-level answers.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : record(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const solutionContent = pack => JSON.stringify(canonical(Object.fromEntries(Object.entries(pack).filter(([key]) => key !== 'contentHash'))));

// Synchronous SHA-256 keeps backup validation available under file:// as well as HTTPS.
// This verifies content integrity, not the identity or trustworthiness of its author.
export function sha256(text) {
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const input = new TextEncoder().encode(text), size = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(size); bytes.set(input); bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer); view.setUint32(size - 8, Math.floor(input.length / 0x20000000)); view.setUint32(size - 4, input.length * 8);
  const rotate = (x,n) => (x >>> n) | (x << (32-n));
  for (let at = 0; at < size; at += 64) {
    const w = new Int32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(at+i*4);
    for (let i = 16; i < 64; i++) { const a=w[i-15],b=w[i-2]; w[i] = ((rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-16]+(rotate(b,17)^rotate(b,19)^(b>>>10))+w[i-7])|0; }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^((~e)&g))+k[i]+w[i])|0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;
      j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,j].forEach((v,i) => { h[i]=(h[i]+v)|0; });
  }
  return h.map(v => (v>>>0).toString(16).padStart(8,'0')).join('');
}

export function solutionClass(combo) {
  const [a,b] = combo.match(/.{2}/g);
  return a[0] === b[0] ? a[0]+b[0] : a[0]+b[0]+(a[1] === b[1] ? 's' : 'o');
}
export function solutionActionLabel(id) {
  return ({ check:'过牌',fold:'弃牌',call:'跟注' })[id] || (id.startsWith('bet:') ? '下注 '+id.slice(4)+'bb' : id);
}

export function solutionChance(pack, path) { return pack.chanceNodes?.find(node => node.path === path); }
function decodedNode(pack,node) {
  if(!node?.combos||pack.comboEncoding!=='tuple-v1')return node;
  return {...node,combos:node.combos.map(row=>({cards:row[0],reachWeight:row[1],opponentMass:row[2],frequency:row.slice(3,5),evBb:row.slice(5,7),
    status:row[2]===0?'no-compatible-opponent':row[1]===0?'unreachable':'reachable'}))};
}
export function solutionNode(pack, path) { return decodedNode(pack,pack.nodes.find(node => node.path === path)); }
export function solutionTerminalLabel(pack,path) {
  if(!path.endsWith('/fold'))return '摊牌结算';
  const folder=solutionNode(pack,path.slice(0,-5))?.player;
  return folder===0?'OOP 弃牌，IP 赢得底池':'IP 弃牌，OOP 赢得底池';
}
export function solutionComboWeight(combo) { return combo.reachWeight * combo.opponentMass; }
export function trainableSolutionCombos(node) {
  return node.actions.length > 1 ? node.combos.filter(c => c.status === 'reachable' && solutionComboWeight(c) > 0 && c.evBb.length === node.actions.length && c.evBb.every(finite)) : [];
}
export function solutionQuestion(pack,node,combo) {
  const board=node.board||pack.conditions.board;
  return {id:pack.id+':'+node.path+':'+combo.cards,type:'solution',scoringVersion:'solution-ev-v1',
    prompt:'只根据本样例的范围与动作限制，你会怎样行动？',choices:node.actions.map(a=>a.id),
    solution:{packId:pack.id,packHash:pack.contentHash,nodePath:node.path,combo:combo.cards},
    context:{board,heroCards:combo.cards.match(/.{2}/g),actor:node.player===0?'OOP（先行动）':'IP（后行动）',profile:pack.modelLabel,
      street:board.length===4?'turn':'river',...(pack.conditions.futureCards?{continuation:pack.conditions.continuation}:{}),pot:node.potBb,stacksBb:node.stacksBb,ranges:pack.conditions.ranges,actionPath:node.path}};
}
export function aggregateSolutionClasses(node) {
  const groups = new Map();
  for (const combo of node.combos) {
    const hand = solutionClass(combo.cards);
    if (!groups.has(hand)) groups.set(hand, { hand, weight:0, combos:[], frequency:node.actions.map(() => 0), evBb:node.actions.map(() => 0), evMass:node.actions.map(() => 0) });
    const group = groups.get(hand), weight = solutionComboWeight(combo);
    group.combos.push(combo); group.weight += weight;
    node.actions.forEach((_,i) => {
      group.frequency[i] += weight * combo.frequency[i];
      if (finite(combo.evBb[i])) { group.evBb[i] += weight * combo.evBb[i]; group.evMass[i] += weight; }
    });
  }
  return [...groups.values()].map(group => ({ ...group,
    frequency:group.frequency.map(v => group.weight ? v / group.weight : null),
    evBb:group.evBb.map((v,i) => group.weight > 0 && Math.abs(group.evMass[i]-group.weight) < 1e-10 ? v / group.weight : null) }));
}

export function validateSolutionPack(pack) {
  const fail = () => { throw new Error('求解答案包不完整、内容校验失败或不属于本版支持的求解样例。'); };
  if (!record(pack) || pack.format !== 'poker-solution-pack' || pack.version !== 1 || !Number.isInteger(pack.revision) || pack.revision < 1
    || !['river-half-pot','river-pot','turn-checkdown-half-pot','turn-river-half-pot'].includes(pack.id) || typeof pack.title !== 'string' || typeof pack.modelLabel !== 'string' || typeof pack.boundary !== 'string'
    || !/^[a-f0-9]{64}$/.test(pack.contentHash || '') || sha256(solutionContent(pack)) !== pack.contentHash) fail();
  const c = pack.conditions;
  if (pack.id === 'turn-river-half-pot') return validateBettingLinePack(pack,fail);
  const turn = pack.id === 'turn-checkdown-half-pot';
  if (!record(c) || c.id !== pack.id || c.players !== 2 || c.street !== (turn ? 'turn' : 'river') || c.futureCards !== turn || c.rake !== 0 || c.icm !== false
    || (turn && c.continuation !== 'river-checkdown') || c.potBb !== 10 || c.stackBb !== 20 || c.betBb !== (pack.id === 'river-pot' ? 10 : 5)
    || JSON.stringify(c.board) !== JSON.stringify(turn ? ['Ks','7d','2c','8h'] : ['Ks','7d','2c','8h','3d']) || JSON.stringify(c.ranges) !== JSON.stringify(['KK,A4s,A5s','TT,JJ'])
    || c.tableMax !== null || c.originalStackBb !== null || pack.ev?.unit !== 'bb' || pack.ev?.baseline !== 'solve-start-zero-sum-half-pot'
    || pack.ev?.continuation !== 'solved-average-strategy' || pack.ev?.approximateEqualityBb !== 0.002
    || pack.verification?.passed !== true || !record(pack.provenance) || !Array.isArray(pack.rootEvBb) || pack.rootEvBb.length !== 2 || !pack.rootEvBb.every(finite)) fail();
  for (const role of ['primary','reference']) {
    const source=pack.provenance[role];
    if (!record(source) || typeof source.repository !== 'string' || typeof source.license !== 'string' || !/^[a-f0-9]{40}$/.test(source.commit || '')) fail();
  }
  const terminalPaths = turn ? ['root/bet:5/fold'] : ['root/check/check','root/bet:'+c.betBb+'/fold','root/bet:'+c.betBb+'/call'];
  if (!Array.isArray(pack.terminals) || pack.terminals.length !== terminalPaths.length || !pack.terminals.every(t => record(t) && typeof t.path === 'string' && typeof t.kind === 'string')
    || JSON.stringify(pack.terminals.map(t => t.path).sort()) !== JSON.stringify(terminalPaths.sort())) fail();
  if (!Array.isArray(pack.nodes) || pack.nodes.length !== 3 || !Array.isArray(pack.ranges) || pack.ranges.length !== 2) fail();
  const cardValue = card => '23456789TJQKA'.indexOf(card[0])*4+'cdhs'.indexOf(card[1]);
  const validCombo = combo => /^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(combo) && cardValue(combo.slice(0,2)) > cardValue(combo.slice(2)) && !c.board.some(card => combo.includes(card));
  for (const [p,range] of pack.ranges.entries()) {
    if (!record(range) || range.player !== p || !Array.isArray(range.combos) || range.combos.length !== (p ? 12 : 11)
      || range.combos.some(v => !record(v) || !validCombo(v.cards) || !finite(v.weight) || v.weight < 0 || v.weight > 1)
      || new Set(range.combos.map(v => v.cards)).size !== range.combos.length) fail();
  }
  const expected = { root:[0,['check','bet:'+c.betBb],[20,20],10], 'root/check':[1,['check'],[20,20],10], ['root/bet:'+c.betBb]:[1,['fold','call'],[20-c.betBb,20],10+c.betBb] };
  const paths = new Set();
  for (const node of pack.nodes) {
    if (!record(node)) fail();
    const shape = expected[node.path];
    if (!shape || paths.has(node.path) || node.player !== shape[0] || JSON.stringify(node.stacksBb) !== JSON.stringify(shape[2]) || node.potBb !== shape[3]
      || (turn && JSON.stringify(node.board) !== JSON.stringify(c.board))
      || !Array.isArray(node.actions) || node.actions.some(a => !record(a)) || JSON.stringify(node.actions.map(a => a.id)) !== JSON.stringify(shape[1]) || !Array.isArray(node.combos)) fail();
    paths.add(node.path);
    if (node.actions.some(a => a.child !== node.path+'/'+a.id || a.amountBb !== (a.id.startsWith('bet:') || a.id === 'call' ? c.betBb : 0))) fail();
    const seen = new Set();
    for (const combo of node.combos) {
      if (!record(combo) || !validCombo(combo.cards) || seen.has(combo.cards) || !pack.ranges[node.player].combos.some(v => v.cards === combo.cards)
        || !finite(combo.reachWeight) || combo.reachWeight < 0 || combo.reachWeight > 1 || !finite(combo.opponentMass) || combo.opponentMass < 0
        || !Array.isArray(combo.frequency) || combo.frequency.length !== node.actions.length || combo.frequency.some(v => !finite(v) || v < 0 || v > 1) || Math.abs(combo.frequency.reduce((a,b) => a+b,0)-1)>1e-6
        || !Array.isArray(combo.evBb) || combo.evBb.length !== node.actions.length || combo.evBb.some(v => v !== null && !finite(v))
        || combo.status !== (combo.opponentMass === 0 ? 'no-compatible-opponent' : combo.reachWeight === 0 ? 'unreachable' : 'reachable')
        || (combo.opponentMass === 0 && combo.evBb.some(v => v !== null))) fail();
      seen.add(combo.cards);
    }
    if (seen.size !== pack.ranges[node.player].combos.length) fail();
  }
  if (turn) validateSolutionChances(pack, fail);
  return pack;
}

function validateBettingLinePack(pack,fail) {
  const c=pack.conditions;
  if (!record(c)||c.id!==pack.id||JSON.stringify(c.board)!==JSON.stringify(['Ks','7d','2h','8h'])||JSON.stringify(c.ranges)!==JSON.stringify(['KK,KQs,T9s,A5s','77,KJs,TT,JTs'])
    ||c.potBb!==10||c.stackBb!==20||c.players!==2||c.street!=='turn'||c.futureCards!==true||c.rake!==0||c.icm!==false||c.betPotFraction!==0.5||c.continuation!=='river-betting'
    ||c.tableMax!==null||c.originalStackBb!==null||typeof c.rangeSource!=='string'||pack.comboEncoding!=='tuple-v1'||pack.verification?.passed!==true||pack.verification?.report?.passed!==true
    ||pack.ev?.unit!=='bb'||pack.ev?.baseline!=='solve-start-zero-sum-half-pot'||pack.ev?.continuation!=='solved-average-strategy'||pack.ev?.approximateEqualityBb!==0.002
    ||!Array.isArray(pack.nodes)||pack.nodes.length!==580||!Array.isArray(pack.chanceNodes)||pack.chanceNodes.length!==3||!Array.isArray(pack.terminals)||pack.terminals.length!==722
    ||!Array.isArray(pack.rootEvBb)||pack.rootEvBb.length!==2||!pack.rootEvBb.every(finite)||!Array.isArray(pack.ranges)||pack.ranges.length!==2) fail();
  for (const role of ['primary','reference']) if(!record(pack.provenance?.[role])||!/^[a-f0-9]{40}$/.test(pack.provenance[role].commit)||typeof pack.provenance[role].license!=='string') fail();
  const cardValue=card=>'23456789TJQKA'.indexOf(card[0])*4+'cdhs'.indexOf(card[1]);
  const legal=(hand,board)=>/^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(hand)&&cardValue(hand.slice(0,2))>cardValue(hand.slice(2))&&!board.some(card=>hand.includes(card));
  for(const [p,r] of pack.ranges.entries()) if(!record(r)||r.player!==p||!Array.isArray(r.combos)||r.combos.length!==(p?16:14)||new Set(r.combos.map(h=>h.cards)).size!==r.combos.length||r.combos.some(h=>!legal(h.cards,c.board)||h.weight!==1))fail();
  const all=new Map();
  for(const node of [...pack.nodes,...pack.chanceNodes,...pack.terminals]) {if(!record(node)||typeof node.path!=='string'||all.has(node.path))fail();all.set(node.path,node);}
  const visited=new Set();
  function walk(path,board,stacks,pot,actor,facing=false) {
    const raw=all.get(path);if(!raw||visited.has(path))fail();visited.add(path);
    if(pack.terminals.includes(raw)) {if(raw.kind!==(path.endsWith('/fold')?'fold':'showdown'))fail();return;}
    if(raw.combos&&(!Array.isArray(raw.combos)||raw.combos.some(r=>!Array.isArray(r)||r.length!==7)))fail();
    const n=decodedNode(pack,raw);
    if(JSON.stringify(n.board)!==JSON.stringify(board)||n.potBb!==pot||JSON.stringify(n.stacksBb)!==JSON.stringify(stacks))fail();
    if(pack.chanceNodes.includes(n)) {
      if(board.length!==4||Math.abs(n.pairProbability-1/44)>1e-12||!Array.isArray(n.outcomes)||n.outcomes.length!==48)fail();
      const seen=new Set();let total=0;
      for(const edge of n.outcomes) {
        if(!record(edge)||!(/^[2-9TJQKA][cdhs]$/).test(edge.card)||board.includes(edge.card)||seen.has(edge.card)||edge.child!==path+'/river:'+edge.card||!finite(edge.probability)||edge.probability<0||edge.probability>1)fail();
        seen.add(edge.card);total+=edge.probability;walk(edge.child,[...board,edge.card],stacks,pot,0);
      }
      if(Math.abs(total-1)>1e-6)fail();return;
    }
    const ids=facing?['fold','call']:['check','bet:'+pot/2];
    if(n.player!==actor||!Array.isArray(n.actions)||JSON.stringify(n.actions.map(a=>a?.id))!==JSON.stringify(ids)||!Array.isArray(n.combos))fail();
    const hands=pack.ranges[actor].combos.map(h=>h.cards).filter(h=>legal(h,board));
    if(n.combos.length!==hands.length||new Set(n.combos.map(h=>h.cards)).size!==hands.length)fail();
    for(const h of n.combos) {
      if(!hands.includes(h.cards)||!finite(h.reachWeight)||h.reachWeight<0||h.reachWeight>1||!finite(h.opponentMass)||h.opponentMass<0
        ||!Array.isArray(h.frequency)||h.frequency.length!==2||h.frequency.some(v=>!finite(v)||v<0||v>1)||Math.abs(h.frequency[0]+h.frequency[1]-1)>1e-6
        ||!Array.isArray(h.evBb)||h.evBb.length!==2||h.evBb.some(v=>v!==null&&!finite(v))
        ||h.status!==(h.opponentMass===0?'no-compatible-opponent':h.reachWeight===0?'unreachable':'reachable')||(h.opponentMass===0&&h.evBb.some(v=>v!==null)))fail();
    }
    for(const a of n.actions) {
      const amount=a.id.startsWith('bet:')?pot/2:a.id==='call'?Math.abs(stacks[0]-stacks[1]):0;
      if(a.child!==path+'/'+a.id||a.amountBb!==amount||amount>stacks[actor])fail();
      const next=[...stacks];next[actor]-=amount;
      if(a.id==='fold'||(board.length===5&&(a.id==='call'||path.endsWith('/check')&&a.id==='check'))) {
        if(!pack.terminals.includes(all.get(a.child)))fail();
      } else if(board.length===4&&(a.id==='call'||path.endsWith('/check')&&a.id==='check')) {
        if(!pack.chanceNodes.includes(all.get(a.child)))fail();
      } else if(!pack.nodes.includes(all.get(a.child)))fail();
      walk(a.child,board,next,pot+amount,1-actor,a.id.startsWith('bet:'));
    }
  }
  walk('root',c.board,[20,20],10,0);
  if(visited.size!==all.size)fail();
  return pack;
}

function validateSolutionChances(pack, fail) {
  const c=pack.conditions, expected=['root/check/check','root/bet:5/call'];
  if (!Array.isArray(pack.chanceNodes) || pack.chanceNodes.length !== 2 || new Set(pack.chanceNodes.map(n => n?.path)).size !== 2) fail();
  const deck=[...'23456789TJQKA'].flatMap(r => [...'cdhs'].map(s => r+s)).filter(card => !c.board.includes(card));
  for (const chance of pack.chanceNodes) {
    const called=chance?.path === 'root/bet:5/call';
    if (!record(chance) || !expected.includes(chance.path) || JSON.stringify(chance.board) !== JSON.stringify(c.board)
      || chance.potBb !== (called ? 20 : 10) || JSON.stringify(chance.stacksBb) !== JSON.stringify(called ? [15,15] : [20,20])
      || Math.abs(chance.pairProbability-1/44) > 1e-12 || !finite(chance.pairProbability)
      || JSON.stringify(chance.forcedActions) !== JSON.stringify(['check','check']) || !Array.isArray(chance.outcomes) || chance.outcomes.length !== 48) fail();
    const seen=new Set();let total=0;
    for (const o of chance.outcomes) {
      if (!record(o) || !deck.includes(o.card) || seen.has(o.card) || o.path !== chance.path+'/river:'+o.card
        || JSON.stringify(o.board) !== JSON.stringify([...c.board,o.card]) || !finite(o.probability) || o.probability < 0 || o.probability > 1
        || !Array.isArray(o.rootEvBb) || o.rootEvBb.length !== 2 || o.rootEvBb.some(v => v !== null && !finite(v))
        || !Array.isArray(o.ranges) || o.ranges.length !== 2) fail();
      seen.add(o.card);total+=o.probability;
      for (const [p,r] of o.ranges.entries()) {
        const live=pack.ranges[p].combos.map(h => h.cards).filter(h => !h.includes(o.card));
        if (!record(r) || r.player !== p || !Array.isArray(r.combos) || JSON.stringify([...r.combos].sort()) !== JSON.stringify(live.sort())) fail();
      }
      const pairs=o.ranges[0].combos.reduce((sum,a) => sum+o.ranges[1].combos.filter(b => new Set([...a.match(/.{2}/g),...b.match(/.{2}/g)]).size === 4).length,0);
      if (o.compatiblePairs !== pairs || (o.probability === 0 && o.rootEvBb.some(v => v !== null)) || (o.probability > 0 && !o.rootEvBb.every(finite))) fail();
    }
    if (Math.abs(total-1) > 1e-6) fail();
  }
}

export function resolveSolutionQuestion(pack, question) {
  const ref = question.solution;
  const node = pack && solutionNode(pack, ref?.nodePath);
  const combo = node?.combos.find(c => c.cards === ref?.combo);
  if (!node || !combo || ref.packId !== pack.id || ref.packHash !== pack.contentHash || !trainableSolutionCombos(node).includes(combo)
    || JSON.stringify(question.choices) !== JSON.stringify(node.actions.map(a => a.id))) throw new Error('题目与本轮冻结的求解答案不一致。');
  return { node, combo };
}
export function evaluateSolutionAnswer(pack, question, choice) {
  const { node, combo } = resolveSolutionQuestion(pack, question);
  const index = node.actions.findIndex(a => a.id === choice);
  if (index < 0) throw new Error('请先选择一个行动。');
  const bestEvBb = Math.max(...combo.evBb), selectedEvBb = combo.evBb[index], lossBb = Math.max(0,bestEvBb-selectedEvBb);
  return { kind:'solution', scoringVersion:question.scoringVersion, packHash:pack.contentHash, bestEvBb, selectedEvBb, lossBb, approximateEquivalent:lossBb <= pack.ev.approximateEqualityBb };
}
