// [V7.4.1] GTO 频率判断训练器
import { Utils } from '../utils.js';
import SBvsBB from '../data/strategy/gtoRaw/SBvsBB_SRP_flop.js';
import BTNvsBB from '../data/strategy/gtoRaw/BTNvsBB_SRP_flop.js';

var SCENARIOS = { SBvsBB: SBvsBB, BTNvsBB: BTNvsBB };

// [V7.4.7] 牌面分类统一使用 Utils.classifyBoard

// 7 阶段标签
var STAGE_LABELS = {
  dryAHigh: { name: '干燥彩虹 A 高', order: 1 },
  flushy_dry: { name: '双花干燥', order: 2 },
  straighty: { name: '听顺面', order: 3 },
  flushy_straighty: { name: '双花听顺', order: 4 },
  paired_high: { name: '公对面（高）', order: 5 },
  monotone: { name: '天花面', order: 6 },
  dry_low: { name: '低牌干燥', order: 7 },
  paired_low: { name: '公对面（低）', order: 7 },
  made_straight: { name: '天顺面', order: 7 },
  trips_board: { name: '三条面', order: 7 },
};

var ACTION_LABELS = ['bet75', 'bet50', 'bet33', 'check'];
var ACTION_NAMES = { bet75: '大注 75%', bet50: '中注 50%', bet33: '小注 33%', check: '过牌' };

function _loadState() {
  try {
    return JSON.parse(localStorage.getItem('pa_quizState')) || {};
  } catch (e) {
    return {};
  }
}
function _saveState(state) {
  localStorage.setItem('pa_quizState', JSON.stringify(state));
}
// [V7.6.2]
function _saveErrors(errors) {
  localStorage.setItem('pa_quiz_errors', JSON.stringify(errors));
}
function _clearErrors() {
  localStorage.removeItem('pa_quiz_errors');
}
// [V7.6.4] 掌握状态追踪
function _getMastery() {
  try { return JSON.parse(localStorage.getItem('pa_quiz_mastery')) || {}; } catch (e) { return {}; }
}
function _saveMastery(m) {
  localStorage.setItem('pa_quiz_mastery', JSON.stringify(m));
}
function _clearMastery() {
  localStorage.removeItem('pa_quiz_mastery');
}

export var QuizTrainer = {
  _scenario: 'SBvsBB',
  _stage: null, // null = 随机，string = 按阶段
  _currentBoard: null,
  _currentGTO: null,
  _answered: false,
  _state: {},

  init: function () {
    this._state = _loadState();
    if (!this._state.scenario) this._state.scenario = 'SBvsBB';
    if (!this._state.records) this._state.records = {};
    if (!this._state.stageStats) this._state.stageStats = {};
    this._scenario = this._state.scenario;
  },

  setScenario: function (sc) {
    this._scenario = sc;
    this._state.scenario = sc;
    _saveState(this._state);
  },

  getScenario: function () {
    return this._scenario;
  },

  getScenarios: function () {
    return Object.keys(SCENARIOS).map(function (k) {
      return { key: k, label: SCENARIOS[k].description };
    });
  },

  getStages: function () {
    var state = this._state;
    return Object.keys(STAGE_LABELS)
      .map(function (k) {
        var label = STAGE_LABELS[k];
        var stats = (state.stageStats || {})[k] || { ok: 0, fail: 0 };
        var total = stats.ok + stats.fail;
        return {
          key: k,
          name: label.name,
          order: label.order,
          ok: stats.ok,
          fail: stats.fail,
          accuracy: total ? Math.round((stats.ok / total) * 100) : 0,
        };
      })
      .sort(function (a, b) {
        return a.order - b.order;
      });
  },

  // [V7.6.4] 出题策略：错题优先 → 轮转均匀分布 → 已掌握降权
  next: function (stageKey, targetBoardCode) {
    var self = this;
    var data = SCENARIOS[this._scenario];
    if (!data) return null;
    var pool = data.boards;
    // 精确指定 boardCode（错题重做）—— 保持原逻辑
    if (targetBoardCode) {
      var target = pool.find(function (b) { return b.code === targetBoardCode; });
      if (target) { this._currentBoard = target; this._currentGTO = target; this._answered = false; }
      else return null;
      return self._buildQuestion(target, data);
    }
    // 按阶段过滤
    if (stageKey) {
      pool = pool.filter(function (b) { return Utils.classifyBoard(b.code) === stageKey; });
    }
    if (!pool.length) return null;
    var mastery = _getMastery();
    var errors = self.getErrors().filter(function (e) { return e.scenario === self._scenario; });
    var scenario = self._scenario;

    // === 错题优先：有错题时从错题池按轮转挑选 ===
    if (errors.length > 0 && !stageKey) {
      var board = self._pickFromErrors(errors, pool, mastery, scenario);
      if (board) {
        this._currentBoard = board; this._currentGTO = board; this._answered = false;
        return self._buildQuestion(board, data);
      }
    }

    // === 主池出题：轮转 + 降权 ===
    var board = self._pickFromPool(pool, mastery, scenario);
    if (!board) return null;
    this._currentBoard = board; this._currentGTO = board; this._answered = false;
    return self._buildQuestion(board, data);
  },

  // [V7.6.4] 构建题目对象（复用于 next 各路径）
  _buildQuestion: function (board, data) {
    return {
      boardCode: board.code,
      boardDisplay: Utils.renderCardBadges(board.code),
      category: STAGE_LABELS[Utils.classifyBoard(board.code)] || { name: '未知' },
      scenario: data.description,
      hero: data.heroPosition,
      villain: data.villainPosition,
      actions: ACTION_LABELS.map(function (a) { return { key: a, label: ACTION_NAMES[a] }; }),
    };
  },

  // [V7.6.4] 从错题池按轮转挑选
  _pickFromErrors: function (errors, pool, mastery, scenario) {
    // 将错题的 boardCode 映射到 pool 中的 board 对象
    var errorBoards = [];
    var seen = {};
    errors.forEach(function (e) {
      if (seen[e.boardCode]) return;
      seen[e.boardCode] = true;
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].code === e.boardCode) { errorBoards.push(pool[i]); break; }
      }
    });
    if (!errorBoards.length) return null;
    return this._pickByRotation(errorBoards, mastery, scenario);
  },

  // [V7.6.4] 从主池按轮转 + 降权挑选
  _pickFromPool: function (pool, mastery, scenario) {
    var self = this;
    // 按 category 分组
    var groups = {};
    pool.forEach(function (b) {
      var cat = Utils.classifyBoard(b.code);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(b);
    });
    var cats = Object.keys(groups);
    if (!cats.length) return null;
    // 轮转：选最久未被抽到的 category
    var now = Date.now();
    var lastSeen = {};
    cats.forEach(function (cat) {
      var maxTs = 0;
      groups[cat].forEach(function (b) {
        var key = scenario + '|' + b.code;
        var ts = (mastery[key] && mastery[key].lastSeen) || 0;
        if (ts > maxTs) maxTs = ts;
      });
      lastSeen[cat] = maxTs;
    });
    // 按 lastSeen 升序排列 category（最旧的在前）
    cats.sort(function (a, b) { return (lastSeen[a] || 0) - (lastSeen[b] || 0); });
    // 遍历 category，直到找到有可选 board 的
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci];
      var catPool = groups[cat];
      // 分已掌握/未掌握
      var unmastered = [], mastered = [];
      catPool.forEach(function (b) {
        var key = scenario + '|' + b.code;
        if (mastery[key] && mastery[key].mastered) mastered.push(b);
        else unmastered.push(b);
      });
      // 全部掌握 → 重置该 scenario 的所有 mastery
      if (unmastered.length === 0 && mastered.length > 0) {
        var newMastery = _getMastery();
        Object.keys(newMastery).forEach(function (k) {
          if (k.indexOf(scenario + '|') === 0) delete newMastery[k];
        });
        _saveMastery(newMastery);
        unmastered = catPool.slice();
        mastered = [];
      }
      // 80% 概率从未掌握中选，20% 从已掌握中抽查
      var pick = null;
      if (unmastered.length > 0 && Math.random() < 0.8) {
        pick = unmastered[Math.floor(Math.random() * unmastered.length)];
      } else if (mastered.length > 0) {
        pick = mastered[Math.floor(Math.random() * mastered.length)];
      } else if (unmastered.length > 0) {
        pick = unmastered[Math.floor(Math.random() * unmastered.length)];
      }
      if (pick) return pick;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // [V7.6.4] 按 category 轮转：选最久未被抽到的 category，在其中随机选
  _pickByRotation: function (boards, mastery, scenario) {
    var groups = {};
    boards.forEach(function (b) {
      var cat = Utils.classifyBoard(b.code);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(b);
    });
    var cats = Object.keys(groups);
    if (!cats.length) return null;
    // 找最旧 lastSeen 的 category
    var oldestCat = cats[0];
    var oldestTs = Infinity;
    cats.forEach(function (cat) {
      var maxTs = 0;
      groups[cat].forEach(function (b) {
        var key = scenario + '|' + b.code;
        var ts = (mastery[key] && mastery[key].lastSeen) || 0;
        if (ts > maxTs) maxTs = ts;
      });
      if (maxTs < oldestTs) { oldestTs = maxTs; oldestCat = cat; }
    });
    var pick = groups[oldestCat];
    return pick[Math.floor(Math.random() * pick.length)];
  },

  // [V7.6.3] 双阈值三区判定：≥35% 正确 / 13-35% 可接受 / <13% 错误
  answer: function (actionKey) {
    if (this._answered || !this._currentGTO) return null;
    this._answered = true;
    var gto = this._currentGTO;
    var freq = gto[actionKey] || 0;
    // 最高频动作
    var maxAction = ACTION_LABELS.reduce(function (a, k) {
      return gto[k] > gto[a] ? k : a;
    }, 'check');
    var maxFreq = gto[maxAction];
    // 双阈值判定
    var result, message, color;
    if (freq >= 35) {
      result = 'correct';
      // 收集所有 ≥35% 的动作
      var allCorrect = ACTION_LABELS.filter(function (k) {
        return (gto[k] || 0) >= 35;
      });
      var correctList = allCorrect
        .map(function (k) {
          return ACTION_NAMES[k] + '(' + Utils.safeFixed(gto[k], 1) + '%)';
        })
        .join('、');
      message =
        '✅ 正确！这是 GTO 主流选择，但实战中需思考调整。' +
        (allCorrect.length > 1 ? '主流包括 ' + correctList + '，可灵活混合。' : '');
      color = 'green';
    } else if (freq >= 13) {
      result = 'acceptable';
      message =
        '⚠️ GTO 非最优，但实战中需思考调整。主流选择是 ' +
        ACTION_NAMES[maxAction] +
        ' (' +
        Utils.safeFixed(maxFreq, 1) +
        '%)';
      color = 'yellow';
    } else {
      result = 'wrong';
      message = '❌ 错误！该动作在 GTO 中极少使用 (仅 ' + Utils.safeFixed(freq, 1) + '%)，应避免。';
      color = 'red';
    }

    // 更新统计：correct 和 acceptable 都算 ok，只有 wrong 算 fail
    var cat = Utils.classifyBoard(gto.code);
    if (!this._state.stageStats[cat]) this._state.stageStats[cat] = { ok: 0, fail: 0 };
    if (result === 'wrong') this._state.stageStats[cat].fail++;
    else this._state.stageStats[cat].ok++;
    if (!this._state.records[gto.code]) this._state.records[gto.code] = { cat: cat, picks: {} };
    this._state.records[gto.code].picks[actionKey] =
      (this._state.records[gto.code].picks[actionKey] || 0) + 1;
    _saveState(this._state);

    // [V7.6.3] 错题集：只有 wrong 才记录；只有 correct 才移除
    var self = this;
    if (result === 'wrong') {
      self.saveError(gto, actionKey, maxAction, self._scenario, cat);
    } else if (result === 'correct') {
      self.removeOldestError(gto.code, self._scenario);
    }

    // [V7.6.4] 更新掌握状态
    var mKey = self._scenario + '|' + gto.code;
    var mastery = _getMastery();
    var entry = mastery[mKey] || { consecutiveCorrect: 0, totalAttempts: 0, lastResult: '', lastSeen: 0, mastered: false };
    entry.totalAttempts++;
    entry.lastSeen = Date.now();
    entry.lastResult = result;
    if (result === 'correct') entry.consecutiveCorrect++;
    else if (result === 'wrong') entry.consecutiveCorrect = 0;
    // acceptable → consecutiveCorrect 不变
    entry.mastered = entry.consecutiveCorrect >= 2;
    mastery[mKey] = entry;
    _saveMastery(mastery);

    // 频率分布
    var freqBars = ACTION_LABELS.map(function (k) {
      var w = Math.round(((gto[k] || 0) / 100) * 10);
      return {
        key: k,
        label: ACTION_NAMES[k],
        freq: gto[k] || 0,
        bar:
          Array(Math.max(0, w)).fill('█').join('') +
          Array(Math.max(0, 10 - w))
            .fill('░')
            .join(''),
      };
    }).sort(function (a, b) {
      return b.freq - a.freq;
    });

    return {
      chosen: actionKey,
      chosenLabel: ACTION_NAMES[actionKey],
      isReasonable: result !== 'wrong',
      result: result,
      message: message,
      color: color,
      dominant: maxAction,
      dominantLabel: ACTION_NAMES[maxAction],
      freqBars: freqBars,
    };
  },

  // 全局统计
  getStats: function () {
    var stageStats = this._state.stageStats || {};
    var allOk = 0,
      allFail = 0;
    Object.keys(stageStats).forEach(function (k) {
      allOk += stageStats[k].ok || 0;
      allFail += stageStats[k].fail || 0;
    });
    return {
      ok: allOk,
      fail: allFail,
      total: allOk + allFail,
      accuracy: allOk + allFail ? Math.round((allOk / (allOk + allFail)) * 100) : 0,
    };
  },

  // 重置进度
  reset: function () {
    this._state.records = {};
    this._state.stageStats = {};
    _saveState(this._state);
    _clearErrors();
    _clearMastery();
  },

  // [V7.6.2] 错题集方法
  getErrors: function () {
    try {
      return JSON.parse(localStorage.getItem('pa_quiz_errors')) || [];
    } catch (e) {
      return [];
    }
  },
  saveError: function (gto, userAction, correctAction, scenario, cat) {
    var errors = this.getErrors();
    var boardDisplay = Utils.renderCardBadges(gto.code);
    var catName = (STAGE_LABELS[cat] || {}).name || cat;
    var scenarioData = SCENARIOS[scenario];
    var contextText = scenarioData
      ? '作为 ' +
        (scenarioData.heroPosition || '?') +
        ' vs ' +
        (scenarioData.villainPosition || '?') +
        '，你应该？'
      : '';
    errors.push({
      id: gto.code + '_' + Date.now(),
      type: 'freqJudge',
      scenario: scenario,
      boardCode: gto.code,
      category: cat,
      userAnswer: userAction,
      userAnswerLabel: ACTION_NAMES[userAction] || userAction,
      correctAnswer: correctAction,
      correctAnswerLabel: ACTION_NAMES[correctAction] || correctAction,
      gtoFreqs: {
        bet75: gto.bet75 || 0,
        bet50: gto.bet50 || 0,
        bet33: gto.bet33 || 0,
        check: gto.check || 0,
      },
      questionDisplay: {
        boardDisplay: boardDisplay,
        categoryName: catName,
        contextText: contextText,
      },
      timestamp: Date.now(),
    });
    _saveErrors(errors);
  },
  removeError: function (errorId) {
    var errors = this.getErrors().filter(function (e) {
      return e.id !== errorId;
    });
    _saveErrors(errors);
  },
  removeOldestError: function (boardCode, scenario) {
    var errors = this.getErrors();
    var matching = [];
    for (var i = 0; i < errors.length; i++) {
      if (errors[i].boardCode === boardCode && errors[i].scenario === scenario)
        matching.push({ idx: i, ts: errors[i].timestamp });
    }
    if (!matching.length) return;
    matching.sort(function (a, b) {
      return a.ts - b.ts;
    });
    errors.splice(matching[0].idx, 1);
    _saveErrors(errors);
  },
  clearErrors: function () {
    _clearErrors();
  },
};
