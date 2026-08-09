import { CONSTANTS } from '../constants.js';
import { DB } from './db.js';

// [V7.7.2 修改] 存储 adapter：localStorage 只负责 pa_ 键的同步备份和降级读写。
export class LocalStorageAdapter {
  constructor(storage, prefix) {
    this._storage = storage || globalThis.localStorage;
    this._prefix = prefix || CONSTANTS.STORAGE_PREFIX;
  }

  _key(key) {
    return this._prefix + key;
  }

  get(key) {
    try {
      const raw = this._storage.getItem(this._key(key));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  set(key, value) {
    if (typeof key !== 'string' || !key.length || value === undefined) return false;
    try {
      this._storage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  remove(key) {
    try {
      this._storage.removeItem(this._key(key));
    } catch (e) {
      // localStorage unavailable is handled by the caller's health state.
    }
  }

  collect(prefix) {
    const result = {};
    const matchPrefix = this._prefix + (prefix || '');
    try {
      for (let i = 0; i < this._storage.length; i++) {
        const key = this._storage.key(i);
        if (!key || !key.startsWith(matchPrefix)) continue;
        const shortKey = key.slice(this._prefix.length);
        try {
          result[shortKey] = JSON.parse(this._storage.getItem(key));
        } catch (e) {
          // Keep collecting other keys; one malformed log must not hide all backups.
        }
      }
    } catch (e) {
      // Return the records collected before the storage failure.
    }
    return result;
  }
}

// [V7.7.2 修改] IndexedDB adapter：隐藏 DB._db，只暴露持久化能力。
export class IndexedDBAdapter {
  constructor(db) {
    this._db = db || DB;
  }

  isReady() {
    return this._db.isReady();
  }

  readAll(storeName) {
    return this._db.getAll(storeName);
  }

  writeAll(storeName, items) {
    return this._db.putAll(storeName, items);
  }

  count(storeName) {
    return this._db.count(storeName);
  }
}

// [V7.7.2 修改] 持久化协调 module：统一 IndexedDB 主存储和 localStorage 降级。
export class PersistenceCoordinator {
  constructor(options) {
    const opts = options || {};
    this._local = opts.local || new LocalStorageAdapter();
    this._indexedDB = opts.indexedDB || new IndexedDBAdapter();
    this._onIssue = typeof opts.onIssue === 'function' ? opts.onIssue : function () {};
  }

  isIndexedDBReady() {
    return this._indexedDB.isReady();
  }

  readLocal(key) {
    return this._local.get(key);
  }

  writeLocal(key, value) {
    const ok = this._local.set(key, value);
    if (!ok) this._onIssue(key + ' localStorage 写入失败');
    return ok;
  }

  removeLocal(key) {
    this._local.remove(key);
  }

  collectLocal(prefix) {
    return this._local.collect(prefix);
  }

  async loadCollection(key) {
    if (this.isIndexedDBReady()) {
      try {
        return { items: (await this._indexedDB.readAll(key)) || [], backend: 'indexeddb' };
      } catch (e) {
        this._onIssue(key + ' IndexedDB 读取失败，已使用 localStorage');
      }
    }
    return { items: this.readLocal(key) || [], backend: 'localstorage' };
  }

  async writeIndexedDB(key, items) {
    if (!this.isIndexedDBReady()) throw new Error('IndexedDB is not ready');
    await this._indexedDB.writeAll(key, items);
    return this._indexedDB.count(key);
  }

  async persistCollection(key, items) {
    if (!this.isIndexedDBReady()) {
      return { backend: 'localstorage', ok: this.writeLocal(key, items) };
    }
    try {
      await this.writeIndexedDB(key, items);
      return { backend: 'indexeddb', ok: true };
    } catch (e) {
      const ok = this.writeLocal(key, items);
      this._onIssue(key + ' IndexedDB 写入失败，已降级到 localStorage');
      return { backend: 'localstorage', ok: ok, error: e };
    }
  }
}

export const persistence = new PersistenceCoordinator();
