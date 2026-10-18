// [V6.9.2] 数据同步模块（剪切板导入/导出 + CSV 导出）
import { Store, SessionRepo } from '../store/store.js';
import { Utils } from '../utils.js';
import { readBackup, planRestore, applyRestore, backupFingerprint } from '../store/backup.js'; // [V7.16.0 新增]
import { Timer } from './timer.js';

const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const DataSync = {
  init() {
    // [V7.16.0 新增] All file and clipboard entry points share this preview and durable restore.
    document.getElementById('backupSettingsBtn').addEventListener('click', () => this.openBackup());
    document
      .getElementById('clipboardExportBtn')
      .addEventListener('click', () => this.copyToClipboard());
    document
      .getElementById('clipboardImportBtn')
      .addEventListener('click', () => this.importFromClipboard());
    document.getElementById('csvExportBtn').addEventListener('click', () => this.exportCSV());
    Store.getRestoreCheckpoint().then(checkpoint => {
      if (checkpoint && checkpoint.status !== 'complete') {
        const bar = document.getElementById('restoreNotice');
        bar.hidden = false;
        bar.querySelector('button').addEventListener('click', () => this.openBackup());
      }
    }).catch(() => Utils.showToast('上次恢复报告无法读取，可先下载当前备份。'));
  },
  download(data = Store.exportAll(), prefix = 'poker-backup') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = prefix + '-' + Utils.getLocalDate() + '.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  dialog() {
    if (!this.root) {
      this.root = document.createElement('dialog'); this.root.id = 'backupDialog'; this.root.className = 'backup-dialog';
      this.root.setAttribute('aria-labelledby', 'backupTitle');
      document.body.append(this.root);
      this.root.addEventListener('close', () => {
        const target = this.returnFocus?.isConnected && this.returnFocus.checkVisibility() && !this.returnFocus.closest('[inert]') ? this.returnFocus : document.getElementById('settingsBtn');
        target?.focus({ preventScroll: true });
      });
      this.root.addEventListener('cancel', event => { if (this.busy || this.result) { event.preventDefault(); if (this.result) location.reload(); } });
      this.root.addEventListener('click', event => {
        const action = event.target.closest('[data-backup-action]')?.dataset.backupAction;
        if (!action || this.busy) return;
        if (action === 'close') { if (this.result) location.reload(); else this.root.close(); }
        if (action === 'download') this.download();
        if (action === 'apply') this.restore();
        if (action === 'retry') { this.recoveryBefore = this.result.before; this.result = null; this.renderPreview(); }
        if (action === 'checkpoint') Store.getRestoreCheckpoint().then(value => { if (value) this.download(value.before, 'poker-before-restore'); }).catch(error => this.showError(error));
        if (action === 'source') Store.getRestoreCheckpoint().then(value => { if (value?.source) this.download(value.source, 'poker-restore-source'); }).catch(error => this.showError(error));
        if (action === 'rollback') Store.getRestoreCheckpoint().then(value => { if (value) this.preview(value.before, { rollback: true }); }).catch(error => this.showError(error));
        if (action === 'clipboard') this.importFromClipboard();
      });
      this.root.addEventListener('change', event => {
        if (event.target.matches('[data-backup-file]')) { this.importFile(event.target.files[0]); event.target.value = ''; }
        if (event.target.matches('[data-backup-conflict]')) {
          const token = decodeURIComponent(event.target.dataset.backupConflict);
          this.options.preferIncoming = event.target.checked ? [...this.options.preferIncoming, token] : this.options.preferIncoming.filter(value => value !== token);
          this.renderPreview();
        }
        if (event.target.matches('[data-backup-skip]')) { this.options.skipInvalid = event.target.checked; this.root.querySelector('[data-backup-action=apply]').disabled = !event.target.checked; }
      });
    }
    if (!this.root.open) { this.returnFocus = document.activeElement; this.root.showModal(); }
    return this.root;
  },
  async openBackup() {
    this.result = null; this.recoveryBefore = null;
    const root = this.dialog();
    root.innerHTML = '<h2 id="backupTitle">备份与恢复</h2><p>下载全部本地记录、学习进度和偏好。恢复前会先预览，原有冲突项默认保留。</p><div class="backup-actions"><button class="btn" data-backup-action="download">下载完整备份</button><label class="btn btn--secondary">选择备份文件<input type="file" accept=".json" data-backup-file hidden></label><button class="btn btn--secondary" data-backup-action="clipboard">读取复制的备份</button></div><p id="backupMessage" role="alert"></p><div id="backupCheckpoint"></div><button class="btn btn--secondary" data-backup-action="close">关闭</button>';
    root.querySelector('[data-backup-action=download]').focus({ preventScroll: true });
    try {
      const checkpoint = await Store.getRestoreCheckpoint();
      if (checkpoint && root.querySelector('#backupCheckpoint')) root.querySelector('#backupCheckpoint').innerHTML = '<section class="backup-checkpoint"><h3>最近一次恢复前的副本</h3><p>' + (checkpoint.status === 'complete' ? '上次恢复已完成。' : '上次恢复尚未完成，请保留原备份文件。') + ' 可以下载当时的副本，或预览还原。</p><div class="backup-actions"><button class="btn--mini" data-backup-action="checkpoint">下载恢复前副本</button>' + (checkpoint.source ? '<button class="btn--mini" data-backup-action="source">下载原始导入副本</button>' : '') + '<button class="btn--mini" data-backup-action="rollback">预览还原到恢复前</button></div></section>';
    } catch (error) { this.showError(error); }
  },
  showError(error) {
    const root = this.dialog();
    let message = root.querySelector('#backupMessage');
    if (!message) { message = document.createElement('p'); message.id = 'backupMessage'; message.setAttribute('role', 'alert'); root.prepend(message); }
    message.textContent = error.message;
  },
  async importFile(file) {
    if (!file) return;
    try { this.preview(await file.text()); } catch (error) { await this.openBackup(); this.showError(error); }
  },
  preview(input, options = {}) {
    this.source = readBackup(input); this.options = { preferIncoming: [], ...options };
    this.result = null; this.recoveryBefore = null;
    this.renderPreview();
  },
  renderPreview() {
    try {
      this.plan = planRestore(this.source, Store.exportAll(), this.options);
      const plan = this.plan, root = this.dialog();
      root.innerHTML = '<h2 id="backupTitle">' + (this.options.rollback ? '还原到恢复前' : '恢复预览') + '</h2><p>' + (this.options.rollback ? '将用副本替换对应记录，恢复后新增的记录会移出。请先下载当前备份。' : '预览不会改动记录。同标识的不同内容默认保留本地；勾选后才采用备份内容。') + '</p><p>计时恢复后保持暂停，需要你主动继续。</p><div class="backup-table"><table><thead><tr><th>内容</th><th>新增</th><th>恢复后</th></tr></thead><tbody>' + plan.rows.map(row => '<tr><td>' + esc(row.label) + (row.changed ? '' : ' · 保留') + '</td><td>' + row.added + '</td><td>' + row.total + '</td></tr>').join('') + '</tbody></table></div>'
        + (plan.conflicts.length ? '<details class="backup-conflicts"><summary>核对 ' + plan.conflicts.length + ' 项冲突</summary><p>学习记录按标识合并；勾选时，冲突部分采用备份进度。设置勾选后采用备份值。</p>' + plan.conflicts.map(item => '<label><input type="checkbox" data-backup-conflict="' + esc(encodeURIComponent(item.token)) + '"' + (this.options.preferIncoming.includes(item.token) ? ' checked' : '') + '>采用备份：' + esc(item.label) + ' ' + esc(item.id) + '</label>').join('') + '</details>' : '')
        + (plan.archivedKeys.length ? '<details><summary>' + plan.archivedKeys.length + ' 项原始键仅存入恢复副本</summary><p>旧迁移标记、旧存储副本和未识别的扑克键不会自动启用。</p><ul>' + plan.archivedKeys.map(key => '<li>' + esc(key) + '</li>').join('') + '</ul></details>' : '')
        + (plan.issues.length ? '<section class="backup-issues"><h3>需要处理的内容</h3><ul>' + plan.issues.map(issue => '<li>' + esc(issue) + '</li>').join('') + '</ul><label><input type="checkbox" data-backup-skip' + (this.options.skipInvalid ? ' checked' : '') + '>跳过以上问题项，保留原备份文件以便后续处理</label></section>' : '')
        + '<p id="backupMessage" role="alert"></p><div class="backup-actions"><button class="btn" data-backup-action="apply"' + (plan.issues.length && !this.options.skipInvalid ? ' disabled' : '') + '>确认' + (this.options.rollback ? '还原' : '恢复') + '</button><button class="btn btn--secondary" data-backup-action="download">下载当前备份</button><button class="btn btn--secondary" data-backup-action="close">取消</button></div>';
    } catch (error) { this.showError(error); }
  },
  async restore() {
    this.busy = true;
    try {
      if (backupFingerprint(Store.exportAll()) !== this.plan.baseline) throw new Error('本地记录已变化，请取消并重新选择文件预览。');
      if (Timer.running) { Timer.toggle(); this.plan = planRestore(this.source, Store.exportAll(), this.options); }
      if (this.recoveryBefore) this.plan.recoveryBefore = this.recoveryBefore;
      this.root.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
      this.root.querySelector('#backupMessage').textContent = '正在保存恢复前副本并核对写入，请保持此页面打开。';
      this.result = await applyRestore(this.plan, Store.backupIO());
      const result = this.result;
      this.root.innerHTML = '<h2 id="backupTitle">' + (result.ok ? '恢复完成' : '恢复尚未完成') + '</h2><p>' + (result.ok ? '记录已写入并读回核对。刷新后使用恢复的数据。' : '已完成 ' + result.completed.length + ' 项，剩余 ' + result.pending.length + ' 项。原备份和恢复前副本仍保留，可以重试或还原。') + '</p>'
        + '<ul>' + result.failed.map(item => '<li>' + esc(item.label) + '：' + esc(item.message) + '</li>').join('') + '</ul><p id="backupMessage" role="alert"></p><div class="backup-actions">' + (result.ok ? '' : '<button class="btn" data-backup-action="retry">重新预览并重试</button><button class="btn btn--secondary" data-backup-action="rollback">预览还原到恢复前</button>') + '<button class="btn btn--secondary" data-backup-action="checkpoint">下载恢复前副本</button><button class="btn" data-backup-action="close">' + (result.ok ? '完成并刷新' : '刷新后继续处理') + '</button></div>';
    } catch (error) {
      this.showError(error);
      this.root.querySelectorAll('button,input').forEach(control => { control.disabled = false; });
      const apply = this.root.querySelector('[data-backup-action=apply]');
      if (apply) apply.disabled = this.plan.issues.length > 0 && !this.options.skipInvalid;
    } finally { this.busy = false; }
  },
  async copyToClipboard() {
    try {
      const data = Store.exportAll();
      const compressed = Utils.encodeBase64(data);
      await Utils.withBusy(document.getElementById('clipboardExportBtn'), '复制中…', () => navigator.clipboard.writeText(compressed));
      Utils.showToast('备份已复制到剪贴板。', { tone: 'success' });
    } catch (e) {
      Utils.showToast('无法写入剪贴板，请通过备份与恢复下载文件。', { tone: 'error' });
    }
  },
  async importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        Utils.showToast('剪贴板为空');
        return;
      }
      this.preview(text);
    } catch (e) {
      await this.openBackup(); this.showError(new Error('读取失败：请使用备份文件恢复，或检查剪贴板访问权限。'));
    }
  },
  exportCSV() {
    const sessions = Utils.sortByDateKey(SessionRepo.getAll());
    if (!sessions.length) {
      Utils.showToast('暂无Session数据可导出');
      return;
    }
    const header = '﻿日期,级别,时长(h),手数,盈亏(BB),Tilt评分,错误类型,备注';
    const rows = sessions.map(function (s) {
      return [
        s.date,
        s.level,
        s.duration,
        s.hands,
        Utils.safeFixed(s.profit, 1),
        s.tilt,
        '"' + (s.mistake || '').replace(/"/g, '""') + '"',
        '"' + (s.remark || '').replace(/"/g, '""') + '"',
      ].join(',');
    });
    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poker_sessions_' + Utils.getLocalDate() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
