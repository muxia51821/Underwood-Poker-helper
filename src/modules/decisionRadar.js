// [V7.9.2 新增] Decision Radar — Spot 级信号聚合：你的频率 vs 你自己的场景基线。
// 只生成候选，不宣布结论；基线只用用户样本（旧 GTO 不参与，Phase 0 裁决）。
// 信号不持久化（随 handDataChanged 重算）；Dossier 以确定性 signalId 锚定，重算不失效。
import { Utils, PubSub } from '../utils.js';
import { createLearningSnapshot, buildFlopObservations, OBSERVATION_VERSION } from './analysisReadModel.js';
import { HandRepo, DossierRepo } from '../store/store.js';
import { Navigation } from './navigation.js';

var THRESHOLDS = { minSpot: 8, minBaseline: 20, minDeviationPP: 15, maxSignals: 10 };
var QUESTION_LABELS = { cbet: 'C-Bet', facebet: '面对下注弃牌' };

function _freq(obs, metric) {
  if (!obs.length) return null;
  var hit = obs.filter(metric).length;
  return Math.round((hit / obs.length) * 100);
}

function _avgPBB(obs) {
  var withBB = obs.filter(function (o) { return o.pBB != null; });
  if (!withBB.length) return null;
  var sum = withBB.reduce(function (s, o) { return s + o.pBB; }, 0);
  return parseFloat((sum / withBB.length).toFixed(1));
}

export var DecisionRadar = {
  THRESHOLDS: THRESHOLDS,
  QUESTION_LABELS: QUESTION_LABELS,

  // 纯函数：观察 → Spot 级信号（确定性 signalId）
  buildSignals: function (observations) {
    var t = THRESHOLDS;
    var spots = {};
    var baselines = {};
    (observations || []).forEach(function (o) {
      var spotKey = o.scenario + '|flop|' + o.boardCategory + '|' + o.question;
      if (!spots[spotKey]) spots[spotKey] = [];
      spots[spotKey].push(o);
      var baseKey = o.scenario + '|' + o.question;
      if (!baselines[baseKey]) baselines[baseKey] = [];
      baselines[baseKey].push(o);
    });
    var signals = [];
    Object.keys(spots).forEach(function (spotKey) {
      var spotObs = spots[spotKey];
      if (spotObs.length < t.minSpot) return;
      var probe = spotObs[0];
      var baseKey = probe.scenario + '|' + probe.question;
      var baseObs = baselines[baseKey] || [];
      if (baseObs.length < t.minBaseline) return;
      var metric = probe.question === 'cbet'
        ? function (o) { return o.didBet; }
        : function (o) { return o.didFold; };
      var spotFreq = _freq(spotObs, metric);
      var baselineFreq = _freq(baseObs, metric);
      if (spotFreq == null || baselineFreq == null) return;
      var deviation = spotFreq - baselineFreq;
      if (Math.abs(deviation) < t.minDeviationPP) return;
      signals.push({
        id: 'radar|' + spotKey,
        spotKey: spotKey,
        scenario: probe.scenario,
        question: probe.question,
        boardCategory: probe.boardCategory,
        spotCount: spotObs.length,
        spotFreq: spotFreq,
        baselineCount: baseObs.length,
        baselineFreq: baselineFreq,
        deviationPP: deviation,
        avgSpotPBB: _avgPBB(spotObs),
        avgBaselinePBB: _avgPBB(baseObs),
        sampleHandIds: spotObs.map(function (o) { return o.handId; }),
        observationVersion: OBSERVATION_VERSION,
      });
    });
    signals.sort(function (a, b) { return Math.abs(b.deviationPP) - Math.abs(a.deviationPP); });
    return signals.slice(0, t.maxSignals);
  },

  // 快照 → 信号（Discover 渲染入口共用同一 snapshot 口径）。
  // [V7.10.3 修改] 结果按手牌数据纪元缓存：handDataChanged（任何手牌增删改）后强制重算，
  // 避免同一次访问内 renderInto/_findSignal/strategyDesk 重复全量派生（4.3 万手约数百毫秒/次）。
  _scanCache: null,
  _scanDirty: true,
  scan: function () {
    if (!this._radarBound) {
      this._radarBound = true;
      var self = this;
      PubSub.on('handDataChanged', function () {
        self._scanCache = null;
        self._scanDirty = true;
      });
    }
    if (!this._scanDirty && this._scanCache) return this._scanCache;
    var snapshot = createLearningSnapshot(HandRepo.getAll());
    var derived = buildFlopObservations(snapshot.hands);
    this._scanCache = { signals: this.buildSignals(derived.observations), stats: derived.stats };
    this._scanDirty = false;
    return this._scanCache;
  },

  // [V7.10.2 新增] 策略复测判定：基线快照 vs 当前信号（纯函数）。
  // 达成条件：|频率变化| ≥ 15pp，或样本增长 ≥50%，或该 Spot 已不再触发信号（复查是否改善）。
  evaluateRetest: function (baselineSnapshot, signal) {
    if (!baselineSnapshot) return { due: false, reasons: [], current: null };
    if (!signal) return { due: true, reasons: ['该 Spot 当前不再触发信号——复查是否已改善'], current: null };
    var reasons = [];
    var dFreq = signal.spotFreq - baselineSnapshot.freq;
    if (Math.abs(dFreq) >= THRESHOLDS.minDeviationPP) reasons.push('频率变化 ' + (dFreq >= 0 ? '+' : '') + dFreq + 'pp');
    if (signal.spotCount >= baselineSnapshot.sample * 1.5) reasons.push('样本增长 ≥50%');
    return { due: reasons.length > 0, reasons: reasons, current: { freq: signal.spotFreq, sample: signal.spotCount } };
  },

  // ---- 渲染：Discover 面板内的 Radar 区块 ----
  renderInto: function (container) {
    var self = this;
    var scan = this.scan();
    var signals = scan.signals;
    var card = document.getElementById('discoverRadarCard');
    var body = document.getElementById('radarBody');
    if (!card || !body) return;
    if (scan.stats.total < 50) {
      card.style.display = 'none';
      body.replaceChildren();
      return;
    }
    card.style.display = '';
    var byFamily = {};
    signals.forEach(function (s) {
      if (!byFamily[s.scenario]) byFamily[s.scenario] = [];
      byFamily[s.scenario].push(s);
    });
    var html = '';
    html += '<div class="learning-findings__summary">归属为启发式（行动 token 不带玩家名）；基线是你自己的场景均值，样本 ' +
      scan.stats.attributed + '/' + scan.stats.total + ' 手已归因。</div>';
    if (!signals.length) {
      html += '<div class="empty-state">样本量或偏差未达阈值，暂无 Spot 级信号。</div>';
    }
    Object.keys(byFamily).forEach(function (family) {
      html += '<div style="color:#a8afba;font-size:0.75em;margin:8px 0 4px">' + Utils.escapeHtml(family) + '</div>';
      byFamily[family].forEach(function (s) {
        var dossier = DossierRepo.getAll().filter(function (d) { return d.signalId === s.id; })[0];
        var questionLabel = QUESTION_LABELS[s.question] || s.question;
        html += '<article class="finding-card finding-card--radar">';
        html += '<div class="finding-card__header"><span><strong>' + Utils.escapeHtml(questionLabel) + ' · ' + Utils.escapeHtml(s.boardCategory) + '</strong>' +
          (dossier ? ' <span class="status-inline status-inline--success">已建档</span>' : '') + '</span>' +
          '<span class="finding-card__count">' + s.spotCount + ' 手</span></div>';
        html += '<div class="finding-card__title">你 ' + s.spotFreq + '% vs 基线 ' + s.baselineFreq + '%（偏离 ' + (s.deviationPP >= 0 ? '+' : '') + s.deviationPP + 'pp）</div>';
        html += '<div class="finding-card__meta">Spot 平均盈亏 ' + (s.avgSpotPBB == null ? '--' : (s.avgSpotPBB >= 0 ? '+' : '') + s.avgSpotPBB + ' BB') +
          ' · 基线 ' + (s.avgBaselinePBB == null ? '--' : (s.avgBaselinePBB >= 0 ? '+' : '') + s.avgBaselinePBB + ' BB') + '（盈亏只提供语境）</div>';
        html += '<div class="finding-card__actions">' +
          '<button class="btn--mini" data-radar-evidence="' + Utils.escapeHtml(s.id) + '">查看手牌</button>' +
          '<button class="btn--mini" data-radar-dossier="' + Utils.escapeHtml(s.id) + '">' + (dossier ? '打开建档' : '建档研究') + '</button>' +
          '</div>';
        html += '<div class="finding-card__detail" id="radarEvidence-' + Utils.escapeHtml(s.id) + '" style="display:none"></div>';
        html += '<div class="finding-card__detail" id="radarDossier-' + Utils.escapeHtml(s.id) + '" style="display:none"></div>';
        html += '</article>';
      });
    });
    body.innerHTML = html;

    // 幂等绑定（容器常驻，innerHTML 重建）
    if (!body.dataset.radarBound) {
      body.dataset.radarBound = '1';
      body.addEventListener('click', function (e) {
        var evidenceBtn = e.target.closest('[data-radar-evidence]');
        if (evidenceBtn) {
          var signal = self._findSignal(evidenceBtn.dataset.radarEvidence);
          var detail = document.getElementById('radarEvidence-' + evidenceBtn.dataset.radarEvidence);
          if (!signal || !detail) return;
          if (detail.style.display === 'block') { detail.style.display = 'none'; return; }
          detail.style.display = 'block';
          detail.innerHTML = self._evidenceHtml(signal);
          detail.querySelectorAll('[data-radar-hand]').forEach(function (rowEl) {
            rowEl.addEventListener('click', function () { Navigation.goToHand(rowEl.dataset.radarHand); });
          });
          return;
        }
        var dossierBtn = e.target.closest('[data-radar-dossier]');
        if (dossierBtn) {
          self._toggleDossierEditor(dossierBtn.dataset.radarDossier);
          return;
        }
        var saveBtn = e.target.closest('[data-radar-save]');
        if (saveBtn) {
          self._saveDossier(saveBtn.dataset.radarSave, saveBtn.closest('[data-radar-editor]'));
          return;
        }
        // [V7.10.1 新增] 「转为策略修订」的点击处理在 review.js 的 #reviewPanel 委托中
        //（避免 decisionRadar → strategyDesk 循环依赖）
      });
    }
  },

  _findSignal: function (signalId) {
    return this.scan().signals.filter(function (s) { return s.id === signalId; })[0] || null;
  },

  _evidenceHtml: function (signal) {
    var hands = HandRepo.getAll().filter(function (h) { return signal.sampleHandIds.indexOf(h.id) !== -1; });
    var rows = hands.map(function (h) {
      var profitStr = h.pBB != null ? (h.pBB >= 0 ? '+' : '') + Utils.safeFixed(h.pBB, 1) + ' BB' : '--';
      var heroM = (h.desc || '').match(/Hero[^\n\[]*\[([^\]]+)\]/);
      var handHtml = heroM && heroM[1] ? Utils.renderCardBadges(heroM[1]) : '--';
      return '<tr data-radar-hand="' + Utils.escapeHtml(h.id) + '" style="cursor:pointer"><td>' + Utils.escapeHtml(h.date || '') + '</td><td>' +
        Utils.escapeHtml(h.potType || '--') + '</td><td>' + handHtml + '</td><td>' + profitStr + '</td></tr>';
    }).join('');
    return '<table class="session-table finding-hands-table"><thead><tr><th>时间</th><th>类型</th><th>手牌</th><th>盈亏</th></tr></thead><tbody>' + rows + '</tbody></table>';
  },

  _toggleDossierEditor: function (signalId) {
    var detail = document.getElementById('radarDossier-' + signalId);
    if (!detail) return;
    if (detail.style.display === 'block') { detail.style.display = 'none'; return; }
    var signal = this._findSignal(signalId);
    if (!signal) return;
    var dossier = DossierRepo.getAll().filter(function (d) { return d.signalId === signalId; })[0] || null;
    var status = dossier ? dossier.status : 'open';
    var questionLabel = QUESTION_LABELS[signal.question] || signal.question;
    var html = '';
    html += '<div data-radar-editor="' + Utils.escapeHtml(signalId) + '" style="padding:8px;border:1px solid #1e3a5f;border-radius:6px;margin-top:6px">';
    html += '<div style="font-size:0.75em;color:#cbd5e1;margin-bottom:6px">Finding Dossier · ' + Utils.escapeHtml(questionLabel) + ' · ' + Utils.escapeHtml(signal.boardCategory) + ' · ' + Utils.escapeHtml(signal.scenario) + '</div>';
    html += '<label style="font-size:0.7em;color:#a8afba">状态 <select class="select" data-dossier-field="status" style="font-size:0.7em;width:auto">';
    ['open', 'checking', 'resolved', 'maintain'].forEach(function (s) {
      var labels = { open: '待核查', checking: '核查中', resolved: '已结论', maintain: '维持现状' };
      html += '<option value="' + s + '"' + (status === s ? ' selected' : '') + '>' + labels[s] + '</option>';
    });
    html += '</select></label>';
    html += '<textarea class="textarea" data-dossier-field="hypothesis" rows="2" placeholder="假设：为什么这里偏离？（如：对手never donk / 我对抗 passive 群体）" style="font-size:0.75em;margin-top:6px">' + Utils.escapeHtml(dossier ? dossier.hypothesis || '' : '') + '</textarea>';
    html += '<textarea class="textarea" data-dossier-field="counterexamples" rows="2" placeholder="反例：哪些手牌/情境不符合该假设？" style="font-size:0.75em;margin-top:6px">' + Utils.escapeHtml(dossier ? dossier.counterexamples || '' : '') + '</textarea>';
    html += '<textarea class="textarea" data-dossier-field="nextSteps" rows="2" placeholder="下一步取证：需要补什么样本或对照？" style="font-size:0.75em;margin-top:6px">' + Utils.escapeHtml(dossier ? dossier.nextSteps || '' : '') + '</textarea>';
    html += '<button class="btn--mini" data-radar-save="' + Utils.escapeHtml(signalId) + '" style="margin-top:6px">保存建档</button>';
    if (dossier) {
      html += '<button class="btn--mini" data-radar-strategy="' + Utils.escapeHtml(signalId) + '" style="margin-top:6px">转为策略修订</button>';
    }
    html += '</div>';
    detail.innerHTML = html;
    detail.style.display = 'block';
  },

  _saveDossier: function (signalId, editorEl) {
    if (!editorEl) return;
    var signal = this._findSignal(signalId);
    if (!signal) return;
    var field = function (name) {
      const el = editorEl.querySelector('[data-dossier-field="' + name + '"]');
      return el ? el.value : '';
    };
    var dossiers = DossierRepo.getAll();
    var dossier = dossiers.filter(function (d) { return d.signalId === signalId; })[0] || null;
    var now = Utils.getLocalDatetime();
    if (dossier) {
      dossier.status = field('status') || 'open';
      dossier.hypothesis = field('hypothesis');
      dossier.counterexamples = field('counterexamples');
      dossier.nextSteps = field('nextSteps');
      dossier.updatedAt = now;
    } else {
      dossier = {
        id: Utils.generateUUID(),
        signalId: signalId,
        spotKey: signal.spotKey,
        title: (QUESTION_LABELS[signal.question] || signal.question) + ' · ' + signal.boardCategory + ' · ' + signal.scenario,
        status: field('status') || 'open',
        hypothesis: field('hypothesis'),
        counterexamples: field('counterexamples'),
        nextSteps: field('nextSteps'),
        sampleHandIds: signal.sampleHandIds.slice(),
        observationVersion: OBSERVATION_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      dossiers.push(dossier);
    }
    DossierRepo.saveAll(dossiers);
    Utils.showToast('Dossier 已保存');
    this.renderInto(document.getElementById('radarBody'));
  },
};
