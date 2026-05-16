// [V6.9.3] GG 手牌导入模块（从 app.js init 提取）
// [V6.14.0 修改] 支持 Session 关联 + 文件拖拽导入
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { Store, HandRepo, SessionRepo } from '../store/store.js';
import { Review } from './review.js';

var ggParsedHands = [];
var _targetSessionId = null;  // [V6.14.0] 目标 Session ID

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
    '<div style="color:#5a9e8f;font-weight:bold;margin-bottom:8px">&#x1F50D; 手牌对比: ' +
    Utils.escapeHtml(parsedHand.handId) +
    '</div>';
  html +=
    '<button class="btn--mini" id="ggCompareBackBtn" style="margin-bottom:8px">&#x2190; 返回列表</button>';
  html +=
    '<table style="width:100%;font-size:0.7em;border-collapse:collapse"><thead><tr><th style="width:25%;padding:4px;border-bottom:1px solid #373b44;color:#a8afba;text-align:left">字段</th><th style="width:37%;padding:4px;border-bottom:1px solid #373b44;color:#c06060;text-align:left">旧记录 (已存在)</th><th style="width:38%;padding:4px;border-bottom:1px solid #373b44;color:#6baf7e;text-align:left">新数据 (GG导入)</th></tr></thead><tbody>';
  fields.forEach(function (f) {
    var oldStr = String(f.old);
    var newStr = String(f.new);
    var isDiff = oldStr !== newStr;
    var rowStyle = isDiff ? 'background:rgba(250,204,21,0.08)' : '';
    html += '<tr style="' + rowStyle + '">';
    html += '<td style="padding:4px;border-bottom:1px solid #2a2d35;color:#a8afba">' + Utils.escapeHtml(f.label) + '</td>';
    html += '<td style="padding:4px;border-bottom:1px solid #2a2d35;color:#cbd5e1">' + Utils.escapeHtml(oldStr) + '</td>';
    html += '<td style="padding:4px;border-bottom:1px solid #2a2d35;color:#cbd5e1">' + Utils.escapeHtml(newStr) + (isDiff ? ' &#x26A0;' : '') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<div style="font-size:0.65em;color:#a8afba;margin-top:8px">&#x26A0; 标记项为差异字段。覆盖仅更新牌面/盈亏/对手字段，决策与错误类型保留。</div>';
  var listEl = document.getElementById('ggImportList');
  listEl.replaceChildren(document.createRange().createContextualFragment(html));
  document.getElementById('ggCompareBackBtn').addEventListener('click', function () {
    document.getElementById('ggParseBtn').click();
  });
}

// [V6.14.0 新增] 打开导入覆盖层，指定目标 Session
export function openGGImportForSession(sessionId) {
  _targetSessionId = sessionId;
  document.getElementById('ggImportText').value = '';
  document.getElementById('ggImportList').replaceChildren();
  document.getElementById('ggImportSelectedBtn').style.display = 'none';
  document.getElementById('ggImportOverlay').classList.add('is-active');
}

// [V6.14.0 新增] 快速导入（无指定 Session，自动分组）
export function openGGImportQuick() {
  _targetSessionId = null;  // null 表示自动分 Session
  document.getElementById('ggImportText').value = '';
  document.getElementById('ggImportList').replaceChildren();
  document.getElementById('ggImportSelectedBtn').style.display = 'none';
  document.getElementById('ggImportOverlay').classList.add('is-active');
}

// [V6.14.0 新增] 按 3h 间隔自动分组手牌为 Session
function _autoGroupToSessions(parsedHands) {
  if (!parsedHands.length) return [];
  var sorted = parsedHands.slice().sort(function (a, b) {
    return (a.date || '').localeCompare(b.date || '');
  });
  var groups = [];
  var currentGroup = { hands: [], startTime: null, endTime: null };
  var gapMs = (CONSTANTS.SESSION_GAP_HOURS || 3) * 3600000;
  for (var i = 0; i < sorted.length; i++) {
    var h = sorted[i];
    var ht = h.date ? new Date(h.date.replace(' ', 'T') + ':00') : null;
    var htMs = ht ? ht.getTime() : 0;
    if (!currentGroup.startTime) {
      currentGroup.startTime = ht;
      currentGroup.endTime = ht;
      currentGroup.hands.push(h);
    } else if (htMs - currentGroup.endTime.getTime() <= gapMs) {
      currentGroup.endTime = ht;
      currentGroup.hands.push(h);
    } else {
      groups.push(currentGroup);
      currentGroup = { hands: [h], startTime: ht, endTime: ht };
    }
  }
  if (currentGroup.hands.length) groups.push(currentGroup);
  return groups;
}

// [V6.14.0 新增] 从手牌分组创建/匹配 Session
function _createSessionsFromGroups(groups, existingSessions) {
  var newSessions = [];
  groups.forEach(function (group) {
    var startStr = group.startTime ? group.startTime.toISOString().split('T')[0] : '';
    var hour = group.startTime ? group.startTime.getHours() : 0;
    var period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚间';
    var suggestedName = startStr + ' ' + period;
    // 查找是否有日期匹配的已有 Session
    var matched = null;
    for (var i = 0; i < existingSessions.length; i++) {
      if (existingSessions[i].date === startStr && existingSessions[i].level === 'NL5') {
        matched = existingSessions[i];
        break;
      }
    }
    if (matched) {
      newSessions.push({ session: matched, hands: group.hands });
    } else {
      var newId = Utils.generateUUID();
      var totalProfit = 0, totalHands = 0;
      group.hands.forEach(function (h) { totalProfit += (h.profitBB || 0); totalHands++; });
      var newSess = {
        id: newId,
        date: startStr,
        level: 'NL5',
        duration: Math.max(0.5, Math.round(totalHands * 0.02 * 10) / 10),
        hands: totalHands,
        profit: parseFloat(totalProfit.toFixed(1)),
        tilt: 5,
        mistake: '',
        remark: suggestedName,
      };
      existingSessions.push(newSess);
      newSessions.push({ session: newSess, hands: group.hands });
    }
  });
  return newSessions;
}

// [V6.14.0 新增] 文件拖拽 + 选择导入
function _setupFileDrop() {
  var overlay = document.getElementById('ggImportOverlay');
  var textarea = document.getElementById('ggImportText');
  var fileInput = document.getElementById('ggFileInput');

  function handleFiles(files) {
    if (!files || !files.length) return;
    var txtFiles = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.name.endsWith('.txt')) { txtFiles.push(f); }
      else if (f.name.endsWith('.json')) { Utils.showToast('"' + f.name + '" 为 JSON 备份文件，请使用"迁移 → 导入文件"导入。'); }
      else { Utils.showToast('"' + f.name + '" 格式不支持，仅接受 .txt (GG牌谱) 和 .json 文件。'); }
    }
    if (!txtFiles.length) return;
    // [V6.15.2] 批量读取多个 .txt 文件
    var allContent = '';
    var loaded = 0, failed = 0;
    txtFiles.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        allContent += reader.result + '\n\n';
        loaded++;
        _checkAllDone();
      };
      reader.onerror = function () {
        failed++;
        Utils.showToast('文件 "' + file.name + '" 读取失败，已跳过。');
        _checkAllDone();
      };
      reader.readAsText(file);
    });
    function _checkAllDone() {
      if (loaded + failed < txtFiles.length) return;
      if (!allContent.trim()) {
        Utils.showToast('所有文件均读取失败或无有效内容。');
        return;
      }
      textarea.value = allContent;
      document.getElementById('ggParseBtn').click();
    }
  }

  // 拖拽事件
  var dropZone = document.getElementById('ggDropZone');
  if (!dropZone) return;
  ['dragenter', 'dragover'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('gg-drop-active');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('gg-drop-active');
    });
  });
  dropZone.addEventListener('drop', function (e) {
    handleFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', function () {
    fileInput.click();
  });
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      handleFiles(e.target.files);
      fileInput.value = '';
    });
  }
}

export function initGGImport() {
  // [V6.14.0 修改] 改为调用 openGGImportQuick
  var importBtn = document.getElementById('importGGBtn');
  if (importBtn) {
    importBtn.addEventListener('click', function () {
      openGGImportQuick();
    });
  }
  document.getElementById('ggImportCloseBtn').addEventListener('click', function () {
    document.getElementById('ggImportOverlay').classList.remove('is-active');
  });
  document.getElementById('ggParseBtn').addEventListener('click', function () {
    var raw = document.getElementById('ggImportText').value.trim();
    if (!raw) {
      Utils.showToast('请先粘贴 GG 手牌历史文本');
      return;
    }
    var totalInText = (raw.match(/Poker Hand #/g) || []).length;
    ggParsedHands = Utils.parseGGHandHistory(raw);
    if (!ggParsedHands.length) {
      Utils.showToast('未识别到有效手牌记录，请检查粘贴内容。\n文本中检测到 ' + totalInText + ' 手牌，均解析失败。');
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
      '<div style="color:#a8afba;font-size:0.75em;padding:4px 0;margin-bottom:6px">' +
      '文本 ' + totalInText + ' 手 → 成功解析 ' + ggParsedHands.length + ' 手' +
      (failedCount > 0 ? '，<span style="color:#c06060">' + failedCount + ' 手失败</span>' : '') +
      '；其中 ' + dupCount + ' 手已存在</div>';
    if (newCount > 0)
      listHtml +=
        '<div style="display:flex;gap:8px;margin-bottom:8px"><button type="button" class="btn--mini gg-sel-all-btn">全选</button><button type="button" class="btn--mini gg-desel-all-btn">取消全选</button></div>';
    ggParsedHands.forEach(function (h, idx) {
      var profitColor = h.profitBB >= 0 ? '#6baf7e' : '#c06060';
      var profitStr = (h.profitBB >= 0 ? '+' : '') + h.profitBB + ' BB';
      if (h.isDuplicate) {
        var bg = 'background:#141b24;border-left:3px solid #d4a853';
        listHtml +=
          '<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;' + bg + '">';
        listHtml +=
          '<span style="background:#d4a853;color:#141b24;font-size:0.65em;font-weight:bold;padding:2px 6px;border-radius:4px;white-space:nowrap">&#x26A0;&#xFE0F; 已存在</span>';
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
          ? 'background:#2f0a0a;border-left:3px solid #c06060'
          : 'background:#141b24;border-left:3px solid #2a2d35';
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
          ggId: h.handId, oId: h.opponentId, oCards: h.opponentCards, oHash: h.oHash || Utils.normalizeOpponentName(h.opponentId),
          rake: h.rake || 0, jackpot: h.jackpot || 0,  // [V6.13.0]
        });
        Utils.showToast('已覆盖 ' + h.handId);
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
    if (!checks.length) { Utils.showToast('请至少勾选一手牌'); return; }
    var toImport = [];
    checks.forEach(function (cb) { toImport.push(ggParsedHands[parseInt(cb.dataset.idx)]); });
    var estSize = JSON.stringify(toImport).length;
    if (!Utils.checkStorageQuota(estSize)) {
      Utils.showToast('存储空间不足（接近 ' + CONSTANTS.MAX_STORAGE_MB + 'MB 上限）。请先导出备份或清理旧数据后再导入。');
      return;
    }
    var existingReviews = HandRepo.getAll();
    var existingSessions = SessionRepo.getAll();
    var importCount = 0;
    var targetSid = _targetSessionId;  // [V6.14.0]

    if (targetSid) {
      // 导入到指定 Session
      toImport.forEach(function (h) {
        var r = {
          id: Utils.generateUUID(), sessionId: targetSid, date: h.date, potType: h.potType,
          board: h.board, desc: h.desc, decision: '', mistake: '',
          reflection:
            h.profitBB != null && h.profitBB !== 0
              ? (h.profitBB > 0 ? '盈利：+' + h.profitBB + ' BB' : '亏损：' + h.profitBB + ' BB')
              : '',
          pBB: h.profitBB != null ? h.profitBB : null,
          gg: true, ggId: h.handId, oId: h.opponentId, oCards: h.opponentCards, oHash: h.oHash || Utils.normalizeOpponentName(h.opponentId),
          rake: h.rake || 0, jackpot: h.jackpot || 0,
        };
        existingReviews.push(r);
        importCount++;
      });
      HandRepo.saveAll(existingReviews);
      document.getElementById('ggImportOverlay').classList.remove('is-active');
      Utils.showToast('成功导入 ' + importCount + ' 手牌到 Session！');
    } else {
      // [V6.14.0] 自动分 Session
      var groups = _autoGroupToSessions(toImport);
      var sessionMappings = _createSessionsFromGroups(groups, existingSessions);
      sessionMappings.forEach(function (mapping) {
        mapping.hands.forEach(function (h) {
          var r = {
            id: Utils.generateUUID(), sessionId: mapping.session.id, date: h.date, potType: h.potType,
            board: h.board, desc: h.desc, decision: '', mistake: '',
            reflection:
              h.profitBB != null && h.profitBB !== 0
                ? (h.profitBB > 0 ? '盈利：+' + h.profitBB + ' BB' : '亏损：' + h.profitBB + ' BB')
                : '',
            pBB: h.profitBB != null ? h.profitBB : null,
            gg: true, ggId: h.handId, oId: h.opponentId, oCards: h.opponentCards, oHash: h.oHash || Utils.normalizeOpponentName(h.opponentId),
            rake: h.rake || 0, jackpot: h.jackpot || 0,
          };
          existingReviews.push(r);
          importCount++;
        });
        // 新建的 Session 写入 SessionRepo
        if (!existingSessions.some(function (s) { return s.id === mapping.session.id; })) {
          SessionRepo.saveAll(existingSessions);
        }
      });
      HandRepo.saveAll(existingReviews);
      document.getElementById('ggImportOverlay').classList.remove('is-active');
      var newSessionCount = sessionMappings.filter(function (m) {
        return !existingSessions.some(function (s) { return s.id === m.session.id && s._wasExisting; });
      }).length;
      Utils.showToast('成功导入 ' + importCount + ' 手牌，分配到 ' + sessionMappings.length + ' 个 Session' + (newSessionCount > 0 ? '（其中 ' + newSessionCount + ' 个为新建）' : '') + '。');
    }
    _targetSessionId = null;
    Review.handCurrentPage = 1;
    Review.renderHandReviews();
    Review.renderSessions();
    Review.updateTotalStats();
  });
  // [V6.14.0] 设置文件拖拽
  _setupFileDrop();
}
