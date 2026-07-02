import React, { useState, useMemo } from 'react';
import { Property, Tenant, PaymentRecord } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  DollarSign, Search, Filter, Download, Trash2, CheckCircle2, 
  Calendar, CreditCard, RefreshCw, Sparkles, SlidersHorizontal, 
  AlertCircle, ArrowUpRight, TrendingUp, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PaymentsViewProps {
  tenants: Tenant[];
  properties: Property[];
  setPaymentModal: (modal: any) => void;
  updateTenant: (id: string, updates: any) => void;
  pushToUndo: () => void;
  activeMonth: string;
  downloadReceipt?: (tenant: any) => Promise<void>;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  tenants,
  properties,
  setPaymentModal,
  updateTenant,
  pushToUndo,
  activeMonth,
  downloadReceipt
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  // Compute Today's Date String in local format
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Extract all payment logs from all current tenants
  const allPayments = useMemo(() => {
    const list: Array<{
      id: string;
      tenantId: string;
      tenantName: string;
      propertyName: string;
      roomNumber: string;
      amount: number;
      date: string;
      paymentMethod: string;
      notes?: string;
      rawTenant: Tenant;
    }> = [];

    tenants.forEach(t => {
      const payments = t.payments || [];
      const prop = properties.find(p => p.id === t.propertyId);
      const propName = prop ? prop.name : 'Unknown';
      
      payments.forEach(p => {
        let dateStr = '';
        const timestamp = p.date || Date.now();
        if (typeof timestamp === 'number') {
          try {
            dateStr = new Date(timestamp).toISOString();
          } catch (e) {
            dateStr = new Date().toISOString();
          }
        } else if (typeof timestamp === 'string') {
          dateStr = timestamp;
        } else {
          dateStr = new Date().toISOString();
        }

        list.push({
          id: p.id,
          tenantId: t.id,
          tenantName: t.name,
          propertyName: propName,
          roomNumber: t.roomNumber,
          amount: p.amount,
          date: dateStr,
          paymentMethod: p.paymentMethod || 'Cash',
          notes: p.notes,
          rawTenant: t
        });
      });
    });

    // Sort
    return list.sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      } else {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }, [tenants, properties, sortBy]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let todayCollection = 0;
    let pendingPayments = 0;
    let totalCollectedThisMonth = 0;

    // Today's collections
    allPayments.forEach(p => {
      if (p.date.startsWith(todayStr)) {
        todayCollection += p.amount;
      }
    });

    // Monthly values and outstanding
    tenants.forEach(t => {
      // Sum this tenant's payments
      const payments = t.payments || [];
      payments.forEach(p => {
        totalCollectedThisMonth += p.amount;
      });

      // Calculate individual outstanding
      const p = properties.find(prop => prop.id === t.propertyId);
      const baseRent = t.manualOverrides?.baseRent !== undefined ? t.manualOverrides.baseRent : t.rent;
      const prevElec = t.prevElecReading;
      const currElec = t.currElecReading;
      const elecRate = p?.electricRate || 0;
      const elecCharges = t.manualOverrides?.electricityCharges !== undefined 
        ? t.manualOverrides.electricityCharges 
        : Math.max(0, currElec - prevElec) * elecRate;

      const prevWater = t.prevWaterReading;
      const currWater = t.currWaterReading;
      const waterRate = p?.waterRate || 0;
      const waterCharges = t.manualOverrides?.waterCharges !== undefined 
        ? t.manualOverrides.waterCharges 
        : Math.max(0, currWater - prevWater) * waterRate;

      const otherFees = t.manualOverrides?.otherFees !== undefined 
        ? t.manualOverrides.otherFees 
        : (t.expenses || []).reduce((sum, e) => sum + e.amount, 0);

      const openingBal = t.manualOverrides?.openingBalance !== undefined ? t.manualOverrides.openingBalance : t.previousDues;
      
      const totalDue = t.manualOverrides?.totalDue !== undefined 
        ? t.manualOverrides.totalDue 
        : (baseRent + elecCharges + waterCharges + otherFees + openingBal);

      const paid = t.manualOverrides?.paidAmount !== undefined ? t.manualOverrides.paidAmount : (t.paidAmount || 0);
      const remaining = Math.max(0, totalDue - paid);
      
      pendingPayments += remaining;
    });

    const collectionRatio = (totalCollectedThisMonth + pendingPayments) > 0 
      ? Math.round((totalCollectedThisMonth / (totalCollectedThisMonth + pendingPayments)) * 100) 
      : 100;

    return {
      todayCollection,
      pendingPayments,
      totalCollectedThisMonth,
      collectionRatio
    };
  }, [allPayments, tenants, properties, todayStr]);

  // Filtering Payments List
  const filteredPayments = useMemo(() => {
    return allPayments.filter(p => {
      const matchSearch = p.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchProperty = selectedPropertyId === 'all' || p.rawTenant.propertyId === selectedPropertyId;
      return matchSearch && matchProperty;
    });
  }, [allPayments, searchQuery, selectedPropertyId]);

  // Handle Refund (Deletes a specific payment record)
  const handleRefund = (paymentId: string, tenantId: string, tenantName: string, amount: number) => {
    if (confirm(`Are you sure you want to refund ${formatCurrency(amount)} to ${tenantName}? This will update outstanding dues.`)) {
      pushToUndo();
      
      const tenant = tenants.find(t => t.id === tenantId);
      if (!tenant) return;

      const currentPayments = tenant.payments || [];
      const updatedPayments = currentPayments.filter(p => p.id !== paymentId);

      // Recompute paidAmount
      const nextPaidAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

      updateTenant(tenantId, {
        payments: updatedPayments,
        paidAmount: nextPaidAmount,
        isPaid: false // set back to false as payment has been deleted/refunded
      });
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3A3] font-mono leading-none">Transaction Hub</p>
          <h2 className="text-2xl font-black text-white font-sans tracking-tight mt-1">Payments Ledger</h2>
        </div>

        <button
          onClick={() => setPaymentModal({ open: true })}
          className="px-4 py-2.5 bg-white text-slate-950 hover:bg-neutral-100 font-sans font-black text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Collect New Payment
        </button>
      </div>

      {/* 2. Top Summary KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Today's Collection</p>
          <h4 className="text-2xl font-black text-white tracking-tight mt-2 font-mono">
            {formatCurrency(stats.todayCollection)}
          </h4>
          <span className="text-[8px] uppercase font-bold text-[#A3A3A3] mt-1 block">Cleared deposits today</span>
        </div>

        <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Pending Payments</p>
          <h4 className="text-2xl font-black text-white tracking-tight mt-2 font-mono text-red-500">
            {formatCurrency(stats.pendingPayments)}
          </h4>
          <span className="text-[8px] uppercase font-bold text-red-500/80 mt-1 block">Uncollected active dues</span>
        </div>

        <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Monthly Collection</p>
          <h4 className="text-2xl font-black text-white tracking-tight mt-2 font-mono text-green-400">
            {formatCurrency(stats.totalCollectedThisMonth)}
          </h4>
          <span className="text-[8px] uppercase font-bold text-green-400/80 mt-1 block">All clearances this cycle</span>
        </div>

        {/* Collection Efficiency mini-gauge */}
        <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">
            <span>Collection Efficiency</span>
            <span className="text-green-400 font-bold">{stats.collectionRatio}%</span>
          </div>
          
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden my-2">
            <div 
              className="h-full bg-green-500 rounded-full" 
              style={{ width: `${stats.collectionRatio}%` }} 
            />
          </div>
          
          <span className="text-[8px] uppercase font-mono text-[#A3A3A3]">Cycle Month: {activeMonth}</span>
        </div>
      </div>

      {/* 3. Filtering and List block */}
      <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant or room number in ledger..."
              className="w-full bg-[#181818] border border-white/5 focus:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-sans text-white focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/10 cursor-pointer w-1/2 sm:w-auto"
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/10 cursor-pointer w-1/2 sm:w-auto"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
            </select>
          </div>
        </div>

        {/* Payments List Table representation */}
        <div className="space-y-3 pt-2">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl text-[#A3A3A3]">
              <AlertCircle className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-bold text-white">No registered payments found</p>
              <p className="text-[10px] uppercase tracking-wider mt-1">Collect rent to generate transaction records here.</p>
            </div>
          ) : (
            filteredPayments.map((p) => (
              <div 
                key={p.id} 
                className="p-4 bg-[#181818] border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-xs text-white leading-tight">{p.tenantName}</h5>
                    <span className="text-[8px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[#A3A3A3] font-mono">
                      Rm {p.roomNumber}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A3A3A3] mt-1 uppercase tracking-tight">
                    {p.propertyName} • Method: {p.paymentMethod} {p.notes ? `• "${p.notes}"` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-xs font-black text-green-400">
                      +{formatCurrency(p.amount)}
                    </span>
                    <span className="block text-[8px] font-mono text-[#A3A3A3] mt-0.5">
                      {new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {downloadReceipt && (
                      <button
                        onClick={() => downloadReceipt(p.rawTenant)}
                        className="p-1.5 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
                        title="Generate Receipt File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRefund(p.id, p.tenantId, p.tenantName, p.amount)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-lg transition-all cursor-pointer"
                      title="Issue Direct Refund / Void"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
