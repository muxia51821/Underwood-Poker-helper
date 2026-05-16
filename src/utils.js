import { CONSTANTS, EQUITY_FLOP, EQUITY_TURN } from './constants.js';

// #region Utils
/* ==================== 工具函数 ==================== */
export const Utils = {
  debounce(fn, delay = CONSTANTS.INPUT_DEBOUNCE_MS) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), delay);
    };
  },
  initDropdown(toggleBtn, menuEl) {
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuEl.classList.toggle('is-visible');
    });
    document.addEventListener('click', function (e) {
      if (!toggleBtn.contains(e.target) && !menuEl.contains(e.target))
        menuEl.classList.remove('is-visible');
    });
  },
  initToggleGroup(containerId) {
    document.getElementById(containerId).addEventListener('click', function (e) {
      var btn = e.target.closest('.toggle-btn');
      if (btn) btn.classList.toggle('is-active');
    });
  },
  sortByDateKey: function (arr, key) {
    key = key || 'id';
    return arr.slice().sort(function (a, b) {
      return b[key].localeCompare(a[key]);
    });
  },
  formatTime(date) {
    if (!date) return '';
    if (date instanceof Date)
      return isNaN(date.getTime()) ? '' : date.toTimeString().split(' ')[0];
    var d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toTimeString().split(' ')[0];
  },
  escapeHtml(s) {
    if (!s) return '';
    var d = Utils._escapeDiv || (Utils._escapeDiv = document.createElement('div'));
    d.textContent = String(s);
    return d.innerHTML;
  },
  getLocalDate() {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  },
  // [V6.11.0] 本地日期时间 YYYY-MM-DD HH:MM
  getLocalDatetime() {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0') +
      ' ' +
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0')
    );
  },
  // [V6.13.0] 手牌日期显示: YYYY-MM-DD → MM-DD, YYYY-MM-DD HH:MM → MM-DD HH:MM
  formatHandDate: function (s) {
    if (!s) return '--';
    return s.length >= 16 ? s.substring(5, 16) : s.substring(5, 10);
  },
  // [V7.0.2] 规范化对手名 → 去空格 + 统一小写，生成稳定标识
  normalizeOpponentName: function (name) {
    if (!name) return '';
    return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
  },
  // [V6.11.0] 对手显示名：优先别名，回退 oId
  getOpponentDisplayName: function (oid, aliases) {
    if (!oid) return '??';
    aliases = aliases || {};
    return aliases[oid] || oid;
  },
  generateUUID() {
    return (
      crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)
    );
  },
  safeFixed(num, digits = 1) {
    return isNaN(num) || !isFinite(num) ? '--' : num.toFixed(digits);
  },
  /**
   * 查表取精确胜率，outs 超过 20 自动回落组合公式
   * @param {number} outs - 听牌数 (0-25)
   * @param {boolean} isFlop - true=翻牌(两张牌), false=转牌(一张牌)
   * @returns {number} 胜率百分比 (0-100)
   */
  getEquity(outs, isFlop) {
    if (outs <= 0) return 0;
    var table = isFlop ? EQUITY_FLOP : EQUITY_TURN;
    if (outs < table.length) return table[Math.round(outs)];
    if (isFlop)
      return parseFloat((1 - (((47 - outs) / 47) * (46 - outs)) / 46) * 100).toFixed(1);
    return parseFloat((outs / 46) * 100).toFixed(1);
  },
  /**
   * 从所需胜率反推最小需要的 Outs 数
   * @param {number} reqPct - 所需胜率百分比
   * @param {boolean} isFlop - true=翻牌, false=转牌
   * @returns {number} 最小 outs 数
   */
  getRequiredOuts(reqPct, isFlop) {
    var table = isFlop ? EQUITY_FLOP : EQUITY_TURN;
    for (var i = 0; i < table.length; i++) {
      if (table[i] >= reqPct) return i;
    }
    return 21;
  },
  encodeBase64(obj) {
    const json = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    let binary = '';
    data.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  },
  decodeBase64(str) {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  },
  validateBackupData(data) {
    return data && data.sessions !== undefined && Array.isArray(data.sessions);
  },
  // [V6.2.1 修改] 手牌实时可视化：合并完整牌面 + Hero/对手同行
  updateHandVisual: function () {
    var text = document.getElementById('handDesc').value;
    var playerEl = document.getElementById('playerCardsVisual');
    var handEl = document.getElementById('handCardVisual');
    if (!text) {
      playerEl.innerHTML = '';
      playerEl.style.display = 'none';
      handEl.innerHTML = '';
      handEl.style.display = 'none';
      return;
    }

    var suitMap = { s: '♠', h: '♥', d: '♦', c: '♣' };
    var classMap = { s: 'black', h: 'red', d: 'red', c: 'black' };
    var cardRe = /[2-9TJQKAtjqka][shdcSHDC]/g;

    function parseCards(str) {
      var cards = [],
        m;
      cardRe.lastIndex = 0;
      while ((m = cardRe.exec(str)) !== null) {
        cards.push({
          rank: m[0].charAt(0).toUpperCase(),
          suit: m[0].charAt(1).toLowerCase(),
        });
      }
      return cards;
    }

    function makeBadge(c) {
      return (
        '<span class="card-badge ' +
        classMap[c.suit] +
        '">' +
        Utils.escapeHtml(c.rank) +
        suitMap[c.suit] +
        '</span>'
      );
    }

    function extractFirstCardSequence(str) {
      var re = /[2-9TJQKAtjqka][shdcSHDC]/g;
      var matches = [],
        m;
      while ((m = re.exec(str)) !== null) {
        matches.push({
          rank: m[0].charAt(0).toUpperCase(),
          suit: m[0].charAt(1).toLowerCase(),
          idx: m.index,
        });
      }
      if (matches.length === 0) return [];
      var group = [matches[0]];
      for (var i = 1; i < matches.length; i++) {
        if (matches[i].idx - (matches[i - 1].idx + 2) <= 2) {
          group.push(matches[i]);
        } else {
          break;
        }
      }
      return group.map(function (c) {
        return { rank: c.rank, suit: c.suit };
      });
    }

    function cardKey(c) {
      return c.rank + c.suit;
    }

    var lines = text.split('\n');
    var heroCards = null;
    var opponent = null;
    var flopCards = null,
      turnCards = null,
      riverCards = null;
    var hasFlopLine = false,
      hasTurnLine = false,
      hasRiverLine = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (!heroCards) {
        var heroM = line.match(/Hero[^\n\[]*\[([^\]]+)\]/);
        if (heroM) {
          var hc = parseCards(heroM[1]);
          if (hc.length >= 2) heroCards = hc;
        }
      }

      if (!opponent) {
        var oppRe = /([A-Z][A-Za-z+0-9]{1,5})\s*\[([^\]]+)\]/g;
        var om;
        while ((om = oppRe.exec(line)) !== null) {
          var before = line.substring(Math.max(0, om.index - 30), om.index);
          if (!/Hero\s*\/?\s*$/.test(before)) {
            var oc = parseCards(om[2]);
            if (oc.length >= 2) {
              opponent = { pos: om[1], cards: oc };
              break;
            }
          }
        }
      }

      var isOTF = line.indexOf('OTF') !== -1 || line.indexOf('翻牌') !== -1;
      var isOTT = line.indexOf('OTT') !== -1 || line.indexOf('转牌') !== -1;
      var isOTR = line.indexOf('OTR') !== -1 || line.indexOf('河牌') !== -1;
      var isStreetLine = isOTF || isOTT || isOTR;
      if (!isStreetLine) continue;

      var boardIdx = line.indexOf('牌面：');
      var seq;
      if (boardIdx !== -1) {
        seq = extractFirstCardSequence(line.substring(boardIdx + 3));
      } else {
        var streetMatch = line.match(/(OTF翻牌|OTT转牌|OTR河牌)/);
        if (streetMatch) {
          seq = extractFirstCardSequence(
            line.substring(streetMatch.index + streetMatch[0].length)
          );
        }
      }
      if (!seq || seq.length < 1) continue;
      if (isOTF) {
        flopCards = seq;
        hasFlopLine = true;
      } else if (isOTT) {
        turnCards = seq;
        hasTurnLine = true;
      } else if (isOTR) {
        riverCards = seq;
        hasRiverLine = true;
      }
    }

    var mergedBoard = [];
    if (riverCards && riverCards.length >= 5) {
      mergedBoard = riverCards;
    } else if (turnCards && turnCards.length >= 4 && !hasRiverLine) {
      mergedBoard = turnCards;
    } else if (flopCards && flopCards.length >= 3) {
      var seen = {};
      flopCards.forEach(function (c) {
        seen[cardKey(c)] = true;
        mergedBoard.push(c);
      });
      if (turnCards) {
        turnCards.forEach(function (c) {
          if (!seen[cardKey(c)]) {
            seen[cardKey(c)] = true;
            mergedBoard.push(c);
          }
        });
      }
      if (riverCards) {
        riverCards.forEach(function (c) {
          if (!seen[cardKey(c)]) {
            seen[cardKey(c)] = true;
            mergedBoard.push(c);
          }
        });
      }
    }

    var hasPlayer = heroCards && heroCards.length >= 2;
    if (hasPlayer) {
      var phtml =
        '<span style="color:#94a3b8;font-size:0.75em;align-self:center">hero:</span>';
      heroCards.forEach(function (c) {
        phtml += makeBadge(c);
      });
      if (opponent) {
        phtml +=
          '<span style="color:#94a3b8;font-size:0.75em;align-self:center;margin-left:12px">' +
          Utils.escapeHtml(opponent.pos) +
          ':</span>';
        opponent.cards.forEach(function (c) {
          phtml += makeBadge(c);
        });
      }
      playerEl.innerHTML = phtml;
      playerEl.style.display = 'flex';
    } else {
      playerEl.innerHTML = '';
      playerEl.style.display = 'none';
    }

    if (mergedBoard.length >= 3) {
      var bhtml = '';
      mergedBoard.forEach(function (c) {
        bhtml += makeBadge(c);
      });
      handEl.innerHTML = bhtml;
      handEl.style.display = 'flex';
      var suits = {};
      mergedBoard.forEach(function (c) {
        suits[c.suit] = true;
      });
      var sc = Object.keys(suits).length;
      var boardMap = { 1: 'M', 2: 'TT' };
      document.getElementById('handBoard').value = boardMap[sc] || 'R';
    } else {
      handEl.innerHTML = '';
      handEl.style.display = 'none';
    }
  },
  checkStorageQuota: function (additionalBytes) {
    var used = JSON.stringify(localStorage).length;
    var limit = (CONSTANTS.MAX_STORAGE_MB || 4) * 1024 * 1024;
    return used + additionalBytes < limit;
  },
  // [V6.9.1] 模板填充：克隆 template → 用 data 填充 [data-bind] 元素
  fillTemplate: function (tmplEl, data, htmlFields) {
    var frag = document.importNode(tmplEl.content, true);
    var bindEls = frag.querySelectorAll('[data-bind]');
    bindEls.forEach(function (el) {
      var key = el.dataset.bind;
      if (data[key] != null) {
        if (htmlFields && htmlFields.indexOf(key) >= 0) {
          el.innerHTML = String(data[key]);
        } else {
          el.textContent = String(data[key]);
        }
      }
    });
    return frag;
  },
  // [V6.19.2] 统一卡牌花色徽章渲染
  renderCardBadges(cardsStr, opts) {
    opts = opts || {};
    var suitMap = { s: '♠', h: '♥', d: '♦', c: '♣' };
    var classMap = { s: 'black', h: 'red', d: 'red', c: 'black' };
    var cardRe = /[2-9TJQKAtjqka][shdcSHDC]/g;
    var styleStr = opts.style || '';
    var m, html = '';
    while ((m = cardRe.exec(cardsStr)) !== null) {
      var rank = m[0].charAt(0).toUpperCase();
      var suit = m[0].charAt(1).toLowerCase();
      html += '<span class="card-badge ' + classMap[suit] + '"' + (styleStr ? ' style="' + styleStr + '"' : '') + '>' + Utils.escapeHtml(rank) + suitMap[suit] + '</span>';
    }
    return html;
  },
  // [V6.19.9] 安全的 innerHTML 替代（createContextualFragment + replaceChildren）
  setSafeHTML(el, html) {
    var frag = document.createRange().createContextualFragment(html);
    el.replaceChildren(frag);
  },
  // [V6.19.2] Toast 通知（替代 alert）
  showToast(msg, duration) {
    var el = document.getElementById('toast');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.add('toast--visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('toast--visible');
    }, duration || 2500);
  },
  // [V6.19.2] 统一盈亏格式化（带颜色和符号的 HTML）
  formatProfitHTML(pBB) {
    if (pBB == null || isNaN(pBB)) return '--';
    var color = pBB >= 0 ? '#4ade80' : '#f87171';
    var sign = pBB >= 0 ? '+' : '';
    return '<span style="color:' + color + '">' + sign + Utils.safeFixed(pBB, 1) + ' BB</span>';
  },
};
// #endregion

// [V6.6.2] PubSub event bus — 后续版本逐步迁移模块使用
export const PubSub = {
  _events: {},
  on: function (event, fn) {
    (this._events[event] = this._events[event] || []).push(fn);
  },
  off: function (event, fn) {
    var arr = this._events[event];
    if (arr) {
      this._events[event] = arr.filter(function (f) {
        return f !== fn;
      });
    }
  },
  emit: function (event, data) {
    (this._events[event] || []).forEach(function (fn) {
      fn(data);
    });
  },
};
