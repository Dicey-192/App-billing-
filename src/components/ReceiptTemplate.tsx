import React from 'react';
import { Property, Tenant } from '../types';
import { formatCurrency, formatDate, getTenantBillingDetails } from '../lib/utils';
import NepaliDate from 'nepali-date-converter';

interface ReceiptTemplateProps {
  property: Property;
  tenant: Tenant;
  month: string;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ property, tenant, month }) => {
  const billing = getTenantBillingDetails(tenant, property);
  const outstandingBalance = billing.outstandingBalance;

  const today = new Date();
  const nepaliDateStr = new NepaliDate(today).format('YYYY-MM-DD');
  const englishDateStr = formatDate(today);

  // Deterministic 5-digit Invoice Number helper
  const getReceiptId = (tenantId: string, monthName: string) => {
    let hash = 0;
    const str = tenantId + monthName;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 90000) + 10000;
  };
  const receiptId = getReceiptId(tenant.id, month);

  // Due date (exactly 10 days after cycle launch date)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);
  const dueDateStr = formatDate(dueDate);

  // Parse expenses for ledger breakdown
  const expensesList = tenant.expenses || [];
  
  // Isolate Maintenance
  const maintenanceExpense = expensesList.find(
    e => e.name.toLowerCase().includes('maintenance') || e.name.toLowerCase().includes('service')
  );
  const maintenanceAmount = billing.otherFees; // Standardize on billing details otherFees for consistent math
  
  // Isolate other custom charges
  const otherExpenses = expensesList.filter(
    e => !maintenanceExpense || e.id !== maintenanceExpense.id
  );
  
  // Subtotal = Rent + Maintenance + Electricity + Water (excluding opening balance and extra items)
  const subTotal = billing.baseRent + maintenanceAmount + billing.electricityCharges + billing.waterCharges;
  
  // Additional Charges: Opening Balance / Balance Forward
  const balanceForward = billing.openingBalance;
  const additionalChargesTotal = balanceForward; // Opening Balance acts as the classical balance forward

  return (
    <div 
      id={`receipt-${tenant.id}`}
      className="receipt-card w-full max-w-[800px] mx-auto p-6 md:p-8 pb-8 relative overflow-hidden bg-white text-[#0F172A] rounded-2xl shadow-xl border border-slate-200 select-none print:shadow-none print:border-slate-300 print:bg-white"
      style={{ 
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {/* Background Watermark (Hidden below 600px and on printed sheets) */}
      <div 
        className="hidden md:block absolute top-[40%] left-[25%] text-slate-900/[0.03] text-[7rem] font-black pointer-events-none select-none tracking-[0.2em] -rotate-12 uppercase font-serif print:hidden"
      >
        STATEMENT
      </div>

      {/* Header Grid */}
      <div className="flex justify-between items-end mb-6 border-b-2 border-slate-200 pb-4 print:border-slate-300">
        <div>
          <h2 className="text-2xl font-black tracking-widest font-serif text-[#0F172A] uppercase">
            STATEMENT
          </h2>
          <span className="text-xs uppercase tracking-widest text-slate-500 font-mono font-bold mt-1 block">
            ID: #{receiptId}
          </span>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono mb-0.5">
            DATE OF ISSUE
          </p>
          <span className="text-xs md:text-sm text-slate-800 font-mono font-semibold">
            {englishDateStr} &bull; BS {nepaliDateStr}
          </span>
        </div>
      </div>

      {/* Tenant Profile Context */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 print:bg-slate-50 print:border-slate-200">
        <div className="space-y-1">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-0.5">Prepared For</p>
          <p className="text-xl md:text-2xl font-extrabold font-serif text-[#0F172A] tracking-tight">{tenant.name}</p>
          <p className="text-xs md:text-sm text-slate-600 font-semibold">{property.address} &bull; Room {tenant.roomNumber}</p>
        </div>
        <div className="text-right flex flex-col justify-center items-end">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-0.5">Billing Period</p>
            <p className="text-sm md:text-base font-bold text-[#0F172A] uppercase tracking-wide">{month === "Current Cycle" ? (month) : month}</p>
          </div>
        </div>
      </div>

      {/* Financial Statement Section */}
      <div className="mb-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 font-mono">
          FINANCIAL BREAKDOWN
        </h4>
        <div className="space-y-3.5">
          
          {/* Base Rent Row */}
          <div className="flex justify-between items-center border-b border-slate-200/80 pb-2 print:border-slate-100 text-[#0F172A]">
            <span className="text-slate-700 font-semibold text-sm md:text-base">Rent</span>
            <span className="font-extrabold font-mono text-base md:text-lg">{formatCurrency(billing.baseRent)}</span>
          </div>

          {/* Electricity Meter Row */}
          <div className="flex justify-between items-center border-b border-slate-200/80 pb-2 print:border-slate-100 text-[#0F172A]">
            <div className="space-y-0.5">
              <span className="text-slate-700 font-semibold text-sm md:text-base">Electricity Fee</span>
              <span className="text-xs text-slate-500 font-mono block">
                Reading: {tenant.prevElecReading} to {tenant.currElecReading} ({billing.elecUnits} Units @ {formatCurrency(property.electricRate)}/U)
              </span>
            </div>
            <span className="font-extrabold font-mono text-base md:text-lg">{formatCurrency(billing.electricityCharges)}</span>
          </div>

          {/* Water Meter Row */}
          <div className="flex justify-between items-center border-b border-slate-200/80 pb-2 print:border-slate-100 text-[#0F172A]">
            <div className="space-y-0.5">
              <span className="text-slate-700 font-semibold text-sm md:text-base">Water Fee</span>
              <span className="text-xs text-slate-500 font-mono block">
                Reading: {tenant.prevWaterReading} to {tenant.currWaterReading} ({billing.waterUnits} Units @ {formatCurrency(property.waterRate)}/U)
              </span>
            </div>
            <span className="font-extrabold font-mono text-base md:text-lg">{formatCurrency(billing.waterCharges)}</span>
          </div>

          {/* Subtotal Separator */}
          <div className="flex justify-between items-center border-b-2 border-slate-300 pb-2.5 pt-1.5 text-[#0F172A] font-semibold bg-slate-100/30 px-3 py-1.5 rounded-lg">
            <span className="uppercase tracking-widest text-[10px] md:text-xs font-black text-slate-500">Current Cycle Subtotal</span>
            <span className="font-extrabold font-mono text-base md:text-lg">{formatCurrency(subTotal)}</span>
          </div>

          {/* Additional Charges (Balance Forward / Carry-overs) */}
          <div className="flex justify-between items-center border-b border-slate-200/80 pb-2 pt-0.5 text-[#0F172A]">
            <div className="space-y-0.5">
              <span className="text-slate-700 font-semibold text-sm md:text-base">Additional Charges / Arrears</span>
              {balanceForward !== 0 && (
                <span className="text-xs text-slate-500 font-mono block">
                  {balanceForward > 0 ? 'Balance Forward (Arrears)' : 'Credit Balance Forward'}: {formatCurrency(balanceForward)}
                </span>
              )}
            </div>
            <span className="font-extrabold font-mono text-base md:text-lg">
              {formatCurrency(additionalChargesTotal)}
            </span>
          </div>

          {/* Total Amount Due Block (Beautiful Highlights) */}
          <div className="flex justify-between items-center p-3 md:p-4 bg-slate-100 rounded-xl border border-slate-300 mt-6 select-none print:bg-slate-50 print:border-slate-300">
            <span className="font-sans text-sm md:text-base font-black text-[#0F172A] tracking-wider uppercase">Total Amount Due</span>
            <span className="font-black font-mono text-xl md:text-2xl text-[#0F172A] tracking-tight">{formatCurrency(billing.totalDue)}</span>
          </div>

        </div>
      </div>
    </div>
  );
};
