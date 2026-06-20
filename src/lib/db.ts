import { Tenant, Property } from '../types';

export class BackendDB {
  #data = new Map<string, string>();
  private storageKeyPrefix = '_nexum_db_';

  constructor() {
    this.init();
    this.requestPersistence();
    this.setupAutoSaveListeners();
  }

  private init() {
    // Load existing keys from localStorage to memory Map to prevent loss
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storageKeyPrefix)) {
          const val = localStorage.getItem(key);
          if (val) {
            const mapKey = key.slice(this.storageKeyPrefix.length);
            this.#data.set(mapKey, val);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load storage into BackendDB', e);
    }
  }

  private async requestPersistence(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const persisted = await navigator.storage.persisted();
        if (!persisted) {
          const granted = await navigator.storage.persist();
          console.log(`[BackendDB] Requested Storage API persistence: granted=${granted}`);
        } else {
          console.log('[BackendDB] Storage API persistence already active.');
        }
      }
    } catch (e) {
      console.warn('[BackendDB] Storage API persistence request failed:', e);
    }
  }

  private setupAutoSaveListeners(): void {
    if (typeof window === 'undefined') return;

    const handleFlush = () => {
      this.flush().catch(err => {
        console.error('[BackendDB] Auto-save flush on lifecycle event failed:', err);
      });
    };

    // Listen to page unload and visibility changes to flush state
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    });
  }

  async flush(): Promise<boolean> {
    try {
      let allPassed = true;
      for (const [key, encoded] of this.#data.entries()) {
        try {
          localStorage.setItem(this.storageKeyPrefix + key, encoded);
        } catch (e) {
          console.error(`[BackendDB] Error writing key ${key} during flush:`, e);
          allPassed = false;
        }
      }
      
      // Attempt to check Storage API status during active flush
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usageMb = estimate.usage ? (estimate.usage / (1024 * 1024)).toFixed(2) : '0';
        const quotaMb = estimate.quota ? (estimate.quota / (1024 * 1024)).toFixed(2) : '100';
        console.log(`[BackendDB] Storage health estimate: ${usageMb}MB used / ${quotaMb}MB total quota`);
      }
      
      return allPassed;
    } catch (e) {
      console.error('[BackendDB] Flush operation unexpected failure:', e);
      return false;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    let data = this.#data.get(key);
    if (!data) {
      try {
        const localVal = localStorage.getItem(this.storageKeyPrefix + key);
        if (localVal) {
          data = localVal;
          this.#data.set(key, localVal);
        }
      } catch (e) {
        console.error('Fallback read from localStorage failed for key:', key, e);
      }
    }
    if (!data) return null;
    try {
      let decodedJson: string;
      try {
        // Try decoding with reverse encodeURIComponent escape sequence for full unicode safety
        decodedJson = decodeURIComponent(escape(atob(data)));
      } catch (e) {
        // Fallback to normal atob in case it wasn't saved with escape/unescape or unicode-safety wrapper
        decodedJson = atob(data);
      }
      const parsed = JSON.parse(decodedJson);
      return structuredClone(parsed) as T;
    } catch (e) {
      console.error('BackendDB decode error for key:', key, e);
      return null;
    }
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    try {
      const cloned = structuredClone(value);
      const stringified = JSON.stringify(cloned);
      const encoded = btoa(unescape(encodeURIComponent(stringified))); // Safe for unicode
      this.#data.set(key, encoded);
      localStorage.setItem(this.storageKeyPrefix + key, encoded);
      
      // Guarantee durability on every write
      await this.flush();
    } catch (e) {
      console.error('BackendDB set error for key:', key, e);
    }
  }

  async delete(key: string): Promise<void> {
    this.#data.delete(key);
    localStorage.removeItem(this.storageKeyPrefix + key);
    
    // Guarantee durability on delete
    await this.flush();
  }
}

export const db = new BackendDB();

// Helper functions for crypto
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return sha256(password);
}

export interface UserCredentials {
  email: string;
  passwordHash: string;
  role: 'owner' | 'manager' | 'accountant' | 'readonly';
}

export interface SecureAuditEntry {
  id: string;
  timestamp: number;
  user: string;
  action: string;
  details: string;
  before: any;
  after: any;
  tamperHash: string;
}

export class AuditDB {
  private static AUDIT_KEY = 'secure_audit_logs';

  static async addAuditEntry(action: string, user: string, details: string, before: any = null, after: any = null): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Core payload for hash
    const payload = JSON.stringify({
      id,
      timestamp,
      user,
      action,
      details,
      before: before ? structuredClone(before) : null,
      after: after ? structuredClone(after) : null
    });

    const tamperHash = await sha256(payload);

    const entry: SecureAuditEntry = {
      id,
      timestamp,
      user,
      action,
      details,
      before: before ? structuredClone(before) : null,
      after: after ? structuredClone(after) : null,
      tamperHash
    };

    const currentLogs = await db.get<SecureAuditEntry[]>(AuditDB.AUDIT_KEY) || [];
    currentLogs.unshift(entry); // Append only to start
    await db.set(AuditDB.AUDIT_KEY, currentLogs);
    console.log('[AuditLogs] Added audit entry:', action, 'with ID:', id);
  }

  static async getEntries(): Promise<SecureAuditEntry[]> {
    return await db.get<SecureAuditEntry[]>(AuditDB.AUDIT_KEY) || [];
  }

  static async verifyEntry(entry: SecureAuditEntry): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp,
        user: entry.user,
        action: entry.action,
        details: entry.details,
        before: entry.before,
        after: entry.after
      });
      const computedHash = await sha256(payload);
      return computedHash === entry.tamperHash;
    } catch {
      return false;
    }
  }
}
