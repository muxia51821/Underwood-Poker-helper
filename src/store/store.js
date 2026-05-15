import { CONSTANTS } from '../constants.js';
import { Utils } from '../utils.js';

// #region Store
/* ==================== 分层存储 ==================== */
export const Store = {
  _prefix: CONSTANTS.STORAGE_PREFIX,
  /** @param {string} key - localStorage 键名（不含 pa_ 前缀） @returns {*|null} */
  _getRaw(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
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
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(value));
    } catch (e) {}
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
      opponentAliases: Store.opponentAliases.get(),
      opponentLiveFlags: Store.opponentLiveFlags.get(),
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
    if (data.logs) {
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
    if (data.opponentAliases) {
      var localAliases = Store.opponentAliases.get();
      var merged = {};
      Object.keys(localAliases).forEach(function (k) { merged[k] = localAliases[k]; });
      Object.keys(data.opponentAliases).forEach(function (k) { merged[k] = data.opponentAliases[k]; });
      Store.opponentAliases.save(merged);
    }
    // [V6.12.2] 对手 Live 标记合并
    if (data.opponentLiveFlags) {
      var localFlags = Store.opponentLiveFlags.get();
      Object.keys(data.opponentLiveFlags).forEach(function (k) { localFlags[k] = data.opponentLiveFlags[k]; });
      Store.opponentLiveFlags.save(localFlags);
    }
  },
  _collectLogs() {
    const logs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this._prefix + 'log_')) {
        const ds = key.replace(this._prefix + 'log_', '');
        try {
          logs[ds] = JSON.parse(localStorage.getItem(key));
        } catch (e) {}
      }
    }
    return logs;
  },
};
// #endregion

// [V6.7] IndexedDB 封装 — 异步读写，启动时初始化
const DB = {
  _db: null,
  _name: 'pa_store',
  _version: 1,

  open: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(self._name, self._version);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('sessions'))
          db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('handReviews')) {
          var hrStore = db.createObjectStore('handReviews', { keyPath: 'id' });
          hrStore.createIndex('sessionId', 'sessionId', { unique: false });
          hrStore.createIndex('ggId', 'ggId', { unique: false });
          hrStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('weeklyReviews'))
          db.createObjectStore('weeklyReviews', { keyPath: 'week' });
        if (!db.objectStoreNames.contains('tiltLogs'))
          db.createObjectStore('tiltLogs', { keyPath: 'time' });
      };
      req.onsuccess = function (e) {
        self._db = e.target.result;
        resolve(self._db);
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  },

  getAll: function (storeName) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self._db) return resolve([]);
      try {
        var tx = self._db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = store.getAll();
        req.onsuccess = function () {
          resolve(req.result || []);
        };
        req.onerror = function () {
          reject(req.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  },

  putAll: function (storeName, items) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self._db) return resolve();
      try {
        var tx = self._db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var clearReq = store.clear();
        clearReq.onsuccess = function () {
          for (var i = 0; i < items.length; i++) {
            store.put(items[i]);
          }
        };
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  },

  count: function (storeName) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self._db) return resolve(0);
      try {
        var tx = self._db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).count();
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  },
};

// [V6.6.2] 仓储基类 — 抽象 localStorage 数组实体的增删改查
// [V6.7] 升级：内存缓存 + IndexedDB 双后端，对外 API 签名不变
export class BaseRepo {
  constructor(key, idField) {
    this._key = key;
    this._idField = idField || 'id';
    this._cache = [];
    this._dbReady = false;
    this._writeTimer = null;
  }
  /** @returns {Array} */
  getAll() {
    return this._cache;
  }
  /** @param {Array} items */
  saveAll(items) {
    this._cache = items;
    if (this._dbReady) {
      this._scheduleDBWrite();
    } else {
      Store._setRaw(this._key, items);
    }
  }
  async _init() {
    if (DB._db) {
      try {
        this._cache = await DB.getAll(this._key);
        this._dbReady = true;
        return;
      } catch (e) {
        console.warn(
          'IndexedDB load failed for ' + this._key + ', fallback to localStorage',
          e
        );
      }
    }
    this._cache = Store._getRaw(this._key) || [];
  }
  _scheduleDBWrite() {
    var self = this;
    if (this._writeTimer) clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(function () {
      DB.putAll(self._key, self._cache).catch(function (e) {
        console.warn('IndexedDB write failed for ' + self._key, e);
      });
    }, 300);
  }
  _flush() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    if (this._dbReady) {
      Store._setRaw(this._key, this._cache);
    }
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

async function migrateToIndexedDB() {
  var tables = ['sessions', 'handReviews', 'weeklyReviews', 'tiltLogs'];
  var allOk = true;

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var oldData = Store._getRaw(table) || [];
    if (!oldData.length) continue;

    try {
      await DB.putAll(table, oldData);
      var count = await DB.count(table);
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
    localStorage.removeItem('pa_sessions');
    localStorage.removeItem('pa_handReviews');
    localStorage.removeItem('pa_weeklyReviews');
    localStorage.removeItem('pa_tiltLogs');
    localStorage.setItem('pa_migrated_v1', 'true');
    SessionRepo._dbReady = true;
    HandRepo._dbReady = true;
    WeeklyRepo._dbReady = true;
    TiltLogRepo._dbReady = true;
  } else {
    console.warn('Migration incomplete, localStorage data preserved for next retry');
  }
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
    } catch (e) {}
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

  var useIndexedDB = !safeMode && DB._db && localStorage.getItem('pa_migrated_v1');

  if (useIndexedDB) {
    _healthMode = 'indexeddb';
    await SessionRepo._init();
    await HandRepo._init();
    await WeeklyRepo._init();
    await TiltLogRepo._init();

    // 恢复机制
    var recoveryRepos = [
      { repo: SessionRepo, key: 'sessions' },
      { repo: HandRepo, key: 'handReviews' },
      { repo: WeeklyRepo, key: 'weeklyReviews' },
      { repo: TiltLogRepo, key: 'tiltLogs' },
    ];
    recoveryRepos.forEach(function (r) {
      var fallback = Store._getRaw(r.key);
      if (fallback && fallback.length > r.repo.getAll().length) {
        var cacheIds = new Set();
        r.repo.getAll().forEach(function (item) {
          cacheIds.add(item[r.repo._idField]);
        });
        var missing = fallback.filter(function (item) {
          return !cacheIds.has(item[r.repo._idField]);
        });
        if (missing.length) {
          r.repo._cache = r.repo.getAll().concat(missing);
          r.repo.saveAll(r.repo._cache);
          console.warn(
            r.key + ': recovered ' + missing.length + ' records from localStorage backup'
          );
          _addHealthIssue(r.key + ': 从本地备份恢复了 ' + missing.length + ' 条记录');
        }
      }
    });
  } else {
    SessionRepo._cache = Store._getRaw('sessions') || [];
    HandRepo._cache = Store._getRaw('handReviews') || [];
    WeeklyRepo._cache = Store._getRaw('weeklyReviews') || [];
    TiltLogRepo._cache = Store._getRaw('tiltLogs') || [];

    if (DB._db) {
      await migrateToIndexedDB();
    }
  }

  // 数据完整性检测
  var repos = [
    { name: 'Session', repo: SessionRepo },
    { name: 'HandReview', repo: HandRepo },
    { name: 'WeeklyReview', repo: WeeklyRepo },
    { name: 'TiltLog', repo: TiltLogRepo },
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
        var fallback = Store._getRaw(r.repo._key);
        if (Array.isArray(fallback)) {
          r.repo._cache = fallback;
          r.repo.saveAll(fallback);
          console.warn(r.name + ' recovered from localStorage backup');
          _addHealthIssue(r.name + ' 数据已损坏，已从本地备份恢复');
        } else {
          r.repo._cache = [];
          console.warn(r.name + ' reset to empty (data lost)');
          _addHealthIssue(r.name + ' 数据无法恢复，已重置为空（数据丢失）');
        }
      }
    });
  }

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
});
