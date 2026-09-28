/**
 * Bulletproof IndexedDB Storage Layer for Rentflo
 * Provides persistent, non-volatile storage on mobile browsers, PWAs, and desktop.
 */

const DB_NAME = 'rentflo_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_store';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Handle connection close / error
      db.onclose = () => {
        dbPromise = null;
      };
      db.onerror = () => {
        dbPromise = null;
      };
      
      resolve(db);
    };

    request.onerror = (event: Event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

/**
 * Request permanent, non-volatile storage so mobile OS does not evict data under storage pressure.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[Storage] Persistent storage granted: ${granted}`);
        return granted;
      }
      return true;
    }
  } catch (err) {
    console.warn('[Storage] Persistence request fallback:', err);
  }
  return false;
}

/**
 * Get an item from IndexedDB
 */
export async function getIdbItem<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(request.result !== undefined ? (request.result as T) : null);
        };

        request.onerror = () => {
          console.warn(`[IndexedDB] Get failed for key "${key}":`, request.error);
          resolve(null);
        };
      } catch (txErr) {
        console.warn(`[IndexedDB] Transaction error on get for key "${key}":`, txErr);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn(`[IndexedDB] openDB error on get "${key}":`, err);
    return null;
  }
}

/**
 * Store an item in IndexedDB
 */
export async function setIdbItem<T = any>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(`[IndexedDB] Set failed for key "${key}":`, request.error);
          reject(request.error);
        };

        tx.onerror = () => {
          reject(tx.error);
        };
      } catch (txErr) {
        reject(txErr);
      }
    });
  } catch (err) {
    console.warn(`[IndexedDB] openDB error on set "${key}":`, err);
  }
}

/**
 * Delete an item from IndexedDB
 */
export async function deleteIdbItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Non-blocking catch
  }
}
