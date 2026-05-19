import { CONSTANTS } from '../constants.js';
import { Utils, PubSub } from '../utils.js';
import { Store, SessionRepo, WeeklyRepo, TiltLogRepo } from '../store/store.js';
import { srpData } from '../data/srpData.js';
import { underBluff, overBluff } from '../data/actionLines.js';

import { DataSync } from './dataSync.js';
import { TiltRescue } from './tiltRescue.js';
import { Timer, _setTimerGlobals } from './timer.js';
import { Odds } from './odds.js';
import { Review } from './review.js';
import { initGGImport } from './ggImport.js';
import { HandPicker } from './handPicker.js';  // [V6.15.0]

export const App = {
          sound: true,
          vibrateOn: true,
          reviewRendered: false,
          confirmDelete: function (itemsGetter, itemsSaver, renderFn, idKey, id) {
            if (!confirm('确认删除？')) return;
            var items = itemsGetter().filter(function (item) {
              return item[idKey] !== id;
            });
            itemsSaver(items);
            renderFn();
          },
          init(health) {
            this._health = health || null;
            window.addEventListener('error', (e) => console.error('JS错误:', e.error));
            window.addEventListener('unhandledrejection', (e) => {
              console.warn('Promise拒绝:', e.reason);
              e.preventDefault();
            });
            // [V6.9.2] 注入子模块依赖
            _setTimerGlobals(
              function () { App.beep(); },
              function () { App.vibrate(); },
              function (t, b) { App.notify(t, b); }
            );
            Review._confirmDelete = App.confirmDelete.bind(App);
            PubSub.on('tiltLogSaved', function () { Review.renderTiltLogs(); });

            // [V7.3.0] Canvas 响应式：监听 chartsArea 容器大小变化自动重绘
            var chartObserver = new ResizeObserver(
              Utils.debounce(function () {
                Review.renderCharts();
              }, 200)
            );
            var chartsArea = document.getElementById('chartsArea');
            if (chartsArea) {
              chartObserver.observe(chartsArea);
            }

            // [V6.9.0] 渲染存储健康指示器
            this.renderHealthIndicator();

            this.bindSettings();
            this.bindNav();
            this.bindSubNav();
            Timer.init();
            Odds.init();

            Review.init();
            TiltRescue.init();
            DataSync.init();

            document.getElementById('showRandomBtn').addEventListener('click', () => {
              document.getElementById('hiddenRandomPanel').classList.toggle('is-visible');
            });
            document.getElementById('genRandBtn').addEventListener('click', () => {
              const min = +document.getElementById('rMin').value,
                max = +document.getElementById('rMax').value,
                el = document.getElementById('randResult');
              if (isNaN(min) || isNaN(max) || min > max) {
                el.style.display = 'block';
                el.textContent = '⚠️ 最小值 ≤ 最大值';
                return;
              }
              el.textContent = Math.floor(Math.random() * (max - min + 1)) + min;
              el.style.display = 'block';
            });

            // 5.0 懒加载 SRP 表
            const srpDetails = document.getElementById('srpDetails');
            if (srpDetails) {
              srpDetails.addEventListener('toggle', function () {
                if (this.open && !App._srpLoaded) {
                  App.renderSRPTable();
                  document.querySelectorAll('.srp-filters select').forEach(function (sel) {
                    sel.addEventListener('change', App.renderSRPTable);
                  });
                  App._srpLoaded = true;
                }
              });
            }

            // 5.0 懒加载 行动线表
            const actionLineDetails = document.getElementById('actionLineDetails');
            if (actionLineDetails) {
              actionLineDetails.addEventListener('toggle', function () {
                if (this.open && !App._actionLineLoaded) {
                  App.renderActionLines();
                  App._actionLineLoaded = true;
                }
              });
            }

            // V5.7.1 分享网站弹窗
            document.getElementById('shareSiteBtn').addEventListener('click', function () {
              document.getElementById('shareUrlDisplay').textContent = CONSTANTS.SITE_URL;
              document.getElementById('shareOverlay').classList.add('is-active');
            });
            document.getElementById('shareCloseBtn').addEventListener('click', function () {
              document.getElementById('shareOverlay').classList.remove('is-active');
            });
            document.getElementById('shareCopyBtn').addEventListener('click', function () {
              var url = CONSTANTS.SITE_URL;
              var btn = document.getElementById('shareCopyBtn');
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard
                  .writeText(url)
                  .then(function () {
                    btn.textContent = '✅ 已复制';
                    setTimeout(function () {
                      btn.textContent = '📋 复制链接';
                    }, 2000);
                  })
                  .catch(function () {
                    prompt('手动复制链接：', url);
                  });
              } else {
                prompt('手动复制链接：', url);
              }
            });

            // [V6.19.7] 遮罩层点击背景关闭
            document.querySelectorAll('.tilt-overlay, .share-overlay').forEach(function (ov) {
              ov.addEventListener('click', function (e) {
                if (e.target === ov) ov.classList.remove('is-active');
              });
            });
            // [V6.9.3] GG手牌导入（独立模块）
            initGGImport();
            // [V6.15.0] 手牌精选模块
            HandPicker.init();

            // [V6.12.4] SW 注册：保存引用供 notify() 使用；内联 Blob 也含 notificationclick
            if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
              navigator.serviceWorker
                .register('./sw.js?v=' + CONSTANTS.VERSION)
                .catch(function () {
                  const swCode = "const CACHE_NAME='poker-v" + CONSTANTS.VERSION + "';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['./index.html'])))});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(function(l){for(var i=0;i<l.length;i++){var c=l[i];if(c.url&&c.focus)return c.focus()}if(clients.openWindow)return clients.openWindow('/')}))})";
                  const blob = new Blob([swCode], { type: 'text/javascript' });
                  return navigator.serviceWorker.register(URL.createObjectURL(blob));
                })
                .then(function (reg) {
                  App.swRegistration = reg;
                });
            }
            // [V6.12.4] 测试通知（设置菜单内）
            var testNotifyOption = document.getElementById('testNotifyOption');
            if (testNotifyOption) {
              testNotifyOption.addEventListener('click', function (e) {
                e.stopPropagation();
                try {
                  console.log('[testNotify] clicked, permission:', Notification.permission);
                  if (!('Notification' in window)) {
                    console.log('[testNotify] Notification API not available');
                    alert('你的浏览器不支持通知功能。（可能是 file:// 协议限制，请通过 https 访问）');
                    return;
                  }
                  if (Notification.permission === 'default') {
                    console.log('[testNotify] requesting permission...');
                    Notification.requestPermission()
                      .then(function (perm) {
                        console.log('[testNotify] permission result:', perm);
                        if (perm === 'granted') {
                          App.notify('测试通知', '通知设置正确！计时到点时会收到提醒。');
                        } else {
                          alert('通知权限未获得（当前状态：' + perm + '）。请在浏览器地址栏左侧点击 🔒/ⓘ 图标 → 通知 → 允许。');
                        }
                      })
                      .catch(function (err) {
                        console.error('[testNotify] requestPermission failed:', err);
                        alert('请求通知权限失败：' + err.message + '。请检查系统设置 → 通知 → 允许 Edge 发送通知。');
                      });
                  } else if (Notification.permission === 'granted') {
                    console.log('[testNotify] already granted, sending test...');
                    App.notify('测试通知', '通知设置正确！计时到点时会收到提醒。');
                  } else {
                    console.log('[testNotify] permission denied');
                    alert('通知权限已被拒绝。请在浏览器地址栏左侧点击 🔒/ⓘ 图标 → 通知 → 允许。\n\nWindows 用户还需检查：设置 → 系统 → 通知 → 打开 Microsoft Edge 通知。');
                  }
                } catch (e) {
                  console.error('[testNotify] exception:', e);
                  alert('测试通知出错：' + e.message);
                }
                // 点击后关闭菜单
                document.getElementById('settingsMenu').classList.remove('is-visible');
              });
            } else {
              console.warn('[testNotify] option not found in DOM');
            }
            document.title = "Underwood's table agent V" + CONSTANTS.VERSION;
            document.querySelector('.version-tag').textContent = 'V' + CONSTANTS.VERSION;
            window.addEventListener('beforeunload', () => {
              if (Timer.interval) clearInterval(Timer.interval);
              if (TiltRescue.countdownTimer) clearInterval(TiltRescue.countdownTimer);
            });

            // 统一给所有输入框加自动全选
            document.querySelectorAll('.input').forEach((input) => {
              input.addEventListener('focus', () => input.select());
            });
          },
          // [V6.9.0] 渲染存储健康指示器
          renderHealthIndicator() {
            var dot = document.getElementById('storageHealth');
            if (!dot) return;
            var health = this._health;
            if (!health) {
              dot.style.display = 'none';
              return;
            }
            dot.style.display = 'inline-block';
            dot.className = 'storage-health';
            if (health.mode === 'indexeddb') {
              dot.classList.add('storage-health--green');
              dot.title = '存储正常 (IndexedDB) | ' + health.counts.handReviews + '手牌/' + health.counts.sessions + '场次';
            } else if (health.mode === 'localstorage') {
              dot.classList.add('storage-health--yellow');
              dot.title = '降级模式 (localStorage)';
            } else {
              dot.classList.add('storage-health--red');
              dot.title = health.issues.join('; ') || '存储异常';
            }
            // 警告条
            var warnBar = document.getElementById('healthWarningBar');
            if (warnBar) {
              if (health.mode === 'degraded' || health.issues.length > 0) {
                warnBar.style.display = 'block';
                warnBar.innerHTML = '⚠️ ' + (health.issues[health.issues.length - 1] || '存储状态异常') + ' | <a href="#safemode">切换安全模式</a>';
              } else {
                warnBar.style.display = 'none';
              }
            }
          },
          // [V6.9.1] 渲染 SB vs BB SRP 翻牌策略表
          renderSRPTable() {
            var high = document.getElementById('filterHigh') ? document.getElementById('filterHigh').value : 'all';
            var suit = document.getElementById('filterSuit') ? document.getElementById('filterSuit').value : 'all';
            var connect = document.getElementById('filterConnect') ? document.getElementById('filterConnect').value : 'all';
            var pair = document.getElementById('filterPair') ? document.getElementById('filterPair').value : 'all';
            var rows = [];
            srpData.forEach(function (d) {
              if (high !== 'all' && d.high !== high) return;
              if (suit !== 'all' && d.suit !== suit) return;
              if (connect !== 'all' && d.connect !== connect) return;
              if (pair !== 'all' && d.pair !== pair) return;
              rows.push('<tr><td>' + Utils.escapeHtml(d.flop) + '</td><td>' + Utils.escapeHtml(d.high) + '</td><td>' + Utils.escapeHtml(d.suit) + '</td><td>' + Utils.escapeHtml(d.connect) + '</td><td>' + Utils.escapeHtml(d.pair) + '</td><td>' + Utils.escapeHtml(d.size) + '</td></tr>');
            });
            document.getElementById('srpBody').innerHTML = rows.join('');
          },
          // [V6.9.1] 渲染行动线速查表
          renderActionLines() {
            var maxLen = Math.max(underBluff.length, overBluff.length);
            var rows = [];
            for (var i = 0; i < maxLen; i++) {
              var u = underBluff[i];
              var o = overBluff[i];
              rows.push('<tr><td>' + (u ? Utils.escapeHtml(u.line) : '') + '</td><td>' + (u ? Utils.escapeHtml(u.text) : '') + '</td><td>' + (o ? Utils.escapeHtml(o.line) : '') + '</td><td>' + (o ? Utils.escapeHtml(o.text) : '') + '</td></tr>');
            }
            document.getElementById('actionLineBody').innerHTML = rows.join('');
          },
          // [V6.12.4] 通知走 Service Worker（仅当 SW 已控制页面时），否则降级 new Notification
          notify(t, b) {
            if (Notification.permission !== 'granted') return;
            var opts = {
              body: b,
              requireInteraction: true,
              tag: 'poker-timer',
              vibrate: [300, 100, 300],
            };
            // controller 非 null 表示 SW 已激活并控制页面（仅 HTTPS 或 localhost）
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              navigator.serviceWorker.ready.then(function (reg) {
                reg.showNotification(t, opts);
              }).catch(function () {
                new Notification(t, opts);
              });
            } else {
              new Notification(t, opts);
            }
          },
          _audioCtx: null,
          beep() {
            if (!this.sound) return;
            try {
              if (!this._audioCtx) {
                this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              }
              const c = this._audioCtx,
                o = c.createOscillator(),
                g = c.createGain();
              o.connect(g);
              g.connect(c.destination);
              o.frequency.value = 880;
              o.type = 'sine';
              g.gain.setValueAtTime(0.3, c.currentTime);
              o.start(c.currentTime);
              g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
              o.stop(c.currentTime + 0.25);
            } catch (e) { console.warn('beep failed:', e); }
          },
          vibrate() {
            if (this.vibrateOn && navigator.vibrate) navigator.vibrate([300, 100, 300]);
          },
          bindSettings() {
            const sb = document.getElementById('soundOption'),
              vb = document.getElementById('vibrateOption');
            // 加载保存的设置
            const settings = Store.settings.get();
            this.sound = settings.sound;
            this.vibrateOn = settings.vibrate;
            sb.classList.toggle('is-active', this.sound);
            vb.classList.toggle('is-active', this.vibrateOn);

            Utils.initDropdown(
              document.getElementById('settingsBtn'),
              document.getElementById('settingsMenu')
            );
            sb.addEventListener('click', () => {
              this.sound = !this.sound;
              sb.classList.toggle('is-active', this.sound);
              Store.settings.save({ sound: this.sound, vibrate: this.vibrateOn });
            });
            vb.addEventListener('click', () => {
              this.vibrateOn = !this.vibrateOn;
              vb.classList.toggle('is-active', this.vibrateOn);
              Store.settings.save({ sound: this.sound, vibrate: this.vibrateOn });
            });
            // [V7.2.3] 三配色方案切换: Pale → Nimbus → Ember
            var csBtn = document.getElementById('colorSchemeOption');
            var schemes = ['pale', 'nimbus', 'ember'];
            var labels = { pale: '🎨 Nimbus', nimbus: '🎨 Ember', ember: '🎨 Pale' };
            var classes = { nimbus: 'color-nimbus', ember: 'color-ember' };
            var savedScheme = localStorage.getItem('pa_colorScheme') || 'pale';
            if (savedScheme !== 'pale') { document.body.classList.add(classes[savedScheme]); }
            csBtn.textContent = labels[savedScheme];
            csBtn.addEventListener('click', function () {
              document.body.classList.remove('color-nimbus', 'color-ember');
              var currentIdx = schemes.indexOf(localStorage.getItem('pa_colorScheme') || 'pale');
              var nextScheme = schemes[(currentIdx + 1) % schemes.length];
              if (nextScheme !== 'pale') { document.body.classList.add(classes[nextScheme]); }
              csBtn.textContent = labels[nextScheme];
              localStorage.setItem('pa_colorScheme', nextScheme);
            });
          },
          bindNav() {
            document.querySelector('.nav').addEventListener('click', (e) => {
              const b = e.target.closest('.nav__btn');
              if (!b) return;
              document
                .querySelectorAll('.nav__btn')
                .forEach((x) => x.classList.remove('nav__btn--active'));
              b.classList.add('nav__btn--active');
              var tab = b.dataset.tab;
              var main = document.querySelector('.main');
              main.setAttribute('data-active-tab', tab);
              document.querySelectorAll('.panel').forEach((p) => p.classList.remove('is-visible'));
              // [V7.3.3] 一个 Tab 一个面板
              document.getElementById(tab + 'Panel').classList.add('is-visible');
              if (tab === 'odds') Odds.calc();
              if (tab === 'review' && !this.reviewRendered) {
                Review.renderAll();
                this.reviewRendered = true;
              }
            });
          },
          bindSubNav() {
            document.getElementById('reviewSubNav').addEventListener('click', (e) => {
              const b = e.target.closest('.subnav__btn');
              if (!b) return;
              document
                .querySelectorAll('#reviewSubNav .subnav__btn')
                .forEach((x) => x.classList.remove('subnav__btn--active'));
              b.classList.add('subnav__btn--active');
              document
                .querySelectorAll('#reviewPanel .sub-panel')
                .forEach((p) => p.classList.remove('is-visible'));
              document
                .getElementById(
                  'sub' + b.dataset.sub.charAt(0).toUpperCase() + b.dataset.sub.slice(1)
                )
                .classList.add('is-visible');
              if (b.dataset.sub === 'total') {
                Review.updateTotalStats();
              }
              if (b.dataset.sub === 'session') {
                Review.renderSessions();
              }
              if (b.dataset.sub === 'hand') {
                Review.populateHandSessionSelect();
                Review.renderHandReviews();
                HandPicker.render();  // [V6.16.0]
              }
              if (b.dataset.sub === 'weekly') {
                Review.generateWeeklyStats();
                Review.renderWeeklyReviews();
              }
              if (b.dataset.sub === 'opponent') {
                Review.renderOpponentProfiles();
              }
            });
          },

};
