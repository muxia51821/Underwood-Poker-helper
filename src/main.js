import { CONSTANTS } from './constants.js';
import { Utils } from './utils.js';
import { GGParser } from './parsers/ggParser.js';
import { initStorage, getStorageHealth } from './store/store.js';
import { App } from './modules/app.js';
import './selfTests.js';

// 向后兼容：保留 Utils 上的原有调用路径
Utils.parseGGHandHistory = function (text) {
  return GGParser.parse(text);
};

// 设置版本标签
document.title = "Underwood's table agent V" + CONSTANTS.VERSION;
document.querySelector('.version-tag').textContent = 'V' + CONSTANTS.VERSION;

// [V6.9.0] 安全模式：URL hash #safemode 跳过 IndexedDB，直接 localStorage 启动
function isSafeMode() {
  return window.location.hash === '#safemode';
}

// [V6.7] 先初始化存储层（含 IndexedDB 迁移），再启动应用
initStorage({ safeMode: isSafeMode() })
  .then(function () {
    var health = getStorageHealth();
    if (health.issues.length > 0) {
      console.warn('Storage health issues:', health.issues);
    }
    App.init(health);
  })
  .catch(function (e) {
    console.error('Storage init failed', e);
    var safeModeLink = isSafeMode()
      ? ''
      : '<p style="margin-top:16px"><a href="#safemode" style="color:#facc15">尝试安全模式启动（跳过 IndexedDB）</a></p>';
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#cbd5e1;font-family:sans-serif;text-align:center;padding:20px"><div><h2 style="color:#f87171;margin-bottom:12px">数据加载失败</h2><p style="margin-bottom:16px;font-size:0.85em">请尝试刷新页面，或使用备份文件恢复数据。</p><button id="fatalReloadBtn" style="background:#3b82f6;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:0.9em;cursor:pointer">刷新页面</button>' +
      safeModeLink +
      '</div></div>';
    document.getElementById('fatalReloadBtn').addEventListener('click', function () {
      location.reload();
    });
  });
