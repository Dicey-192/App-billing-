import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, Property, Tenant, BillHistoryEntry } from '../types';

const STORAGE_KEY = 'artha_billing_data';

const INITIAL_DATA: AppData = {
  properties: [],
  tenants: [],
  history: [],
};

export function useStorage() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse storage data', e);
      }
    }
    return INITIAL_DATA;
  });

  const [quotaUsage, setQuotaUsage] = useState(0);
  const [dataStats, setDataStats] = useState({ properties: 0, tenants: 0, history: 0 });

  useEffect(() => {
    const stringified = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, stringified);
    
    // Detailed Stats
    const stats = {
      properties: new Blob([JSON.stringify(data.properties)]).size,
      tenants: new Blob([JSON.stringify(data.tenants)]).size,
      history: new Blob([JSON.stringify(data.history)]).size,
    };
    setDataStats(stats);

    const sizeInBytes = new Blob([stringified]).size;
    setQuotaUsage((sizeInBytes / (5 * 1024 * 1024)) * 100);
  }, [data]);

  const addProperty = useCallback((property: Property) => {
    setData(prev => {
      if (prev.properties.length >= 2) {
        alert('Property limit reached! Maximum 2 properties allowed.');
        return prev;
      }
      return {
        ...prev,
        properties: [...prev.properties, property],
      };
    });
  }, []);

  const updateProperty = useCallback((id: string, property: Partial<Property>) => {
    setData(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === id ? { ...p, ...property, updatedAt: Date.now() } : p),
    }));
  }, []);

  const deleteProperty = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      properties: prev.properties.filter(p => p.id !== id),
      tenants: prev.tenants.filter(t => t.propertyId !== id),
      history: prev.history.filter(h => h.propertyId !== id),
    }));
  }, []);

  const addTenant = useCallback((tenant: Tenant) => {
    setData(prev => ({
      ...prev,
      tenants: [...prev.tenants, tenant],
    }));
  }, []);

  const updateTenant = useCallback((id: string, tenant: Partial<Tenant>) => {
    setData(prev => ({
      ...prev,
      tenants: prev.tenants.map(t => t.id === id ? { ...t, ...tenant, updatedAt: Date.now() } : t),
    }));
  }, []);

  const updateTenants = useCallback((updates: { id: string; updates: Partial<Tenant> }[]) => {
    setData(prev => {
      const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
      return {
        ...prev,
        tenants: prev.tenants.map(t => {
          const u = tenantMap.get(t.id);
          return u ? { ...t, ...u, updatedAt: Date.now() } : t;
        }),
      };
    });
  }, []);

  const deleteTenant = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      tenants: prev.tenants.filter(t => t.id !== id),
    }));
  }, []);

  const addHistory = useCallback((entry: BillHistoryEntry) => {
    setData(prev => ({
      ...prev,
      history: [entry, ...prev.history],
    }));
  }, []);

  const addManyHistory = useCallback((entries: BillHistoryEntry[]) => {
    setData(prev => ({
      ...prev,
      history: [...entries, ...prev.history],
    }));
  }, []);

  const rollover = useCallback((month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => {
    setData(prev => {
      const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
      return {
        ...prev,
        activeMonth: month,
        dismissedMonth: undefined,
        history: [...historyEntries, ...prev.history],
        tenants: prev.tenants.map(t => {
          const u = tenantMap.get(t.id);
          return u ? { ...t, ...u, updatedAt: Date.now() } : t;
        }),
      };
    });
  }, []);

  const setActiveMonth = useCallback((month: string) => {
    setData(prev => ({ ...prev, activeMonth: month, dismissedMonth: undefined }));
  }, []);

  const dismissRollover = useCallback((month: string) => {
    setData(prev => ({ ...prev, dismissedMonth: month }));
  }, []);

  const recalculateBalances = useCallback(() => {
    setData(prev => {
      const newHistory = [...prev.history].sort((a, b) => a.createdAt - b.createdAt);
      const newTenants = [...prev.tenants];
      
      // Track running balance per tenant
      const tenantBalances = new Map<string, number>();

      const processedHistory = newHistory.map(entry => {
        const prop = prev.properties.find(p => p.id === entry.propertyId);
        if (!prop) return entry;

        const updatedTenants = entry.snapshot.tenants.map(t => {
          // Determine openingBalance
          let openingBalance = tenantBalances.get(t.id) ?? 0;
          
          if (t.manualOverrides?.openingBalance !== undefined) {
            openingBalance = t.manualOverrides.openingBalance;
          } else if (t.openingBalance !== undefined && tenantBalances.get(t.id) === undefined) {
            openingBalance = t.openingBalance;
          } else if (t.previousDues !== undefined && tenantBalances.get(t.id) === undefined) {
            openingBalance = t.previousDues;
          }
          
          const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
          const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
          const totalExtra = (t.expenses || []).reduce((acc, exp) => acc + exp.amount, 0);
          
          const baseCharges = t.rent + 
                          (elecUnits * prop.electricRate) + 
                          (waterUnits * prop.waterRate) + totalExtra;
          
          // Determine totalDue
          let totalDue = openingBalance + baseCharges;
          if (t.manualOverrides?.totalDue !== undefined) {
            totalDue = t.manualOverrides.totalDue;
          }

          // Determine paidAmount
          let paid = t.paidAmount || 0;
          if (t.manualOverrides?.paidAmount !== undefined) {
            paid = t.manualOverrides.paidAmount;
          }

          // Determine status
          let isPaid = t.isPaid;
          if (t.manualOverrides?.isPaid !== undefined) {
            isPaid = t.manualOverrides.isPaid;
          } else {
            isPaid = paid >= totalDue;
          }
          
          const remaining = Math.max(0, totalDue - paid);
          
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

      // Update current tenants with final balances
      const finalTenants = newTenants.map(t => {
        let openingBalance = tenantBalances.get(t.id) ?? 0;
        if (t.manualOverrides?.openingBalance !== undefined) {
          openingBalance = t.manualOverrides.openingBalance;
        }

        return {
          ...t,
          previousDues: openingBalance
        };
      });

      return {
        ...prev,
        history: processedHistory.sort((a, b) => b.createdAt - a.createdAt), // Restore newest-first order
        tenants: finalTenants
      };
    });
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
      return next;
    });
    // Trigger ripple effect
    recalculateBalances();
  }, [recalculateBalances]);

  const addAuditLog = useCallback((tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => {
    setData(prev => {
      const logs = prev.auditLogs || [];
      const newEntry = {
        id: Math.random().toString(36).substring(2, 11),
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
      return {
        ...prev,
        history: prev.history.filter(h => h.createdAt > cutoff),
      };
    });
  }, []);

  const restoreData = useCallback((newData: AppData) => {
    setData({
      ...newData,
      lastBackupAt: Date.now()
    });
  }, []);

  return useMemo(() => ({
    data,
    quotaUsage,
    dataStats,
    properties: data.properties,
    tenants: data.tenants,
    history: data.history,
    auditLogs: data.auditLogs || [],
    supportMasterOverrideMode: data.supportMasterOverrideMode || false,
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
  }), [data, quotaUsage, dataStats, addProperty, updateProperty, deleteProperty, addTenant, updateTenant, updateTenants, deleteTenant, addHistory, addManyHistory, rollover, setActiveMonth, dismissRollover, updateHistoryTenant, cleanOldHistory, restoreData, recalculateBalances, addAuditLog, toggleSupportMasterMode, clearAuditLogs]);
}
