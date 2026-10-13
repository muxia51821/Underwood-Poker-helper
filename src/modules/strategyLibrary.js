// [V7.11.14 修改] Read-only topic browser and candidate hand links; no personal-data writes.
import { Utils } from '../utils.js';
import { Navigation } from './navigation.js';
import { STRATEGY_TOPICS, CONCEPT_READING_NOTES, resolveTopic } from '../data/strategyFramework.js';
import { HandRepo } from '../store/store.js';
import { getTopicHandReferences } from './strategyStudy.js';
import { ConceptQuiz } from './conceptQuiz.js';

function escape(value) {
  return Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function sourceHtml(source) {
  if (!source) return '<p class="strategy-library__boundary">来源待补充。</p>';
  const url = safeSourceUrl(source.url);
  return '<details class="strategy-library__reading"><summary>' + (url
    ? '<a href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.title) + '</a>'
    : escape(source.title)) + '</summary><p>' + escape(source.conditions) + '</p><p class="strategy-library__boundary">边界：' + escape(source.boundary) + '</p></details>';
}

function conceptHtml(concept) {
  const ref = concept.sourceRef;
  const correction = CONCEPT_READING_NOTES[concept.id];
  return '<details class="strategy-library__reading" data-library-concept="' + escape(concept.id) + '"><summary>' + escape(concept.title) + '</summary>' +
    '<p>' + escape(concept.mechanism) + '</p>' +
    (correction ? '<p class="strategy-library__boundary">阅读限定：' + escape(correction) + '</p>' : '') +
    '<p class="strategy-library__boundary">' + escape(concept.applicability) + '</p>' +
    '<p class="strategy-library__source">Daily Dose of GTO · 第 ' + escape(ref.chapter) + ' 章 · ' + escape(ref.lesson) + ' · 阅读器页 ' + escape(ref.readerPages) + '</p></details>';
}

export const StrategyLibrary = {
  selectedTopicId: 'preflop',
  profileKey: 'all', handLimit: 10, handsExpanded: false,
  init() {
    const root = document.getElementById('strategyLibrary');
    if (!root || root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';
    root.addEventListener('click', (event) => {
      const handButton = event.target.closest('[data-library-hand]');
      if (handButton) {
        Navigation.goToHand(handButton.dataset.libraryHand);
        return;
      }
      if (event.target.closest('[data-library-more]')) {
        this.handLimit += 10;
        this.renderHands();
        return;
      }
      if (event.target.closest('[data-library-quiz]')) {
        this.practice(this.selectedTopicId);
        return;
      }
      if (event.target.closest('[data-library-personal]')) {
        document.getElementById('strategyEditorPane').focus();
        return;
      }
      const topic = event.target.closest('[data-library-topic]');
      if (topic) this.select(topic.dataset.libraryTopic, true);
    });
    root.addEventListener('change', (event) => {
      if (event.target.matches('[data-library-profile]')) {
        this.profileKey = event.target.value;
        this.handLimit = 10;
        this.renderHands();
      }
    });
    // [V7.11.14 新增] Keep candidate lists compact while preserving the reader's expansion choice.
    root.addEventListener('toggle', (event) => {
      if (event.target.matches('[data-library-candidates]') && event.target.isConnected) this.handsExpanded = event.target.open;
    }, true);
    // Delegation also covers hand cards inserted after an import or pagination.
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-strategy-topic]');
      if (button && resolveTopic(button.dataset.strategyTopic)) {
        Navigation.goToReviewSubtab('strategy');
        this.select(button.dataset.strategyTopic, true);
      }
    });
    this.select(this.selectedTopicId);
  },
  // [V7.11.15 新增] Both the topic button and strategy units use the same scoped practice entry.
  practice(id) {
    const topic = resolveTopic(id);
    if (!topic) return false;
    Navigation.goToReviewSubtab('discover');
    ConceptQuiz.renderInto('conceptQuizBody', { conceptIds: topic.conceptIds, title: topic.title, topicId: topic.id });
    document.getElementById('conceptQuizBody').closest('details')?.setAttribute('open', '');
    document.getElementById('conceptQuizAllBtn')?.focus();
    return true;
  },
  select(id, focus = false) {
    const topic = resolveTopic(id);
    if (!topic) return false;
    if (this.selectedTopicId !== id) this.handLimit = 10;
    this.selectedTopicId = id;
    const nav = document.getElementById('strategyTopicNav');
    const body = document.getElementById('strategyTopicBody');
    nav.innerHTML = STRATEGY_TOPICS.map((item) => '<button type="button" class="strategy-library__topic" data-library-topic="' + item.id + '" aria-pressed="' + (item.id === id) + '">' + escape(item.title) + '</button>').join('');
    body.innerHTML = '<h3 id="strategyTopicTitle" tabindex="-1">' + escape(topic.title) + '</h3><p class="strategy-library__summary">' + escape(topic.summary) + '</p>' +
      '<p class="strategy-library__boundary">适用边界：' + escape(topic.boundary) + '</p>' +
      '<p><button type="button" class="btn--mini" data-library-quiz>练习本主题</button></p>' +
      '<h4>我的相关手牌</h4><p class="strategy-library__source">按已识别决策列出候选，不按输赢筛选，也不自动判为支持或反例。桌型相同不代表有效筹码及来源条件匹配；阅读原行动与复盘后再判断。</p>' +
      '<label>观察桌型 <select class="select" data-library-profile>' + ['all', '9max', '6max', '2max', 'unknown-table'].map((key) => '<option value="' + key + '"' + (key === this.profileKey ? ' selected' : '') + '>' + escape(key === 'all' ? '全部桌型' : key === 'unknown-table' ? '桌型未知' : key) + '</option>').join('') + '</select></label><div id="strategyTopicHands"></div>' +
      '<h4>教材与概念</h4><p class="strategy-library__source">书籍需自行打开 PDF，按阅读器页码定位；例子中的数字只适用于原条件。</p>' + topic.concepts.map(conceptHtml).join('') +
      '<h4>文章对照</h4><p class="strategy-library__source">结构性参考，不是主线频率目标；联网可打开原文。</p>' +
      (topic.sources.length ? topic.sources.map(sourceHtml).join('') : '<p>暂无已关联文章，先保留教材分支。</p>') +
      '<h4>对应复盘场景</h4>' + (topic.spots.length
        ? '<ul>' + topic.spots.map((spot) => '<li>' + escape(spot.title) + '</li>').join('') + '</ul><p class="strategy-library__source">主题关联不代表筹码、前置线等条件已完全匹配；以手牌事实和来源边界为准。</p>'
        : '<p>暂无直接对应的场景卡；不据此自动识别或评价牌局。</p>') +
      '<h4>经验待证 · ' + topic.hypotheses.length + '</h4><p class="strategy-library__source">原笔记缺少来源、级别、时间和样本；下面是待验证观点，不是动作建议。</p>' +
      (topic.hypotheses.map((item) => '<details class="strategy-library__reading" data-library-hypothesis><summary><span class="strategy-library__badge">待验证</span> ' + escape(item.line) + '</summary><p>原笔记（未经验证）：' + escape(item.text) + '</p><p>' + escape(item.assessment) + '</p></details>').join('') || '<p>该主题暂无原行动线笔记。</p>');
    this.renderHands();
    if (focus) document.getElementById('strategyTopicTitle').focus();
    return true;
  },
  // [V7.11.14 新增] Re-read public repository state on entry; imports and deletions never leave stale links.
  renderHands() {
    const container = document.getElementById('strategyTopicHands');
    if (!container) return;
    const hands = getTopicHandReferences(this.selectedTopicId, HandRepo.getAll(), this.profileKey);
    container.innerHTML = '<details class="strategy-library__reading" data-library-candidates' + (this.handsExpanded ? ' open' : '') + '><summary>候选 ' + hands.length + ' 手 · 显示 ' + Math.min(this.handLimit, hands.length) + ' 手</summary>' +
      (hands.length ? '<ul class="strategy-library__hand-list">' + hands.slice(0, this.handLimit).map((hand) => '<li><button type="button" class="btn--mini" data-library-hand="' + escape(hand.id) + '">' + escape([hand.reference, hand.date, hand.scenario, hand.position, hand.profileLabel, hand.cards, hand.boardCode].filter(Boolean).join(' · ')) + '</button><p class="strategy-library__source">' + escape(hand.reason) + '</p></li>').join('') + '</ul>' : '<p>暂无可可靠关联的手牌。先导入牌谱；未覆盖的场景或无法可靠归属的行动不会强行归类。</p>') +
      (hands.length > this.handLimit ? '<button type="button" class="btn--mini" data-library-more>再显示 10 手</button>' : '') + '</details>';
  },
};
