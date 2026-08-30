// [V6.9.3] GG 手牌导入模块（从 app.js init 提取）
// [V6.14.0 修改] 支持 Session 关联 + 文件拖拽导入
import { CONSTANTS } from '../constants.js';  // [V7.9.0 新增]
import { Utils } from '../utils.js';
import { Store, HandRepo, SessionRepo } from '../store/store.js';
import { Navigation } from './navigation.js';
import { GGParser } from '../parsers/ggParser.js';
import { buildImportPlan, createOverwritePatch } from './ggImportCoordinator.js';

var ggParsedHands = [];
var _lastImportSummary = null;
var _targetSessionId = null;  // [V6.14.0] 目标 Session ID
// [V7.10.5 新增] 大批量模式：新解析手牌达到阈值时省略逐手勾选 DOM，改用汇总 + 代表样本 + 导入全部
var LARGE_BATCH_THRESHOLD = 500;
var LARGE_BATCH_SAMPLE_COUNT = 100;

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
    // [V7.9.0 修改] 按选择顺序索引装配，不再依赖 FileReader 完成顺序（异步竞态会导致合并顺序不确定）
    var loadedTexts = new Array(txtFiles.length);
    var loaded = 0, failed = 0;
    txtFiles.forEach(function (file, fileIdx) {
      var reader = new FileReader();
      reader.onload = function () {
        loadedTexts[fileIdx] = String(reader.result || '');
        loaded++;
        _checkAllDone();
      };
      reader.onerror = function () {
        loadedTexts[fileIdx] = '';
        failed++;
        Utils.showToast('文件 "' + file.name + '" 读取失败，已跳过。');
        _checkAllDone();
      };
      reader.readAsText(file);
    });
    function _checkAllDone() {
      if (loaded + failed < txtFiles.length) return;
      var allContent = loadedTexts.filter(function (t) { return t && t.trim(); }).join('\n\n');
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
    var parsedResult = GGParser.parseDetailed(raw);
    var totalInText = parsedResult.total;
    var existingReviews = HandRepo.getAll();
    var previewPlan = buildImportPlan(
      parsedResult.hands,
      existingReviews,
      SessionRepo.getAll(),
      { targetSessionId: _targetSessionId, failedCount: parsedResult.failures.length }
    );
    ggParsedHands = previewPlan.parsedHands;
    _lastImportSummary = previewPlan.summary;
    if (!ggParsedHands.length) {
      var failureReasons = parsedResult.failures.slice(0, 3).map(function (failure) {
        return failure.reason;
      }).join('；');
      Utils.showToast('未识别到有效手牌记录，请检查粘贴内容。\n文本中检测到 ' + totalInText + ' 手牌，均解析失败。' + (failureReasons ? '\n原因：' + failureReasons : ''));
      return;
    }
    var newCount = previewPlan.summary.imported;
    var dupCount = previewPlan.summary.duplicates;
    var failedCount = parsedResult.failures.length;
    // [V7.10.5 新增] 大批量判定（新解析手牌达到阈值）
    var isLargeBatch = ggParsedHands.length >= LARGE_BATCH_THRESHOLD;
    var listHtml = '';
    listHtml +=
      '<div style="color:#a8afba;font-size:0.75em;padding:4px 0;margin-bottom:6px">' +
      '文本 ' + totalInText + ' 手 → 成功解析 ' + ggParsedHands.length + ' 手' +
      (failedCount > 0 ? '，<span style="color:#c06060">' + failedCount + ' 手失败</span>' : '') +
      '；其中 ' + dupCount + ' 手已存在</div>';
    if (failedCount > 0) {
      listHtml += '<div style="color:#c06060;font-size:0.7em;margin-bottom:8px">失败原因：' +
        Utils.escapeHtml(parsedResult.failures.slice(0, 3).map(function (failure) { return failure.reason; }).join('；')) +
        (failedCount > 3 ? '；其他失败记录未逐条展开' : '') + '</div>';
    }
    if (newCount > 0 && !isLargeBatch)
      listHtml +=
        '<div style="display:flex;gap:8px;margin-bottom:8px"><button type="button" class="btn--mini gg-sel-all-btn">全选</button><button type="button" class="btn--mini gg-desel-all-btn">取消全选</button></div>';
    // [V7.10.5 新增] 大批量模式说明
    if (isLargeBatch && newCount > 0) {
      listHtml +=
        '<div style="border:1px solid #1e3a5f;border-radius:8px;padding:8px;margin-bottom:8px;font-size:0.75em;color:#cbd5e1">' +
        '⚡ 大批量模式：已省略逐手勾选与逐手覆盖/对比。重复 ' + dupCount + ' 手将自动跳过，点击下方按钮一次性导入全部 <strong>' + newCount + '</strong> 手新手牌。' +
        '<span style="color:#a8afba">如需逐手覆盖/对比，请分小批导入。</span></div>';
    }
    var sampleHands = isLargeBatch ? ggParsedHands.slice(0, LARGE_BATCH_SAMPLE_COUNT) : ggParsedHands;
    sampleHands.forEach(function (h, idx) {
      var profitColor = h.profitBB >= 0 ? '#6baf7e' : '#c06060';
      var profitStr = (h.profitBB >= 0 ? '+' : '') + h.profitBB + ' BB';
      var readOnly = isLargeBatch;  // [V7.10.5 新增] 大批量样本行只读，无勾选/覆盖交互
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
        if (h.duplicateOf && !readOnly) {
          listHtml += '<button class="btn--mini gg-overwrite-btn" data-idx="' + idx + '" style="font-size:0.65em;background:#ea580c;white-space:nowrap">覆盖</button>';
          listHtml += '<button class="btn--mini gg-compare-btn" data-idx="' + idx + '" style="font-size:0.65em;white-space:nowrap">对比</button>';
        } else if (h.duplicateOf) {
          listHtml += '<span style="font-size:0.65em;color:#d4a853;white-space:nowrap">已存在（自动跳过）</span>';
        } else {
          listHtml += '<span style="font-size:0.65em;color:#d4a853;white-space:nowrap">本次文本重复（自动跳过）</span>';
        }
        listHtml += '</div>';
      } else if (readOnly) {
        // [V7.10.5 新增] 大批量代表样本：只读行，无勾选 DOM
        var bgSample = h.isBigLoss
          ? 'background:#2f0a0a;border-left:3px solid #c06060'
          : 'background:#141b24;border-left:3px solid #2a2d35';
        listHtml +=
          '<div class="gg-sample-row" style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;border-radius:8px;' + bgSample + '">';
        listHtml +=
          '<div style="flex:1;min-width:0;font-size:0.7em;color:#cbd5e1;line-height:1.3">';
        listHtml += '<span style="color:' + profitColor + ';font-weight:bold">' + Utils.escapeHtml(profitStr) + '</span> ';
        listHtml += Utils.escapeHtml(h.handId) + ' | ' + Utils.escapeHtml(h.heroCards || '??') + ' vs ' + Utils.escapeHtml(Utils.getOpponentDisplayName(h.opponentId, Store.opponentAliases.get()));
        if (h.opponentCards) listHtml += ' (' + Utils.escapeHtml(h.opponentCards) + ')';
        listHtml += '<br>' + Utils.escapeHtml((h.desc || '').substring(0, 80)) + '&hellip;</div></div>';
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
    if (isLargeBatch && ggParsedHands.length > sampleHands.length) {
      listHtml +=
        '<div style="color:#a8afba;font-size:0.7em;padding:4px 0;text-align:center">…已省略其余 ' + (ggParsedHands.length - sampleHands.length) + ' 手的逐手列表（不影响导入）…</div>';
      if (newCount > 0) {
        listHtml +=
          '<div style="text-align:center;margin:10px 0"><button id="ggImportAllBtn" class="btn btn--accent">📥 导入全部新手牌（' + newCount + ' 手，已排除重复）</button></div>';
      }
    }
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
        HandRepo.update(existingId, createOverwritePatch(h));
        Utils.showToast('已覆盖 ' + h.handId);
        document.getElementById('ggParseBtn').click();
      });
    });
    ggListEl.querySelectorAll('.gg-compare-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderGGComparison(ggParsedHands[parseInt(btn.dataset.idx)]);
      });
    });
    document.getElementById('ggImportSelectedBtn').style.display = (!isLargeBatch && newCount > 0) ? 'block' : 'none';  // [V7.10.5 修改] 大批量模式改用导入全部按钮
    // [V7.10.5 新增] 大批量模式：导入全部新手牌（非重复，无需逐手勾选）
    var ggAllBtn = ggListEl.querySelector('#ggImportAllBtn');
    if (ggAllBtn)
      ggAllBtn.addEventListener('click', function () {
        var toImport = ggParsedHands.filter(function (h) { return !h.isDuplicate; });
        if (!toImport.length) { Utils.showToast('没有可导入的新手牌'); return; }
        Utils.checkStorageQuota(JSON.stringify(toImport).length).then(function (ok) {
          if (!ok) { Utils.showToast('存储空间不足。请先导出备份或清理旧数据后再导入。'); return; }
          _runImport(toImport, ggAllBtn);
        });
      });
  });
  document.getElementById('ggImportSelectedBtn').addEventListener('click', function () {
    var checks = document.querySelectorAll('.gg-import-check:checked');
    if (!checks.length) { Utils.showToast('请至少勾选一手牌'); return; }
    var toImport = [];
    checks.forEach(function (cb) { toImport.push(ggParsedHands[parseInt(cb.dataset.idx)]); });
    // [V7.7.2 修改] 异步检测 IndexedDB 配额
    Utils.checkStorageQuota(JSON.stringify(toImport).length).then(function (ok) {
      if (!ok) { Utils.showToast('存储空间不足。请先导出备份或清理旧数据后再导入。'); return; }
      _runImport(toImport, document.getElementById('ggImportSelectedBtn'));
    });
  });
  // [V7.10.5 重构] 导入执行统一入口：小批量（勾选）与大批量（导入全部）共用；sourceBtn 用于写入期间的按钮态
  function _runImport(toImport, sourceBtn) {
    var existingReviews = HandRepo.getAll();
    var existingSessions = SessionRepo.getAll();
    var plan = buildImportPlan(toImport, existingReviews, existingSessions, {
      targetSessionId: _targetSessionId,
      failedCount: _lastImportSummary ? _lastImportSummary.failed : 0,
    });
    if (!plan.valid) {
      Utils.showToast(plan.error || '导入目标无效，未写入任何数据。');
      return;
    }
    if (!plan.records.length) {
      Utils.showToast('没有可导入的新手牌，未写入任何数据。');
      return;
    }
    // [V7.7.2 修改] 统一由导入计划一次性生成并写入记录，避免两套字段映射漂移。
    HandRepo.saveAll(existingReviews.concat(plan.records));
    var persisted = [HandRepo.persistNow()];  // [V7.9.0 修改] 落库确认制
    // [V7.10.5 修复] plan 聚合会更新匹配 Session（自动分组）与目标 Session 的 hands/profit：
    // 此前仅 newSessions > 0 时保存，导入命中既有 Session 后手牌落库而 Session 汇总不持久化。只要导入了手牌就必须保存 Session 并等待落库。
    SessionRepo.saveAll(plan.sessions);
    persisted.push(SessionRepo.persistNow());
    // [V7.9.0 新增] 等待存储真正写入后再提示成功，消除"toast 已显示但数据未落盘"的丢失窗口
    // （真实语料压测：43,680 手的 IndexedDB 写事务约需 30 秒，窗口内关闭页面会静默丢失）
    var importBtn = sourceBtn || document.getElementById('ggImportSelectedBtn');
    var importBtnLabel = importBtn.textContent;
    importBtn.disabled = true;
    importBtn.textContent = '写入存储中…';
    Promise.all(persisted).then(function (results) {
      importBtn.disabled = false;
      importBtn.textContent = importBtnLabel;
      document.getElementById('ggImportOverlay').classList.remove('is-active');
      var targetText = _targetSessionId
        ? ' 手牌到 Session'
        : '手牌，分配到 ' + new Set(plan.sessionMappings.map(function (mapping) { return mapping.session.id; })).size + ' 个 Session' +
          (plan.summary.newSessions > 0 ? '（其中 ' + plan.summary.newSessions + ' 个为新建）' : '');
      var suffix = '';
      var writeFailed = results.some(function (r) { return !r || r.ok === false; });
      if (writeFailed) {
        suffix = '\n⚠️ 部分数据未能写入存储，请立即在"迁移"中导出备份。';
      } else if (JSON.stringify(plan.records).length > CONSTANTS.LOCAL_BACKUP_SAFE_CHARS) {
        suffix = '\n提示：数据量已超过本地备份容量，请定期在"迁移"中导出备份。';
      }
      Utils.showToast('成功导入 ' + plan.records.length + ' ' + targetText + '。' + suffix);
      _targetSessionId = null;
      Navigation.refreshReview('all');
      Navigation.goToReviewSubtab('hand', { resetPage: true });
    });
  }
  // [V6.14.0] 设置文件拖拽
  _setupFileDrop();
}
