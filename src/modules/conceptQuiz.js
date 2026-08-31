// [V7.11.3 新增] 概念自测（Quiz 域接入）：从概念种子的 selfCheck 生成题库。
// [V7.11.4 修改] 升级为交互式判分训练器：单题作答 → 即时反馈 → 掌握度记入
//   localStorage（pa_concept_quiz_mastery，与 quizTrainer 的 pa_quiz_mastery 机制同构）。
// 设计借鉴 DDoG「quiz-first」教学法：先自己作答，再看答案与解析。
// getItems 不依赖 DOM（可在 node 契约测试中调用）；renderInto 仅在浏览器调用。
import { Utils } from '../utils.js';
import { CONCEPT_SEEDS } from '../data/conceptSeed.js';

export var CONCEPT_QUIZ_VERSION = 2;

var MASTERY_KEY = 'pa_concept_quiz_mastery';

function esc(s) {
  if (s == null) return '';
  const str = String(s);
  if (typeof document !== 'undefined') return Utils.escapeHtml(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sourceLine(ref) {
  if (!ref) return '';
  if (ref.kind === 'gwblog') {
    return '<div style="margin-top:2px;color:#7a8494;font-size:0.95em">来源：GTO Wizard 博客《' + esc(ref.lesson) + '》</div>';
  }
  return '<div style="margin-top:2px;color:#7a8494;font-size:0.95em">来源：DDoG 第' + esc(ref.chapter) + '章《' + esc(ref.lesson) + '》阅读器页 ' + esc(ref.readerPages) + '</div>';
}

function _loadMastery() {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY)) || {}; } catch (e) { return {}; }
}
function _saveMastery(m) {
  try { localStorage.setItem(MASTERY_KEY, JSON.stringify(m)); } catch (e) { /* 存储满时静默跳过 */ }
}

export var ConceptQuiz = {
  // 题库：确定性排序（cluster + id），每题 = 概念种子的 selfCheck
  getItems: function () {
    return CONCEPT_SEEDS
      .filter(function (c) { return c.selfCheck && c.selfCheck.question; })
      .map(function (c) {
        return {
          id: c.id,
          title: c.title,
          cluster: c.cluster,
          question: c.selfCheck.question,
          options: c.selfCheck.options,
          answer: c.selfCheck.answer,
          answerNote: c.selfCheck.answerNote,
          sourceRef: c.selfCheck.sourceRef,
        };
      })
      .sort(function (a, b) { return (a.cluster + '|' + a.id).localeCompare(b.cluster + '|' + b.id); });
  },

  getMastery: function () { return _loadMastery(); },

  resetMastery: function () {
    try { localStorage.removeItem(MASTERY_KEY); } catch (e) { /* 忽略 */ }
    if (this._el) this._renderQuestion();
  },

  // 交互式训练器：单题作答 → 即时反馈 → 掌握度落库 → 下一题
  renderInto: function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var items = this.getItems();
    var countEl = document.getElementById('conceptQuizCount');
    if (countEl) countEl.textContent = '(' + items.length + ' 题)';
    this._items = items;
    this._el = el;
    this._pos = 0;
    this._answered = false;
    el.innerHTML =
      '<div style="color:#8b949e;font-size:0.75em;margin-bottom:6px">题目提炼自 Daily Dose of GTO 对应课程；先自己作答，再看判定与解析。掌握度保存在本地。</div>' +
      '<div id="conceptQuizStage"></div>' +
      '<div style="margin-top:6px;text-align:right"><button id="conceptQuizReset" class="btn--mini">重置掌握度</button></div>';
    this._stage = el.querySelector('#conceptQuizStage');
    var self = this;
    var resetBtn = el.querySelector('#conceptQuizReset');
    if (resetBtn) resetBtn.addEventListener('click', function () { self.resetMastery(); });
    this._renderQuestion();
  },

  _renderQuestion: function () {
    if (!this._stage) return;
    var items = this._items;
    if (!items.length) {
      this._stage.innerHTML = '<div style="color:#8b949e;font-size:0.8em">暂无题目（概念种子中无 selfCheck）。</div>';
      return;
    }
    if (this._pos >= items.length) { this._renderSummary(); return; }
    var it = items[this._pos];
    var self = this;
    var html = '<div style="border:1px solid #1c2f4a;border-radius:6px;padding:8px 10px;background:#0a1524">';
    html += '<div style="color:#8b949e;font-size:0.72em;margin-bottom:3px">第 ' + (this._pos + 1) + ' / ' + items.length + ' 题 · ' + esc(it.title) + '</div>';
    html += '<div style="color:#e2e6ee;font-size:0.85em;margin-bottom:6px">' + esc(it.question) + '</div>';
    html += '<div id="conceptQuizOptions">';
    it.options.forEach(function (opt, oi) {
      html += '<button type="button" data-oi="' + oi + '" style="display:block;width:100%;text-align:left;margin:3px 0;padding:5px 8px;border:1px solid #2a3f5f;border-radius:5px;background:#0d1930;color:#c8ccd0;font-size:0.78em;cursor:pointer">· ' + esc(opt) + '</button>';
    });
    html += '</div>';
    html += '<div id="conceptQuizFeedback" style="display:none;margin-top:6px;font-size:0.78em"></div>';
    html += '<div style="margin-top:6px;text-align:right"><button id="conceptQuizNext" class="btn--mini" style="display:none">下一题 →</button></div>';
    html += '</div>';
    this._stage.innerHTML = html;
    this._answered = false;
    var optWrap = this._stage.querySelector('#conceptQuizOptions');
    optWrap.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () { self._answer(parseInt(btn.getAttribute('data-oi'), 10)); });
    });
    var nextBtn = this._stage.querySelector('#conceptQuizNext');
    nextBtn.addEventListener('click', function () { self._pos += 1; self._renderQuestion(); });
  },

  _answer: function (oi) {
    if (this._answered) return;
    this._answered = true;
    var it = this._items[this._pos];
    var chosen = it.options[oi];
    var correct = chosen === it.answer;
    var optWrap = this._stage.querySelector('#conceptQuizOptions');
    optWrap.querySelectorAll('button').forEach(function (btn) {
      var val = it.options[parseInt(btn.getAttribute('data-oi'), 10)];
      btn.disabled = true;
      btn.style.cursor = 'default';
      if (val === it.answer) { btn.style.borderColor = '#3f9d5a'; btn.style.color = '#9fd49f'; }
      else if (val === chosen) { btn.style.borderColor = '#b04a4a'; btn.style.color = '#d49a9a'; }
    });
    var m = _loadMastery();
    var rec = m[it.id] || { asked: 0, correct: 0 };
    rec.asked += 1;
    if (correct) rec.correct += 1;
    m[it.id] = rec;
    _saveMastery(m);
    var fb = this._stage.querySelector('#conceptQuizFeedback');
    fb.style.display = 'block';
    fb.innerHTML = (correct ? '<div style="color:#9fd49f"><b>✓ 正确</b></div>' : '<div style="color:#d49a9a"><b>✗ 错误——正确答案：' + esc(it.answer) + '</b></div>') +
      (it.answerNote ? '<div style="margin-top:2px;color:#a8afba">' + esc(it.answerNote) + '</div>' : '') +
      sourceLine(it.sourceRef);
    var nextBtn = this._stage.querySelector('#conceptQuizNext');
    if (nextBtn) nextBtn.style.display = 'inline-block';
  },

  _renderSummary: function () {
    var m = _loadMastery();
    var asked = 0, correct = 0;
    this._items.forEach(function (it) {
      var r = m[it.id];
      if (r) { asked += r.asked; correct += r.correct; }
    });
    var pct = asked ? Math.round((correct / asked) * 100) : 0;
    var self = this;
    this._stage.innerHTML =
      '<div style="border:1px solid #1c2f4a;border-radius:6px;padding:10px;background:#0a1524;text-align:center">' +
      '<div style="color:#d4a853;font-size:0.9em;font-weight:bold">本轮完成</div>' +
      '<div style="margin-top:4px;color:#c8ccd0;font-size:0.8em">累计作答 ' + asked + ' 次 · 正确 ' + correct + ' 次 · 正确率 ' + pct + '%</div>' +
      '<div style="margin-top:8px"><button id="conceptQuizRestart" class="btn--mini">再练一轮</button></div></div>';
    var btn = this._stage.querySelector('#conceptQuizRestart');
    btn.addEventListener('click', function () { self._pos = 0; self._renderQuestion(); });
  },

  init: function () {
    if (typeof document !== 'undefined' && document.getElementById('conceptQuizBody')) {
      this.renderInto('conceptQuizBody');
    }
  },
};
