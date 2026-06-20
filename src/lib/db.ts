import { Tenant, Property } from '../types';

export class BackendDB {
  #data = new Map<string, string>();
  private storageKeyPrefix = '_nexum_db_';

  constructor() {
    this.init();
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

  async get<T = any>(key: string): Promise<T | null> {
    const data = this.#data.get(key);
    if (!data) return null;
    try {
      const decodedJson = atob(data);
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
    } catch (e) {
      console.error('BackendDB set error for key:', key, e);
    }
  }

  async delete(key: string): Promise<void> {
    this.#data.delete(key);
    localStorage.removeItem(this.storageKeyPrefix + key);
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
