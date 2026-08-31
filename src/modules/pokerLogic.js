// [V7.11.1 修改] 复盘牌理参考渲染：单手牌命中 spot 时输出牌理链卡片（只读，折叠式）。
// [V7.11.2 修改] v3 渲染：每步 = 导航语 + 应用要点（CONCEPT_APPLICATIONS，带出处）+ 概念卡；
//   概念卡新增 对比例 / 阈值 / 自测题（嵌套 <details> 折叠，quiz-first：先想再看答案）。
// 牌理机制文本只来自概念域（提炼自权威来源，附出处），本文件不自写牌理。
// 纪律：卡片是"怎么想"的框架与机制参照；来源频率绝不与当前手牌做差值；证据只列来源与边界。
import { matchHandSpot } from './spotMatcher.js';
import { POKER_LOGIC_SEEDS } from '../data/pokerLogicSeed.js';
import { CONCEPT_SEEDS, CONCEPT_APPLICATIONS } from '../data/conceptSeed.js';
import { Utils } from '../utils.js';
import { EvidencePackRepo } from '../store/store.js';

// [V7.11.1 修改] esc 必须是真转义（V7.11.0 的纯 String() 写法违反 AGENTS.md「用户数据进 HTML 前 escapeHtml」）：
// 浏览器环境走 Utils.escapeHtml；契约测试在 node 无 document，退化为语义等价的纯 JS 转义
// （& < >，与 Utils.escapeHtml 的 textContent→innerHTML 语义一致）。
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
  return '<div style="margin-top:2px;color:#7a8494;font-size:0.95em">来源：DDoG 第' + esc(ref.chapter) + '章《' + esc(ref.lesson) +
    '》阅读器页 ' + esc(ref.readerPages) + (ref.extraction ? ' · ' + esc(ref.extraction) : '') + '</div>';
}

// [V7.11.4 修改] href 协议白名单（review 旧账）：只允许 http/https，防止 javascript: 注入
function _safeExternalUrl(value) {
  if (!value) return '';
  try {
    var u = new URL(String(value));
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
  } catch (e) { return ''; }
}

function evidenceLine(refId, packs) {
  const pack = (packs || []).find((p) => p.id === refId);
  if (!pack) return '<div style="color:#8b949e;font-size:0.92em">· 证据未找到（' + esc(refId) + '）</div>';
  const url = _safeExternalUrl(pack.sourceRef);
  const link = url
    ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="color:#7ab3ff">' + esc(pack.title || pack.id) + '</a>'
    : esc(pack.title || pack.id);
  return '<div style="font-size:0.92em;color:#a8afba;margin:3px 0">· ' + link +
    (pack.transferBoundary ? ' —— 边界：' + esc(pack.transferBoundary) : '') + '</div>';
}

// [V7.11.2 新增] 应用要点：该格的一条可核验要点 + 出处
function applicationLine(appId) {
  const a = CONCEPT_APPLICATIONS.find((x) => x.id === appId);
  if (!a) return '<div style="color:#8b949e;font-size:0.92em">· 应用条目未找到（' + esc(appId) + '）</div>';
  return '<div style="margin:5px 0 2px;padding:5px 8px;border-left:3px solid #2e5e9e;background:#0d1930">· ' + esc(a.text) + sourceLine(a.sourceRef) + '</div>';
}

// [V7.11.2 修改] 概念卡：机制 + 误解 + 边界 + 对比例 + 阈值 + 自测题（quiz-first，答案折叠）
function conceptLine(conceptId) {
  const c = CONCEPT_SEEDS.find((x) => x.id === conceptId);
  if (!c) return '<div style="color:#8b949e;font-size:0.92em">· 概念未找到（' + esc(conceptId) + '）</div>';
  let html = '<div style="margin:6px 0 2px;padding:6px 8px;border:1px solid #1c2f4a;border-radius:6px;background:#0a1524">';
  html += '<b style="color:#d4a853">' + esc(c.title) + '</b>';
  html += '<div style="margin-top:3px">' + esc(c.mechanism) + '</div>';
  if (c.misconception) html += '<div style="margin-top:3px;color:#c98f8f">⚠ 常见误解：' + esc(c.misconception) + '</div>';
  (c.contrastExamples || []).forEach((ex) => {
    html += '<div style="margin-top:3px;padding-left:8px;border-left:2px solid #3a5a8a;color:#b8c0cc">⚖ ' + esc(ex.text) + sourceLine(ex.sourceRef) + '</div>';
  });
  (c.thresholds || []).forEach((t) => {
    html += '<div style="margin-top:3px;padding-left:8px;border-left:2px solid #8a6a2a;color:#c8c2a8">📐 ' + esc(t.text) + sourceLine(t.sourceRef) + '</div>';
  });
  if (c.selfCheck && c.selfCheck.question) {
    html += '<details style="margin-top:4px"><summary style="cursor:pointer;color:#8fb3de">❓ 考考自己（先想再看答案）：' + esc(c.selfCheck.question) + '</summary>';
    html += '<div style="margin-top:3px;color:#a8afba">';
    (c.selfCheck.options || []).forEach((opt) => { html += '<div>· ' + esc(opt) + '</div>'; });
    html += '</div>';
    html += '<div style="margin-top:3px;color:#9fd49f"><b>答案：' + esc(c.selfCheck.answer) + '</b></div>';
    if (c.selfCheck.answerNote) html += '<div style="margin-top:2px;color:#a8afba">' + esc(c.selfCheck.answerNote) + '</div>';
    html += sourceLine(c.selfCheck.sourceRef);
    html += '</details>';
  }
  if (c.applicability) html += '<div style="margin-top:3px;color:#8b949e">适用边界：' + esc(c.applicability) + '</div>';
  html += sourceLine(c.sourceRef);
  html += '</div>';
  return html;
}

// [V7.11.2 修改] 四步 = 导航语 + 应用要点 + 概念卡
function stepBlock(label, step) {
  if (!step) return '';
  let html = '<div style="margin-bottom:7px"><b style="color:#8fb3de">' + label + '</b><div style="margin-top:2px">' + esc(step.note || '') + '</div>';
  (step.applicationIds || []).forEach((id) => { html += applicationLine(id); });
  (step.conceptIds || []).forEach((id) => { html += conceptLine(id); });
  html += '</div>';
  return html;
}

export var PokerLogic = {
  // 返回牌理参考 HTML；未命中 spot 返回 ''（调用方直接拼接）
  renderForHand: function (hand) {
    let match = null;
    try { match = matchHandSpot(hand); } catch (e) { return ''; }
    if (!match) return '';
    const seed = POKER_LOGIC_SEEDS.find((s) => s.id === match.spotId);
    if (!seed) return '';
    const packs = EvidencePackRepo.getAll ? EvidencePackRepo.getAll() : [];

    let html = '<details class="poker-logic-box" style="border:1px solid #1e3a5f;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#0d1a2e">';
    html += '<summary style="cursor:pointer;color:#d4a853;font-size:0.82em;font-weight:bold">📚 牌理参考：' + esc(seed.title) +
      (match.street === 'river' ? '（河牌' + (match.riverType === 'scary' ? ' · 惊悚' : match.riverType === 'blank' ? ' · 空白' : '') + (match.line ? ' · 线 ' + esc(match.line) : '') + '）' : '') + '</summary>';
    html += '<div style="margin-top:8px;color:#c8ccd0;font-size:0.78em;line-height:1.65">';

    html += stepBlock('① 范围合法性', seed.steps && seed.steps.scope);
    html += stepBlock('② 线语义', seed.steps && seed.steps.lines);
    html += stepBlock('③ ' + (match.street === 'river' ? '这张河牌改变了什么' : '牌面改变了什么'), seed.steps && seed.steps.streets);
    html += stepBlock('④ 如果你的频率偏离', seed.steps && seed.steps.deviation);
    if (seed.steps && seed.steps.deviation) {
      html += '<div style="margin:-4px 0 7px;color:#8b949e">频率对照请回 Decision Radar 的对应信号卡（那里用你自己的样本基线），本卡只提供解读框架。</div>';
    }

    if (seed.evidenceRefs && seed.evidenceRefs.length) {
      html += '<div style="margin-bottom:4px"><b style="color:#8fb3de">⑤ 机制参照（来源与边界）</b>';
      seed.evidenceRefs.forEach((refId) => { html += evidenceLine(refId, packs); });
      html += '</div>';
    }

    if (seed.boundary) {
      html += '<div style="color:#8b949e;font-size:0.92em;margin-top:4px">⚠️ ' + esc(seed.boundary) + '</div>';
    }
    html += '</div></details>';
    return html;
  },
};
