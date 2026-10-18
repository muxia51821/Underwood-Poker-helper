// [V7.11.14 修改] Read-only topic browser and candidate hand links; no personal-data writes.
import { Utils } from '../utils.js';
import { Navigation } from './navigation.js';
import { STRATEGY_TOPICS, CONCEPT_READING_NOTES, resolveTopic } from '../data/strategyFramework.js';
import { HandRepo } from '../store/store.js';
import { getTopicHandReferences } from './strategyStudy.js';
import { PracticeWorkspace } from './practiceWorkspace.js'; // [V7.15.0 修改]

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
    : escape(source.title)) + '</summary><p>' + escape(source.conditions) + '</p><p class="strategy-library__boundary">参考范围：' + escape(source.boundary) + '</p></details>';
}

function conceptHtml(concept) {
  const ref = concept.sourceRef;
  const correction = CONCEPT_READING_NOTES[concept.id];
  return '<details class="strategy-library__reading" data-library-concept="' + escape(concept.id) + '"><summary>' + escape(concept.title) + '</summary>' +
    '<p>' + escape(concept.mechanism) + '</p>' +
    (correction ? '<p class="strategy-library__boundary">阅读提示：' + escape(correction) + '</p>' : '') +
    '<p class="strategy-library__boundary">适用条件：' + escape(concept.applicability) + '</p>' +
    '<p class="strategy-library__source">Daily Dose of GTO · 第 ' + escape(ref.chapter) + ' 章 · ' + escape(ref.lesson) + ' · 阅读器页 ' + escape(ref.readerPages) + '</p></details>';
}

function readingSourceHtml(ref) {
  return '<p class="strategy-library__source">' + escape(ref.kind === 'aonlh' ? '无限德州扑克应用指南' : 'Daily Dose of GTO · 第 ' + ref.chapter + ' 章') +
    ' · ' + escape(ref.lesson) + ' · 阅读器页 ' + escape(ref.readerPages) + '</p>';
}

function lessonHtml(lesson) {
  let html = '<details class="strategy-library__reading" data-library-lesson' + (lesson.id ? ' data-turn-decision="' + escape(lesson.id) + '"' : '') + '><summary>' + escape(lesson.title) + '</summary>';
  if (lesson.steps) {
    for (const [key, label] of [['scope', '先认前置线'], ['lines', '如何构造动作'], ['streets', '对照另一种牌面'], ['deviation', '回到自己的决策']]) {
      const step = lesson.steps[key];
      html += '<h5>' + label + '</h5><p>' + escape(step.text) + '</p>' + readingSourceHtml(step.sourceRef);
    }
  } else html += '<p>' + escape(lesson.text) + '</p><p>' + escape(lesson.example) + '</p>' + readingSourceHtml(lesson.sourceRef);
  html += '<details data-lesson-check><summary>想一想：' + escape(lesson.question) + '</summary><p>' + escape(lesson.answer) + '</p></details>';
  if (lesson.boundary) html += '<p class="strategy-library__boundary">' + escape(lesson.boundary) + '</p>';
  return html + '</details>';
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
    PracticeWorkspace.open({ type: 'concept', topicId: topic.id, returnTab: 'review', returnSub: 'strategy', learningQuestion: topic.title });
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
      '<p class="strategy-library__boundary">' + escape(topic.boundary) + '</p>' +
      '<p><button type="button" class="btn--mini" data-library-quiz>练习本主题</button></p>' +
      '<h4>决策讲解</h4>' + topic.lessons.map(lessonHtml).join('') +
      '<h4>我的相关手牌</h4><p class="strategy-library__source">按决策匹配列出，点开后核对牌谱。</p>' +
      '<label>观察桌型 <select class="select" data-library-profile>' + ['all', '9max', '6max', '2max', 'unknown-table'].map((key) => '<option value="' + key + '"' + (key === this.profileKey ? ' selected' : '') + '>' + escape(key === 'all' ? '全部桌型' : key === 'unknown-table' ? '桌型未知' : key) + '</option>').join('') + '</select></label><div id="strategyTopicHands"></div>' +
      '<h4>教材与概念</h4><p class="strategy-library__source">按页码查看教材原例。</p>' + topic.concepts.map(conceptHtml).join('') +
      '<h4>文章对照</h4><p class="strategy-library__source">可联网查看相关文章。</p>' +
      (topic.sources.length ? topic.sources.map(sourceHtml).join('') : '<p>该主题暂无关联文章。</p>') +
      '<h4>对应复盘场景</h4>' + (topic.spots.length
        ? '<ul>' + topic.spots.map((spot) => '<li>' + escape(spot.title) + '</li>').join('') + '</ul><p class="strategy-library__source">打开牌谱查看具体行动。</p>'
        : '<p>该主题暂无对应的复盘场景。</p>') +
      '<h4>行动线观察 · ' + topic.hypotheses.length + '</h4>' +
      (topic.hypotheses.length
        ? '<p class="strategy-library__source">这些观察缺少来源、级别、时间或样本。</p>' + topic.hypotheses.map((item) => '<details class="strategy-library__reading" data-library-hypothesis><summary><span class="strategy-library__badge">待核实</span> ' + escape(item.line) + '</summary><p>原笔记：' + escape(item.text) + '</p><p>' + escape(item.assessment) + '</p></details>').join('')
        : '<p>该主题暂无行动线观察。</p>');
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
      (hands.length ? '<ul class="strategy-library__hand-list">' + hands.slice(0, this.handLimit).map((hand) => '<li><button type="button" class="btn--mini" data-library-hand="' + escape(hand.id) + '">' + escape([hand.reference, hand.date, hand.scenario, hand.position, hand.profileLabel, hand.cards, hand.boardCode].filter(Boolean).join(' · ')) + '</button><p class="strategy-library__source">' + escape(hand.reason) + '</p></li>').join('') + '</ul>' : '<p>暂无可关联手牌。导入牌谱后再查看。</p>') +
      (hands.length > this.handLimit ? '<button type="button" class="btn--mini" data-library-more>再显示 10 手</button>' : '') + '</details>';
  },
};
