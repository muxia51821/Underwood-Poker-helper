import { solutionNode, solutionComboWeight } from './solutionPackModel.js';
const ranks='23456789TJQKA';
const hasFlush=cards=>[...'cdhs'].some(s=>cards.filter(c=>c[1]===s).length>=5);
function hasStraight(cards) {
  const values=new Set(cards.map(c=>ranks.indexOf(c[0])+2));if(values.has(14))values.add(1);
  for(let start=1;start<=10;start++)if(Array.from({length:5},(_,i)=>start+i).every(v=>values.has(v)))return true;
  return false;
}
export function riverCardFeatures(board,card,combo='') {
  const tags=[];
  if(board.some(c=>c[0]===card[0]))tags.push('公共牌配对');
  if(board.filter(c=>c[1]===card[1]).length===2)tags.push('公共牌出现三张同花');
  const hole=combo.match(/.{2}/g)||[];
  if(hole.length===2&&!combo.includes(card)) {
    const before=[...board,...hole],after=[...before,card];
    if(!hasFlush(before)&&hasFlush(after))tags.push('所选底牌完成同花');
    if(!hasStraight(before)&&hasStraight(after))tags.push('所选底牌完成顺子');
  }
  return tags.length?tags:['其他河牌'];
}
function summary(pack,node,combo) {
  const weights=node.combos.map(solutionComboWeight),total=weights.reduce((a,b)=>a+b,0);
  return {node,combo:node.combos.find(c=>c.cards===combo)||null,
    legalCombos:pack.ranges.map(r=>r.combos.filter(c=>!node.board.some(card=>c.cards.includes(card))).length),
    frequency:node.actions.map((_,i)=>total?node.combos.reduce((sum,c,j)=>sum+weights[j]*c.frequency[i],0)/total:null),
    mass:total,features:riverCardFeatures(node.board.slice(0,4),node.board[4],combo)};
}
export function compareRiverNodes(pack,nodePath,otherCard,combo='') {
  const match=nodePath.match(/^(.*)\/river:([2-9TJQKA][cdhs])(.*)$/);
  if(pack.conditions.continuation!=='river-betting'||!match)throw new Error('请先选择可下注两街样例的河牌决策。');
  const chance=pack.chanceNodes.find(n=>n.path===match[1]);
  if(!chance?.outcomes.some(o=>o.card===otherCard))throw new Error('该分支没有这张合法河牌。');
  const a=solutionNode(pack,nodePath),b=solutionNode(pack,match[1]+'/river:'+otherCard+match[3]);
  if(!a||!b||a.player!==b.player||a.potBb!==b.potBb||JSON.stringify(a.stacksBb)!==JSON.stringify(b.stacksBb)
    ||JSON.stringify(a.actions.map(v=>[v.id,v.amountBb]))!==JSON.stringify(b.actions.map(v=>[v.id,v.amountBb])))throw new Error('两个河牌节点的行动条件不一致。');
  return {chance,a:summary(pack,a,combo),b:summary(pack,b,combo),otherPath:b.path};
}
