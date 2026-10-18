// [V7.13.0 新增] Scenario → board → reference → concept practice, entirely from local data.
import { Utils } from '../utils.js';
import { Navigation } from './navigation.js';
import { safeSourceUrl } from './strategyLibrary.js';
import { PracticeWorkspace } from './practiceWorkspace.js'; // [V7.14.0 新增]
import { STRATEGY_TOPICS, resolveTopic } from '../data/strategyFramework.js';
import { GTO_LEGACY_SCOPE } from '../data/strategy/gtoBaseline.js';
import { HandRepo } from '../store/store.js';
import { getTopicHandReferences } from './strategyStudy.js';
import { BOARD_LABELS, STUDY_ACTIONS, STUDY_SCENARIOS, studyBoards, referenceAverage } from './studyAnalyzeModel.js';
import { STREET_NAMES } from './decisionContext.js';
import { DecisionWorkspaceStore } from '../store/decisionWorkspaceStore.js';
import { PreflopRangeWorkspace } from './preflopRangeWorkspace.js'; // [V7.17.0 新增]
import { SolutionWorkspace } from './solutionWorkspace.js'; // [V7.18.0 新增]
import { PostflopCourseWorkspace } from './postflopCourseWorkspace.js';

export const workspaceEscape = (value) => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const esc = workspaceEscape;
const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
const cards = (value) => Utils.renderCardBadges(value || '', {});
function actions(board, grouped) {
  const list = grouped ? [{ key: 'bet', label: '下注', className: 'small' }, STUDY_ACTIONS[3]] : STUDY_ACTIONS;
  const data = { ...board, bet: board.bet75 + board.bet50 + board.bet33 };
  return '<div class="ws-frequency" aria-label="参考动作分布">' + list.map((action) => '<span class="ws-frequency__' + action.className + '" style="flex-grow:' + Math.max(0, Number(data[action.key]) || 0) + '" title="' + action.label + ' ' + Utils.safeFixed(data[action.key], 1) + '%"></span>').join('') + '</div><dl class="ws-actions">' + list.map((action) => '<div><dt><i class="ws-dot ws-frequency__' + action.className + '"></i>' + action.label + '</dt><dd>' + Utils.safeFixed(data[action.key], 1) + '<small>%</small></dd></div>').join('') + '</dl>';
}

export const StudyWorkspace = {
  view: 'concepts', topicId: 'flop', scenario: 'BTNvsBB', category: '', query: '', sort: 'code',
  boardCode: '', compareCode: '', grouped: false, handId: '', onReturn: null, sourceDecision: null,
  init() {
    this.root = document.getElementById('studyWorkspace');
    if (!this.root || this.root.dataset.bound) return;
    this.root.dataset.bound = 'true';
    PostflopCourseWorkspace.init(this.root);
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.studyView) {
        if (this.view === 'course' && PostflopCourseWorkspace.flushDraft() === false) return;
        this.view = button.dataset.studyView; this.render();
      }
      if (button.dataset.studyTopic) { this.topicId = button.dataset.studyTopic; this.rememberSources(); this.render(); }
      if (button.dataset.studyBoard) {
        this.boardCode = button.dataset.studyBoard; this.renderReport();
        this.root.querySelector('#studyBoardTitle')?.focus({ preventScroll: true });
      }
      if (button.dataset.studyHand) Navigation.goToHand(button.dataset.studyHand);
      if (button.hasAttribute('data-study-practice')) {
        if (this.view === 'course') PostflopCourseWorkspace.primary(); else this.openPractice();
      }
      if (button.hasAttribute('data-study-range-practice')) {
        const board = studyBoards(this.scenario).find(item => item.code === this.boardCode);
        PracticeWorkspace.open({ type: 'range', scenario: this.scenario, category: board?.category || this.category,
          sourceDecision: this.sourceDecision, learningQuestion: this.sourceDecision?.question || (BOARD_LABELS[board?.category || this.category] || '这些牌面') + '上，整体范围如何分配下注与过牌？', returnTab: 'study' });
      }
      if (button.hasAttribute('data-study-return')) { if (this.onReturn) this.onReturn(this.handId); else if (this.handId) Navigation.goToHand(this.handId, this.sourceDecision); }
      if (button.hasAttribute('data-study-clear-context')) this.freeStudy();
      if (button.hasAttribute('data-study-reset')) { this.category = ''; this.query = ''; this.sort = 'code'; this.render(); }
      if (button.hasAttribute('data-study-pin')) { this.compareCode = this.boardCode; this.renderReport(); }
      if (button.hasAttribute('data-study-unpin')) { this.compareCode = ''; this.renderReport(); }
    });
    this.root.addEventListener('input', (event) => {
      if (event.target.dataset.studyField === 'query') { this.query = event.target.value; this.renderReport(); }
    });
    this.root.addEventListener('change', (event) => {
      const field = event.target.dataset.studyField;
      if (!field || field === 'query') return;
      this[field] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      if (field === 'scenario') { this.boardCode = ''; this.compareCode = ''; }
      this.renderReport();
      if (field === 'grouped') this.root.querySelector('[data-study-field="grouped"]')?.focus({ preventScroll: true });
    });
  },
  rememberSources() {
    if (!this.sourceDecision?.key || !this.handId) return;
    const topic = resolveTopic(this.topicId);
    const id = this.handId + ':' + this.sourceDecision.key;
    const stored = HandRepo.getById(this.handId)?.decisionReviews?.[this.sourceDecision.key];
    DecisionWorkspaceStore.change(state => {
      const draft = state.drafts[id] || { ...stored, question: this.sourceDecision.question || '' };
      const references = [...(draft.references || []).filter(item => item.topicId !== topic.id), { topicId: topic.id, title: topic.title,
        sources: topic.sources.map(source => ({ title: source.title, url: source.url, conditions: source.conditions, boundary: source.boundary })) }];
      return { ...state, drafts: { ...state.drafts, [id]: { ...draft, references, editedAt: new Date().toISOString() } } };
    });
  },
  openPractice() {
    if (this.view === 'course') return Navigation.goToTab('practice');
    if (this.view === 'solutions') return SolutionWorkspace.openPractice();
    // [V7.17.0 修改] Range editing links to preflop concepts, never grades a personal chart.
    PracticeWorkspace.open({ type: 'concept', topicId: this.view === 'ranges' ? 'preflop' : this.topicId, sourceDecision: this.sourceDecision,
      learningQuestion: this.sourceDecision?.question || '', returnTab: 'study' });
  },
  freeStudy() {
    this.handId = ''; this.onReturn = null; this.sourceDecision = null;
    DecisionWorkspaceStore.change(state => ({ ...state, attached: false }));
    this.rememberSources();
    Navigation.goToTab('study');
  },
  open(context = {}, onReturn = null) {
    if (resolveTopic(context.topicId)) this.topicId = context.topicId;
    this.handId = context.handId || ''; this.onReturn = onReturn; this.sourceDecision = context.handId ? context : null;
    if (context.handId) {
      this.scenario = context.scenario || ''; this.boardCode = context.boardCode || '';
      this.category = ''; this.query = ''; this.compareCode = ''; this.view = 'concepts';
    }
    this.rememberSources();
    Navigation.goToTab('study');
  },
  openSolution(pack, nodePath, combo, context = null) {
    SolutionWorkspace.open(pack,nodePath,combo);
    this.handId = context?.handId || ''; this.sourceDecision = context; this.onReturn = null;
    this.view = 'solutions'; Navigation.goToTab('study');
  },
  render() {
    if (!this.root) return;
    const source = HandRepo.getById(this.handId);
    this.root.innerHTML = '<header class="ws-header"><div><p class="ws-eyebrow">学习</p><h2>从问题开始学习</h2></div><button class="ws-button ws-button--primary" data-study-practice>' + (this.view === 'solutions' ? '练习当前节点' : this.view === 'ranges' ? '翻前概念自测' : '练习本主题') + '</button></header>' +
      (source ? '<div class="ws-study-context-actions"><button class="ws-button" data-study-return>回到原决策</button><button class="ws-button" data-study-clear-context>自由学习</button></div>' : '') +
      '<div class="ws-tabs" aria-label="学习视图"><button data-study-view="course" aria-pressed="' + (this.view === 'course') + '">转牌—河牌专项</button><button data-study-view="concepts" aria-pressed="' + (this.view === 'concepts') + '">主题学习</button><button data-study-view="reports" aria-pressed="' + (this.view === 'reports') + '">牌面参考</button><button data-study-view="ranges" aria-pressed="' + (this.view === 'ranges') + '">翻前范围</button><button data-study-view="solutions" aria-pressed="' + (this.view === 'solutions') + '">求解研究</button></div><div id="studyContent"></div>';
    if (this.view === 'course') PostflopCourseWorkspace.render(this.root.querySelector('#studyContent'));
    else if (this.view === 'solutions') SolutionWorkspace.render(this.root.querySelector('#studyContent'), this.sourceDecision);
    else if (this.view === 'ranges') PreflopRangeWorkspace.render(this.root.querySelector('#studyContent'));
    else if (this.view === 'reports') this.renderReport(); else this.renderConcepts();
  },
  renderConcepts() {
    const topic = resolveTopic(this.topicId);
    const related = getTopicHandReferences(this.topicId, HandRepo.getAll()).slice(0, 6);
    this.root.querySelector('#studyContent').innerHTML = '<div class="ws-study-layout"><nav class="ws-topic-nav" aria-label="学习主题">' + STRATEGY_TOPICS.map((item) => '<button data-study-topic="' + item.id + '" aria-pressed="' + (item.id === this.topicId) + '">' + esc(item.title) + '</button>').join('') + '</nav><article class="ws-reading"><p class="ws-eyebrow">学习问题</p><h3 id="studyTopicTitle">' + esc(topic.title) + '</h3><p class="ws-lead">' + esc(topic.summary) + '</p><p class="ws-boundary">' + esc(topic.boundary) + '</p><h4>理解关键概念</h4>' + topic.concepts.map((concept, index) => '<details class="ws-concept"' + (index === 0 ? ' open' : '') + '><summary>' + esc(concept.title) + '</summary><p>' + esc(concept.mechanism) + '</p><p class="ws-muted">适用条件：' + esc(concept.applicability) + '</p>' + (concept.readingNote ? '<p class="ws-muted">' + esc(concept.readingNote) + '</p>' : '') + '<p class="ws-source">' + esc(concept.sourceRef?.lesson || '') + ' · 阅读器页 ' + esc(concept.sourceRef?.readerPages || '') + '</p></details>').join('') + '<div class="ws-reading-next"><div><h4>试着作答</h4></div><button class="ws-button ws-button--primary" data-study-practice>开始概念自测</button></div><details class="ws-concept"><summary>来源与延伸阅读 · ' + topic.sources.length + '</summary>' + topic.sources.map((source) => {
      const url = safeSourceUrl(source.url);
      return '<p>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + '</a>' : esc(source.title)) + '</p><p class="ws-muted">' + esc(source.conditions) + ' · ' + esc(source.boundary) + '</p>';
    }).join('') + '</details></article><aside class="ws-related"><h3>我的相关手牌</h3><p class="ws-muted">打开候选手牌，查看原局面与条件。</p>' + (related.length ? related.map((hand) => '<button class="ws-hand-link" data-study-hand="' + esc(hand.id) + '"><strong>' + esc(hand.reference) + '</strong><span>' + esc(hand.profileLabel) + ' · ' + esc(hand.scenario) + '</span>' + cards(hand.cards + ' ' + hand.boardCode) + '</button>').join('') : '<div class="ws-empty">暂无可关联手牌。可以先学概念，或从分析页导入牌谱。</div>') + '</aside></div>';
  },
  renderReport() {
    let content = this.root.querySelector('#studyReport');
    if (!content) {
      this.root.querySelector('#studyContent').innerHTML = '<div class="ws-report-intro"><h3>比较牌面上的整体倾向</h3><p>按整组范围显示行动频率。</p><p class="ws-boundary">' + esc(GTO_LEGACY_SCOPE.note) + '</p></div><div class="ws-filters"><label>场景<select data-study-field="scenario">' + (!STUDY_SCENARIOS[this.scenario] ? option(this.scenario, '当前场景未收录', this.scenario) : '') + Object.keys(STUDY_SCENARIOS).map((key) => option(key, key === 'BTNvsBB' ? 'BTN 对 BB · SRP · 翻牌' : 'SB 对 BB · SRP · 翻牌', this.scenario)).join('') + '</select></label><label>牌面类别<select data-study-field="category">' + option('', '全部类别', this.category) + Object.entries(BOARD_LABELS).map(([key, label]) => option(key, label, this.category)).join('') + '</select></label><label>牌面代码<input data-study-field="query" value="' + esc(this.query) + '" placeholder="例如 As，忽略空格" /></label><label>排序<select data-study-field="sort">' + option('code', '牌面顺序', this.sort) + option('bet', '下注频率从高到低', this.sort) + option('check', '过牌频率从高到低', this.sort) + '</select></label><button class="ws-button" data-study-reset>清除筛选</button></div><div id="studyReport"></div>';
      content = this.root.querySelector('#studyReport');
    }
    const oldScroll = content.querySelector('.ws-board-scroll')?.scrollTop || 0;
    const boards = studyBoards(this.scenario, { category: this.category, query: this.query, sort: this.sort });
    if (!this.boardCode && boards.length) this.boardCode = boards.find((b) => b.category === 'dryAHigh')?.code || boards[0].code;
    const selected = boards.find((board) => board.code === this.boardCode);
    const compared = studyBoards(this.scenario).find((board) => board.code === this.compareCode);
    const average = referenceAverage(boards);
    content.innerHTML = '<div class="ws-report-grid"><section class="ws-board-browser"><div class="ws-section-heading"><h4>已收录牌面 <span>' + boards.length + '</span></h4><span>选择一行查看</span></div><div class="ws-board-scroll" role="group" aria-label="参考牌面列表">' + (boards.length ? boards.map((board) => '<button class="ws-board-row" data-study-board="' + board.code + '" aria-pressed="' + (board === selected) + '"><span class="ws-board-cards">' + cards(board.code) + '</span><span>' + esc(BOARD_LABELS[board.category]) + '</span><span class="ws-mini-bar"><i style="width:' + Math.max(0, Math.min(100, board.bet)) + '%"></i></span><span>' + Utils.safeFixed(board.bet, 1) + '% 下注</span></button>').join('') : '<p class="ws-empty">当前条件没有已收录参考。可以清除筛选或继续主题学习。</p>') + '</div></section><section class="ws-board-detail">' +
      (selected ? '<p class="ws-eyebrow">单牌面参考 / ' + esc(this.scenario) + '</p><h3 id="studyBoardTitle" tabindex="-1">' + cards(selected.code) + '</h3><p>' + esc(BOARD_LABELS[selected.category]) + ' · 未标注桌型与有效筹码</p><label class="ws-toggle"><input type="checkbox" data-study-field="grouped"' + (this.grouped ? ' checked' : '') + '>合并为下注 / 过牌</label>' + actions(selected, this.grouped) + '<button class="ws-button" data-study-pin>固定这张牌面作对照</button>' : '<div class="ws-empty"><h3>请选择一个有参考的牌面</h3><p>此牌面不在当前筛选结果中，请清除筛选或另选牌面。</p></div>') +
      (compared && compared.code !== selected?.code ? '<div class="ws-comparison"><div class="ws-section-heading"><h4>对照 ' + cards(compared.code) + '</h4><button class="ws-button" data-study-unpin>移除对照</button></div>' + actions(compared, this.grouped) + '</div>' : '') +
      (average ? '<details class="ws-concept"><summary>这 ' + average.count + ' 个已收录牌面的简单平均</summary>' + actions(average, this.grouped) + '</details>' : '') + '<button class="ws-button ws-button--primary" data-study-view="concepts">回到主题理解原因</button></section></div>';
    content.querySelector('.ws-board-scroll').scrollTop = oldScroll;
    // [V7.14.0 新增] State the actual reference actor; an inherited BB hand is not a defender solution.
    const detail = content.querySelector('.ws-board-detail');
    if (selected) {
      const note = document.createElement('p'); note.className = 'ws-boundary';
      note.textContent = (this.scenario === 'SBvsBB' ? 'SB' : 'BTN') + ' 进攻方翻牌参考。';
      detail.prepend(note);
      const start = document.createElement('button'); start.className = 'ws-button'; start.type = 'button';
      start.setAttribute('data-study-range-practice', ''); start.textContent = '练习这类牌面的范围倾向'; detail.append(start);
    }
  },
};
