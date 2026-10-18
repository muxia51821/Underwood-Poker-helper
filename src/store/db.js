import { CONSTANTS } from '../constants.js';

// [V6.17.0 提取] IndexedDB 封装 — 纯异步读写
const DB = {
  _db: null,
  _name: 'pa_store',
  _version: 7,  // [V7.16.0 修改] Keep the pre-restore checkpoint outside user collections.

  isReady: function () {
    return Boolean(this._db);
  },

  open: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      let blocked = false; // [V7.16.0 新增]
      var req = indexedDB.open(self._name, self._version);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('recoverySnapshots')) db.createObjectStore('recoverySnapshots', { keyPath: 'id' });
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
        // [V7.9.1 新增] Phase 1 Session Closure：Mark 与收尾记录（contains 守卫保证旧库平滑升级）
        if (!db.objectStoreNames.contains('marks'))
          db.createObjectStore('marks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessionClosures'))
          db.createObjectStore('sessionClosures', { keyPath: 'id' });
        // [V7.9.2 新增] Phase 2 Decision Radar：Finding Dossier
        if (!db.objectStoreNames.contains('dossiers'))
          db.createObjectStore('dossiers', { keyPath: 'id' });
        // [V7.9.3 新增] Phase 3 Evidence & Strategy
        if (!db.objectStoreNames.contains('evidencePacks'))
          db.createObjectStore('evidencePacks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('strategyRevisions'))
          db.createObjectStore('strategyRevisions', { keyPath: 'id' });
        // [V7.10.2 新增] Phase 4 Mastery & Ecology
        if (!db.objectStoreNames.contains('learningUnits'))
          db.createObjectStore('learningUnits', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('opponentNotes'))
          db.createObjectStore('opponentNotes', { keyPath: 'id' });
        // [V7.10.4 新增] GTO 基线域
        if (!db.objectStoreNames.contains('gtoBaselines'))
          db.createObjectStore('gtoBaselines', { keyPath: 'id' });
      };
      req.onsuccess = function (e) {
        if (blocked) { e.target.result.close(); return; }
        self._db = e.target.result;
        // [V7.16.0 新增] Release this connection when another tab upgrades the database.
        self._db.onversionchange = function () { self._db.close(); self._db = null; };
        resolve(self._db);
      };
      req.onblocked = function () {
        blocked = true;
        const error = new Error('请关闭其他旧版牌桌页面，再刷新以完成本地数据库升级。');
        error.code = 'DB_UPGRADE_BLOCKED';
        reject(error);
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

  // [V7.16.0 新增] Resolve only after the checkpoint transaction commits.
  saveRestoreCheckpoint: function (checkpoint) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this._db.transaction('recoverySnapshots', 'readwrite');
        tx.objectStore('recoverySnapshots').put({ ...checkpoint, id: 'latest' });
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('恢复前副本未保存'));
      } catch (error) { reject(error); }
    });
  },
  async getRestoreCheckpoint() {
    return (await this.getAll('recoverySnapshots'))[0] || null;
  },

  putAll: function (storeName, items) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self._db) return resolve();
      try {
        var tx = self._db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var clearReq = store.clear();
        var failures = [];
        clearReq.onsuccess = function () {
          for (var i = 0; i < items.length; i++) {
            var putReq = store.put(items[i]);
            // [V7.4.7] 收集单条写入失败
            putReq.onerror = (function (item, idx) {
              return function (e) {
                failures.push({ index: idx, id: item.id, error: e.target.error });
              };
            })(items[i], i);
          }
        };
        tx.oncomplete = function () {
          if (failures.length) {
            console.warn('DB.putAll: ' + failures.length + ' records failed for ' + storeName, failures.slice(0, 5));
          }
          // [V7.4.7] 始终校验写入数量
          self.count(storeName).then(function (actual) {
            if (actual !== items.length) {
              var mismatch = new Error('DB.putAll count mismatch: expected ' + items.length + ' got ' + actual + ' for ' + storeName);
              console.warn(mismatch.message);
              reject(mismatch);
              return;
            }
            resolve();
          }).catch(reject);
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

export { DB };
