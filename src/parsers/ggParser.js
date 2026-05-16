import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';

// #region GGParser
// [V6.4.2 新增] GG 手牌历史解析器 — 独立命名空间，从 Utils 拆分
export const GGParser = {
  // 牌面排序（rank降序: A K Q J T 9 8 7 6 5 4 3 2）
  _sortCardsDesc: function (cardsStr) {
    if (!cardsStr) return '';
    var order = 'AKQJT98765432';
    return cardsStr
      .split(' ')
      .sort(function (a, b) {
        return order.indexOf(a.charAt(0)) - order.indexOf(b.charAt(0));
      })
      .join(' ');
  },
  // 提取街道新出张
  _getNewCards: function (fullBoard, prevBoard) {
    if (!fullBoard) return '';
    if (!prevBoard) return fullBoard;
    var prev = prevBoard.split(' ');
    return fullBoard
      .split(' ')
      .filter(function (c) {
        return prev.indexOf(c) === -1;
      })
      .join(' ');
  },
  // 牌面结构分类 (M=天花, TT=双色, R=彩虹)
  _classifyBoard: function (boardCards) {
    if (!boardCards) return '';
    var suits = boardCards.split(' ').map(function (c) {
      return c.charAt(c.length - 1);
    });
    var uniq = suits.filter(function (s, idx) {
      return suits.indexOf(s) === idx;
    });
    return uniq.length === 1 ? 'M' : uniq.length === 2 ? 'TT' : 'R';
  },
  // 动态位置映射（含HU）
  _posMap: function (block) {
    var sumIdx = block.indexOf('*** SUMMARY ***');
    var scanBlock = sumIdx > 0 ? block.substring(0, sumIdx) : block;
    var seats = [];
    var m;
    var re = /Seat (\d+):/g;
    while ((m = re.exec(scanBlock)) !== null) seats.push(parseInt(m[1]));
    seats.sort(function (a, b) {
      return a - b;
    });
    var n = seats.length;
    var btnM = block.match(/Seat #(\d+) is the button/);
    var btn = btnM ? parseInt(btnM[1]) : seats[n - 1];
    var bi = seats.indexOf(btn);
    if (bi < 0) bi = n - 1;
    var map = {};
    if (n === 2) {
      map[seats[bi]] = 'BTN';
      map[seats[(bi + 1) % 2]] = 'BB';
      return map;
    }
    var ec = n - 3;
    var early = [];
    if (ec === 1) early = ['UTG'];
    else if (ec === 2) early = ['UTG', 'CO'];
    else if (ec === 3) early = ['UTG', 'MP', 'CO'];
    else if (ec === 4) early = ['UTG', 'MP', 'HJ', 'CO'];
    else if (ec === 5) early = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO'];
    else if (ec >= 6) early = ['UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO'];
    var all = ['BTN', 'SB', 'BB'].concat(early);
    for (var j = 0; j < n && j < all.length; j++) {
      map[seats[(bi + j) % n]] = all[j];
    }
    return map;
  },
  // 行动格式化（底池百分比优先）
  _formatAction: function (act, currentPotBB, bbValue) {
    if (/checks/i.test(act)) return 'X';
    if (/folds/i.test(act)) return 'F';
    if (/calls/i.test(act)) return 'C';
    var betM = act.match(/bets \$([\d.]+)/);
    if (betM) {
      var betBB = parseFloat(betM[1]) / bbValue;
      var betBBStr = Utils.safeFixed(betBB, 1);
      var pct = currentPotBB > 0 ? Math.round((betBB / currentPotBB) * 100) : -1;
      return pct > 0 && pct <= 500
        ? 'B' + pct + ' (' + betBBStr + 'bb)'
        : 'B ' + betBBStr + 'bb';
    }
    var raiseM = act.match(/raises \$[\d.]+ to \$([\d.]+)/);
    if (raiseM) return 'R' + Utils.safeFixed(parseFloat(raiseM[1]) / bbValue, 1);
    return act.replace(/\$[\d.]+/g, function (d) {
      return Utils.safeFixed(parseFloat(d) / bbValue, 1) + 'bb';
    });
  },
  // 文本切分 + BB 检测
  _splitBlocks: function (raw) {
    var parts = raw.split(/Poker Hand #/);
    var blocks = [];
    for (var p = 1; p < parts.length; p++) {
      var b = ('Poker Hand #' + parts[p]).trim();
      if (b) blocks.push(b);
    }
    var bbValue = 0.05;
    for (var i = 0; i < blocks.length; i++) {
      var bbM = blocks[i].match(/posts big blind \$([\d.]+)/);
      if (bbM) {
        bbValue = parseFloat(bbM[1]);
        break;
      }
    }
    return { blocks: blocks, bbValue: bbValue };
  },
  /**
   * 盈亏计算（纯投入法）：投入 = 盲注+ante+主动投入 - uncalled返还，profit = 赢取 - 投入
   * @param {string} block - 单局 GG 手牌文本
   * @param {number} heroSeat - Hero 座位号
   * @param {number} heroStartStack - Hero 起始筹码($)
   * @param {number} bbValue - 大盲金额($)
   * @returns {{profit: number, profitBB: number, invested: number}}
   */
  _calcProfit: function (block, heroSeat, heroStartStack, bbValue) {
    var invested = 0;
    var heroPostRe = /^Hero:? posts (?:small blind|big blind|the ante) \$([\d.]+)/gm;
    var hpm;
    while ((hpm = heroPostRe.exec(block)) !== null) {
      invested += parseFloat(hpm[1]);
    }
    var heroActRe =
      /^Hero:? (?:calls \$([\d.]+)|bets \$([\d.]+)|raises \$[\d.]+ to \$([\d.]+))/gm;
    var ham;
    while ((ham = heroActRe.exec(block)) !== null) {
      invested += parseFloat(ham[1] || ham[2] || ham[3] || '0');
    }
    var uncalledRe = /Uncalled bet \(\$([\d.]+)\) returned to Hero/g;
    var um;
    while ((um = uncalledRe.exec(block)) !== null) {
      invested -= parseFloat(um[1]);
    }
    var collectedM = block.match(/^Hero collected \$([\d.]+) from pot/m);
    var heroWonM = block.match(
      /Seat \d+: Hero \([^)]+\) (?:showed \[[^\]]+\] and )?(?:won|collected)(?: \(\$([\d.]+)\))?/
    );
    var profit;
    if (collectedM) {
      profit = parseFloat(collectedM[1]) - invested;
    } else if (heroWonM && heroWonM[1]) {
      profit = parseFloat(heroWonM[1]) - invested;
    } else {
      profit = 0 - invested;
    }
    return {
      profit: profit,
      profitBB: parseFloat((profit / bbValue).toFixed(1)),
      invested: invested,
    };
  },
  /**
   * 解析 GG 手牌历史文本，返回结构化手牌数据数组
   * @param {string} text - GG 原始手牌历史文本（可含多局）
   * @returns {Array<{handId: string, date: string, heroPosition: string, heroCards: string, profit: number, profitBB: number, potType: string, boardCards: string, board: string, desc: string, opponentId?: string, opponentCards?: string, rake: number, jackpot: number}>}
   */
  parse: function (text) {
    var split = this._splitBlocks(text);
    var blocks = split.blocks;
    var bbValue = split.bbValue;
    var results = [];
    var self = this;
    function toBB(dollar) {
      return parseFloat((parseFloat(dollar) / bbValue).toFixed(1));
    }
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (!/Seat \d+: Hero/i.test(block)) continue;
      try {
        var hand = {};
        var idM = block.match(/Poker Hand #([\w\d]+)/);
        hand.handId = idM ? idM[1] : '';
        var dateM = block.match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (dateM) {
          var utcMs = Date.UTC(
            +dateM[1],
            +dateM[2] - 1,
            +dateM[3],
            +dateM[4],
            +dateM[5],
            +dateM[6]
          );
          var bjMs = utcMs + 8 * 3600000;
          var bjDate = new Date(bjMs);
          hand.date =
            bjDate.getUTCFullYear() +
            '-' +
            String(bjDate.getUTCMonth() + 1).padStart(2, '0') +
            '-' +
            String(bjDate.getUTCDate()).padStart(2, '0') +
            ' ' +
            String(bjDate.getUTCHours()).padStart(2, '0') +
            ':' +
            String(bjDate.getUTCMinutes()).padStart(2, '0');
        } else {
          hand.date = '';
        }
        hand.bbValue = bbValue;
        var pm = self._posMap(block);
        var heroSeat = parseInt((block.match(/Seat (\d+): Hero/) || [0, 1])[1]);
        var heroPos = pm[heroSeat] || 'MP';
        hand.heroPosition = heroPos;
        var heroCardsM = block.match(/Dealt to Hero \[([^\]]+)\]/);
        hand.heroCards = heroCardsM ? heroCardsM[1] : '';
        var heroStackM = block.match(
          new RegExp('Seat ' + heroSeat + ': Hero \\(\\$([\\d.]+) in chips\\)')
        );
        hand.heroStartStack = heroStackM ? parseFloat(heroStackM[1]) : 0;
        // 盈亏计算
        var profitResult = self._calcProfit(block, heroSeat, hand.heroStartStack, bbValue);
        hand.profit = profitResult.profit;
        hand.profitBB = profitResult.profitBB;
        hand.isBigLoss = hand.profitBB <= -CONSTANTS.BIG_LOSS_THRESHOLD_BB;
        hand.heroEndStack = hand.heroStartStack + hand.profit;
        // 对手信息
        var seatsWithNames = [];
        var snRe = /Seat (\d+): ([^\s(]+) \(\$[\d.]+ in chips\)/g;
        var snM;
        while ((snM = snRe.exec(block)) !== null) {
          if (snM[2] !== 'Hero')
            seatsWithNames.push({ seat: parseInt(snM[1]), name: snM[2] });
        }
        var mainOpp = seatsWithNames[0] || { seat: 1, name: 'Villain' };
        hand.opponentId = mainOpp.name;
        hand.oHash = Utils.normalizeOpponentName(mainOpp.name);  // [V7.0.2]
        // 街道边界
        // [V6.12.0] 支持 Run-it-twice: FIRST/SECOND FLOP/TURN/RIVER
        var flopIdx = block.indexOf('*** FLOP ***');
        if (flopIdx === -1) flopIdx = block.indexOf('*** FIRST FLOP ***');
        var turnIdx = block.indexOf('*** TURN ***');
        if (turnIdx === -1) turnIdx = block.indexOf('*** FIRST TURN ***');
        var riverIdx = block.indexOf('*** RIVER ***');
        if (riverIdx === -1) riverIdx = block.indexOf('*** FIRST RIVER ***');
        var showIdx = block.indexOf('*** SHOWDOWN ***');
        if (showIdx === -1) showIdx = block.indexOf('*** FIRST SHOWDOWN ***');
        var sumIdx = block.indexOf('*** SUMMARY ***');
        var pfBlock = block.substring(
          0,
          flopIdx > 0 ? flopIdx : showIdx > 0 ? showIdx : sumIdx > 0 ? sumIdx : block.length
        );
        var raiseCount = (pfBlock.match(/raises/g) || []).length;
        hand.potType =
          raiseCount >= 3
            ? '4IA'
            : raiseCount === 2
              ? '3IA'
              : raiseCount === 1
                ? 'SIA'
                : 'limp';
        // --- 翻前解析 ---
        var pfLines = pfBlock.split('\n');
        var pfPotDollar = 0;
        var sbPost = pfBlock.match(/posts small blind \$([\d.]+)/);
        if (sbPost) pfPotDollar += parseFloat(sbPost[1]);
        var bbPost = pfBlock.match(/posts big blind \$([\d.]+)/);
        if (bbPost) pfPotDollar += parseFloat(bbPost[1]);
        var anteRe = /posts ante \$([\d.]+)/g;
        var anteM;
        while ((anteM = anteRe.exec(pfBlock)) !== null) pfPotDollar += parseFloat(anteM[1]);
        var pfActions = [];
        for (var pfIdx = 0; pfIdx < pfLines.length; pfIdx++) {
          var pfLine = pfLines[pfIdx].trim();
          if (/posts /i.test(pfLine)) continue;
          if (/^Hero:? /.test(pfLine)) {
            pfActions.push({
              who: 'Hero',
              act: pfLine.replace(/^Hero:? /, ''),
              pos: heroPos,
            });
          } else if (/(raises|calls|folds)\s/i.test(pfLine)) {
            var nm = pfLine.match(/^([^:]+):\s*/);
            var who = nm ? nm[1].trim() : '';
            var act = nm ? pfLine.substring(nm[0].length).trim() : '';
            if (who && who !== 'Hero') {
              var oppPos = 'MP';
              for (var os = 0; os < seatsWithNames.length; os++) {
                if (seatsWithNames[os].name === who) {
                  oppPos = pm[seatsWithNames[os].seat] || 'MP';
                  break;
                }
              }
              pfActions.push({ who: who, act: act, pos: oppPos });
            }
          }
        }
        var descParts = [];
        var pfDesc = '';
        function formatHeroAct(actRaw) {
          var hRaiseM = actRaw.match(/raises \$[\d.]+ to \$([\d.]+)/);
          if (hRaiseM) {
            pfPotDollar = Math.max(pfPotDollar, parseFloat(hRaiseM[1]));
            return 'raises to ' + Utils.safeFixed(toBB(hRaiseM[1]), 1) + 'bb';
          }
          var hCallM = actRaw.match(/calls \$([\d.]+)/);
          if (hCallM) {
            pfPotDollar += parseFloat(hCallM[1]);
            return 'calls ' + Utils.safeFixed(toBB(hCallM[1]), 1) + 'bb';
          }
          if (/checks/i.test(actRaw)) return 'check';
          if (/folds/i.test(actRaw)) return 'folds';
          return actRaw;
        }
        function formatOppAct(actRaw) {
          if (/folds/i.test(actRaw)) return 'folds';
          if (/calls \$([\d.]+)/i.test(actRaw)) {
            pfPotDollar += parseFloat(actRaw.match(/calls \$([\d.]+)/i)[1]);
            return 'Call';
          }
          var rM2 = actRaw.match(/to \$([\d.]+)/);
          if (rM2) {
            pfPotDollar = Math.max(pfPotDollar, parseFloat(rM2[1]));
            return 'Raise ' + Utils.safeFixed(toBB(rM2[1]), 1) + 'bb';
          }
          var rAmt = actRaw.match(/raises \$([\d.]+)/);
          if (rAmt) {
            pfPotDollar += parseFloat(rAmt[1]) / bbValue;
            return 'Raise ' + Utils.safeFixed(toBB(rAmt[1]), 1) + 'bb';
          }
          return actRaw;
        }
        if (pfActions.length) {
          var pfParts = [];
          for (var ak = 0; ak < pfActions.length; ak++) {
            var a = pfActions[ak];
            if (a.who === 'Hero') {
              pfParts.push(
                'Hero ' +
                  a.pos +
                  '/[' +
                  self._sortCardsDesc(hand.heroCards || '??') +
                  '] ' +
                  formatHeroAct(a.act)
              );
            } else {
              pfParts.push(a.pos + ' ' + formatOppAct(a.act));
            }
          }
          pfDesc = pfParts.join(', ');
        } else {
          pfDesc =
            'Hero ' +
            heroPos +
            '/[' +
            self._sortCardsDesc(hand.heroCards || '??') +
            '] check';
        }
        descParts.push('preflop 行动：' + pfDesc);
        var runningPotBB = pfPotDollar / bbValue;
        // --- 翻后解析 ---
        var streets = [
          {
            label: 'OTF翻牌',
            start: flopIdx,
            end:
              turnIdx > 0
                ? turnIdx
                : riverIdx > 0
                  ? riverIdx
                  : showIdx > 0
                    ? showIdx
                    : sumIdx > 0
                      ? sumIdx
                      : block.length,
          },
          {
            label: 'OTT转牌',
            start: turnIdx,
            end:
              riverIdx > 0
                ? riverIdx
                : showIdx > 0
                  ? showIdx
                  : sumIdx > 0
                    ? sumIdx
                    : block.length,
          },
          {
            label: 'OTR河牌',
            start: riverIdx,
            end: showIdx > 0 ? showIdx : sumIdx > 0 ? sumIdx : block.length,
          },
        ];
        var prevBoard = '';
        for (var si = 0; si < streets.length; si++) {
          var st = streets[si];
          if (st.start <= 0) continue;
          var stBlock = block.substring(st.start, st.end);
          if (st.label === 'OTR河牌') {
            var showsIdx = stBlock.search(/\n[^\n]*shows \[/i);
            if (showsIdx > 0) stBlock = stBlock.substring(0, showsIdx);
          }
          var headerLine = stBlock.split('\n')[0];
          var bMs = headerLine.match(/\[([^\]]+)\]/g);
          var fullBoard = bMs
            ? bMs
                .map(function (m) {
                  return m.slice(1, -1);
                })
                .join(' ')
            : '';
          var newBoard = self._sortCardsDesc(self._getNewCards(fullBoard, prevBoard));
          prevBoard = fullBoard;
          var stLines = stBlock.split('\n');
          var potStartBB = runningPotBB;
          var streetActions = [];
          for (var li = 0; li < stLines.length; li++) {
            var ln = stLines[li].trim();
            if (/Uncalled|collected|Total pot/i.test(ln) || !ln) continue;
            if (/^Hero:? /.test(ln)) {
              var actRaw = ln.replace(/^Hero:? /, '');
              streetActions.push(self._formatAction(actRaw, runningPotBB, bbValue));
              var bDollar = parseFloat((actRaw.match(/bets \$([\d.]+)/) || [0, 0])[1]);
              if (bDollar > 0) runningPotBB += bDollar / bbValue;
              var rDollar = parseFloat((actRaw.match(/to \$([\d.]+)/) || [0, 0])[1]);
              if (rDollar > 0) runningPotBB = Math.max(runningPotBB, rDollar / bbValue);
            } else if (/(raises|bets|calls|folds|checks)(?:\s|$)/i.test(ln)) {
              var nm2 = ln.match(/^([^:]+):\s*/);
              var who2 = nm2 ? nm2[1].trim() : '';
              if (who2 === 'Hero') continue;
              var actRaw2 = nm2 ? ln.substring(nm2[0].length).trim() : '';
              streetActions.push(self._formatAction(actRaw2, runningPotBB, bbValue));
              var bD2 = parseFloat((actRaw2.match(/bets \$([\d.]+)/) || [0, 0])[1]);
              if (bD2 > 0) runningPotBB += bD2 / bbValue;
              var rD2 = parseFloat((actRaw2.match(/to \$([\d.]+)/) || [0, 0])[1]);
              if (rD2 > 0) runningPotBB = Math.max(runningPotBB, rD2 / bbValue);
            }
          }
          if (streetActions.length) {
            descParts.push(
              st.label + ' ' + newBoard + '    行动：' + streetActions.join(' ')
            );
          }
        }
        // --- 摊牌信息 ---
        if (showIdx > 0) {
          var showBlock =
            showIdx > 0 ? block.substring(flopIdx > 0 ? flopIdx : 0, showIdx) : '';
          var sumBlock = sumIdx > 0 ? block.substring(sumIdx) : '';
          var heroShowM = showBlock.match(/Hero shows \[([^\]]+)\]\s*(?:\(([^)]+)\))?/);
          if (heroShowM && descParts.length > 0) {
            var showCards = self._sortCardsDesc(heroShowM[1]);
            var showStr = heroShowM[2] || '';
            descParts[descParts.length - 1] +=
              '  shows [' + showCards + ']' + (showStr ? ' (' + showStr + ')' : '');
          }
          var allShowRe = /([^\s:]+): shows \[([^\]]+)\]\s*(?:\(([^)]+)\))?/g;
          var sm;
          while ((sm = allShowRe.exec(showBlock)) !== null) {
            var pName = sm[1];
            if (pName === 'Hero') continue;
            var pCards = self._sortCardsDesc(sm[2]);
            var pStr = sm[3] || '';
            var pPos = '';
            for (var st2 = 0; st2 < seatsWithNames.length; st2++) {
              if (seatsWithNames[st2].name === pName) {
                pPos = pm[seatsWithNames[st2].seat] || '';
                break;
              }
            }
            var escN = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var resultM = sumBlock.match(
              new RegExp(
                escN +
                  ' \\([^)]+\\) showed \\[([^\\]]+)\\] and (won|lost)(?: \\(\\$([\\d.]+)\\))?(?: with ([^\\n]+))?'
              )
            );
            var line =
              (pPos || pName) + ' [' + pCards + ']' + (pStr ? ' (' + pStr + ')' : '');
            if (resultM) {
              var winBB = resultM[3]
                ? '/' + Utils.safeFixed(parseFloat(resultM[3]) / bbValue, 1) + 'bb'
                : '';
              line +=
                ' and ' + resultM[2] + (resultM[3] ? ' ($' + resultM[3] + winBB + ')' : '');
              if (resultM[4]) line += ' with ' + resultM[4].trim();
            }
            descParts.push(line);
            if (!hand.opponentCards) hand.opponentCards = pCards;
          }
        }
        // [V6.5.3] SUMMARY 回退：搜索 showed [Xx Xx]
        if (!hand.opponentCards && sumIdx > 0) {
          var sumBlock2 = block.substring(sumIdx);
          var sumShowRe2 = /([^\s(]+)\s*\([^)]+\)\s*showed\s*\[([^\]]+)\]/g;
          var ssm2;
          while ((ssm2 = sumShowRe2.exec(sumBlock2)) !== null) {
            if (ssm2[1] !== 'Hero') {
              hand.opponentCards = self._sortCardsDesc(ssm2[2]);
              break;
            }
          }
        }
        // --- 牌面结构 ---
        var allBd = '';
        for (var bi = 0; bi < streets.length; bi++) {
          var st2 = streets[bi];
          if (st2.start > 0) {
            var secBlock = block.substring(st2.start, Math.min(st2.end, block.length));
            if (st2.label === 'OTR河牌') {
              var si2 = secBlock.search(/\n[^\n]*shows \[/i);
              if (si2 > 0) secBlock = secBlock.substring(0, si2);
            }
            var hdr = secBlock.split('\n')[0];
            var bdMs = hdr.match(/\[([^\]]+)\]/g);
            if (bdMs) {
              bdMs.forEach(function (m) {
                allBd += (allBd ? ' ' : '') + m.slice(1, -1);
              });
            }
          }
        }
        allBd = self._sortCardsDesc(allBd);
        hand.boardCards = allBd;
        hand.board = self._classifyBoard(allBd);
        hand.desc = descParts.join('\n');
        // [V6.13.0 新增] 提取水钱和Jackpot
        var potLineM = block.match(/^Total pot \$([\d.]+) \| Rake \$([\d.]+) \| Jackpot \$([\d.]+)/m);
        hand.rake = potLineM ? parseFloat(potLineM[2]) : 0;
        hand.jackpot = potLineM ? parseFloat(potLineM[3]) : 0;
        if (hand.isBigLoss) hand.desc += '\n⚠️ 大底池亏损手牌，请详细复盘';
        results.push(hand);
      } catch (e) {
        console.warn('GG parse error for hand', (hand && hand.handId) || '?', e);
      }
    }
    return results;
  },
};
// #endregion
