import { solutionNode, solutionChance, solutionQuestion, trainableSolutionCombos } from './solutionPackModel.js';
const compatible=(a,b)=>new Set([...(a.match(/.{2}/g)||[]),...(b.match(/.{2}/g)||[])]).size===4;
function draw(items,weights,random) {
  const total=weights.reduce((a,b)=>a+b,0);
  if(!items.length||!(total>0))throw new Error('当前分支没有可用的策略质量，无法继续。');
  let value=Math.max(0,Math.min(1-Number.EPSILON,random()))*total;
  let i=0;while(i<items.length-1&&value>=weights[i])value-=weights[i++];return items[i];
}
export function startSolutionLine(session,random=Math.random) {
  const pack=session.solutionSnapshot,q=session.questions[0];
  if(pack.id!=='turn-river-half-pot'||q.solution.nodePath!=='root')throw new Error('连续训练目前从两街样例的转牌起点开始。');
  const player=Number(session.config.solutionPlayer??0);
  if(![0,1].includes(player))throw new Error('请选择 OOP 或 IP 练习视角。');
  const hands=pack.ranges[player].combos;
  const hero=player===0?q.solution.combo:draw(hands,hands.map(c=>c.weight*pack.ranges[0].combos.filter(o=>compatible(c.cards,o.cards)).reduce((sum,o)=>sum+o.weight,0)),random).cards;
  const opponents=pack.ranges[1-player].combos.filter(c=>compatible(hero,c.cards));
  const opponent=draw(opponents,opponents.map(c=>c.weight),random);
  const line={heroPlayer:player,heroCombo:hero,opponentCombo:opponent.cards,path:'root',steps:[],status:'active',message:''};
  if(player===1)return continueLine({...session,questions:[],index:0},line,random);
  return {...session,questions:[q],line};
}
export function advanceSolutionLine(session,random=Math.random) {
  const pack=session.solutionSnapshot,q=session.questions[session.index],response=session.responses[q.id];
  if(!response?.submitted)throw new Error('请先提交当前决策。');
  const line={...session.line,steps:[...session.line.steps]};
  const node=solutionNode(pack,q.solution.nodePath),edge=node.actions.find(a=>a.id===response.choice);
  line.steps.push({path:node.path,player:node.player,action:edge.id});line.path=edge.child;
  return continueLine(session,line,random);
}
function continueLine(session,line,random) {
  const pack=session.solutionSnapshot;
  for(let count=0;count<12;count++) {
    if(pack.terminals.some(t=>t.path===line.path))return {...session,status:'completed',endedAt:new Date().toISOString(),line:{...line,status:'completed',message:'这条行动线已结束。各次决策分别按当时节点对照，不合计为整手 GTO 分数。'}};
    const chance=solutionChance(pack,line.path);
    if(chance) {
      const legal=chance.outcomes.filter(o=>!line.heroCombo.includes(o.card)&&!line.opponentCombo.includes(o.card));
      const outcome=draw(legal,legal.map(()=>1),random);
      line.steps.push({path:line.path,card:outcome.card});line.path=outcome.child;continue;
    }
    const next=solutionNode(pack,line.path);
    if(!next)throw new Error('冻结答案缺少后续节点，当前记录仍保留。');
    if(next.player===line.heroPlayer) {
      const combo=trainableSolutionCombos(next).find(c=>c.cards===line.heroCombo);
      if(!combo)return {...session,status:'completed',endedAt:new Date().toISOString(),line:{...line,status:'uncovered',message:'所选行动后的底牌在本策略中不可达或缺少完整 EV，本轮停在这里，不补造后续评分。'}};
      return {...session,questions:[...session.questions,solutionQuestion(pack,next,combo)],index:session.questions.length,line};
    }
    const combo=next.combos.find(c=>c.cards===line.opponentCombo);
    if(!combo)throw new Error('对手底牌与发牌分支冲突，当前记录仍保留。');
    const action=draw(next.actions,combo.frequency,random);
    line.steps.push({path:next.path,player:next.player,action:action.id});line.path=action.child;
  }
  throw new Error('后续行动超出本样例限制，请保留记录并回到研究节点。');
}

export function validateSolutionLine(session) {
  const line=session.line,pack=session.solutionSnapshot;
  if(!line||pack.id!=='turn-river-half-pot'||![0,1].includes(line.heroPlayer)||!compatible(line.heroCombo||'',line.opponentCombo||'')
    ||!pack.ranges[line.heroPlayer].combos.some(c=>c.cards===line.heroCombo)||!pack.ranges[1-line.heroPlayer].combos.some(c=>c.cards===line.opponentCombo)
    ||!['active','completed','uncovered'].includes(line.status)||typeof line.message!=='string'||!Array.isArray(line.steps))throw new Error('连续练习的冻结行动线无效。');
  let path='root',heroQuestion=0;
  for(const step of line.steps) {
    if(step.path!==path)throw new Error('连续练习行动顺序无效。');
    const chance=solutionChance(pack,path);
    if(chance) {
      const edge=chance.outcomes.find(o=>o.card===step.card);
      if(!edge||line.heroCombo.includes(step.card)||line.opponentCombo.includes(step.card))throw new Error('连续练习发牌无效。');
      path=edge.child;
    } else {
      const node=solutionNode(pack,path),edge=node?.actions.find(a=>a.id===step.action);
      if(!edge||step.player!==node.player)throw new Error('连续练习动作无效。');
      if(node.player===line.heroPlayer) {
        const q=session.questions[heroQuestion++];
        if(q?.solution.nodePath!==path||session.responses[q.id]?.choice!==step.action||!session.responses[q.id]?.submitted)throw new Error('连续练习回答与行动线不一致。');
      }
      path=edge.child;
    }
  }
  const active=line.status==='active';
  if(path!==line.path||session.index!==session.questions.length-1||session.questions.some(q=>q.solution.combo!==line.heroCombo||solutionNode(pack,q.solution.nodePath)?.player!==line.heroPlayer)
    ||(active&&(session.status!=='active'&&session.status!=='stopped'||heroQuestion!==session.questions.length-1||session.questions.at(-1).solution.nodePath!==path))
    ||(!active&&(session.status!=='completed'||heroQuestion!==session.questions.length)))throw new Error('连续练习进度不一致。');
  if(line.status==='completed'&&!pack.terminals.some(t=>t.path===path))throw new Error('连续练习尚未到达结算节点。');
  if(line.status==='uncovered') {
    const node=solutionNode(pack,path);
    if(!node||node.player!==line.heroPlayer||trainableSolutionCombos(node).some(c=>c.cards===line.heroCombo))throw new Error('连续练习的未覆盖状态无效。');
  }
}
