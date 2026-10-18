// [V7.18.0 新增] Browse an explicit restricted tree before practising its decisions.
import { Utils } from '../utils.js';
import { SOLUTION_PACKS, getSolutionPack } from '../data/solutions/index.js';
import { solutionNode, solutionClass, solutionActionLabel, aggregateSolutionClasses, trainableSolutionCombos, validateSolutionPack, solutionChance, solutionTerminalLabel } from './solutionPackModel.js';
import { RANGE_HANDS } from './preflopRangeModel.js';
import { PracticeWorkspace } from './practiceWorkspace.js';
const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"','&quot;').replaceAll("'",'&#39;');
import { SOLUTION_EV_EXPLANATION, solutionValuesTable } from './solutionPackView.js';
import { compareRiverNodes, riverCardFeatures } from './solutionComparisonModel.js';
function comparisonView(pack,node,card,combo) {
  const other=card||['Ah','6c','7c','3c'].find(c=>!node.board.includes(c));
  const result=compareRiverNodes(pack,node.path,other,combo);
  const percent=v=>v===null?'本分支无数据':Utils.safeFixed(v*100,2)+'%';
  const value=(side,i)=>!side.combo?'底牌与公共牌冲突':side.combo.status!=='reachable'?({unreachable:'这手未进入当前分支','no-compatible-opponent':'对手范围没有可匹配手牌'})[side.combo.status]:percent(side.combo.frequency[i])+' / '+(side.combo.evBb[i]===null?'未计算':Utils.safeFixed(side.combo.evBb[i],4)+'bb');
  return '<section class="solution-comparison" data-solution-comparison><h4>同一分支，换一张河牌</h4><p>保留相同行动路径、行动方、底池和筹码，对照换牌后的数据。</p><label>对照河牌<select data-solution-compare-card>'+result.chance.outcomes.filter(o=>o.card!==node.board[4]).map(o=>'<option value="'+o.card+'"'+(o.card===other?' selected':'')+'>'+o.card+' · '+esc(riverCardFeatures(node.board.slice(0,4),o.card,combo).join('、'))+'</option>').join('')+'</select></label>'+
    '<div class="solution-compare-boards">'+[result.a,result.b].map((side,i)=>'<div><strong>'+(i?'对照':'当前')+'</strong> '+Utils.renderCardBadges(side.node.board.join(' '),{})+'<p>'+esc(side.features.join('、'))+'</p><p>公共牌合法组合：OOP '+side.legalCombos[0]+'／IP '+side.legalCombos[1]+'</p></div>').join('')+'</div>'+
    '<table class="solution-values"><caption>当前行动方的范围频率</caption><thead><tr><th>动作</th><th>当前</th><th>对照</th></tr></thead><tbody>'+node.actions.map((a,i)=>'<tr><th>'+esc(solutionActionLabel(a.id))+'</th><td>'+percent(result.a.frequency[i])+'</td><td>'+percent(result.b.frequency[i])+'</td></tr>').join('')+'</tbody></table>'+
    '<table class="solution-values"><caption>'+esc(combo)+' · 动作频率 / 期望值</caption><thead><tr><th>动作</th><th>当前</th><th>对照</th></tr></thead><tbody>'+node.actions.map((a,i)=>'<tr><th>'+esc(solutionActionLabel(a.id))+'</th><td>'+value(result.a,i)+'</td><td>'+value(result.b,i)+'</td></tr>').join('')+'</tbody></table>'+
    '<button class="ws-button" data-solution-compare-practice="'+esc(result.otherPath)+'"'+(!result.b.combo||result.b.combo.status!=='reachable'||result.b.combo.evBb.some(v=>v===null)?' disabled':'')+'>盲练对照河牌的这手牌</button></section>';
}
// [V7.18.1 新增] River branches display range-conditioned chance, never another decision grade.
function chanceView(pack,chance,card) {
  const o=chance.outcomes.find(o => o.card === card) || chance.outcomes[0];
  if(pack.conditions.continuation==='river-betting')return '<section class="solution-chance" data-solution-chance><h4>发河牌 → 继续下注决策</h4><p>选择公开候选河牌，再进入对应决策。河牌概率按双方范围和当前行动分支计算。</p><label>查看河牌<select data-solution-river>'+chance.outcomes.map(v=>'<option value="'+v.card+'"'+(v.card===o.card?' selected':'')+'>'+v.card+'</option>').join('')+'</select></label><p>当前分支下 '+esc(o.card)+' 的概率 '+Utils.safeFixed(o.probability*100,4)+'%</p><p>底池 '+chance.potBb+'bb · 双方剩余 '+chance.stacksBb[0]+'bb</p><button class="ws-button ws-button--primary" data-solution-node="'+esc(o.child)+'">进入这张河牌的决策</button></section>';
  const ev=value => value === null ? '本分支无数据' : Utils.safeFixed(value,4)+'bb';
  return '<section class="solution-chance" data-solution-chance><h4>发河牌 → 双方过牌摊牌</h4><p class="ws-muted">河牌概率按双方范围和当前行动分支计算。</p><label>查看河牌<select data-solution-river>'+chance.outcomes.map(v => '<option value="'+v.card+'"'+(v.card===o.card?' selected':'')+'>'+v.card+'</option>').join('')+'</select></label><div data-solution-river-detail><p>最终公共牌 '+Utils.renderCardBadges(o.board.join(' '),{})+'</p><p>当前分支下 '+esc(o.card)+' 的概率 <strong>'+Utils.safeFixed(o.probability*100,4)+'%</strong></p><p>河牌底池 '+chance.potBb+'bb · OOP 剩余 '+chance.stacksBb[0]+'bb／IP 剩余 '+chance.stacksBb[1]+'bb</p><p>扣除与公共牌冲突的手牌后，OOP '+o.ranges[0].combos.length+' 个组合／IP '+o.ranges[1].combos.length+' 个组合。</p>'+o.ranges.map(r => '<p class="solution-river-combos"><strong>'+(r.player?'IP':'OOP')+' 手牌组合：</strong>'+r.combos.map(h => '<span>'+esc(h)+'</span>').join(' ')+'</p>').join('')+'<p>该河牌下的范围平均摊牌期望值：OOP '+ev(o.rootEvBb[0])+'／IP '+ev(o.rootEvBb[1])+'。</p></div></section>';
}
export const SolutionWorkspace = {
  container:null, packId:'river-half-pot', nodePath:'root', hand:'', combo:'', riverCard:'', compareCard:'', snapshot:null, sourceDecision:null,
  init() {
    const root=document.getElementById('studyWorkspace'); if (!root || root.dataset.solutionBound) return;
    root.dataset.solutionBound='true';
    root.addEventListener('click',event => {
      const b=event.target.closest('button');if (!b) return;
      if (b.dataset.solutionNode) {this.nodePath=b.dataset.solutionNode;this.hand='';this.combo='';this.riverCard='';this.render();}
      if (b.dataset.solutionHand) {this.hand=b.dataset.solutionHand;this.combo='';this.render();}
      if (b.dataset.solutionCombo) {this.combo=b.dataset.solutionCombo;this.render();}
      if (b.hasAttribute('data-solution-practice')) this.openPractice();
      if(b.dataset.solutionComparePractice){PracticeWorkspace.openSolution(this.pack(),b.dataset.solutionComparePractice,this.sourceDecision);PracticeWorkspace.config.solutionCombo=this.combo;PracticeWorkspace.render();}
      if(b.hasAttribute('data-solution-line')){PracticeWorkspace.openSolution(this.pack(),'root',this.sourceDecision);PracticeWorkspace.config.solutionMode='line';PracticeWorkspace.render();}
      if (b.hasAttribute('data-solution-current')) {this.snapshot=null;this.render();}
    });
    root.addEventListener('change',event => {
      if (event.target.matches('[data-solution-pack]')) {this.packId=event.target.value;this.snapshot=null;this.nodePath='root';this.hand='';this.combo='';this.riverCard='';this.compareCard='';this.render();}
      if (event.target.matches('[data-solution-river]')) {this.riverCard=event.target.value;this.render();this.container.querySelector('[data-solution-river]')?.focus({preventScroll:true});}
      if(event.target.matches('[data-solution-compare-card]')){this.compareCard=event.target.value;this.render();this.container.querySelector('[data-solution-compare-card]')?.focus({preventScroll:true});}
    });
    root.addEventListener('keydown',event => {
      const b=event.target.closest('[data-solution-hand]');if (!b) return;
      const at=RANGE_HANDS.indexOf(b.dataset.solutionHand),delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:13,ArrowUp:-13}[event.key];
      if (!delta) return;event.preventDefault();
      const cells=[...this.container.querySelectorAll('[data-solution-hand]')];
      let next=at+delta;while(next>=0&&next<169&&cells[next].disabled) next+=delta;
      cells[next]?.focus();
    });
  },
  pack() {return this.snapshot || getSolutionPack(this.packId);},
  open(pack,nodePath='root',combo='') {
    validateSolutionPack(pack);this.snapshot=pack;this.packId=pack.id;this.nodePath=nodePath;this.combo=combo;this.hand=combo ? solutionClass(combo) : '';this.riverCard='';this.compareCard='';
  },
  openPractice() {
    const pack=this.pack();const node=solutionNode(pack,this.nodePath);
    if (node && trainableSolutionCombos(node).length) PracticeWorkspace.openSolution(pack,this.nodePath,this.sourceDecision);
  },
  render(container=this.container,sourceDecision=this.sourceDecision) {
    this.container=container;this.sourceDecision=sourceDecision;if (!container) return;
    const pack=this.pack(),node=solutionNode(pack,this.nodePath),c=pack.conditions;
    const old=this.snapshot && this.snapshot.contentHash!==getSolutionPack(pack.id)?.contentHash;
    const terminal=pack.terminals.find(t => t.path===this.nodePath);
    const chance=solutionChance(pack,this.nodePath);
    const groups=node ? aggregateSolutionClasses(node) : [];
    if (!groups.some(g => g.hand===this.hand)) this.hand=groups[0]?.hand || '';
    const group=groups.find(g => g.hand===this.hand);
    if (!group?.combos.some(v => v.cards===this.combo)) this.combo=group?.combos[0]?.cards || '';
    const combo=group?.combos.find(v => v.cards===this.combo);
    const canPractice=node && trainableSolutionCombos(node).length>0;
    const betting=c.continuation==='river-betting';
    const pathNodes=betting?pack.nodes.filter(n=>this.nodePath===n.path||this.nodePath.startsWith(n.path+'/')):pack.nodes;
    const headerPractice=container.closest('#studyWorkspace')?.querySelector('[data-study-practice]');
    if (headerPractice) headerPractice.disabled=!canPractice;
    container.innerHTML='<section class="solution-workspace"><div class="ws-section-heading"><div><p class="ws-eyebrow">求解研究</p><h3>样例条件</h3></div><label>样例<select data-solution-pack>'+SOLUTION_PACKS.map(p => '<option value="'+p.id+'"'+(p.id===pack.id?' selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select></label></div>'+
      (this.snapshot ? '<p class="ws-source" data-solution-snapshot>正在查看本轮冻结答案版本'+(old?' · 当前内置包已有更新 <button class="ws-button" data-solution-current>查看当前内置版</button>':'')+'</p>' : '')+
      '<div class="solution-conditions"><p>起点公共牌 '+Utils.renderCardBadges(c.board.join(' '),{})+'</p><p><strong>OOP 范围（先行动）</strong> '+esc(c.ranges[0])+' · <strong>IP 范围（后行动）</strong> '+esc(c.ranges[1])+'</p><p>起点底池 '+c.potBb+'bb · 双方剩余 '+c.stackBb+'bb · Rake 0 · ICM 未计</p><p>'+(betting?'可选动作：过牌、下注半池；面对下注：弃牌、跟注。':c.street === 'turn' ? '转牌可过牌或下注 '+c.betBb+'bb；继续后发河牌并过牌摊牌。' : 'OOP 可过牌或下注 '+c.betBb+'bb；IP 面对下注可弃牌或跟注。')+'</p>'+(betting?'<button class="ws-button ws-button--primary" data-solution-line>从转牌开始连续练习</button>':'')+'</div>'+
      (sourceDecision?'<p class="ws-context">来源疑问：'+esc(sourceDecision.question || '研究当前决策相关原理')+'。</p>':'')+
      (betting&&node?'<p data-solution-current-board>当前公共牌 '+Utils.renderCardBadges(node.board.join(' '),{})+'</p>':'')+
      '<nav class="solution-path" aria-label="求解行动路径">'+pathNodes.map(n => '<button class="ws-button" data-solution-node="'+esc(n.path)+'" aria-pressed="'+(n.path===this.nodePath)+'">'+esc(betting?n.path==='root'?'起点 · OOP':n.path.split('/').at(-1).startsWith('river:')?'河牌 '+n.path.split('/').at(-1).slice(6):solutionActionLabel(n.path.split('/').at(-1)):n.path==='root'?'起点 · OOP':n.path==='root/check'?'过牌后 · IP':'下注 '+c.betBb+'bb 后 · IP')+'</button>').join('')+'</nav>'+
      (node ? '<p class="ws-lead" data-solution-node-state>当前由'+(node.player?'IP':'OOP')+'决策 · 底池 '+node.potBb+'bb · OOP 剩余 '+node.stacksBb[0]+'bb／IP 剩余 '+node.stacksBb[1]+'bb</p><div class="practice-toolbar">'+node.actions.map(a => '<button class="ws-button" data-solution-node="'+esc(a.child)+'">沿 '+esc(solutionActionLabel(a.id))+' 查看</button>').join('')+'<button class="ws-button ws-button--primary" data-solution-practice'+(canPractice?'':' disabled')+'>练习这个节点</button></div><div class="solution-layout"><div><h4>类别矩阵</h4><div class="solution-matrix" aria-label="求解手牌类别">'+RANGE_HANDS.map(hand => {const g=groups.find(v=>v.hand===hand);return '<button data-solution-hand="'+hand+'"'+(!g?' disabled':'')+' aria-label="'+hand+' '+(!g?'未覆盖':g.weight===0?'这手未进入当前分支':'已录入')+'" aria-pressed="'+(this.hand===hand)+'">'+hand+'</button>';}).join('')+'</div></div><aside class="solution-detail"><h4>'+esc(this.hand)+' · 类别聚合</h4>'+(group?solutionValuesTable(node,group):'')+'<h4>具体花色组合</h4><div class="practice-toolbar">'+(group?.combos || []).map(v => '<button class="ws-button" data-solution-combo="'+v.cards+'" aria-pressed="'+(v.cards===this.combo)+'">'+esc(v.cards)+'</button>').join('')+'</div>'+(combo?'<div data-solution-combo-detail><p><strong>'+esc(combo.cards)+'</strong> · '+({reachable:'已进入当前分支',unreachable:'这手未进入当前分支','no-compatible-opponent':'对手范围没有可匹配手牌'})[combo.status]+'</p>'+solutionValuesTable(node,combo)+'</div>':'')+'</aside></div>' : chance ? chanceView(pack,chance,this.riverCard) : '<div class="ws-empty" data-solution-terminal><h4>'+(terminal?solutionTerminalLabel(pack,this.nodePath):'未覆盖的节点')+'</h4><p>这个分支已经结束，没有后续决策。</p></div>')+
      (betting&&node?.board.length===5?comparisonView(pack,node,this.compareCard===node.board[4]?'':this.compareCard,this.combo):'')+
      '<details class="solution-evidence"><summary>数据说明与来源</summary><p>'+SOLUTION_EV_EXPLANATION+'</p><p>逐动作 EV 独立核验门槛 0.001bb；NashConv 为双方单方改进收益之和，要求 ≤ 初始底池的 0.01%。'+(betting?'两街样例通过双方完整树与组合核对、独立平均策略 EV 与最佳回应计算、双引擎根 EV 及花色置换；':'该样例通过解析基准与独立组合枚举、双引擎及花色置换检查。')+'</p><p>主引擎 ucsandman/postflop · MIT · '+esc(pack.provenance.primary.commit)+'。Copyright (c) 2026 Wes Sander。</p><p>对照 b-inary/postflop-solver · AGPL-3.0-or-later · '+esc(pack.provenance.reference.commit)+'。</p><p>答案内容 SHA-256：<code class="solution-hash">'+esc(pack.contentHash)+'</code></p></details></section>';
  },
};
