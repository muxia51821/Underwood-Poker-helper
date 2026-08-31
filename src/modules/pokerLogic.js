// [V7.11.0 新增] 复盘牌理参考渲染：单手牌命中 spot 时输出牌理链卡片（只读，折叠式）。
// 纪律：卡片是"怎么想"的框架与机制参照；来源频率绝不与当前手牌做差值；证据只列来源与边界。
import { matchHandSpot } from './spotMatcher.js';
import { POKER_LOGIC_SEEDS } from '../data/pokerLogicSeed.js';
import { EvidencePackRepo } from '../store/store.js';

function esc(s) { return String(s == null ? '' : s); }

function evidenceLine(refId, packs) {
  const pack = (packs || []).find((p) => p.id === refId);
  if (!pack) return '<div style="color:#8b949e;font-size:0.92em">· 证据未找到（' + esc(refId) + '）</div>';
  return '<div style="font-size:0.92em;color:#a8afba;margin:3px 0">· <a href="' + esc(pack.sourceRef || '#') + '" target="_blank" rel="noopener" style="color:#7ab3ff">' + esc(pack.title || pack.id) + '</a>' +
    (pack.transferBoundary ? ' —— 边界：' + esc(pack.transferBoundary) : '') + '</div>';
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

    html += '<div style="margin-bottom:7px"><b style="color:#8fb3de">① 范围合法性</b><br>' + esc(seed.rangeStory) + '</div>';

    if (seed.lineNotes && seed.lineNotes.length) {
      html += '<div style="margin-bottom:7px"><b style="color:#8fb3de">② 这条线在说什么</b>';
      seed.lineNotes.forEach((ln) => { html += '<div style="margin-top:3px">· <b>' + esc(ln.line) + '</b>：' + esc(ln.note) + '</div>'; });
      html += '</div>';
    }

    if (seed.streetEffect) {
      html += '<div style="margin-bottom:7px"><b style="color:#8fb3de">③ ' + (match.street === 'river' ? '这张河牌改变了什么' : '牌面改变了什么') + '</b>';
      if (typeof seed.streetEffect === 'string') html += '<br>' + esc(seed.streetEffect);
      else {
        if (match.riverType) {
          html += '<div style="margin-top:3px"><b>' + (match.riverType === 'scary' ? '本手牌为惊悚河牌' : '本手牌为空白河牌') + '</b>：' + esc(seed.streetEffect[match.riverType] || '') + '</div>';
        }
        html += '<div style="margin-top:3px;color:#8b949e">· 惊悚：' + esc(seed.streetEffect.scary || '') + '</div>';
        html += '<div style="color:#8b949e">· 空白：' + esc(seed.streetEffect.blank || '') + '</div>';
      }
      html += '</div>';
    }

    if (seed.deviation) {
      html += '<div style="margin-bottom:7px"><b style="color:#8fb3de">④ 如果你的频率偏离</b>' +
        '<div style="margin-top:3px">· 偏低：' + esc(seed.deviation.low || '') + '</div>' +
        '<div style="margin-top:3px">· 偏高：' + esc(seed.deviation.high || '') + '</div>' +
        '<div style="margin-top:3px;color:#8b949e">频率对照请回 Decision Radar 的对应信号卡（那里用你自己的样本基线），本卡只提供解读框架。</div></div>';
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
