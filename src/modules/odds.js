// [V6.9.2] 赔率计算模块
import { CONSTANTS, EQUITY_FLOP, EQUITY_TURN } from '../constants.js';
import { Utils } from '../utils.js';

export const Odds = {
  lastCalc: {},
  _impliedTimer: null,
  init() {
    this.potInput = document.getElementById('potInput');
    this.betInput = document.getElementById('betInput');
    this.outsInput = document.getElementById('outsInput');
    this.stackInput = document.getElementById('stackInput');
    const dc = Utils.debounce(() => this.calc(), CONSTANTS.INPUT_DEBOUNCE_MS);
    [this.potInput, this.betInput, this.outsInput, this.stackInput].forEach((el) =>
      el.addEventListener('input', dc)
    );
    document.querySelectorAll('.bet-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const p = parseFloat(this.potInput.value);
        if (p > 0) {
          const map = {
            0.25: 0.25,
            '1/3': 1 / 3,
            '0.50': 0.5,
            '2/3': 2 / 3,
            0.75: 0.75,
            1: 1,
            1.2: 1.2,
            1.5: 1.5,
          };
          const r = map[b.dataset.ratio];
          if (r) {
            this.betInput.value = Utils.safeFixed(p * r, 1);
            this.calc();
          }
        }
      })
    );
    document.querySelectorAll('.outs-btn').forEach((b) =>
      b.addEventListener('click', () => {
        this.outsInput.value = b.dataset.outs;
        this.calc();
      })
    );
    document.getElementById('multiWaySelect').addEventListener('change', () => this.calc());
    document.getElementById('comboCheck').addEventListener('change', function () {
      document.getElementById('comboRow').style.display = this.checked ? 'block' : 'none';
      document.getElementById('impliedDetails').open = this.checked;
      Odds.calc();
    });
    document.getElementById('turnBetInput').addEventListener('input', () => this.syncTurnAmt());
    document.getElementById('turnPctInput').addEventListener('input', () => this.syncTurnPct());
    document.querySelectorAll('.turn-bet-btn').forEach((b) =>
      b.addEventListener('click', () => {
        document.getElementById('turnPctInput').value = b.dataset.pct;
        this.syncTurnPct();
      })
    );
    document.querySelectorAll('input[name="street"]').forEach((r) =>
      r.addEventListener('change', () => this.calc())
    );
    var impliedInputEl = document.getElementById('impliedInput');
    if (impliedInputEl) {
      impliedInputEl.addEventListener('input', function () {
        if (Odds._impliedTimer) clearTimeout(Odds._impliedTimer);
        Odds._impliedTimer = setTimeout(function () {
          Odds.calcImplied();
        }, 200);
      });
    }
    this.calc();
    // [V7.2.0]
    if (window.innerWidth >= 768) {
      var srp = document.getElementById('srpDetails');
      var imp = document.getElementById('impliedDetails');
      var outsRef = document.getElementById('outsRefDetails');
      if (srp) srp.open = true;
      if (imp) imp.open = true;
      if (outsRef) outsRef.open = true;
      this.renderOutsTable();
    }
  },
  // [V7.2.0] Outs → Equity 速查表（静态数据仅高亮行变化，缓存避免重复渲染）
  renderOutsTable() {
    var el = document.getElementById('outsRefBody');
    if (!el) return;
    var highlight = +this.outsInput.value || 8;
    if (highlight === this._lastOutsHl) return;
    this._lastOutsHl = highlight;
    var rows = '';
    for (var i = 0; i <= 20; i++) {
      var cls = i === highlight ? ' class="is-current"' : '';
      rows += '<tr' + cls + '><td>' + i + '</td><td>' + Utils.safeFixed(EQUITY_FLOP[i], 1) + '%</td><td>' + Utils.safeFixed(EQUITY_TURN[i], 1) + '%</td></tr>';
    }
    el.innerHTML = rows;
  },
  calc() {
    const pot = +this.potInput.value,
      bet = +this.betInput.value,
      outs = +this.outsInput.value,
      stack = +this.stackInput.value || 0;
    var impliedRes = document.getElementById('impliedResult');
    if (impliedRes && parseFloat(document.getElementById('impliedInput').value) > 0) {
      impliedRes.innerHTML =
        '<span style="color: #d4a853;">⚠️ 参数已更改，请修改隐含赔率以重新计算</span>';
    }
    const isOne = document.querySelector('input[name="street"]:checked').value === 'one',
      combo = document.getElementById('comboCheck').checked,
      turnBet = combo ? +document.getElementById('turnBetInput').value : 0;
    const ratioDiv = document.getElementById('betRatio'),
      res = document.getElementById('oddsResult');
    if (isNaN(pot) || isNaN(bet) || pot <= 0 || bet <= 0) {
      ratioDiv.textContent = '';
      document.getElementById('sizingTable').innerHTML = '';
      res.innerHTML = '<div class="text-muted">请输入有效的底池和下注金额</div>';
      return;
    }
    ratioDiv.textContent = '📊 对手下注了底池的 ' + Utils.safeFixed((bet / pot) * 100, 1) + '%';
    if (stack > 0) {
      const spr = (stack / (pot + bet)).toFixed(1);
      document.getElementById('sprDisplay').innerHTML = !isNaN(spr)
        ? '💡 SPR: <span class="highlight">' + spr + '</span> (' + stack + 'BB / ' + (pot + bet) + 'BB)'
        : '';
    } else {
      document.getElementById('sprDisplay').textContent = '';
    }
    if (isNaN(outs) || outs < 0 || outs > 25 || (combo && (isNaN(turnBet) || turnBet <= 0))) {
      res.innerHTML = '<span class="text-lose">请输入有效的Outs (0-25) 及转牌下注</span>';
      return;
    }
    let cost, totalPot, rawEstWin, estWin, reqWin, ev;
    const isFlop = !isOne;
    const mwVal = +document.getElementById('multiWaySelect').value;
    const adjFactor = mwVal === 2 ? 0.96 : mwVal === 3 ? 0.91 : 1;
    if (!combo) {
      cost = bet;
      totalPot = pot + bet * 2;
      reqWin = cost / totalPot;
      rawEstWin = Utils.getEquity(outs, isFlop) / 100;
      estWin = rawEstWin * adjFactor;
      ev = estWin * totalPot - cost;
    } else {
      cost = bet + turnBet;
      totalPot = pot + bet * 2 + turnBet * 2;
      reqWin = cost / totalPot;
      rawEstWin = Utils.getEquity(outs, true) / 100;
      estWin = rawEstWin * adjFactor;
      ev = estWin * totalPot - cost;
    }
    this.lastCalc = { pot, bet, callAmount: cost, totalPot, estWin, reqWin, combo, turnBet };
    const req1 = Utils.getRequiredOuts(reqWin * 100, false),
      req2 = Utils.getRequiredOuts(reqWin * 100, true),
      mdf = pot / (pot + bet),
      mdfPct = (mdf * 100).toFixed(1);
    const verdict =
      estWin > reqWin
        ? '<span class="text-win">✅ +EV 跟注</span>'
        : Math.abs(estWin - reqWin) < 0.005
          ? '<span class="highlight">⚖️ 边缘决策</span>'
          : '<span class="text-lose">❌ -EV 弃牌</span>';
    let html = 'Bet/Pot <span class="highlight">' + Utils.safeFixed((bet / pot) * 100, 1) + '%</span> · 需要胜率 ≥ <span class="highlight">' + Utils.safeFixed(reqWin * 100, 1) + '%</span><br>';
    if (combo) html += '转牌下注 ' + turnBet + ' BB，总成本 <span class="highlight">' + cost + ' BB</span><br>';
    html += '胜率 <span class="' + (rawEstWin >= reqWin ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(rawEstWin * 100, 1) + '%</span> (精确)';
    if (adjFactor < 1) {
      html += ' → <span style="color:#a8afba">' + (mwVal === 2 ? '2人' : '多人') + '修正 ≈ <span class="' + (estWin >= reqWin ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(estWin * 100, 1) + '%</span></span>';
    }
    html += '<br>';
    html += 'EV ≈ <span class="' + (ev >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(ev, 2) + ' BB</span> → ' + verdict + '<br>';
    html += '📌 平衡所需Outs: 一张 ≥ <span class="highlight">' + req1 + '</span>, 两张 ≥ <span class="highlight">' + req2 + '</span><br>';
    if (stack > 0) {
      const geoBets = Math.max(1, Math.min(3, Math.round(stack / (pot + bet))));
      const geoSize = 0.5 * (Math.pow((pot + 2 * stack) / pot, 1 / geoBets) - 1) * 100;
      html += '<br><details style="margin-top:1.5px"><summary style="font-size:0.8em;color:#a8afba;cursor:pointer">📏 几何路线与Stack Off (基于翻牌视角)</summary>';
      html += '<p style="font-size:0.8em;color:#cbd5e1;margin:4px 0">';
      const streetNames = ['Flop', 'Turn', 'River'];
      for (let i = 0; i < geoBets; i++) {
        if (i > 0) html += ' | ';
        html += streetNames[i] + ' 下注 <span class="highlight">' + Utils.safeFixed(geoSize, 0) + '%</span>';
      }
      html += '</p>';
      let currentPot = pot;
      let currentStack = stack;
      html += '<div style="font-size:0.8em;color:#cbd5e1;margin:6px 0;padding:6px;background:#0a1a3a;border-radius:6px">';
      for (let i = 0; i < geoBets; i++) {
        const betAmount = Math.round((currentPot * geoSize) / 100);
        const newPot = currentPot + betAmount * 2;
        const newStack = currentStack - betAmount;
        html += streetNames[i] + ': 下注 <span class="highlight">' + betAmount + ' BB</span> → 底池 <span class="highlight">' + newPot + ' BB</span> → 剩余 <span class="highlight">' + newStack + ' BB</span><br>';
        currentPot = newPot;
        currentStack = newStack;
      }
      html += '</div>';
      html += '<p style="font-size:0.7em;color:#a8afba">⚡ 提示：基于当前底池与筹码深度的几何下注路线。剩余下注轮数已自动识别。实战中请根据牌面结构动态调整。</p></details>';
    }
    const consecutiveMDF = Math.pow(mdf, 3) * 100;
    html += '<br><details style="margin-top:1.5px"><summary style="font-size:0.8em;color:#a8afba;cursor:pointer">🛡️ MDF <span class="highlight">' + mdfPct + '%</span> · 连续防守 <span class="highlight">' + Utils.safeFixed(consecutiveMDF, 1) + '%</span></summary>';
    html += '<p style="font-size:0.8em;color:#cbd5e1;margin:4px 0">当前下注需防守 <span class="highlight">' + mdfPct + '%</span> 的范围</p>';
    html += '<p style="font-size:0.8em;color:#cbd5e1;margin:4px 0">若对手连开三枪，最终需防守范围 ≈ <span class="highlight">' + Utils.safeFixed(consecutiveMDF, 1) + '%</span></p>';
    html += '<p style="font-size:0.7em;color:#a8afba">⚡ 提示：MDF³ 假设对手始终使用当前下注尺度。面对低诈唬频率对手时，可适当收缩防守范围。</p></details>';
    const betRatio = bet / pot;
    const sizes = [
      { label: '1/4', r: 0.25 }, { label: '1/3', r: 1 / 3 }, { label: '1/2', r: 0.5 },
      { label: '2/3', r: 2 / 3 }, { label: '3/4', r: 0.75 }, { label: '满池', r: 1 },
      { label: '1.25x', r: 1.25 }, { label: '1.5x', r: 1.5 },
    ];
    let matchIdx = -1, betweenIdx = -1;
    for (let i = 0; i < sizes.length; i++) {
      if (Math.abs(betRatio - sizes[i].r) < 0.01) { matchIdx = i; break; }
      if (i < sizes.length - 1 && betRatio > sizes[i].r && betRatio < sizes[i + 1].r) {
        betweenIdx = i; break;
      }
    }
    let stHtml = '<table class="cheatsheet"><thead><tr><th>尺度</th><th>所需胜率</th><th>Alpha</th><th>MDF</th></tr></thead><tbody>';
    sizes.forEach(function (s, i) {
      const req = Utils.safeFixed((s.r / (1 + 2 * s.r)) * 100, 0),
        alphaV = Utils.safeFixed((s.r / (1 + s.r)) * 100, 0),
        mdfV = Utils.safeFixed((1 / (1 + s.r)) * 100, 0);
      const rowClass = i === matchIdx ? 'is-current' : '';
      const betweenStyle = i === betweenIdx ? 'style="border-bottom:2px solid #d4a853"' : '';
      stHtml += '<tr class="' + rowClass + '" ' + betweenStyle + '><td>' + s.label + '</td><td>' + req + '%</td><td>' + alphaV + '%</td><td>' + mdfV + '%</td></tr>';
    });
    stHtml += '</tbody></table>';
    document.getElementById('sizingTable').innerHTML =
      '<details style="margin-top:2px"><summary style="font-size:0.75em;color:#a8afba;cursor:pointer">📊 尺度速查（尺度 | 所需胜率 | Alpha | MDF）</summary>' + stHtml + '</details>';
    res.innerHTML = html;
    var impInput = document.getElementById('impliedInput');
    if (impInput) {
      var def = 0;
      if (isOne) {
        def = Math.min(stack, (pot + bet * 2) / 2);
      } else if (combo && turnBet > 0) {
        def = Math.min(stack, turnBet);
      }
      impInput.value = Utils.safeFixed(def, 1);
    }
    this.renderOutsTable();
    this.calcImplied();
  },
  calcImplied() {
    const implied = parseFloat(document.getElementById('impliedInput') && document.getElementById('impliedInput').value) || 0;
    const r = document.getElementById('impliedResult');
    if (!r) return;
    const callAmount = this.lastCalc.callAmount;
    const totalPot = this.lastCalc.totalPot;
    const estWin = this.lastCalc.estWin;
    if (implied > 0 && callAmount && totalPot && estWin != null) {
      const iev = estWin * (totalPot + implied) - callAmount;
      const irw = callAmount / (totalPot + implied);
      r.innerHTML = '额外赢取 <span class="highlight">' + implied + ' BB</span><br>隐含EV ≈ <span class="' + (iev >= 0 ? 'text-win' : 'text-lose') + '">' + Utils.safeFixed(iev, 2) + ' BB</span><br>所需胜率 ≈ <span class="highlight">' + Utils.safeFixed(irw * 100, 1) + '%</span>';
    } else {
      r.innerHTML = '输入额外赢取以计算隐含EV';
    }
  },
  syncTurnAmt() {
    const p = +this.potInput.value,
      b = +this.betInput.value,
      t = +document.getElementById('turnBetInput').value;
    if (p > 0 && b > 0 && !isNaN(t))
      document.getElementById('turnPctInput').value = Math.round((t / (p + b * 2)) * 100);
    this.calc();
  },
  syncTurnPct() {
    const p = +this.potInput.value,
      b = +this.betInput.value,
      pct = +document.getElementById('turnPctInput').value;
    if (p > 0 && b > 0 && !isNaN(pct))
      document.getElementById('turnBetInput').value = Utils.safeFixed(((p + b * 2) * pct) / 100, 1);
    this.calc();
  },
};
