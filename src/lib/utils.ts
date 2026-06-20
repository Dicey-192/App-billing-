import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Tenant, Property } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
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
  
  const paidAmount = tenant.manualOverrides?.paidAmount !== undefined ? tenant.manualOverrides.paidAmount : (tenant.paidAmount ?? 0);
  
  // Outstanding balance (negative values represent credits)
  const outstandingBalance = totalDue - paidAmount;
  
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

export function formatMonthStr(ymStr: string) {
  if (!ymStr) return '';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const d = new Date(parseInt(year, 10), monthIdx, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
