import React from 'react';
import { Property, Tenant } from '../types';
import { getTenantBillingDetails, formatDate } from '../lib/utils';
import NepaliDate from 'nepali-date-converter';

interface ReceiptTemplateProps {
  property: Property;
  tenant: Tenant;
  month?: string;
}

// Custom precise Rupee formatting helper to guarantee exact match: ₹22,000.00
export function formatRupee(amount: number): string {
  const val = Math.abs(amount || 0);
  const formatted = val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (amount < 0 ? '-₹' : '₹') + formatted;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ property, tenant, month = 'CURRENT CYCLE' }) => {
  const billing = getTenantBillingDetails(tenant, property);

  const today = new Date();
  let nepaliDateStr = '';
  try {
    nepaliDateStr = new NepaliDate(today).format('YYYY-MM-DD');
  } catch {
    nepaliDateStr = '2083-03-06';
  }
  const englishDateStr = formatDate(today);

  // Deterministic 5-digit Invoice Number helper
  const getReceiptId = (tenantId: string, monthName: string) => {
    let hash = 0;
    const str = tenantId + (monthName || 'cycle');
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 90000) + 10000;
  };
  const receiptId = getReceiptId(tenant.id, month);

  // Subtotal = Base Rent + Electricity + Water + Other Fees
  const currentSubtotal = billing.baseRent + billing.electricityCharges + billing.waterCharges + billing.otherFees;
  
  // Arrears / Balance forward / Additional Charges
  const additionalCharges = billing.openingBalance;

  // Total Amount Due
  const totalAmountDue = billing.totalDue;

  // Building & Room formatting
  const buildingRoomText = `${property.name || 'Building 1'} • Room ${tenant.roomNumber || 'R1'}`;

  // Billing period display text
  const billingPeriodText = (month && month !== 'Current Cycle' && month !== 'CURRENT CYCLE') 
    ? month.toUpperCase() 
    : 'CURRENT CYCLE';

  return (
    <div 
      id={`receipt-${tenant.id}`}
      className="receipt-card w-[640px] max-w-full mx-auto p-7 sm:p-8 bg-white text-[#0F172A] rounded-[24px] shadow-sm border border-slate-200/80 font-sans select-none print:shadow-none print:border-slate-300 print:bg-white box-border"
      style={{ 
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* 1. HEADER ROW: STATEMENT title, ID, Date of Issue */}
      <div className="flex justify-between items-start pb-5 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-[0.08em] text-[#0F172A] uppercase leading-none">
            STATEMENT
          </h1>
          <p className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase mt-2">
            ID: #{receiptId}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">
            DATE OF ISSUE
          </p>
          <p className="text-xs sm:text-sm font-mono font-semibold text-slate-700">
            {englishDateStr} {nepaliDateStr ? `• BS ${nepaliDateStr}` : ''}
          </p>
        </div>
      </div>

      {/* 2. PREPARED FOR & BILLING PERIOD CARD */}
      <div className="my-6 p-5 sm:p-6 bg-[#F8FAFC] rounded-2xl border border-slate-200/60 grid grid-cols-2 gap-4 items-center">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            PREPARED FOR
          </p>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#0F172A] tracking-tight leading-tight">
            {tenant.name}
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            {buildingRoomText}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            BILLING PERIOD
          </p>
          <p className="text-xs sm:text-sm font-mono font-extrabold text-[#0F172A] uppercase tracking-wider">
            {billingPeriodText}
          </p>
        </div>
      </div>

      {/* 3. FINANCIAL BREAKDOWN */}
      <div className="mt-6">
        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-4">
          FINANCIAL BREAKDOWN
        </p>

        <div className="space-y-4">
          {/* Rent Row */}
          <div className="flex justify-between items-center pb-3.5 border-b border-slate-200/70">
            <span className="font-bold text-[#0F172A] text-sm sm:text-base">Rent</span>
            <span className="font-extrabold font-mono text-[#0F172A] text-sm sm:text-base">
              {formatRupee(billing.baseRent)}
            </span>
          </div>

          {/* Electricity Fee Row */}
          <div className="flex justify-between items-start pb-3.5 border-b border-slate-200/70">
            <div className="space-y-0.5">
              <span className="font-bold text-[#0F172A] text-sm sm:text-base block">Electricity Fee</span>
              <span className="text-xs font-mono text-slate-500 block">
                Reading: {tenant.prevElecReading} to {tenant.currElecReading} ({billing.elecUnits} Units @ {formatRupee(property.electricRate)}/U)
              </span>
            </div>
            <span className="font-extrabold font-mono text-[#0F172A] text-sm sm:text-base pt-0.5">
              {formatRupee(billing.electricityCharges)}
            </span>
          </div>

          {/* Water Fee Row */}
          <div className="flex justify-between items-start pb-3.5 border-b border-slate-200/70">
            <div className="space-y-0.5">
              <span className="font-bold text-[#0F172A] text-sm sm:text-base block">Water Fee</span>
              <span className="text-xs font-mono text-slate-500 block">
                Reading: {tenant.prevWaterReading} to {tenant.currWaterReading} ({billing.waterUnits} Units @ {formatRupee(property.waterRate)}/U)
              </span>
            </div>
            <span className="font-extrabold font-mono text-[#0F172A] text-sm sm:text-base pt-0.5">
              {formatRupee(billing.waterCharges)}
            </span>
          </div>

          {/* Optional Other Fees (if present) */}
          {billing.otherFees > 0 && (
            <div className="flex justify-between items-center pb-3.5 border-b border-slate-200/70">
              <span className="font-bold text-[#0F172A] text-sm sm:text-base">Maintenance / Service Fee</span>
              <span className="font-extrabold font-mono text-[#0F172A] text-sm sm:text-base">
                {formatRupee(billing.otherFees)}
              </span>
            </div>
          )}

          {/* 4. CURRENT CYCLE SUBTOTAL CARD */}
          <div className="my-4 p-3.5 sm:p-4 bg-[#F8FAFC] rounded-xl border border-slate-200/60 flex justify-between items-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
              CURRENT CYCLE SUBTOTAL
            </span>
            <span className="font-black font-mono text-base sm:text-lg text-[#0F172A]">
              {formatRupee(currentSubtotal)}
            </span>
          </div>

          {/* 5. ADDITIONAL CHARGES / ARREARS */}
          <div className="flex justify-between items-center py-2.5 border-b border-slate-200/70">
            <span className="font-bold text-[#0F172A] text-sm sm:text-base">
              Additional Charges / Arrears
            </span>
            <span className="font-extrabold font-mono text-[#0F172A] text-sm sm:text-base">
              {formatRupee(additionalCharges)}
            </span>
          </div>

          {/* 6. TOTAL AMOUNT DUE HIGHLIGHT BOX */}
          <div className="mt-5 p-4 sm:p-5 bg-[#EDF2F7] rounded-2xl border border-slate-200 flex justify-between items-center">
            <span className="font-black font-mono text-xs sm:text-sm uppercase tracking-wider text-[#0F172A]">
              TOTAL AMOUNT DUE
            </span>
            <span className="font-black font-mono text-lg sm:text-xl text-[#0F172A]">
              {formatRupee(totalAmountDue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

