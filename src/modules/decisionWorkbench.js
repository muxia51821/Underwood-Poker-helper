// [V7.15.0 新增] One task shell keeps review, study and practice destinations visible together.
import { Navigation } from './navigation.js';
import { Utils, PubSub } from '../utils.js';
import { HandRepo } from '../store/store.js';
import { DecisionWorkspaceStore } from '../store/decisionWorkspaceStore.js';
import { decisionContext, handRevision, STREET_NAMES } from './decisionContext.js';
import { POSTFLOP_PLAN_LABELS } from './postflopReviewModel.js'; // [V7.19.0 新增]
const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const DecisionWorkbench = {
  mode: 'analyze', context: null, onMode: null, onFree: null,
  init() {
    this.root = document.getElementById('decisionWorkbench');
    this.root.addEventListener('click', event => {
      const mode = event.target.closest('[data-tab]')?.dataset.tab;
      if (mode) this.onMode?.(mode);
      if (event.target.closest('[data-workbench-return]') && this.context) Navigation.goToHand(this.context.handId, this.context);
      if (event.target.closest('[data-workbench-free]')) this.onFree?.();
    });
    PubSub.on('decisionContextChanged', () => { if (!this.root.hidden) this.renderContext(); });
  },
  render(mode, source = null) {
    this.mode = mode;
    this.root.hidden = !['analyze', 'study', 'practice'].includes(mode);
    this.context = source;
    this.root.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tab === mode)));
    if (!this.root.hidden) this.renderContext();
  },
  renderContext() {
    let context = this.context;
    const container = this.root.querySelector('[data-workbench-context]');
    try {
      const saved = DecisionWorkspaceStore.read();
      if (this.mode === 'analyze' && this.resolveDecision) context = this.resolveDecision();
      else if (this.mode === 'analyze' && saved.selectedId) {
        const hand = HandRepo.getById(saved.selectedId);
        if (hand) {
          context = decisionContext(hand, saved.positions[hand.id]);
          context.question = saved.drafts[hand.id + ':' + context.key]?.question || hand.decisionReviews?.[context.key]?.question || '';
          context.initialReason = saved.drafts[hand.id + ':' + context.key]?.reason || hand.decisionReviews?.[context.key]?.reason || '';
        }
      }
      this.context = context;
      // Analyze already shows these facts beside the replay; Study and Practice need the source bridge.
      container.hidden = this.mode === 'analyze';
      if (container.hidden) { container.replaceChildren(); return; }
      const hand = context ? HandRepo.getById(context.handId) : null;
      const plan = this.mode !== 'practice' && context?.reviewPlan ? '<details><summary>我的翻后计划</summary>' + Object.entries(POSTFLOP_PLAN_LABELS).map(([key,label]) => '<p><strong>' + label + '：</strong>' + esc(context.reviewPlan[key] || '尚未填写') + '</p>').join('') + '</details>' : '';
      const facts = context && ['flop', 'turn', 'river'].includes(context.street) ? '<p>行动前底池 ' + (typeof context.pot === 'number' ? Utils.safeFixed(context.pot,2) + 'bb' : '未知') + ' · 剩余有效筹码 ' + (typeof context.effectiveStack === 'number' ? Utils.safeFixed(context.effectiveStack,2) + 'bb' : '未知') + (context.conditionSource === 'user-entered' ? '（手工填写）' : '') + '</p>' : '';
      container.innerHTML = context ? '<div class="decision-context ws-context"><div class="workbench-source-body"><p class="ws-eyebrow">' + (this.mode === 'practice' ? '本轮学习来源' : '当前决策') + '</p><strong>' + esc(context.reference || context.handId) + ' · ' + esc(STREET_NAMES[context.street] || '来源局面') + (Number.isInteger(context.actionIndex) ? ' · 第 ' + (context.actionIndex + 1) + ' 个动作前' : '') + '</strong><p data-workbench-question>' + esc(context.question || '先写下一个疑问，再研究相应的判断。') + '</p><details class="workbench-source-details" data-workbench-source-details><summary>查看局面条件与来源</summary><p>' + esc([context.profile, context.heroPosition ? 'Hero ' + context.heroPosition : '', context.scenario].filter(Boolean).join(' · ')) + '</p><p>' + Utils.renderCardBadges((context.board || []).join(' '), {}) + '</p>' + facts + (this.mode !== 'practice' && context.initialReason ? '<p>我的初步判断：' + esc(context.initialReason) + '</p>' : '') + plan + (context.actionIndex !== null && context.prefix ? '<details><summary>决策前的行动</summary>' + context.prefix.map(item => '<p>' + esc(item.street) + '：' + esc(item.actions.join(' → ') || '尚未行动') + '</p>').join('') + '</details>' : '') + '</details>' + (!hand ? '<p class="ws-boundary">来源手牌已删除，当前保留的是学习快照。</p>' : handRevision(hand) !== context.revision ? '<p class="ws-boundary">原牌谱已变更，当前练习来源保留旧快照，返回后请重新核对。</p>' : '') + '</div>' + (this.mode === 'practice' ? '<div class="practice-toolbar">' + (hand ? '<button type="button" class="ws-button" data-workbench-return>回到原决策</button>' : '') + '<button type="button" class="ws-button" data-workbench-free>自由学习</button></div>' : '') + '</div>' : '';
    } catch (error) { container.textContent = error.message; }
  },
};
