import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Tenant, Property, BillHistoryEntry, BillingVerificationIssue } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function generateId() {
  return crypto.randomUUID();
}

export function getTenantBillingDetails(tenant: Tenant, property: Property) {
  const baseRent = tenant.manualOverrides?.baseRent !== undefined ? tenant.manualOverrides.baseRent : tenant.rent;
  
  const elecUnits = Math.max(0, tenant.currElecReading - tenant.prevElecReading);
  const defaultElecCharges = elecUnits * property.electricRate;
  const electricityCharges = tenant.manualOverrides?.electricityCharges !== undefined ? tenant.manualOverrides.electricityCharges : defaultElecCharges;
  
  const waterUnits = Math.max(0, tenant.currWaterReading - tenant.prevWaterReading);
  const defaultWaterCharges = waterUnits * property.waterRate;
  const waterCharges = tenant.manualOverrides?.waterCharges !== undefined ? tenant.manualOverrides.waterCharges : defaultWaterCharges;
  
  const defaultOtherFees = (tenant.expenses || []).reduce((acc, exp) => acc + exp.amount, 0);
  const otherFees = tenant.manualOverrides?.otherFees !== undefined ? tenant.manualOverrides.otherFees : defaultOtherFees;
  
  const openingBalance = tenant.manualOverrides?.openingBalance !== undefined ? tenant.manualOverrides.openingBalance : (tenant.previousDues ?? 0);
  
  const totalDue = tenant.manualOverrides?.totalDue !== undefined ? tenant.manualOverrides.totalDue : (baseRent + electricityCharges + waterCharges + otherFees + openingBalance);
  
  // Resolve paid amount prioritizing overrides, recorded payments, and stored paidAmount
  const paymentsArraySum = (Array.isArray(tenant.payments) && tenant.payments.length > 0)
    ? tenant.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : 0;
  const directPaid = (typeof tenant.paidAmount === 'number' && !isNaN(tenant.paidAmount)) ? tenant.paidAmount : 0;
  const overridePaid = (tenant.manualOverrides?.paidAmount !== undefined && !isNaN(tenant.manualOverrides.paidAmount)) ? tenant.manualOverrides.paidAmount : 0;

  let paidAmount = Math.max(paymentsArraySum, directPaid, overridePaid);
  if (paidAmount === 0 && tenant.isPaid) {
    paidAmount = totalDue;
  }

  // Outstanding balance (never negative unless landlord credit)
  const outstandingBalance = Math.max(0, totalDue - paidAmount);
  
  return {
    baseRent,
    electricityCharges,
    waterCharges,
    otherFees,
    openingBalance,
    totalDue,
    paidAmount,
    outstandingBalance,
    defaultElecCharges,
    defaultWaterCharges,
    defaultOtherFees,
    elecUnits,
    waterUnits
  };
}

/**
 * Mandatory Previous-Month & Current Billing Cycle Cross-Check System Verification
 * Prevents carrying corrupted or mismatched arrears into next month billing cycles.
 */
export function verifyPreviousBillingCycle(
  tenants: Tenant[],
  properties: Property[],
  history: BillHistoryEntry[]
): { valid: boolean; errors: BillingVerificationIssue[] } {
  const errors: BillingVerificationIssue[] = [];

  for (const t of tenants) {
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) continue;

    const billing = getTenantBillingDetails(t, prop);
    const recordedPaymentsSum = (t.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
    const actualPaid = billing.paidAmount;

    // 1. Check payment sum mismatch
    if (t.payments && t.payments.length > 0 && Math.abs(recordedPaymentsSum - actualPaid) > 0.01) {
      errors.push({
        tenantId: t.id,
        tenantName: t.name,
        roomNumber: t.roomNumber,
        propertyName: prop.name,
        issue: `Payment Sum Discrepancy: Sum of payment receipts (${formatCurrency(recordedPaymentsSum)}) does not match recorded paid total (${formatCurrency(actualPaid)}).`,
        expectedArrears: Math.max(0, billing.totalDue - recordedPaymentsSum),
        actualArrears: billing.outstandingBalance
      });
      continue;
    }

    // 2. Check arrears math integrity (outstandingBalance must equal totalDue - paidAmount)
    const expectedOutstanding = Math.max(0, billing.totalDue - actualPaid);
    if (Math.abs(billing.outstandingBalance - expectedOutstanding) > 0.01) {
      errors.push({
        tenantId: t.id,
        tenantName: t.name,
        roomNumber: t.roomNumber,
        propertyName: prop.name,
        issue: `Outstanding Balance Math Mismatch: Outstanding balance (${formatCurrency(billing.outstandingBalance)}) does not equal Total Due (${formatCurrency(billing.totalDue)}) minus Paid Amount (${formatCurrency(actualPaid)}).`,
        expectedArrears: expectedOutstanding,
        actualArrears: billing.outstandingBalance
      });
      continue;
    }

    // 3. Check historical opening balance continuity if prior history exists
    if (history && history.length > 0) {
      const propertyHistory = history.filter(h => h.propertyId === t.propertyId);
      if (propertyHistory.length > 0) {
        const lastEntry = propertyHistory[0]; // newest snapshot
        const histTenant = lastEntry.snapshot.tenants.find((ht: any) => ht.id === t.id);
        if (histTenant && t.manualOverrides?.openingBalance === undefined) {
          const histProp = lastEntry.snapshot.property;
          const histBilling = getTenantBillingDetails(histTenant, histProp);
          const expectedOpening = histBilling.outstandingBalance;

          if (Math.abs((t.previousDues ?? 0) - expectedOpening) > 0.01) {
            errors.push({
              tenantId: t.id,
              tenantName: t.name,
              roomNumber: t.roomNumber,
              propertyName: prop.name,
              issue: `Historical Arrears Carry-over Corruption: Current opening arrears (${formatCurrency(t.previousDues ?? 0)}) does not match previous cycle ending balance (${formatCurrency(expectedOpening)}).`,
              expectedArrears: expectedOpening,
              actualArrears: t.previousDues ?? 0
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function formatMonthStr(ymStr: string) {
  if (!ymStr) return '';
  const parts = ymStr.split('-');
  if (parts[0] === 'BS') {
    const NEPALI_MONTHS = [
      'Baisakh', 'Jetha', 'Asar', 'Saun', 'Bhadau', 'Asoj',
      'Kattik', 'Mangsir', 'Pus', 'Magh', 'Phagun', 'Chait'
    ];
    const year = parts[1] || '';
    const monthIdx = parseInt(parts[2] || '1', 10) - 1;
    const monthName = NEPALI_MONTHS[monthIdx] || '';
    return `${monthName} ${year} (B.S.)`;
  }
  if (parts.length < 2) return ymStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const d = new Date(parseInt(year, 10), monthIdx, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
