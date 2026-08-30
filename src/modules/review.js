// [V6.9.2] 复盘模块（Session/手局/周级 + 统计 + 图表 + 数据迁徙）
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { Store, SessionRepo, HandRepo, WeeklyRepo, TiltLogRepo } from '../store/store.js';
import { analyze, getStatColor, STAT_TOOLTIPS, STAT_DEFINITIONS } from './statsEngine.js';  // [V6.18.4]
import { Discover } from './discover.js';  // [V7.4.6]
import { GTO_LEGACY_SCOPE } from '../data/strategy/gtoBaseline.js';  // [V7.9.0 新增] 旧 GTO 对照统一标注
import { QuizTrainer } from './quizTrainer.js';  // [V7.4.7]
import { getLearningTarget } from './analysisReadModel.js';
import { openGGImportForSession } from './ggImport.js';  // [V6.14.0]
import { HandPicker } from './handPicker.js';  // [V6.15.0]
import { Navigation } from './navigation.js';  // [V7.7.2]

// [V7.5.1] 位置对抗速查 — 10 种 6-max 对抗策略要点
var POSITION_ADVICE = {
  UTGvsBB: '📌 UTG vs BB（UTG开池，BB防守）\n• UTG范围很窄（约10-12%），翻后不利位置，C-bet频率中等（50-60%），常用1/3-1/2底池。\n• BB防守范围宽，翻后可激进过牌-加注。\n• UTG应多用强牌过牌-加注，弱牌过牌-弃牌。\n• BB面对小注要高频防守，用顶对/听牌过牌-加注。',
  UTGvsBTN: '📌 UTG vs BTN（UTG开池，BTN防守）\n• UTG范围强但翻后不利位置，BTN有位置优势。\n• UTG的C-bet频率较低（40-50%），多用小注，且需更多过牌。\n• BTN防守范围偏强，3-bet多为价值牌，翻后多利用位置偷池。\n• UTG应用强牌过牌-加注惩罚BTN过度诈唬。\n• BTN面对UTG过牌时可用中等牌下注，被过牌-加注时多弃牌。',
  MPvsCO: '📌 MP vs CO（MP开池，CO防守）\n• MP范围中等偏紧（约12-15%），CO范围中等偏宽。\n• 双方位置接近，MP略处劣势。\n• MP应保持较高C-bet频率（约60%），尺寸可1/3-1/2。\n• CO可用宽范围跟注，翻后多利用位置加注施压。',
  COvsBTN: '📌 CO vs BTN（CO开池，BTN防守）\n• CO范围中等偏宽（约20-25%），BTN范围极宽且有位置。\n• BTN可大量3-bet诈唬，因为CO范围较宽。\n• CO面对3-bet需用强牌跟注或4-bet，弱牌弃牌。\n• 翻后CO若未获位置，注意控制底池；BTN应高频持续下注。',
  BTNvsBB: '📌 BTN vs BB（BTN偷盲，BB防守）\n• BTN开池范围极宽（40-50%），翻后有利位置，C-bet频率极高（70-80%），常用1/3底池小注。\n• BB防守范围极宽（几乎任何两张牌），常用过牌-加注反击。\n• BTN可用薄价值下注，被过牌-加注后听牌可继续，弱牌弃。\n• BB面对小注要多跟注，用顶对/听牌激进过牌-加注，混合3-bet诈唬。',
  SBvsBB: '📌 SB vs BB（SB补齐，BB防守）\n• SB已投入0.5BB，翻后最不利位置，避免平跟过多，多用加注或弃牌。\n• SB开池范围应极化（强牌+诈唬），平跟范围窄。\n• BB可利用位置优势，面对SB小注时高频防守，面对SB加注时弃弱牌。\n• 翻后SB宜采用过牌-弃牌或过牌-加注两极策略，避免被动跟注。',
  SBvsBTN: '📌 SB vs BTN（SB防守BTN开池）\n• BTN开池极宽，SB处于最不利位置且已投入0.5BB。\n• SB应紧缩防守范围，多用3-bet或弃牌，避免平跟。\n• SB的3-bet范围应包含价值牌（JJ+、AQ+）和诈唬（如A5s、K6s）。\n• BTN面对SB的3-bet可用宽范围跟注，利用位置偷池。',
  UTGvsCO: '📌 UTG vs CO（UTG开池，CO防守）\n• UTG范围强，CO有位置优势但范围比BTN窄。\n• UTG的C-bet频率略高于UTGvsBTN（约55%），尺寸偏小。\n• CO可用中等范围跟注，翻后用位置施压。\n• UTG需用顶对以上价值下注，弱牌多过牌。',
  MPvsBTN: '📌 MP vs BTN（MP开池，BTN防守）\n• MP范围中等，BTN有位置优势且范围宽。\n• MP的C-bet频率约60%，需在不利位置控制底池。\n• BTN可频繁3-bet诈唬，尤其当MP范围偏弱时。\n• MP面对3-bet需谨慎，仅用强牌继续。',
  COvsBB: '📌 CO vs BB（CO偷盲，BB防守）\n• CO开池范围较宽（约25%），BB防守极宽。\n• CO有位置优势，C-bet频率高（65-75%）。\n• BB可用宽范围防守，并常用过牌-加注反击。\n• CO被过牌-加注后，听牌可跟注，弱牌弃牌。'
};

// [V7.5.1] 渲染位置对抗速查按钮组
function _renderPosAdviceButtons() {
  var group = document.getElementById('posAdviceGroup');
  if (!group || group.children.length) return;
  var keys = Object.keys(POSITION_ADVICE);
  keys.forEach(function (k) {
    var btn = document.createElement('button');
    btn.className = 'toggle-btn pos-advice-btn';
    btn.textContent = k;
    btn.dataset.adviceKey = k;
    btn.style.cssText = 'font-size:0.8em;padding:3px 8px';
    group.appendChild(btn);
  });
}
function _applyPosAdvice(scenarioKey) {
  var textEl = document.getElementById('posAdviceText');
  var btns = document.querySelectorAll('.pos-advice-btn');
  btns.forEach(function (b) { b.classList.remove('is-active'); });
  if (scenarioKey && POSITION_ADVICE[scenarioKey]) {
    var matched = document.querySelector('.pos-advice-btn[data-advice-key="' + scenarioKey + '"]');
    if (matched) matched.classList.add('is-active');
    if (textEl) textEl.innerHTML = POSITION_ADVICE[scenarioKey].replace(/\n/g, '<br>');
  } else {
    if (textEl) textEl.textContent = '请选择对抗类型查看策略要点。';
  }
}

// [V7.6.0] Monte Carlo 资金波动模拟
function _runMonteCarlo(pBBs, simHands) {
  var n = pBBs.length;
  var rounds = 10000;
  var results = new Array(rounds);
  for (var r = 0; r < rounds; r++) {
    var sum = 0;
    for (var i = 0; i < simHands; i++) {
      sum += pBBs[Math.floor(Math.random() * n)];
    }
    results[r] = sum;
  }
  results.sort(function (a, b) { return a - b; });
  return results;
}
function _renderMonteCarlo() {
  var allHands = HandRepo.getAll();
  var pBBs = [];
  for (var i = 0; i < allHands.length; i++) {
    var v = allHands[i].pBB;
    if (typeof v === 'number' && isFinite(v)) pBBs.push(v);
  }
  if (pBBs.length < 30) {
    var ca = document.getElementById('mcChartArea');
    if (ca) ca.innerHTML = '<div class="text-muted">需要至少 30 手牌数据才能模拟</div>';
    var pel = document.getElementById('mcPercentiles');
    if (pel) pel.innerHTML = '';
    var sel = document.getElementById('mcSummary');
    if (sel) sel.textContent = '';
    return;
  }
  var activeBtn = document.querySelector('.mc-hand-btn.is-active');
  var simHands = activeBtn ? parseInt(activeBtn.dataset.mcHands) : 1000;
  var results = _runMonteCarlo(pBBs, simHands);
  // 直方图 Canvas
  var chartArea = document.getElementById('mcChartArea');
  if (!chartArea) return;
  var canvas = chartArea.querySelector('canvas') || document.createElement('canvas');
  if (!canvas.parentElement) chartArea.appendChild(canvas);
  var W = chartArea.clientWidth || 600;
  var H = 180;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  var minR = results[0], maxR = results[9999];
  var binCount = 30;
  var binWidth = (maxR - minR) / binCount || 1;
  var bins = new Array(binCount);
  for (var b = 0; b < binCount; b++) bins[b] = 0;
  for (var r2 = 0; r2 < 10000; r2++) {
    var bidx = Math.min(binCount - 1, Math.floor((results[r2] - minR) / binWidth));
    bins[bidx]++;
  }
  var maxBin = Math.max.apply(null, bins);
  var pad = { top: 8, right: 8, bottom: 24, left: 50 };
  var pw = W - pad.left - pad.right;
  var ph = H - pad.top - pad.bottom;
  // 零线
  if (minR < 0 && maxR > 0) {
    var zeroX = pad.left + ((0 - minR) / (maxR - minR)) * pw;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(zeroX, pad.top);
    ctx.lineTo(zeroX, pad.top + ph);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 柱子
  for (var b2 = 0; b2 < binCount; b2++) {
    var x = pad.left + (b2 / binCount) * pw;
    var barW = pw / binCount - 1;
    var barH = (bins[b2] / maxBin) * ph;
    var y = pad.top + ph - barH;
    var binCenter = minR + (b2 + 0.5) * binWidth;
    ctx.fillStyle = binCenter >= 0 ? 'rgba(46,160,67,0.7)' : 'rgba(248,81,73,0.7)';
    ctx.fillRect(x, y, barW, barH);
  }
  // X 轴标签
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (var l = 0; l <= 5; l++) {
    var val = minR + (l / 5) * (maxR - minR);
    var lx = pad.left + (l / 5) * pw;
    ctx.fillText(Math.round(val), lx, pad.top + ph + 14);
  }
  // 百分位
  var p5 = results[500], p25 = results[2500], p50 = results[5000], p75 = results[7500], p95 = results[9500];
  var probWin = Math.round(results.filter(function (v) { return v > 0; }).length / 100);
  var pctEl = document.getElementById('mcPercentiles');
  if (pctEl) {
    pctEl.innerHTML = '<div class="stats__item"><div class="stats__label">P5 最差</div><div class="stats__value text-lose">' + Utils.safeFixed(p5, 1) + ' BB</div></div>' +
      '<div class="stats__item"><div class="stats__label">P25 较差</div><div class="stats__value ' + (p25 >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(p25, 1) + ' BB</div></div>' +
      '<div class="stats__item"><div class="stats__label">P50 中位</div><div class="stats__value ' + (p50 >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(p50, 1) + ' BB</div></div>' +
      '<div class="stats__item"><div class="stats__label">P75 较好</div><div class="stats__value ' + (p75 >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(p75, 1) + ' BB</div></div>' +
      '<div class="stats__item"><div class="stats__label">P95 最佳</div><div class="stats__value ' + (p95 >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(p95, 1) + ' BB</div></div>';
  }
  var sumEl = document.getElementById('mcSummary');
  if (sumEl) {
    sumEl.textContent = '按当前赢率，接下来 ' + simHands + ' 手你有 ' + probWin + '% 概率盈利。' + (p50 >= 0 ? ' 中位预期 +' + Utils.safeFixed(p50, 1) + ' BB。' : ' 中位预期 ' + Utils.safeFixed(p50, 1) + ' BB。');
  }
}

// [V7.0.0] 对手统计缓存 — 避免排序/筛选时重复聚合全量手牌
var _oppStatsCache = null;
var _oppStatsCacheLen = -1;

// [V6.15.0] 切换手牌标记状态
function _toggleMarkHand(id, btnEl) {
  var reviews = HandRepo.getAll();
  var found = false;
  reviews.forEach(function (r) {
    if (r.id === id) {
      r.marked = !r.marked;
      found = true;
      if (btnEl) {
        btnEl.textContent = r.marked ? '★' : '☆';
        btnEl.style.color = r.marked ? '#d4a853' : '#a8afba';
      }
    }
  });
  if (found) {
    HandRepo.saveAll(reviews);
    HandPicker.render();
  }
}

// [V6.18.4] 可复用：渲染折叠统计面板 + 点击 tooltip
function _renderStatSection(targetEl, title, keys, es, isPercent) {
  var openAttr = (title === 'Overview') ? ' open' : '';
  var html = '<details class="stats-details"' + openAttr + '><summary class="stats-section-title">' + title + '</summary><div class="stats" style="flex-wrap:wrap">';
  keys.forEach(function (key) {
    var stat = es[key];
    if (!stat) return;
    if (isPercent && stat.type !== 'percent') return;
    var cls = isPercent ? getStatColor(stat.value, key) : (stat.type === 'bb' ? (stat.value >= 0 ? 'text-win' : 'text-lose') : '');
    var prefix = isPercent ? '' : (stat.type === 'bb' ? (stat.value >= 0 ? '+' : '') : '');
    var suffix = isPercent ? '%' : (stat.type === 'percent' ? '%' : (stat.type === 'bb' ? ' BB' : ''));
    html += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + cls + '">' + prefix + Utils.safeFixed(stat.value, 1) + suffix + '</div></div>';
  });
  html += '</div></details>';
  targetEl.insertAdjacentHTML('beforeend', html);
}
// [V6.18.4] 嵌套分组：一个父 details 包裹多个子 details
function _renderNestedGroup(targetEl, parentTitle, groups, es, isPercent) {
  var html = '<details class="stats-details"><summary class="stats-section-title">' + parentTitle + '</summary>';
  groups.forEach(function (g) {
    html += '<details class="stats-details" open><summary class="stats-section-title">' + g.title + '</summary><div class="stats" style="flex-wrap:wrap">';
    g.keys.forEach(function (key) {
      var stat = es[key];
      if (!stat) return;
      if (isPercent && stat.type !== 'percent') return;
      var cls = isPercent ? getStatColor(stat.value, key) : (stat.type === 'bb' ? (stat.value >= 0 ? 'text-win' : 'text-lose') : '');
      var prefix = isPercent ? '' : (stat.type === 'bb' ? (stat.value >= 0 ? '+' : '') : '');
      var suffix = isPercent ? '%' : (stat.type === 'percent' ? '%' : (stat.type === 'bb' ? ' BB' : ''));
      html += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + cls + '">' + prefix + Utils.safeFixed(stat.value, 1) + suffix + '</div></div>';
    });
    html += '</div></details>';
  });
  html += '</details>';
  targetEl.insertAdjacentHTML('beforeend', html);
}
// [V6.18.4] tooltip 事件委托 — 在 Total/Session 统计区统一处理
function _initStatTooltip(containerId) {
  var el = document.getElementById(containerId);
  if (!el || el.dataset.tooltipReady) return;
  el.dataset.tooltipReady = '1';
  el.addEventListener('click', function (e) {
    var item = e.target.closest('[data-stat-key]');
    if (!item) return;
    var key = item.dataset.statKey;
    var stat = STAT_DEFINITIONS[key];
    var name = stat ? stat.name : key;
    var tip = STAT_TOOLTIPS[key] || '暂无说明。';
    var modal = document.getElementById('statTooltip');
    document.getElementById('statTooltipTitle').textContent = name;
    document.getElementById('statTooltipText').textContent = tip;
    modal.style.display = 'flex';
  });
}

// [V6.18.5] 可复用：渲染引擎统计面板（Total/Session/Weekly 共用）
// opts.extraOverviewHtml — 可选，追加到 Overview 网格末尾的 HTML（如 Hands/Hour）
function renderStatsPanel(opts) {
  var el = opts.containerEl;
  var es = opts.es;
  var recs = opts.recs;
  var showExtras = opts.showExtras !== false;
  var overviewKeys = ['totalHands', 'bbPer100', 'profitWithRake', 'bbPer100WithRake'];
  var preflopOpenKeys = ['vpip', 'pfr', 'limp'];
  var vsRaiseKeys = ['threeBet', 'fourBet', 'foldTo3bet', 'foldTo4bet', 'squeeze', 'coldCall'];
  var stealKeys = ['stealAttempt', 'foldToSteal'];
  var pfaKeys = ['cbetFlop', 'cbetTurn', 'cbetRiver', 'wwsfAsPfr', 'wtsdAfterCbet'];
  var pfdKeys = ['foldToCbet', 'raiseCbetFlop', 'donkBetFlop', 'betVsMissedCbet', 'checkRaiseFlop', 'wwsfAsCaller'];
  var sdKeys = ['wtsd', 'wtsdWon', 'wwsf'];
  var aggKeys = ['probeBetTurn', 'afqFlop', 'afqTurn', 'afqRiver'];
  if (showExtras) {
    var rakeHtml = '<div class="stats" style="margin-top:8px">';
    rakeHtml += '<div class="stats__item"><div class="stats__label">Total Rake</div><div class="stats__value" style="color:#c06060">-$' + Utils.safeFixed(es.totalRake.value, 2) + '</div></div>';
    rakeHtml += '<div class="stats__item"><div class="stats__label">Total Jackpot</div><div class="stats__value">$' + Utils.safeFixed(es.totalJackpot.value, 2) + '</div></div>';
    rakeHtml += '<div class="stats__item stats__item--win"><div class="stats__label">Pre-Rake Profit</div><div class="stats__value text-win">' + (es.profitWithRake.value >= 0 ? '+' : '') + Utils.safeFixed(es.profitWithRake.value, 1) + ' BB</div></div>';
    rakeHtml += '<div class="stats__item ' + (es.bbPer100WithRake.value >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100 (Pre-Rake)</div><div class="stats__value ' + (es.bbPer100WithRake.value >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(es.bbPer100WithRake.value, 1) + '</div></div>';
    rakeHtml += '</div>';
    el.insertAdjacentHTML('beforeend', rakeHtml);
    _renderStatSection(el, 'Overview', overviewKeys, es, false);
    if (opts.extraOverviewHtml) {
      // 注入到最后一个 Overview details 的 .stats 网格中
      var overviewGrids = el.querySelectorAll('.stats-details .stats');
      if (overviewGrids.length > 0) {
        overviewGrids[overviewGrids.length - 1].insertAdjacentHTML('beforeend', opts.extraOverviewHtml);
      }
    }
  }
  _renderNestedGroup(el, 'Preflop', [
    { title: 'Preflop Open', keys: preflopOpenKeys },
    { title: 'Vs. Raise', keys: vsRaiseKeys },
    { title: 'Steal Dynamics', keys: stealKeys }
  ], es, true);
  _renderNestedGroup(el, 'Postflop', [
    { title: 'Preflop Aggressor', keys: pfaKeys },
    { title: 'Preflop Defender', keys: pfdKeys },
    { title: 'Showdown Stats', keys: sdKeys },
    { title: 'Aggression by Street', keys: aggKeys }
  ], es, true);
  // [V6.18.9] Position 位置统计
  if (opts.showPosition !== false) {
    var posGroups = { EP: ['UTG', 'UTG+1', 'UTG+2'], MP: ['MP', 'HJ'], CO: ['CO'], BTN: ['BTN'], SB: ['SB'], BB: ['BB'] };
    var posKeys = ['vpip', 'pfr', 'threeBet', 'cbetFlop', 'foldToCbet', 'wtsd', 'wwsf'];
    var posItems = [];
    Object.keys(posGroups).forEach(function (pos) {
      var posHands = HandRepo.getAll().filter(function (h) {
        var m = (h.desc || '').match(/^preflop.*Hero\s+(\w+)\//m);
        return m && posGroups[pos].indexOf(m[1]) !== -1;
      });
      if (posHands.length > 0) {
        var posResult = analyze(posHands);
        var posStats = posResult.stats;
        var posHtml = '<details class="stats-details"><summary class="stats-section-title">' + pos + ' (' + posHands.length + 'h)</summary><div class="stats" style="flex-wrap:wrap">';
        posKeys.forEach(function (key) {
          var stat = posStats[key];
          if (!stat || stat.type !== 'percent') return;
          var colorClass = getStatColor(stat.value, key);
          posHtml += '<div class="stats__item" data-stat-key="' + key + '" style="cursor:pointer"><div class="stats__label">' + stat.name + '</div><div class="stats__value ' + colorClass + '">' + stat.value + '%</div></div>';
        });
        posHtml += '</div></details>';
        posItems.push(posHtml);
      }
    });
    if (posItems.length > 0) {
      var posParentHtml = '<details class="stats-details"><summary class="stats-section-title">Position</summary>' + posItems.join('') + '</details>';
      el.insertAdjacentHTML('beforeend', posParentHtml);
    }
  }
  if (showExtras) {
    var recHtml = '<div class="card" style="margin-top:12px"><div class="card__title">Recommendations</div>';
    if (recs.length === 0) {
      recHtml += '<div class="rec-good">各项指标均在理想范围，继续保持！</div>';
    } else {
      recs.forEach(function (r) { recHtml += '<div class="rec-card">' + r.text + '</div>'; });
    }
    recHtml += '</div>';
    el.insertAdjacentHTML('beforeend', recHtml);
  }
}



// [V7.3.0] 位置利润聚合 — 按 EP/MP/CO/BTN/SB/BB 分组累加 pBB
function _aggregatePositionProfit() {
  var posGroups = { EP: ['UTG', 'UTG+1', 'UTG+2'], MP: ['MP', 'HJ'], CO: ['CO'], BTN: ['BTN'], SB: ['SB'], BB: ['BB'] };
  var result = {};
  Object.keys(posGroups).forEach(function (pos) { result[pos] = { profit: 0, hands: 0 }; });
  var allHands = HandRepo.getAll();
  for (var i = 0; i < allHands.length; i++) {
    var h = allHands[i];
    if (h.pBB == null) continue;
    var m = (h.desc || '').match(/^preflop[^\n]*Hero\s+(\w+)\//m);
    if (!m) continue;
    var heroPos = m[1];
    for (var pos in posGroups) {
      if (posGroups[pos].indexOf(heroPos) !== -1) {
        result[pos].profit += h.pBB;
        result[pos].hands++;
        break;
      }
    }
  }
  return result;
}

export const Review = {
  handEditingId: null,
  _quickCaptureActive: false,
  _quickCaptureOrigin: null,
  _quickCaptureSnapshot: null,
  init() {
    document.getElementById('addSessionBtn').addEventListener('click', () => this.addSession());
    document.getElementById('clearSessionBtn').addEventListener('click', () => this.clearSessionForm());
    document.getElementById('refreshSessionsBtn').addEventListener('click', () => this.renderSessions());
    document.getElementById('filterLevel').addEventListener('change', () => this.renderSessions());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.importData(e));
    document.getElementById('saveHandBtn').addEventListener('click', () => {
      const saved = this.saveHandReview();
      if (saved && this._quickCaptureActive) this.closeQuickCapture('saved');
    });
    // [V7.7.2 新增] Mobile quick capture reuses the existing Hand form and save path.
    document.getElementById('quickCaptureBtn').addEventListener('click', () => this.openQuickCapture());
    document.getElementById('quickCaptureCloseBtn').addEventListener('click', () => this.closeQuickCapture('cancel'));
    document.getElementById('quickCaptureFullBtn').addEventListener('click', () => this.closeQuickCapture('full'));
    document.addEventListener('keydown', (event) => this.handleQuickCaptureKeydown(event));
    // [V6.15.1] 手牌筛选器
    var handPotFilter = document.getElementById('handPotSizeFilter');
    var handSessFilter = document.getElementById('handSessFilter');
    if (handPotFilter) { handPotFilter.addEventListener('change', () => { this.handCurrentPage = 1; this.renderHandReviews(); }); }
    if (handSessFilter) { handSessFilter.addEventListener('change', () => { this.handCurrentPage = 1; this.renderHandReviews(); }); }
    document.getElementById('saveWeeklyBtn').addEventListener('click', () => this.saveWeeklyReview());
    Utils.initDropdown(document.getElementById('migrateBtn'), document.getElementById('migrateMenu'));
    document.getElementById('sessDate').value = Utils.getLocalDate();
    Utils.initToggleGroup('sessMistakeGroup');
    Utils.initToggleGroup('handMistakeGroup');
    // [V7.5.1] 位置对抗速查按钮点击委托
    document.getElementById('reviewPanel').addEventListener('click', function (e) {
      var btn = e.target.closest('.pos-advice-btn');
      if (!btn) return;
      _applyPosAdvice(btn.dataset.adviceKey);
    });
    // [V7.6.0] Monte Carlo 手数切换委托
    document.getElementById('reviewPanel').addEventListener('click', function (e) {
      var btn = e.target.closest('.mc-hand-btn');
      if (!btn) return;
      document.querySelectorAll('.mc-hand-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      _renderMonteCarlo();
    });
    // [V7.6.1] Heatmap 视图切换委托
    document.getElementById('reviewPanel').addEventListener('click', function (e) {
      var btn = e.target.closest('.hm-view-btn');
      if (!btn) return;
      document.querySelectorAll('.hm-view-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      _renderDiscoverHeatmap();
    });
    document.getElementById('sessionBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-delete-id]');
      if (delBtn) this.deleteSession(delBtn.dataset.deleteId);
      const editBtn = e.target.closest('[data-edit-id]');
      if (editBtn) this.editSession(editBtn.dataset.editId);
      const expandBtn = e.target.closest('[data-expand-id]');
      if (expandBtn) { this.toggleSessionExpand(expandBtn.dataset.expandId, expandBtn); this.updateStatsForSession(expandBtn.dataset.expandId); }
      // [V6.18.6] Session 展开区手牌编辑 → 跳转 Hand 面板
      const sessHandEditBtn = e.target.closest('[data-hand-edit]');
      if (sessHandEditBtn) {
        Navigation.goToHand(sessHandEditBtn.dataset.handEdit);
      }
      // [V6.15.0] Session 展开区域内的标记按钮
      const markBtn = e.target.closest('[data-hand-mark]');
      if (markBtn) { _toggleMarkHand(markBtn.dataset.handMark, markBtn); }
    });
    // [V6.15.1] Session 展开区域手牌筛选
    document.getElementById('sessionBody').addEventListener('change', (e) => {
      const sessFilter = e.target.closest('[data-sess-filter]');
      if (sessFilter) {
        var sid = sessFilter.dataset.sessFilter;
        var expandBtn = document.querySelector('[data-expand-id="' + sid + '"]');
        if (expandBtn) {
          // 关闭再重新展开以应用筛选
          var existingRow = document.getElementById('expand-row-' + sid);
          if (existingRow) existingRow.remove();
          expandBtn.textContent = '📋';
          Review.toggleSessionExpand(sid, expandBtn, sessFilter.value);
        }
      }
    });
    document.getElementById('handBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-hand-delete]');
      if (delBtn) this.deleteHandReview(delBtn.dataset.handDelete);
      const editBtn = e.target.closest('[data-hand-edit]');
      if (editBtn) this.editHandReview(editBtn.dataset.handEdit);
      // [V6.15.1] 手牌展开按钮
      const expandBtn = e.target.closest('[data-hand-expand]');
      if (expandBtn) { this.toggleHandExpand(expandBtn.dataset.handExpand, expandBtn); }
      // [V6.15.1] 展开行内的标记按钮
      const expMarkBtn = e.target.closest('[data-hand-mark]');
      if (expMarkBtn && expMarkBtn.dataset.handMark) { _toggleMarkHand(expMarkBtn.dataset.handMark, expMarkBtn); }
    });
    document.getElementById('weeklyBody').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-week-delete]');
      if (delBtn) this.deleteWeeklyReview(delBtn.dataset.weekDelete);
      const editBtn = e.target.closest('[data-week-edit]');
      if (editBtn) this.editWeeklyReview(editBtn.dataset.weekEdit);
    });
    // [V6.5.4] 手局批量操作 — [V6.16.0] 行点击选中替代 checkbox
    document.getElementById('handSelectAllBtn').addEventListener('click', function () {
      var allRows = document.querySelectorAll('#handBody tr[data-hand-id]');
      if (Review._selectedHandIds.size === allRows.length && allRows.length > 0) {
        Review._selectedHandIds.clear();
      } else {
        allRows.forEach(function (row) { Review._selectedHandIds.add(row.dataset.handId); });
      }
      Review._updateHandBatchUI();
    });
    document.getElementById('handBody').addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
      var row = e.target.closest('tr[data-hand-id]');
      if (!row) return;
      var id = row.dataset.handId;
      if (Review._selectedHandIds.has(id)) {
        Review._selectedHandIds.delete(id);
      } else {
        Review._selectedHandIds.add(id);
      }
      Review._updateHandBatchUI();
    });
    document.getElementById('handBatchDelBtn').addEventListener('click', function () {
      if (!Review._selectedHandIds.size) { Utils.showToast('请先点击行选择要删除的手牌'); return; }
      if (!confirm('确定删除选中的 ' + Review._selectedHandIds.size + ' 手牌局？此操作不可恢复。')) return;
      var ids = Review._selectedHandIds;
      var reviews = HandRepo.getAll().filter(function (r) { return !ids.has(r.id); });
      HandRepo.saveAll(reviews);
      Utils.showToast('已删除 ' + ids.size + ' 手牌');
      ids.clear();
      Review.handCurrentPage = 1;
      Review.renderHandReviews();
    });
    document.getElementById('handBatchLinkBtn').addEventListener('click', function () {
      if (!Review._selectedHandIds.size) { Utils.showToast('请先选择手牌'); return; }
      var sid = document.getElementById('handBatchSessionSelect').value;
      if (!sid) { Utils.showToast('请选择目标 Session'); return; }
      if (!confirm('将选中的 ' + Review._selectedHandIds.size + ' 手牌关联到选定 Session？')) return;
      var ids = Review._selectedHandIds;
      var reviews = HandRepo.getAll();
      reviews.forEach(function (r) { if (ids.has(r.id)) r.sessionId = sid; });
      HandRepo.saveAll(reviews);
      ids.clear();
      Review.renderHandReviews();
    });
    var handleHandDescInput = Utils.debounce(function () { Utils.updateHandVisual(); }, 150);
    document.getElementById('handDesc').addEventListener('input', handleHandDescInput);
    // [V6.10.0] 玩家数据分析 → 对手画像跳转按钮
    var gotoBtn = document.getElementById('gotoOpponentBtn');
    if (gotoBtn) gotoBtn.addEventListener('click', function () {
      Navigation.goToReviewSubtab('opponent');
    });
    // [V6.18.4] tooltip 关闭
    var tooltipModal = document.getElementById('statTooltip');
    if (tooltipModal) {
      document.getElementById('statTooltipClose').addEventListener('click', function () {
        tooltipModal.style.display = 'none';
      });
      tooltipModal.addEventListener('click', function (e) {
        if (e.target === tooltipModal) tooltipModal.style.display = 'none';
      });
    }
    // [V6.9.2] tiltLogSaved 事件在 app.js init 中通过 PubSub 绑定
  },
  renderAll() {
    this.renderSessions();
    this.updateTotalStats();
    this.populateHandSessionSelect();
    this.renderHandReviews();
    this.renderWeeklyReviews();
    this.generateWeeklyStats();
    this.renderTiltLogs();
  },
  getSessions() { return SessionRepo.getAll(); },
  saveSessions(s) { SessionRepo.saveAll(s); },
  addSession() {
    const date = document.getElementById('sessDate').value || Utils.getLocalDate(),
      level = document.getElementById('sessLevel').value.trim() || 'NL10',
      dur = parseFloat(document.getElementById('sessDur').value),
      hands = parseInt(document.getElementById('sessHands').value),
      profit = parseFloat(document.getElementById('sessProfit').value),
      tilt = parseInt(document.getElementById('sessTilt').value) || 5,
      remark = document.getElementById('sessRemark').value.trim();
    const btns = document.querySelectorAll('#sessMistakeGroup .toggle-btn.is-active');
    const mistakes = Array.from(btns).map((b) => b.dataset.mistake);
    const custom = document.getElementById('sessMistakeCustom').value.trim();
    if (custom) mistakes.push(custom);
    const mistakeStr = mistakes.join(', ') || '无';
    if (isNaN(dur) || isNaN(hands) || isNaN(profit) || dur <= 0 || hands <= 0) {
      Utils.showToast('请填写有效的时长、手数和盈亏'); return;
    }
    const s = { date, level, duration: dur, hands, profit, tilt, mistake: mistakeStr, remark };
    const sessions = this.getSessions();
    if (this.editingId) {
      const idx = sessions.findIndex(function (x) { return x.id === this.editingId; }.bind(this));
      if (idx !== -1) { s.id = this.editingId; sessions[idx] = s; }
      this.editingId = null;
      document.getElementById('addSessionBtn').textContent = '保存 Session';
      document.getElementById('clearSessionBtn').textContent = '清空表单';
      document.getElementById('addSessionBtn').dataset.state = 'create';
      document.getElementById('sessionDetailPane').classList.remove('is-editing');
    } else {
      s.id = Utils.generateUUID(); sessions.push(s);
    }
    this.saveSessions(sessions);
    var self = this;
    var reviews = HandRepo.getAll();
    var unlinked = reviews.filter(function (r) { return (!r.sessionId || r.sessionId === '') && r.date === s.date; });
    if (unlinked.length > 0 && confirm('有 ' + unlinked.length + ' 手同日期未关联手牌，是否归入本场 Session？')) {
      unlinked.forEach(function (r) { r.sessionId = s.id; });
      HandRepo.saveAll(reviews);
    }
    this.clearSessionForm(); this.renderAll();
  },
  toggleSessionExpand(sessionId, btn, filterVal) {
    var existingRow = document.getElementById('expand-row-' + sessionId);
    if (existingRow) { existingRow.remove(); btn.textContent = '📋'; if (!filterVal) return; }
    btn.textContent = '▲';
    var handReviews = HandRepo.getAll();
    var linked = handReviews.filter(function (r) { return r.sessionId === sessionId; });
    // [V6.15.1] 应用筛选
    filterVal = filterVal || 'all';
    if (filterVal === 'above2') linked = linked.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 2; });
    else if (filterVal === 'above30') linked = linked.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 30; });
    var tr = document.createElement('tr');
    tr.id = 'expand-row-' + sessionId;
    var td = document.createElement('td');
    td.colSpan = 8;
    td.style.cssText = 'padding:8px 12px;background:#0a1628;font-size:0.75em;border-top:1px solid #1e3a5f';
    if (linked.length === 0) {
      td.innerHTML = '<span style="color:#a8afba">📋 暂无关联手牌</span>';
    } else {
      // [V6.15.1] 筛选下拉 + 筛选逻辑
      var expandFilterId = 'sessHandFilter-' + sessionId;
      var parts = [
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">',
        '<span style="color:#a8afba">📋 关联手牌 (' + linked.length + '手):</span>',
        '<select class="select" data-sess-filter="' + sessionId + '" id="' + expandFilterId + '" style="font-size:0.7em;padding:2px 6px;width:auto">',
        '<option value="all"' + (filterVal === 'all' ? ' selected' : '') + '>全部</option>',
        '<option value="above2"' + (filterVal === 'above2' ? ' selected' : '') + '>≥ 2 BB</option>',
        '<option value="above30"' + (filterVal === 'above30' ? ' selected' : '') + '>≥ 30 BB</option>',
        '</select>',
        '</div>'
      ];
      linked.forEach(function (r) {
        // [V6.15.2] 从 desc 提取 Hero 底牌渲染花色徽章，替代原来的 potType+board
        var handHtml = '';
        var heroCardsM = (r.desc || '').match(/Hero[^\n\[]*\[([^\]]+)\]/);
        if (heroCardsM) {
          handHtml += Utils.renderCardBadges(heroCardsM[1], { style: 'margin-right:2px' });
          // [V6.15.2] 对手牌灰色小字标注
          if (r.oCards) {
            handHtml += ' <span style="color:#a8afba;font-size:0.7em">vs ' + Utils.escapeHtml(r.oCards) + '</span>';
          }
        } else {
          handHtml = '--';
        }
        var profitStr = r.pBB != null ? Utils.formatProfitHTML(r.pBB) : '--';
        var mistakeStr = r.mistake || '--';
        var ggMark = r.gg ? ' <span style="color:#a8afba;font-size:0.85em">GG</span>' : '';
        parts.push('<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid #1e293b">');
        parts.push('<span style="min-width:80px">' + handHtml + '</span>');
        var markIcon = r.marked ? '★' : '☆';
        var markColor = r.marked ? '#d4a853' : '#a8afba';
        parts.push('<span style="flex:1;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + profitStr + ggMark + '</span>');
        parts.push('<span style="color:#a8afba;min-width:60px;text-align:right">' + Utils.escapeHtml(mistakeStr) + '</span>');
        parts.push('<button class="btn--mini" data-hand-edit="' + r.id + '" style="font-size:0.85em">👁️</button>');
        parts.push('<button class="btn--mini hand-mark-btn" data-hand-mark="' + r.id + '" style="font-size:0.85em;color:' + markColor + '" title="标记">' + markIcon + '</button>');
        parts.push('</div>');
      });
      td.innerHTML = parts.join('');
    }
    tr.appendChild(td); btn.closest('tr').after(tr);
  },
  clearSessionForm() {
    ['sessDate','sessLevel','sessDur','sessHands','sessProfit','sessRemark','sessMistakeCustom'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('sessTilt').value = '5';
    document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach((b) => b.classList.remove('is-active'));
    this.editingId = null;
    document.getElementById('addSessionBtn').textContent = '保存 Session';
    document.getElementById('clearSessionBtn').textContent = '清空表单';
    document.getElementById('addSessionBtn').dataset.state = 'create';
    document.getElementById('sessionDetailPane').classList.remove('is-editing');
  },
  editSession(id) {
    const sessions = this.getSessions();
    const s = sessions.find(function (x) { return x.id === id; });
    if (!s) return;
    this.editingId = id;
    document.getElementById('sessDate').value = s.date || '';
    document.getElementById('sessLevel').value = s.level || '';
    document.getElementById('sessDur').value = s.duration || '';
    document.getElementById('sessHands').value = s.hands || '';
    document.getElementById('sessProfit').value = s.profit || '';
    document.getElementById('sessTilt').value = s.tilt || 5;
    document.getElementById('sessRemark').value = s.remark || '';
    document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach(function (b) { b.classList.remove('is-active'); });
    if (s.mistake && s.mistake !== '无') {
      const parts = s.mistake.split(', ');
      document.querySelectorAll('#sessMistakeGroup .toggle-btn').forEach(function (b) {
        if (parts.indexOf(b.dataset.mistake) !== -1) b.classList.add('is-active');
      });
      const predefined = ['翻前结构错误','翻后认知错误','下注结构错误','Exploit偏移','心理错误'];
      const customParts = parts.filter(function (p) { return predefined.indexOf(p) === -1; });
      document.getElementById('sessMistakeCustom').value = customParts.join(', ');
    }
    document.getElementById('addSessionBtn').textContent = '更新 Session';
    document.getElementById('clearSessionBtn').textContent = '取消编辑';
    document.getElementById('addSessionBtn').dataset.state = 'edit';
    var sessionPane = document.getElementById('sessionDetailPane');
    sessionPane.classList.add('is-editing');
    sessionPane.focus({ preventScroll: true });
  },
  deleteSession(id) {
    var self = this;
    var sessions = self.getSessions();
    var session = sessions.find(function (s) { return s.id === id; });
    var label = session ? (session.date || '') + ' ' + (session.level || '') : id;
    if (!confirm('删除 Session "' + label + '"？\n\n该 Session 下的手牌将一并删除（Picks 精选手牌除外）。')) return;
    // 删除 Session
    self.saveSessions(sessions.filter(function (s) { return s.id !== id; }));
    // 级联删除手牌（保留 marked = true 的 Picks）
    var hands = HandRepo.getAll();
    var deletedCount = 0;
    hands = hands.filter(function (h) {
      if (h.sessionId === id && !h.marked) { deletedCount++; return false; }
      return true;
    });
    if (deletedCount) {
      HandRepo.saveAll(hands);
      Utils.showToast('已删除 ' + deletedCount + ' 手关联手牌');
    }
    self.renderAll();
  },
  renderSessions() {
    var filter = document.getElementById('filterLevel').value;
    var sessions = Utils.sortByDateKey(this.getSessions());
    var levels = []; var seenLevels = {};
    sessions.forEach(function (s) { if (!seenLevels[s.level]) { seenLevels[s.level] = true; levels.push(s.level); } });
    var sel = document.getElementById('filterLevel');
    sel.innerHTML = '<option value="all">全部级别</option>';
    levels.forEach(function (l) { sel.innerHTML += '<option value="' + Utils.escapeHtml(l) + '">' + Utils.escapeHtml(l) + '</option>'; });
    var dl = document.getElementById('levelList');
    if (dl) { dl.innerHTML = levels.map(function (l) { return '<option value="' + Utils.escapeHtml(l) + '">'; }).join(''); }
    sel.value = filter;
    if (filter !== 'all') sessions = sessions.filter(function (s) { return s.level === filter; });
    var tmpl = document.getElementById('tmpl-session-row');
    var body = document.getElementById('sessionBody');
    var frag = document.createDocumentFragment();
    sessions.forEach(function (s) {
      var row = document.importNode(tmpl.content, true).firstElementChild;
      row.querySelector('[data-bind="date"]').textContent = s.date;
      row.querySelector('[data-bind="level"]').textContent = s.level;
      row.querySelector('[data-bind="duration"]').textContent = s.duration + 'h';
      row.querySelector('[data-bind="hands"]').textContent = s.hands;
      var profitEl = row.querySelector('[data-bind="profit"]');
      var profitStr = Utils.safeFixed(s.profit, 1);
      profitEl.textContent = (s.profit >= 0 ? '+' : '') + profitStr;
      profitEl.style.color = s.profit >= 0 ? '#6baf7e' : '#c06060';
      row.querySelector('[data-bind="tilt"]').textContent = s.tilt;
      row.querySelector('[data-bind="mistake"]').textContent = s.mistake;
      row.querySelector('[data-expand-id]').setAttribute('data-expand-id', s.id);
      row.querySelector('[data-import-sid]').setAttribute('data-import-sid', s.id);
      row.querySelector('[data-edit-id]').setAttribute('data-edit-id', s.id);
      row.querySelector('[data-delete-id]').setAttribute('data-delete-id', s.id);
      // [V6.14.0] 导入按钮点击
      var importSessionBtn = row.querySelector('[data-import-sid]');
      importSessionBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openGGImportForSession(s.id);
      });
      frag.appendChild(row);
    });
    body.replaceChildren(frag);
  },
  // [V6.18.1] 全局统计 — 渲染到 Total 面板
  updateTotalStats() {
    const self = this;
    const sessions = this.getSessions();
    // [V7.0.0] 渲染指纹：Session/手牌数量未变则跳过全量 DOM 重建
    var allHands = HandRepo.getAll();
    var fp = sessions.length + '|' + allHands.length;
    if (this._totalFp === fp) return;
    this._totalFp = fp;
    const live = sessions.filter((s) => s.level.toLowerCase() === 'live');
    let tp = 0, th = 0, td = 0, tt = 0;
    sessions.forEach((s) => { tp += s.profit; th += s.hands; td += s.duration; tt += s.tilt; });
    const c = sessions.length, avgTilt = c ? Utils.safeFixed(tt / c, 1) : 'N/A',
      bb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A', hr = td ? Utils.safeFixed(tp / td, 2) : 'N/A';
    var hph = td > 0 ? Math.round(th / (td / 60)) : 0; // [V6.18.1] 手/小时
    var pph = td > 0 ? Utils.safeFixed(tp / (td / 60), 1) : 'N/A'; // [V6.18.1] BB/小时
    var tsa = document.getElementById('totalStatsArea');
    if (!tsa) return;
    Utils.setSafeHTML(tsa, '<div class="stats"><div class="stats__item"><div class="stats__label">Sessions</div><div class="stats__value">' + c + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Net Profit</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">Hands</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(bb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(bb100) >= 0 ? 'text-win' : 'text-lose') + '">' + bb100 + '</div></div><div class="stats__item ' + (parseFloat(hr) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Hourly</div><div class="stats__value ' + (parseFloat(hr) >= 0 ? 'text-win' : 'text-lose') + '">' + hr + ' BB/h</div></div><div class="stats__item"><div class="stats__label">Avg Tilt</div><div class="stats__value">' + avgTilt + '</div></div></div>');
    // 错误追踪
    const mistakeMap = new Map(), mistakeProfitMap = new Map();
    sessions.forEach((s) => {
      if (s.mistake !== '无') { s.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) { mistakeMap.set(t, (mistakeMap.get(t) || 0) + 1); mistakeProfitMap.set(t, (mistakeProfitMap.get(t) || 0) + s.profit); } }); }
    });
    let mh = '';
    if (mistakeMap.size) {
      const sorted = [...mistakeMap.entries()].map(([k, v]) => ({ name: k, count: v, avgProfit: Utils.safeFixed(mistakeProfitMap.get(k) / v, 1) })).sort((a, b) => parseFloat(a.avgProfit) - parseFloat(b.avgProfit));
      sorted.forEach((item) => { mh += '<span class="mistake-tag">' + Utils.escapeHtml(item.name) + ' x' + item.count + ' <span class="' + (parseFloat(item.avgProfit) >= 0 ? 'text-win' : 'text-lose') + '" style="font-size:0.85em">' + (parseFloat(item.avgProfit) >= 0 ? '+' : '') + item.avgProfit + ' BB</span></span> '; });
    } else { mh = '暂无错误记录'; }
    var tms = document.getElementById('totalMistakeStats');
    if (tms) Utils.setSafeHTML(tms, mh);
    // 统计引擎（allHands 已在指纹检查时获取）
    var engineResult = analyze(allHands);
    var es = engineResult.stats;
    var recs = engineResult.recommendations;
    // [V6.18.5] 引擎统计 — 公共渲染
    var extraOvHtml = '<div class="stats__item"><div class="stats__label">Hands/Hour</div><div class="stats__value">' + hph + '</div></div>';
    extraOvHtml += '<div class="stats__item ' + (parseFloat(pph) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">BB/Hour</div><div class="stats__value ' + (parseFloat(pph) >= 0 ? 'text-win' : 'text-lose') + '">' + (parseFloat(pph) >= 0 ? '+' : '') + pph + ' BB</div></div>';
    renderStatsPanel({ containerEl: tsa, es: es, recs: recs, extraOverviewHtml: extraOvHtml });
    this.renderCharts();
    _initStatTooltip('totalStatsArea');
    // [V6.18.9] Live 数据更新（元素在 Villain 面板）
    var tlsEl2 = document.getElementById('totalLiveStats');
    if (tlsEl2) {
      var liveSessions = sessions.filter(function (s) { return s.level.toLowerCase() === 'live'; });
      var lh = '';
      if (liveSessions.length) {
        var lp = 0, lhI = 0, ld = 0, lt = 0;
        liveSessions.forEach(function (s) { lp += s.profit; lhI += s.hands; ld += s.duration; lt += s.tilt; });
        lh = '场次: ' + liveSessions.length + ' | 手数: ' + lhI + ' | 盈亏: ' + Utils.safeFixed(lp, 1) + ' BB | Tilt: ' + Utils.safeFixed(lt / liveSessions.length, 1) + ' | 时薪: ' + Utils.safeFixed(ld ? lp / ld : 0, 2) + ' BB/h';
      } else { lh = '暂无Live数据'; }
      tlsEl2.innerHTML = lh;
    }
    _renderMonteCarlo();
  },
  // [V6.18.1] 向后兼容，重定向到 Total 面板
  updateStats() {
    this.updateTotalStats();
  },
  // [V6.16.5] 按 Session 过滤统计面板
  updateStatsForSession(sessionId) {
    var allSessions = this.getSessions();
    var target = allSessions.find(function (s) { return s.id === sessionId; });
    if (!target) return;
    // 使用单 Session 数组计算基础统计
    var sessions = [target];
    var tp = target.profit, th = target.hands, td = target.duration, tt = target.tilt;
    var c = 1, avgTilt = Utils.safeFixed(tt, 1),
      bb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A',
      hr = td ? Utils.safeFixed(tp / td, 2) : 'N/A';
    var titleHtml = '<div style="font-size:0.8em;color:#5a9e8f;margin-bottom:6px">📌 仅显示: ' + Utils.escapeHtml(target.date) + ' ' + Utils.escapeHtml(target.level) + ' <button class="btn--mini" id="resetStatsFilterBtn" style="font-size:0.75em;margin-left:8px">↺ 全部</button></div>';
    Utils.setSafeHTML(document.getElementById('statsArea'), titleHtml + '<div class="stats"><div class="stats__item"><div class="stats__label">Session</div><div class="stats__value">' + c + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Profit</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">Hands</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(bb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(bb100) >= 0 ? 'text-win' : 'text-lose') + '">' + bb100 + '</div></div><div class="stats__item ' + (parseFloat(hr) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">Hourly</div><div class="stats__value ' + (parseFloat(hr) >= 0 ? 'text-win' : 'text-lose') + '">' + hr + ' BB/h</div></div><div class="stats__item"><div class="stats__label">Tilt</div><div class="stats__value">' + avgTilt + '</div></div></div>');
    // 错误统计
    var mh = target.mistake && target.mistake !== '无' ? target.mistake : '暂无错误记录';
    var mhEl2 = document.getElementById('mistakeStats'); if (mhEl2) mhEl2.innerHTML = '<span class="mistake-tag">' + Utils.escapeHtml(mh) + '</span>';
    // 统计引擎 — 只算该 Session 的手牌
    var allHands = HandRepo.getAll();
    var engineResult = analyze(allHands, { sessionId: sessionId });
    var es = engineResult.stats;
    var recs = engineResult.recommendations;
    // [V6.18.5] 引擎统计 — 公共渲染
    var ssa = document.getElementById('statsArea');
    renderStatsPanel({ containerEl: ssa, es: es, recs: recs });
    _initStatTooltip('statsArea');
    var tlsEl = document.getElementById('totalLiveStats'); if (tlsEl) tlsEl.innerHTML = target.level.toLowerCase() === 'live' ? 'Live 场次' : '';
    var self = this;
    document.getElementById('resetStatsFilterBtn').addEventListener('click', function () {
      Navigation.goToReviewSubtab('total');
    });
    _initStatTooltip('statsArea');
    self._renderSessionHandChart(sessionId);
  },
  // [V7.3.0] 图表渲染 — 累计盈利 + Session柱状 + 位置盈亏
  _chartRAF: null,
  renderCharts() {
    // [V7.6.5] 图表指纹：手牌数和数据不变则跳过重绘
    var allHands = HandRepo.getAll();
    var lastId = allHands.length ? (allHands[allHands.length - 1].id || '') : '';
    var fp = allHands.length + '|' + lastId;
    if (this._chartFp === fp) return;
    this._chartFp = fp;
    var self = this;
    if (self._chartRAF) cancelAnimationFrame(self._chartRAF);
    self._chartRAF = requestAnimationFrame(function () {
      self._chartRAF = null;
      var area = document.getElementById('chartsArea');
      if (!area) return;
      self._renderCumulativeProfitChart(area);
      self._renderSessionBarChart(area);
      self._renderPositionProfitChart(area);
      self._initChartTooltips(area);
    });
  },

// [V7.3.1] 图表 hover tooltip + crosshair
  _initChartTooltips(area) {
    var tooltip = document.getElementById('chartTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltip';
      tooltip.className = 'chart-tooltip';
      area.appendChild(tooltip);
    }
    if (area._tooltipBound) return;
    area._tooltipBound = true;

    area.addEventListener('mousemove', function (e) {
      var target = e.target;
      if (!target || target.tagName !== 'CANVAS') {
        var canvases = area.querySelectorAll('canvas');
        for (var i = 0; i < canvases.length; i++) {
          var r = canvases[i].getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            target = canvases[i];
            break;
          }
        }
      }
      if (!target || target.tagName !== 'CANVAS') {
        tooltip.classList.remove('is-visible');
        return;
      }

      var rect = target.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var html = '';

      if (target._hitPoints) {
        var pts = target._hitPoints;
        var nearest = pts[0], minDist = 1e9;
        for (var i = 0; i < pts.length; i++) {
          var d = Math.abs(mx - pts[i].sx);
          if (d < minDist) { minDist = d; nearest = pts[i]; }
        }
        var dStr = (nearest.date || '').slice(5);
        html = '#' + (nearest.handIdx + 1) + ' | ' + dStr + '<br>' +
               '<span class="tt-label">Profit:</span> <span class="tt-val" style="color:#ef4444">' + (nearest.profit >= 0 ? '+' : '') + Utils.safeFixed(nearest.profit, 1) + ' BB</span><br>' +
               '<span class="tt-label">w/o Rake:</span> <span class="tt-val" style="color:#14b8a6">' + (nearest.profitRake >= 0 ? '+' : '') + Utils.safeFixed(nearest.profitRake, 1) + ' BB</span>';

        if (target._staticSnapshot) {
          var ctx2 = target.getContext('2d');
          ctx2.putImageData(target._staticSnapshot, 0, 0);
          ctx2.strokeStyle = 'rgba(255,255,255,0.18)'; ctx2.lineWidth = 1; ctx2.setLineDash([4, 4]);
          ctx2.beginPath();
          ctx2.moveTo(nearest.sx, 20);
          ctx2.lineTo(nearest.sx, 300 - 36);
          ctx2.stroke();
          ctx2.setLineDash([]);
        }
      } else if (target._hitBars) {
        var bars = target._hitBars;
        var hit = null;
        for (var i = 0; i < bars.length; i++) {
          if (mx >= bars[i].x && mx <= bars[i].x + bars[i].w) { hit = bars[i]; break; }
        }
        if (hit) {
          if (hit.position !== undefined) {
            html = '<span class="tt-val">' + hit.position + '</span> | ' + hit.hands + ' hands<br>' +
                   '<span class="tt-label">Profit:</span> <span class="tt-val" style="color:' + (hit.profit >= 0 ? '#14b8a6' : '#ef4444') + '">' + (hit.profit >= 0 ? '+' : '') + Utils.safeFixed(hit.profit, 1) + ' BB</span>';
          } else {
            var dStr2 = (hit.date || '').slice(5);
            html = dStr2 + ' | ' + hit.hands + ' hands<br>' +
                   '<span class="tt-label">Session:</span> <span class="tt-val" style="color:' + (hit.profit >= 0 ? '#14b8a6' : '#ef4444') + '">' + (hit.profit >= 0 ? '+' : '') + Utils.safeFixed(hit.profit, 1) + ' BB</span><br>' +
                   '<span class="tt-label">累计:</span> <span class="tt-val" style="color:#d4a853">' + (hit.cumProfit >= 0 ? '+' : '') + Utils.safeFixed(hit.cumProfit, 1) + ' BB</span>';
          }
        }
      }

      if (html) {
        tooltip.innerHTML = html;
        tooltip.classList.add('is-visible');
        var tx = e.clientX + 14, ty = e.clientY - 10;
        if (tx + 190 > window.innerWidth) tx = e.clientX - 190;
        if (ty < 10) ty = e.clientY + 20;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      } else {
        tooltip.classList.remove('is-visible');
      }
    });

    area.addEventListener('mouseleave', function () {
      tooltip.classList.remove('is-visible');
    });
  },

  // [V7.3.2] Session 手牌累计盈利图
  _renderSessionHandChart(sessionId) {
    var allHands = HandRepo.getAll();
    var hands = allHands.filter(function (h) { return h.sessionId === sessionId && h.pBB != null; });
    if (hands.length < 2) return;
    hands.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });

    var ssa = document.getElementById("statsArea");
    if (!ssa) return;
    var container = ssa.querySelector("#sessionHandChartContainer") || document.createElement("div");
    container.id = "sessionHandChartContainer";
    container.style.marginTop = "16px";
    if (!container.parentElement) ssa.appendChild(container);

    var titleEl = container.querySelector(".chart-title") || document.createElement("div");
    titleEl.className = "chart-title";
    titleEl.textContent = "Session 累计走势 Cumulative";
    if (!titleEl.parentElement) container.appendChild(titleEl);

    var canvas = container.querySelector("canvas") || document.createElement("canvas");
    if (!canvas.parentElement) container.appendChild(canvas);
    var dpr = window.devicePixelRatio || 1;
    var W = container.clientWidth;
    var H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, W, H);

    var pad = { top: 16, right: 20, bottom: 32, left: 52 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    var cumProfit = 0;
    var points = [];
    var step = hands.length > 500 ? Math.ceil(hands.length / 400) : 1;
    for (var i = 0; i < hands.length; i++) {
      cumProfit += hands[i].pBB;
      if (i % step === 0 || i === hands.length - 1) {
        points.push({ x: i, y: cumProfit });
      }
    }

    var allY = points.map(function (p) { return p.y; });
    var minY = Math.min.apply(null, allY);
    var maxY = Math.max.apply(null, allY);
    var absY = Math.max(Math.abs(minY), Math.abs(maxY), 5);
    var zeroY = pad.top + ph / 2;

    var ySteps = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 0.5;
    ctx.fillStyle = "#909090"; ctx.font = "9px SF Mono, monospace"; ctx.textAlign = "right";
    for (var i = 0; i <= ySteps; i++) {
      var gy = pad.top + (ph / ySteps) * i;
      var gv = absY * (1 - (i / ySteps) * 2);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
      ctx.fillText(Math.round(gv) + "", pad.left - 6, gy + 3);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(W - pad.right, zeroY); ctx.stroke();

    var maxX = hands.length - 1;
    var scaleX = function (x) { return pad.left + (x / maxX) * pw; };
    var scaleY = function (v) { return zeroY - (v / absY) * (ph / 2); };

    if (points.length >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(scaleX(points[0].x), zeroY);
      for (var i = 0; i < points.length; i++) {
        ctx.lineTo(scaleX(points[i].x), scaleY(points[i].y));
      }
      ctx.lineTo(scaleX(points[points.length - 1].x), zeroY);
      ctx.closePath();
      ctx.fillStyle = "rgba(239,68,68,0.08)";
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath();
      for (var i = 0; i < points.length; i++) {
        var lx = scaleX(points[i].x), ly = scaleY(points[i].y);
        if (i === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "#909090"; ctx.font = "8px SF Mono, monospace"; ctx.textAlign = "center";
    var xLabelCount = Math.min(4, hands.length);
    var xStep = Math.max(1, Math.floor(hands.length / xLabelCount));
    for (var i = 0; i < hands.length; i += xStep) {
      ctx.fillText("#" + (i + 1), scaleX(i), pad.top + ph + 12);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(W - pad.right, pad.top + ph); ctx.stroke();

    // [V7.3.2] hit-test 数据 + hover tooltip
    canvas._hitPoints = points.map(function (p, i) {
      return { sx: scaleX(p.x), sy: scaleY(p.y), handIdx: p.x, profit: p.y, date: hands[p.x].date };
    });
    if (!container._tipBound) {
      container._tipBound = true;
      var tip = document.getElementById('chartTooltip');
      if (!tip) { tip = document.createElement('div'); tip.id = 'chartTooltip'; tip.className = 'chart-tooltip'; document.body.appendChild(tip); }
      container.addEventListener('mousemove', function (e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var pts = canvas._hitPoints;
        if (!pts) { tip.classList.remove('is-visible'); return; }
        var nearest = pts[0], minDist = 1e9;
        for (var i = 0; i < pts.length; i++) {
          var d = Math.abs(mx - pts[i].sx);
          if (d < minDist) { minDist = d; nearest = pts[i]; }
        }
        var dStr = (nearest.date || '').slice(5);
        tip.innerHTML = '#' + (nearest.handIdx + 1) + ' | ' + dStr + '<br><span class="tt-label">Profit:</span> <span class="tt-val" style="color:' + (nearest.profit >= 0 ? '#14b8a6' : '#ef4444') + '">' + (nearest.profit >= 0 ? '+' : '') + Utils.safeFixed(nearest.profit, 1) + ' BB</span>';
        tip.classList.add('is-visible');
        var tx = e.clientX + 14, ty = e.clientY - 10;
        if (tx + 180 > window.innerWidth) tx = e.clientX - 180;
        if (ty < 10) ty = e.clientY + 20;
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      });
      container.addEventListener('mouseleave', function () { tip.classList.remove('is-visible'); });
    }
  },

  // ========== 累计盈利线图 ==========
  _renderCumulativeProfitChart(area) {
    var container = area.querySelector('#cumulativeProfitContainer') || document.createElement('div');
    container.id = 'cumulativeProfitContainer';
    container.style.marginBottom = '20px';
    if (!container.parentElement) area.appendChild(container);

    var titleEl = container.querySelector('.chart-title') || document.createElement('div');
    titleEl.className = 'chart-title';
    titleEl.textContent = '累计盈利 Cumulative Profit';
    if (!titleEl.parentElement) container.appendChild(titleEl);

    var allHands = HandRepo.getAll();
    if (allHands.length < 2) {
      container.innerHTML = '<div class="chart-title">累计盈利 Cumulative Profit</div><div class="text-muted" style="text-align:center;padding:20px 0;font-size:0.8em">Need 2+ hands to show chart</div>';
      return;
    }

    var sorted = allHands.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

    var cumProfit = 0, cumProfitRake = 0;
    var points = [], pointsRake = [];
    var step = sorted.length > 1000 ? Math.ceil(sorted.length / 800) : 1;
    for (var i = 0; i < sorted.length; i++) {
      var pbb = sorted[i].pBB || 0;
      var rake = sorted[i].pBB > 0 ? ((sorted[i].rake || 0) + (sorted[i].jackpot || 0)) : 0;
      cumProfit += pbb;
      cumProfitRake += pbb + rake;
      if (i % step === 0 || i === sorted.length - 1) {
        points.push({ x: i, y: cumProfit });
        pointsRake.push({ x: i, y: cumProfitRake });
      }
    }

    var canvas = container.querySelector('canvas') || document.createElement('canvas');
    if (!canvas.parentElement) container.appendChild(canvas);
    var dpr = window.devicePixelRatio || 1;
    var W = container.clientWidth;
    if (W < 10) { console.warn('Chart container width too small (' + W + 'px), skipping render'); return; }
    var H = 300;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, W, H);

    var pad = { top: 20, right: 20, bottom: 36, left: 56 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    var allY = points.concat(pointsRake).map(function (p) { return p.y; });
    var minY = Math.min.apply(null, allY);
    var maxY = Math.max.apply(null, allY);
    var absY = Math.max(Math.abs(minY), Math.abs(maxY), 10);
    var zeroY = pad.top + ph / 2;

    var ySteps = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#909090'; ctx.font = '9px SF Mono, monospace'; ctx.textAlign = 'right';
    for (var i = 0; i <= ySteps; i++) {
      var gy = pad.top + (ph / ySteps) * i;
      var gv = absY * (1 - (i / ySteps) * 2);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
      ctx.fillText(Math.round(gv) + '', pad.left - 6, gy + 3);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(W - pad.right, zeroY); ctx.stroke();

    var maxX = sorted.length - 1;
    var scaleX = function (x) { return pad.left + (x / maxX) * pw; };
    var scaleY = function (v) { return zeroY - (v / absY) * (ph / 2); };

    var drawLine = function (pts, color, fillColor) {
      if (pts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(scaleX(pts[0].x), zeroY);
      for (var i = 0; i < pts.length; i++) {
        ctx.lineTo(scaleX(pts[i].x), scaleY(pts[i].y));
      }
      ctx.lineTo(scaleX(pts[pts.length - 1].x), zeroY);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var lx = scaleX(pts[i].x), ly = scaleY(pts[i].y);
        if (i === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    };

    drawLine(pointsRake, '#14b8a6', 'rgba(20,184,166,0.08)');
    drawLine(points, '#ef4444', 'rgba(239,68,68,0.08)');

    ctx.fillStyle = '#ef4444'; ctx.font = '9px SF Mono, monospace'; ctx.textAlign = 'left';
    ctx.fillRect(pad.left, pad.top - 10, 10, 2);
    ctx.fillText('Profit', pad.left + 14, pad.top - 4);
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(pad.left + 70, pad.top - 10, 10, 2);
    ctx.fillText('Profit w/o Rake', pad.left + 84, pad.top - 4);

    var xLabelCount = Math.min(6, sorted.length);
    var xStep = Math.max(1, Math.floor(sorted.length / xLabelCount));
    ctx.fillStyle = '#909090'; ctx.font = '8px SF Mono, monospace'; ctx.textAlign = 'center';
    for (var i = 0; i < sorted.length; i += xStep) {
      ctx.fillText((sorted[i].date || '').slice(5), scaleX(i), pad.top + ph + 14);
    }
    ctx.fillText((sorted[sorted.length - 1].date || '').slice(5), scaleX(sorted.length - 1), pad.top + ph + 14);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(W - pad.right, pad.top + ph); ctx.stroke();

    // [V7.3.1] 存储 hit-test 数据 + 静态快照（用于 crosshair）
    canvas._hitPoints = points.map(function (p, i) {
      return { sx: scaleX(p.x), sy: scaleY(p.y), handIdx: p.x, profit: p.y, profitRake: pointsRake[i].y, date: sorted[p.x].date };
    });
    canvas._staticSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  },

  // ========== Session 柱状 + 累计叠加 ==========
  _renderSessionBarChart(area) {
    var container = area.querySelector('#sessionBarContainer') || document.createElement('div');
    container.id = 'sessionBarContainer';
    container.style.marginBottom = '20px';
    if (!container.parentElement) area.appendChild(container);

    var titleEl = container.querySelector('.chart-title') || document.createElement('div');
    titleEl.className = 'chart-title';
    titleEl.textContent = 'Session 盈亏 + 累计趋势';
    if (!titleEl.parentElement) container.appendChild(titleEl);

    var sessions = Utils.sortByDateKey(this.getSessions()).slice(-25);
    if (sessions.length < 2) {
      container.innerHTML = '<div class="chart-title">Session 盈亏 + 累计趋势</div><div class="text-muted" style="text-align:center;padding:20px 0;font-size:0.8em">Need 2+ sessions to show chart</div>';
      return;
    }

    var canvas = container.querySelector('canvas') || document.createElement('canvas');
    if (!canvas.parentElement) container.appendChild(canvas);
    var dpr = window.devicePixelRatio || 1;
    var W = container.clientWidth;
    var H = 280;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, W, H);

    var pad = { top: 24, right: 20, bottom: 40, left: 52 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    var cumSum = 0;
    var cumValues = sessions.map(function (s) { cumSum += s.profit; return cumSum; });
    var profits = sessions.map(function (s) { return s.profit; });
    var allVals = profits.concat(cumValues);
    var maxVal = Math.max.apply(null, allVals);
    var minVal = Math.min.apply(null, allVals);
    var symAbs = Math.max(Math.abs(minVal), Math.abs(maxVal), 10);
    var zY = pad.top + ph / 2;
    var sY = function (v) { return zY - (v / symAbs) * (ph / 2); };

    var ySteps = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#909090'; ctx.font = '9px SF Mono, monospace'; ctx.textAlign = 'right';
    for (var i = 0; i <= ySteps; i++) {
      var gy = pad.top + (ph / ySteps) * i;
      var gv = symAbs * (1 - (i / ySteps) * 2);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
      ctx.fillText(Math.round(gv) + '', pad.left - 6, gy + 3);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zY); ctx.lineTo(W - pad.right, zY); ctx.stroke();

    var barGap = pw / sessions.length;
    var barW = barGap * 0.55;
    for (var i = 0; i < sessions.length; i++) {
      var bx = pad.left + barGap * i + (barGap - barW) / 2;
      var bTop = sY(sessions[i].profit);
      var bBot = zY;
      var h = bBot - bTop;
      var absH = Math.abs(h);
      if (absH < 1) absH = 1;
      ctx.fillStyle = sessions[i].profit >= 0 ? 'rgba(20,184,166,0.65)' : 'rgba(239,68,68,0.55)';
      ctx.fillRect(bx, Math.min(bTop, bBot), barW, absH);
    }

    ctx.strokeStyle = '#d4a853'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.shadowColor = 'rgba(212,168,83,0.35)'; ctx.shadowBlur = 3;
    ctx.beginPath();
    for (var i = 0; i < sessions.length; i++) {
      var clx = pad.left + barGap * i + barGap / 2;
      var cly = sY(cumValues[i]);
      if (i === 0) ctx.moveTo(clx, cly); else ctx.lineTo(clx, cly);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

    ctx.fillStyle = '#d4a853'; ctx.font = '9px SF Mono, monospace'; ctx.textAlign = 'left';
    ctx.fillRect(pad.left + 4, pad.top - 10, 10, 2);
    ctx.fillText('Cumulative', pad.left + 18, pad.top - 4);

    ctx.fillStyle = '#909090'; ctx.font = '8px SF Mono, monospace'; ctx.textAlign = 'center';
    var xStep = Math.max(1, Math.floor(sessions.length / 8));
    for (var i = 0; i < sessions.length; i += xStep) {
      ctx.fillText((sessions[i].date || '').slice(5), pad.left + barGap * i + barGap / 2, pad.top + ph + 14);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(W - pad.right, pad.top + ph); ctx.stroke();

    // [V7.3.1] 存储 hit-test 数据
    canvas._hitBars = sessions.map(function (s, i) {
      return { x: pad.left + barGap * i + (barGap - barW) / 2, w: barW, profit: s.profit, cumProfit: cumValues[i], date: s.date, hands: s.hands };
    });
  },

  // ========== 位置盈亏柱状图 ==========
  _renderPositionProfitChart(area) {
    var container = area.querySelector('#positionProfitContainer') || document.createElement('div');
    container.id = 'positionProfitContainer';
    container.style.marginBottom = '12px';
    if (!container.parentElement) area.appendChild(container);

    var titleEl = container.querySelector('.chart-title') || document.createElement('div');
    titleEl.className = 'chart-title';
    titleEl.textContent = '位置盈亏 Position Profit (BB)';
    if (!titleEl.parentElement) container.appendChild(titleEl);

    var posData = _aggregatePositionProfit();
    var positions = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];
    var hasData = positions.some(function (p) { return posData[p].hands > 0; });
    if (!hasData) {
      container.innerHTML = '<div class="chart-title">位置盈亏 Position Profit (BB)</div><div class="text-muted" style="text-align:center;padding:16px 0;font-size:0.8em">No position data available</div>';
      return;
    }

    var canvas = container.querySelector('canvas') || document.createElement('canvas');
    if (!canvas.parentElement) container.appendChild(canvas);
    var dpr = window.devicePixelRatio || 1;
    var W = container.clientWidth;
    var H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, W, H);

    var pad = { top: 16, right: 20, bottom: 32, left: 52 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    var values = positions.map(function (p) { return posData[p].profit; });
    var maxV = Math.max.apply(null, values.concat([0]));
    var minV = Math.min.apply(null, values.concat([0]));
    var symA = Math.max(Math.abs(minV), Math.abs(maxV), 1);
    var zY = pad.top + ph / 2;
    var sY = function (v) { return zY - (v / symA) * (ph / 2); };

    var ySteps = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#909090'; ctx.font = '9px SF Mono, monospace'; ctx.textAlign = 'right';
    for (var i = 0; i <= ySteps; i++) {
      var gy = pad.top + (ph / ySteps) * i;
      var gv = symA * (1 - (i / ySteps) * 2);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
      ctx.fillText(Math.round(gv) + '', pad.left - 6, gy + 3);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zY); ctx.lineTo(W - pad.right, zY); ctx.stroke();

    var barGap = pw / positions.length;
    var barW = barGap * 0.5;
    for (var i = 0; i < positions.length; i++) {
      var bx = pad.left + barGap * i + (barGap - barW) / 2;
      var val = posData[positions[i]].profit;
      var bTop = sY(val);
      var bBot = zY;
      var h = bBot - bTop;
      var absH = Math.abs(h);
      if (absH < 0.5) absH = 1;
      ctx.fillStyle = val >= 0 ? 'rgba(20,184,166,0.65)' : 'rgba(239,68,68,0.55)';
      ctx.fillRect(bx, Math.min(bTop, bBot), barW, absH);
      ctx.fillStyle = '#b0b0b0'; ctx.font = '10px SF Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText(positions[i], pad.left + barGap * i + barGap / 2, pad.top + ph + 14);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(W - pad.right, pad.top + ph); ctx.stroke();
  },


    renderTiltLogs() {
    const logs = TiltLogRepo.getAll();
    const container = document.getElementById('tiltLogList');
    if (!container) return;
    if (logs.length === 0) { container.innerHTML = '暂无记录'; return; }
    const recent = logs.slice(-5).reverse();
    container.innerHTML = recent.map(function (l) {
      const timeStr = Utils.formatTime(l.time);
      return '<div style="margin-bottom:4px;background:#141b24;padding:6px 10px;border-radius:8px"><span style="color:#c06060">' + Utils.escapeHtml(l.trigger) + '</span> | 强度:' + l.intensity + ' | ' + Utils.escapeHtml(l.note || '') + ' <span style="font-size:0.7em;color:#a8afba">' + l.date + ' ' + timeStr + '</span></div>';
    }).join('');
  },
  // [V6.10.0] 对手画像：按对手名聚合统计
  // [V6.11.0] 增加 hands 数组，供详情展开
  getOpponentStats() {
    var allHands = HandRepo.getAll();
    // [V7.0.0] 缓存：排序/筛选切换时手牌总数未变则跳过聚合
    if (_oppStatsCache && allHands.length === _oppStatsCacheLen) return _oppStatsCache;
    _oppStatsCacheLen = allHands.length;
    var hands = allHands.filter(function (r) { return r.oId; });
    var map = {};
    hands.forEach(function (r) {
      // [V7.0.2] 用 oHash 分组（向后兼容：无 oHash 时用规范化 oId）
      var oHash = r.oHash || Utils.normalizeOpponentName(r.oId);
      var oid = r.oId;
      if (!map[oHash]) {
        map[oHash] = { name: oid, oHash: oHash, oIds: [oid], totalHands: 0, showdowns: 0, profit: 0, wins: 0, cards: [], lastDate: '', hands: [], _handRefs: [] };
      }
      var p = map[oHash];
      if (p.oIds.indexOf(oid) === -1) p.oIds.push(oid);
      if (p.name.length < oid.length) p.name = oid;
      p.totalHands++;
      p.profit += r.pBB || 0;
      if (r.pBB > 0) p.wins++;
      if (r.oCards) {
        p.showdowns++;
        if (p.cards.indexOf(r.oCards) === -1) p.cards.push(r.oCards);
      }
      if (r.date > p.lastDate) p.lastDate = r.date;
      // [V7.0.0] 保存完整手牌引用供懒加载统计
      p._handRefs.push(r);
      // [V6.13.0] 提取 Hero 手牌
      var hCards = '';
      var hm = r.desc ? r.desc.match(/Hero[^\n\[]*\[([^\]]+)\]/) : null;
      if (hm && hm[1]) hCards = hm[1];
      p.hands.push({ id: r.id, date: r.date, potType: r.potType, board: r.board, pBB: r.pBB, sessionId: r.sessionId, mistake: r.mistake, heroCards: hCards, oCards: r.oCards || '' });
    });
    var list = [];
    for (var k in map) { if (map.hasOwnProperty(k)) list.push(map[k]); }
    list.sort(function (a, b) { return b.totalHands - a.totalHands; });
    _oppStatsCache = list;
    return list;
  },
  // [V7.0.0] 按需构建单个对手的手牌列表 HTML（懒渲染回调）
  _buildOppHandListHtml(p, oppIdx, sessionsMap) {
    var html = '';
    p.hands.sort(function (a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; }).forEach(function (h, hi) {
      var dateFormatted = Utils.formatHandDate(h.date);
      var hProfitStr = h.pBB != null ? ((h.pBB >= 0 ? '+' : '') + Utils.safeFixed(h.pBB, 1) + ' BB') : '--';
      var hProfitColor = h.pBB >= 0 ? '#6baf7e' : '#c06060';
      var heroCardsHtml = '';
      if (h.heroCards) {
        heroCardsHtml += Utils.renderCardBadges(h.heroCards, { style: 'margin-right:1px;font-size:0.85em' });
      } else { heroCardsHtml = '--'; }
      var filterClass = 'opp-filterable';
      if (h.pBB != null && Math.abs(h.pBB) >= 2) filterClass += ' above2';
      if (h.pBB != null && Math.abs(h.pBB) >= 30) filterClass += ' above30';
      html += '<div class="opp-hand-row ' + filterClass + '" style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #1e293b;cursor:pointer" data-opp-idx="' + oppIdx + '" data-hand-idx="' + hi + '">';
      html += '<span style="min-width:85px;color:#cbd5e1">' + dateFormatted + '</span>';
      html += '<span style="min-width:70px">' + heroCardsHtml + '</span>';
      html += '<span style="min-width:65px;color:' + hProfitColor + '">' + hProfitStr + '</span>';
      html += '<span style="flex:1;color:#a8afba;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Utils.escapeHtml(h.mistake || '--') + '</span>';
      html += '</div>';
      html += '<div class="opp-hand-detail ' + filterClass + '" id="oppHandDetail-' + oppIdx + '-' + hi + '" style="display:none;padding:6px 10px;background:#0a1628;border-radius:6px;margin-bottom:4px;font-size:0.9em">';
      html += '<div style="color:#a8afba">底池类型: ' + Utils.escapeHtml(h.potType || '--') + '</div>';
      if (h.heroCards || h.oCards) {
        html += '<div style="color:#cbd5e1;margin-top:4px">';
        html += '<span style="color:#6baf7e">我: ' + Utils.escapeHtml(h.heroCards || '--') + '</span>';
        html += '  <span style="color:#c06060">对手: ' + Utils.escapeHtml(h.oCards || '--') + '</span>';
        html += '</div>';
      }
      var hSession = sessionsMap.get(h.sessionId);
      if (hSession) {
        html += '<div style="color:#a8afba">Session: ' + Utils.escapeHtml(hSession.date) + ' ' + Utils.escapeHtml(hSession.level) + '</div>';
      } else {
        html += '<div style="color:#a8afba">未关联 Session</div>';
      }
      html += '<button class="btn--mini" data-hand-edit="' + h.id + '" style="margin-top:4px;font-size:0.85em">👁️ 查看手局</button>';
      html += '</div>';
    });
    return html;
  },
  // [V6.10.0] 渲染对手画像面板
  // [V6.11.0] 别名编辑 + 手牌列表展开
  // [V6.13.0] 多维度排序 + Hero/对手底牌
  renderOpponentProfiles(sortBy, sortDir, filterLive) {
    var self = this;
    var aliases = Store.opponentAliases.get();
    var liveFlags = Store.opponentLiveFlags.get();
    var stats = this.getOpponentStats();
    var bar = document.getElementById('opponentStatsBar');
    var list = document.getElementById('opponentList');
    if (!stats.length) {
      bar.textContent = '';
      list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">导入 GG 牌谱后自动生成对手画像</div>';
      return;
    }
    // [V6.12.3] Live 筛选
    if (filterLive) {
      stats = stats.filter(function (s) { return liveFlags[s.name]; });
    }
    // [V6.13.0] 排序
    sortBy = sortBy || 'lastDate';
    sortDir = sortDir || 'desc';
    stats.sort(function (a, b) {
      var va, vb;
      if (sortBy === 'profit') { va = a.profit; vb = b.profit; }
      else if (sortBy === 'winRate') { va = a.totalHands > 0 ? a.wins / a.totalHands : 0; vb = b.totalHands > 0 ? b.wins / b.totalHands : 0; }
      else { va = a.lastDate; vb = b.lastDate; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    if (!stats.length && filterLive) {
      bar.innerHTML = '暂无 Live 对手 &nbsp;' +
        '<button class="btn--mini sort-btn" data-sort="lastDate" style="font-size:0.7em">Recent</button> ' +
        '<button class="btn--mini sort-btn" data-sort="profit" style="font-size:0.7em">Net</button> ' +
        '<button class="btn--mini sort-btn" data-sort="winRate" style="font-size:0.7em">Win Rate</button> ' +
        '<button class="btn--mini live-filter-btn is-active" style="font-size:0.7em;background:#dc2626">Live</button>';
      list.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">暂无标记为 Live 的对手</div>';
      self._bindOpponentSortAndFilter(bar, sortBy, sortDir, filterLive);
      return;
    }
    // [V7.0.0] 渲染指纹：数据/排序/筛选未变则跳过 DOM 重建
    var totalHands = 0;
    stats.forEach(function (s) { totalHands += s.totalHands; });
    var fp = stats.length + '|' + totalHands + '|' + sortBy + '|' + sortDir + '|' + (filterLive ? 1 : 0);
    if (self._villainFp === fp) return;
    self._villainFp = fp;
    var sessions = SessionRepo.getAll();
    bar.innerHTML = '共 ' + stats.length + ' 名对手，' + totalHands + ' 次交手 &nbsp;' +
      '<button class="btn--mini sort-btn' + (sortBy === 'lastDate' ? ' is-active' : '') + '" data-sort="lastDate" style="font-size:0.7em">Recent</button> ' +
      '<button class="btn--mini sort-btn' + (sortBy === 'profit' ? ' is-active' : '') + '" data-sort="profit" style="font-size:0.7em">Net</button> ' +
      '<button class="btn--mini sort-btn' + (sortBy === 'winRate' ? ' is-active' : '') + '" data-sort="winRate" style="font-size:0.7em">Win Rate</button> ' +
      '<button class="btn--mini live-filter-btn' + (filterLive ? ' is-active' : '') + '" style="font-size:0.7em;background:' + (filterLive ? '#dc2626' : '#334155') + '">Live</button>';
    // [V7.0.0] Session Map 预建 — O(1) 查找替代 O(n) find
    var sessionsMap = new Map();
    sessions.forEach(function (s) { sessionsMap.set(s.id, s); });
    var html = '';
    stats.forEach(function (p, i) {
      var displayName = Utils.getOpponentDisplayName(p.name, aliases);
      var hasAlias = aliases[p.name];
      var winRate = p.totalHands > 0 ? ((p.wins / p.totalHands) * 100).toFixed(0) : 0;
      var profitStr = (p.profit >= 0 ? '+' : '') + Utils.safeFixed(p.profit, 1) + ' BB';
      var profitColor = p.profit >= 0 ? '#6baf7e' : '#c06060';
      html += '<div class="opponent-row" style="border:1px solid #334155;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;background:#141b24" data-opp-idx="' + i + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      var isLive = liveFlags[p.name];
      html += '<div><span style="font-weight:bold;color:#d4a853">' + (isLive ? '<span style="color:#dc2626;font-size:0.6em;vertical-align:middle">LIVE</span> ' : '') + Utils.escapeHtml(displayName) + '</span>' + (hasAlias ? ' <span style="font-size:0.65em;color:#a8afba">' + Utils.escapeHtml(p.name) + '</span>' : '') + ' <span style="font-size:0.75em;color:#a8afba">×' + p.totalHands + '</span></div>';
      html += '<div style="display:flex;align-items:center;gap:8px"><span style="color:' + profitColor + ';font-weight:bold">' + profitStr + '</span> <span style="font-size:0.75em;color:#a8afba">' + winRate + '%胜</span> <button class="btn--mini alias-edit-btn" data-oid="' + Utils.escapeHtml(p.name) + '" style="font-size:0.65em;padding:2px 6px;cursor:pointer">✎</button></div>';
      html += '</div>';
      html += '<div class="opponent-detail" id="oppDetail-' + i + '" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #334155;font-size:0.75em;color:#a8afba">';
      html += '摊牌 ' + p.showdowns + ' 次 | 最近 ' + p.lastDate.substring(0, 10);
      // [V7.0.0] 手牌列表 — 仅渲染筛选按钮和空容器，手牌行延迟到展开时构建
      if (p.hands.length) {
        var oppHandFilterId = 'oppHandFilter-' + i;
        html += '<div style="margin-top:8px;display:flex;align-items:center;gap:6px">';
        html += '<span style="font-weight:bold;color:#a8afba">手牌 (' + p.hands.length + '):</span>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="all" style="font-size:0.65em;padding:2px 6px;background:#5a9e8f">全部</button>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="above2" style="font-size:0.65em;padding:2px 6px">≥2 BB</button>';
        html += '<button class="btn--mini opp-filter-btn" data-opp-idx="' + i + '" data-filter="above30" style="font-size:0.65em;padding:2px 6px">≥30 BB</button>';
        html += '</div>';
        html += '<div class="opp-hand-list" id="' + oppHandFilterId + '" data-opp-idx="' + i + '"></div>';
      }
      html += '<div id="oppStats-' + i + '" style="margin-top:8px"></div>';
      html += '</div></div>';
    });
    Utils.setSafeHTML(list, html);
    // [V7.0.0] 事件委托 — 先解绑旧 handler 防止重复绑定叠加
    if (list._clickHandler) list.removeEventListener('click', list._clickHandler);
    list._clickHandler = function (e) {
      // 1. 别名编辑
      var aliasBtn = e.target.closest('.alias-edit-btn');
      if (aliasBtn) {
        e.stopPropagation();
        var oid = aliasBtn.dataset.oid;
        var cur = aliases[oid] || '';
        var input = prompt('为 ' + oid + ' 设置昵称：', cur);
        if (input === null) return;
        if (input.trim()) { aliases[oid] = input.trim(); }
        else { delete aliases[oid]; }
        Store.opponentAliases.save(aliases);
        self.renderOpponentProfiles();
        return;
      }
      // 2. 查看手局
      var handEditBtn = e.target.closest('[data-hand-edit]');
      if (handEditBtn) {
        e.stopPropagation();
        Navigation.goToHand(handEditBtn.dataset.handEdit);
        return;
      }
      // 3. 手牌行展开
      var handRow = e.target.closest('.opp-hand-row');
      if (handRow) {
        e.stopPropagation();
        var hDetail = document.getElementById('oppHandDetail-' + handRow.dataset.oppIdx + '-' + handRow.dataset.handIdx);
        if (hDetail) hDetail.style.display = hDetail.style.display === 'none' ? 'block' : 'none';
        return;
      }
      // 4. 手牌筛选
      var filterBtn = e.target.closest('.opp-filter-btn');
      if (filterBtn) {
        e.stopPropagation();
        var oppIdx = filterBtn.dataset.oppIdx;
        var filter = filterBtn.dataset.filter;
        var container = document.getElementById('oppHandFilter-' + oppIdx);
        if (!container) return;
        container.parentElement.querySelectorAll('.opp-filter-btn').forEach(function (b) { b.classList.remove('is-active'); });
        filterBtn.classList.add('is-active');
        container.querySelectorAll('.opp-filterable').forEach(function (el) {
          if (filter === 'all') { el.style.display = ''; }
          else if (filter === 'above2') { el.style.display = el.classList.contains('above2') ? '' : 'none'; }
          else if (filter === 'above30') { el.style.display = el.classList.contains('above30') ? '' : 'none'; }
        });
        return;
      }
      // 5. 对手展开/收起（仅标题区域，排除 detail 内部点击）
      if (e.target.closest('.opponent-detail')) return;
      var oppRow = e.target.closest('.opponent-row');
      if (oppRow) {
        var idx = oppRow.dataset.oppIdx;
        var detail = document.getElementById('oppDetail-' + idx);
        if (!detail) return;
        var isOpening = detail.style.display === 'none';
        detail.style.display = isOpening ? 'block' : 'none';
        if (isOpening) {
          // 懒渲染：手牌列表（首次展开时构建）
          var handListEl = document.getElementById('oppHandFilter-' + idx);
          if (handListEl && !handListEl.dataset.rendered && stats[idx] && stats[idx].hands && stats[idx].hands.length) {
            handListEl.innerHTML = self._buildOppHandListHtml(stats[idx], idx, sessionsMap);
            handListEl.dataset.rendered = '1';
          }
          // 懒渲染：Opponent Stats（首次展开时计算）
          var oppStatsEl = document.getElementById('oppStats-' + idx);
          if (oppStatsEl && !oppStatsEl.dataset.rendered && stats[idx] && stats[idx].totalHands >= 3 && stats[idx]._handRefs && stats[idx]._handRefs.length >= 3) {
            var oppResult = analyze(stats[idx]._handRefs);
            oppStatsEl.innerHTML = '<details class="stats-details"><summary class="stats-section-title">Opponent Stats</summary></details>';
            var statsContainer = oppStatsEl.querySelector('.stats-details');
            if (statsContainer) renderStatsPanel({ containerEl: statsContainer, es: oppResult.stats, recs: oppResult.recommendations, showExtras: false, showPosition: false });
            oppStatsEl.dataset.rendered = '1';
          }
        }
      }
    };
    list.addEventListener('click', list._clickHandler);
    // [V6.13.0] 排序 + Live 筛选按钮
    self._bindOpponentSortAndFilter(bar, sortBy, sortDir, filterLive);
  },
  _bindOpponentSortAndFilter: function (bar, sortBy, sortDir, filterLive) {
    var self = this;
    var curSortBy = sortBy || 'lastDate';
    var curSortDir = sortDir || 'desc';
    bar.querySelectorAll('.sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = this.dataset.sort;
        var dir = (field === curSortBy && curSortDir === 'desc') ? 'asc' : 'desc';
        self.renderOpponentProfiles(field, dir, filterLive);
      });
    });
    var liveBtn = bar.querySelector('.live-filter-btn');
    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        self.renderOpponentProfiles(curSortBy, curSortDir, !filterLive);
      });
    }
  },
  getHandReviews() { return HandRepo.getAll(); },
  saveHandReviews(r) { HandRepo.saveAll(r); },
  focusHand(handId) {
    var allReviews = Utils.sortByDateKey(this.getHandReviews());
    var idx = allReviews.findIndex(function (review) { return review.id === handId; });
    if (idx < 0) {
      Utils.showToast('找不到目标手牌，可能已被删除。');
      return false;
    }
    var details = document.getElementById('handHistoryDetails');
    if (details) details.open = true;
    this.handCurrentPage = Math.floor(idx / this.handPageSize) + 1;
    this.renderHandReviews();
    var expandBtn = document.querySelector('[data-hand-expand="' + handId + '"]');
    if (expandBtn) this.toggleHandExpand(handId, expandBtn);
    var row = document.querySelector('[data-hand-id="' + handId + '"]');
    if (row && row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.editHandReview(handId);
    return true;
  },
  focusSession(sessionId) {
    var session = this.getSessions().find(function (item) { return item.id === sessionId; });
    if (!session) {
      Utils.showToast('找不到目标 Session，可能已被删除。');
      return false;
    }
    var expandBtn = document.querySelector('[data-expand-id="' + sessionId + '"]');
    var expanded = document.getElementById('expand-row-' + sessionId);
    if (expandBtn && !expanded) this.toggleSessionExpand(sessionId, expandBtn);
    var row = document.querySelector('[data-expand-id="' + sessionId + '"]');
    if (row && row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.updateStatsForSession(sessionId);
    return true;
  },
  populateHandSessionSelect() {
    const sessions = Utils.sortByDateKey(this.getSessions()), sel = document.getElementById('handSessionSelect');
    sel.innerHTML = '<option value="">-- 不关联 --</option>';
    sessions.forEach((s) => { sel.innerHTML += '<option value="' + s.id + '">' + Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) + ' (' + (s.profit >= 0 ? '+' + Utils.safeFixed(s.profit, 1) : Utils.safeFixed(s.profit, 1)) + 'BB)</option>'; });
  },
  captureHandDraft() {
    const pane = document.getElementById('handDetailPane');
    const fields = {};
    pane.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (field) {
      fields[field.id] = { value: field.value, checked: field.checked };
    });
    return {
      fields,
      activeMistakes: Array.from(document.querySelectorAll('#handMistakeGroup .toggle-btn.is-active')).map(function (button) { return button.dataset.mistake; }),
      handEditingId: this.handEditingId || null,
      saveText: document.getElementById('saveHandBtn').textContent,
      saveState: document.getElementById('saveHandBtn').dataset.state || 'create',
      isEditing: pane.classList.contains('is-editing'),
    };
  },
  restoreHandDraft(snapshot) {
    if (!snapshot) return;
    Object.keys(snapshot.fields).forEach(function (id) {
      const field = document.getElementById(id);
      if (!field) return;
      field.value = snapshot.fields[id].value;
      if (field.type === 'checkbox' || field.type === 'radio') field.checked = snapshot.fields[id].checked;
    });
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (button) {
      button.classList.toggle('is-active', snapshot.activeMistakes.indexOf(button.dataset.mistake) !== -1);
    });
    this.handEditingId = snapshot.handEditingId;
    const saveBtn = document.getElementById('saveHandBtn');
    saveBtn.textContent = snapshot.saveText;
    saveBtn.dataset.state = snapshot.saveState;
    document.getElementById('handDetailPane').classList.toggle('is-editing', snapshot.isEditing);
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
    _renderPosAdviceButtons();
    _applyPosAdvice(document.getElementById('handPreflopScenario').value || null);
  },
  resetHandFormForQuickCapture(preferredSessionId) {
    ['handPotType', 'handBoard', 'handPreflopScenario', 'handDesc', 'handReflection', 'handMistakeCustom'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (button) { button.classList.remove('is-active'); });
    this.handEditingId = null;
    const pane = document.getElementById('handDetailPane');
    pane.classList.remove('is-editing');
    const saveBtn = document.getElementById('saveHandBtn');
    saveBtn.textContent = '保存快速记录';
    saveBtn.dataset.state = 'quick';
    const sessionSelect = document.getElementById('handSessionSelect');
    if (preferredSessionId && sessionSelect.querySelector('option[value="' + preferredSessionId + '"]')) {
      sessionSelect.value = preferredSessionId;
    } else {
      const latestSession = this.getSessions().slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      })[0];
      sessionSelect.value = latestSession ? latestSession.id : '';
    }
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
  },
  openQuickCapture() {
    if (this._quickCaptureActive || !window.matchMedia('(max-width: 767px)').matches) return false;
    const main = document.querySelector('.main');
    const activeSub = document.querySelector('#reviewSubNav .subnav__btn--active');
    this._quickCaptureOrigin = {
      tab: main.getAttribute('data-active-tab') || 'timer',
      sub: activeSub ? activeSub.dataset.sub : 'hand',
    };
    this._quickCaptureSnapshot = this.captureHandDraft();
    const preferredSessionId = this._quickCaptureSnapshot.fields.handSessionSelect.value;
    if (!Navigation.goToReviewSubtab('hand')) return false;
    this.resetHandFormForQuickCapture(preferredSessionId);
    this._quickCaptureActive = true;
    const pane = document.getElementById('handDetailPane');
    const trigger = document.getElementById('quickCaptureBtn');
    document.body.classList.add('quick-capture-open');
    pane.classList.add('is-quick-capture');
    pane.setAttribute('role', 'dialog');
    pane.setAttribute('aria-modal', 'true');
    pane.setAttribute('aria-labelledby', 'quickCaptureTitle');
    trigger.setAttribute('aria-expanded', 'true');
    document.getElementById('quickCaptureCloseBtn').focus({ preventScroll: true });
    return true;
  },
  closeQuickCapture(mode) {
    if (!this._quickCaptureActive) return;
    const pane = document.getElementById('handDetailPane');
    const trigger = document.getElementById('quickCaptureBtn');
    const origin = this._quickCaptureOrigin;
    const snapshot = this._quickCaptureSnapshot;
    this._quickCaptureActive = false;
    document.body.classList.remove('quick-capture-open');
    pane.classList.remove('is-quick-capture');
    pane.removeAttribute('role');
    pane.removeAttribute('aria-modal');
    pane.removeAttribute('aria-labelledby');
    trigger.setAttribute('aria-expanded', 'false');

    if (mode === 'full') {
      document.getElementById('saveHandBtn').textContent = '保存手牌';
      document.getElementById('saveHandBtn').dataset.state = 'create';
      this._quickCaptureOrigin = null;
      this._quickCaptureSnapshot = null;
      document.getElementById('handDesc').focus({ preventScroll: true });
      return;
    }

    if (origin && origin.tab === 'review') Navigation.goToReviewSubtab(origin.sub || 'hand');
    else Navigation.goToTab(origin ? origin.tab : 'timer');
    if (mode === 'cancel' || mode === 'saved') this.restoreHandDraft(snapshot);
    this._quickCaptureOrigin = null;
    this._quickCaptureSnapshot = null;
    trigger.focus({ preventScroll: true });
    if (mode === 'saved') Utils.showToast('已快速记录，可稍后补全反思');
  },
  handleQuickCaptureKeydown(event) {
    if (!this._quickCaptureActive) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeQuickCapture('cancel');
      return;
    }
    if (event.key !== 'Tab') return;
    const pane = document.getElementById('handDetailPane');
    const focusable = Array.from(pane.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (element) {
      return element.offsetParent !== null;
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  },
  saveHandReview() {
    const sid = document.getElementById('handSessionSelect').value || null,
      desc = document.getElementById('handDesc').value.trim(),
      reflection = document.getElementById('handReflection').value.trim();
    const potType = document.getElementById('handPotType').value, board = document.getElementById('handBoard').value;
    const btns = document.querySelectorAll('#handMistakeGroup .toggle-btn.is-active');
    const mistakes = Array.from(btns).map((b) => b.dataset.mistake);
    const custom = document.getElementById('handMistakeCustom').value.trim();
    if (custom) mistakes.push(custom);
    const mistakeStr = mistakes.join(', ') || '';
    if (!desc && !reflection) { Utils.showToast('请至少填写一项内容'); return false; }
    const r = { sessionId: sid || null, date: Utils.getLocalDatetime(), potType, board, desc, mistake: mistakeStr, reflection, pBB: null, preflopScenario: document.getElementById('handPreflopScenario').value || null };
    const reviews = this.getHandReviews();
    if (this.handEditingId) {
      const idx = reviews.findIndex(function (x) { return x.id === this.handEditingId; }.bind(this));
      if (idx !== -1) { r.id = this.handEditingId; reviews[idx] = r; }
      this.handEditingId = null;
      document.getElementById('saveHandBtn').textContent = '保存手牌';
      document.getElementById('saveHandBtn').dataset.state = 'create';
      document.getElementById('handDetailPane').classList.remove('is-editing');
    } else { r.id = Utils.generateUUID(); reviews.push(r); }
    this.saveHandReviews(reviews);
    document.getElementById('handDesc').value = 'preflop 行动：Hero /[Xx Xx] \nOTF翻牌 牌面：    行动：\nOTT转牌 牌面：    行动：\nOTR河牌 牌面：    行动：';
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
    document.getElementById('handReflection').value = '';
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach((b) => b.classList.remove('is-active'));
    document.getElementById('handMistakeCustom').value = '';
    this.renderHandReviews();
    return true;
  },
  deleteHandReview(id) { this._confirmDelete(() => this.getHandReviews(), (d) => this.saveHandReviews(d), () => this.renderHandReviews(), 'id', id); },
  editHandReview(id) {
    const reviews = this.getHandReviews();
    const r = reviews.find(function (x) { return x.id === id; });
    if (!r) return;
    this.handEditingId = id;
    document.getElementById('handPotType').value = r.potType || '';
    document.getElementById('handBoard').value = r.board || '';
    document.getElementById('handPreflopScenario').value = r.preflopScenario || '';
    document.getElementById('handSessionSelect').value = r.sessionId || '';
    document.getElementById('handDesc').value = r.desc || '';
    document.getElementById('handDesc').dispatchEvent(new Event('input'));
    document.getElementById('handReflection').value = r.reflection || '';
    document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (b) { b.classList.remove('is-active'); });
    if (r.mistake) {
      const parts = r.mistake.split(', ');
      document.querySelectorAll('#handMistakeGroup .toggle-btn').forEach(function (b) { if (parts.indexOf(b.dataset.mistake) !== -1) b.classList.add('is-active'); });
      const predefined = ['open过宽','OOP defend过宽','4bet逻辑混乱','情绪型raise','错误CB','过多double barrel','river过度call/bluff','下注尺寸过大','下注尺寸过小','没计划三条街','对松弱bluff过多','对激进不够trap','未识别玩家类型','忽略HUD','情绪主导决策','不愿弃牌','想证明自己','追回损失'];
      const customParts = parts.filter(function (p) { return predefined.indexOf(p) === -1; });
      document.getElementById('handMistakeCustom').value = customParts.join(', ');
    }
    document.getElementById('saveHandBtn').textContent = '更新手牌';
    document.getElementById('saveHandBtn').dataset.state = 'edit';
    var handPane = document.getElementById('handDetailPane');
    handPane.classList.add('is-editing');
    handPane.focus({ preventScroll: true });
    // [V7.5.1] 位置对抗速查自动匹配
    _renderPosAdviceButtons();
    _applyPosAdvice(r.preflopScenario);
  },
  handPageSize: 50, handCurrentPage: 1,
  _selectedHandIds: new Set(),
  // [V6.15.1] 手牌筛选状态
  _handPotFilter: 'all',
  _handSessFilter: 'all',
  // [V6.15.1] 切换手牌行展开/折叠
  toggleHandExpand: function (handId, btn) {
    var existingRow = document.getElementById('hand-expand-row-' + handId);
    if (existingRow) { existingRow.remove(); if (btn) btn.textContent = '▶'; return; }
    if (btn) btn.textContent = '▼';
    var reviews = HandRepo.getAll();
    var r = reviews.find(function (x) { return x.id === handId; });
    if (!r) return;
    var tr = document.createElement('tr');
    tr.id = 'hand-expand-row-' + handId;
    var td = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'padding:10px 14px;background:#0a1628;font-size:0.78em;border-top:1px solid #1e3a5f;line-height:1.6';
    var html = '';
    // 手牌详情
    html += '<div style="color:#cbd5e1;white-space:pre-wrap;margin-bottom:6px">' + Utils.escapeHtml(r.desc || '--') + '</div>';
    // 错误 + 反思
    if (r.mistake) html += '<div style="margin-bottom:4px"><span style="color:#a8afba">错误：</span><span style="color:#c06060">' + Utils.escapeHtml(r.mistake) + '</span></div>';
    if (r.reflection) html += '<div style="margin-bottom:6px"><span style="color:#a8afba">反思：</span><span style="color:#c8ccd0">' + Utils.escapeHtml(r.reflection) + '</span></div>';
    // 操作按钮
    html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">';
    html += '<button class="btn--mini" data-hand-edit="' + r.id + '">✎ 编辑</button>';
    html += '<button class="btn--mini btn--danger" data-hand-delete="' + r.id + '">✕ 删除</button>';
    var markIcon = r.marked ? '★' : '☆';
    var markColor = r.marked ? '#d4a853' : '#a8afba';
    html += '<button class="btn--mini hand-mark-btn" data-hand-mark="' + r.id + '" style="color:' + markColor + '">' + markIcon + ' 标记</button>';
    html += '</div>';
    td.innerHTML = html;
    tr.appendChild(td);
    btn.closest('tr').after(tr);
  },
  // [V6.16.0] 行点击选中——批量栏 UI 状态同步
  _updateHandBatchUI() {
    var selCount = Review._selectedHandIds.size;
    var allRows = document.querySelectorAll('#handBody tr[data-hand-id]');
    var totalVisible = allRows.length;
    var batchBar = document.getElementById('handBatchBar');
    var btn = document.getElementById('handSelectAllBtn');
    var countEl = document.getElementById('handBatchCount');
    if (selCount === 0) {
      batchBar.style.display = 'none';
    } else {
      batchBar.style.display = 'flex';
    }
    if (btn) {
      btn.textContent = (selCount === totalVisible && totalVisible > 0) ? '取消全选' : '全选';
    }
    if (countEl) countEl.textContent = '已选 ' + selCount + ' 手';
    allRows.forEach(function (row) {
      if (Review._selectedHandIds.has(row.dataset.handId)) {
        row.classList.add('is-selected');
      } else {
        row.classList.remove('is-selected');
      }
    });
  },
  renderHandReviews() {
    var self = this;
    var pageSize = self.handPageSize; var pageNum = self.handCurrentPage;
    var allReviews = Utils.sortByDateKey(this.getHandReviews());
    // [V6.15.1] 读取筛选器并应用过滤
    var potFilter = document.getElementById('handPotSizeFilter');
    var sessFilter = document.getElementById('handSessFilter');
    if (potFilter) self._handPotFilter = potFilter.value;
    if (sessFilter) self._handSessFilter = sessFilter.value;
    // 更新 session 筛选下拉选项
    if (sessFilter && sessFilter.options.length <= 2) {
      var sessions = this.getSessions();
      sessions.forEach(function (s) {
        if (!sessFilter.querySelector('option[value="' + s.id + '"]')) {
          var opt = document.createElement('option');
          opt.value = s.id; opt.textContent = s.date + ' ' + s.level;
          sessFilter.appendChild(opt);
        }
      });
    }
    // 应用底池筛选
    if (self._handPotFilter === 'above2') {
      allReviews = allReviews.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 2; });
    } else if (self._handPotFilter === 'above30') {
      allReviews = allReviews.filter(function (r) { return r.pBB != null && Math.abs(r.pBB) >= 30; });
    }
    // 应用 Session 筛选
    if (self._handSessFilter === 'unlinked') {
      allReviews = allReviews.filter(function (r) { return !r.sessionId || r.sessionId === ''; });
    } else if (self._handSessFilter && self._handSessFilter !== 'all') {
      allReviews = allReviews.filter(function (r) { return r.sessionId === self._handSessFilter; });
    }
    // 更新筛选计数
    var countEl = document.getElementById('handFilteredCount');
    if (countEl) countEl.textContent = allReviews.length + ' 手';
    var totalPages = Math.ceil(allReviews.length / pageSize) || 1;
    if (pageNum > totalPages) { pageNum = totalPages; self.handCurrentPage = pageNum; }
    var pageReviews = allReviews.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    var sessions = this.getSessions();
    // [V6.9.3] 模板渲染手牌行
    var tmpl = document.getElementById('tmpl-hand-row');
    var body = document.getElementById('handBody');
    var frag = document.createDocumentFragment();
    pageReviews.forEach(function (r) {
      var s = sessions.find(function (x) { return x.id === r.sessionId; });
      var sessionLabel = s ? Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) : '无';
      var sProfit = s ? Utils.safeFixed(s.profit, 1) : '--';
      var typeLabel = r.potType ? r.potType + (r.board ? ' ' + r.board : '') : '--';
      var handHtml, profitHtml;
      var heroM = r.desc ? r.desc.match(/Hero[^\n\[]*\[([^\]]+)\]/) : null;
      if (heroM && heroM[1]) {
        var cards = heroM[1].split(' ');
        var validRe = /^[2-9TJQKA][shdc]$/i;
        var allValid = cards.every(function (c) { return validRe.test(c); });
        if (allValid) {
          handHtml = Utils.renderCardBadges(heroM[1]);
        } else { handHtml = Utils.escapeHtml((r.desc || '').substring(0, 20)) + '…'; }
      } else { handHtml = Utils.escapeHtml((r.desc || '').substring(0, 20)) + '…'; }
      if (r.pBB != null) { profitHtml = Utils.formatProfitHTML(r.pBB); }
      else { profitHtml = '--'; }
      var row = document.importNode(tmpl.content, true).firstElementChild;
      row.querySelector('[data-bind="date"]').textContent = Utils.formatHandDate(r.date);
      row.querySelector('[data-bind="typeLabel"]').textContent = typeLabel;
      row.querySelector('[data-bind="sessionCell"]').innerHTML = sessionLabel + ' (' + (s ? '±' + sProfit : '') + ')';
      row.querySelector('[data-bind="handHtml"]').innerHTML = handHtml;
      row.querySelector('[data-bind="profitHtml"]').innerHTML = profitHtml;
      row.querySelector('[data-bind="mistake"]').textContent = r.mistake || '--';
      row.setAttribute('data-hand-id', r.id);
      row.querySelector('[data-hand-edit]').setAttribute('data-hand-edit', r.id);
      row.querySelector('[data-hand-delete]').setAttribute('data-hand-delete', r.id);
      // [V6.15.1] 展开 / 标记按钮 — 事件由 #handBody 委托统一处理
      var expandBtn = row.querySelector('[data-hand-expand]');
      if (expandBtn) expandBtn.setAttribute('data-hand-expand', r.id);
      var markBtn = row.querySelector('[data-hand-mark]');
      if (markBtn) {
        markBtn.setAttribute('data-hand-mark', r.id);
        markBtn.textContent = r.marked ? '★' : '☆';
        markBtn.style.color = r.marked ? '#d4a853' : '#a8afba';
      }
      frag.appendChild(row);
    });
    body.replaceChildren(frag);
    self._renderHandPagination(allReviews.length, pageNum, totalPages);
    var batchBar = document.getElementById('handBatchBar');
    var sessSel = document.getElementById('handBatchSessionSelect');
    if (sessSel) {
      sessSel.innerHTML = '<option value="">-- 关联到 Session --</option>';
      sessions.forEach(function (s) { sessSel.innerHTML += '<option value="' + s.id + '">' + Utils.escapeHtml(s.date) + ' ' + Utils.escapeHtml(s.level) + '</option>'; });
    }
    Review._selectedHandIds.clear(); batchBar.style.display = 'none'; document.getElementById('handBatchCount').textContent = '已选 0 手';
  },
  _renderHandPagination(total, pageNum, totalPages) {
    var self = this; var bar = document.getElementById('handPagination');
    if (!bar) return;
    if (total <= self.handPageSize) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    var html = '';
    html += '<button' + (pageNum <= 1 ? ' disabled' : '') + ' data-hand-page="1">«</button>';
    html += '<button' + (pageNum <= 1 ? ' disabled' : '') + ' data-hand-page="' + (pageNum - 1) + '">‹</button>';
    html += '<span class="page-num">第 ' + pageNum + '/' + totalPages + ' 页（共 ' + total + ' 条）</span>';
    html += '<button' + (pageNum >= totalPages ? ' disabled' : '') + ' data-hand-page="' + (pageNum + 1) + '">›</button>';
    html += '<button' + (pageNum >= totalPages ? ' disabled' : '') + ' data-hand-page="' + totalPages + '">»</button>';
    bar.innerHTML = html;
    bar.querySelectorAll('button[data-hand-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { self.handCurrentPage = parseInt(this.dataset.handPage); self.renderHandReviews(); document.getElementById('handBody').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
  },
  getWeekStr(d) {
    d = d || new Date();
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff); const m = new Date(d);
    const y = m.getFullYear(), w = Math.ceil(((m - new Date(y, 0, 1)) / 86400000 + 1) / 7);
    return y + '-W' + String(w).padStart(2, '0');
  },
  generateWeeklyStats() {
    const now = new Date(), day = now.getDay(), diff = now.getDate() - day + (day === 0 ? -6 : 1);
    now.setDate(diff); now.setHours(0, 0, 0, 0);
    const m = new Date(now), s = new Date(m);
    s.setDate(m.getDate() + 6); s.setHours(23, 59, 59, 999);
    const sessions = Utils.sortByDateKey(this.getSessions().filter((x) => { const d = new Date(x.date); return d >= m && d <= s; })),
      hrs = this.getHandReviews().filter((x) => { const d = new Date(x.date); return d >= m && d <= s; });
    let tp = 0, th = 0, tt = 0;
    sessions.forEach((x) => { tp += x.profit; th += x.hands; tt += x.tilt; });
    const mm = new Map();
    sessions.forEach((x) => { if (x.mistake !== '无') x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) mm.set(t, (mm.get(t) || 0) + 1); }); });
    hrs.forEach((x) => { if (x.mistake) x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) mm.set(t, (mm.get(t) || 0) + 1); }); });
    const topMistakes = [...mm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0] + '(' + e[1] + '次)').join(', ') || '无';
    const lwEnd = new Date(m); lwEnd.setDate(lwEnd.getDate() - 1); lwEnd.setHours(23, 59, 59, 999);
    const lwStart = new Date(lwEnd); lwStart.setDate(lwStart.getDate() - 6); lwStart.setHours(0, 0, 0, 0);
    const lwSessions = this.getSessions().filter((x) => { const d = new Date(x.date); return d >= lwStart && d <= lwEnd; });
    const lwHands = this.getHandReviews().filter((x) => { const d = new Date(x.date); return d >= lwStart && d <= lwEnd; });
    const lwMm = new Map();
    lwSessions.forEach((x) => { if (x.mistake !== '无') x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) lwMm.set(t, (lwMm.get(t) || 0) + 1); }); });
    lwHands.forEach((x) => { if (x.mistake) x.mistake.split(', ').forEach((m) => { const t = m.trim(); if (t) lwMm.set(t, (lwMm.get(t) || 0) + 1); }); });
    let trendHtml = '';
    if (lwSessions.length > 0 && mm.size > 0) {
      const trends = [];
      [...mm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach((e) => {
        const lwCount = lwMm.get(e[0]) || 0; const diff = e[1] - lwCount;
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        const color = diff > 0 ? '#c06060' : diff < 0 ? '#6baf7e' : '#a8afba';
        trends.push('<span style="color:' + color + '">' + Utils.escapeHtml(e[0]) + ' ' + arrow + Math.abs(diff) + '</span>');
      });
      trendHtml = trends.length ? '<div style="margin-top:6px;font-size:0.7em;color:#a8afba;text-align:center;line-height:1.6">📈 vs上周：' + trends.join(' · ') + '</div>' : '';
    }
    const autoSummary = this.generateWeeklySummary(sessions, tp, tt, topMistakes);
    const wBb100 = th ? Utils.safeFixed((tp / th) * 100, 1) : 'N/A';
    document.getElementById('weeklyAutoStats').innerHTML = '<div class="stats"><div class="stats__item"><div class="stats__label">本周场次</div><div class="stats__value">' + sessions.length + '</div></div><div class="stats__item ' + (tp >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">本周盈亏</div><div class="stats__value ' + (tp >= 0 ? 'text-win' : 'text-lose') + '">' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB</div></div><div class="stats__item"><div class="stats__label">总手数</div><div class="stats__value">' + th + '</div></div><div class="stats__item ' + (parseFloat(wBb100) >= 0 ? 'stats__item--win' : 'stats__item--lose') + '"><div class="stats__label">bb/100</div><div class="stats__value ' + (parseFloat(wBb100) >= 0 ? 'text-win' : 'text-lose') + '">' + wBb100 + '</div></div><div class="stats__item"><div class="stats__label">平均Tilt</div><div class="stats__value">' + (sessions.length ? Utils.safeFixed(tt / sessions.length, 1) : 'N/A') + '</div></div><div class="stats__item"><div class="stats__label">主要错误</div><div class="stats__value" style="font-size:0.8em">' + Utils.escapeHtml(topMistakes) + '</div></div></div>' + trendHtml;
    document.getElementById('weeklySummary').innerHTML = autoSummary ? '<b>本周总结</b><br>' + autoSummary : '';
    // [V6.18.5] 本周引擎统计
    var wEngineResult = analyze(hrs);
    var wes = document.getElementById('weeklyEngineStats');
    if (wes && wEngineResult.stats.totalHands && wEngineResult.stats.totalHands.value > 0) {
      wes.innerHTML = '<details class="stats-details"><summary class="stats-section-title">Weekly Stats</summary></details>';
      renderStatsPanel({ containerEl: wes.querySelector('.stats-details'), es: wEngineResult.stats, recs: wEngineResult.recommendations, showExtras: false });
      _initStatTooltip('weeklyEngineStats');
    } else if (wes) {
      wes.innerHTML = '';
    }
  },
  generateWeeklySummary(sessions, tp, tt, topMistakes) {
    if (sessions.length === 0) return '';
    const avgTilt = tt / sessions.length;
    let summary = '本周共 ' + sessions.length + ' 场，总盈亏 ' + (tp >= 0 ? '+' + Utils.safeFixed(tp, 1) : Utils.safeFixed(tp, 1)) + ' BB。';
    if (avgTilt >= 7) summary += ' 平均情绪评分 ≥ 7，说明本周心态非常冷静，决策质量较高。保持住这个节奏。';
    else if (avgTilt >= 5) summary += ' 平均情绪评分中等，有一些小波动但没有严重失控。注意识别让你情绪波动的具体场景。';
    else summary += ' 平均情绪评分偏低，可能出现了一些情绪失控的瞬间。建议下周重点做情绪急救练习。';
    if (topMistakes !== '无') summary += ' 主要错误集中在「' + topMistakes + '」，建议在下周的实战中刻意关注这些场景。';
    else summary += ' 你还没有记录具体的错误类型。尝试在每场Session后填写错误类型，几周后就能看到自己的主要漏洞了。';
    return summary;
  },
  getWeeklyReviews() { return WeeklyRepo.getAll(); },
  saveWeeklyReviews(r) { WeeklyRepo.saveAll(r); },
  saveWeeklyReview() {
    const week = this.getWeekStr(), weakness = document.getElementById('weeklyWeakness').value.trim(), plan = document.getElementById('weeklyPlan').value.trim();
    if (!weakness && !plan) { Utils.showToast('请至少填写一项'); return; }
    const reviews = this.getWeeklyReviews(), exist = reviews.find((r) => r.week === week);
    if (exist) { exist.weakness = weakness || exist.weakness; exist.plan = plan || exist.plan; }
    else reviews.push({ week, weakness, plan });
    this.saveWeeklyReviews(reviews);
    document.getElementById('weeklyWeakness').value = ''; document.getElementById('weeklyPlan').value = '';
    const saveBtn = document.getElementById('saveWeeklyBtn');
    const editorPane = document.getElementById('weeklyEditorPane');
    saveBtn.textContent = '保存本周复盘';
    saveBtn.dataset.state = 'create';
    if (editorPane) editorPane.classList.remove('is-editing');
    this.renderWeeklyReviews();
  },
  deleteWeeklyReview(week) { this._confirmDelete(() => this.getWeeklyReviews(), (d) => this.saveWeeklyReviews(d), () => this.renderWeeklyReviews(), 'week', week); },
  editWeeklyReview(week) {
    const reviews = this.getWeeklyReviews();
    const r = reviews.find(function (x) { return x.week === week; });
    if (!r) return;
    document.getElementById('weeklyWeakness').value = r.weakness || '';
    document.getElementById('weeklyPlan').value = r.plan || '';
    const saveBtn = document.getElementById('saveWeeklyBtn');
    const editorPane = document.getElementById('weeklyEditorPane');
    saveBtn.textContent = '更新本周复盘';
    saveBtn.dataset.state = 'edit';
    if (editorPane) {
      editorPane.classList.add('is-editing');
      editorPane.focus({ preventScroll: true });
    }
  },
  renderWeeklyReviews() {
    const reviews = Utils.sortByDateKey(this.getWeeklyReviews(), 'week');
    const rows = [];
    reviews.forEach((r) => { rows.push('<tr><td>' + Utils.escapeHtml(r.week) + '</td><td>' + Utils.escapeHtml(r.weakness || '--') + '</td><td>' + Utils.escapeHtml(r.plan || '--') + '</td><td><button class="btn--mini" data-week-edit="' + r.week + '">✎</button> <button class="btn--mini btn--danger" data-week-delete="' + r.week + '">✕</button></td></tr>'); });
    document.getElementById('weeklyBody').innerHTML = rows.join('');
  },
  exportData() {
    const data = Store.exportAll(); const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'poker_backup_' + Utils.getLocalDate() + '.json';
    a.click(); URL.revokeObjectURL(url);
  },
  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imp = JSON.parse(reader.result);
        if (imp.sessions !== undefined) {
          if (confirm('将合并导入数据（不覆盖已有记录），确定继续？')) { Store.importAll(imp); alert('导入成功！页面将刷新。'); location.reload(); }
        } else Utils.showToast('文件格式不正确');
      } catch (ex) { Utils.showToast('解析失败'); }
    };
    reader.readAsText(file);
  },
  // [V7.4.6] Discover — 自动模式发现渲染
  renderDiscover(options) {
    var findings = Discover.scan();
    var container = document.getElementById('discoverFindings');
    if (!container) return;
    var self = this;
    // [V7.7.2] Quiz 始终初始化（不依赖手牌导入）
    if (!self._quizReady) {
      try { QuizTrainer.init(); _bindQuizUI(); self._quizReady = true; } catch (e) { console.warn('Quiz init failed:', e); }
    }
    if (!findings.length) {
      container.innerHTML = '<div class="empty-state">暂无值得关注的模式<br>导入 50+ 手牌后自动分析</div>';
      return;
    }
    // [V7.4.8] 读取 Quiz 进度用于标记弱项/已掌握
    var quizStages = {};
    try { QuizTrainer.getStages().forEach(function (s) { quizStages[s.key] = s.accuracy; }); } catch(e) {}
    // [V7.9.0 修改] 自动"偏离 GTO"发现已移除，类型映射随之精简
    var typeLabels = { profit_anomaly: '盈亏异常', self_contradiction: '自我矛盾' };
    var typeClasses = { profit_anomaly: 'finding-card--profit', self_contradiction: 'finding-card--contradiction' };
    container.innerHTML = '<section class="learning-findings"><div class="card__title">模式发现</div>' +
      '<div class="learning-findings__summary">基于 ' + Discover.getScanHandCount() + ' 手牌自动分析，发现 ' + findings.length + ' 条模式</div><div class="finding-list">' +
      findings.map(function (f) {
        var typeClass = typeClasses[f.type] || 'finding-card--gto';
        var badges = f.improved ? ' <span class="status-inline status-inline--success">已改善</span>' : '';
        // [V7.4.8] Quiz 进度标记
        var quizAcc = quizStages[f.category];
        if (quizAcc !== undefined && quizAcc < 50) badges += ' <span class="status-inline status-inline--danger">弱项 ' + quizAcc + '%</span>';
        else if (quizAcc !== undefined && quizAcc > 80) badges += ' <span class="status-inline status-inline--success">已掌握</span>';
        // 针对训练按钮
        var escapedId = Utils.escapeHtml(f.id);
        var quizBtn = f.category ? ' <button class="btn--mini" data-discover-quiz="' + escapedId + '">开始 Quiz</button>' : '';
        return '<article class="finding-card ' + typeClass + '">' +
          '<div class="finding-card__header"><span><strong>' + Utils.escapeHtml(typeLabels[f.type] || f.type) + '</strong>' + badges + '</span>' +
          '<span class="finding-card__count">' + f.handCount + ' 手</span></div>' +
          '<div class="finding-card__title">' + Utils.escapeHtml(f.title) + '</div>' +
          (f.localFreq !== undefined ? '<div class="finding-card__meta">CBet ' + Utils.escapeHtml(String(f.localFreq)) + '% vs 场景平均 ' + Utils.escapeHtml(String(f.globalFreq)) + '%' + (f.gtoRef !== '—' ? ' · ' + Utils.escapeHtml(String(f.gtoRef)) : '') + '</div>' : '') +
          (f.avgProfit !== undefined ? '<div class="finding-card__meta">平均盈亏 ' + Utils.escapeHtml(String(f.avgProfit)) + ' BB</div>' : '') +
          '<div class="finding-card__actions"><button class="btn--mini" data-discover-hands="' + escapedId + '">查看手牌</button>' + quizBtn + '</div>' +
          '<div class="finding-card__detail" id="discoverDetail-' + escapedId + '" style="display:none"></div>' +
          '</article>';
      }).join('') + '</div></section>';
    _bindDiscoverQuiz();

    // 点击查看手牌 → 展开列表（仅绑定一次）
    if (!container.dataset.discoverBound) {
      container.dataset.discoverBound = '1';
      container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-discover-hands]');
      if (!btn) return;
      var fid = btn.dataset.discoverHands;
      var detail = document.getElementById('discoverDetail-' + fid);
      if (detail.style.display === 'block') { detail.style.display = 'none'; return; }
      var f = findings.find(function (x) { return x.id === fid; });
      if (!f) return;
      var hands = Discover.getHandsByIds(f.handIds || []);
      var sessMap = {};
      SessionRepo.getAll().forEach(function (s) { sessMap[s.id] = s; });
      detail.style.display = 'block';
      detail.innerHTML = '<table class="session-table finding-hands-table"><thead><tr><th>时间</th><th>类型</th><th>Session</th><th>手牌</th><th>盈亏</th></tr></thead><tbody>' +
        hands.map(function (h) {
          var profitStr = h.pBB != null ? (h.pBB >= 0 ? '+' : '') + Utils.safeFixed(h.pBB, 1) + ' BB' : '--';
          var sess = h.sessionId ? sessMap[h.sessionId] : null;
          var sDate = sess ? (sess.date || '') + ' ' + (sess.level || '') : '--';
          var heroM = h.desc ? h.desc.match(/Hero[^\n\[]*\[([^\]]+)\]/) : null;
          var handHtml = heroM && heroM[1] ? Utils.renderCardBadges(heroM[1]) : '--';
          return '<tr data-discover-hand="' + h.id + '" style="cursor:pointer"><td>' + Utils.formatHandDate(h.date) + '</td><td>' + Utils.escapeHtml(h.potType || '--') + '</td><td>' + Utils.escapeHtml(sDate) + '</td><td>' + handHtml + '</td><td style="color:' + (h.pBB >= 0 ? '#6baf7e' : '#c06060') + '">' + profitStr + '</td></tr>';
        }).join('') + '</tbody></table>';
      // 手牌行点击跳转
      detail.querySelectorAll('[data-discover-hand]').forEach(function (row) {
        row.addEventListener('click', function () {
          var handId = this.dataset.discoverHand;
          Navigation.goToHand(handId);
        });
      });
    });
    }  // end if (!container.dataset.discoverBound)
    _renderDiscoverHeatmap();  // [V7.6.1]
  },

  startLearningTarget: function (target) {
    if (!target) return false;
    var quizDetails = document.getElementById('discoverQuizDetails');
    if (quizDetails) quizDetails.open = true;
    var scenarioSel = document.getElementById('quizScenario');
    if (scenarioSel && target.scenario) {
      var scenarioExists = Array.prototype.some.call(scenarioSel.options, function (option) {
        return option.value === target.scenario;
      });
      if (scenarioExists && scenarioSel.value !== target.scenario) {
        scenarioSel.value = target.scenario;
        scenarioSel.dispatchEvent(new Event('change'));
      }
    }
    var stageSel = document.getElementById('quizStage');
    if (stageSel && target.boardCategory) {
      var stageExists = Array.prototype.some.call(stageSel.options, function (option) {
        return option.value === target.boardCategory;
      });
      if (stageExists) {
        stageSel.value = target.boardCategory;
        stageSel.dispatchEvent(new Event('change'));
      }
    }
    return true;
  },
};

// [V7.6.1] Discover 热力图渲染
var CAT_LABELS_SHORT = {
  dryAHigh: '干燥A高', paired_high: '公对高', paired_low: '公对低',
  flushy_dry: '双花干燥', straighty: '听顺面', flushy_straighty: '双花听顺',
  monotone: '天花面', dry_low: '低牌干燥', made_straight: '天顺面', trips_board: '三条面'
};
function _heatmapProfitColor(val, maxAbs) {
  var ratio = Math.max(-1, Math.min(1, val / (maxAbs || 1)));
  if (ratio >= 0) return 'rgba(46,160,67,' + (0.15 + ratio * 0.7).toFixed(2) + ')';
  return 'rgba(248,81,73,' + (0.15 + Math.abs(ratio) * 0.7).toFixed(2) + ')';
}
function _heatmapDevColor(val, maxAbs) {
  var ratio = Math.max(-1, Math.min(1, val / (maxAbs || 1)));
  if (ratio >= 0) return 'rgba(248,81,73,' + (0.15 + ratio * 0.7).toFixed(2) + ')';
  return 'rgba(88,166,255,' + (0.15 + Math.abs(ratio) * 0.7).toFixed(2) + ')';
}
function _renderDiscoverHeatmap() {
  var card = document.getElementById('discoverHeatmapCard');
  if (!card) return;
  var data = Discover.getHeatmapData();
  if (!data || !data.categories.length || !data.scenarios.length) {
    card.style.display = 'none'; return;
  }
  card.style.display = '';
  var activeBtn = document.querySelector('.hm-view-btn.is-active');
  var view = activeBtn ? activeBtn.dataset.hmView : 'profit';
  _drawHeatmap(data, view);
}
function _drawHeatmap(data, view) {
  var container = document.getElementById('discoverHeatmapChart');
  if (!container) return;
  var categories = data.categories;
  var scenarios = data.scenarios;
  var cells = data.cells;
  var cellH = 40, leftPad = 82, topPad = 36;
  var W = container.clientWidth || 600;
  var H = topPad + scenarios.length * cellH + 12;
  var dpr = window.devicePixelRatio || 1;
  var canvas = container.querySelector('canvas') || document.createElement('canvas');
  if (!canvas.parentElement) container.appendChild(canvas);
  var prevW = canvas._prevW, prevH = canvas._prevH;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  canvas._prevW = W; canvas._prevH = H;
  // 收集值范围
  var values = [];
  for (var rr = 0; rr < scenarios.length; rr++) {
    for (var cc = 0; cc < categories.length; cc++) {
      var ck = categories[cc] + '|' + scenarios[rr];
      var cv = cells[ck];
      if (!cv || cv.handCount < 5) continue;
      if (view === 'profit') { values.push(cv.avgProfit); }
      else if (cv.gtoAvgCbet != null) { values.push(cv.cbetFreq - cv.gtoAvgCbet); }
    }
  }
  var maxAbs = 1;
  for (var vi = 0; vi < values.length; vi++) {
    if (Math.abs(values[vi]) > maxAbs) maxAbs = Math.abs(values[vi]);
  }
  // 格子
  var cellW = (W - leftPad) / categories.length;
  var hitCells = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (var r = 0; r < scenarios.length; r++) {
    for (var c = 0; c < categories.length; c++) {
      var key = categories[c] + '|' + scenarios[r];
      var cell = cells[key];
      var x = leftPad + c * cellW, y = topPad + r * cellH;
      var fillColor = '#1e1e1e', textStr = '';
      if (cell && cell.handCount >= 5) {
        if (view === 'profit') {
          fillColor = _heatmapProfitColor(cell.avgProfit, maxAbs);
          textStr = (cell.avgProfit >= 0 ? '+' : '') + Utils.safeFixed(cell.avgProfit, 1);
        } else {
          if (cell.gtoAvgCbet != null) {
            var dev = cell.cbetFreq - cell.gtoAvgCbet;
            fillColor = _heatmapDevColor(dev, maxAbs);
            textStr = (dev >= 0 ? '+' : '') + dev + '%';
          } else { fillColor = '#1e1e1e'; textStr = 'N/A'; }
        }
      } else { textStr = cell && cell.handCount > 0 ? '(' + cell.handCount + ')' : ''; }
      ctx.fillStyle = fillColor;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      ctx.fillStyle = cell && cell.handCount >= 5 ? '#fff' : '#666';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(textStr, x + cellW / 2, y + cellH / 2);
      hitCells.push({ x: x, y: y, w: cellW, h: cellH, category: categories[c], scenario: scenarios[r], cell: cell, view: view });
    }
  }
  // X 轴标签
  ctx.fillStyle = '#8b949e';
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (var c2 = 0; c2 < categories.length; c2++) {
    ctx.fillText(CAT_LABELS_SHORT[categories[c2]] || categories[c2], leftPad + c2 * cellW + cellW / 2, topPad - 10);
  }
  // Y 轴标签
  ctx.textAlign = 'right';
  for (var r2 = 0; r2 < scenarios.length; r2++) {
    ctx.fillText(scenarios[r2], leftPad - 6, topPad + r2 * cellH + cellH / 2);
  }
  canvas._hitCells = hitCells;
  canvas._heatmapSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // hover tooltip（仅绑定一次）
  if (!canvas._heatmapBound) {
    canvas._heatmapBound = true;
    var tt = document.createElement('div');
    tt.className = 'chart-tooltip'; tt.id = 'heatmapTooltip';
    container.style.position = 'relative';
    container.appendChild(tt);
    canvas.addEventListener('mousemove', function (e) {
      var hc = canvas._hitCells;
      if (!hc || !canvas._heatmapSnapshot) return;
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
      // 恢复快照
      var ctx2 = canvas.getContext('2d');
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.scale(dpr, dpr);
      ctx2.putImageData(canvas._heatmapSnapshot, 0, 0);
      for (var i = 0; i < hc.length; i++) {
        var h = hc[i];
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2;
          ctx2.strokeRect(h.x + 1, h.y + 1, h.w - 2, h.h - 2);
          var cd = h.cell;
          var html = '<b>' + (CAT_LABELS_SHORT[h.category] || h.category) + ' &times; ' + h.scenario + '</b><br>';
          if (cd && cd.handCount >= 5) {
            html += '手数: ' + cd.handCount + '<br>盈亏: ' + (cd.avgProfit >= 0 ? '+' : '') + Utils.safeFixed(cd.avgProfit, 1) + ' BB/手<br>CBet: ' + cd.cbetFreq + '%';
            if (cd.gtoAvgCbet != null) html += ' (旧GTO ' + cd.gtoAvgCbet + '%)';  // [V7.9.0 修改]
          } else { html += '数据不足 (' + (cd ? cd.handCount : 0) + ' 手)'; }
          tt.innerHTML = html; tt.style.display = 'block';
          tt.style.left = Math.min(mx + 14, W - 160) + 'px';
          tt.style.top = Math.max(0, my - 60) + 'px';
          canvas.style.cursor = 'pointer';
          return;
        }
      }
      tt.style.display = 'none'; canvas.style.cursor = 'default';
    });
    canvas.addEventListener('mouseleave', function () {
      tt.style.display = 'none';
      if (canvas._heatmapSnapshot) {
        var ctx3 = canvas.getContext('2d');
        ctx3.setTransform(1, 0, 0, 1, 0, 0);
        ctx3.scale(dpr, dpr);
        ctx3.putImageData(canvas._heatmapSnapshot, 0, 0);
      }
    });
  }
  // 图例
  var legEl = document.getElementById('discoverHeatmapLegend');
  if (legEl) {
    if (view === 'profit') legEl.innerHTML = '<span style="color:#f85149">■</span> 亏损 &larr; <span style="color:#8b949e">■</span> 持平 &rarr; <span style="color:#2ea043">■</span> 盈利 &nbsp; BB/手';
    // [V7.9.0 修改] 旧 GTO 对照改标注并注明适用范围未验证（scoped legacy reference）
    else legEl.innerHTML = '<span style="color:#58a6ff">■</span> 低于旧GTO &larr; <span style="color:#8b949e">■</span> 吻合 &rarr; <span style="color:#f85149">■</span> 高于旧GTO &nbsp; 偏离% &nbsp; <span style="color:#555">灰色=N/A</span><br><span style="color:#8b949e;font-size:0.9em">' + Utils.escapeHtml(GTO_LEGACY_SCOPE.note) + '</span>';
  }
}

// [V7.4.7] GTO Quiz UI 绑定（从 odds.js 迁入 Discover 面板）
function _bindQuizUI() {
  var scenarioSel = document.getElementById('quizScenario');
  var stageSel = document.getElementById('quizStage');
  var questionDiv = document.getElementById('quizQuestion');
  var boardEl = document.getElementById('quizBoard');
  var catEl = document.getElementById('quizCategory');
  var ctxEl = document.getElementById('quizContext');
  var actionsEl = document.getElementById('quizActions');
  var submitBtn = document.getElementById('quizSubmitBtn');
  var resultEl = document.getElementById('quizResult');
  var nextBtn = document.getElementById('quizNextBtn');
  var statsEl = document.getElementById('quizStats');
  if (!scenarioSel || !stageSel) return; // Quiz HTML 未加载
  // [V7.9.0 新增] 旧 GTO 适用范围声明（单一来源：gtoBaseline.GTO_LEGACY_SCOPE）
  var quizScopeEl = document.getElementById('quizScopeNote');
  if (quizScopeEl) quizScopeEl.textContent = GTO_LEGACY_SCOPE.note;
  var chosenAction = null;
  var scenarios = QuizTrainer.getScenarios();
  scenarioSel.innerHTML = scenarios.map(function (s) { return '<option value="' + s.key + '">' + s.label.split(' —')[0] + '</option>'; }).join('');
  scenarioSel.value = QuizTrainer.getScenario();
  scenarioSel.addEventListener('change', function () { QuizTrainer.setScenario(this.value); _renderStages(); _nextQuestion(); });
  function _renderStages() {
    var stages = QuizTrainer.getStages();
    stageSel.innerHTML = '<option value="">随机出题</option>' + stages.map(function (s) { return '<option value="' + s.key + '">' + s.name + ' (' + s.accuracy + '%)</option>'; }).join('');
  }
  stageSel.addEventListener('change', function () { _nextQuestion(); });
  function _nextQuestion() {
    chosenAction = null;
    var q = QuizTrainer.next(stageSel.value || null);
    if (!q) { questionDiv.style.display = 'none'; return; }
    questionDiv.style.display = 'block';
    boardEl.innerHTML = q.boardDisplay; catEl.textContent = q.category.name;
    ctxEl.textContent = '作为 ' + q.hero + ' vs ' + q.villain + '，你应该？';
    actionsEl.innerHTML = q.actions.map(function (a) { return '<button class="btn--mini quiz-act-btn" data-action="' + a.key + '">' + a.label + '</button>'; }).join('');
    resultEl.style.display = 'none'; nextBtn.style.display = 'none'; submitBtn.style.display = 'block';
    actionsEl.querySelectorAll('.quiz-act-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { actionsEl.querySelectorAll('.quiz-act-btn').forEach(function (b) { b.classList.remove('is-chosen'); }); btn.classList.add('is-chosen'); chosenAction = btn.dataset.action; });
    });
  }
  submitBtn.addEventListener('click', function () {
    if (!chosenAction) return;
    var result = QuizTrainer.answer(chosenAction);
    if (!result) return;
    resultEl.style.display = 'block';
    // [V7.6.3] 三色反馈：绿=正确 黄=可接受 红=错误
    var rColor = result.color === 'green' ? '#6baf7e' : result.color === 'yellow' ? '#d4a853' : '#c06060';
    resultEl.innerHTML = '<div class="qr-verdict" style="color:' + rColor + '">' + Utils.escapeHtml(result.message) + '</div><div style="font-size:0.85em;color:#8b949e;margin-top:4px">你选了 ' + Utils.escapeHtml(result.chosenLabel) + '</div><div style="margin-top:6px">GTO 频率分布：</div>' + result.freqBars.map(function (b) { return '<div class="qr-bar"><span class="qr-label">' + b.label + '</span><span style="flex:1;color:#909090;font-size:0.8em">' + b.bar + '</span><span class="qr-pct">' + b.freq + '%</span></div>'; }).join('');
    submitBtn.style.display = 'none'; nextBtn.style.display = 'block'; _renderStats();
  });
  nextBtn.addEventListener('click', function () { _nextQuestion(); });
  function _renderStats() {
    var stats = QuizTrainer.getStats(); var stages = QuizTrainer.getStages();
    statsEl.innerHTML = '<div class="qs-row"><span>总体</span><span style="color:#6baf7e">' + stats.ok + '✓</span><span style="color:#c06060">' + stats.fail + '✗</span><span>' + stats.accuracy + '%</span></div>' + stages.map(function (s) { var total = s.ok + s.fail || 1; var pct = s.ok / total * 100; return '<div class="qs-row"><span>' + s.name + '</span><div class="qs-bar"><div class="qs-bar-fill" style="width:' + pct + '%;background:' + (pct > 80 ? '#6baf7e' : pct > 50 ? '#d4a853' : '#c06060') + '"></div></div><span>' + Math.round(pct) + '%</span></div>'; }).join('');
    _renderErrorList();
  }
  _renderStages(); _nextQuestion(); _renderStats();
}

// [V7.5.0] 发现→训练：同时设置场景 + 牌面阶段
function _bindDiscoverQuiz() {
  document.querySelectorAll('[data-discover-quiz]').forEach(function (btn) {
    if (btn.dataset.quizBound) return;
    btn.dataset.quizBound = '1';
    btn.addEventListener('click', function () {
      var findingId = this.dataset.discoverQuiz || '';
      var finding = Discover.getFindings().find(function (item) { return item.id === findingId; });
      Navigation.goToLearningTarget(finding ? getLearningTarget(finding) : null);
    });
  });
}

// [V7.6.2] 错题集 UI
function _renderErrorList() {
  var listEl = document.getElementById('quizErrorList');
  var countEl = document.getElementById('quizErrorCount');
  var actionsEl = document.getElementById('quizErrorActions');
  if (!listEl) return;
  var errors = QuizTrainer.getErrors();
  if (countEl) countEl.textContent = '(' + errors.length + ')';
  if (!errors.length) {
    // 空状态：显示统计摘要
    var stats = QuizTrainer.getStats();
    var stages = QuizTrainer.getStages();
    var weakStages = stages.filter(function (s) { return s.total > 0 && s.accuracy < 50; });
    var html = '<div class="empty-state empty-state--compact">';
    if (stats.total > 0) {
      html += '暂无错题，继续保持！<br>当前总准确率：' + stats.accuracy + '%（' + stats.ok + '/' + stats.total + '）';
      if (weakStages.length) {
        html += '<br>薄弱环节：' + weakStages.map(function (s) { return '<span style="color:#c06060">' + s.name + ' ' + s.accuracy + '%</span>'; }).join('、');
      }
    } else {
      html += '暂无错题，开始训练吧！';
    }
    html += '</div>';
    listEl.innerHTML = html;
    if (actionsEl) actionsEl.style.display = 'none';
    return;
  }
  if (actionsEl) actionsEl.style.display = '';
  // 按 category 分组排序
  var CAT_ORDER = ['dryAHigh', 'flushy_dry', 'straighty', 'flushy_straighty', 'paired_high', 'monotone', 'dry_low', 'paired_low', 'made_straight', 'trips_board'];
  var groups = {};
  errors.forEach(function (e) {
    var cat = e.category || 'unknown';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  });
  var catKeys = Object.keys(groups).sort(function (a, b) {
    return (CAT_ORDER.indexOf(a) >= 0 ? CAT_ORDER.indexOf(a) : 99) - (CAT_ORDER.indexOf(b) >= 0 ? CAT_ORDER.indexOf(b) : 99);
  });
  // 获取 Discover 热力图数据用于联动
  var heatmapData = null;
  try { heatmapData = Discover.getHeatmapData(); } catch (e) {}
  var html = '';
  catKeys.forEach(function (cat) {
    var items = groups[cat];
    items.sort(function (a, b) { return b.timestamp - a.timestamp; });
    var catLabel = (CAT_LABELS_SHORT[cat] || cat);
    html += '<div class="quiz-error-group"><div style="font-size:0.75em;color:#8b949e;margin-bottom:4px;text-transform:uppercase">' + catLabel + ' (' + items.length + ')</div>';
    items.forEach(function (e) {
      var timeStr = _formatRelativeTime(e.timestamp);
      // Discover 联动数据
      var discoverLine = '';
      if (heatmapData) {
        var cellKey = e.category + '|' + e.scenario;
        var cell = heatmapData.cells[cellKey];
        if (cell && cell.handCount >= 5) {
          discoverLine = '<div style="font-size:0.7em;color:#6b7280;margin-top:2px">实战 ' + cell.handCount + ' 手，平均 ' + (cell.avgProfit >= 0 ? '+' : '') + Utils.safeFixed(cell.avgProfit, 1) + ' BB/手</div>';
        }
      }
      html += '<div class="quiz-error-item" data-error-id="' + e.id + '">' +
        '<div style="flex-shrink:0;margin-right:8px">' + (e.questionDisplay ? e.questionDisplay.boardDisplay : Utils.renderCardBadges(e.boardCode)) + '</div>' +
        '<div class="quiz-error-meta">' +
        '<div style="font-size:0.85em">你选了 <span style="color:#c06060">' + Utils.escapeHtml(e.userAnswerLabel) + '</span> → GTO推荐 <span style="color:#6baf7e">' + Utils.escapeHtml(e.correctAnswerLabel) + '</span></div>' +
        '<div style="font-size:0.7em;color:#6b7280">' + timeStr + (e.scenario ? ' · ' + e.scenario : '') + '</div>' +
        discoverLine +
        '</div>' +
        '<button class="btn--mini error-retry-btn" data-error-id="' + e.id + '" style="flex-shrink:0;margin-left:4px">重新作答</button>' +
        '<button class="quiz-error-delete-btn" data-error-id="' + e.id + '" data-delete="' + e.id + '">✕</button>' +
        '<div class="quiz-error-quiz" id="errorQuiz-' + e.id + '" style="display:none;width:100%;margin-top:8px"></div>' +
        '</div>';
    });
    html += '</div>';
  });
  listEl.innerHTML = html;
  _bindErrorActions(listEl);
}

function _bindErrorActions(listEl) {
  if (listEl.dataset.errorBound) return;
  listEl.dataset.errorBound = '1';
  // 点击委托
  listEl.addEventListener('click', function (e) {
    var retryBtn = e.target.closest('.error-retry-btn');
    var deleteBtn = e.target.closest('.quiz-error-delete-btn');
    if (retryBtn) {
      var id = retryBtn.dataset.errorId;
      _startErrorRetry(id);
      return;
    }
    if (deleteBtn) {
      var id2 = deleteBtn.dataset.delete;
      QuizTrainer.removeError(id2);
      _renderErrorList();
      return;
    }
  });
  // 清空按钮
  var clearBtn = document.getElementById('quizErrorClearBtn');
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', function () {
      QuizTrainer.clearErrors();
      _renderErrorList();
    });
  }
  // [V7.6.2] 移动端左滑删除
  listEl.addEventListener('touchstart', function (e) {
    var item = e.target.closest('.quiz-error-item');
    if (!item) return;
    item._touchStartX = e.touches[0].clientX;
    item._touchStartY = e.touches[0].clientY;
  });
  listEl.addEventListener('touchend', function (e) {
    var item = e.target.closest('.quiz-error-item');
    if (!item) return;
    var dx = (e.changedTouches[0].clientX - (item._touchStartX || 0));
    var dy = Math.abs(e.changedTouches[0].clientY - (item._touchStartY || 0));
    if (dx < -40 && dy < 20) {
      // 先收起其他已滑开的
      listEl.querySelectorAll('.quiz-error-item.swiped').forEach(function (el) {
        if (el !== item) el.classList.remove('swiped');
      });
      item.classList.add('swiped');
    } else if (dx > 20 || Math.abs(dx) < 5) {
      item.classList.remove('swiped');
    }
  });
  // PC端悬停显示删除按钮
  listEl.addEventListener('mouseover', function (e) {
    var item = e.target.closest('.quiz-error-item');
    if (item) item._hovered = true;
  });
  listEl.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.quiz-error-item');
    if (item && item._hovered) { item._hovered = false; item.classList.remove('swiped'); }
  });
}

function _startErrorRetry(errorId) {
  var errors = QuizTrainer.getErrors();
  var errorRec = errors.find(function (e) { return e.id === errorId; });
  if (!errorRec) return;
  // 收起其他已展开的错题答题区
  document.querySelectorAll('.quiz-error-quiz').forEach(function (el) {
    el.style.display = 'none';
    el.innerHTML = '';
  });
  var quizContainer = document.getElementById('errorQuiz-' + errorId);
  if (!quizContainer) return;
  quizContainer.style.display = 'block';
  // 设置场景
  QuizTrainer.setScenario(errorRec.scenario);
  var scenarioSel = document.getElementById('quizScenario');
  if (scenarioSel) { scenarioSel.value = errorRec.scenario; }
  // 生成指定 boardCode 的题目
  var q = QuizTrainer.next(null, errorRec.boardCode);
  if (!q) { quizContainer.innerHTML = '<div class="text-muted">题目数据不可用</div>'; return; }
  // 渲染答题区
  var actionsHtml = q.actions.map(function (a) {
    return '<button class="toggle-btn error-action-btn" data-action="' + a.key + '">' + a.label + '</button>';
  }).join('');
  quizContainer.innerHTML =
    '<div style="font-size:0.9em;margin-bottom:6px">' + q.boardDisplay + ' <span style="color:#8b949e">' + q.category.name + '</span></div>' +
    '<div style="font-size:0.8em;color:#8b949e;margin-bottom:8px">' + q.context + '</div>' +
    '<div class="quiz-actions">' + actionsHtml + '</div>' +
    '<button class="btn error-submit-btn" style="margin-top:8px">提交</button>' +
    '<div class="quiz-result error-result-area" style="display:none;margin-top:8px"></div>' +
    '<button class="btn btn--secondary error-next-btn" style="display:none;margin-top:4px">下一题 →</button>';
  // 绑定事件
  var chosenAction = null;
  quizContainer.querySelectorAll('.error-action-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      quizContainer.querySelectorAll('.error-action-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      chosenAction = btn.dataset.action;
    });
  });
  quizContainer.querySelector('.error-submit-btn').addEventListener('click', function () {
    if (!chosenAction) return;
    var result = QuizTrainer.answer(chosenAction);
    if (!result) return;
    var resultArea = quizContainer.querySelector('.error-result-area');
    var submitBtn = quizContainer.querySelector('.error-submit-btn');
    var nextBtn = quizContainer.querySelector('.error-next-btn');
    resultArea.style.display = 'block';
    // [V7.6.3] 三色反馈
    var erColor = result.color === 'green' ? '#6baf7e' : result.color === 'yellow' ? '#d4a853' : '#c06060';
    resultArea.innerHTML = '<div class="qr-verdict" style="color:' + erColor + '">' + Utils.escapeHtml(result.message) + '</div>' +
      '<div style="font-size:0.85em;color:#8b949e;margin-top:4px">你选了 ' + Utils.escapeHtml(result.chosenLabel) + '</div>' +
      '<div style="margin-top:6px">' + result.freqBars.map(function (fb) {
        return '<div class="qr-bar"><span class="qr-label">' + fb.label + '</span><span class="qr-pct">' + fb.freq + '%</span><span style="color:#8b949e">' + fb.bar + '</span></div>';
      }).join('') + '</div>';
    submitBtn.style.display = 'none';
    nextBtn.style.display = '';
    if (result.result === 'correct') {
      resultArea.innerHTML += '<div style="color:#6baf7e;font-size:0.85em;margin-top:4px">✅ 答对了！已从错题集移除最早的一条记录</div>';
      var remaining = QuizTrainer.getErrors().filter(function (e) { return e.boardCode === errorRec.boardCode && e.scenario === errorRec.scenario; });
      if (!remaining.length) {
        setTimeout(function () {
          quizContainer.style.display = 'none';
          _renderErrorList();
        }, 1500);
      }
    } else if (result.result === 'acceptable') {
      resultArea.innerHTML += '<div style="color:#d4a853;font-size:0.85em;margin-top:4px">⚠️ 可接受但不计入正确，错题记录保留不变</div>';
    }
  });
  quizContainer.querySelector('.error-next-btn').addEventListener('click', function () {
    quizContainer.style.display = 'none';
    quizContainer.innerHTML = '';
    _renderErrorList();
  });
}

// [V7.6.2] 相对时间格式化
function _formatRelativeTime(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  var d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
