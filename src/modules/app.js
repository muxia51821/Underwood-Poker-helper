import { CONSTANTS } from '../constants.js';
import { Utils, PubSub } from '../utils.js';
import { Store, SessionRepo, WeeklyRepo, TiltLogRepo } from '../store/store.js';
import { srpData, ACTION_SHORT } from '../data/srpData.js';
import { GTO_LEGACY_SCOPE } from '../data/strategy/gtoBaseline.js';  // [V7.9.0 新增] 旧 GTO 对照统一标注
import { underBluff, overBluff } from '../data/actionLines.js';

import { DataSync } from './dataSync.js';
import { TiltRescue } from './tiltRescue.js';
import { Timer, _setTimerGlobals } from './timer.js';
import { Odds } from './odds.js';
import { Review } from './review.js';
import { initGGImport } from './ggImport.js';
import { HandPicker } from './handPicker.js';  // [V6.15.0]
import { Discover } from './discover.js';      // [V7.4.6]
import { Navigation } from './navigation.js';  // [V7.7.2]
import { StrategyDesk } from './strategyDesk.js';  // [V7.10.1 新增] Evidence & Strategy

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

            Navigation.configure({
              onTab: function (tab) {
                if (tab === 'odds') Odds.calc();
                if (tab === 'review' && !App.reviewRendered) {
                  Review.renderAll();
                  App.reviewRendered = true;
                }
              },
              onSubtab: function (name, options) {
                if (name === 'total') Review.updateTotalStats();
                if (name === 'session') Review.renderSessions();
                if (name === 'hand') {
                  if (options.resetPage) Review.handCurrentPage = 1;
                  Review.populateHandSessionSelect();
                  Review.renderHandReviews();
                  HandPicker.render();
                }
                if (name === 'discover') Review.renderDiscover(options);
                if (name === 'strategy') StrategyDesk.render();  // [V7.9.3 新增]
                if (name === 'weekly') {
                  Review.generateWeeklyStats();
                  Review.renderWeeklyReviews();
                }
                if (name === 'opponent') Review.renderOpponentProfiles();
              },
              onTargetHand: function (handId) { Review.focusHand(handId); },
              onTargetSession: function (sessionId) { Review.focusSession(sessionId); },
              onLearningTarget: function (target) { Review.startLearningTarget(target); },
              onTargetStrategy: function (strategyId) { StrategyDesk.editStrategy(strategyId); },  // [V7.10.1 新增]
              onTargetOpponent: function (oHash) { Review.focusOpponent(oHash); },  // [V7.10.2 新增]
              onRefresh: function (scope) {
                if (scope === 'hand') Review.renderHandReviews();
                else if (scope === 'session') Review.renderSessions();
                else Review.renderAll();
              },
            });
            this.bindSettings();
            this.bindNav();
            this.bindSubNav();
            Timer.init();
            Odds.init();

            Review.init();
            Discover.init();  // [V7.4.7] 初始化扫描状态
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

            // [V7.7.0] 懒加载 GTO 频率速查表
            const srpDetails = document.getElementById('srpDetails');
            if (srpDetails) {
              srpDetails.addEventListener('toggle', function () {
                if (this.open && !App._srpLoaded) {
                  // [V7.9.0 新增] 旧 GTO 适用范围声明（单一来源：gtoBaseline.GTO_LEGACY_SCOPE）
                  var srpScopeNote = document.getElementById('srpScopeNote');
                  if (srpScopeNote) srpScopeNote.textContent = GTO_LEGACY_SCOPE.note;
                  App.renderSRPTable();
                  var filterScenario = document.getElementById('filterScenario');
                  var filterHigh = document.getElementById('filterHigh');
                  var filterCategory = document.getElementById('filterCategory');
                  if (filterScenario) filterScenario.addEventListener('change', App.renderSRPTable);
                  if (filterHigh) filterHigh.addEventListener('change', App.renderSRPTable);
                  if (filterCategory) filterCategory.addEventListener('change', App.renderSRPTable);
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
                if (e.target === ov) {
                  ov.classList.remove('is-active');
                  // [V7.3.3] 点击遮罩关闭 tilt 时重置 locked + 清理计时器
                  if (ov.id === 'tiltOverlay') {
                    TiltRescue.locked = false;
                    if (TiltRescue.countdownTimer) {
                      clearInterval(TiltRescue.countdownTimer);
                      TiltRescue.countdownTimer = null;
                    }
                  }
                }
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
          // [V7.7.0] GTO 频率速查表渲染
          renderSRPTable() {
            var scenario = document.getElementById('filterScenario') ? document.getElementById('filterScenario').value : 'SBvsBB';
            var highFilter = document.getElementById('filterHigh') ? document.getElementById('filterHigh').value : 'all';
            var catFilter = document.getElementById('filterCategory') ? document.getElementById('filterCategory').value : 'all';
            var catLabels = {
              dryAHigh: '干燥A高', flushy_dry: '双花干燥', straighty: '听顺面',
              flushy_straighty: '双花听顺', paired_high: '公对高', monotone: '天花面',
              dry_low: '低牌干燥', paired_low: '公对低', made_straight: '天顺面', trips_board: '三条面',
            };
            function _freqColor(f) {
              if (f >= 35) return '#6baf7e';
              if (f >= 13) return '#d4a853';
              return '#c06060';
            }
            function _freqBarHtml(freq, color) {
              return '<span style="display:inline-block;width:48px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;vertical-align:middle;margin:0 4px">' +
                '<span style="display:block;height:100%;width:' + Math.round(freq) + '%;background:' + color + ';border-radius:3px"></span></span>';
            }
            var rows = [];
            srpData.forEach(function (d) {
              if (d.scenario !== scenario) return;
              if (highFilter !== 'all' && d.high !== highFilter) return;
              if (catFilter !== 'all' && d.category !== catFilter) return;
              var dom = d.dominant, sec = d.secondary;
              var domShort = ACTION_SHORT[dom.key] || { code: '?' };
              var secShort = ACTION_SHORT[sec.key] || { code: '?' };
              var domColor = _freqColor(dom.freq), secColor = _freqColor(sec.freq);
              rows.push('<tr>' +
                '<td>' + Utils.renderCardBadges(d.flop) + '</td>' +
                '<td style="font-size:0.85em">' + (catLabels[d.category] || d.category) + '</td>' +
                '<td><span style="color:' + domColor + ';font-weight:600">' + domShort.code + '</span> <span style="font-size:0.85em">' + Utils.safeFixed(dom.freq, 1) + '%</span>' + _freqBarHtml(dom.freq, domColor) + '</td>' +
                '<td><span style="color:' + secColor + ';font-weight:600">' + secShort.code + '</span> <span style="font-size:0.85em">' + Utils.safeFixed(sec.freq, 1) + '%</span>' + _freqBarHtml(sec.freq, secColor) + '</td>' +
                '</tr>');
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
            // [V7.3.4] 四配色方案切换: Pale → Nimbus → Ember → Neon
            var csBtn = document.getElementById('colorSchemeOption');
            var schemes = ['pale', 'nimbus', 'ember', 'neon'];
            var labels = { pale: '🎨 Nimbus', nimbus: '🎨 Ember', ember: '🎨 Neon', neon: '🎨 Pale' };
            var classes = { nimbus: 'color-nimbus', ember: 'color-ember', neon: 'color-neon' };
            var savedScheme = localStorage.getItem('pa_colorScheme') || 'pale';
            var allClasses = ['color-nimbus', 'color-ember', 'color-neon'];
            if (savedScheme !== 'pale') { document.body.classList.add(classes[savedScheme]); }
            csBtn.textContent = labels[savedScheme];
            csBtn.addEventListener('click', function () {
              allClasses.forEach(function (c) { document.body.classList.remove(c); });
              var currentIdx = schemes.indexOf(localStorage.getItem('pa_colorScheme') || 'pale');
              var nextScheme = schemes[(currentIdx + 1) % schemes.length];
              if (nextScheme !== 'pale') { document.body.classList.add(classes[nextScheme]); }
              csBtn.textContent = labels[nextScheme];
              localStorage.setItem('pa_colorScheme', nextScheme);
            });
          },
          bindNav() {
            Navigation.bindNav();
          },
          bindSubNav() {
            Navigation.bindSubNav();
          },

};
