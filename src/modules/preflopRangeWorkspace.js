// [V7.17.0 新增] Local, partial preflop charts; no automatic solver grading.
// [V7.17.0 修改] Copy distinguishes saved charts, unapplied editor input and full draft backups.
import { Utils } from '../utils.js';
import { PRANGE_LICENSE } from '../vendor/prange.js';
import { DataSync } from './dataSync.js';
import { createRangeStore, RANGE_LIBRARY_KEY } from '../store/rangeStore.js';
import { RANGE_HANDS, RANGE_ACTIONS, newPreflopRange, validatePreflopRange, rangeSummary, rangeConditionGaps, sameRangeConditions, withRangeHand, rangeTextEntries, readRangeFile, rangeFile } from './preflopRangeModel.js';
const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const clone = value => JSON.parse(JSON.stringify(value));
const id = () => 'range-' + crypto.randomUUID();
const conditions = { heroPosition: '你的翻前位置', opponentPosition: '对手位置', actionLine: '行动线与下注尺度', rake: '抽水', ante: '前注／跨位盲注' };
const sources = { title: '来源名称', url: '来源网址', method: '录入或生成方法', rights: '授权说明' };
function download(range) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(rangeFile(range), null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'poker-range.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const PreflopRangeWorkspace = {
  store: null, state: null, hand: 'AA', compareId: '', preview: null, message: '',
  init() {
    const root = document.getElementById('studyWorkspace');
    if (!root || root.dataset.rangeBound) return;
    root.dataset.rangeBound = 'true'; this.store = createRangeStore();
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-range-command], [data-range-hand]');
      if (!button) return;
      try {
        if (button.dataset.rangeHand) { this.hand = button.dataset.rangeHand; this.editor().hand = this.hand; this.persist(); this.paintDetail(); return; }
        this.command(button.dataset.rangeCommand);
      } catch (error) { this.refresh(); this.notify(error.message); }
    });
    root.addEventListener('input', event => {
      const input = event.target;
      if (!input.matches('[data-range-meta], [data-range-value], [data-range-text], [data-range-action]')) return;
      try {
        const range = clone(this.current()); if (!range || range.kind !== 'personal') return;
        if (input.matches('[data-range-text], [data-range-action]')) {
          this.editor()[input.matches('[data-range-text]') ? 'text' : 'action'] = input.value;
          this.preview = null; this.paintPreview();
        } else if (input.dataset.rangeValue) {
          const editor = this.editor(); editor.values[this.hand] ||= this.values(); editor.values[this.hand][input.dataset.rangeValue] = input.value;
        } else {
          const [group, key] = input.dataset.rangeMeta.split('.');
          if (group === 'range') range[key] = input.value;
          else range[group][key] = ['tableMax', 'effectiveStack'].includes(key) ? input.value === '' ? null : Number(input.value) : input.value;
          validatePreflopRange(range); this.state.drafts[range.id] = range;
        }
        this.persist();
        if (input.dataset.rangeMeta) this.paintDetail();
      } catch (error) { this.notify(error.message); }
    });
    root.addEventListener('change', async event => {
      const input = event.target;
      try {
        if (input.matches('[data-range-select]')) { this.state.selectedId = input.value; this.preview = null; this.persist(); this.refresh(); }
        if (input.matches('[data-range-compare]')) { this.compareId = input.value; this.paintDetail(); }
        if (input.matches('[data-range-file]') && input.files[0]) { this.preview = { range: readRangeFile(await input.files[0].text()) }; this.paintPreview(); input.value = ''; }
      } catch (error) { this.notify(error.message); }
    });
    root.addEventListener('keydown', event => {
      const cell = event.target.closest('[data-range-hand]'); if (!cell) return;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 13, ArrowUp: -13 }[event.key]; if (!delta) return;
      event.preventDefault(); const hand = RANGE_HANDS[Math.max(0, Math.min(168, RANGE_HANDS.indexOf(cell.dataset.rangeHand) + delta))];
      root.querySelector('[data-range-hand="' + hand + '"]')?.click(); root.querySelector('[data-range-hand="' + hand + '"]')?.focus();
    });
  },
  render(container) {
    this.container = container;
    try { this.state = this.store.read(); this.refresh(); }
    catch (error) { container.innerHTML = '<p role="alert">' + esc(error.message) + ' 请先在数据备份中导出原始记录。</p>'; }
  },
  current() { const selected = this.state.selectedId; return this.state.drafts[selected] || this.state.ranges.find(range => range.id === selected); },
  editor() { const selected = this.state.selectedId; return this.state.editors[selected] ||= { hand: 'AA', values: {} }; },
  values() {
    const entry = this.current()?.hands.find(item => item.hand === this.hand);
    return { weight: String((entry?.weight ?? 1) * 100), ...Object.fromEntries(RANGE_ACTIONS.map(action => [action.id, String((entry?.frequencies[action.id] ?? 0) * 100)])) };
  },
  persist() {
    try { this.store.write(this.state); }
    catch (error) { throw new Error('本机保存未完成。当前输入仍在页面中，请点击“备份范围与草稿”下载当前输入后再离开。' + error.message); }
    this.notify('已保存到本机');
  },
  notify(message) { this.message = message; const node = this.container?.querySelector('[data-range-status]'); if (node) node.textContent = message; },
  add(range) { this.state.drafts[range.id] = range; this.state.selectedId = range.id; this.persist(); this.refresh(); },
  command(command) {
    let range = this.current();
    if (command === 'backup') return DataSync.download({ localState: { version: 1, values: { [RANGE_LIBRARY_KEY]: JSON.stringify(this.state) } } }, 'poker-ranges-backup');
    if (command === 'new') return this.add(newPreflopRange(id()));
    if (command === 'copy') { const copy = clone(range); copy.id = id(); copy.kind = 'personal'; copy.name += ' · 个人版本'; copy.derivedFrom = { id: range.id, revision: range.revision }; copy.revision = 0; return this.add(copy); }
    if (command === 'export') return download(range);
    if (command === 'preview-text') {
      this.preview = { entries: rangeTextEntries(this.container.querySelector('[data-range-text]').value, this.container.querySelector('[data-range-action]').value) }; this.paintPreview(); return;
    }
    if (command === 'import') {
      if (this.preview?.range) {
        const incoming = clone(this.preview.range); incoming.importedFrom = { id: incoming.id, revision: incoming.revision }; incoming.id = id();
        this.preview = null;
        if (incoming.kind === 'reference') { this.state.ranges.push(incoming); this.state.selectedId = incoming.id; this.persist(); this.refresh(); return; }
        return this.add(incoming);
      }
      if (!this.preview?.entries || range?.kind !== 'personal') throw new Error('请先预览文本，并选择可编辑的个人范围。');
      for (const entry of this.preview.entries) { range = withRangeHand(range, entry.hand, entry); delete this.editor().values[entry.hand]; }
      this.state.drafts[range.id] = range; this.preview = null; this.persist(); this.refresh(); return;
    }
    if (!range || range.kind !== 'personal') throw new Error('外部参考不能直接修改。请先点击“另存个人副本”。');
    if (command === 'apply') {
      const values = this.editor().values[this.hand] || this.values();
      if (Object.values(values).some(value => value.trim() === '' || !Number.isFinite(Number(value)))) throw new Error('请填写权重和四个动作的百分比。');
      range = withRangeHand(range, this.hand, { weight: Number(values.weight) / 100, frequencies: Object.fromEntries(RANGE_ACTIONS.map(action => [action.id, Number(values[action.id]) / 100])) });
      delete this.editor().values[this.hand]; this.state.drafts[range.id] = range;
    }
    if (command === 'unknown') { this.state.drafts[range.id] = withRangeHand(range, this.hand, null); delete this.editor().values[this.hand]; }
    if (command === 'save') {
      if (Object.keys(this.editor().values).length) throw new Error(Object.keys(this.editor().values).join('、') + ' 尚有未应用的输入。请回到对应格子，点击“应用到矩阵”或“清除该格设置”后再保存。');
      const saved = { ...clone(range), revision: range.revision + 1, savedAt: new Date().toISOString() };
      this.state.ranges = [...this.state.ranges.filter(item => item.id !== saved.id), saved]; delete this.state.drafts[saved.id];
    }
    this.persist(); this.refresh();
  },
  refresh() {
    const range = this.current(), all = new Map(this.state.ranges.map(item => [item.id, item]));
    for (const item of Object.values(this.state.drafts)) all.set(item.id, item);
    this.hand = range ? this.editor().hand : 'AA'; if (!RANGE_HANDS.includes(this.hand)) this.hand = 'AA';
    const input = (label, group, key, value, type = 'text') => '<label>' + label + '<input type="' + type + '" data-range-meta="' + group + '.' + key + '" value="' + esc(value) + '"' + (range?.kind === 'reference' ? ' disabled' : '') + '></label>';
    this.container.innerHTML = '<section class="range-workspace"><div class="range-toolbar"><h3>翻前范围</h3><button class="ws-button" data-range-command="backup">备份范围与草稿</button><button class="ws-button" data-range-command="new">新建个人范围</button><label class="ws-button">导入范围文件<input type="file" accept=".json,application/json" data-range-file></label></div><p>按位置、筹码与行动线整理自己的范围。</p><p role="status" data-range-status>' + esc(this.message) + '</p><div data-range-preview></div>' +
      (range ? '<div class="range-toolbar"><label>当前范围<select data-range-select>' + [...all.values()].map(item => '<option value="' + esc(item.id) + '"' + (item.id === range.id ? ' selected' : '') + '>' + esc(item.name) + (this.state.drafts[item.id] ? ' · 草稿' : '') + '</option>').join('') + '</select></label><button class="ws-button" data-range-command="save"' + (range.kind === 'reference' ? ' disabled' : '') + '>保存范围</button><button class="ws-button" data-range-command="copy">另存个人副本</button><button class="ws-button" data-range-command="export">导出当前范围</button></div><p>' + (range.kind === 'reference' ? '待核验参考 · 只读' : '个人范围') + ' · 版本 ' + range.revision + '</p><details class="ws-concept"><summary>保存、导出与备份</summary><p>编辑会自动暂存为本机草稿。“保存范围”更新当前版本；要保留另一份，请用“另存个人副本”。</p><p>“导出当前范围”包含条件、来源和已应用的设置。未应用输入与批量原文请用“备份范围与草稿”保存，再到“设置 → 备份与恢复”中恢复。</p></details><p class="ws-boundary" data-range-conditions></p><details class="ws-concept"><summary>条件与来源</summary><div class="range-fields">' + input('名称', 'range', 'name', range.name) + '<label>游戏<select data-range-meta="conditions.format"' + (range.kind === 'reference' ? ' disabled' : '') + '>' + ['cash','mtt','unknown'].map(value => '<option' + (range.conditions.format === value ? ' selected' : '') + ' value="' + value + '">' + ({cash:'现金局',mtt:'锦标赛',unknown:'未知'}[value]) + '</option>').join('') + '</select></label>' + input('人数上限', 'conditions', 'tableMax', range.conditions.tableMax, 'number') + input('有效筹码（bb）', 'conditions', 'effectiveStack', range.conditions.effectiveStack, 'number') + Object.entries(conditions).map(([key,label]) => input(label, 'conditions', key, range.conditions[key])).join('') + Object.entries(sources).map(([key,label]) => input(label, 'source', key, range.source[key])).join('') + '</div></details><div class="range-layout"><div><div class="range-grid" role="group" aria-label="169 类手牌范围">' + RANGE_HANDS.map(hand => {
        const entry = range.hands.find(item => item.hand === hand); let offset = 0;
        const colors = RANGE_ACTIONS.map(action => { const start = offset; offset += (entry?.frequencies[action.id] || 0) * 100; return action.color + ' ' + start + '% ' + offset + '%'; });
        return '<button data-range-hand="' + hand + '" aria-pressed="' + (hand === this.hand) + '" aria-label="' + hand + (entry ? entry.weight === 0 ? ' 不在范围' : ' 已录入' : ' 未知') + '" title="' + (entry ? '权重 ' + Utils.safeFixed(entry.weight * 100, 1) + '% · ' + RANGE_ACTIONS.map(action => action.label + ' ' + Utils.safeFixed(entry.frequencies[action.id] * 100, 1) + '%').join(' / ') : '未知') + '" class="range-cell' + (!entry ? ' range-cell--unknown' : '') + '"' + (entry && entry.weight > 0 ? ' style="background:linear-gradient(90deg,' + colors.join(',') + ')"' : '') + '>' + hand + '</button>';
      }).join('') + '</div><p class="range-legend">' + RANGE_ACTIONS.map(action => '<span><i style="background:' + action.color + '"></i>' + action.label + '</span>').join('') + '<span>虚线：未知</span></p><p data-range-summary></p></div><aside><label>对照已保存范围<select data-range-compare><option value="">不对照</option>' + this.state.ranges.filter(item => item.id !== range.id).map(item => '<option value="' + esc(item.id) + '"' + (this.compareId === item.id ? ' selected' : '') + '>' + esc(item.name) + '</option>').join('') + '</select></label><div data-range-detail></div></aside></div><details class="ws-concept"><summary>批量录入范围文本</summary><p>例如 QQ+, AKs, A5s-A2s:0.5。冒号后的数字是范围权重；A5s:0.5 表示一半的 A5s 组合进入范围。导入的手牌使用下方选定动作；权重为 0 时四项动作频率都为 0。确认导入会替换同名格子的设置和未应用输入。</p><textarea aria-label="范围文本" data-range-text></textarea><select aria-label="文本录入动作" data-range-action>' + RANGE_ACTIONS.map(action => '<option value="' + action.id + '"' + (action.id === 'raise' ? ' selected' : '') + '>' + action.label + '</option>').join('') + '</select><button class="ws-button" data-range-command="preview-text">预览文本</button></details>' : '<div class="ws-empty">先新建个人范围，默认 Cash · 9max · 200bb。也可以导入本应用导出的范围文件。</div>') + '<details class="ws-concept"><summary>开源声明</summary><p>范围文本解析基于 thlorenz/prange，MIT 许可。此声明随离线版提供。</p><pre class="range-license">' + esc(PRANGE_LICENSE) + '</pre></details></section>';
    if (range) {
      this.container.querySelector('[data-range-text]').value = this.editor().text || '';
      this.container.querySelector('[data-range-action]').value = this.editor().action || 'raise';
      this.paintDetail();
    }
    this.paintPreview();
  },
  paintDetail() {
    const range = this.current(), entry = range.hands.find(item => item.hand === this.hand), values = this.editor().values[this.hand] || this.values();
    const summary = rangeSummary(range), gaps = rangeConditionGaps(range), readonly = range.kind === 'reference';
    this.container.querySelector('[data-range-summary]').textContent = (summary.classes ? '已录入 ' + summary.classes + '/169 类 · 折算后 ' + Utils.safeFixed(summary.weightedCombos, 1) + '/1326 个组合（已录入部分占 ' + Utils.safeFixed(summary.weightedCombos / 1326 * 100, 1) + '%）。' : '尚未录入手牌范围；未录入仍为未知。') + (gaps.length ? ' 条件待补：' + gaps.join('、') : '');
    const format = ({cash:'现金局',mtt:'锦标赛',unknown:'未知游戏'}[range.conditions.format]);
    const tableMax = range.conditions.tableMax == null ? '桌型未知' : range.conditions.tableMax + ' 人桌';
    const effectiveStack = range.conditions.effectiveStack == null ? '筹码深度未知' : range.conditions.effectiveStack + 'bb';
    this.container.querySelector('[data-range-conditions]').textContent = format + ' · ' + tableMax + ' · ' + effectiveStack + ' · ' + (range.conditions.heroPosition || '你的翻前位置待填') + ' → ' + (range.conditions.opponentPosition || '对手位置待填') + ' · ' + (range.conditions.actionLine || '行动与下注尺度待填') + ' · 抽水：' + (range.conditions.rake || '待填') + ' · 前注／跨位盲注：' + (range.conditions.ante || '待填');
    this.container.querySelectorAll('[data-range-hand]').forEach(cell => cell.setAttribute('aria-pressed', String(cell.dataset.rangeHand === this.hand)));
    const comparison = this.state.ranges.find(item => item.id === this.compareId), other = comparison?.hands.find(item => item.hand === this.hand);
    this.container.querySelector('[data-range-detail]').innerHTML = '<h4>' + this.hand + ' · ' + (entry ? entry.weight === 0 ? '不在范围' : '已录入' : '未知') + '</h4><p>范围权重表示这类手牌进入范围的比例；动作频率表示进入后各动作的比例。已录入手牌的四项动作频率合计 100%；权重为 0 时都为 0。</p><div class="range-fields">' + [['weight','范围权重'], ...RANGE_ACTIONS.map(action => [action.id,action.label])].map(([key,label]) => '<label>' + label + ' %<input type="number" min="0" max="100" step="any" data-range-value="' + key + '" value="' + esc(values[key]) + '"' + (readonly ? ' disabled' : '') + '></label>').join('') + '</div>' + (!readonly ? '<button class="ws-button" data-range-command="apply">应用到矩阵</button><button class="ws-button" data-range-command="unknown">清除该格设置</button>' : '') + (comparison ? '<div class="ws-boundary"><strong>对照：' + esc(comparison.name) + '</strong><p>' + (sameRangeConditions(range, comparison) && !gaps.length ? '条件一致；请核对来源是否适用于当前场景。' : '先补齐两份范围的条件，再比较频率。') + '</p><p>' + (other ? '权重 ' + Utils.safeFixed(other.weight * 100, 1) + '% · ' + RANGE_ACTIONS.map(action => action.label + ' ' + Utils.safeFixed(other.frequencies[action.id] * 100, 1) + '%').join(' / ') : '此手牌未录入') + '</p></div>' : '');
  },
  paintPreview() {
    const node = this.container.querySelector('[data-range-preview]'); if (!node) return;
    if (!this.preview) { node.innerHTML = ''; return; }
    const range = this.preview.range;
    node.innerHTML = '<div class="ws-boundary"><h4>导入预览</h4><p>' + (range ? esc(range.name) + ' · ' + esc(range.conditions.format) + ' · ' + esc(range.conditions.tableMax ?? '未知') + 'max · ' + esc(range.conditions.effectiveStack ?? '未知') + 'bb · ' + range.hands.length + '/169 类 · ' + (range.kind === 'reference' ? '待核验参考 · 只读' : '个人范围') + '。导入为独立范围。' : this.preview.entries.length + ' 类手牌；确认后替换当前范围中的同名格子及其未应用输入。') + '</p>' + (range ? '<dl>' + [...Object.entries(conditions).map(([key,label]) => [label,range.conditions[key]]), ...Object.entries(sources).map(([key,label]) => [label,range.source[key]])].map(([label,value]) => '<dt>' + label + '</dt><dd>' + esc(value || '未填写') + '</dd>').join('') + '</dl>' : '') + '<button class="ws-button" data-range-command="import">确认导入</button></div>';
  }
};
