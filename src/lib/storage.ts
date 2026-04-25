import { useState, useEffect } from 'react';
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Estimate quota usage (5MB is standard for localStorage)
    const stringified = JSON.stringify(data);
    const sizeInBytes = new Blob([stringified]).size;
    setQuotaUsage((sizeInBytes / (5 * 1024 * 1024)) * 100);
  }, [data]);

  const addProperty = (property: Property) => {
    setData(prev => ({
      ...prev,
      properties: [...prev.properties, property],
    }));
  };

  const updateProperty = (id: string, property: Partial<Property>) => {
    setData(prev => ({
      ...prev,
      properties: prev.properties.map(p => p.id === id ? { ...p, ...property, updatedAt: Date.now() } : p),
    }));
  };

  const deleteProperty = (id: string) => {
    setData(prev => ({
      ...prev,
      properties: prev.properties.filter(p => p.id !== id),
      tenants: prev.tenants.filter(t => t.propertyId !== id),
      history: prev.history.filter(h => h.propertyId !== id),
    }));
  };

  const addTenant = (tenant: Tenant) => {
    setData(prev => ({
      ...prev,
      tenants: [...prev.tenants, tenant],
    }));
  };

  const updateTenant = (id: string, tenant: Partial<Tenant>) => {
    setData(prev => ({
      ...prev,
      tenants: prev.tenants.map(t => t.id === id ? { ...t, ...tenant, updatedAt: Date.now() } : t),
    }));
  };

  const updateTenants = (updates: { id: string; updates: Partial<Tenant> }[]) => {
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
  };

  const deleteTenant = (id: string) => {
    setData(prev => ({
      ...prev,
      tenants: prev.tenants.filter(t => t.id !== id),
    }));
  };

  const addHistory = (entry: BillHistoryEntry) => {
    setData(prev => ({
      ...prev,
      history: [entry, ...prev.history],
    }));
  };

  const addManyHistory = (entries: BillHistoryEntry[]) => {
    setData(prev => ({
      ...prev,
      history: [...entries, ...prev.history],
    }));
  };

  const rollover = (month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => {
    setData(prev => {
      const tenantMap = new Map(updates.map(u => [u.id, u.updates]));
      return {
        ...prev,
        activeMonth: month,
        history: [...historyEntries, ...prev.history],
        tenants: prev.tenants.map(t => {
          const u = tenantMap.get(t.id);
          return u ? { ...t, ...u, updatedAt: Date.now() } : t;
        }),
      };
    });
  };

  const setActiveMonth = (month: string) => {
    setData(prev => ({ ...prev, activeMonth: month }));
  };

  const restoreData = (newData: AppData) => {
    setData(newData);
  };

  return {
    data,
    quotaUsage,
    properties: data.properties,
    tenants: data.tenants,
    history: data.history,
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
    restoreData,
  };
}
