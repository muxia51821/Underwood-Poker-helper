// [V7.11.3 新增] 概念自测（Quiz 域接入）：从概念种子的 selfCheck 生成题库。
// [V7.11.4 修改] 升级为交互式判分训练器：单题作答 → 即时反馈 → 掌握度记入
//   localStorage（pa_concept_quiz_mastery，与 quizTrainer 的 pa_quiz_mastery 机制同构）。
// [V7.11.6 修改] 新增错题集：答错入册（pa_concept_quiz_errors，按题去重）、答对销账、
//   重做错题模式、错题清单视图与清空——复用 quizTrainer 错题集（pa_quiz_errors）的模式。
// 设计借鉴 DDoG「quiz-first」教学法：先自己作答，再看答案与解析。
// getItems/getErrors 等不依赖 DOM（可在 node 契约测试中调用）；renderInto 仅在浏览器调用。
import { Utils } from '../utils.js';
import { CONCEPT_SEEDS } from '../data/conceptSeed.js';

export var CONCEPT_QUIZ_VERSION = 3;

var MASTERY_KEY = 'pa_concept_quiz_mastery';
var ERRORS_KEY = 'pa_concept_quiz_errors';

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
function _loadErrors() {
  try { return JSON.parse(localStorage.getItem(ERRORS_KEY)) || []; } catch (e) { return []; }
}
function _saveErrors(list) {
  try { localStorage.setItem(ERRORS_KEY, JSON.stringify(list)); } catch (e) { /* 存储满时静默跳过 */ }
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

  // [V7.11.6 新增] 错题集：答错入册（按题去重，保留最新一次错误答案）、答对销账
  getErrors: function () {
    var byId = {};
    this.getItems().forEach(function (it) { byId[it.id] = it; });
    return _loadErrors()
      .filter(function (e) { return byId[e.id]; })
      .map(function (e) { return { id: e.id, item: byId[e.id], chosen: e.chosen, ts: e.ts }; });
  },

  recordError: function (id, chosen) {
    var list = _loadErrors().filter(function (e) { return e.id !== id; });
    list.push({ id: id, chosen: chosen, ts: new Date().toISOString() });
    _saveErrors(list);
  },

  removeError: function (id) {
    _saveErrors(_loadErrors().filter(function (e) { return e.id !== id; }));
  },

  clearErrors: function () {
    try { localStorage.removeItem(ERRORS_KEY); } catch (e) { /* 忽略 */ }
  },

  resetMastery: function () {
    try { localStorage.removeItem(MASTERY_KEY); } catch (e) { /* 忽略 */ }
    if (this._stage) this._renderQuestion();
  },

  // 交互式训练器：单题作答 → 即时反馈 → 掌握度/错题落库 → 下一题
  renderInto: function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var items = this.getItems();
    var countEl = document.getElementById('conceptQuizCount');
    if (countEl) countEl.textContent = '(' + items.length + ' 题)';
    this._items = items;
    this._el = el;
    el.innerHTML =
      '<div style="color:#8b949e;font-size:0.75em;margin-bottom:6px">题目提炼自 Daily Dose of GTO 对应课程；先自己作答，再看判定与解析。答错的题进入错题集，答对后销账。掌握度与错题保存在本地。</div>' +
      '<div style="margin-bottom:6px">' +
      '<button id="conceptQuizAllBtn" class="btn--mini">练习全部</button> ' +
      '<button id="conceptQuizRedoBtn" class="btn--mini">重做错题 (<span id="conceptQuizRedoCount">0</span>)</button> ' +
      '<button id="conceptQuizReset" class="btn--mini">重置掌握度</button>' +
      '</div>' +
      '<div id="conceptQuizStage"></div>' +
      '<details id="conceptQuizErrorDetails" style="margin-top:8px">' +
      '<summary style="cursor:pointer;color:#d4a853;font-size:0.82em;font-weight:bold">错题集 <span id="conceptQuizErrorCount">(0)</span></summary>' +
      '<div id="conceptQuizErrorList" style="margin-top:6px"></div>' +
      '<div style="margin-top:6px;text-align:right"><button id="conceptQuizErrorClear" class="btn--mini" style="display:none">清空错题</button></div>' +
      '</details>';
    this._stage = el.querySelector('#conceptQuizStage');
    var self = this;
    el.querySelector('#conceptQuizAllBtn').addEventListener('click', function () { self._start('all'); });
    el.querySelector('#conceptQuizRedoBtn').addEventListener('click', function () { self._start('redo'); });
    el.querySelector('#conceptQuizReset').addEventListener('click', function () { self.resetMastery(); });
    el.querySelector('#conceptQuizErrorClear').addEventListener('click', function () { self.clearErrors(); self._refreshErrorBook(); });
    this._start('all');
  },

  _start: function (mode) {
    var errs = this.getErrors();
    if (mode === 'redo') {
      if (!errs.length) { Utils.showToast && Utils.showToast('没有错题——全部掌握！'); return; }
      var errIds = {};
      errs.forEach(function (e) { errIds[e.id] = true; });
      this._queue = this._items.filter(function (it) { return errIds[it.id]; });
      this._mode = 'redo';
    } else {
      this._queue = this._items.slice();
      this._mode = 'all';
    }
    this._pos = 0;
    this._answered = false;
    this._renderQuestion();
    this._refreshErrorBook();
  },

  _renderQuestion: function () {
    if (!this._stage) return;
    var queue = this._queue || [];
    if (!queue.length) {
      this._stage.innerHTML = '<div style="color:#8b949e;font-size:0.8em">暂无题目（概念种子中无 selfCheck）。</div>';
      return;
    }
    if (this._pos >= queue.length) { this._renderSummary(); return; }
    var it = queue[this._pos];
    var self = this;
    var modeLabel = this._mode === 'redo' ? ' · 重做错题' : '';
    var html = '<div style="border:1px solid #1c2f4a;border-radius:6px;padding:8px 10px;background:#0a1524">';
    html += '<div style="color:#8b949e;font-size:0.72em;margin-bottom:3px">第 ' + (this._pos + 1) + ' / ' + queue.length + ' 题' + modeLabel + ' · ' + esc(it.title) + '</div>';
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
    var it = this._queue[this._pos];
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
    // [V7.11.6 新增] 错题入册/销账
    if (correct) this.removeError(it.id);
    else this.recordError(it.id, chosen);
    var fb = this._stage.querySelector('#conceptQuizFeedback');
    fb.style.display = 'block';
    fb.innerHTML = (correct ? '<div style="color:#9fd49f"><b>✓ 正确</b></div>' : '<div style="color:#d49a9a"><b>✗ 错误——正确答案：' + esc(it.answer) + '</b></div>') +
      (it.answerNote ? '<div style="margin-top:2px;color:#a8afba">' + esc(it.answerNote) + '</div>' : '') +
      sourceLine(it.sourceRef);
    var nextBtn = this._stage.querySelector('#conceptQuizNext');
    if (nextBtn) nextBtn.style.display = 'inline-block';
    this._refreshErrorBook();
  },

  // [V7.11.6 新增] 错题集视图：清单 + 计数 + 清空按钮可见性
  _refreshErrorBook: function () {
    if (!this._el) return;
    var errs = this.getErrors();
    var countEl = this._el.querySelector('#conceptQuizErrorCount');
    if (countEl) countEl.textContent = '(' + errs.length + ')';
    var redoEl = this._el.querySelector('#conceptQuizRedoCount');
    if (redoEl) redoEl.textContent = String(errs.length);
    var listEl = this._el.querySelector('#conceptQuizErrorList');
    var clearBtn = this._el.querySelector('#conceptQuizErrorClear');
    if (clearBtn) clearBtn.style.display = errs.length ? 'inline-block' : 'none';
    if (!listEl) return;
    if (!errs.length) {
      listEl.innerHTML = '<div style="color:#8b949e;font-size:0.78em">暂无错题——答错的题会出现在这里，答对后自动销账。</div>';
      return;
    }
    listEl.innerHTML = errs.map(function (e) {
      var html = '<details style="margin:4px 0;border:1px solid #3a2530;border-radius:6px;padding:6px 8px;background:#140b10">';
      html += '<summary style="cursor:pointer;color:#c8ccd0;font-size:0.8em">' + esc(e.item.title) + '</summary>';
      html += '<div style="margin-top:4px;color:#a8afba;font-size:0.78em">';
      html += '<div>' + esc(e.item.question) + '</div>';
      html += '<div style="color:#d49a9a;margin-top:2px">你的答案：' + esc(e.chosen || '（超时未答）') + '</div>';
      html += '<div style="color:#9fd49f">正确答案：' + esc(e.item.answer) + '</div>';
      if (e.item.answerNote) html += '<div style="margin-top:2px">' + esc(e.item.answerNote) + '</div>';
      html += sourceLine(e.item.sourceRef);
      html += '</div></details>';
      return html;
    }).join('');
  },

  _renderSummary: function () {
    var m = _loadMastery();
    var asked = 0, correct = 0;
    this._items.forEach(function (it) {
      var r = m[it.id];
      if (r) { asked += r.asked; correct += r.correct; }
    });
    var pct = asked ? Math.round((correct / asked) * 100) : 0;
    var errs = this.getErrors();
    var self = this;
    var redoLine = this._mode === 'redo'
      ? '<div style="margin-top:2px;color:#c8ccd0;font-size:0.8em">重做后剩余错题 ' + errs.length + ' 道</div>'
      : (errs.length ? '<div style="margin-top:2px;color:#c98f8f;font-size:0.8em">本轮新增错题 ' + errs.length + ' 道——可在「重做错题」中巩固</div>' : '<div style="margin-top:2px;color:#9fd49f;font-size:0.8em">本轮零错题！</div>');
    this._stage.innerHTML =
      '<div style="border:1px solid #1c2f4a;border-radius:6px;padding:10px;background:#0a1524;text-align:center">' +
      '<div style="color:#d4a853;font-size:0.9em;font-weight:bold">本轮完成</div>' +
      '<div style="margin-top:4px;color:#c8ccd0;font-size:0.8em">累计作答 ' + asked + ' 次 · 正确 ' + correct + ' 次 · 正确率 ' + pct + '%</div>' +
      redoLine +
      '<div style="margin-top:8px"><button id="conceptQuizRestart" class="btn--mini">再练一轮</button></div></div>';
    var btn = this._stage.querySelector('#conceptQuizRestart');
    btn.addEventListener('click', function () { self._start(self._mode); });
  },

  init: function () {
    if (typeof document !== 'undefined' && document.getElementById('conceptQuizBody')) {
      this.renderInto('conceptQuizBody');
    }
  },
};
