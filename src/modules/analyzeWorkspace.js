// [V7.13.0 新增] A local review queue preserves selection while the user reads or studies.
import { Utils, PubSub } from '../utils.js';
import { HandRepo, SessionRepo, MarksRepo, ClosureRepo } from '../store/store.js';
import { renderSessionReview } from './sessionReviewView.js';
import { renderSessionHandBrowser } from './sessionHandBrowser.js';
import { Navigation } from './navigation.js';
import { HandReplay } from './handReplay.js';
import { openGGImportQuick, openGGImportForSession } from './ggImport.js';
import { StudyWorkspace, workspaceEscape as esc } from './studyWorkspace.js';
import { analysisQueue } from './studyAnalyzeModel.js';
import { getObservedProfile } from './analysisReadModel.js';
import { PracticeWorkspace } from './practiceWorkspace.js'; // [V7.14.0 新增]
import { decisionContext, updateDecisionReview, handRevision, STREET_NAMES } from './decisionContext.js';
import { DecisionWorkspaceStore } from '../store/decisionWorkspaceStore.js';
import { postflopReview, postflopFacts } from './postflopReviewModel.js'; // [V7.19.0 新增]

const option = (key, label, value) => '<option value="' + esc(key) + '"' + (key === value ? ' selected' : '') + '>' + esc(label) + '</option>';

export const AnalyzeWorkspace = {
  filters: { profile: '', scenario: '', sessionId: '', flag: '', query: '', sort: 'recent' },
  selectedId: '', limit: 40, memoryDrafts: {}, sessionScreen: 'auto', sessionQuery: '', sessionViews: new Map(),
  sessionBrowsers: new Map(), editorDisclosures: new Map(), editorScrolls: new Map(),
  init() {
    this.root = document.getElementById('analyzeWorkspace');
    if (!this.root || this.root.dataset.bound) return;
    this.root.dataset.bound = 'true';
    try { const saved = DecisionWorkspaceStore.read(); this.selectedId = saved.selectedId; this.filters = { ...this.filters, ...saved.filters }; } catch (error) { this.error = error.message; }
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-review-sessions')) { this.rememberSessionView(); this.sessionScreen = 'overview'; this.render(); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
      if (button.dataset.reviewSession) { this.openSession(button.dataset.reviewSession); return; }
      if (button.hasAttribute('data-review-session-overview')) { this.rememberSessionView(); this.sessionScreen = 'session'; this.render(); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
      if (button.hasAttribute('data-review-session-hands')) { this.showSessionHands(); return; }
      if (button.hasAttribute('data-review-all-hands')) { this.rememberSessionView(); this.filters = { profile: '', scenario: '', sessionId: '', flag: '', query: '', sort: 'recent' }; this.sessionScreen = 'hands'; this.limit = 40; this.render(); return; }
      if (button.dataset.reviewHand) { this.openHand(button.dataset.reviewHand); return; }
      if (button.dataset.sessionPickToggle) { this.toggleSessionPick(button.dataset.sessionPickToggle); return; }
      if (button.dataset.sessionPickPage) { this.browserState().page = Number(button.dataset.sessionPickPage); this.renderHandBrowser(); return; }
      if (button.hasAttribute('data-session-pick-reset')) { this.sessionBrowsers.delete(this.filters.sessionId); this.renderHandBrowser(true); return; }
      if (button.hasAttribute('data-review-closeout')) { this.onReturnSession?.(this.filters.sessionId); return; }
      if (button.dataset.postflopHand) {
        const hand = HandRepo.getById(button.dataset.postflopHand);
        if (!hand) return this.openHand(button.dataset.postflopHand);
        this.openHand(button.dataset.postflopHand, { ...decisionContext(hand,
          { street: button.dataset.postflopStreet, actionIndex: Number(button.dataset.postflopAction), decisionKind: button.dataset.postflopKind }) });
      }
      if (button.hasAttribute('data-analyze-return-session')) this.onReturnSession?.(HandRepo.getById(this.selectedId)?.sessionId); // [V7.16.0 新增]
      if (button.dataset.analyzeHand) this.select(button.dataset.analyzeHand);
      if (button.hasAttribute('data-analyze-import')) {
        if (this.sessionScreen !== 'overview' && SessionRepo.getById(this.filters.sessionId)) openGGImportForSession(this.filters.sessionId);
        else openGGImportQuick();
      }
      if (button.hasAttribute('data-analyze-edit')) { const field = this.root.querySelector('[data-decision-reflection]'); if (field) { field.closest('details').open = true; this.reflectionOpen = true; field.focus(); } }
      if (button.hasAttribute('data-analyze-practice')) this.openPractice();
      if (button.hasAttribute('data-analyze-study')) this.openStudy();
      if (button.hasAttribute('data-decision-save')) this.saveDecision();
      if (button.hasAttribute('data-decision-mark')) { const hand = HandRepo.getById(this.selectedId); if (hand) HandRepo.saveAll(HandRepo.getAll().map(item => item.id === hand.id ? { ...item, marked: !item.marked } : item)); }
      if (button.dataset.analyzeStep) {
        const hands = analysisQueue(HandRepo.getAll(), this.filters);
        const index = hands.findIndex((hand) => hand.id === this.selectedId);
        const next = hands[index + Number(button.dataset.analyzeStep)];
        if (next) this.select(next.id);
      }
      if (button.hasAttribute('data-analyze-more')) { this.limit += 40; this.renderQueue(); }
      if (button.hasAttribute('data-analyze-reset')) {
        this.filters = { profile: '', scenario: '', sessionId: this.filters.sessionId, flag: '', query: '', sort: 'recent' };
        this.limit = 40; this.render();
      }
    });
    this.root.addEventListener('input', (event) => {
      if (event.target.dataset.sessionPickFilter === 'query') { this.browserState().query = event.target.value; this.browserState().page = 1; this.renderHandBrowser(); }
      if (event.target.hasAttribute('data-review-session-search')) { this.sessionQuery = event.target.value; this.renderSessionList(); }
      if (event.target.dataset.analyzeField === 'query') { this.filters.query = event.target.value; this.limit = 40; this.root.querySelector('.analysis-queue')?.setAttribute('open', ''); this.renderQueue(); }
      if (event.target.dataset.decisionDraft) this.saveDraft(event.target.dataset.decisionDraft, event.target.value);
    });
    this.root.addEventListener('change', (event) => {
      if (event.target.dataset.sessionPickFilter && event.target.dataset.sessionPickFilter !== 'query') { this.browserState()[event.target.dataset.sessionPickFilter] = event.target.value; this.browserState().page = 1; this.renderHandBrowser(); }
      const field = event.target.dataset.analyzeField;
      if (field && field !== 'query') { this.filters[field] = event.target.value; this.limit = 40; if (field === 'sessionId') this.render(); else this.renderQueue(); }
      if (event.target.matches('[data-decision-kind]')) this.setPosition({ ...this.bundle()?.position, decisionKind: event.target.value });
    });
    this.root.addEventListener('toggle', event => {
      if (event.target.dataset.decisionSection) this.editorDisclosures.set(this.root.querySelector('#decisionEditor')?.dataset.decisionKey + ':' + event.target.dataset.decisionSection, event.target.open);
    }, true);
    this.root.addEventListener('scroll', event => {
      if (event.target.id === 'decisionEditor') this.editorScrolls.set(event.target.dataset.decisionKey, event.target.scrollTop);
      if (event.target.matches('[data-session-pick-results]')) this.browserState().scrollTop = event.target.scrollTop;
    }, true);
    PubSub.on('handDataChanged', () => {
      if (document.getElementById('analyzePanel')?.classList.contains('is-visible')) this.render();
    });
  },
  browserState() {
    const id = this.filters.sessionId;
    if (!this.sessionBrowsers.has(id)) this.sessionBrowsers.set(id, { query: '', scope: 'all', sort: 'time', page: 1, scrollTop: 0 });
    return this.sessionBrowsers.get(id);
  },
  renderHandBrowser(replace = false) {
    const host = this.root.querySelector('[data-session-hand-browser]'); if (!host) return;
    const state = this.browserState();
    const html = renderSessionHandBrowser({ hands: HandRepo.getAll().filter(hand => hand.sessionId === this.filters.sessionId), marks: MarksRepo.getAll(), filter: state, page: state.page });
    const current = host.querySelector('[data-session-pick-results]');
    if (current && !replace) {
      const template = document.createElement('template'); template.innerHTML = html;
      const next = template.content.querySelector('[data-session-pick-results]'); current.replaceChildren(...next.childNodes);
    } else host.innerHTML = html;
    host.querySelector('[data-session-pick-results]').scrollTop = state.scrollTop;
  },
  async toggleSessionPick(id) {
    const hand = HandRepo.getById(id);
    if (!hand || hand.sessionId !== this.filters.sessionId) return;
    try {
      HandRepo.saveAll(HandRepo.getAll().map(item => item.id === id ? { ...item, marked: !item.marked } : item));
      const result = await HandRepo.persistNow();
      if (!result.ok) throw new Error('重点标记尚未完整保存，请保留页面并重试。');
      Utils.showToast(hand.marked ? '已取消重点标记。' : '已标记，稍后可从本场重点中找回。');
      const button = [...this.root.querySelectorAll('[data-session-pick-toggle]')].find(item => item.dataset.sessionPickToggle === id);
      (button || this.root.querySelector('[data-session-pick-filter=scope]'))?.focus({ preventScroll: true });
    } catch (error) { this.notice(error); }
  },
  rememberSessionView() {
    if (!this.root.querySelector('#analyzeQueue')) return;
    this.sessionViews.set(this.filters.sessionId, { filters: { ...this.filters }, selectedId: this.selectedId, limit: this.limit,
      queueScroll: this.root.querySelector('#analyzeQueue').scrollTop, scrollY: window.scrollY });
  },
  openSession(id) {
    if (!SessionRepo.getById(id)) return;
    this.rememberSessionView();
    this.filters = { profile: '', scenario: '', sessionId: id, flag: '', query: '', sort: 'recent' };
    this.sessionScreen = 'session'; this.render();
    window.scrollTo({ top: 0, behavior: 'instant' }); this.root.querySelector('h2')?.focus({ preventScroll: true });
  },
  browseSessions() {
    this.rememberSessionView(); this.sessionScreen = 'overview';
    Navigation.goToTab('analyze');
    window.scrollTo({ top: 0, behavior: 'instant' }); this.root.querySelector('h2')?.focus({ preventScroll: true });
  },
  showSessionHands() {
    const previous = this.sessionViews.get(this.filters.sessionId);
    if (previous) { this.filters = { ...previous.filters }; this.selectedId = previous.selectedId; this.limit = previous.limit; }
    this.sessionScreen = 'hands'; this.render();
    if (previous) { this.root.querySelector('#analyzeQueue').scrollTop = previous.queueScroll; window.scrollTo({ top: previous.scrollY, behavior: 'instant' }); }
    else this.root.querySelector('#analyzeHandTitle')?.focus({ preventScroll: true });
  },
  renderSessionList() {
    const html = renderSessionReview({ sessions: SessionRepo.getAll(), hands: HandRepo.getAll(), marks: MarksRepo.getAll(), closures: ClosureRepo.getAll(),
      sessionId: this.sessionScreen === 'session' ? this.filters.sessionId : '', query: this.sessionQuery });
    // Keep the search input mounted so typing does not lose focus or its caret.
    const current = this.root.querySelector('[data-review-session-list]');
    if (current) {
      const template = document.createElement('template'); template.innerHTML = html;
      const next = template.content.querySelector('[data-review-session-list]');
      if (next) { current.replaceChildren(...next.childNodes); return; }
    }
    this.root.innerHTML = html;
    if (this.sessionScreen === 'session') {
      this.root.querySelector('.session-review__header').append(this.root.querySelector('.session-review__actions'));
      this.renderHandBrowser();
    }
  },
  bundle() {
    const hand = HandRepo.getById(this.selectedId); if (!hand) return null;
    const saved = DecisionWorkspaceStore.read();
    let position = saved.positions[hand.id] || { street: 'preflop', actionIndex: null };
    if (position.revision && position.revision !== handRevision(hand)) position = { street: position.street, actionIndex: null, decisionKind: '' };
    const context = decisionContext(hand, position);
    const draftId = hand.id + ':' + context.key;
    const note = hand.decisionReviews?.[context.key];
    const localDraft = saved.drafts[draftId];
    let storedDraft = this.memoryDrafts[draftId] || (note && localDraft?.editedAt && note.updatedAt >= localDraft.editedAt ? { ...note, saved: true } : localDraft)
      || { ...note, question: note?.question || '' };
    if (this.memoryDrafts[draftId] && localDraft?.references) storedDraft = { ...storedDraft, references: localDraft.references };
    const draft = { ...storedDraft, reflection: storedDraft.reflectionDirty ? storedDraft.reflection : hand.reflection || '' };
    context.question = draft.question || '';
    context.initialReason = draft.reason || '';
    if (['flop', 'turn', 'river'].includes(context.street)) {
      Object.assign(context, postflopFacts(draft)); context.reviewPlan = postflopReview(draft);
    }
    return { hand, position, context, draft, draftId };
  },
  setPosition(position) {
    try {
      const previous = DecisionWorkspaceStore.read().positions[this.selectedId];
      const same = previous?.street === position.street && previous?.actionIndex === position.actionIndex;
      const next = { street: position.street, actionIndex: position.actionIndex ?? null, decisionKind: position.decisionKind ?? (same ? previous?.decisionKind || '' : ''), revision: handRevision(HandRepo.getById(this.selectedId)) };
      DecisionWorkspaceStore.change(state => ({ ...state, selectedId: this.selectedId, attached: true, positions: { ...state.positions, [this.selectedId]: next } }));
      this.renderEditor(); PubSub.emit('decisionContextChanged');
    } catch (error) { this.notice(error); }
  },
  saveDraft(field, value) {
    try {
      const bundle = this.bundle(); if (!bundle) return;
      const editorId = this.root.querySelector('#decisionEditor')?.dataset.decisionKey;
      if (editorId !== bundle.draftId) {
        const previous = this.memoryDrafts[editorId] || this.visibleDraft || {};
        this.memoryDrafts[editorId] = { ...previous, [field]: value, reflectionDirty: field === 'reflection' || Boolean(previous.reflectionDirty), editedAt: new Date().toISOString(), saved: false };
        throw new Error('其他页面已切换决策，请重新选择原节点；当前输入仍保留，没有写入其他决策。');
      }
      const draft = { ...bundle.draft, [field]: value, decisionKind: bundle.position.decisionKind || '', reflectionDirty: field === 'reflection' || Boolean(bundle.draft.reflectionDirty), editedAt: new Date().toISOString(), saved: false };
      this.memoryDrafts[bundle.draftId] = draft;
      DecisionWorkspaceStore.change(state => ({ ...state, drafts: { ...state.drafts, [bundle.draftId]: draft } }));
      const status = this.root.querySelector('[data-decision-status]'); if (status) status.textContent = '草稿已保存在本机，尚未写入复盘。';
      PubSub.emit('decisionContextChanged');
    } catch (error) { this.notice(error); }
  },
  notice(error) { const notice = this.root.querySelector('[data-decision-status]'); if (notice) { notice.textContent = error.message || String(error); notice.setAttribute('role', 'alert'); } else Utils.showToast(error.message || String(error)); },
  async saveDecision() {
    if (this.savingDecision) { Utils.showToast('复盘正在保存，请稍候。'); return; }
    this.savingDecision = true;
    try {
      const bundle = this.bundle(); if (!bundle) return;
      // [V7.15.0 修改] The visible editor is authoritative even when its last cache write failed.
      const editor = this.root.querySelector('#decisionEditor');
      if (editor?.dataset.decisionKey !== bundle.draftId) throw new Error('当前决策已变化，请重新载入后保存；草稿仍保留。');
      const draft = { ...bundle.draft };
      editor.querySelectorAll('[data-decision-draft]').forEach(field => { if (field.dataset.decisionDraft === 'reflection' && field.value !== draft.reflection) draft.reflectionDirty = true; draft[field.dataset.decisionDraft] = field.value; });
      bundle.draft = draft; this.memoryDrafts[bundle.draftId] = draft;
      const updated = updateDecisionReview(bundle.hand, bundle.context, bundle.draft);
      HandRepo.saveAll(HandRepo.getAll().map(hand => hand.id === updated.id ? updated : hand));
      // saveAll broadcasts synchronously and replaces the editor before persistence completes.
      const savingEditor = this.root.querySelector('#decisionEditor');
      const result = await Utils.withBusy(savingEditor?.querySelector('[data-decision-save]'), '保存中…', () => HandRepo.persistNow(), savingEditor);
      if (!result.ok) throw new Error('复盘尚未完整保存，请保留草稿并重试。');
      const savedDraft = { ...bundle.draft, reflectionDirty: false, saved: true };
      this.memoryDrafts[bundle.draftId] = savedDraft;
      let cacheWarning = false;
      try { DecisionWorkspaceStore.change(state => ({ ...state, drafts: { ...state.drafts, [bundle.draftId]: savedDraft } })); } catch { cacheWarning = true; }
      if (this.bundle()?.draftId === bundle.draftId) this.renderEditor();
      if (cacheWarning) this.notice(new Error('复盘已保存；草稿缓存未能更新，请下载备份并释放空间。'));
      else Utils.showToast('决策复盘已保存。', { tone: 'success' });
    } catch (error) { this.notice(error); }
    finally { this.savingDecision = false; }
  },
  openStudy() {
    try { const bundle = this.sessionScreen === 'hands' ? this.bundle() : null; if (bundle) StudyWorkspace.open(bundle.context, () => Navigation.goToHand(bundle.hand.id, bundle.context)); else StudyWorkspace.open(); } catch (error) { this.notice(error); }
  },
  openPractice() {
    try {
      const bundle = this.sessionScreen === 'hands' ? this.bundle() : null;
      if (!bundle) return PracticeWorkspace.open();
      PracticeWorkspace.open({ type: bundle.context.eligible ? 'personal' : 'concept', handId: bundle.hand.id,
        street: bundle.context.street, decisionIndex: bundle.context.actionIndex ?? 0, decisionKind: bundle.position.decisionKind || '',
        topicId: bundle.context.topicId, sourceDecision: bundle.context, returnTab: 'analyze', learningQuestion: bundle.context.question || '这次决策的依据是什么？' });
    } catch (error) { this.notice(error); }
  },
  openHand(id, context = null) {
    const target = HandRepo.getById(id);
    if (!target) { Utils.showToast('找不到目标手牌，可能已被删除。'); return false; }
    if (!analysisQueue(HandRepo.getAll(), this.filters).some(hand => hand.id === id)) this.filters = { profile: '', scenario: '', sessionId: SessionRepo.getById(target.sessionId) ? target.sessionId : '', flag: '', query: '', sort: 'recent' };
    else if (this.sessionScreen !== 'hands' && SessionRepo.getById(target.sessionId)) this.filters.sessionId = target.sessionId;
    this.sessionScreen = 'hands';
    this.selectedId = id;
    if (context?.handId === id) {
      const hand = HandRepo.getById(id);
      if (context.revision === decisionContext(hand, context).revision) this.setPosition(context);
      else Utils.showToast('原牌谱已变更，请重新核对当前决策；旧练习快照仍保留。');
    }
    this.render(); this.root.querySelector('#analyzeHandTitle')?.focus({ preventScroll: true }); return true;
  },
  render() {
    if (!this.root) return;
    if (this.sessionScreen === 'auto') this.sessionScreen = SessionRepo.getAll().length ? 'overview' : 'hands';
    if (this.sessionScreen === 'session' && !SessionRepo.getById(this.filters.sessionId)) this.sessionScreen = 'overview';
    this.root.dataset.sessionScreen = this.sessionScreen;
    this.root.classList.toggle('session-analysis', this.sessionScreen === 'hands');
    if (this.sessionScreen !== 'hands') { this.renderSessionList(); PubSub.emit('decisionContextChanged'); return; }
    const queueScroll = this.root.querySelector('#analyzeQueue')?.scrollTop || 0;
    const scenarios = [...new Set(HandRepo.getAll().map((hand) => hand.preflopScenario).filter(Boolean))].sort();
    const sessions = SessionRepo.getAll().slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const f = this.filters;
    this.root.innerHTML = '<header class="ws-header"><div><p class="ws-eyebrow">ANALYZE / 分析</p><h2>从一手牌，找到一个问题</h2><p>筛选自己的记录，逐街回看，再去学习对应的判断。</p></div><button class="ws-button ws-button--primary" data-analyze-import>导入手牌</button></header><div class="ws-filters"><label>观察桌型<select data-analyze-field="profile">' + option('', '全部桌型', f.profile) + ['9max', '6max', '2max', 'unknown-table'].map((key) => option(key, key === 'unknown-table' ? '桌型未知' : key, f.profile)).join('') + '</select></label><label>场次<select data-analyze-field="sessionId">' + option('', '全部场次', f.sessionId) + sessions.map((session) => option(session.id, [session.date, session.level].filter(Boolean).join(' · ') || session.id, f.sessionId)).join('') + '</select></label><label>翻前场景<select data-analyze-field="scenario">' + option('', '全部场景', f.scenario) + scenarios.map((key) => option(key, key, f.scenario)).join('') + '</select></label><label>关注范围<select data-analyze-field="flag">' + option('', '全部手牌', f.flag) + option('marked', '我已标记的', f.flag) + option('mistake', '我已填写错误标签的', f.flag) + '</select></label><label class="ws-search">搜索<input data-analyze-field="query" value="' + esc(f.query) + '" placeholder="手牌号、底牌或复盘备注" /></label><label>排序<select data-analyze-field="sort">' + option('recent', '最近优先', f.sort) + option('loss', '个人亏损从多到少', f.sort) + option('swing', '个人盈亏幅度', f.sort) + '</select></label><button class="ws-button" data-analyze-reset>清除筛选</button></div><div id="analyzeSummary" class="ws-summary" role="status"></div><div class="ws-analyze-grid"><section class="ws-queue" aria-label="手牌队列"><div id="analyzeQueue"></div></section><section id="analyzeDetail" class="ws-analysis-detail" aria-label="所选手牌"></section></div>';
    const queue = this.root.querySelector('.ws-queue');
    const switcher = document.createElement('details'); switcher.className = 'analysis-queue';
    switcher.open = !this.filters.sessionId || window.matchMedia('(min-width:1600px)').matches;
    switcher.innerHTML = '<summary>切换手牌 · 本场队列</summary>'; queue.before(switcher); switcher.append(queue);
    const filterBox = this.root.querySelector('.ws-filters');
    const filterDisclosure = document.createElement('details'); filterDisclosure.className = 'analysis-filters';
    filterDisclosure.open = !this.filters.sessionId || Boolean(this.analyzeFilterOpen);
    filterDisclosure.innerHTML = '<summary>筛选与排序</summary>'; filterBox.before(filterDisclosure); filterDisclosure.append(filterBox);
    filterDisclosure.append(this.root.querySelector('#analyzeSummary'));
    filterDisclosure.addEventListener('toggle', () => { this.analyzeFilterOpen = filterDisclosure.open; });
    this.renderQueue();
    const session = SessionRepo.getById(this.filters.sessionId);
    const trail = document.createElement('nav'); trail.className = 'session-review-trail'; trail.setAttribute('aria-label', '复盘位置');
    trail.innerHTML = '<button class="ws-button" data-review-sessions>所有场次</button>' + (session ? '<span aria-hidden="true">/</span><button class="ws-button" data-review-session-overview>' + esc([session.date, session.level].filter(Boolean).join(' · ') || session.id) + ' · 整场总览</button><span aria-hidden="true">/</span><span>本场手牌</span>' : '<span aria-hidden="true">/</span><span>跨场手牌</span>');
    this.root.prepend(trail);
    const heading = this.root.querySelector('.ws-header');
    heading.querySelector('h2').textContent = session ? '本场手牌复盘' : '跨场查找手牌';
    heading.querySelector('p:last-child').textContent = session ? '本场筛选与草稿会保留；随时回到整场总览继续挑牌。' : '跨场查找，或返回场次总览逐场复盘。';
    const importButton = heading.querySelector('[data-analyze-import]');
    importButton.classList.remove('ws-button--primary'); trail.append(importButton);
    this.root.querySelector('#analyzeQueue').scrollTop = queueScroll;
    PubSub.emit('decisionContextChanged');
  },
  renderQueue() {
    const container = this.root.querySelector('#analyzeQueue');
    const oldScroll = container.scrollTop;
    const hands = analysisQueue(HandRepo.getAll(), this.filters);
    if (!hands.some((hand) => hand.id === this.selectedId)) this.selectedId = hands[0]?.id || '';
    try { DecisionWorkspaceStore.change(state => ({ ...state, selectedId: this.selectedId, filters: this.filters, attached: Boolean(this.selectedId) })); } catch (error) { this.error = error.message; }
    const selectedIndex = hands.findIndex((hand) => hand.id === this.selectedId);
    this.limit = Math.max(this.limit, selectedIndex + 1);
    const known = hands.filter((hand) => typeof hand.pBB === 'number' && Number.isFinite(hand.pBB));
    const sum = known.reduce((total, hand) => total + hand.pBB, 0);
    this.root.querySelector('#analyzeSummary').innerHTML = '<span><strong>' + hands.length + '</strong> / ' + HandRepo.getAll().length + ' 手</span><span>其中已标记 ' + hands.filter((hand) => hand.marked).length + ' 手</span><span>已知个人盈亏 ' + Utils.safeFixed(sum, 1) + ' BB · ' + known.length + ' 手</span>';
    container.innerHTML = hands.length ? hands.slice(0, this.limit).map((hand) => '<button class="ws-queue-item" data-analyze-hand="' + esc(hand.id) + '" aria-pressed="' + (hand.id === this.selectedId) + '"><span class="ws-queue-top"><strong>' + esc(hand.ggId || hand.id) + '</strong><span>' + (hand.marked ? '已标记' : '') + '</span></span><span class="ws-queue-meta">' + esc(hand.date || '日期未知') + ' · ' + esc(getObservedProfile(hand).label) + ' · ' + esc(hand.heroPosition || '位置未知') + '</span><span class="ws-queue-cards">' + Utils.renderCardBadges(hand.heroCards || '', {}) + '<span> / </span>' + Utils.renderCardBadges(hand.boardCode || '', {}) + '</span><span class="ws-queue-bottom"><span>' + esc(hand.preflopScenario || '场景未知') + '</span><span>' + (typeof hand.pBB === 'number' && Number.isFinite(hand.pBB) ? Utils.safeFixed(hand.pBB, 1) + ' BB' : '盈亏未知') + '</span></span>' + (hand.mistake ? '<span class="ws-tag">' + esc(hand.mistake) + '</span>' : '') + '</button>').join('') + (hands.length > this.limit ? '<button class="ws-button ws-load-more" data-analyze-more>再显示 40 手</button>' : '') : '<div class="ws-empty"><h3>' + (HandRepo.getAll().length ? '没有符合筛选的手牌' : '先带一场自己的牌进来') + '</h3><p>' + (HandRepo.getAll().length ? '调整条件或清除筛选，原有手牌仍然保留。' : '导入在浏览器本地处理；已有记录会自动出现在这里。') + '</p><button class="ws-button" ' + (HandRepo.getAll().length ? 'data-analyze-reset>清除筛选' : 'data-analyze-import>导入手牌') + '</button></div>';
    container.scrollTop = oldScroll;
    this.renderDetail(hands);
  },
  select(id) {
    this.selectedId = id; this.renderQueue();
    const title = this.root.querySelector('#analyzeHandTitle');
    title?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 900px)').matches) title?.scrollIntoView({ block: 'start', behavior: 'instant' });
  },
  renderDetail(hands) {
    const detail = this.root.querySelector('#analyzeDetail');
    const hand = hands.find((item) => item.id === this.selectedId);
    if (!hand) { detail.innerHTML = '<div class="ws-empty"><p>选中一手牌，在这里连续回看。</p><button class="ws-button" data-analyze-study disabled>从所选手牌学习</button></div>'; return; }
    const index = hands.indexOf(hand);
    detail.innerHTML = '<div class="ws-detail-heading"><div><p class="ws-eyebrow">当前筛选中 ' + (index + 1) + ' / ' + hands.length + '</p><h3 id="analyzeHandTitle" tabindex="-1">手牌 ' + esc(hand.ggId || hand.id) + '</h3></div><div class="ws-adjacent"><button class="ws-button" data-analyze-step="-1"' + (index === 0 ? ' disabled' : '') + '>上一手</button><button class="ws-button" data-analyze-step="1"' + (index === hands.length - 1 ? ' disabled' : '') + '>下一手</button></div></div><p class="ws-muted">' + esc(getObservedProfile(hand).label) + ' · ' + esc(hand.preflopScenario || '场景未知') + ' · 有效筹码未核实</p><div class="ws-detail-actions"><button class="ws-button ws-button--primary" data-analyze-study>学习相关主题</button><button class="ws-button" data-analyze-edit>标记与填写复盘</button></div><div id="analyzeReplay"></div><details class="ws-concept"><summary>我的复盘与原行动</summary><dl class="ws-notes"><dt>当时决策</dt><dd>' + esc(hand.decision || '尚未记录') + '</dd><dt>错误标签</dt><dd>' + esc(hand.mistake || '尚未填写') + '</dd><dt>复盘备注</dt><dd>' + esc(hand.reflection || '尚未记录') + '</dd></dl><pre>' + esc(hand.desc || '没有逐街原文') + '</pre></details>';
    const layout = document.createElement('div'); layout.className = 'decision-detail-layout';
    const replayRoot = detail.querySelector('#analyzeReplay'); replayRoot.before(layout); layout.append(replayRoot);
    const editor = document.createElement('section'); editor.id = 'decisionEditor'; layout.append(editor);
    try {
      const position = this.bundle()?.position || {};
      HandReplay.render(detail.querySelector('#analyzeReplay'), hand, { ...position, collapseReview: true, onPositionChange: selected => this.setPosition(selected) });
      this.renderEditor();
    } catch (error) { editor.textContent = error.message; }
    const practice = document.createElement('button'); practice.type = 'button'; practice.className = 'ws-button';
    practice.setAttribute('data-analyze-practice', ''); practice.textContent = '用这手牌做单决策练习';
    detail.querySelector('.ws-detail-actions').append(practice);
    // [V7.16.0 新增] A reviewed hand can return to its session's unfinished work.
    if (hand.sessionId && SessionRepo.getById(hand.sessionId)) {
      const back = document.createElement('button'); back.type = 'button'; back.className = 'ws-button';
      back.dataset.analyzeReturnSession = ''; back.textContent = '回到本场收尾'; detail.querySelector('.ws-detail-actions').append(back);
    }
  },
  renderEditor() {
    const target = this.root.querySelector('#decisionEditor'); if (!target) return;
    const bundle = this.bundle(); if (!bundle) return;
    const { context: c, draft: d, position: p, hand } = bundle;
    target.dataset.decisionKey = bundle.draftId;
    this.visibleDraft = { ...d };
    const field = (name, title, placeholder = '') => '<label class="practice-field">' + title + '<textarea data-decision-draft="' + name + '" data-decision-' + name + ' maxlength="2000" placeholder="' + placeholder + '">' + esc(d[name] || '') + '</textarea></label>';
    const postflop = ['flop', 'turn', 'river'].includes(c.street);
    const sectionOpen = (key, fallback = false) => (this.editorDisclosures.get(bundle.draftId + ':' + key) ?? fallback) ? ' open' : '';
    const numberField = (name, label) => '<label class="practice-field">' + label + '<input inputmode="decimal" data-decision-draft="' + name + '" data-decision-' + name + ' maxlength="32" value="' + esc(d[name] || '') + '" placeholder="未知留空"></label>';
    target.innerHTML = '<div class="decision-editor-savebar"><button type="button" class="ws-button ws-button--primary" data-decision-save>保存当前复盘</button><p class="ws-muted" data-decision-status role="status">' + esc(this.error || (d.saved ? '复盘已保存。' : '草稿自动保留在本机；保存后写入复盘。')) + '</p></div><div class="ws-section-heading"><h3>' + (postflop ? STREET_NAMES[c.street] + '决策笔记' : '当前决策笔记') + '</h3><button type="button" class="ws-button" data-decision-mark>' + (hand.marked ? '已标记 · 取消' : '标记疑问手牌') + '</button></div><p class="ws-muted">' + STREET_NAMES[c.street] + (c.actionIndex !== null ? ' · 第 ' + (c.actionIndex + 1) + ' 个动作前' : ' · 点选行动可进一步定位') + '。请核对动作位置与牌谱是否一致。</p>' +
      (['flop', 'turn', 'river'].includes(c.street) ? '<label class="practice-field">此处想研究哪类决策？<select data-decision-kind>' + option('', '尚未确认', p.decisionKind || '') + option('initiative', '主动下注或过牌', p.decisionKind || '') + option('facingBet', '面对下注或加注', p.decisionKind || '') + '</select></label>' : '') +
      field('question', '我的疑问', '例如：这里跟注的价格与范围依据是什么？') +
      field('reason', '我的初步判断', '写下当前判断依据。') +
      (postflop ? '<details class="ws-concept" data-postflop-conditions><summary>补充局面条件（选填）</summary><p class="ws-muted">底池与筹码按 bb 填写；有效筹码取你和当前对手中较少的剩余筹码。多人底池请在补充说明中列出对手、各方筹码和边池。</p><div class="postflop-amounts">' + numberField('potBb', '行动前底池 / bb') + numberField('effectiveStackBb', '节点剩余有效筹码 / bb') + '</div>' + field('conditionNote', '条件来源与不确定项', '例如：牌谱未注明抽水，或行动者待确认') + '</details>' +
        '<details class="ws-concept" data-decision-section="plan"' + sectionOpen('plan', Boolean(d.rangeHypothesis || d.streetPlan || d.nextStreetPlan)) + '><summary>展开行动计划 · 范围、本街与下一街</summary>' + field('rangeHypothesis', '对手范围假设（选填）', '哪些价值牌、听牌或诈唬能沿前序行动到达这里？') +
        field('streetPlan', '本街行动、尺度与目的（选填）', '准备过牌、下注、跟注还是加注？用什么尺度，希望哪些牌继续或弃牌？') +
        field('nextStreetPlan', c.street === 'river' ? '面对后续回应的计划（选填）' : '下一街计划（选填）', c.street === 'river' ? '面对不同加注尺度如何应对？哪些范围假设需要再验证？' : '按尚未出现的牌分类：哪些继续、哪些停下？面对下注或加注如何应对？') + '</details>' : '') +
      '<details class="ws-concept" data-decision-section="learning"' + sectionOpen('learning', Boolean(d.insight || d.references?.length)) + '><summary>学习后补充 · 新理解与来源</summary>' + field('insight', '新理解、适用条件或反例') +
      ((d.references || []).length ? '<p class="ws-source">已关联学习来源：' + d.references.map(item => esc(item.title)).join('、') + '。具体条件与出处可在主题学习中回看。</p>' : '') +
      '</details><details class="ws-concept"' + (this.reflectionOpen ? ' open' : '') + '><summary>整手牌复盘备注</summary>' + field('reflection', '复盘备注') + '</details>';
    target.querySelector('[data-decision-reflection]')?.closest('details')?.addEventListener('toggle', event => { this.reflectionOpen = event.target.open; });
    target.scrollTop = this.editorScrolls.get(bundle.draftId) || 0;
    this.renderPostflopResume();
  },
  // [V7.19.0 新增] Resume recorded questions at their original node, including unsaved drafts.
  renderPostflopResume() {
    let container = this.root.querySelector('[data-postflop-resume]');
    if (!container) { container = document.createElement('section'); container.dataset.postflopResume = ''; this.root.querySelector('.analysis-filters').after(container); }
    const state = DecisionWorkspaceStore.read(); const rows = [], groupedDrafts = new Map();
    for (const [id, draft] of Object.entries(state.drafts)) {
      const match = id.match(/^(.*):([^:]+):(flop|turn|river):(\d+)$/);
      if (!match) continue;
      const list = groupedDrafts.get(match[1]) || [];
      list.push([match.slice(2).join(':'), draft]); groupedDrafts.set(match[1], list);
    }
    for (const hand of HandRepo.getAll().filter(item => !this.filters.sessionId || item.sessionId === this.filters.sessionId)) {
      const revision = handRevision(hand);
      const notes = new Map(Object.entries(hand.decisionReviews || {}));
      for (const [key, draft] of groupedDrafts.get(hand.id) || []) if (key.startsWith(revision + ':')) {
        const note = notes.get(key);
        if (!note || !draft.editedAt || note.updatedAt < draft.editedAt) notes.set(key, draft);
      }
      for (const [key, draft] of notes) {
        if (!key.startsWith(revision + ':') || typeof draft?.question !== 'string' || !draft.question.trim()) continue;
        const [, street, action] = key.split(':');
        if (!['flop', 'turn', 'river'].includes(street) || !/^\d+$/.test(action)) continue;
        const context = decisionContext(hand, { street, actionIndex: Number(action) });
        if (context.eligible) rows.push({ hand, context, draft, time: draft.editedAt || draft.updatedAt || '' });
      }
    }
    rows.sort((a,b) => b.time.localeCompare(a.time));
    container.innerHTML = rows.length ? '<details class="ws-concept"><summary>继续上次的翻后问题 · ' + rows.length + '</summary><div class="postflop-resume-list">' + rows.slice(0, 8).map(({ hand, context, draft }) => '<button class="ws-hand-link" data-postflop-hand="' + esc(hand.id) + '" data-postflop-street="' + context.street + '" data-postflop-action="' + context.actionIndex + '" data-postflop-kind="' + esc(draft.decisionKind || '') + '"><strong>' + esc(draft.question) + '</strong><span>' + esc(hand.ggId || hand.id) + ' · ' + STREET_NAMES[context.street] + ' · 第 ' + (context.actionIndex + 1) + ' 个动作前</span></button>').join('') + '</div></details>' : '';
  },
};
