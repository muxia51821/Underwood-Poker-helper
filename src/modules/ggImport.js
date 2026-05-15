// [V6.9.3] GG 手牌导入模块（从 app.js init 提取）
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { Store, HandRepo } from '../store/store.js';
import { Review } from './review.js';

var ggParsedHands = [];

function renderGGComparison(parsedHand) {
  var ex = parsedHand.duplicateOf;
  var fields = [
    { label: '日期', old: ex.date || '--', new: parsedHand.date || '--' },
    { label: '底池类型', old: ex.potType || '--', new: parsedHand.potType || '--' },
    { label: '牌面结构', old: ex.board || '--', new: parsedHand.board || '--' },
    { label: '盈亏 (BB)', old: ex.pBB != null ? ex.pBB : '--', new: parsedHand.profitBB },
    { label: 'GG手牌号', old: ex.ggId || '--', new: parsedHand.handId || '--' },
    { label: '对手ID', old: ex.oId || '--', new: parsedHand.opponentId || '--' },
    { label: '对手手牌', old: ex.oCards || '--', new: parsedHand.opponentCards || '--' },
    { label: '决策', old: ex.decision || '(空)', new: '-' },
    { label: '错误类型', old: ex.mistake || '(空)', new: '-' },
    {
      label: '反思',
      old: ex.reflection || '(空)',
      new:
        parsedHand.profitBB != null && parsedHand.profitBB !== 0
          ? parsedHand.profitBB > 0
            ? '盈利：+' + parsedHand.profitBB + ' BB'
            : '亏损：' + parsedHand.profitBB + ' BB'
          : '(空)',
    },
  ];
  var html = '';
  html +=
    '<div style="color:#f97316;font-weight:bold;margin-bottom:8px">&#x1F50D; 手牌对比: ' +
    Utils.escapeHtml(parsedHand.handId) +
    '</div>';
  html +=
    '<button class="btn--mini" id="ggCompareBackBtn" style="margin-bottom:8px">&#x2190; 返回列表</button>';
  html +=
    '<table style="width:100%;font-size:0.7em;border-collapse:collapse"><thead><tr><th style="width:25%;padding:4px;border-bottom:1px solid #475569;color:#94a3b8;text-align:left">字段</th><th style="width:37%;padding:4px;border-bottom:1px solid #475569;color:#f87171;text-align:left">旧记录 (已存在)</th><th style="width:38%;padding:4px;border-bottom:1px solid #475569;color:#4ade80;text-align:left">新数据 (GG导入)</th></tr></thead><tbody>';
  fields.forEach(function (f) {
    var oldStr = String(f.old);
    var newStr = String(f.new);
    var isDiff = oldStr !== newStr;
    var rowStyle = isDiff ? 'background:rgba(250,204,21,0.08)' : '';
    html += '<tr style="' + rowStyle + '">';
    html += '<td style="padding:4px;border-bottom:1px solid #334155;color:#94a3b8">' + Utils.escapeHtml(f.label) + '</td>';
    html += '<td style="padding:4px;border-bottom:1px solid #334155;color:#cbd5e1">' + Utils.escapeHtml(oldStr) + '</td>';
    html += '<td style="padding:4px;border-bottom:1px solid #334155;color:#cbd5e1">' + Utils.escapeHtml(newStr) + (isDiff ? ' &#x26A0;' : '') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<div style="font-size:0.65em;color:#64748b;margin-top:8px">&#x26A0; 标记项为差异字段。覆盖仅更新牌面/盈亏/对手字段，决策与错误类型保留。</div>';
  var listEl = document.getElementById('ggImportList');
  listEl.replaceChildren(document.createRange().createContextualFragment(html));
  document.getElementById('ggCompareBackBtn').addEventListener('click', function () {
    document.getElementById('ggParseBtn').click();
  });
}

export function initGGImport() {
  document.getElementById('importGGBtn').addEventListener('click', function () {
    document.getElementById('ggImportText').value = '';
    document.getElementById('ggImportList').replaceChildren();
    document.getElementById('ggImportSelectedBtn').style.display = 'none';
    document.getElementById('ggImportOverlay').classList.add('is-active');
  });
  document.getElementById('ggImportCloseBtn').addEventListener('click', function () {
    document.getElementById('ggImportOverlay').classList.remove('is-active');
  });
  document.getElementById('ggParseBtn').addEventListener('click', function () {
    var raw = document.getElementById('ggImportText').value.trim();
    if (!raw) {
      alert('请先粘贴 GG 手牌历史文本');
      return;
    }
    var totalInText = (raw.match(/Poker Hand #/g) || []).length;
    ggParsedHands = Utils.parseGGHandHistory(raw);
    if (!ggParsedHands.length) {
      alert('未识别到有效手牌记录，请检查粘贴内容。\n文本中检测到 ' + totalInText + ' 手牌，均解析失败。');
      return;
    }
    var existingReviews = HandRepo.getAll();
    var existingGGMap = new Map();
    existingReviews.forEach(function (r) {
      if (r.ggId) existingGGMap.set(r.ggId, r);
    });
    ggParsedHands.forEach(function (h) {
      var existing = existingGGMap.get(h.handId);
      if (existing) {
        h.isDuplicate = true;
        h.duplicateOf = existing;
      }
    });
    var newCount = ggParsedHands.filter(function (h) { return !h.isDuplicate; }).length;
    var dupCount = ggParsedHands.length - newCount;

    var failedCount = totalInText - ggParsedHands.length;
    var listHtml = '';
    listHtml +=
      '<div style="color:#94a3b8;font-size:0.75em;padding:4px 0;margin-bottom:6px">' +
      '文本 ' + totalInText + ' 手 → 成功解析 ' + ggParsedHands.length + ' 手' +
      (failedCount > 0 ? '，<span style="color:#f87171">' + failedCount + ' 手失败</span>' : '') +
      '；其中 ' + dupCount + ' 手已存在</div>';
    if (newCount > 0)
      listHtml +=
        '<div style="display:flex;gap:8px;margin-bottom:8px"><button type="button" class="btn--mini gg-sel-all-btn">全选</button><button type="button" class="btn--mini gg-desel-all-btn">取消全选</button></div>';
    ggParsedHands.forEach(function (h, idx) {
      var profitColor = h.profitBB >= 0 ? '#4ade80' : '#f87171';
      var profitStr = (h.profitBB >= 0 ? '+' : '') + h.profitBB + ' BB';
      if (h.isDuplicate) {
        var bg = 'background:#0f172a;border-left:3px solid #facc15';
        listHtml +=
          '<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;' + bg + '">';
        listHtml +=
          '<span style="background:#facc15;color:#0f172a;font-size:0.65em;font-weight:bold;padding:2px 6px;border-radius:4px;white-space:nowrap">&#x26A0;&#xFE0F; 已存在</span>';
        listHtml +=
          '<div style="flex:1;min-width:0;font-size:0.7em;color:#cbd5e1;line-height:1.3">';
        listHtml += '<span style="color:' + profitColor + ';font-weight:bold">' + Utils.escapeHtml(profitStr) + '</span> ';
        listHtml += Utils.escapeHtml(h.handId) + ' | ' + Utils.escapeHtml(h.heroCards || '??') + ' vs ' + Utils.escapeHtml(Utils.getOpponentDisplayName(h.opponentId, Store.opponentAliases.get()));
        if (h.opponentCards) listHtml += ' (' + Utils.escapeHtml(h.opponentCards) + ')';
        listHtml += '<br>' + Utils.escapeHtml((h.desc || '').substring(0, 80)) + '&hellip;</div>';
        listHtml += '<button class="btn--mini gg-overwrite-btn" data-idx="' + idx + '" style="font-size:0.65em;background:#ea580c;white-space:nowrap">覆盖</button>';
        listHtml += '<button class="btn--mini gg-compare-btn" data-idx="' + idx + '" style="font-size:0.65em;white-space:nowrap">对比</button>';
        listHtml += '</div>';
      } else {
        var bg2 = h.isBigLoss
          ? 'background:#2f0a0a;border-left:3px solid #f87171'
          : 'background:#0f172a;border-left:3px solid #334155';
        listHtml +=
          '<label style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;' + bg2 + ';cursor:pointer">';
        listHtml +=
          '<input type="checkbox" class="gg-import-check" data-idx="' + idx + '" style="width:auto;margin:0;flex-shrink:0" ' + (h.isBigLoss ? 'checked' : '') + '>';
        listHtml +=
          '<div style="flex:1;min-width:0;font-size:0.7em;color:#cbd5e1;line-height:1.3">';
        listHtml += '<span style="color:' + profitColor + ';font-weight:bold">' + Utils.escapeHtml(profitStr) + '</span> ';
        listHtml += Utils.escapeHtml(h.handId) + ' | ' + Utils.escapeHtml(h.heroCards || '??') + ' vs ' + Utils.escapeHtml(Utils.getOpponentDisplayName(h.opponentId, Store.opponentAliases.get()));
        if (h.opponentCards) listHtml += ' (' + Utils.escapeHtml(h.opponentCards) + ')';
        listHtml += '<br>' + Utils.escapeHtml((h.desc || '').substring(0, 80)) + '&hellip;</div></label>';
      }
    });
    document.getElementById('ggImportList').replaceChildren(document.createRange().createContextualFragment(listHtml));
    var ggListEl = document.getElementById('ggImportList');
    var ggSelAll = ggListEl.querySelector('.gg-sel-all-btn');
    var ggDeselAll = ggListEl.querySelector('.gg-desel-all-btn');
    if (ggSelAll)
      ggSelAll.addEventListener('click', function () {
        ggListEl.querySelectorAll('.gg-import-check').forEach(function (cb) { cb.checked = true; });
      });
    if (ggDeselAll)
      ggDeselAll.addEventListener('click', function () {
        ggListEl.querySelectorAll('.gg-import-check').forEach(function (cb) { cb.checked = false; });
      });
    ggListEl.querySelectorAll('.gg-overwrite-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = ggParsedHands[parseInt(btn.dataset.idx)];
        var existingId = h.duplicateOf.id;
        if (!confirm('覆盖手牌 ' + h.handId + ' 的牌面/盈亏/对手信息？\n（决策、错误类型、Session关联不受影响）')) return;
        HandRepo.update(existingId, {
          date: h.date, potType: h.potType, board: h.board, desc: h.desc,
          pBB: h.profitBB != null ? h.profitBB : null,
          reflection: h.profitBB != null && h.profitBB !== 0
            ? (h.profitBB > 0 ? '盈利：+' + h.profitBB + ' BB' : '亏损：' + h.profitBB + ' BB') : '',
          ggId: h.handId, oId: h.opponentId, oCards: h.opponentCards,
        });
        alert('已覆盖 ' + h.handId);
        document.getElementById('ggParseBtn').click();
      });
    });
    ggListEl.querySelectorAll('.gg-compare-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderGGComparison(ggParsedHands[parseInt(btn.dataset.idx)]);
      });
    });
    document.getElementById('ggImportSelectedBtn').style.display = newCount > 0 ? 'block' : 'none';
  });
  document.getElementById('ggImportSelectedBtn').addEventListener('click', function () {
    var checks = document.querySelectorAll('.gg-import-check:checked');
    if (!checks.length) { alert('请至少勾选一手牌'); return; }
    var toImport = [];
    checks.forEach(function (cb) { toImport.push(ggParsedHands[parseInt(cb.dataset.idx)]); });
    var estSize = JSON.stringify(toImport).length;
    if (!Utils.checkStorageQuota(estSize)) {
      alert('存储空间不足（接近 ' + CONSTANTS.MAX_STORAGE_MB + 'MB 上限）。请先导出备份或清理旧数据后再导入。');
      return;
    }
    var existingReviews = HandRepo.getAll();
    var importCount = 0;
    toImport.forEach(function (h) {
      var r = {
        id: Utils.generateUUID(), sessionId: null, date: h.date, potType: h.potType,
        board: h.board, desc: h.desc, decision: '', mistake: '',
        reflection:
          h.profitBB != null && h.profitBB !== 0
            ? (h.profitBB > 0 ? '盈利：+' + h.profitBB + ' BB' : '亏损：' + h.profitBB + ' BB')
            : '',
        pBB: h.profitBB != null ? h.profitBB : null,
        gg: true, ggId: h.handId, oId: h.opponentId, oCards: h.opponentCards,
      };
      existingReviews.push(r);
      importCount++;
    });
    HandRepo.saveAll(existingReviews);
    document.getElementById('ggImportOverlay').classList.remove('is-active');
    alert('成功导入 ' + importCount + ' 手牌！请点击手局列表中的 ✎ 编辑按钮逐一手工填写决策描述和结果与反思。');
    Review.handCurrentPage = 1;
    Review.renderHandReviews();
  });
}
