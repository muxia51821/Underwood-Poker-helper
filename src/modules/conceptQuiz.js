// [V7.11.3 新增] 概念自测（Quiz 域接入）：从概念种子的 selfCheck 生成题库。
// 设计借鉴 DDoG「quiz-first」教学法：先自己作答，再展开核对答案与解析。
// 静态渲染（details 折叠），无判分状态；后续如需判分/错题集再扩展。
// getItems 不依赖 DOM（可在 node 契约测试中调用）；renderInto 仅在浏览器调用。
import { Utils } from '../utils.js';
import { CONCEPT_SEEDS } from '../data/conceptSeed.js';

export var CONCEPT_QUIZ_VERSION = 1;

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
  // 渲染进容器（quiz-first：先自己作答，再展开核对）
  renderInto: function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var items = this.getItems();
    var countEl = document.getElementById('conceptQuizCount');
    if (countEl) countEl.textContent = '(' + items.length + ')';
    var html = '<div style="color:#8b949e;font-size:0.75em;margin-bottom:6px">题目提炼自 Daily Dose of GTO 对应课程；先自己作答，再展开核对。</div>';
    items.forEach(function (it, i) {
      html += '<details style="margin:4px 0;border:1px solid #1c2f4a;border-radius:6px;padding:6px 8px;background:#0a1524">';
      html += '<summary style="cursor:pointer;color:#c8ccd0;font-size:0.8em"><b style="color:#8fb3de">Q' + (i + 1) + '</b> · ' + esc(it.question) + '</summary>';
      html += '<div style="margin-top:4px;color:#a8afba;font-size:0.78em">';
      (it.options || []).forEach(function (opt) { html += '<div>· ' + esc(opt) + '</div>'; });
      html += '<div style="margin-top:4px;color:#9fd49f"><b>答案：' + esc(it.answer) + '</b></div>';
      if (it.answerNote) html += '<div style="margin-top:2px">' + esc(it.answerNote) + '</div>';
      html += '<div style="margin-top:3px;color:#7a8494;font-size:0.95em">概念：' + esc(it.title) + '</div>';
      html += sourceLine(it.sourceRef);
      html += '</div></details>';
    });
    el.innerHTML = html;
  },
  init: function () {
    if (typeof document !== 'undefined' && document.getElementById('conceptQuizBody')) {
      this.renderInto('conceptQuizBody');
    }
  },
};
