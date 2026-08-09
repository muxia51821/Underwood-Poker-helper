// [V6.9.2] 计时器模块（站立提醒/番茄钟）
import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';
import { Store } from '../store/store.js';

// 从 app.js 导入（函数声明提升支持循环引用）
let _beep, _vibrate, _notify;
export function _setTimerGlobals(beepFn, vibrateFn, notifyFn) {
  _beep = beepFn;
  _vibrate = vibrateFn;
  _notify = notifyFn;
}

export const Timer = {
  init() {
    this.workInput = document.getElementById('workMin');
    this.breakInput = document.getElementById('breakMin');
    this.startBtn = document.getElementById('startBtn');
    this.display = document.getElementById('timerDisplay');
    this.phaseBdg = document.getElementById('phaseBdg');
    this.workInput.addEventListener('change', () => this.updateSettings());
    this.breakInput.addEventListener('change', () => this.updateSettings());
    this.startBtn.addEventListener('click', () => this.toggle());
    document.getElementById('resetTimerBtn').addEventListener('click', () => this.reset());
    document.getElementById('resetCountBtn').addEventListener('click', () => this.resetCount());
    document.getElementById('logToggle').addEventListener('click', () => this.toggleLog());
    document.getElementById('clearLogBtn').addEventListener('click', () => this.clearTodayLogs());
    document.getElementById('skipBreakBtn').addEventListener('click', () => this.skipBreak());
    document.querySelectorAll('.timer-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.workInput.value = btn.dataset.work;
        this.breakInput.value = btn.dataset.break;
        this.updateSettings();
      });
    });
    this.longBreakCheck = document.getElementById('longBreakCheck');
    this.longBreakInterval = document.getElementById('longBreakInterval');
    this.longBreakMin = document.getElementById('longBreakMin');
    this.cycleCountEl = document.getElementById('cycleCount');
    this.longBreakCheck.addEventListener('change', () => this.updateLongBreakSettings());
    this.longBreakInterval.addEventListener('change', () => this.updateLongBreakSettings());
    this.longBreakMin.addEventListener('change', () => this.updateLongBreakSettings());
    this.restoreState();
    document.getElementById('todayCount').textContent = this.getCount();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.running && this.endTime) {
        this.updateDisplay();
        const rem = Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
        if (rem <= 0 && this.running) this.switchPhase();
      }
    });
  },
  // [V7.7.2 新增] Keep the primary Timer action accessible without changing timer semantics.
  syncPrimaryAction() {
    const isRunning = !!this.running;
    this.startBtn.textContent = isRunning ? '暂停计时' : '开始专注';
    this.startBtn.setAttribute('aria-pressed', String(isRunning));
    this.startBtn.setAttribute('aria-label', isRunning ? '暂停计时' : '开始专注计时');
  },
  restoreState() {
    const state = Store.timer.get();
    if (state && state.longBreak) {
      this.longBreakCheck.checked = state.longBreak.enabled;
      this.longBreakInterval.value = state.longBreak.interval;
      this.longBreakMin.value = state.longBreak.minutes;
    } else {
      this.longBreakCheck.checked = false;
      this.longBreakInterval.value = 4;
      this.longBreakMin.value = 15;
    }
    this.cycleCount = state && state.cycleCount || 0;
    if (this.cycleCountEl) {
      const interval = parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4;
      this.cycleCountEl.textContent = this.cycleCount + '/' + interval;
    }
    this.updateLongBreakSummary();
    const now = Date.now();
    if (state && state.endTime) {
      const expDur =
        (state.phase === 'work'
          ? parseInt(this.workInput.value)
          : parseInt(this.breakInput.value)) * 60000;
      const maxEnd = now + expDur * 2;
      if (state.endTime > now && state.endTime < maxEnd) {
        this.phase = state.phase;
        this.endTime = state.endTime;
        this.workStart = state.workStart ? new Date(state.workStart) : null;
        this.breakStart = state.breakStart ? new Date(state.breakStart) : null;
        this.interval = setInterval(() => this.tick(), 1000);
        this.running = true;
        this.syncPrimaryAction();
        this.updateDisplay();
        return;
      }
      if (state.endTime <= now && state.endTime > now - CONSTANTS.STATE_EXPIRE_MS) {
        this.phase = state.phase;
        this.endTime = state.endTime;
        this.workStart = state.workStart ? new Date(state.workStart) : null;
        this.breakStart = state.breakStart ? new Date(state.breakStart) : null;
        this.running = false;
        this.switchPhase();
        return;
      }
    }
    this.reset();
  },
  getCount() {
    const d = Store.standup.get();
    const t = Utils.getLocalDate();
    if (d.date === t) return d.count;
    d.date = t;
    d.count = 0;
    Store.standup.save(d);
    return 0;
  },
  setCount(c) {
    const d = Store.standup.get();
    d.date = Utils.getLocalDate();
    d.count = c;
    Store.standup.save(d);
    document.getElementById('todayCount').textContent = c;
  },
  incrementCount() {
    const d = Store.standup.get();
    d.date = Utils.getLocalDate();
    d.count = (d.count || 0) + 1;
    Store.standup.save(d);
    document.getElementById('todayCount').textContent = d.count;
  },
  resetCount() {
    this.setCount(0);
  },
  updateSettings() {
    if (!this.running) {
      const m =
        this.phase === 'work'
          ? parseInt(this.workInput.value)
          : parseInt(this.breakInput.value);
      this.endTime = Date.now() + m * 60000;
      this.updateDisplay();
      this.persistState();
    }
  },
  persistState() {
    const lb = {
      enabled: this.longBreakCheck && this.longBreakCheck.checked || false,
      interval: parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4,
      minutes: parseInt(this.longBreakMin && this.longBreakMin.value) || 15,
    };
    Store.timer.save(
      this.running && this.endTime
        ? {
            phase: this.phase,
            endTime: this.endTime,
            workStart: this.workStart && this.workStart.toISOString(),
            breakStart: this.breakStart && this.breakStart.toISOString(),
            longBreak: lb,
            cycleCount: this.cycleCount || 0,
          }
        : {
            endTime: null,
            phase: 'work',
            workStart: null,
            breakStart: null,
            longBreak: lb,
            cycleCount: this.cycleCount || 0,
          }
    );
  },
  toggle() {
    if (this.running) {
      clearInterval(this.interval);
      this.running = false;
      this.syncPrimaryAction();
      this.persistState();
    } else {
      if (Notification.permission === 'default') Notification.requestPermission();
      if (!this.endTime || this.endTime <= Date.now()) {
        const m =
          this.phase === 'work'
            ? parseInt(this.workInput.value)
            : parseInt(this.breakInput.value);
        this.endTime = Date.now() + m * 60000;
      }
      if (this.phase === 'work' && !this.workStart) this.workStart = new Date();
      if (this.phase === 'break' && !this.breakStart) this.breakStart = new Date();
      this.interval = setInterval(() => this.tick(), 1000);
      this.running = true;
      this.syncPrimaryAction();
      this.persistState();
    }
  },
  reset() {
    clearInterval(this.interval);
    this.running = false;
    this.phase = 'work';
    this.cycleCount = 0;
    this.endTime = Date.now() + parseInt(this.workInput.value) * 60000;
    this.workStart = null;
    this.breakStart = null;
    this.syncPrimaryAction();
    this.persistState();
    this.updateDisplay();
  },
  tick() {
    const n = Date.now();
    const r = Math.max(0, Math.ceil((this.endTime - n) / 1000));
    this.display.textContent = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
    if (r <= 0) this.switchPhase();
  },
  switchPhase() {
    const now = new Date();
    if (this.phase === 'work') {
      if (this.workStart)
        this.addLog({
          workStart: this.workStart.toISOString(),
          workEnd: now.toISOString(),
          breakStart: now.toISOString(),
          breakEnd: null,
        });
      this.incrementCount();
      this.phase = 'break';
      this.cycleCount = (this.cycleCount || 0) + 1;
      const longEnabled = this.longBreakCheck && this.longBreakCheck.checked || false;
      const longInterval = parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4;
      const longMin = parseInt(this.longBreakMin && this.longBreakMin.value) || 15;
      if (longEnabled && this.cycleCount >= longInterval) {
        this.isLongBreak = true;
        this.endTime = Date.now() + longMin * 60000;
        this.cycleCount = 0;
      } else {
        this.isLongBreak = false;
        this.endTime = Date.now() + parseInt(this.breakInput.value) * 60000;
      }
      this.breakStart = now;
      this.workStart = null;
    } else {
      if (this.breakStart) this.updateLastLog({ breakEnd: now.toISOString() });
      this.phase = 'work';
      this.endTime = Date.now() + parseInt(this.workInput.value) * 60000;
      this.workStart = now;
      this.breakStart = null;
      this.isLongBreak = false;
    }
    const breakLabel = this.isLongBreak
      ? '长休息 ' + (parseInt(this.longBreakMin && this.longBreakMin.value) || 15) + ' 分钟'
      : '休息 ' + this.breakInput.value + ' 分钟';
    if (_beep) _beep();
    if (_vibrate) _vibrate();
    if (_notify) _notify(
      this.phase === 'work' ? '继续专注' : this.isLongBreak ? '长休息时间' : '站起来活动',
      this.phase === 'work' ? '开始新的工作时段' : breakLabel
    );
    this.persistState();
    this.updateDisplay();
    if (document.getElementById('logWrap').style.display === 'block') this.renderLog();
  },
  addLog(e) {
    const t = Utils.getLocalDate();
    const l = Store.logs.get(t);
    l.push(e);
    Store.logs.save(t, l);
  },
  updateLastLog(u) {
    const t = Utils.getLocalDate();
    const l = Store.logs.get(t);
    if (l.length) {
      Object.assign(l[l.length - 1], u);
      Store.logs.save(t, l);
    }
  },
  clearTodayLogs() {
    if (confirm('确定清除今日所有站立记录吗？')) {
      Store.logs.save(Utils.getLocalDate(), []);
      this.renderLog();
    }
  },
  renderLog() {
    const logs = Store.logs.get(Utils.getLocalDate());
    const tb = document.getElementById('logBody');
    const rows = [];
    logs.forEach((l, i) => {
      const we = l.workEnd ? new Date(l.workEnd) : null,
        be = l.breakEnd ? new Date(l.breakEnd) : null;
      const wd = we ? Math.round((we - new Date(l.workStart)) / 1000) : 0,
        bd = be ? Math.round((be - new Date(l.breakStart)) / 1000) : 0;
      const f = Utils.formatTime,
        g = (s) => Math.floor(s / 60) + '分' + (s % 60) + '秒';
      rows.push(
        '<tr><td>' + (i + 1) + '</td><td>' + Utils.escapeHtml(f(new Date(l.workStart))) + '</td><td>' + Utils.escapeHtml(we ? f(we) : '--') + '</td><td>' + Utils.escapeHtml(f(new Date(l.breakStart))) + '</td><td>' + Utils.escapeHtml(be ? f(be) : '--') + '</td><td>' + (we ? Utils.escapeHtml(g(wd)) : '进行中') + '</td><td>' + (be ? Utils.escapeHtml(g(bd)) : '进行中') + '</td></tr>'
      );
    });
    tb.innerHTML = rows.join('');
  },
  toggleLog() {
    const w = document.getElementById('logWrap'),
      a = document.getElementById('logArrow');
    if (w.style.display === 'none') {
      w.style.display = 'block';
      a.textContent = '−';
      document.getElementById('logToggle').setAttribute('aria-expanded', 'true');
      this.renderLog();
    } else {
      w.style.display = 'none';
      a.textContent = '+';
      document.getElementById('logToggle').setAttribute('aria-expanded', 'false');
    }
  },
  updateDisplay() {
    const r = this.endTime
      ? Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000))
      : 25 * 60;
    this.display.textContent = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
    if (this.phase === 'work') {
      this.phaseBdg.textContent = '专注中';
      this.phaseBdg.className = 'timer__phase timer__phase--work';
    } else if (this.isLongBreak) {
      this.phaseBdg.textContent = '长休息';
      this.phaseBdg.className = 'timer__phase timer__phase--rest';
    } else {
      this.phaseBdg.textContent = '站立休息';
      this.phaseBdg.className = 'timer__phase timer__phase--rest';
    }
    if (this.cycleCountEl) {
      const interval = parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4;
      this.cycleCountEl.textContent = (this.cycleCount || 0) + '/' + interval;
    }
    this.display.classList.toggle('timer__display--long-break', !!this.isLongBreak);
    document.getElementById('skipBreakBtn').style.display =
      this.phase === 'break' ? 'block' : 'none';
    this.syncPrimaryAction();
  },
  skipBreak() {
    if (this.phase !== 'break' || !this.running) return;
    clearInterval(this.interval);
    this.switchPhase();
  },
  updateLongBreakSettings() {
    const interval = parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4;
    if (this.cycleCountEl)
      this.cycleCountEl.textContent = (this.cycleCount || 0) + '/' + interval;
    this.updateLongBreakSummary();
    this.persistState();
  },
  updateLongBreakSummary() {
    const el = document.getElementById('longBreakSummary');
    if (!el) return;
    const enabled = this.longBreakCheck && this.longBreakCheck.checked || false;
    const interval = parseInt(this.longBreakInterval && this.longBreakInterval.value) || 4;
    const min = parseInt(this.longBreakMin && this.longBreakMin.value) || 15;
    el.textContent = enabled ? '每' + interval + '次 → ' + min + '分' : '已关闭';
  },
};
