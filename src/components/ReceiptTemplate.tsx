import React from 'react';
import { Property, Tenant } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import NepaliDate from 'nepali-date-converter';

interface ReceiptTemplateProps {
  property: Property;
  tenant: Tenant;
  month: string;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ property, tenant, month }) => {
  const elecUnits = Math.max(0, tenant.currElecReading - tenant.prevElecReading);
  const waterUnits = Math.max(0, tenant.currWaterReading - tenant.prevWaterReading);
  
  const elecAmount = elecUnits * property.electricRate;
  const waterAmount = waterUnits * property.waterRate;
  
  const totalExtra = tenant.expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const totalDue = tenant.rent + elecAmount + waterAmount + totalExtra + tenant.previousDues;

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

  // Due date (exactly 10 days after payment generation date - like April 24 -> May 4)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);
  const dueDateStr = formatDate(dueDate);

  return (
    <div 
      id={`receipt-${tenant.id}`}
      className="w-[800px] p-2 relative overflow-hidden"
      style={{ 
        fontFamily: '"Inter", sans-serif',
        backgroundColor: '#020617', // slate-950
        color: '#ffffff'
      }}
    >
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px]" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[80px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }} />

      <div className="relative border rounded-[3rem] overflow-hidden shadow-2xl" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(40px)' }}>
        
        {/* Brand Header Block (top rounded) */}
        <div 
          className="p-10 border-b text-center relative" 
          style={{ 
            borderColor: 'rgba(255,255,255,0.1)', 
            backgroundColor: 'rgba(255,255,255,0.03)',
            backgroundImage: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.1), rgba(0,0,0,0.2))'
          }}
        >
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase mb-1" style={{ color: '#64748b' }}>
            {receiptId}
          </p>
          <h2 className="text-4xl font-extrabold tracking-widest uppercase mb-3" style={{ color: '#ffffff' }}>
            {tenant.name}
          </h2>
          <p className="text-xs font-semibold tracking-wide text-slate-400">
            {englishDateStr} • {nepaliDateStr}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-10 space-y-8">
          
          {/* Property Info Badge */}
          <div className="flex justify-between items-center bg-white/[0.01] border border-white/5 rounded-2xl px-5 py-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Property Origin</span>
            <span className="text-slate-300 font-medium">{property.name} &bull; Room #{tenant.roomNumber}</span>
          </div>

          {/* Charges Section Grid (vertically stacked columns, left-aligned) */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              {/* Row 1, Col 1: Base Rent */}
              <div className="flex justify-between items-baseline border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-slate-400 font-medium text-sm">Base Rent</span>
                <span className="font-bold text-white text-lg font-mono">{formatCurrency(tenant.rent)}</span>
              </div>

              {/* Row 1, Col 2: Maintenance */}
              <div className="flex justify-between items-baseline border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-slate-400 font-medium text-sm">Maintenance</span>
                <span className="font-bold text-white text-lg font-mono">{formatCurrency(totalExtra)}</span>
              </div>

              {/* Row 2, Col 1: Electricity with sub-line */}
              <div className="flex justify-between items-baseline border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <span className="text-slate-400 font-medium text-sm block">Electricity</span>
                  <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                    {elecUnits} U x {formatCurrency(property.electricRate)}/U
                  </span>
                </div>
                <span className="font-bold text-white text-lg font-mono">{formatCurrency(elecAmount)}</span>
              </div>

              {/* Row 2, Col 2: Water with sub-line */}
              <div className="flex justify-between items-baseline border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <span className="text-slate-400 font-medium text-sm block">Water</span>
                  <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                    {waterUnits} U x {formatCurrency(property.waterRate)}/U
                  </span>
                </div>
                <span className="font-bold text-white text-lg font-mono">{formatCurrency(waterAmount)}</span>
              </div>
            </div>

            {/* Row 3: Previous Dues */}
            <div className="flex justify-between items-baseline pt-2 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-slate-400 font-medium text-sm">Previous Dues</span>
              <span className="font-bold text-white text-lg font-mono">{formatCurrency(tenant.previousDues)}</span>
            </div>
          </div>

          {/* METER DETAIL INSIGHT (Clear column headers and value alignment) */}
          <div className="rounded-3xl border p-6 bg-white/[0.01]" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-4 text-slate-500">
              Meter Detail Insight
            </p>
            
            <div className="grid grid-cols-4 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 pb-2 border-b border-white/5 mb-3">
              <div>Category</div>
              <div className="text-right">Previous</div>
              <div className="text-right">Current</div>
              <div className="text-right">Units</div>
            </div>
            
            <div className="space-y-4">
              {/* Electricity Meter Row */}
              <div className="grid grid-cols-4 text-sm items-center">
                <div className="font-semibold text-white">Electricity</div>
                <div className="text-right font-mono text-slate-400">{tenant.prevElecReading}</div>
                <div className="text-right font-mono text-slate-400">{tenant.currElecReading}</div>
                <div className="text-right font-mono font-bold text-blue-400">{elecUnits}</div>
              </div>
              
              {/* Water Meter Row */}
              <div className="grid grid-cols-4 text-sm items-center">
                <div className="font-semibold text-white">Water</div>
                <div className="text-right font-mono text-slate-400">{tenant.prevWaterReading}</div>
                <div className="text-right font-mono text-slate-400">{tenant.currWaterReading}</div>
                <div className="text-right font-mono font-bold text-blue-400">{waterUnits}</div>
              </div>
            </div>
          </div>

          {/* Net Amount Due & Due By Section (Prominent, matching layout) */}
          <div 
            className="rounded-3xl border p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6" 
            style={{ 
              borderColor: 'rgba(59, 130, 246, 0.2)', 
              backgroundColor: 'rgba(37, 99, 235, 0.05)' 
            }}
          >
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-blue-400 mb-1">
                Net Amount Due
              </p>
              <p className="text-4xl font-black font-mono text-white tracking-tight">
                {formatCurrency(Math.max(0, totalDue - (tenant.paidAmount || 0)))}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-1">
                Due By
              </p>
              <p className="text-lg font-black text-white uppercase tracking-wider">
                {dueDateStr}
              </p>
            </div>
          </div>

        </div>

        {/* Footer (Scan to Pay left, secure info right) */}
        <div 
          className="px-10 py-8 border-t flex flex-col sm:flex-row justify-between items-center gap-6" 
          style={{ 
            borderColor: 'rgba(255,255,255,0.05)', 
            backgroundColor: 'rgba(255,255,255,0.01)' 
          }}
        >
          <div className="flex flex-col items-center sm:items-start gap-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
              Scan To Pay
            </span>
            {property.qrCodeDataUrl ? (
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl transition-all" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }} />
                <img 
                  src={property.qrCodeDataUrl} 
                  alt="PaymentQR" 
                  className="relative w-28 h-28 bg-white p-2 rounded-2xl border" 
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }} 
                />
              </div>
            ) : (
              <div className="w-28 h-28 border-2 border-dashed rounded-2xl flex items-center justify-center italic text-[9px] text-center p-3" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#475569' }}>
                QR PORTAL<br/>NOT CONFIGURED
              </div>
            )}
          </div>
          
          <div className="text-center sm:text-right space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Secured Digital Receipt
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
              System Generated
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
