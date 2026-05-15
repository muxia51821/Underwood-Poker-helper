// [V6.9.2] 情绪急救模块
import { CONSTANTS } from '../constants.js';
import { Utils, PubSub } from '../utils.js';
import { TiltLogRepo } from '../store/store.js';

export const TiltRescue = {
  countdownTimer: null,
  locked: false,
  quotes: [
    '被Bad Beat是因为你把对手的手牌带入了摊牌。这是长期盈利的标志。',
    '你无法控制发牌，唯一能控制的是下一手牌的决策。',
    "不要试图'赢回损失'，你在打下一手牌，不是上一手。",
    '你的Tilt评分如果低于3分，应该直接站起离开牌桌。',
    '愤怒是拿别人的错误惩罚自己，在牌桌上尤其如此。',
    '每一次情绪失控，都是对手获利的机会。',
  ],
  init() {
    document.getElementById('emergencyBtn').addEventListener('click', () => this.start());
    document.getElementById('saveTiltLog').addEventListener('click', () => this.saveAndClose());
  },
  start() {
    if (this.locked) return;
    this.locked = true;
    const overlay = document.getElementById('tiltOverlay');
    overlay.classList.add('is-active');
    document.getElementById('tiltCircle').style.display = 'block';
    const instr = document.getElementById('tiltInstruction');
    instr.style.display = 'block';
    document.getElementById('tiltQuote').style.display = 'none';
    document.getElementById('tiltForm').style.display = 'none';
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    let remaining = CONSTANTS.TILT_RESCUE_DURATION;
    instr.textContent = '吸气…憋气…呼气… (' + remaining + '秒)';
    this.countdownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        instr.textContent = '吸气…憋气…呼气… (' + remaining + '秒)';
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        document.getElementById('tiltCircle').style.display = 'none';
        instr.style.display = 'none';
        document.getElementById('tiltQuote').style.display = 'block';
        document.getElementById('tiltQuote').textContent =
          this.quotes[Math.floor(Math.random() * this.quotes.length)];
        document.getElementById('tiltForm').style.display = 'block';
      }
    }, 1000);
  },
  saveAndClose() {
    try {
      const trigger = document.getElementById('tiltTrigger').value;
      const intensity = parseInt(document.getElementById('tiltIntensity').value) || 5;
      const note = document.getElementById('tiltNote').value.trim();
      const log = {
        date: Utils.getLocalDate(),
        time: new Date().toISOString(),
        trigger,
        intensity,
        note,
      };
      const logs = TiltLogRepo.getAll();
      logs.push(log);
      TiltLogRepo.saveAll(logs);
      document.getElementById('tiltOverlay').classList.remove('is-active');
      document.getElementById('tiltIntensity').value = '5';
      document.getElementById('tiltNote').value = '';
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.locked = false;
      // [V6.9.2] 通过 PubSub 通知 Review 刷新 tilt 日志，避免循环依赖
      PubSub.emit('tiltLogSaved');
    } catch (e) {
      alert('保存失败');
      this.locked = false;
    }
  },
};
