// [V7.14.0 新增] Presets, frozen questions, explicit submission, manual progression and local history.
import { Utils } from '../utils.js';
import { DataSync } from './dataSync.js'; // [V7.16.0 新增]
import { HandRepo } from '../store/store.js';
import { PracticeStore } from '../store/practiceStore.js';
import { Navigation } from './navigation.js';
import { STRATEGY_TOPICS, resolveTopic } from '../data/strategyFramework.js';
import { BOARD_LABELS } from './studyAnalyzeModel.js';
import { HandReplay } from './handReplay.js';
import { startPractice, submitPractice, nextPractice, repeatPractice, repeatPracticeQuestion, solutionReviewQueue, rangeActions, referenceValues, newPracticeId, questionPool } from './practiceModel.js';
import { SOLUTION_PACKS, getSolutionPack } from '../data/solutions/index.js';
import { solutionActionLabel, resolveSolutionQuestion } from './solutionPackModel.js';
import { SOLUTION_EV_EXPLANATION, solutionValuesTable } from './solutionPackView.js';
import { DecisionWorkspaceStore } from '../store/decisionWorkspaceStore.js'; // [V7.19.0 新增]
import { decisionContext } from './decisionContext.js';
import { POSTFLOP_PLAN_LABELS } from './postflopReviewModel.js';

const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const option = (value, text, selected) => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(text) + '</option>';
const button = (action, text, primary = false) => '<button type="button" class="ws-button' + (primary ? ' ws-button--primary' : '') + '" data-practice-action="' + action + '">' + text + '</button>';
const cards = value => Utils.renderCardBadges(Array.isArray(value) ? value.join(' ') : value || '', {});
const typeName = type => ({ concept: '概念自测', range: '范围倾向', personal: '个人手牌练习', solution: '求解样例练习' })[type] || type;
const streetName = key => ({ flop: '翻牌', turn: '转牌', river: '河牌' })[key] || key;
// [V7.18.1 修改] A solver session is identified by its frozen sample, not a leftover topic default.
const sessionTitle = session => session.config.type === 'solution'
  ? [session.solutionSnapshot.title, session.config.solutionMode==='line'?'连续行动线 · '+(session.line?.heroPlayer===1?'IP':'OOP'):session.config.solutionMode==='replay'?'原行动线逐题复练':session.config.solutionNodePath === 'root' ? '起点 · OOP' : session.config.solutionNodePath, session.config.learningQuestion].filter(Boolean).join(' · ')
  : session.config.learningQuestion || resolveTopic(session.config.topicId)?.title || session.config.scenario || '个人复盘';
const defaults = () => ({ type: 'concept', topicId: 'flop', scenario: 'BTNvsBB', category: '', input: 'tendency', detail: 'simple',
  count: 10, solutionPackId: 'river-half-pot', solutionNodePath: 'root', solutionPlayer: 0, learningQuestion: '', name: '', handId: '', street: 'flop', decisionIndex: 0, decisionKind: '', confirmed: false, markedOnly: true, returnTab: 'study' });

export const PracticeWorkspace = {
  config: defaults(), view: 'home', historyId: '', error: '', onStudy: null, onSolutionStudy: null, solutionCandidate: null,
  init() {
    this.root = document.getElementById('practiceWorkspace');
    if (!this.root || this.root.dataset.bound) return;
    this.root.dataset.bound = 'true';
    this.root.addEventListener('input', event => {
      const field = event.target.dataset.practiceConfig;
      if (field) this.config[field] = event.target.value;
      if (event.target.matches('[data-practice-draft]')) this.saveDraft();
      if (event.target.matches('[data-practice-note]')) this.saveNote(event.target.value);
    });
    this.root.addEventListener('change', event => {
      const field = event.target.dataset.practiceConfig;
      if (field) {
        this.config[field] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        if (field === 'solutionPackId') { this.solutionCandidate = null; this.config.solutionNodePath = 'root'; }
        if(field==='type')this.config.solutionMode='node';
        if(field==='solutionPackId')this.config.solutionMode='node';
        if(field==='solutionMode'&&event.target.value==='line')this.config.solutionNodePath='root';
        if(['solutionPackId','solutionNodePath','solutionMode'].includes(field))this.config.solutionCombo='';
        if (['handId', 'street'].includes(field)) this.config.decisionIndex = 0;
        if (['handId', 'street', 'decisionIndex', 'decisionKind'].includes(field)) this.config.confirmed = false;
        if (event.target.tagName === 'SELECT' || event.target.type === 'checkbox') {
          this.render(); this.root.querySelector('[data-practice-config="' + field + '"]')?.focus({ preventScroll: true });
        }
      }
      if (event.target.matches('[data-practice-draft]')) this.saveDraft();
      if (event.target.matches('[data-practice-file]')) this.importFile(event.target.files[0]);
    });
    this.root.addEventListener('click', event => {
      const control = event.target.closest('button');
      if (!control) return;
      try {
        if(control.dataset.practiceReviewQuestion) {
          const source=PracticeStore.load().sessions.find(s=>s.id===control.dataset.practiceReviewSession);
          if(!source)throw new Error('原练习已不存在，请重新载入复习列表。');
          return this.addSession(repeatPracticeQuestion(source,control.dataset.practiceReviewQuestion));
        }
        if(control.dataset.practiceReviewRemove) {
          const key=control.dataset.practiceReviewRemove;
          PracticeStore.change(state=>{
            const item=solutionReviewQueue(state.sessions).find(q=>q.key===key);
            if(!item)return state;
            return {...state,sessions:state.sessions.map(s=>({...s,responses:Object.fromEntries(Object.entries(s.responses).map(([id,r])=>[id,item.references.some(ref=>ref.sessionId===s.id&&ref.questionId===id)?{...r,review:false}:r]))}))};
          });this.render();return;
        }
        if (control.dataset.practicePreset) {
          const preset = PracticeStore.load().presets.find(item => item.id === control.dataset.practicePreset);
          this.config = { ...defaults(), ...preset.config, confirmed: false }; this.solutionCandidate = null; this.view = 'home'; this.render();
        }
        if (control.dataset.practiceSolutionQuestion) {
          const state = PracticeStore.load();
          const session = this.view === 'history' ? state.sessions.find(s => s.id === this.historyId) : this.active(state);
          const q = session?.questions.find(q => q.id === control.dataset.practiceSolutionQuestion);
          if (q) this.goStudy(session,q);
        }
        if (control.dataset.practiceHistory) { this.historyId = control.dataset.practiceHistory; this.view = 'history'; this.render(); }
        const action = control.dataset.practiceAction;
        if (action) this.act(action);
      } catch (error) { this.showError(error); }
    });
  },
  open(config = {}) {
    this.solutionCandidate = null;
    this.config = { ...defaults(), ...config, confirmed: false };
    this.view = 'home'; this.error = ''; Navigation.goToTab('practice');
  },
  openSolution(pack,nodePath,sourceDecision = null) {
    this.open({ type:'solution', solutionPackId:pack.id, solutionNodePath:nodePath, sourceDecision,
      learningQuestion:sourceDecision?.question || '', returnTab:'study' });
    this.solutionCandidate = pack; this.render();
  },
  goStudy(session = null, question = null) {
    if (!session && this.view === 'history') session = PracticeStore.load().sessions.find(s => s.id === this.historyId);
    if (!session && this.view === 'session') session = this.active();
    const config = session?.config || this.config;
    if (config.type === 'solution') {
      const pack = session?.solutionSnapshot || this.solutionCandidate || getSolutionPack(config.solutionPackId);
      const q = question || session?.questions[session.index];
      return this.onSolutionStudy?.(pack,q?.solution.nodePath || config.solutionNodePath,q?.solution.combo || '',config.sourceDecision);
    }
    return this.onStudy?.(config.topicId || 'flop',config.sourceDecision);
  },
  active(state = PracticeStore.load()) { return state.sessions.find(session => session.id === state.activeId); },
  replaceSession(session) {
    return PracticeStore.change(state => ({ ...state, sessions: state.sessions.map(item => item.id === session.id ? session : item),
      activeId: session.status === 'active' ? session.id : state.activeId === session.id ? null : state.activeId }));
  },
  assertCurrent(session) {
    const question = this.root.querySelector('[data-practice-question]');
    if (!question || question.dataset.practiceSession !== session.id || question.dataset.practiceQuestion !== session.questions[session.index].id) {
      throw new Error('练习已在其他页面更新，请点“继续上次”重新载入，当前输入未写到其他题目。');
    }
  },
  addSession(session) {
    PracticeStore.change(state => {
      if (state.activeId) throw new Error('请先继续或结束当前练习，已回答的内容会保留。');
      return { ...state, sessions: [...state.sessions, session], activeId: session.id };
    });
    this.view = 'session'; this.historyId = ''; this.render();
  },
  act(action) {
    this.error = '';
    if (action === 'start') {
      const config = { ...this.config };
      if (config.type === 'personal') {
        config.topicId = config.street === 'river' ? 'river' : config.street === 'turn' ? 'turn' : config.decisionKind === 'facingBet' ? 'defense' : 'flop';
        const hand = HandRepo.getById(config.handId);
        if (hand) {
          const node = decisionContext(hand, { street: config.street, actionIndex: Number(config.decisionIndex) });
          const draft = DecisionWorkspaceStore.read().drafts[hand.id + ':' + node.key], note = hand.decisionReviews?.[node.key];
          const previous = note && draft?.editedAt && note.updatedAt >= draft.editedAt ? note : draft || note;
          if (previous) config.personalReview = { handId: hand.id, revision: node.revision, key: node.key, draft: previous };
        }
      }
      return this.addSession(startPractice(config, HandRepo.getAll(), Math.random, config.type === 'solution' ? this.solutionCandidate : null));
    }
    if (action === 'preset') {
      if (!this.config.name.trim()) throw new Error('请给专项起一个名称。');
      const config = { ...this.config, confirmed: false };
      PracticeStore.change(state => ({ ...state, presets: [...state.presets, { id: newPracticeId(), name: config.name.trim(), config }] }));
      this.render(); return;
    }
    if (action === 'continue') { this.view = 'session'; this.render(); return; }
    if (action === 'home') { this.view = 'home'; this.render(); return; }
    if (action === 'return') {
      if (this.config.type === 'solution') return this.goStudy();
      if (this.config.returnTab === 'review') Navigation.goToReviewSubtab(this.config.returnSub || 'strategy');
      else if (this.config.returnTab === 'analyze' && this.config.sourceDecision) Navigation.goToHand(this.config.sourceDecision.handId, this.config.sourceDecision);
      else if (this.config.returnTab === 'analyze') Navigation.goToTab('analyze');
      else if (this.config.sourceDecision) this.onStudy?.(this.config.topicId, this.config.sourceDecision);
      else Navigation.goToTab('study');
      return;
    }
    if (action === 'export') { this.exportFile(); return; }
    if (action === 'legacy') { Navigation.goToReviewSubtab('discover'); return; }
    const state = PracticeStore.load();
    const session = this.view === 'history' ? state.sessions.find(item => item.id === this.historyId) : this.active(state);
    if (!session) throw new Error('请先开始或选择一轮练习。');
    if (action === 'study') return this.goStudy(session);
    if (this.view === 'session' && ['submit', 'next', 'stop', 'review'].includes(action)) this.assertCurrent(session);
    if (action === 'submit') this.replaceSession(submitPractice(session, this.readAnswer(session)));
    if (action === 'next') {
      const next = nextPractice(session); this.replaceSession(next);
      if (next.status !== 'active') { this.historyId = next.id; this.view = 'history'; }
    }
    if (action === 'stop') {
      this.replaceSession({ ...session, status: 'stopped', endedAt: new Date().toISOString() });
      this.historyId = session.id; this.view = 'history';
    }
    if (action === 'review') {
      const q = session.questions[session.index];
      const response = session.responses[q.id];
      this.replaceSession({ ...session, responses: { ...session.responses, [q.id]: { ...response, review: !response.review } } });
    }
    if (action === 'repeat' || action === 'redo') return this.addSession(repeatPractice(session, action === 'redo'));
    this.render();
  },
  showError(error) {
    this.error = error.message || String(error);
    const notice = this.root.querySelector('#practiceNotice');
    if (notice) { notice.textContent = this.error; notice.hidden = false; }
  },
  readAnswer(session) {
    const q = session.questions[session.index];
    const frequencies = {};
    this.root.querySelectorAll('[data-practice-frequency]').forEach(input => { frequencies[input.dataset.practiceFrequency] = input.value.trim() === '' ? null : Number(input.value); });
    return { choice: this.root.querySelector('[name=practiceChoice]:checked')?.value || '', frequencies,
      reason: this.root.querySelector('[data-practice-reason]')?.value || '',
      ...(q.type === 'personal' ? { nextStreetPlan: this.root.querySelector('[data-practice-next-plan]')?.value || '' } : {}),
      rangeHypothesis: this.root.querySelector('[data-practice-hypothesis]')?.value || '' };
  },
  saveDraft() {
    try {
      const session = this.active(); if (!session) return;
      const q = session.questions[session.index];
      if (session.responses[q.id]?.submitted || !this.root.querySelector('[data-practice-question]')) return;
      this.assertCurrent(session);
      this.replaceSession({ ...session, responses: { ...session.responses, [q.id]: { ...this.readAnswer(session), submitted: false } } });
    } catch (error) { this.showError(error); }
  },
  saveNote(note) {
    try {
      const state = PracticeStore.load();
      const session = state.sessions.find(item => item.id === this.historyId);
      if (session) this.replaceSession({ ...session, note });
    } catch (error) { this.showError(error); }
  },
  render() {
    if (!this.root) return;
    try {
      const state = PracticeStore.load();
      this.root.innerHTML = '<header class="ws-header"><div><p class="ws-eyebrow">PRACTICE / 练习</p><h2>带着一个问题，练到理解</h2><p>先判断，再对照。回答、理由和复习项只保存在本地。</p></div><div class="practice-toolbar">' + button('home', '专项与历史') + button('legacy', '旧 Quiz 与掌握度') + button('export', '下载备份') + '<label class="ws-button">恢复备份<input type="file" accept=".json" data-practice-file hidden></label></div></header><p id="practiceNotice" class="ws-boundary" role="alert"' + (this.error ? '' : ' hidden') + '>' + esc(this.error) + '</p><div id="practiceContent"></div>';
      const session = this.active(state);
      if (this.view === 'session' && session) this.renderQuestion(session);
      else if (this.view === 'history' && state.sessions.some(item => item.id === this.historyId)) this.renderHistory(state.sessions.find(item => item.id === this.historyId));
      else this.renderHome(state);
      this.onRender?.();
    } catch (error) {
      this.root.innerHTML = '<div class="ws-empty"><h2>练习记录暂时无法读取</h2><p role="alert">' + esc(error.message) + '</p>' + button('export', '先下载现有数据备份') + '</div>';
    }
  },
  renderHome(state) {
    const c = this.config;
    const active = this.active(state);
    const personalHands = HandRepo.getAll().filter(hand => (!c.markedOnly || hand.marked || hand.id === c.handId) && !HandReplay.parseReplay(hand).degraded);
    const hand = personalHands.find(item => item.id === c.handId);
    const streets = hand ? HandReplay.parseReplay(hand).streets.filter(street => street.key !== 'preflop' && street.actions.length) : [];
    if (streets.length && !streets.some(street => street.key === c.street)) c.street = streets[0].key;
    const street = streets.find(item => item.key === c.street);
    const field = (key, label, values) => '<label>' + label + '<select data-practice-config="' + key + '">' + values.map(([value, text]) => option(value, text, c[key])).join('') + '</select></label>';
    this.root.querySelector('#practiceContent').innerHTML =
      (active ? '<div class="ws-context"><div><strong>还有一轮练习未结束</strong><p>' + typeName(active.config.type) + ' · ' + Object.values(active.responses).filter(response => response.submitted).length + ' / ' + active.questions.length + ' 题已提交</p></div><div>' + button('continue', '继续上次', true) + '</div></div>' : '') +
      '<div class="practice-home"><section class="practice-setup"><h3>这次想练什么？</h3><div class="ws-filters">' + field('type', '题型', [['concept', '概念自测'], ['range', '范围倾向'], ['personal', '个人手牌：单个决策'], ['solution', '求解样例：具体手牌与动作期望值']]) +
      (c.type === 'concept' ? field('topicId', '主题', STRATEGY_TOPICS.map(topic => [topic.id, topic.title])) : '') +
      (c.type === 'range' ? field('scenario', '参考行动方与场景', [['BTNvsBB', 'BTN（IP）vs BB（OOP）· SRP 翻牌'], ['SBvsBB', 'SB（OOP）vs BB（IP）· SRP 翻牌']]) + field('category', '牌面类别', [['', '全部已收录类别'], ...Object.entries(BOARD_LABELS)]) + field('input', '回答方式', [['tendency', '判断整体倾向'], ['frequency', '估计整体频率']]) + field('detail', '粒度', [['simple', '下注 / 过牌'], ['sizes', '分开看下注尺寸']]) : '') +
      (c.type === 'solution' ? field('solutionPackId', '求解样例', SOLUTION_PACKS.map(p => [p.id,p.title])) +
        (c.solutionPackId==='turn-river-half-pot'?field('solutionMode','练习方式',[['node','练习所选节点'],['line','从转牌起点连续练习']]):'')+
        (c.solutionMode==='line'?field('solutionPlayer','练习位置',[[0,'OOP · 先行动'],[1,'IP · 后行动']])+'<p class="ws-muted">对手按冻结策略回应，继续分支按合法私牌发河牌。每次决策分别对照，不提前展示后续牌。</p>':field('solutionNodePath', '决策节点', (this.solutionCandidate || getSolutionPack(c.solutionPackId)).nodes.filter(n => n.actions.length > 1 && (c.solutionPackId!=='turn-river-half-pot' || n.board.length===4 || n.path===c.solutionNodePath)).map(n => [n.path,n.path === 'root' ? '起点 · OOP' : n.path]))) : '') +
      (c.type !== 'personal'&&c.solutionMode!=='line' ? field('count', '本轮题量', [[5, '5 题'], [10, '10 题'], [20, '20 题']]) : '') + '</div>' +
      (c.type === 'personal' ? '<div class="practice-personal-setup"><label class="ws-toggle"><input type="checkbox" data-practice-config="markedOnly"' + (c.markedOnly ? ' checked' : '') + '>仅显示我标记的手牌</label>' + field('handId', '来源手牌', [['', '请选择一手可回放的牌'], ...personalHands.map(item => [item.id, [item.ggId || item.id, item.date, item.heroPosition].filter(Boolean).join(' · ')])]) +
        (hand ? '<div class="ws-filters">' + field('street', '决策所在街道', streets.map(item => [item.key, item.label])) + field('decisionIndex', '在本街哪个动作之前？', (street?.actions || []).map((_, index) => [index, '第 ' + (index + 1) + ' 个动作前'])) + field('decisionKind', '当时的决策类型', [['', '请确认'], ['initiative', '可主动下注或过牌'], ['facingBet', '面对下注或加注']]) + '</div><p class="ws-muted">翻后行动未记录玩家身份，请在原回放中确认 Hero 的决策时点。</p><label class="ws-toggle"><input type="checkbox" data-practice-config="confirmed"' + (c.confirmed ? ' checked' : '') + '>我已确认这是我当时的决策，前序行动和决策类型正确。</label>' : '<p class="ws-empty">缺少可回放资料，无法建立个人练习题；仍可在普通复盘中查看。</p>') + '</div>' : '') +
      '<label class="practice-field">这次想弄清什么？<input data-practice-config="learningQuestion" value="' + esc(c.learningQuestion) + '" maxlength="500" placeholder="选填，例如：这类牌面为什么倾向过牌？"></label>' +
      (c.type==='solution'&&c.solutionCombo?'<p class="ws-muted">本轮固定底牌 '+cards(c.solutionCombo.match(/.{2}/g))+'，只练所选节点；切换节点后恢复按范围抽题。</p>':'')+

      '<p class="ws-muted">逐题作答 · 手动进入下一题 · 不限时</p><div class="practice-start">' + button('start', '开始练习', true) + button('return', '返回来源') + '</div><div class="practice-preset-save"><label class="practice-field">保存为专项<input data-practice-config="name" value="' + esc(c.name) + '" maxlength="80" placeholder="专项名称"></label>' + button('preset', '保存当前配置') + '</div></section><aside class="practice-library"><h3>我的专项</h3>' +
      (state.presets.length ? state.presets.map(preset => '<button class="ws-hand-link" data-practice-preset="' + esc(preset.id) + '"><strong>' + esc(preset.name) + '</strong><span>' + typeName(preset.config.type) + '</span></button>').join('') : '<p class="ws-muted">保存常用条件，下次直接开始。</p>') + '<h3>练习历史</h3>' +
      (state.sessions.length ? state.sessions.slice().reverse().map(session => '<button class="ws-hand-link" data-practice-history="' + esc(session.id) + '"><strong>' + typeName(session.config.type) + ' · ' + ({ active: '未结束', completed: '已完成', stopped: '中途结束' })[session.status] + '</strong><span>' + esc(sessionTitle(session)) + '</span><span>' + esc(session.startedAt.slice(0, 10)) + ' · ' + Object.values(session.responses).filter(response => response.submitted).length + ' / ' + session.questions.length + ' 题</span></button>').join('') : '<p class="ws-muted">完成或中途结束后，回答都能在这里找回。</p>') + '</aside></div>';
    const available = document.createElement('p'); available.id = 'practiceAvailable'; available.className = 'ws-muted';
    if(c.type==='solution'&&c.solutionMode==='line')available.textContent='本轮固定一手 '+(Number(c.solutionPlayer)===1?'IP':'OOP')+' 底牌，题目随实际行动逐步生成。';
    else if (c.type === 'personal') available.textContent = hand ? '人工确认后生成 1 个决策题。' : '当前没有选中的可用手牌；可调整标记筛选或回到普通复盘。';
    else { const count = questionPool(c, [], c.type === 'solution' ? this.solutionCandidate : null).length; available.textContent = '当前条件可用 ' + count + ' 题，本轮实际 ' + Math.min(Number(c.count) || 10, count) + ' 题。'; }
    this.root.querySelector('.practice-setup > .practice-start').before(available);
    const reviews=solutionReviewQueue(state.sessions);
    if(reviews.length) {
      const list=document.createElement('section');list.className='solution-review-queue';
      list.innerHTML='<h3>待复习求解节点 · '+reviews.length+'</h3><p class="ws-muted">沿用原底牌、原节点和冻结答案，单独再判断一次。完成复练后可主动移出列表。</p>'+reviews.map(({key,session:s,question:q})=>'<div class="ws-concept"><strong>'+esc(s.solutionSnapshot.title)+' · '+streetName(q.context.street)+' · '+esc(q.context.actor)+'</strong><p>'+cards(q.context.heroCards)+' / '+cards(q.context.board)+'</p><div class="practice-toolbar"><button class="ws-button" data-practice-review-question="'+esc(q.id)+'" data-practice-review-session="'+esc(s.id)+'"'+(active?' disabled title="先继续或结束当前练习"':'')+'>复练这个节点</button><button class="ws-button" data-practice-review-remove="'+esc(key)+'">移出复习</button></div></div>').join('');
      this.root.querySelector('.practice-library').prepend(list);
    }
  },
  questionContext(q) {
    const c = q.context;
    return '<div class="practice-context"><p>' + esc([c.topic, c.scenario, c.actor ? '参考决策方 ' + c.actor : '', q.type === 'solution' ? '求解样例' : c.profile, c.heroPosition ? '你的位置 ' + c.heroPosition : '', c.street ? streetName(c.street) : ''].filter(Boolean).join(' · ')) + '</p>' +
      (c.heroCards ? '<p>底牌 ' + cards(c.heroCards) + '</p>' : '') + (c.board ? '<p>公共牌 ' + cards(c.board) + '</p>' : '') +
      (c.stacksBb ? '<p>节点底池 ' + Utils.safeFixed(c.pot,2) + 'bb · OOP 剩余 ' + Utils.safeFixed(c.stacksBb[0],2) + 'bb／IP 剩余 ' + Utils.safeFixed(c.stacksBb[1],2) + 'bb</p><p>OOP 范围 ' + esc(c.ranges[0]) + '／IP 范围 ' + esc(c.ranges[1]) + '</p>'+(c.continuation==='river-betting'?'<p class="solution-action-path">已发生的行动：'+esc(c.actionPath.split('/').slice(1).map(t=>t.startsWith('river:')?'发河牌 '+t.slice(6):solutionActionLabel(t)).join(' → ')||'转牌起点')+'</p>':'') : '') +
      (c.prefix ? c.prefix.map(item => '<p class="practice-prefix"><strong>' + esc(item.street) + '</strong> ' + esc(item.actions.join(' → ') || '尚未行动') + '</p>').join('') +
        '<p class="ws-muted">行动前底池：' + (typeof c.pot === 'number' ? Utils.safeFixed(c.pot, 2) + 'bb' : '未知') + ' · 节点剩余有效筹码：' + (typeof c.effectiveStack === 'number' ? Utils.safeFixed(c.effectiveStack, 2) + 'bb' : '未知') + (c.conditionSource === 'user-entered' ? '（手工填写）' : '') + '</p>' : '') + '</div>';
  },
  renderQuestion(session) {
    const q = session.questions[session.index];
    const response = session.responses[q.id] || {};
    this.config = { ...defaults(), ...session.config };
    this.root.querySelector('#practiceContent').innerHTML = '<div class="practice-round"><div class="ws-section-heading"><h3>' + typeName(q.type) + (session.line ? ' · 第 ' + (session.index + 1) + ' 个决策' : ' · 第 ' + (session.index + 1) + ' / ' + session.questions.length + ' 题') + '</h3>' + button('stop', '结束并保留记录') + '</div><p class="ws-lead">' + esc(session.config.learningQuestion || '先判断，再看解释。') + '</p>' + (session.config.type === 'solution' ? '<p class="ws-source">' + esc(sessionTitle(session)) + '</p>' : '') + '<section data-practice-question="' + esc(q.id) + '" data-practice-session="' + esc(session.id) + '">' + this.questionContext(q) + '<h3>' + esc(q.prompt) + '</h3>' +
      (response.submitted ? this.feedback(q, response, session) + '<label class="ws-toggle">' + button('review', response.review ? '已加入复习 · 点击取消' : '加入待复习') + '</label><div class="practice-start">' + button('next', session.line ? '沿行动线继续' : session.index === session.questions.length - 1 ? '查看本轮总结' : '下一题', true) + '</div>' :
        (q.type === 'range' && q.input === 'frequency' ? '<div class="practice-frequency-input">' + rangeActions(q).map(action => '<label>' + action.label + ' %<input type="number" min="0" max="100" step="0.1" data-practice-draft data-practice-frequency="' + action.key + '" value="' + esc(response.frequencies?.[action.key] ?? '') + '"></label>').join('') + '</div>' : '<fieldset class="practice-choices"><legend>我的回答</legend>' + (q.type === 'range' ? rangeActions(q).map(action => ({ value: action.key, label: action.label })) : q.choices.map(choice => ({ value: choice, label: q.type === 'solution' ? solutionActionLabel(choice) : choice }))).map(choice => '<label><input type="radio" name="practiceChoice" data-practice-draft value="' + esc(choice.value) + '"' + (response.choice === choice.value ? ' checked' : '') + '><span>' + esc(choice.label) + '</span></label>').join('') + '</fieldset>') +
        '<label class="practice-field">我的理由' + (q.type === 'personal' ? '（必填）' : '（选填）') + '<textarea data-practice-draft data-practice-reason maxlength="2000">' + esc(response.reason || '') + '</textarea></label><label class="practice-field">对手范围假设（选填）<textarea data-practice-draft data-practice-hypothesis maxlength="2000">' + esc(response.rangeHypothesis || '') + '</textarea></label>' +
        (q.type === 'personal' ? '<label class="practice-field">' + (q.context.street === 'river' ? '面对后续回应的计划' : '下一街计划') + '（选填）<textarea data-practice-draft data-practice-next-plan maxlength="2000" placeholder="先写计划，再揭示实际后续">' + esc(response.nextStreetPlan || '') + '</textarea></label>' : '') + button('submit', '提交，再看对比', true)) + '</section></div>';
  },
  feedback(q, response, session) {
    let content = '<h4>我的回答与对比</h4><p>' + esc(response.choice ? (q.type === 'range' ? rangeActions(q).find(action => action.key === response.choice)?.label : q.type === 'solution' ? solutionActionLabel(response.choice) : response.choice) : '频率估计') + '</p>';
    if (q.type === 'concept') content += '<p class="practice-result">' + (response.evaluation.correct ? '概念题回答正确' : '这道概念题需要再看') + '</p><p>题库答案：' + esc(q.expected) + '</p><p>' + esc(q.explanation || '') + '</p><p class="ws-source">' + esc(q.source?.lesson || '') + ' · ' + esc(q.source?.readerPages || '') + '</p>';
    if (q.type === 'range') {
      const refs = referenceValues(q);
      content += '<p class="ws-muted">范围聚合参考</p><div class="practice-reference">' + rangeActions(q).map(action => '<div><strong>' + action.label + '</strong><span>参考 ' + Utils.safeFixed(refs[action.key], 2) + '%</span>' + (q.input === 'frequency' ? '<span>我的估计 ' + Utils.safeFixed(response.frequencies[action.key], 1) + '% · 差 ' + Utils.safeFixed(response.evaluation.differences[action.key], 1) + ' 个百分点</span>' : '') + '</div>').join('') + '</div>';
    }
    if (q.type === 'personal') content += '<p>当时实际行动：' + esc(q.reveal.playedAction) + '</p><div class="practice-continuation"><h4>后续真实行动</h4>' + (q.reveal.continuation || [{ street: streetName(q.context.street), actions: q.reveal.laterActions || [] }]).map(item => '<p><strong>' + esc(item.street) + '</strong> ' + esc(item.actions.join(' → ') || '未记录') + '</p>').join('') + '</div><p>最终公共牌：' + cards(q.reveal.board) + '</p><p>原复盘：' + esc(q.reveal.reflection || '未记录') + '</p><p>原错误标签：' + esc(q.reveal.mistake || '未填写') + '</p><p>实际盈亏：' + (typeof q.reveal.profit === 'number' ? Utils.safeFixed(q.reveal.profit, 1) + ' BB' : '未知') + '</p>';
    if (q.type === 'solution') {
      const { node, combo } = resolveSolutionQuestion(session.solutionSnapshot,q);
      const e = response.evaluation;
      content += '<p class="practice-result" data-solution-loss>与最高期望值相差 ' + Utils.safeFixed(e.lossBb,4) + 'bb</p><p>' + (e.approximateEquivalent ? '本样例中，各动作差异小于核验精度，近似等价。' : '本样例中，所选动作的期望值较低。') + '</p>' + solutionValuesTable(node,combo) + '<p>' + SOLUTION_EV_EXPLANATION + '</p>';
    }
    if (q.type === 'personal') {
      content += '<p>这次的后续计划：' + esc(response.nextStreetPlan || '未填写') + '</p>';
      if (q.reveal.review) content += '<div class="postflop-prior-plan"><h4>开始本轮时的决策卡</h4><p class="ws-muted">比较两次范围假设、行动目的与后续计划。</p>' +
        Object.entries({ conditionNote: '条件来源与不确定项', reason: '此前判断', ...POSTFLOP_PLAN_LABELS, insight: '此前学习短记' }).map(([key,label]) => '<p><strong>' + label + '：</strong>' + esc(q.reveal.review[key] || '未填写') + '</p>').join('') + '</div>';
    }
    content += '<p>我的理由：' + esc(response.reason || '未填写') + '</p><p>我的范围假设：' + esc(response.rangeHypothesis || '未填写') + '</p>';
    return '<div class="practice-feedback">' + content + (q.type === 'solution' ? '<button class="ws-button" data-practice-solution-question="' + esc(q.id) + '">回到本题研究节点</button>' : button('study', '回看相关概念')) + '</div>';
  },
  renderHistory(session) {
    this.config = { ...defaults(), ...session.config };
    const submitted = session.questions.filter(q => session.responses[q.id]?.submitted);
    const correct = submitted.filter(q => session.responses[q.id].evaluation?.correct === true).length;
    const review = submitted.filter(q => session.responses[q.id].review).length;
    const lineNote=session.line?'<p class="ws-boundary">'+esc(session.line.message||'已保留当前行动线，可继续或回看。')+'</p>':'';
    this.root.querySelector('#practiceContent').innerHTML = '<article class="practice-round"><p class="ws-eyebrow">本轮回顾 / ' + esc(typeName(session.config.type)) + '</p><h3>' + ({ active: '本轮仍可继续', completed: '本轮已完成', stopped: '本轮中途结束' })[session.status] + '</h3><p class="ws-lead">' + esc(session.config.type === 'solution' ? sessionTitle(session) : session.config.learningQuestion || typeName(session.config.type)) + '</p>'+lineNote+'<div class="ws-summary"><span>已提交 ' + submitted.length + ' / ' + session.questions.length + ' 题</span><span>待复习 ' + review + ' 题</span>' + (session.config.type === 'concept' ? '<span>概念题答对 ' + correct + ' / ' + submitted.length + '</span>' : '') + '</div><div class="practice-start">' + (session.status === 'active' ? button('continue', '继续本轮', true) : button('redo', '复习标记题', true) + button('repeat', session.line?'逐题重练本线原题':'再练本轮原题')) + button('return', '回到学习来源') + '</div><label class="practice-field">带走一条规律、适用条件或待核查点（选填）<textarea data-practice-note maxlength="2000">' + esc(session.note || '') + '</textarea></label>' + session.questions.map((q, index) => '<details class="ws-concept"><summary>第 ' + (index + 1) + ' 题 · ' + (session.responses[q.id]?.submitted ? session.responses[q.id].review ? '待复习' : '已回答' : '未回答，不计错') + '</summary>' + this.questionContext(q) + '<p>' + esc(q.prompt) + '</p>' + (session.responses[q.id]?.submitted ? this.feedback(q, session.responses[q.id], session) : '<p>没有提交回答。</p>') + '<p class="ws-source">评价版本：' + esc(q.scoringVersion) + '</p></details>').join('') + '</article>';
  },
  // [V7.16.0 修改] Learning records use the complete backup and restore flow.
  exportFile() { DataSync.download(); },
  async importFile(file) { await DataSync.importFile(file); },
};
