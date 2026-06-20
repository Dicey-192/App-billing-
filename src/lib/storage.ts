import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, Property, Tenant, BillHistoryEntry, SubscriptionPlan } from '../types';
import { db } from './db';

const STORAGE_KEY = 'artha_billing_data';

const INITIAL_PLAN: SubscriptionPlan = {
  name: 'Free',
  maxProperties: 2,
  maxTenants: 5,
  aiAssistant: false,
};

const INITIAL_DATA: AppData = {
  properties: [],
  tenants: [],
  history: [],
  subscriptionPlan: INITIAL_PLAN,
};

export function performRecalculation(prev: AppData): AppData {
  const next = structuredClone(prev);
  const newHistory = [...next.history].sort((a, b) => a.createdAt - b.createdAt);
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
      const defaultElecCharges = elecUnits * prop.electricRate;
      const electricityCharges = t.manualOverrides?.electricityCharges !== undefined ? t.manualOverrides.electricityCharges : defaultElecCharges;
      
      const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
      const defaultWaterCharges = waterUnits * prop.waterRate;
      const waterCharges = t.manualOverrides?.waterCharges !== undefined ? t.manualOverrides.waterCharges : defaultWaterCharges;
      
      const defaultOtherFees = (t.expenses || []).reduce((acc, exp) => acc + exp.amount, 0);
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
    let openingBalance = tenantBalances.has(t.id) ? tenantBalances.get(t.id)! : t.previousDues;
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
    history: processedHistory.sort((a, b) => b.createdAt - a.createdAt),
    tenants: finalTenants
  };
}

export function useStorage() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [quotaUsage, setQuotaUsage] = useState(0);
  const [dataStats, setDataStats] = useState({ properties: 0, tenants: 0, history: 0 });

  // Asynchronously load data on mount
  useEffect(() => {
    async function initStorage() {
      try {
        let saved = await db.get<AppData>(STORAGE_KEY);
        
        // Double-safe fallback: if primary load returned null, try to load from EMERGENCY_BACKUP
        if (!saved) {
          console.warn('[useStorage] Primary load returned null. Attempting emergency fallback...');
          const backupStr = localStorage.getItem('EMERGENCY_BACKUP');
          if (backupStr) {
            try {
              const envelope = JSON.parse(backupStr);
              if (envelope && envelope.data && envelope.data[STORAGE_KEY]) {
                const bVal = envelope.data[STORAGE_KEY];
                let decodedJson: string;
                try {
                  decodedJson = decodeURIComponent(escape(atob(bVal)));
                } catch {
                  decodedJson = atob(bVal);
                }
                const parsed = JSON.parse(decodedJson);
                if (parsed && typeof parsed === 'object' && 'payload' in parsed) {
                  saved = parsed.payload;
                } else {
                  saved = parsed;
                }
                console.log('[useStorage] Successfully recovered data from EMERGENCY_BACKUP.');
              }
            } catch (fallbackErr) {
              console.error('[useStorage] Emergency backup parse failed:', fallbackErr);
            }
          }
        }

        if (saved) {
          // Backward compatibility check for plans
          if (!saved.subscriptionPlan) {
            saved.subscriptionPlan = INITIAL_PLAN;
          }
          setData(saved);
        } else {
          setData(INITIAL_DATA);
        }
      } catch (e) {
        console.error('Failed to parse storage data from BackendDB', e);
        setData(INITIAL_DATA);
      } finally {
        setIsLoading(false);
      }
    }
    initStorage();
  }, []);

  // Save data to BackendDB when changes occur
  useEffect(() => {
    if (isLoading) return;

    db.set(STORAGE_KEY, data).catch(e => {
      console.error('Failed to save data to BackendDB', e);
    });
    
    const stringified = JSON.stringify(data);
    
    // Detailed Stats
    const stats = {
      properties: new Blob([JSON.stringify(data.properties || [])]).size,
      tenants: new Blob([JSON.stringify(data.tenants || [])]).size,
      history: new Blob([JSON.stringify(data.history || [])]).size,
    };
    setDataStats(stats);

    const sizeInBytes = new Blob([stringified]).size;
    setQuotaUsage((sizeInBytes / (8 * 1024 * 1024)) * 100); // 8MB Quota Protection limit!
  }, [data, isLoading]);

  const addProperty = useCallback((property: Property) => {
    setData(prev => {
      const plan = prev.subscriptionPlan || INITIAL_PLAN;
      if (prev.properties.length >= plan.maxProperties) {
        alert(`Property limit reached! Maximum ${plan.maxProperties} properties allowed on the ${plan.name} plan. Upgrade to Pro for unlimited properties!`);
        return prev;
      }
      const next = {
        ...prev,
        properties: [...prev.properties, property],
      };
      return performRecalculation(next);
    });
  }, []);

  const updateProperty = useCallback((id: string, property: Partial<Property>) => {
    setData(prev => {
      const next = {
        ...prev,
        properties: prev.properties.map(p => p.id === id ? { ...p, ...property, updatedAt: Date.now() } : p),
      };
      return performRecalculation(next);
    });
  }, []);

  const deleteProperty = useCallback((id: string) => {
    setData(prev => {
      const next = {
        ...prev,
        properties: prev.properties.filter(p => p.id !== id),
        tenants: prev.tenants.filter(t => t.propertyId !== id),
        history: prev.history.filter(h => h.propertyId !== id),
      };
      return performRecalculation(next);
    });
  }, []);

  const addTenant = useCallback((tenant: Tenant) => {
    setData(prev => {
      const plan = prev.subscriptionPlan || INITIAL_PLAN;
      if (prev.tenants.length >= plan.maxTenants) {
        alert(`Tenant limit reached! Maximum ${plan.maxTenants} tenants allowed on the ${plan.name} plan. Upgrade to Pro to add more!`);
        return prev;
      }
      const next = {
        ...prev,
        tenants: [...prev.tenants, tenant],
      };
      return performRecalculation(next);
    });
  }, []);

  const updateTenant = useCallback((id: string, tenant: Partial<Tenant>) => {
    setData(prev => {
      const next = {
        ...prev,
        tenants: prev.tenants.map(t => t.id === id ? { ...t, ...tenant, updatedAt: Date.now() } : t),
      };
      return performRecalculation(next);
    });
  }, []);

  const updateTenants = useCallback((updates: { id: string; updates: Partial<Tenant> }[]) => {
    setData(prev => {
      const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
      const next = {
        ...prev,
        tenants: prev.tenants.map(t => {
          const u = tenantMap.get(t.id);
          return u ? { ...t, ...u, updatedAt: Date.now() } : t;
        }),
      };
      return performRecalculation(next);
    });
  }, []);

  const deleteTenant = useCallback((id: string) => {
    setData(prev => {
      const next = {
        ...prev,
        tenants: prev.tenants.filter(t => t.id !== id),
      };
      return performRecalculation(next);
    });
  }, []);

  const addHistory = useCallback((entry: BillHistoryEntry) => {
    setData(prev => {
      const next = {
        ...prev,
        history: [entry, ...prev.history],
      };
      return performRecalculation(next);
    });
  }, []);

  const addManyHistory = useCallback((entries: BillHistoryEntry[]) => {
    setData(prev => {
      const next = {
        ...prev,
        history: [...entries, ...prev.history],
      };
      return performRecalculation(next);
    });
  }, []);

  const rollover = useCallback((month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => {
    setData(prev => {
      const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
      const next = {
        ...prev,
        activeMonth: month,
        dismissedMonth: undefined,
        history: [...historyEntries, ...(prev.history || [])],
        tenants: prev.tenants.map(t => {
          const u = tenantMap.get(t.id);
          return u ? { ...t, ...u, updatedAt: Date.now() } : t;
        }),
      };
      return performRecalculation(next);
    });
  }, []);

  const setActiveMonth = useCallback((month: string) => {
    setData(prev => ({ ...prev, activeMonth: month, dismissedMonth: undefined }));
  }, []);

  const dismissRollover = useCallback((month: string) => {
    setData(prev => ({ ...prev, dismissedMonth: month }));
  }, []);

  const recalculateBalances = useCallback(() => {
    setData(prev => performRecalculation(prev));
  }, []);

  const updateHistoryTenant = useCallback((entryId: string, tenantId: string, updates: Partial<any>) => {
    setData(prev => {
      const next = {
        ...prev,
        history: prev.history.map(h => {
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
      };
      return performRecalculation(next);
    });
  }, []);

  const addAuditLog = useCallback((tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => {
    setData(prev => {
      const logs = prev.auditLogs || [];
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
      return {
        ...prev,
        auditLogs: [newEntry, ...logs]
      };
    });
  }, []);

  const toggleSupportMasterMode = useCallback(() => {
    setData(prev => ({
      ...prev,
      supportMasterOverrideMode: !prev.supportMasterOverrideMode
    }));
  }, []);

  const clearAuditLogs = useCallback(() => {
    setData(prev => ({
      ...prev,
      auditLogs: []
    }));
  }, []);

  const cleanOldHistory = useCallback((monthsToKeep: number = 12) => {
    setData(prev => {
      const now = Date.now();
      const cutoff = now - (monthsToKeep * 30 * 24 * 60 * 60 * 1000);
      const next = {
        ...prev,
        history: prev.history.filter(h => h.createdAt > cutoff),
      };
      return performRecalculation(next);
    });
  }, []);

  const restoreData = useCallback((newData: AppData) => {
    const next = {
      ...newData,
      lastBackupAt: Date.now()
    };
    setData(performRecalculation(next));
  }, []);

  const setSubscriptionPlan = useCallback((plan: SubscriptionPlan) => {
    setData(prev => ({
      ...prev,
      subscriptionPlan: plan
    }));
  }, []);

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
    setData,
    setSubscriptionPlan,
  }), [data, isLoading, quotaUsage, dataStats, addProperty, updateProperty, deleteProperty, addTenant, updateTenant, updateTenants, deleteTenant, addHistory, addManyHistory, rollover, setActiveMonth, dismissRollover, updateHistoryTenant, cleanOldHistory, restoreData, recalculateBalances, addAuditLog, toggleSupportMasterMode, clearAuditLogs, setSubscriptionPlan]);
}
