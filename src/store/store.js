import { CONSTANTS } from '../constants.js';
import { Utils, PubSub } from '../utils.js';
import { DB } from './db.js';  // [V6.17.0] DB 独立模块
import { LocalStorageAdapter, IndexedDBAdapter, PersistenceCoordinator } from './storage.js';
import { clearStatsCache } from '../modules/statsEngine.js';  // [V7.0.0] 数据变更时清统计缓存

const localStorageAdapter = new LocalStorageAdapter();
const persistence = new PersistenceCoordinator({
  local: localStorageAdapter,
  indexedDB: new IndexedDBAdapter(DB),
  onIssue: function (message) {
    _healthMode = 'degraded';
    _addHealthIssue(message);
  },
});

// #region Store
/* ==================== 分层存储 ==================== */
export const Store = {
  _prefix: CONSTANTS.STORAGE_PREFIX,
  /** @param {string} key - localStorage 键名（不含 pa_ 前缀） @returns {*|null} */
  _getRaw(key) {
    return localStorageAdapter.get(key);
  },
  /** @param {string} key - localStorage 键名（不含 pa_ 前缀） @param {*} value - 要存储的值 */
  _setRaw(key, value) {
    if (CONSTANTS.DEV) {
      console.assert(
        typeof key === 'string' && key.length > 0,
        'Store._setRaw: key must be non-empty string'
      );
      console.assert(value !== undefined, 'Store._setRaw: value must not be undefined');
    }
    if (!localStorageAdapter.set(key, value)) console.warn('Store._setRaw failed:', key);
  },
  settings: {
    get() {
      return Store._getRaw('settings') || { sound: true, vibrate: true };
    },
    save(data) {
      Store._setRaw('settings', data);
    },
  },
  timer: {
    get() {
      return (
        Store._getRaw('timerState') || {
          endTime: null,
          phase: 'work',
          workStart: null,
          breakStart: null,
          longBreak: { enabled: false, interval: 4, minutes: 15 },
          cycleCount: 0,
        }
      );
    },
    save(state) {
      Store._setRaw('timerState', state);
    },
  },
  standup: {
    get() {
      return Store._getRaw('standup') || { date: Utils.getLocalDate(), count: 0 };
    },
    save(data) {
      Store._setRaw('standup', data);
    },
  },
  logs: {
    get(dateStr) {
      return Store._getRaw('log_' + dateStr) || [];
    },
    save(dateStr, logs) {
      Store._setRaw('log_' + dateStr, logs);
    },
  },
  // [V6.11.0] 对手别名: { oId: "昵称", ... }
  opponentAliases: {
    get() {
      return Store._getRaw('opponentAliases') || {};
    },
    save(data) {
      Store._setRaw('opponentAliases', data);
    },
  },
  // [V7.0.2] 对手合并: { canonicalHash: [oId1, oId2, ...] }
  opponentMerges: {
    get() { return Store._getRaw('opponentMerges') || {}; },
    save(data) { Store._setRaw('opponentMerges', data); },
  },
  // [V6.12.2] 对手 Live 标记: { oId: true, ... }
  opponentLiveFlags: {
    get() {
      return Store._getRaw('opponentLiveFlags') || {};
    },
    save(data) {
      Store._setRaw('opponentLiveFlags', data);
    },
  },
  exportAll() {
    return {
      settings: Store.settings.get(),
      timerState: Store.timer.get(),
      standup: Store.standup.get(),
      logs: this._collectLogs(),
      sessions: SessionRepo.getAll(),
      handReviews: HandRepo.getAll(),
      weeklyReviews: WeeklyRepo.getAll(),
      tiltLogs: TiltLogRepo.getAll(),
      marks: MarksRepo.getAll(),  // [V7.9.1 新增]
      sessionClosures: ClosureRepo.getAll(),  // [V7.9.1 新增]
      dossiers: DossierRepo.getAll(),  // [V7.9.2 新增]
      evidencePacks: EvidencePackRepo.getAll(),  // [V7.9.3 新增]
      strategyRevisions: StrategyRepo.getAll(),  // [V7.9.3 新增]
      learningUnits: LearningUnitRepo.getAll(),  // [V7.10.2 新增]
      opponentNotes: OpponentNoteRepo.getAll(),  // [V7.10.2 新增]
      opponentAliases: Store.opponentAliases.get(),
      opponentLiveFlags: Store.opponentLiveFlags.get(),
      opponentMerges: Store.opponentMerges.get(),
    };
  },
  importAll(data) {
    // [V6.7] Schema 校验
    if (data.sessions !== undefined && !Array.isArray(data.sessions))
      throw new Error('导入数据格式错误：sessions 应为数组');
    if (data.handReviews !== undefined && !Array.isArray(data.handReviews))
      throw new Error('导入数据格式错误：handReviews 应为数组');
    if (data.weeklyReviews !== undefined && !Array.isArray(data.weeklyReviews))
      throw new Error('导入数据格式错误：weeklyReviews 应为数组');
    if (data.tiltLogs !== undefined && !Array.isArray(data.tiltLogs))
      throw new Error('导入数据格式错误：tiltLogs 应为数组');
    // [V7.9.1 新增] marks / sessionClosures 校验
    if (data.marks !== undefined && !Array.isArray(data.marks))
      throw new Error('导入数据格式错误：marks 应为数组');
    if (data.sessionClosures !== undefined && !Array.isArray(data.sessionClosures))
      throw new Error('导入数据格式错误：sessionClosures 应为数组');
    // [V7.9.2 新增] dossiers 校验
    if (data.dossiers !== undefined && !Array.isArray(data.dossiers))
      throw new Error('导入数据格式错误：dossiers 应为数组');
    // [V7.9.3 新增] evidencePacks / strategyRevisions 校验
    if (data.evidencePacks !== undefined && !Array.isArray(data.evidencePacks))
      throw new Error('导入数据格式错误：evidencePacks 应为数组');
    if (data.strategyRevisions !== undefined && !Array.isArray(data.strategyRevisions))
      throw new Error('导入数据格式错误：strategyRevisions 应为数组');
    // [V7.10.2 新增] learningUnits / opponentNotes 校验
    if (data.learningUnits !== undefined && !Array.isArray(data.learningUnits))
      throw new Error('导入数据格式错误：learningUnits 应为数组');
    if (data.opponentNotes !== undefined && !Array.isArray(data.opponentNotes))
      throw new Error('导入数据格式错误：opponentNotes 应为数组');
    // V5.8.1 增量导入
    const mergeByKey = function (localArr, importArr, key) {
      const map = new Map();
      localArr.forEach(function (item) {
        map.set(item[key], item);
      });
      importArr.forEach(function (item) {
        if (!map.has(item[key])) map.set(item[key], item);
      });
      return Array.from(map.values());
    };
    if (data.sessions)
      SessionRepo.saveAll(mergeByKey(SessionRepo.getAll(), data.sessions, 'id'));
    if (data.handReviews)
      HandRepo.saveAll(mergeByKey(HandRepo.getAll(), data.handReviews, 'id'));
    if (data.tiltLogs)
      TiltLogRepo.saveAll(mergeByKey(TiltLogRepo.getAll(), data.tiltLogs, 'time'));
    if (data.weeklyReviews)
      WeeklyRepo.saveAll(mergeByKey(WeeklyRepo.getAll(), data.weeklyReviews, 'week'));
    // [V7.9.1 新增] marks / sessionClosures 增量合并
    if (data.marks)
      MarksRepo.saveAll(mergeByKey(MarksRepo.getAll(), data.marks, 'id'));
    if (data.sessionClosures)
      ClosureRepo.saveAll(mergeByKey(ClosureRepo.getAll(), data.sessionClosures, 'id'));
    // [V7.9.2 新增] dossiers 增量合并
    if (data.dossiers)
      DossierRepo.saveAll(mergeByKey(DossierRepo.getAll(), data.dossiers, 'id'));
    // [V7.9.3 新增] evidencePacks / strategyRevisions 增量合并
    if (data.evidencePacks)
      EvidencePackRepo.saveAll(mergeByKey(EvidencePackRepo.getAll(), data.evidencePacks, 'id'));
    if (data.strategyRevisions)
      StrategyRepo.saveAll(mergeByKey(StrategyRepo.getAll(), data.strategyRevisions, 'id'));
    // [V7.10.2 新增] learningUnits / opponentNotes 增量合并
    if (data.learningUnits)
      LearningUnitRepo.saveAll(mergeByKey(LearningUnitRepo.getAll(), data.learningUnits, 'id'));
    if (data.opponentNotes)
      OpponentNoteRepo.saveAll(mergeByKey(OpponentNoteRepo.getAll(), data.opponentNotes, 'id'));
    if (data.logs && typeof data.logs === 'object') {
      Object.keys(data.logs).forEach(function (d) {
        const local = Store.logs.get(d);
        const imp = data.logs[d] || [];
        if (!local.length) {
          Store.logs.save(d, imp);
        } else {
          const merged = local.slice();
          imp.forEach(function (e) {
            if (
              !local.some(function (l) {
                return l.workStart === e.workStart;
              })
            )
              merged.push(e);
          });
          Store.logs.save(d, merged);
        }
      });
    }
    // [V6.11.0] 对手别名合并：导入覆盖本地同 key，保留本地独有
    function _mergeDictImport(localObj, importObj) {
      var merged = {};
      Object.keys(localObj).forEach(function (k) { merged[k] = localObj[k]; });
      Object.keys(importObj).forEach(function (k) { merged[k] = importObj[k]; });
      return merged;
    }
    if (data.opponentAliases) {
      Store.opponentAliases.save(_mergeDictImport(Store.opponentAliases.get(), data.opponentAliases));
    }
    // [V6.12.2] 对手 Live 标记合并
    if (data.opponentLiveFlags) {
      Store.opponentLiveFlags.save(_mergeDictImport(Store.opponentLiveFlags.get(), data.opponentLiveFlags));
    }
    // [V7.0.2] 对手合并记录导入
    if (data.opponentMerges) {
      Store.opponentMerges.save(_mergeDictImport(Store.opponentMerges.get(), data.opponentMerges));
    }
  },
  _collectLogs() {
    const logs = {};
    const collected = localStorageAdapter.collect('log_');
    Object.keys(collected).forEach(function (key) {
      logs[key.slice(4)] = collected[key];
    });
    return logs;
  },
};
// #endregion

// [V6.6.2] 仓储基类 — 抽象 localStorage 数组实体的增删改查
// [V6.7] 升级：内存缓存 + IndexedDB 双后端，对外 API 签名不变
export class BaseRepo {
  constructor(key, idField, storage) {
    this._key = key;
    this._idField = idField || 'id';
    this._storage = storage || persistence;
    this._cache = [];
    this._backend = 'localstorage';
    this._writeTimer = null;
  }
  /** @returns {Array} */
  getAll() {
    return this._cache;
  }
  /** @param {Array} items */
  saveAll(items) {
    this._cache = items;
    // [V7.0.0] 手牌数据变更时清除统计缓存（context + analyze 两层）
    if (this._key === 'handReviews') {
      clearStatsCache();
      // [V7.9.0 新增] 手牌任何增删改/导入/恢复都发布变更事件，Discover 订阅后强制重扫
      // （修复：编辑同数量手牌后 Discover 因"总数未变"一直返回陈旧缓存）
      PubSub.emit('handDataChanged');
    }
    if (this._backend === 'indexeddb') {
      this._scheduleDBWrite();
    } else {
      this._storage.writeLocal(this._key, items);
    }
  }
  async _init() {
    const loaded = await this._storage.loadCollection(this._key);
    this._cache = loaded.items;
    this._backend = loaded.backend;
  }
  _scheduleDBWrite() {
    var self = this;
    if (this._writeTimer) clearTimeout(this._writeTimer);
    // [V7.9.0 修改] 防抖写入复用 persistNow（同一套健康降级处理）
    this._writeTimer = setTimeout(function () {
      self._writeTimer = null;
      self.persistNow();
    }, 300);
  }
  /**
   * [V7.9.0 新增] 立即持久化当前缓存（绕过防抖），返回 Promise<{backend, ok}>。
   * 大数据导入用它确保"提示成功 = 已落盘"；写入失败自动降级 localStorage 并标记健康状态。
   */
  persistNow() {
    const self = this;
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    if (this._backend !== 'indexeddb') {
      const ok = this._storage.writeLocal(this._key, this._cache);
      return Promise.resolve({ backend: 'localstorage', ok: ok });
    }
    return this._storage.persistCollection(this._key, this._cache).then(function (result) {
      self._backend = result.backend;
      if (result.backend !== 'indexeddb') {
        _healthMode = 'degraded';
        console.warn('IndexedDB write failed for ' + self._key, result.error || 'fallback');
      }
      return result;
    }).catch(function (e) {
      self._backend = 'localstorage';
      _healthMode = 'degraded';
      _addHealthIssue(self._key + ' 持久化失败');
      console.warn('Persistence failed for ' + self._key, e);
      return { backend: 'localstorage', ok: false, error: e };
    });
  }
  _flush() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    if (this._backend === 'indexeddb') this._storage.writeLocal(this._key, this._cache);
  }
  isIndexedDBReady() {
    return this._backend === 'indexeddb';
  }
  markIndexedDBReady() {
    this._backend = 'indexeddb';
  }
  replaceCache(items) {
    this._cache = Array.isArray(items) ? items : [];
  }
  getStorageKey() {
    return this._key;
  }
  getIdField() {
    return this._idField;
  }
  getPage(pageSize, pageNum) {
    var start = (pageNum - 1) * pageSize;
    return this._cache.slice(start, start + pageSize);
  }
  count() {
    return this._cache.length;
  }
  getTotalPages(pageSize) {
    return Math.ceil(this._cache.length / pageSize) || 1;
  }
  getById(id) {
    return this._cache.find(
      function (item) {
        return item[this._idField] === id;
      }.bind(this)
    );
  }
  add(item) {
    this._cache.push(item);
    this.saveAll(this._cache);
  }
  update(id, patch) {
    var self = this;
    var found = false;
    this._cache = this._cache.map(function (item) {
      if (item[self._idField] !== id) return item;
      found = true;
      var merged = {};
      for (var k in item) {
        if (item.hasOwnProperty(k)) merged[k] = item[k];
      }
      for (var k in patch) {
        if (patch.hasOwnProperty(k) && patch[k] !== undefined) merged[k] = patch[k];
      }
      return merged;
    });
    if (found) this.saveAll(this._cache);
  }
  delete(id) {
    var self = this;
    this._cache = this._cache.filter(function (item) {
      return item[self._idField] !== id;
    });
    this.saveAll(this._cache);
  }
}

// [V6.6.2] Entity repositories
export const SessionRepo = new BaseRepo('sessions');
export const HandRepo = new BaseRepo('handReviews');
export const WeeklyRepo = new BaseRepo('weeklyReviews', 'week');
export const TiltLogRepo = new BaseRepo('tiltLogs', 'time');
export const MarksRepo = new BaseRepo('marks');  // [V7.9.1 新增] Quick Capture 创建的 Mark
export const ClosureRepo = new BaseRepo('sessionClosures');  // [V7.9.1 新增] 每场收尾记录
export const DossierRepo = new BaseRepo('dossiers');  // [V7.9.2 新增] Finding Dossier
export const EvidencePackRepo = new BaseRepo('evidencePacks');  // [V7.9.3 新增] 证据包
export const StrategyRepo = new BaseRepo('strategyRevisions');  // [V7.9.3 新增] 策略修订
export const LearningUnitRepo = new BaseRepo('learningUnits');  // [V7.10.2 新增] 训练/复测单元
export const OpponentNoteRepo = new BaseRepo('opponentNotes');  // [V7.10.2 新增] 对手观察笔记

async function migrateToIndexedDB() {
  var tables = ['sessions', 'handReviews', 'weeklyReviews', 'tiltLogs', 'marks', 'sessionClosures', 'dossiers', 'evidencePacks', 'strategyRevisions', 'learningUnits', 'opponentNotes'];  // [V7.10.2 修改]
  var allOk = true;

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var oldData = Store._getRaw(table) || [];
    if (!oldData.length) continue;

    try {
      var count = await persistence.writeIndexedDB(table, oldData);
      if (count !== oldData.length) {
        console.error(
          'Migration count mismatch: ' + table + ' expected ' + oldData.length + ' got ' + count
        );
        allOk = false;
      }
    } catch (e) {
      console.error('Migration failed for ' + table, e);
      allOk = false;
    }
  }

  if (allOk) {
    persistence.removeLocal('sessions');
    persistence.removeLocal('handReviews');
    persistence.removeLocal('weeklyReviews');
    persistence.removeLocal('tiltLogs');
    persistence.removeLocal('marks');  // [V7.9.1 新增]
    persistence.removeLocal('sessionClosures');  // [V7.9.1 新增]
    persistence.removeLocal('dossiers');  // [V7.9.2 新增]
    persistence.removeLocal('evidencePacks');  // [V7.9.3 新增]
    persistence.removeLocal('strategyRevisions');  // [V7.9.3 新增]
    persistence.removeLocal('learningUnits');  // [V7.10.2 新增]
    persistence.removeLocal('opponentNotes');  // [V7.10.2 新增]
    // [V7.0.3] 先 ready 再标记，避免中间崩溃造成标记为真但 repo 未 ready
    SessionRepo.markIndexedDBReady();
    HandRepo.markIndexedDBReady();
    WeeklyRepo.markIndexedDBReady();
    TiltLogRepo.markIndexedDBReady();
    MarksRepo.markIndexedDBReady();  // [V7.9.1 新增]
    ClosureRepo.markIndexedDBReady();  // [V7.9.1 新增]
    DossierRepo.markIndexedDBReady();  // [V7.9.2 新增]
    EvidencePackRepo.markIndexedDBReady();  // [V7.9.3 新增]
    StrategyRepo.markIndexedDBReady();  // [V7.9.3 新增]
    LearningUnitRepo.markIndexedDBReady();  // [V7.10.2 新增]
    OpponentNoteRepo.markIndexedDBReady();  // [V7.10.2 新增]
    localStorage.setItem('pa_migrated_v1', 'true');
  } else {
    console.warn('Migration incomplete, localStorage data preserved for next retry');
  }
}

// [V7.0.2] 旧手牌补 oHash：扫描所有手牌，无 oHash 的基于 oId 规范化生成
function _migrateOpponentHash() {
  if (localStorage.getItem('pa_migrated_ohash_v1')) return;
  var hands = HandRepo.getAll();
  if (!hands || !hands.length) { localStorage.setItem('pa_migrated_ohash_v1', 'true'); return; }
  var changed = false;
  hands.forEach(function (r) {
    if (r.oId && !r.oHash) {
      r.oHash = Utils.normalizeOpponentName(r.oId);
      changed = true;
    }
  });
  if (changed) {
    HandRepo.saveAll(hands);
    HandRepo._flush();
  }
  localStorage.setItem('pa_migrated_ohash_v1', 'true');
}

// [V7.7.2 修改] 旧手牌补牌面字段和行动线，完成持久化后再标记迁移
async function _migrateBoardFields() {
  var hands = HandRepo.getAll();
  if (!hands || !hands.length) {
    localStorage.setItem('pa_migrated_board_v2', 'true');
    return true;
  }
  var changed = false;
  hands.forEach(function (r) {
    // 优先使用描述中的翻牌面；boardCards 可能是包含 turn/river 的完整 runout。
    var boardSource = _extractFlopBoardFromDesc(r.desc) || r.boardCards || r.boardCode || '';
    if (boardSource) {
      var code = r.boardCode || _simpleNormalize(boardSource);
      if (!r.boardCode && code) {
        r.boardCode = code;
        changed = true;
      }
      if (!r.boardCategory) {
        r.boardCategory = Utils.classifyBoard(boardSource);
        changed = true;
      }
    }
    // [V7.7.2 修改] 旧手牌从 desc 提取行动线
    if (r.desc && !r.actionLineOTF) {
      r.actionLineOTF = Utils.extractActionLine(r.desc, 'OTF');
      r.actionLineOTT = Utils.extractActionLine(r.desc, 'OTT');
      r.actionLineOTR = Utils.extractActionLine(r.desc, 'OTR');
      changed = true;
    }
  });
  if (changed) {
    if (persistence.isIndexedDBReady() && HandRepo.isIndexedDBReady()) {
      // 先保留本地备份，IndexedDB 写入失败时下次启动仍可重试。
      persistence.writeLocal('handReviews', hands);
      try {
        var actual = await persistence.writeIndexedDB('handReviews', hands);
        if (actual !== hands.length) {
          throw new Error('handReviews migration count mismatch');
        }
      } catch (e) {
        console.warn('Hand review field migration failed; will retry', e);
        _addHealthIssue('手牌字段迁移未完成，将在下次启动重试');
        return false;
      }
    } else {
      HandRepo.saveAll(hands);
    }
  }
  localStorage.setItem('pa_migrated_board_v2', 'true');
  return true;
}

function _extractFlopBoardFromDesc(desc) {
  if (!desc) return '';
  var match = String(desc).match(
    /(?:^|\n)OTF翻牌\s+((?:[2-9TJQKA][shdc]\s+){2}[2-9TJQKA][shdc])(?:\s|$)/i
  );
  return match ? match[1] : '';
}

// 简化版规范化（与 ggParser._normalizeBoardCode 逻辑一致）
function _simpleNormalize(boardCards) {
  if (!boardCards) return '';
  var rankOrder = 'AKQJT98765432';
  var cards = String(boardCards).trim().split(/\s+/);
  if (cards.length === 1 && cards[0].length >= 6) {
    var compact = cards[0];
    cards = [];
    for (var i = 0; i + 1 < compact.length; i += 2) cards.push(compact.slice(i, i + 2));
  }
  try {
    cards.sort(function (a, b) { return rankOrder.indexOf(a.charAt(0)) - rankOrder.indexOf(b.charAt(0)); });
    return cards.map(function (c) { return c.charAt(0) + c.charAt(c.length - 1).toLowerCase(); }).join('');
  } catch (e) { return ''; }
}


function migrateOldData() {
  var oldKey = 'pokerAssistantData';
  var oldRaw = localStorage.getItem(oldKey);
  if (oldRaw) {
    try {
      var old = JSON.parse(oldRaw);
      if (old.timerState) Store.timer.save(old.timerState);
      if (old.standup) Store.standup.save(old.standup);
      if (old.logs)
        Object.keys(old.logs).forEach(function (k) {
          Store.logs.save(k, old.logs[k]);
        });
      if (old.sessions) SessionRepo.saveAll(old.sessions);
      if (old.handReviews) HandRepo.saveAll(old.handReviews);
      if (old.weeklyReviews) WeeklyRepo.saveAll(old.weeklyReviews);
      if (old.tiltLogs) TiltLogRepo.saveAll(old.tiltLogs);
      localStorage.removeItem(oldKey);
    } catch (e) { console.warn('migrateOldData failed:', e); }
  }
}

function migrateHandReviews() {
  var reviews = HandRepo.getAll();
  if (!reviews || !reviews.length) return;
  var changed = false;
  reviews.forEach(function (r) {
    if (r.profitBB !== undefined && r.pBB === undefined) {
      r.pBB = r.profitBB;
      delete r.profitBB;
      changed = true;
    }
    if (r.importedFromGG !== undefined && r.gg === undefined) {
      r.gg = r.importedFromGG;
      delete r.importedFromGG;
      changed = true;
    }
    if (r.ggHandId !== undefined && r.ggId === undefined) {
      r.ggId = r.ggHandId;
      delete r.ggHandId;
      changed = true;
    }
    if (r.opponentId !== undefined && r.oId === undefined) {
      r.oId = r.opponentId;
      delete r.opponentId;
      changed = true;
    }
    if (r.opponentCards !== undefined && r.oCards === undefined) {
      r.oCards = r.opponentCards;
      delete r.opponentCards;
      changed = true;
    }
    // [V6.13.0] rake/jackpot 字段补缺
    if (r.rake === undefined) { r.rake = 0; changed = true; }
    if (r.jackpot === undefined) { r.jackpot = 0; changed = true; }
    // [V6.15.0] marked 字段补缺
    if (r.marked === undefined) { r.marked = false; changed = true; }
  });
  if (changed) HandRepo.saveAll(reviews);
}

// [V6.7] 存储初始化
// [V6.9.0] opts.safeMode: 跳过 IndexedDB，直接使用 localStorage
export async function initStorage(opts) {
  var safeMode = opts && opts.safeMode;
  if (safeMode) {
    console.warn('Safe mode: skipping IndexedDB, using localStorage only');
  }

  if (!safeMode) {
    try {
      await DB.open();
    } catch (e) {
      console.warn('IndexedDB unavailable, using localStorage only');
    }
  }

  var useIndexedDB = !safeMode && persistence.isIndexedDBReady() && localStorage.getItem('pa_migrated_v1');

  if (useIndexedDB) {
    _healthMode = 'indexeddb';
    await SessionRepo._init();
    await HandRepo._init();
    await WeeklyRepo._init();
    await TiltLogRepo._init();
    await MarksRepo._init();  // [V7.9.1 新增]
    await ClosureRepo._init();  // [V7.9.1 新增]
    await DossierRepo._init();  // [V7.9.2 新增]
    await EvidencePackRepo._init();  // [V7.9.3 新增]
    await StrategyRepo._init();  // [V7.9.3 新增]
    await LearningUnitRepo._init();  // [V7.10.2 新增]
    await OpponentNoteRepo._init();  // [V7.10.2 新增]

    // 恢复机制
    var recoveryRepos = [
      { repo: SessionRepo, key: 'sessions' },
      { repo: HandRepo, key: 'handReviews' },
      { repo: WeeklyRepo, key: 'weeklyReviews' },
      { repo: TiltLogRepo, key: 'tiltLogs' },
      { repo: MarksRepo, key: 'marks' },  // [V7.9.1 新增]
      { repo: ClosureRepo, key: 'sessionClosures' },  // [V7.9.1 新增]
      { repo: DossierRepo, key: 'dossiers' },  // [V7.9.2 新增]
      { repo: EvidencePackRepo, key: 'evidencePacks' },  // [V7.9.3 新增]
      { repo: StrategyRepo, key: 'strategyRevisions' },  // [V7.9.3 新增]
      { repo: LearningUnitRepo, key: 'learningUnits' },  // [V7.10.2 新增]
      { repo: OpponentNoteRepo, key: 'opponentNotes' },  // [V7.10.2 新增]
    ];
    recoveryRepos.forEach(function (r) {
      var fallback = Store._getRaw(r.key);
      if (fallback && fallback.length > r.repo.getAll().length) {
          var cacheIds = new Set();
          r.repo.getAll().forEach(function (item) {
          cacheIds.add(item[r.repo.getIdField()]);
          });
          var missing = fallback.filter(function (item) {
          return !cacheIds.has(item[r.repo.getIdField()]);
          });
          if (missing.length) {
          r.repo.replaceCache(r.repo.getAll().concat(missing));
          r.repo.saveAll(r.repo.getAll());
          console.warn(
            r.key + ': recovered ' + missing.length + ' records from localStorage backup'
          );
          _addHealthIssue(r.key + ': 从本地备份恢复了 ' + missing.length + ' 条记录');
        }
      }
    });
  } else {
    SessionRepo.replaceCache(Store._getRaw('sessions') || []);
    HandRepo.replaceCache(Store._getRaw('handReviews') || []);
    WeeklyRepo.replaceCache(Store._getRaw('weeklyReviews') || []);
    TiltLogRepo.replaceCache(Store._getRaw('tiltLogs') || []);
    MarksRepo.replaceCache(Store._getRaw('marks') || []);  // [V7.9.1 新增]
    ClosureRepo.replaceCache(Store._getRaw('sessionClosures') || []);  // [V7.9.1 新增]
    DossierRepo.replaceCache(Store._getRaw('dossiers') || []);  // [V7.9.2 新增]
    EvidencePackRepo.replaceCache(Store._getRaw('evidencePacks') || []);  // [V7.9.3 新增]
    StrategyRepo.replaceCache(Store._getRaw('strategyRevisions') || []);  // [V7.9.3 新增]
    LearningUnitRepo.replaceCache(Store._getRaw('learningUnits') || []);  // [V7.10.2 新增]
    OpponentNoteRepo.replaceCache(Store._getRaw('opponentNotes') || []);  // [V7.10.2 新增]

    if (persistence.isIndexedDBReady()) {
      await migrateToIndexedDB();
      // [V6.12.4] 迁移完成后更新健康状态（全新安装首次加载时 pa_migrated_v1 刚被写入）
      if (localStorage.getItem('pa_migrated_v1')) {
        _healthMode = 'indexeddb';
      }
    }
  }

  // 数据完整性检测
  var repos = [
    { name: 'Session', repo: SessionRepo },
    { name: 'HandReview', repo: HandRepo },
    { name: 'WeeklyReview', repo: WeeklyRepo },
    { name: 'TiltLog', repo: TiltLogRepo },
    { name: 'Mark', repo: MarksRepo },  // [V7.9.1 新增]
    { name: 'SessionClosure', repo: ClosureRepo },  // [V7.9.1 新增]
    { name: 'Dossier', repo: DossierRepo },  // [V7.9.2 新增]
    { name: 'EvidencePack', repo: EvidencePackRepo },  // [V7.9.3 新增]
    { name: 'StrategyRevision', repo: StrategyRepo },  // [V7.9.3 新增]
    { name: 'LearningUnit', repo: LearningUnitRepo },  // [V7.10.2 新增]
    { name: 'OpponentNote', repo: OpponentNoteRepo },  // [V7.10.2 新增]
  ];
  var corruptions = [];
  repos.forEach(function (r) {
    if (!Array.isArray(r.repo.getAll())) {
      corruptions.push(r.name);
    }
  });
  if (corruptions.length) {
    _healthMode = 'degraded';
    console.error(
      'Data corruption detected: ' +
        corruptions.join(', ') +
        ', attempting localStorage recovery'
    );
    repos.forEach(function (r) {
      if (!Array.isArray(r.repo.getAll())) {
        var fallback = Store._getRaw(r.repo.getStorageKey());
        if (Array.isArray(fallback)) {
          r.repo.replaceCache(fallback);
          r.repo.saveAll(fallback);
          console.warn(r.name + ' recovered from localStorage backup');
          _addHealthIssue(r.name + ' 数据已损坏，已从本地备份恢复');
        } else {
          r.repo.replaceCache([]);
          console.warn(r.name + ' reset to empty (data lost)');
          _addHealthIssue(r.name + ' 数据无法恢复，已重置为空（数据丢失）');
        }
      }
    });
  }

  // [V7.7.2 修改] 旧手牌补 boardCode/boardCategory
  if (!localStorage.getItem('pa_migrated_board_v2')) await _migrateBoardFields();
  // [V7.0.2] 旧手牌补 oHash（基于 oId 规范化）
  _migrateOpponentHash();
  migrateHandReviews();
  migrateOldData();
}

// [V6.9.0] 存储健康状态追踪
var _healthEvents = [];
var _healthMode = 'localstorage';

export function getStorageHealth() {
  return {
    mode: _healthMode,
    issues: _healthEvents.slice(),
    counts: {
      sessions: SessionRepo.count(),
      handReviews: HandRepo.count(),
      weeklyReviews: WeeklyRepo.count(),
      tiltLogs: TiltLogRepo.count(),
      marks: MarksRepo.count(),  // [V7.9.1 新增]
      sessionClosures: ClosureRepo.count(),  // [V7.9.1 新增]
      dossiers: DossierRepo.count(),  // [V7.9.2 新增]
      evidencePacks: EvidencePackRepo.count(),  // [V7.9.3 新增]
      strategyRevisions: StrategyRepo.count(),  // [V7.9.3 新增]
      learningUnits: LearningUnitRepo.count(),  // [V7.10.2 新增]
      opponentNotes: OpponentNoteRepo.count(),  // [V7.10.2 新增]
    },
  };
}

function _addHealthIssue(msg) {
  _healthEvents.push(msg);
  if (_healthEvents.length > 20) _healthEvents.shift();
}

// [V6.7] beforeunload: 紧急 flush
window.addEventListener('beforeunload', function () {
  SessionRepo._flush();
  HandRepo._flush();
  WeeklyRepo._flush();
  TiltLogRepo._flush();
  MarksRepo._flush();  // [V7.9.1 新增]
  ClosureRepo._flush();  // [V7.9.1 新增]
  DossierRepo._flush();  // [V7.9.2 新增]
  EvidencePackRepo._flush();  // [V7.9.3 新增]
  StrategyRepo._flush();  // [V7.9.3 新增]
  LearningUnitRepo._flush();  // [V7.10.2 新增]
  OpponentNoteRepo._flush();  // [V7.10.2 新增]
});
