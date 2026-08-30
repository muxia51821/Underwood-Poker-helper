// [V7.9.3 新增] Evidence & Strategy — 证据包与策略修订的领域模块。
// 原则：策略不回写手牌事实（独立对象）；来源条件不同可提供结构性参考，数值对照只在直接条件相符时展示；
// research / candidate-adjustment / maintain 都是有效结论，证据不足不强迫改策略。
import { Utils } from '../utils.js';
import { EvidencePackRepo, StrategyRepo, DossierRepo, LearningUnitRepo } from '../store/store.js';
import { Navigation } from './navigation.js';
import { DecisionRadar } from './decisionRadar.js';  // [V7.10.2 新增] 复测基线快照与判定

var STATUS_LABELS = { research: '研究中', 'candidate-adjustment': '候选调整', maintain: '维持现状' };
var SOURCE_TYPE_LABELS = { video: '视频', article: '文章', book: '书', course: '课程', solver: 'Solver', personal: '个人观察' };

export var StrategyDesk = {
  STATUS_LABELS: STATUS_LABELS,
  SOURCE_TYPE_LABELS: SOURCE_TYPE_LABELS,
  editingStrategyId: null,
  editingEvidenceId: null,

  init: function () {
    document.getElementById('saveStrategyBtn').addEventListener('click', () => this.saveStrategy());
    document.getElementById('clearStrategyBtn').addEventListener('click', () => this.clearStrategyForm());
    document.getElementById('addEvidenceBtn').addEventListener('click', () => this.openEvidenceEditor());
    document.getElementById('saveEvidenceBtn').addEventListener('click', () => this.saveEvidence());
    document.getElementById('cancelEvidenceBtn').addEventListener('click', () => this.closeEvidenceEditor());
    document.getElementById('strategyList').addEventListener('click', (e) => {
      // [V7.10.2 新增] 生成训练/复测单元
      const unitBtn = e.target.closest('[data-strategy-unit]');
      if (unitBtn) { e.stopPropagation(); this.createLearningUnit(unitBtn.dataset.strategyUnit); return; }
      // [V7.10.2 新增] quiz 型单元 → 跳转既有 Quiz（场景自动选中）
      const unitQuizBtn = e.target.closest('[data-unit-quiz]');
      if (unitQuizBtn) {
        e.stopPropagation();
        const unit = LearningUnitRepo.getAll().find((u) => u.id === unitQuizBtn.dataset.unitQuiz);
        if (unit && unit.quizScenario) {
          Navigation.goToLearningTarget({ findingId: unit.id, type: 'strategy_quiz', scenario: unit.quizScenario, boardCategory: '', handIds: [] });
        } else {
          Utils.showToast('该单元没有可用的 Quiz 场景（仅 BTNvsBB/SBvsBB 翻牌有 GTO 训练数据）');
        }
        return;
      }
      // [V7.10.2 新增] 归档单元
      const unitArchiveBtn = e.target.closest('[data-unit-archive]');
      if (unitArchiveBtn) {
        e.stopPropagation();
        const units = LearningUnitRepo.getAll();
        const unit = units.find((u) => u.id === unitArchiveBtn.dataset.unitArchive);
        if (unit) { unit.status = 'archived'; unit.updatedAt = Utils.getLocalDatetime(); LearningUnitRepo.saveAll(units); this.render(); }
        return;
      }
      const editBtn = e.target.closest('[data-strategy-edit]');
      if (editBtn) { this.editStrategy(editBtn.dataset.strategyEdit); return; }
      const delBtn = e.target.closest('[data-strategy-delete]');
      if (delBtn) {
        const id = delBtn.dataset.strategyDelete;
        const s = StrategyRepo.getAll().find(function (x) { return x.id === id; });
        if (s && confirm('删除策略「' + (s.title || id) + '」？')) {
          StrategyRepo.saveAll(StrategyRepo.getAll().filter(function (x) { return x.id !== id; }));
          this.render();
        }
        return;
      }
      const row = e.target.closest('[data-strategy-id]');
      if (row) this.editStrategy(row.dataset.strategyId);
    });
    document.getElementById('evidenceList').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-evidence-edit]');
      if (editBtn) { this.editEvidence(editBtn.dataset.evidenceEdit); return; }
      const delBtn = e.target.closest('[data-evidence-delete]');
      if (delBtn) {
        const id = delBtn.dataset.evidenceDelete;
        const ev = EvidencePackRepo.getAll().find(function (x) { return x.id === id; });
        if (ev && confirm('删除证据包「' + (ev.title || id) + '」？')) {
          EvidencePackRepo.saveAll(EvidencePackRepo.getAll().filter(function (x) { return x.id !== id; }));
          this.render();
        }
        return;
      }
      const row = e.target.closest('[data-evidence-id]');
      if (row) this.editEvidence(row.dataset.evidenceId);
    });
  },

  // 纯函数：Dossier → 策略修订草稿（familyKey 取 spotKey 前两段：场景|街道）
  buildDraftFromDossier: function (dossier) {
    const spotKey = dossier && dossier.spotKey ? dossier.spotKey : '';
    const parts = spotKey.split('|');
    return {
      familyKey: parts.length >= 2 ? parts[0] + '|' + parts[1] : '',
      title: '策略修订 · ' + (dossier && dossier.title ? dossier.title : ''),
      status: 'candidate-adjustment',
      scope: '',
      statement: '',
      reviewCondition: dossier && dossier.nextSteps ? '跟进取证：' + dossier.nextSteps : '',
      spotKeys: spotKey ? [spotKey] : [],
      dossierIds: dossier ? [dossier.id] : [],
    };
  },

  // Dossier 编辑器「转为策略修订」入口：跳转策略子页并预填
  openEditorWithDossierDraft: function (dossier) {
    const draft = this.buildDraftFromDossier(dossier);
    this.editingStrategyId = null;
    const btn = document.getElementById('saveStrategyBtn');
    btn.textContent = '保存策略';
    btn.dataset.state = 'create';
    document.getElementById('stratTitle').value = draft.title;
    document.getElementById('stratFamily').value = draft.familyKey;
    document.getElementById('stratStatus').value = draft.status;
    document.getElementById('stratScope').value = draft.scope;
    document.getElementById('stratStatement').value = draft.statement;
    document.getElementById('stratReviewCondition').value = draft.reviewCondition;
    document.getElementById('stratDossierIds').value = draft.dossierIds.join(',');
    this._pendingDraftSpotKeys = draft.spotKeys;
    Navigation.goToReviewSubtab('strategy');
    this.render();
    document.getElementById('strategyEditorPane').focus({ preventScroll: true });
  },

  render: function () {
    this.renderStrategyList();
    this.renderEvidenceChecks();
    this.renderEvidenceList();
  },

  renderStrategyList: function () {
    const strategies = StrategyRepo.getAll().slice().sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    // [V7.10.2 新增] 复测判定与训练/复测单元
    const scan = DecisionRadar.scan();
    const unitsByStrategy = {};
    LearningUnitRepo.getAll().forEach(function (u) {
      if (!unitsByStrategy[u.strategyId]) unitsByStrategy[u.strategyId] = [];
      unitsByStrategy[u.strategyId].push(u);
    });
    const listEl = document.getElementById('strategyList');
    if (!strategies.length) {
      listEl.innerHTML = '<div class="empty-state">还没有策略修订。从 Radar 信号建档转化，或直接新建。</div>';
      return;
    }
    const dossiers = DossierRepo.getAll();
    const html = strategies.map((s) => {
      const statusLabel = STATUS_LABELS[s.status] || s.status;
      const linkedDossiers = (s.dossierIds || []).map(function (id) {
        const d = dossiers.find((x) => x.id === id);
        return d ? d.title : null;
      }).filter(Boolean);
      const evidenceCount = (s.evidenceIds || []).length;
      // [V7.10.2 新增] 复测状态：基线快照 vs 当前 Radar
      let retestHtml = '';
      if (s.baselineSnapshot) {
        const spotSignal = scan.signals.find((x) => x.spotKey === (s.spotKeys || [])[0]);
        const retest = DecisionRadar.evaluateRetest(s.baselineSnapshot, spotSignal);
        retestHtml = retest.due
          ? '<span class="status-inline status-inline--danger">🔁 复测条件达成（' + Utils.escapeHtml(retest.reasons.join('；')) + '）</span>'
          : '<span class="status-inline">基线 ' + s.baselineSnapshot.freq + '% / ' + s.baselineSnapshot.sample + ' 手</span>';
      }
      const units = unitsByStrategy[s.id] || [];
      const unitsHtml = units.filter((u) => u.status !== 'archived').map((u) => {
        return '<div>' + (u.type === 'quiz' ? '🎓' : '🔁') + ' ' + Utils.escapeHtml(u.title) +
          ' <button class="btn--mini" data-unit-quiz="' + Utils.escapeHtml(u.id) + '">去 Quiz</button>' +
          ' <button class="btn--mini" data-unit-archive="' + Utils.escapeHtml(u.id) + '">归档</button></div>';
      }).join('');
      return '<article class="finding-card" data-strategy-id="' + Utils.escapeHtml(s.id) + '" style="cursor:pointer">' +
        '<div class="finding-card__header"><span><strong>' + Utils.escapeHtml(s.title || '(未命名)') + '</strong></span>' +
        '<span class="status-inline status-inline--' + (s.status === 'maintain' ? 'success' : s.status === 'candidate-adjustment' ? 'danger' : 'info') + '">' + Utils.escapeHtml(statusLabel) + '</span></div>' +
        '<div class="finding-card__title">' + Utils.escapeHtml(s.familyKey || '--') + '</div>' +
        '<div class="finding-card__meta">' + (s.scope ? '范围：' + Utils.escapeHtml(s.scope) + ' · ' : '') +
        '证据 ' + evidenceCount + ' 个' + (linkedDossiers.length ? ' · Dossier：' + Utils.escapeHtml(linkedDossiers.join('、')) : '') + '</div>' +
        (s.reviewCondition ? '<div class="finding-card__meta">复测条件：' + Utils.escapeHtml(s.reviewCondition) + '</div>' : '') +
        (retestHtml ? '<div class="finding-card__meta">' + retestHtml + '</div>' : '') +
        (unitsHtml ? '<div class="finding-card__meta">' + unitsHtml + '</div>' : '') +
        '<div class="finding-card__actions">' +
        '<button class="btn--mini" data-strategy-edit="' + Utils.escapeHtml(s.id) + '">编辑</button>' +
        '<button class="btn--mini" data-strategy-unit="' + Utils.escapeHtml(s.id) + '">生成训练/复测</button>' +
        '<button class="btn--mini btn--danger" data-strategy-delete="' + Utils.escapeHtml(s.id) + '">删除</button>' +
        '</div></article>';
    }).join('');
    listEl.innerHTML = '<div class="finding-list">' + html + '</div>';
  },

  renderEvidenceChecks: function () {
    const packs = EvidencePackRepo.getAll();
    const strategyId = this.editingStrategyId;
    const strategy = strategyId ? StrategyRepo.getAll().find(function (s) { return s.id === strategyId; }) : null;
    const checked = strategy ? strategy.evidenceIds || [] : [];
    const el = document.getElementById('stratEvidenceChecks');
    if (!packs.length) {
      el.innerHTML = '<span class="text-muted" style="font-size:0.75em">暂无证据包，可在下方新建。</span>';
      return;
    }
    el.innerHTML = packs.map(function (p) {
      const label = (SOURCE_TYPE_LABELS[p.sourceType] || p.sourceType || '') + ' · ' + (p.title || '(未命名)');
      return '<label style="display:flex;gap:6px;align-items:center;font-size:0.75em;color:#cbd5e1;margin:2px 0">' +
        '<input type="checkbox" data-evidence-check="' + Utils.escapeHtml(p.id) + '" ' + (checked.indexOf(p.id) !== -1 ? 'checked' : '') + '>' +
        Utils.escapeHtml(label) + '</label>';
    }).join('');
    // 编辑中的策略未保存前，用草稿 evidenceIds 勾选
    if (this._draftEvidenceIds) {
      el.querySelectorAll('[data-evidence-check]').forEach(function (cb) {
        cb.checked = this._draftEvidenceIds.indexOf(cb.dataset.evidenceCheck) !== -1;
      }, this);
    }
  },

  renderEvidenceList: function () {
    const packs = EvidencePackRepo.getAll().slice().sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    const listEl = document.getElementById('evidenceList');
    if (!packs.length) {
      listEl.innerHTML = '<div class="empty-state">暂无证据包。</div>';
      return;
    }
    listEl.innerHTML = '<div class="finding-list">' + packs.map(function (p) {
      const typeLabel = SOURCE_TYPE_LABELS[p.sourceType] || p.sourceType || '--';
      return '<article class="finding-card" data-evidence-id="' + Utils.escapeHtml(p.id) + '" style="cursor:pointer">' +
        '<div class="finding-card__header"><span><strong>' + Utils.escapeHtml(p.title || '(未命名)') + '</strong></span>' +
        '<span class="status-inline">' + Utils.escapeHtml(typeLabel) + '</span></div>' +
        '<div class="finding-card__meta">' + (p.sourceRef ? Utils.escapeHtml(p.sourceRef) + ' · ' : '') + (p.capturedAt ? '取证 ' + Utils.escapeHtml(p.capturedAt) : '') + '</div>' +
        (p.conditions ? '<div class="finding-card__meta">条件：' + Utils.escapeHtml(p.conditions) + '</div>' : '') +
        (p.transferBoundary ? '<div class="finding-card__meta">边界：' + Utils.escapeHtml(p.transferBoundary) + '</div>' : '') +
        (p.keyPoints ? '<div class="finding-card__meta">要点：' + Utils.escapeHtml(p.keyPoints) + '</div>' : '') +
        '<div class="finding-card__actions">' +
        '<button class="btn--mini" data-evidence-edit="' + Utils.escapeHtml(p.id) + '">编辑</button>' +
        '<button class="btn--mini btn--danger" data-evidence-delete="' + Utils.escapeHtml(p.id) + '">删除</button>' +
        '</div></article>';
    }).join('') + '</div>';
  },

  saveStrategy: function () {
    const title = document.getElementById('stratTitle').value.trim();
    const familyKey = document.getElementById('stratFamily').value.trim();
    const status = document.getElementById('stratStatus').value;
    const scope = document.getElementById('stratScope').value.trim();
    const statement = document.getElementById('stratStatement').value.trim();
    const reviewCondition = document.getElementById('stratReviewCondition').value.trim();
    if (!title) { Utils.showToast('策略需要标题'); return; }
    if (!familyKey) { Utils.showToast('需要 Family（如 BTNvsBB|flop）'); return; }
    const evidenceIds = Array.from(document.querySelectorAll('#stratEvidenceChecks [data-evidence-check]:checked'))
      .map(function (cb) { return cb.dataset.evidenceCheck; });
    const dossierIds = document.getElementById('stratDossierIds').value.split(',').filter(Boolean);
    const now = Utils.getLocalDatetime();
    const strategies = StrategyRepo.getAll();
    let record = this.editingStrategyId ? strategies.find((s) => s.id === this.editingStrategyId) : null;
    if (record) {
      record.title = title; record.familyKey = familyKey; record.status = status;
      record.scope = scope; record.statement = statement; record.reviewCondition = reviewCondition;
      record.evidenceIds = evidenceIds; record.dossierIds = dossierIds;
      record.spotKeys = this._pendingDraftSpotKeys || record.spotKeys || [];
      record.updatedAt = now;
    } else {
      record = {
        id: Utils.generateUUID(),
        familyKey: familyKey,
        spotKeys: this._pendingDraftSpotKeys || [],
        title: title,
        status: status,
        scope: scope,
        statement: statement,
        evidenceIds: evidenceIds,
        dossierIds: dossierIds,
        reviewCondition: reviewCondition,
        baselineSnapshot: null,
        createdAt: now,
        updatedAt: now,
      };
      strategies.push(record);
    }
    this._pendingDraftSpotKeys = null;
    // [V7.10.2 新增] 建档快照：该 spot 当前信号频率/样本作为复测基线
    if (!record.baselineSnapshot && (record.spotKeys || []).length) {
      const spotSignal = DecisionRadar.scan().signals.find((sig) => sig.spotKey === record.spotKeys[0]);
      if (spotSignal) record.baselineSnapshot = { freq: spotSignal.spotFreq, sample: spotSignal.spotCount, capturedAt: now };
    }
    StrategyRepo.saveAll(strategies);
    this.editingStrategyId = null;
    this.clearStrategyForm();
    this.render();
    Utils.showToast('策略已保存');
  },

  // [V7.10.2 新增] 由策略生成训练/复测单元：Quiz 仅覆盖有 gtoRaw 数据的场景（BTNvsBB/SBvsBB），
  // 其余 spot 生成 retest 型单元（基线快照对比，见 DecisionRadar.evaluateRetest）。
  createLearningUnit: function (strategyId) {
    const s = StrategyRepo.getAll().find((x) => x.id === strategyId);
    if (!s) return;
    const scenario = (s.familyKey || '').split('|')[0];
    const quizScenario = ['BTNvsBB', 'SBvsBB'].indexOf(scenario) !== -1 ? scenario : null;
    const now = Utils.getLocalDatetime();
    const units = LearningUnitRepo.getAll();
    if (units.some((u) => u.strategyId === strategyId && u.status === 'active')) {
      Utils.showToast('该策略已有未归档的训练/复测单元');
      return;
    }
    units.push({
      id: Utils.generateUUID(),
      strategyId: strategyId,
      familyKey: s.familyKey,
      spotKeys: (s.spotKeys || []).slice(),
      type: quizScenario ? 'quiz' : 'retest',
      title: (quizScenario ? '训练 · ' : '复测 · ') + (s.title || s.familyKey),
      quizScenario: quizScenario,
      reviewCondition: s.reviewCondition || '',
      status: 'active',
      baselineSnapshot: s.baselineSnapshot || null,
      lastCheckedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    LearningUnitRepo.saveAll(units);
    this.render();
    Utils.showToast(quizScenario ? '已生成 Quiz 训练单元' : '已生成复测单元');
  },

  editStrategy: function (id) {
    const s = StrategyRepo.getAll().find((x) => x.id === id);
    if (!s) return;
    this.editingStrategyId = id;
    document.getElementById('stratTitle').value = s.title || '';
    document.getElementById('stratFamily').value = s.familyKey || '';
    document.getElementById('stratStatus').value = s.status || 'research';
    document.getElementById('stratScope').value = s.scope || '';
    document.getElementById('stratStatement').value = s.statement || '';
    document.getElementById('stratReviewCondition').value = s.reviewCondition || '';
    document.getElementById('stratDossierIds').value = (s.dossierIds || []).join(',');
    this._pendingDraftSpotKeys = s.spotKeys || [];
    this.renderEvidenceChecks();
    const btn = document.getElementById('saveStrategyBtn');
    btn.textContent = '更新策略';
    btn.dataset.state = 'edit';
    document.getElementById('strategyEditorPane').focus({ preventScroll: true });
  },

  clearStrategyForm: function () {
    this.editingStrategyId = null;
    this._pendingDraftSpotKeys = null;
    ['stratTitle', 'stratFamily', 'stratScope', 'stratStatement', 'stratReviewCondition'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('stratStatus').value = 'research';
    document.getElementById('stratDossierIds').value = '';
    document.getElementById('stratDossierHint').textContent = '';
    const btn = document.getElementById('saveStrategyBtn');
    btn.textContent = '保存策略';
    btn.dataset.state = 'create';
    this.renderEvidenceChecks();
  },

  openEvidenceEditor: function () {
    this.editingEvidenceId = null;
    ['evTitle', 'evSourceRef', 'evConditions', 'evMethodSample', 'evTransferBoundary', 'evKeyPoints'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('evSourceType').value = 'article';
    document.getElementById('evCapturedAt').value = Utils.getLocalDate();
    const btn = document.getElementById('saveEvidenceBtn');
    btn.textContent = '保存证据包';
    btn.dataset.state = 'create';
    document.getElementById('evidenceEditor').style.display = 'block';
  },

  editEvidence: function (id) {
    const ev = EvidencePackRepo.getAll().find((x) => x.id === id);
    if (!ev) return;
    this.editingEvidenceId = id;
    document.getElementById('evTitle').value = ev.title || '';
    document.getElementById('evSourceType').value = ev.sourceType || 'article';
    document.getElementById('evSourceRef').value = ev.sourceRef || '';
    document.getElementById('evConditions').value = ev.conditions || '';
    document.getElementById('evMethodSample').value = ev.methodSample || '';
    document.getElementById('evCapturedAt').value = ev.capturedAt || '';
    document.getElementById('evTransferBoundary').value = ev.transferBoundary || '';
    document.getElementById('evKeyPoints').value = ev.keyPoints || '';
    const btn = document.getElementById('saveEvidenceBtn');
    btn.textContent = '更新证据包';
    btn.dataset.state = 'edit';
    document.getElementById('evidenceEditor').style.display = 'block';
  },

  closeEvidenceEditor: function () {
    this.editingEvidenceId = null;
    document.getElementById('evidenceEditor').style.display = 'none';
  },

  saveEvidence: function () {
    const title = document.getElementById('evTitle').value.trim();
    if (!title) { Utils.showToast('证据包需要标题'); return; }
    const now = Utils.getLocalDatetime();
    const packs = EvidencePackRepo.getAll();
    let record = this.editingEvidenceId ? packs.find((p) => p.id === this.editingEvidenceId) : null;
    const fields = {
      title: title,
      sourceType: document.getElementById('evSourceType').value,
      sourceRef: document.getElementById('evSourceRef').value.trim(),
      conditions: document.getElementById('evConditions').value.trim(),
      methodSample: document.getElementById('evMethodSample').value.trim(),
      capturedAt: document.getElementById('evCapturedAt').value,
      transferBoundary: document.getElementById('evTransferBoundary').value.trim(),
      keyPoints: document.getElementById('evKeyPoints').value.trim(),
    };
    if (record) {
      Object.keys(fields).forEach(function (k) { record[k] = fields[k]; });
      record.updatedAt = now;
    } else {
      record = Object.assign({ id: Utils.generateUUID(), createdAt: now, updatedAt: now }, fields);
      packs.push(record);
    }
    EvidencePackRepo.saveAll(packs);
    this.closeEvidenceEditor();
    this.render();
    Utils.showToast('证据包已保存');
  },
};
