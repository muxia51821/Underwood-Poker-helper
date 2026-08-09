import { CONSTANTS } from '../constants.js';

// [V6.17.0 提取] IndexedDB 封装 — 纯异步读写
const DB = {
  _db: null,
  _name: 'pa_store',
  _version: 1,

  isReady: function () {
    return Boolean(this._db);
  },

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
