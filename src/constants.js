// #region CONSTANTS
/* ==================== 核心配置 ==================== */
export const CONSTANTS = {
  STORAGE_PREFIX: 'pa_',
  VERSION: '7.8.0',
  SESSION_GAP_HOURS: 1,  // [V7.3.2] 从 3h 改为 1h，线下 Live 手动创建不受影响
  DEV: true,
  SITE_URL: 'https://mxpoker.netlify.app/',
  DEFAULT_WORK_MIN: 20,
  DEFAULT_BREAK_MIN: 2,
  STATE_EXPIRE_MS: 2 * 60 * 1000,
  TILT_RESCUE_DURATION: 30,
  BIG_LOSS_THRESHOLD_BB: 40,
  MAX_STORAGE_MB: 4,
  INPUT_DEBOUNCE_MS: 300,
};

// [V6.3 新增] 精确胜率查找表（out→百分比），翻牌用组合概率公式、转牌用outs/46
export const EQUITY_FLOP = [
  0, 4.3, 8.4, 12.5, 16.5, 20.4, 24.1, 27.8, 31.5, 35.0, 38.4, 41.7, 45.0, 48.1, 51.2, 54.1,
  57.0, 59.8, 62.4, 65.0, 67.5,
];
export const EQUITY_TURN = [
  0, 2.2, 4.3, 6.5, 8.7, 10.9, 13.0, 15.2, 17.4, 19.6, 21.7, 23.9, 26.1, 28.3, 30.4, 32.6,
  34.8, 37.0, 39.1, 41.3, 43.5,
];
// #endregion

// #region Types
/* ==================== JSDoc 类型定义 ==================== */
/**
 * @typedef {{ id: string, date: string, level: string, duration: number, hands: number, profit: number, tilt: number, mistake: string, remark: string }} Session
 * @typedef {{ id: string, sessionId: string|null, date: string, potType: string, board: string, desc: string, decision: string, mistake: string, reflection: string, pBB: number|null, gg?: boolean, ggId?: string, oId?: string, oCards?: string|null }} HandReview
 * @typedef {{ week: string, weakness: string, plan: string }} WeeklyReview
 * @typedef {{ date: string, time: string, trigger: string, intensity: number, note: string }} TiltLog
 * @typedef {{ sound: boolean, vibrate: boolean }} Settings
 * @typedef {{ enabled: boolean, interval: number, minutes: number }} LongBreakConfig
 * @typedef {{ endTime: number|null, phase: string, workStart: string|null, breakStart: string|null, longBreak: LongBreakConfig, cycleCount: number }} TimerState
 * @typedef {{ date: string, count: number }} Standup
 */
// #endregion
