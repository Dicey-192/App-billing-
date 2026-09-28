import React from 'react';
import { GuidedBillingFlow, GuidedBillingFlowProps, getNextNepaliMonth, getCurrentNepaliMonth } from './GuidedBillingFlow';
import { Tenant, Property, BillHistoryEntry } from '../types';

export interface BulkReadingsViewProps {
  tenants: Tenant[];
  properties: Property[];
  activeMonth: string;
  onMonthChange?: (month: string) => void;
  onBack: () => void;
  onNavigateToTenants?: () => void;
  onSave: (updates: { id: string; currElec: number; currWater: number }[]) => void;
  addAuditLog?: (tenantId: string, tenantName: string, month: string, action: string, previousValue?: string, newValue?: string) => void;
  recalculateBalances?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  updateTenant?: (id: string, updates: Partial<Tenant>) => void;
  updateTenants?: (updates: { id: string; updates: Partial<Tenant> }[]) => void;
  rollover?: (month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => void;
  addHistory?: (entry: BillHistoryEntry) => void;
  history?: BillHistoryEntry[];
  downloadReceipt?: (tenant: any) => Promise<void>;
  confirmAndGenerateBill?: (
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
  ) => any;
  currentUser?: { email: string; role: 'owner' | 'manager' | 'accountant' | 'readonly' } | null;
  initialStep?: 'rollover' | 'entry';
}

export function getNextBillingPeriod(currentPeriod: string): string {
  return getNextNepaliMonth(currentPeriod);
}

export const BulkReadingsView: React.FC<BulkReadingsViewProps> = (props) => {
  return (
    <GuidedBillingFlow
      tenants={props.tenants}
      properties={props.properties}
      activeMonth={props.activeMonth}
      onMonthChange={props.onMonthChange || (() => {})}
      onBack={props.onBack}
      onNavigateToTenants={props.onNavigateToTenants || props.onBack}
      onSaveReadings={props.onSave}
      confirmAndGenerateBill={props.confirmAndGenerateBill || (() => null)}
      rollover={props.rollover || (() => {})}
      history={props.history || []}
      showToast={props.showToast}
      currentUser={props.currentUser}
      initialStep={props.initialStep}
    />
  );
};
