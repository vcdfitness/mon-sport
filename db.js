// Base de données locale (IndexedDB), stockée sur le téléphone.
const DB_NAME = 'sport-nutrition';
const DB_VERSION = 1;
export const STORES = ['settings', 'muscles', 'exercises', 'videos', 'templates', 'sessions'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  all(store) {
    return tx(store, 'readonly', (s) => s.getAll()).then((rows) => rows.filter((r) => !r.deletedAt));
  },
  allRaw(store) {
    return tx(store, 'readonly', (s) => s.getAll());
  },
  get(store, id) {
    return tx(store, 'readonly', (s) => s.get(id));
  },
  put(store, obj) {
    obj.updatedAt = new Date().toISOString();
    return tx(store, 'readwrite', (s) => { s.put(obj); return obj; });
  },
  putMany(store, list) {
    const now = new Date().toISOString();
    return tx(store, 'readwrite', (s) => { for (const o of list) { o.updatedAt = o.updatedAt || now; s.put(o); } return list.length; });
  },
  // Suppression "douce" : l'élément reste récupérable dans la sauvegarde.
  remove(store, id) {
    return this.get(store, id).then((o) => (o ? this.put(store, { ...o, deletedAt: new Date().toISOString() }) : null));
  },
  hardDelete(store, id) {
    return tx(store, 'readwrite', (s) => { s.delete(id); });
  },
  clear(store) {
    return tx(store, 'readwrite', (s) => { s.clear(); });
  },
  async getSetting(key, fallback = null) {
    const row = await this.get('settings', key);
    return row ? row.value : fallback;
  },
  setSetting(key, value) {
    return this.put('settings', { id: key, value });
  },
  async exportAll() {
    const out = { app: 'sport-nutrition', version: DB_VERSION, exportedAt: new Date().toISOString(), data: {} };
    for (const s of STORES) out.data[s] = await this.allRaw(s);
    return out;
  },
  async importAll(dump) {
    if (!dump || dump.app !== 'sport-nutrition' || !dump.data) throw new Error('Fichier de sauvegarde non reconnu');
    for (const s of STORES) {
      if (!Array.isArray(dump.data[s])) continue;
      await this.clear(s);
      await this.putMany(s, dump.data[s]);
    }
  },
};

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
