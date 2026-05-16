// [V6.9.2] 数据同步模块（剪切板导入/导出 + CSV 导出）
import { Store, SessionRepo } from '../store/store.js';
import { Utils } from '../utils.js';

export const DataSync = {
  init() {
    document
      .getElementById('clipboardExportBtn')
      .addEventListener('click', () => this.copyToClipboard());
    document
      .getElementById('clipboardImportBtn')
      .addEventListener('click', () => this.importFromClipboard());
    document.getElementById('csvExportBtn').addEventListener('click', () => this.exportCSV());
  },
  async copyToClipboard() {
    try {
      const data = Store.exportAll();
      const compressed = Utils.encodeBase64(data);
      await navigator.clipboard.writeText(compressed);
      Utils.showToast('已复制到剪贴板！');
    } catch (e) {
      Utils.showToast('无法写入剪贴板');
    }
  },
  async importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        Utils.showToast('剪贴板为空');
        return;
      }
      const data = Utils.decodeBase64(text);
      if (Utils.validateBackupData(data)) {
        if (confirm('将合并导入数据（不覆盖已有记录），确定导入？')) {
          Store.importAll(data);
          Utils.showToast('导入成功！页面将刷新');
          location.reload();
        }
      } else {
        Utils.showToast('剪贴板数据格式不正确');
      }
    } catch (e) {
      Utils.showToast('导入失败');
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
