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
  const nepaliDateStr = new NepaliDate(today).format('YYYY/MM/DD');
  const englishDateStr = formatDate(today);

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
      {/* Background Accents for the Image */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px]" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[80px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }} />

      <div className="relative border rounded-[3rem] overflow-hidden shadow-2xl" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(40px)' }}>
        {/* Brand Header */}
        <div className="p-10 border-b flex justify-between items-start" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#64748b' }}>Billing Period</p>
            <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#ffffff' }}>{month}</h2>
            <p className="text-[11px] font-mono" style={{ color: '#64748b' }}>
              AD: {englishDateStr} | BS: {nepaliDateStr}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#64748b' }}>Recipient Details</p>
            <h3 className="text-3xl font-bold mb-1" style={{ color: '#ffffff' }}>{tenant.name}</h3>
            <p className="text-lg uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Room #{tenant.roomNumber}</p>
          </div>
        </div>

        <div className="px-10 py-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#64748b' }}>Property Origin</p>
            <h3 className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>{property.name}</h3>
            <p className="text-base leading-relaxed max-w-[500px] italic" style={{ color: '#64748b' }}>
              {property.address}
            </p>
          </div>
        </div>

        <div className="px-10 pb-10">
          <div className="rounded-3xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.2em] font-black border-b" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b', borderColor: 'rgba(255,255,255,0.05)' }}>
                  <th className="px-8 py-6">Line Item</th>
                  <th className="px-8 py-6 text-right">Metric</th>
                  <th className="px-8 py-6 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <tr className="group text-lg">
                  <td className="px-8 py-6">
                    <p className="font-bold tracking-wide" style={{ color: '#ffffff' }}>Base Rental</p>
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-sm" style={{ color: '#64748b' }}>-</td>
                  <td className="px-8 py-6 text-right font-mono font-bold" style={{ color: '#ffffff' }}>{formatCurrency(tenant.rent)}</td>
                </tr>
                <tr className="group text-lg">
                  <td className="px-8 py-6">
                    <p className="font-bold tracking-wide" style={{ color: '#ffffff' }}>Electric Utility</p>
                    <p className="text-[14px] mt-1 uppercase tracking-tight font-black" style={{ color: '#94a3b8' }}>{tenant.currElecReading} – {tenant.prevElecReading} UNITS</p>
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-sm" style={{ color: '#64748b' }}>@{formatCurrency(property.electricRate)}</td>
                  <td className="px-8 py-6 text-right font-mono font-bold" style={{ color: '#ffffff' }}>{formatCurrency(elecAmount)}</td>
                </tr>
                <tr className="group text-lg">
                  <td className="px-8 py-6">
                    <p className="font-bold tracking-wide" style={{ color: '#ffffff' }}>Water Consumption</p>
                    <p className="text-[14px] mt-1 uppercase tracking-tight font-black" style={{ color: '#94a3b8' }}>{tenant.currWaterReading} – {tenant.prevWaterReading} UNITS</p>
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-sm" style={{ color: '#64748b' }}>@{formatCurrency(property.waterRate)}</td>
                  <td className="px-8 py-6 text-right font-mono font-bold" style={{ color: '#ffffff' }}>{formatCurrency(waterAmount)}</td>
                </tr>
                {tenant.expenses.map((exp) => (
                  <tr key={exp.id} className="group text-lg">
                    <td className="px-8 py-6">
                      <p className="font-bold tracking-wide" style={{ color: '#ffffff' }}>{exp.name}</p>
                    </td>
                    <td className="px-8 py-6 text-right font-mono text-sm" style={{ color: '#64748b' }}>-</td>
                    <td className="px-8 py-6 text-right font-mono font-bold" style={{ color: '#ffffff' }}>{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
                {tenant.previousDues > 0 && (
                  <tr className="text-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                    <td className="px-8 py-6">
                      <p className="font-bold tracking-wide" style={{ color: '#f87171' }}>Arrears / Previous Dues</p>
                    </td>
                    <td className="px-8 py-6 text-right font-mono text-sm" style={{ color: '#fca5a5' }}>Accumulated</td>
                    <td className="px-8 py-6 text-right font-mono font-bold" style={{ color: '#f87171' }}>{formatCurrency(tenant.previousDues)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                  <td className="px-8 py-8 font-black text-3xl uppercase tracking-tighter" style={{ color: '#ffffff' }} colSpan={2}>Aggregate Payable</td>
                  <td className="px-8 py-8 text-right font-mono font-black text-5xl shadow-[0_0_20px_rgba(37,99,235,0.2)]" style={{ color: '#60a5fa' }}>
                    {formatCurrency(totalDue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="px-12 py-10 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <div className="flex items-center gap-8">
            <div>
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: '#64748b' }}>Official Payment Portal</p>
               {property.qrCodeDataUrl ? (
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-2xl blur-xl transition-all" style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)' }} />
                    <img src={property.qrCodeDataUrl} alt="PaymentQR" className="relative w-36 h-36 bg-white p-3 rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  </div>
               ) : (
                 <div className="w-36 h-36 border-2 border-dashed rounded-2xl flex items-center justify-center italic text-[10px] text-center p-4" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#475569' }}>
                    QR PORTAL<br/>NOT CONFIGURED
                 </div>
               )}
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: '#334155' }}>
               Artha Billing System
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
