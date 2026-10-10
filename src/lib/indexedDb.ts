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

const PRIMARY_DB_KEY = 'rentflo_billing_data';
const BACKUP_DB_KEY = 'rentflo_billing_data_backup';

/**
 * High-level permanent database save with overwrite protection.
 * Automatically saves primary and redundant backup snapshot into IndexedDB.
 */
export async function saveAppDataToIndexedDB(data: any, forceEmpty: boolean = false): Promise<boolean> {
  if (!data || typeof data !== 'object') return false;

  const incomingProps = Array.isArray(data.properties) ? data.properties.length : 0;
  const incomingTenants = Array.isArray(data.tenants) ? data.tenants.length : 0;

  // Overwrite safety check: Never replace meaningful data with empty data
  if (incomingProps === 0 && incomingTenants === 0 && !forceEmpty) {
    const existing = await getIdbItem(PRIMARY_DB_KEY);
    if (existing && ((existing.properties?.length || 0) > 0 || (existing.tenants?.length || 0) > 0)) {
      console.warn('[IndexedDB] Blocked attempt to overwrite non-empty IndexedDB with empty data.');
      return false;
    }
  }

  try {
    await setIdbItem(PRIMARY_DB_KEY, data);
    if (incomingProps > 0 || incomingTenants > 0) {
      // Keep secondary backup in IndexedDB
      await setIdbItem(BACKUP_DB_KEY, data);
    }
    return true;
  } catch (err) {
    console.error('[IndexedDB] saveAppDataToIndexedDB error:', err);
    return false;
  }
}

/**
 * High-level permanent database loader.
 * Checks primary key, then backup key.
 */
export async function loadAppDataFromIndexedDB(): Promise<any | null> {
  try {
    const primary = await getIdbItem(PRIMARY_DB_KEY);
    if (primary && ((primary.properties?.length || 0) > 0 || (primary.tenants?.length || 0) > 0)) {
      return primary;
    }

    const backup = await getIdbItem(BACKUP_DB_KEY);
    if (backup && ((backup.properties?.length || 0) > 0 || (backup.tenants?.length || 0) > 0)) {
      return backup;
    }

    return primary || null;
  } catch (err) {
    console.warn('[IndexedDB] loadAppDataFromIndexedDB error:', err);
    return null;
  }
}

