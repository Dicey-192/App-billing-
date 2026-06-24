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
    // 1. Load primary from localStorage
    let newestPrimaryTimestamp = 0;
    const primaryDataMap = new Map<string, string>();
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storageKeyPrefix)) {
          const val = localStorage.getItem(key);
          if (val) {
            const mapKey = key.slice(this.storageKeyPrefix.length);
            primaryDataMap.set(mapKey, val);
            
            // Try extracting target timestamp to compare robustly
            try {
              let parsed: any = null;
              try {
                parsed = JSON.parse(val);
              } catch {
                let decodedJson: string;
                try {
                  decodedJson = decodeURIComponent(escape(atob(val)));
                } catch {
                  decodedJson = atob(val);
                }
                parsed = JSON.parse(decodedJson);
              }
              if (parsed && typeof parsed === 'object' && '_timestamp' in parsed) {
                if (parsed._timestamp > newestPrimaryTimestamp) {
                  newestPrimaryTimestamp = parsed._timestamp;
                }
              }
            } catch {
              // Ignore parse error
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load primary storage into BackendDB', e);
    }

    // Always load primary keys first to ensure we have standard stored keys
    for (const [key, val] of primaryDataMap.entries()) {
      this.#data.set(key, val);
    }

    // 2. Read Emergency Backup
    let newestEmergencyTimestamp = 0;
    let emergencyData: Record<string, string> = {};
    try {
      const backupStr = localStorage.getItem('EMERGENCY_BACKUP');
      if (backupStr) {
        const envelope = JSON.parse(backupStr);
        if (envelope && typeof envelope === 'object' && '_timestamp' in envelope) {
          newestEmergencyTimestamp = envelope._timestamp;
          if (envelope.data && typeof envelope.data === 'object') {
            emergencyData = envelope.data;
          }
        }
      }
    } catch (e) {
      console.error('Failed to read EMERGENCY_BACKUP', e);
    }

    // 3. Restore from EMERGENCY_BACKUP if it is strictly newer
    if (newestEmergencyTimestamp > newestPrimaryTimestamp && Object.keys(emergencyData).length > 0) {
      console.log(`[BackendDB] EMERGENCY_BACKUP is newer (${newestEmergencyTimestamp} > ${newestPrimaryTimestamp}). Restoring/Merging...`);
      for (const [key, val] of Object.entries(emergencyData)) {
        this.#data.set(key, val);
        try {
          localStorage.setItem(this.storageKeyPrefix + key, val);
        } catch (e) {
          console.error(`[BackendDB] Sync key ${key} to primary failed during init restoration`, e);
        }
      }
    } else {
      console.log(`[BackendDB] Primary storage is newer or equal (${newestPrimaryTimestamp} >= ${newestEmergencyTimestamp}). Using primary.`);
      if (primaryDataMap.size > 0 && newestEmergencyTimestamp === 0) {
        this.saveEmergencyBackup();
      }
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

  private saveEmergencyBackup(): void {
    try {
      const backupData: Record<string, string> = {};
      for (const [k, v] of this.#data.entries()) {
        backupData[k] = v;
      }
      const envelope = {
        _timestamp: Date.now(),
        data: backupData
      };
      localStorage.setItem('EMERGENCY_BACKUP', JSON.stringify(envelope));
    } catch (e) {
      console.error('[BackendDB] Failed to save EMERGENCY_BACKUP:', e);
    }
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
      let parsed: any = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        let decodedJson: string;
        try {
          decodedJson = decodeURIComponent(escape(atob(data)));
        } catch {
          decodedJson = atob(data);
        }
        parsed = JSON.parse(decodedJson);
      }

      if (!parsed) return null;

      // Handle timestamped envelope structures cleanly
      if (parsed && typeof parsed === 'object' && 'payload' in parsed && '_timestamp' in parsed) {
        return structuredClone(parsed.payload) as T;
      }
      
      return structuredClone(parsed) as T;
    } catch (e) {
      console.error('BackendDB decode error for key:', key, e);
      return null;
    }
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    try {
      let clonedValue: any;
      try {
        clonedValue = structuredClone(value);
      } catch (cloneErr) {
        console.warn('[BackendDB] structuredClone failed, falling back to JSON clone:', cloneErr);
        clonedValue = JSON.parse(JSON.stringify(value));
      }
      const envelope = {
        _timestamp: Date.now(),
        payload: clonedValue
      };
      const stringified = JSON.stringify(envelope);
      this.#data.set(key, stringified);
      
      let primaryFailed = false;
      try {
        localStorage.setItem(this.storageKeyPrefix + key, stringified);
        
        // Immediate save verification
        const readBack = localStorage.getItem(this.storageKeyPrefix + key);
        if (!readBack || readBack.length !== stringified.length) {
          console.error(`[BackendDB] Immediate save verification failed for key: ${key}. Expected: ${stringified.length}`);
          primaryFailed = true;
        }
      } catch (err) {
        console.error(`[BackendDB] Primary storage write threw error for key: ${key}`, err);
        primaryFailed = true;
      }

      if (primaryFailed) {
        console.warn(`[BackendDB] Primary write failed. Triggering EMERGENCY_BACKUP fallback write.`);
        this.saveEmergencyBackup();
      } else {
        this.saveEmergencyBackup();
      }
      
      // Guarantee durability on every write
      await this.flush();
    } catch (e) {
      console.error('BackendDB set error for key:', key, e);
    }
  }

  async delete(key: string): Promise<void> {
    this.#data.delete(key);
    localStorage.removeItem(this.storageKeyPrefix + key);
    
    // Trigger backup and sync update on deletes as well
    this.saveEmergencyBackup();
    
    // Guarantee durability on delete
    await this.flush();
  }
}

// Global hookup to bypass HMR instances deletion
declare global {
  interface Window {
    __backend_db__?: BackendDB;
  }
}

let globalDb: BackendDB;
if (typeof window !== 'undefined') {
  if (!window.__backend_db__) {
    window.__backend_db__ = new BackendDB();
  }
  globalDb = window.__backend_db__;
} else {
  globalDb = new BackendDB();
}

export const db = globalDb;

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
