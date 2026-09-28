import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppData, Property, Tenant, BillHistoryEntry, HistoryTenantSnapshot, SubscriptionPlan } from '../types';
import { db } from './db';
import { getIdbItem, setIdbItem, requestStoragePersistence } from './indexedDb';

const STORAGE_KEY = 'rentflo_billing_data';

const INITIAL_PLAN: SubscriptionPlan = {
  name: 'Unlimited',
  maxProperties: 999999,
  maxTenants: 999999,
};

const INITIAL_DATA: AppData = {
  properties: [],
  tenants: [],
  history: [],
  subscriptionPlan: INITIAL_PLAN,
  calendarSystem: 'AD',
};

export function normalizeAndValidateBackup(raw: any): AppData {
  let target = raw;
  if (typeof target === 'string') {
    try {
      target = JSON.parse(target);
    } catch {
      try {
        const decoded = decodeURIComponent(escape(atob(target)));
        target = JSON.parse(decoded);
      } catch {
        throw new Error("Could not parse backup JSON string: invalid format");
      }
    }
  }

  // Recursively unroll envelopes
  for (let i = 0; i < 5; i++) {
    if (!target || typeof target !== 'object') break;
    
    if (typeof target.payload === 'string') {
      try { target.payload = JSON.parse(target.payload); } catch {}
    }
    if (typeof target.data === 'string') {
      try { target.data = JSON.parse(target.data); } catch {}
    }

    if (target.payload && typeof target.payload === 'object') {
      target = target.payload;
    } else if (target.data && typeof target.data === 'object') {
      if (target.data.rentflo_billing_data) {
        let inner = target.data.rentflo_billing_data;
        if (typeof inner === 'string') {
          try { inner = JSON.parse(inner); } catch {}
        }
        target = inner;
      } else if (target.data.artha_billing_data) {
        let inner = target.data.artha_billing_data;
        if (typeof inner === 'string') {
          try { inner = JSON.parse(inner); } catch {}
        }
        target = inner;
      } else if (Array.isArray(target.data.properties) || Array.isArray(target.data.tenants)) {
        target = target.data;
      } else {
        target = target.data;
      }
    } else if (target.rentflo_billing_data) {
      let inner = target.rentflo_billing_data;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch {}
      }
      target = inner;
    } else if (target._nexum_db_rentflo_billing_data) {
      let inner = target._nexum_db_rentflo_billing_data;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch {}
      }
      target = inner;
    } else {
      break;
    }
  }

  if (!target || typeof target !== 'object') {
    throw new Error("Invalid backup format: contents are not an object");
  }

  const properties = Array.isArray(target.properties) ? target.properties : [];
  const tenants = Array.isArray(target.tenants) ? target.tenants : [];
  const history = Array.isArray(target.history) ? target.history : [];

  return {
    ...target,
    properties,
    tenants,
    history,
    calendarSystem: target.calendarSystem === 'BS' ? 'BS' : 'AD',
    activeMonth: target.activeMonth || '',
    subscriptionPlan: INITIAL_PLAN,
    auditLogs: Array.isArray(target.auditLogs) ? target.auditLogs : [],
    _timestamp: target._timestamp || target._lastSavedAt || Date.now(),
    _lastSavedAt: target._lastSavedAt || target._timestamp || Date.now()
  };
}

/**
 * Triple-redundant, synchronous and asynchronous permanent storage.
 * Saves immediately to localStorage (multiple keys), IndexedDB, BackendDB, and Server disk.
 */
export function persistEverywhere(appData: AppData): AppData {
  const now = Date.now();
  const stampedData: AppData = {
    ...appData,
    _timestamp: now,
    _lastSavedAt: now,
  };

  // 1. Synchronous localStorage writes to all key variants
  try {
    const envelope = {
      _timestamp: now,
      payload: stampedData
    };
    const stringified = JSON.stringify(envelope);
    localStorage.setItem('_nexum_db_' + STORAGE_KEY, stringified);
    localStorage.setItem(STORAGE_KEY, stringified);
    localStorage.setItem('_nexum_db_rentflo_billing_data', stringified);
    localStorage.setItem('rentflo_billing_data', stringified);
    localStorage.setItem('_nexum_db_artha_billing_data', stringified);
    localStorage.setItem('artha_billing_data', stringified);
    
    // EMERGENCY_BACKUP
    const backupEnvelope = {
      _timestamp: now,
      data: {
        rentflo_billing_data: stringified,
        artha_billing_data: stringified
      }
    };
    localStorage.setItem('EMERGENCY_BACKUP', JSON.stringify(backupEnvelope));
  } catch (err) {
    console.error('[useStorage] Synchronous localStorage write error:', err);
  }

  // 2. Persistent IndexedDB write
  setIdbItem(STORAGE_KEY, stampedData).catch(err => {
    console.warn('[useStorage] IndexedDB save error:', err);
  });
  setIdbItem('rentflo_billing_data', stampedData).catch(() => {});

  // 3. BackendDB in-memory & fallback write
  db.set(STORAGE_KEY, stampedData).catch(err => {
    console.warn('[useStorage] BackendDB set error:', err);
  });

  // 4. Server disk sync non-blocking
  try {
    fetch('/api/local-storage/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: stampedData })
    }).catch(err => {
      console.warn('[useStorage] Server disk save non-blocking warning:', err);
    });
  } catch {}

  return stampedData;
}

export const persistDataSynchronously = persistEverywhere;

export function performRecalculation(prev: AppData): AppData {
  if (!prev) return INITIAL_DATA;
  const next = {
    ...INITIAL_DATA,
    ...prev,
    properties: Array.isArray(prev.properties) ? prev.properties : [],
    tenants: Array.isArray(prev.tenants) ? prev.tenants : [],
    history: Array.isArray(prev.history) ? prev.history : [],
  };
  const newHistory = [...next.history].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const newTenants = [...next.tenants];
  const tenantBalances = new Map<string, number>();

  const processedHistory = newHistory.map(entry => {
    const prop = next.properties.find(p => p.id === entry.propertyId);
    if (!prop) return entry;

    if (!entry.snapshot || !entry.snapshot.tenants || !Array.isArray(entry.snapshot.tenants)) {
      return entry;
    }

    const updatedTenants = entry.snapshot.tenants.map((t: any) => {
      let openingBalance = tenantBalances.get(t.id) ?? 0;
      
      if (t.manualOverrides?.openingBalance !== undefined) {
        openingBalance = t.manualOverrides.openingBalance;
      } else if (t.openingBalance !== undefined && tenantBalances.get(t.id) === undefined) {
        openingBalance = t.openingBalance;
      } else if (t.previousDues !== undefined && tenantBalances.get(t.id) === undefined) {
        openingBalance = t.previousDues;
      }
      
      const baseRent = t.manualOverrides?.baseRent !== undefined ? t.manualOverrides.baseRent : t.rent;
      
      const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
      const defaultElecCharges = elecUnits * (prop.electricRate || 0);
      const electricityCharges = t.manualOverrides?.electricityCharges !== undefined ? t.manualOverrides.electricityCharges : defaultElecCharges;
      
      const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
      const defaultWaterCharges = waterUnits * (prop.waterRate || 0);
      const waterCharges = t.manualOverrides?.waterCharges !== undefined ? t.manualOverrides.waterCharges : defaultWaterCharges;
      
      const defaultOtherFees = (t.expenses || []).reduce((acc: number, exp: any) => acc + exp.amount, 0);
      const otherFees = t.manualOverrides?.otherFees !== undefined ? t.manualOverrides.otherFees : defaultOtherFees;
      
      const currentCharges = baseRent + electricityCharges + waterCharges + otherFees;
      
      let totalDue = openingBalance + currentCharges;
      if (t.manualOverrides?.totalDue !== undefined) {
        totalDue = t.manualOverrides.totalDue;
      }

      let paid = t.paidAmount || 0;
      if (t.manualOverrides?.paidAmount !== undefined) {
        paid = t.manualOverrides.paidAmount;
      }

      let isPaid = t.isPaid;
      if (t.manualOverrides?.isPaid !== undefined) {
        isPaid = t.manualOverrides.isPaid;
      } else {
        isPaid = paid >= totalDue;
      }
      
      const remaining = isPaid && (totalDue - paid > 0) ? 0 : (totalDue - paid);
      tenantBalances.set(t.id, remaining);

      return { 
        ...t, 
        openingBalance, 
        previousDues: openingBalance,
        paidAmount: paid,
        isPaid
      };
    });

    return {
      ...entry,
      snapshot: {
        ...entry.snapshot,
        tenants: updatedTenants
      }
    };
  });

  const finalTenants = newTenants.map(t => {
    let openingBalance = (t.previousDues !== undefined && typeof t.previousDues === 'number' && !isNaN(t.previousDues))
      ? t.previousDues
      : (tenantBalances.has(t.id) ? tenantBalances.get(t.id)! : 0);
    if (t.manualOverrides?.openingBalance !== undefined) {
      openingBalance = t.manualOverrides.openingBalance;
    }
    return {
      ...t,
      previousDues: openingBalance
    };
  });

  return {
    ...next,
    history: processedHistory.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    tenants: finalTenants
  };
}

function loadDirectFromLocalStorage(): AppData | null {
  const candidateKeys = [
    '_nexum_db_' + STORAGE_KEY,
    STORAGE_KEY,
    '_nexum_db_rentflo_billing_data',
    'rentflo_billing_data',
    '_nexum_db_artha_billing_data',
    'artha_billing_data',
  ];

  let bestData: AppData | null = null;
  let bestTimestamp = 0;

  for (const key of candidateKeys) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(stored);
      } catch {
        try {
          const decoded = decodeURIComponent(escape(atob(stored)));
          parsed = JSON.parse(decoded);
        } catch {
          continue;
        }
      }

      if (!parsed) continue;

      let payload: any = parsed;
      let ts = 0;
      if (typeof parsed === 'object' && parsed !== null) {
        if ('payload' in parsed) {
          payload = parsed.payload;
          ts = parsed._timestamp || 0;
        } else if ('_timestamp' in parsed) {
          ts = parsed._timestamp;
        }
      }

      if (payload && (Array.isArray(payload.properties) || Array.isArray(payload.tenants))) {
        const validated = normalizeAndValidateBackup(payload);
        const itemTs = ts || validated._timestamp || validated._lastSavedAt || 0;
        if (itemTs >= bestTimestamp) {
          bestTimestamp = itemTs;
          bestData = validated;
        }
      }
    } catch {
      // Ignore individual key parse error
    }
  }

  // Check emergency backup as well
  try {
    const backupStr = localStorage.getItem('EMERGENCY_BACKUP');
    if (backupStr) {
      const envelope = JSON.parse(backupStr);
      if (envelope && envelope.data) {
        const bVal = envelope.data[STORAGE_KEY] || envelope.data['rentflo_billing_data'] || envelope.data['artha_billing_data'];
        if (bVal) {
          let parsedInner = typeof bVal === 'string' ? JSON.parse(bVal) : bVal;
          if (parsedInner && parsedInner.payload) parsedInner = parsedInner.payload;
          if (parsedInner && (Array.isArray(parsedInner.properties) || Array.isArray(parsedInner.tenants))) {
            const validated = normalizeAndValidateBackup(parsedInner);
            const itemTs = envelope._timestamp || validated._timestamp || 0;
            if (itemTs > bestTimestamp) {
              bestTimestamp = itemTs;
              bestData = validated;
            }
          }
        }
      }
    }
  } catch {}

  if (bestData) {
    return performRecalculation(bestData);
  }
  return null;
}

export function useStorage() {
  // 1. Initial State: Load immediately & synchronously from localStorage on first frame
  const [data, setData] = useState<AppData>(() => {
    const direct = loadDirectFromLocalStorage();
    if (direct) {
      return direct;
    }
    return INITIAL_DATA;
  });

  const latestDataRef = useRef<AppData>(data);
  latestDataRef.current = data;

  const [isLoading, setIsLoading] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState(0);
  const [dataStats, setDataStats] = useState({ properties: 0, tenants: 0, history: 0 });

  // Central commit pipeline: ensures EVERY mutation is saved immediately to all storage layers
  const commitData = useCallback((nextData: AppData): AppData => {
    const recalculated = performRecalculation(nextData);
    const persisted = persistEverywhere(recalculated);
    latestDataRef.current = persisted;
    setData(persisted);
    return persisted;
  }, []);

  // On mount: check IndexedDB, request persistent storage, sync with server
  useEffect(() => {
    setIsLoading(false);
    requestStoragePersistence();

    // 1. Check IndexedDB
    getIdbItem<AppData>(STORAGE_KEY).then(idbData => {
      if (idbData && (idbData.properties?.length || idbData.tenants?.length)) {
        const idbNormalized = normalizeAndValidateBackup(idbData);
        const idbTs = idbNormalized._timestamp || idbNormalized._lastSavedAt || 0;
        const currentTs = latestDataRef.current._timestamp || latestDataRef.current._lastSavedAt || 0;
        if (idbTs > currentTs || latestDataRef.current.properties.length === 0) {
          console.log('[useStorage] Hydrated richer data from persistent IndexedDB');
          commitData(idbNormalized);
        }
      }
    }).catch(err => {
      console.warn('[useStorage] IndexedDB mount check fallback:', err);
    });

    // 2. Check Server Local Storage Folder
    fetch('/api/local-storage/load')
      .then(res => res.json())
      .then(payload => {
        if (payload?.success && payload?.data) {
          const diskData = normalizeAndValidateBackup(payload.data);
          const serverTs = diskData._timestamp || diskData._lastSavedAt || payload.lastUpdated || 0;
          const current = latestDataRef.current;
          const currentTs = current._timestamp || current._lastSavedAt || 0;
          const hasLocal = current.properties.length > 0 || current.tenants.length > 0;

          // If local device data is newer or has modifications since server last updated:
          if (hasLocal && currentTs >= serverTs) {
            console.log('[useStorage] Device local storage is newer than server disk, updating server disk.');
            fetch('/api/local-storage/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: current })
            }).catch(() => {});
          } else if (serverTs > currentTs && currentTs > 0) {
            console.log('[useStorage] Server disk has newer data, updating device.');
            commitData(diskData);
          } else if (!hasLocal && (diskData.properties.length > 0 || diskData.tenants.length > 0)) {
            console.log('[useStorage] Device local storage is empty, bootstrapping from server disk.');
            commitData(diskData);
          }
        }
      })
      .catch(err => {
        console.warn('[useStorage] Initial local folder load fallback:', err);
      });

    // 3. Register mobile and browser flush listeners
    const handleImmediateFlush = () => {
      if (latestDataRef.current) {
        persistEverywhere(latestDataRef.current);
      }
    };

    window.addEventListener('beforeunload', handleImmediateFlush);
    window.addEventListener('pagehide', handleImmediateFlush);
    window.addEventListener('freeze', handleImmediateFlush);
    const handleVisChange = () => {
      if (document.visibilityState === 'hidden') {
        handleImmediateFlush();
      }
    };
    document.addEventListener('visibilitychange', handleVisChange);

    return () => {
      window.removeEventListener('beforeunload', handleImmediateFlush);
      window.removeEventListener('pagehide', handleImmediateFlush);
      window.removeEventListener('freeze', handleImmediateFlush);
      document.removeEventListener('visibilitychange', handleVisChange);
    };
  }, [commitData]);

  // Compute stats on data changes
  useEffect(() => {
    const stringified = JSON.stringify(data);
    const stats = {
      properties: new Blob([JSON.stringify(data.properties || [])]).size,
      tenants: new Blob([JSON.stringify(data.tenants || [])]).size,
      history: new Blob([JSON.stringify(data.history || [])]).size,
    };
    setDataStats(stats);
    const sizeInBytes = new Blob([stringified]).size;
    setQuotaUsage((sizeInBytes / (8 * 1024 * 1024)) * 100);
  }, [data]);

  // Mutation Actions - All write immediately to permanent storage!
  const addProperty = useCallback((property: Property) => {
    commitData({
      ...latestDataRef.current,
      properties: [...latestDataRef.current.properties, property],
    });
  }, [commitData]);

  const updateProperty = useCallback((id: string, property: Partial<Property>) => {
    commitData({
      ...latestDataRef.current,
      properties: latestDataRef.current.properties.map(p => p.id === id ? { ...p, ...property, updatedAt: Date.now() } : p),
    });
  }, [commitData]);

  const deleteProperty = useCallback((id: string) => {
    commitData({
      ...latestDataRef.current,
      properties: latestDataRef.current.properties.filter(p => p.id !== id),
      tenants: latestDataRef.current.tenants.filter(t => t.propertyId !== id),
      history: latestDataRef.current.history.filter(h => h.propertyId !== id),
    });
  }, [commitData]);

  const addTenant = useCallback((tenant: Tenant) => {
    commitData({
      ...latestDataRef.current,
      tenants: [...latestDataRef.current.tenants, tenant],
    });
  }, [commitData]);

  const updateTenant = useCallback((id: string, tenant: Partial<Tenant>) => {
    commitData({
      ...latestDataRef.current,
      tenants: latestDataRef.current.tenants.map(t => t.id === id ? { ...t, ...tenant, updatedAt: Date.now() } : t),
    });
  }, [commitData]);

  const updateTenants = useCallback((updates: { id: string; updates: Partial<Tenant> }[]) => {
    const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
    commitData({
      ...latestDataRef.current,
      tenants: latestDataRef.current.tenants.map(t => {
        const u = tenantMap.get(t.id);
        return u ? { ...t, ...u, updatedAt: Date.now() } : t;
      }),
    });
  }, [commitData]);

  const deleteTenant = useCallback((id: string) => {
    commitData({
      ...latestDataRef.current,
      tenants: latestDataRef.current.tenants.filter(t => t.id !== id),
    });
  }, [commitData]);

  const addHistory = useCallback((entry: BillHistoryEntry) => {
    commitData({
      ...latestDataRef.current,
      history: [entry, ...latestDataRef.current.history],
    });
  }, [commitData]);

  const addManyHistory = useCallback((entries: BillHistoryEntry[]) => {
    commitData({
      ...latestDataRef.current,
      history: [...entries, ...latestDataRef.current.history],
    });
  }, [commitData]);

  const rollover = useCallback((month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => {
    const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
    commitData({
      ...latestDataRef.current,
      activeMonth: month,
      dismissedMonth: undefined,
      history: [...historyEntries, ...(latestDataRef.current.history || [])],
      tenants: latestDataRef.current.tenants.map(t => {
        const u = tenantMap.get(t.id);
        return u ? { ...t, ...u, updatedAt: Date.now() } : t;
      }),
    });
  }, [commitData]);

  const setActiveMonth = useCallback((month: string) => {
    commitData({
      ...latestDataRef.current,
      activeMonth: month,
      dismissedMonth: undefined
    });
  }, [commitData]);

  const dismissRollover = useCallback((month: string) => {
    commitData({
      ...latestDataRef.current,
      dismissedMonth: month
    });
  }, [commitData]);

  const recalculateBalances = useCallback(() => {
    commitData({ ...latestDataRef.current });
  }, [commitData]);

  const updateHistoryTenant = useCallback((entryId: string, tenantId: string, updates: Partial<any>) => {
    commitData({
      ...latestDataRef.current,
      history: latestDataRef.current.history.map(h => {
        if (h.id !== entryId) return h;
        return {
          ...h,
          snapshot: {
            ...h.snapshot,
            tenants: h.snapshot.tenants.map(t => {
              if (t.id !== tenantId) return t;
              return { ...t, ...updates };
            })
          }
        };
      })
    });
  }, [commitData]);

  const addAuditLog = useCallback((tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => {
    const logs = latestDataRef.current.auditLogs || [];
    const newEntry = {
      id: crypto.randomUUID(),
      tenantId,
      tenantName,
      month,
      timestamp: Date.now(),
      fieldName,
      oldValue: String(oldValue),
      newValue: String(newValue)
    };
    commitData({
      ...latestDataRef.current,
      auditLogs: [newEntry, ...logs]
    });
  }, [commitData]);

  const toggleSupportMasterMode = useCallback(() => {
    commitData({
      ...latestDataRef.current,
      supportMasterOverrideMode: !latestDataRef.current.supportMasterOverrideMode
    });
  }, [commitData]);

  const clearAuditLogs = useCallback(() => {
    commitData({
      ...latestDataRef.current,
      auditLogs: []
    });
  }, [commitData]);

  const cleanOldHistory = useCallback((monthsToKeep: number = 12) => {
    const now = Date.now();
    const cutoff = now - (monthsToKeep * 30 * 24 * 60 * 60 * 1000);
    commitData({
      ...latestDataRef.current,
      history: latestDataRef.current.history.filter(h => h.createdAt > cutoff),
    });
  }, [commitData]);

  const confirmAndGenerateBill = useCallback((
    tenantId: string,
    period: string,
    finalElec: number,
    finalWater: number,
    calculations: {
      baseRent: number;
      electricityCharges: number;
      waterCharges: number;
      otherFees: number;
      openingBalance: number;
      totalDue: number;
    }
  ) => {
    const current = latestDataRef.current;
    const currentTenant = current.tenants.find(t => t.id === tenantId);
    if (!currentTenant) return null;

    const prop = current.properties.find(p => p.id === currentTenant.propertyId);

    const updatedTenant: Tenant = {
      ...currentTenant,
      currElecReading: finalElec,
      currWaterReading: finalWater,
      previousDues: calculations.openingBalance,
      isPaid: false,
      paidAmount: 0,
      manualOverrides: {
        baseRent: calculations.baseRent,
        electricityCharges: calculations.electricityCharges,
        waterCharges: calculations.waterCharges,
        otherFees: calculations.otherFees,
        openingBalance: calculations.openingBalance,
        totalDue: calculations.totalDue,
        paidAmount: 0,
        isPaid: false
      },
      updatedAt: Date.now()
    };

    const snapshotTenant: HistoryTenantSnapshot = {
      ...updatedTenant
    };

    const historyEntry: BillHistoryEntry = {
      id: `bill_${tenantId}_${period}_${Date.now()}`,
      propertyId: updatedTenant.propertyId,
      month: period,
      snapshot: {
        property: prop || {
          id: updatedTenant.propertyId,
          name: 'Property',
          address: '',
          electricRate: 0,
          waterRate: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          defaultExpenses: []
        },
        tenants: [snapshotTenant]
      },
      createdAt: Date.now()
    };

    const filteredHistory = current.history.filter(h => {
      if (h.month !== period) return true;
      if (h.id.includes(tenantId)) return false;
      if (Array.isArray(h.snapshot?.tenants) && h.snapshot.tenants.some(st => st.id === tenantId)) return false;
      return true;
    });

    const next: AppData = {
      ...current,
      tenants: current.tenants.map(t => t.id === tenantId ? updatedTenant : t),
      history: [historyEntry, ...filteredHistory]
    };

    commitData(next);

    return { tenant: updatedTenant, historyEntry };
  }, [commitData]);

  const restoreData = useCallback(async (newData: any) => {
    try {
      const normalized = normalizeAndValidateBackup(newData);
      const next: AppData = {
        ...normalized,
        lastBackupAt: Date.now(),
        subscriptionPlan: INITIAL_PLAN
      };
      commitData(next);
      return true;
    } catch (err) {
      console.error('[useStorage] restoreData failed:', err);
      return false;
    }
  }, [commitData]);

  const setSubscriptionPlan = useCallback((plan: SubscriptionPlan) => {
    commitData({
      ...latestDataRef.current,
      subscriptionPlan: plan
    });
  }, [commitData]);

  const setCalendarSystem = useCallback((calendarSystem: 'AD' | 'BS') => {
    commitData({
      ...latestDataRef.current,
      calendarSystem
    });
  }, [commitData]);

  const setDirectData = useCallback((action: React.SetStateAction<AppData>) => {
    setData(prev => {
      const next = typeof action === 'function' ? (action as (p: AppData) => AppData)(prev) : action;
      return commitData(next);
    });
  }, [commitData]);

  return useMemo(() => ({
    data,
    isLoading,
    quotaUsage,
    dataStats,
    properties: data.properties || [],
    tenants: data.tenants || [],
    history: data.history || [],
    auditLogs: data.auditLogs || [],
    supportMasterOverrideMode: data.supportMasterOverrideMode || false,
    subscriptionPlan: data.subscriptionPlan || INITIAL_PLAN,
    calendarSystem: data.calendarSystem || 'AD',
    addProperty,
    updateProperty,
    deleteProperty,
    addTenant,
    updateTenant,
    updateTenants,
    deleteTenant,
    addHistory,
    addManyHistory,
    rollover,
    setActiveMonth,
    dismissRollover,
    updateHistoryTenant,
    cleanOldHistory,
    restoreData,
    recalculateBalances,
    addAuditLog,
    toggleSupportMasterMode,
    clearAuditLogs,
    setData: setDirectData,
    confirmAndGenerateBill,
    setSubscriptionPlan,
    setCalendarSystem,
  }), [data, isLoading, quotaUsage, dataStats, addProperty, updateProperty, deleteProperty, addTenant, updateTenant, updateTenants, deleteTenant, addHistory, addManyHistory, rollover, setActiveMonth, dismissRollover, updateHistoryTenant, cleanOldHistory, confirmAndGenerateBill, restoreData, recalculateBalances, addAuditLog, toggleSupportMasterMode, clearAuditLogs, setSubscriptionPlan, setCalendarSystem, setDirectData]);
}
