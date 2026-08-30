// [V7.4.6] Discover — 自动模式发现引擎
// [V7.9.0 修改] 发现类型：自我矛盾 / 盈亏异常（自动"偏离 GTO"发现已移除：旧 GTO 数据无适用范围元数据，
// 只作 scoped legacy reference，不再对主线手牌自动打"偏离 GTO"标记）
import { Utils, PubSub } from '../utils.js';
import { HandRepo } from '../store/store.js';
import { getGTOReference } from '../data/strategy/gtoBaseline.js';  // [V7.9.0 修改] detectExtremes 已随自动偏离发现移除
import { createLearningSnapshot, getLearningTarget } from './analysisReadModel.js';

// 分类标签
var CAT_LABELS = {
  dryAHigh: '干燥彩虹 A 高', paired_high: '公对面（高）', paired_low: '公对面（低）',
  flushy_dry: '双花干燥', straighty: '听顺面', flushy_straighty: '双花听顺',
  monotone: '天花面', dry_low: '低牌干燥',
  made_straight: '天顺面', trips_board: '三条面'
};
var SCENE_LABELS = { BTNvsBB: 'BTN vs BB', SBvsBB: 'SB vs BB', COvsBTN: 'CO vs BTN' };

// 存储
function _loadState() {
  try { return JSON.parse(localStorage.getItem('pa_discoverState')) || {}; } catch (e) { return {}; }
}
function _saveState(s) {
  localStorage.setItem('pa_discoverState', JSON.stringify(s));
}

export var Discover = {
  _findings: [],
  _state: {},

  init: function () {
    this._state = _loadState();
    if (!this._state.findings) this._state.findings = [];
    if (!this._state.scanHandCount) this._state.scanHandCount = 0;
    if (!this._state.archive) this._state.archive = [];
    // 清理 7 天前的已改善记录
    var now = Date.now();
    this._state.archive = (this._state.archive || []).filter(function (a) { return now - a.archivedAt < 7 * 86400000; });
    // [V7.9.0 新增] 订阅手牌数据变更：任何增删改/导入/恢复后强制下次重扫，
    // 不再只依赖"手牌总数未变"判断缓存（修复编辑同数量手牌后 Discover 不刷新）
    if (!this._handDataSubscribed) {
      this._handDataSubscribed = true;
      PubSub.on('handDataChanged', function () {
        Discover._findings = [];
        Discover._state.scanHandCount = 0;
      });
    }
  },

  _scanning: false,
  scan: function () {
    if (this._scanning) return this._findings;  // [V7.4.7] 防重入
    this._scanning = true;
    try {
    var snapshot = createLearningSnapshot(HandRepo.getAll());
    var hands = snapshot.hands;
    if (!hands || hands.length < 50) { return []; }
    var totalHands = hands.length;
    // 如果手牌总数未变且已有结果，直接返回缓存
    if (this._state.scanHandCount && totalHands === this._state.scanHandCount && this._findings.length) { return this._findings; }
    this._state.scanHandCount = totalHands;
    this._findings = [];
    var findings = [];

    // 构建分组：category × scenario（boardCategory 为空的手牌跳过）
    var groups = {};
    snapshot.eligibleHands.forEach(function (h) {
      var cat = h.boardCategory;
      var sc = h.preflopScenario || 'other';
      var key = cat + '|' + sc;
      if (!groups[key]) groups[key] = { hands: [], profit: 0 };
      groups[key].hands.push(h);
      groups[key].profit += (h.pBB || 0);
    });
    // 遍历分组检测发现
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      if (g.hands.length < 15) return;
      var cat = key.split('|')[0];
      var sc = key.split('|')[1];
      var avgProfit = g.profit / g.hands.length;

      // 类型 2：盈亏异常（优先级最高）
      if (avgProfit < -0.5) {
        findings.push({
          id: 'profit_' + key,
          type: 'profit_anomaly',
          priority: 1,
          title: (CAT_LABELS[cat] || cat) + ' · ' + (SCENE_LABELS[sc] || sc) + ' — 平均亏损 ' + Utils.safeFixed(avgProfit, 1) + ' BB',
          category: cat, scenario: sc, handCount: g.hands.length,
          avgProfit: Utils.safeFixed(avgProfit, 1),
          handIds: g.hands.map(function (h) { return h.id; }),
        });
      }

      // 类型 1：自我矛盾（与同场景平均频率偏差 > 10%）
      // [V7.4.9] 只在同一 preflopScenario 内对比，避免场景自然差异干扰
      var scenarioHands = hands.filter(function (h) { return (h.preflopScenario || 'other') === sc; });
      var localFreq = _calcCBetFreq(g.hands);
      var sceneAvg = _calcCBetFreq(scenarioHands.length >= 10 ? scenarioHands : hands);
      if (Math.abs(localFreq - sceneAvg) > 10) {
          var gtoRef = '—';
          try {
            var ref = getGTOReference(sc, g.hands[0].boardCode);
            if (ref) {
              var gtoTotal = (ref.bet75||0) + (ref.bet50||0) + (ref.bet33||0);
              gtoRef = '旧GTO参考 CBet ' + Math.round(gtoTotal) + '%';  // [V7.9.0 修改] 标明旧数据来源
            }
          } catch(e) {}
          findings.push({
            id: 'self_' + key,
            type: 'self_contradiction',
            priority: 2,
            title: (CAT_LABELS[cat] || cat) + ' · ' + (SCENE_LABELS[sc] || sc) + ' — CBet ' + localFreq + '% vs 场景平均 ' + sceneAvg + '% · ' + gtoRef,
            category: cat, scenario: sc, handCount: g.hands.length,
            localFreq: localFreq, globalFreq: sceneAvg, gtoRef: gtoRef,
            handIds: g.hands.map(function (h) { return h.id; }),
          });
        }
    });

    // [V7.9.0 移除] 类型 3"偏离 GTO"（极端阈值逐手打标）：旧 GTO 数据无适用范围元数据，
    // 不满足条件的手牌会被误标"偏离 GTO"；保留 getGTOReference 供自我矛盾参考与热力图对照。

    // 排序：盈亏异常 > 自我矛盾
    findings.sort(function (a, b) { return a.priority - b.priority; });
    this._findings = findings;

    // 更新已改善标记
    var saved = this._state.findings || [];
    findings.forEach(function (f) {
      var savedF = saved.find(function (s) { return s.id === f.id; });
      if (savedF && savedF.improved) f.improved = true;
    });
    this._state.findings = findings;
    _saveState(this._state);

    return findings;
    } finally {
      this._scanning = false;
    }
  },

  getFindings: function () {
    if (!this._findings.length) this.scan();
    return this._findings;
  },

  getHandsByIds: function (ids) {
    return HandRepo.getAll().filter(function (h) { return ids.indexOf(h.id) !== -1; });
  },

  getScanHandCount: function () {
    return this._state.scanHandCount || 0;
  },

  getLearningTarget: function (finding) {
    return getLearningTarget(finding);
  },

  markImproved: function (findingId) {
    var f = this._findings.find(function (x) { return x.id === findingId; });
    if (f) f.improved = true;
    // 重新扫描时如果状态改善，加入归档
    var now = Date.now();
    var archive = this._state.archive || [];
    if (!archive.some(function (a) { return a.id === findingId; })) {
      archive.push({ id: findingId, archivedAt: now });
    }
    this._state.archive = archive;
    _saveState(this._state);
  },

  // [V7.6.1] 返回完整 category×scenario 网格数据，供热力图使用
  getHeatmapData: function () {
    var snapshot = createLearningSnapshot(HandRepo.getAll());
    var hands = snapshot.eligibleHands;
    if (!hands || !hands.length) return null;
    var groups = {};
    hands.forEach(function (h) {
      var cat = h.boardCategory;
      var sc = h.preflopScenario || 'other';
      var key = cat + '|' + sc;
      if (!groups[key]) groups[key] = { hands: [], profit: 0 };
      groups[key].hands.push(h);
      groups[key].profit += (h.pBB || 0);
    });
    // 收集所有 category 和 scenario
    var catSet = {}, scSet = {};
    Object.keys(groups).forEach(function (k) {
      var parts = k.split('|');
      catSet[parts[0]] = true;
      scSet[parts[1]] = true;
    });
    // 排序：category 按牌面阶段顺序
    var CAT_ORDER = ['dryAHigh', 'flushy_dry', 'straighty', 'flushy_straighty', 'paired_high', 'monotone', 'dry_low', 'paired_low', 'made_straight', 'trips_board'];
    var categories = Object.keys(catSet).sort(function (a, b) {
      return (CAT_ORDER.indexOf(a) >= 0 ? CAT_ORDER.indexOf(a) : 99) - (CAT_ORDER.indexOf(b) >= 0 ? CAT_ORDER.indexOf(b) : 99);
    });
    var scenarios = Object.keys(scSet).sort();
    // 构建 cell 数据
    var cells = {};
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      var cbetFreq = _calcCBetFreq(g.hands);
      var gtoSum = 0, gtoCount = 0;
      g.hands.forEach(function (h) {
        try {
          var ref = getGTOReference(h.preflopScenario, h.boardCode);
          if (ref) {
            gtoSum += (ref.bet75 || 0) + (ref.bet50 || 0) + (ref.bet33 || 0);
            gtoCount++;
          }
        } catch (e) {}
      });
      cells[k] = {
        handCount: g.hands.length,
        avgProfit: g.hands.length ? g.profit / g.hands.length : 0,
        cbetFreq: cbetFreq,
        gtoAvgCbet: gtoCount ? Math.round(gtoSum / gtoCount) : null,
      };
    });
    return { categories: categories, scenarios: scenarios, cells: cells };
  },
};

// 计算 CBet 频率
function _calcCBetFreq(hands) {
  if (!hands.length) return 0;
  var cbetCount = 0;
  hands.forEach(function (h) {
    var line = h.actionLineOTF || '';
    if (/^B/i.test(line)) cbetCount++;
  });
  return Math.round(cbetCount / hands.length * 100);
}
