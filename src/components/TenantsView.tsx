import React, { useState, useMemo } from 'react';
import { Property, Tenant, PaymentRecord } from '../types';
import { formatCurrency, getTenantBillingDetails, cn } from '../lib/utils';
import { 
  Plus, Search, Filter, Download, MoreVertical, Trash2, Edit2, 
  AlertCircle, FileText, CheckCircle2, List, Home, History, 
  Upload, Users, Undo2, Redo2, Database, Calendar, CreditCard, 
  MessageCircle, Send, ArrowDownUp, Clipboard, ChevronRight, X, 
  Check, Bell, ShieldAlert, Sparkles, SlidersHorizontal, Info, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TenantsViewProps {
  tenants: Tenant[];
  properties: Property[];
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  updateTenant: (id: string, updates: any) => void;
  deleteTenant: (id: string) => void;
  setTenantModal: (modal: any) => void;
  downloadSummaryCSV: () => void;
  setBatchModal: (modal: any) => void;
  setBulkTableModal: (modal: any) => void;
  setPaymentModal: (modal: any) => void;
  selectedTenantIds: Set<string>;
  setSelectedTenantIds: (ids: Set<string>) => void;
  shareViaWhatsApp: (tenant: any) => void;
  handleBulkWhatsApp: () => void;
  isBulkSending: boolean;
  bulkProgress: { current: number; total: number };
  processingId: string | null;
  setProcessingId: (id: string | null) => void;
  onOpenProfile: (tenant: any, property: any) => void;
  activeMonth: string;
  recalculateBalances?: () => void;
  downloadReceipt?: (tenant: any) => Promise<void>;
  handleBulkDownload?: () => Promise<void>;
  printAllReceipts?: () => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  tenants,
  properties,
  selectedPropertyId,
  setSelectedPropertyId,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  updateTenant,
  deleteTenant,
  setTenantModal,
  downloadSummaryCSV,
  setBatchModal,
  setBulkTableModal,
  setPaymentModal,
  selectedTenantIds,
  setSelectedTenantIds,
  shareViaWhatsApp,
  handleBulkWhatsApp,
  isBulkSending,
  bulkProgress,
  processingId,
  setProcessingId,
  onOpenProfile,
  activeMonth,
  recalculateBalances,
  downloadReceipt,
  handleBulkDownload,
  printAllReceipts
}) => {
  const [focusedTenantId, setFocusedTenantId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter calculation count
  const filterCount = useMemo(() => {
    let count = 0;
    if (selectedPropertyId && selectedPropertyId !== 'all') count++;
    if (statusFilter && statusFilter !== 'all') count++;
    return count;
  }, [selectedPropertyId, statusFilter]);

  // Multiselect toggle helper
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedTenantIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTenantIds(next);
  };

  const toggleAll = () => {
    if (selectedTenantIds.size === filteredTenants.length) {
      setSelectedTenantIds(new Set());
    } else {
      setSelectedTenantIds(new Set(filteredTenants.map(t => t.id)));
    }
  };

  // Filter & Search computation
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchProperty = selectedPropertyId === 'all' || !selectedPropertyId || t.propertyId === selectedPropertyId;
      
      // Compute outstanding for status filtering
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
      const outstanding = totalDue - paid;
      
      let isOverdue = outstanding > 0;
      let matchesStatus = true;
      if (statusFilter === 'paid') {
        matchesStatus = !isOverdue;
      } else if (statusFilter === 'unpaid') {
        matchesStatus = isOverdue;
      }

      return matchSearch && matchProperty && matchesStatus;
    });
  }, [tenants, properties, searchQuery, selectedPropertyId, statusFilter]);

  // Set default focused tenant if none focused
  const activeTenant = useMemo(() => {
    if (focusedTenantId) {
      const found = tenants.find(t => t.id === focusedTenantId);
      if (found) return found;
    }
    return filteredTenants[0] || tenants[0] || null;
  }, [focusedTenantId, filteredTenants, tenants]);

  // Detail components calculations
  const billingDetails = useMemo(() => {
    if (!activeTenant) return null;
    const prop = properties.find(p => p.id === activeTenant.propertyId);
    if (!prop) return null;
    return getTenantBillingDetails(activeTenant, prop);
  }, [activeTenant, properties]);

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header Area with Bulk Operations Contextual Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3A3] font-mono leading-none">Security Ledger</p>
          <h2 className="text-2xl font-black text-white font-sans tracking-tight mt-1">Tenants Ledger</h2>
        </div>

        {/* Move advanced actions to top dropdown/overflow menu to prevent duplicate primary actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedTenantIds.size > 0 && (
            <div className="flex items-center bg-[#181818] border border-white/10 rounded-xl px-2.5 py-1.5 gap-2 animate-fade-in">
              <span className="text-[10px] font-mono font-black text-white">
                {selectedTenantIds.size} SELECTED
              </span>
              <button
                onClick={handleBulkWhatsApp}
                disabled={isBulkSending}
                className="px-2 py-1 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                WhatsApp
              </button>
              {handleBulkDownload && (
                <button
                  onClick={handleBulkDownload}
                  className="px-2 py-1 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  PNGs
                </button>
              )}
              {printAllReceipts && (
                <button
                  onClick={printAllReceipts}
                  className="px-2 py-1 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  Print
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setBulkTableModal({ open: true })}
            className="px-3 py-2 bg-[#111111] hover:bg-[#181818] border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Bulk Matrix Entry
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: LIST & SEARCH (8 columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Search bar + Collapse toggle */}
          <div className="bg-[#111111] p-4 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant name or room number..."
                className="w-full bg-[#181818] border border-white/5 focus:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-sans text-white placeholder-[#A3A3A3] focus:outline-none transition-colors"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-4 py-2.5 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center",
                showFilters || filterCount > 0 
                  ? "bg-white text-slate-950 border-white" 
                  : "bg-[#181818] text-[#A3A3A3] border-white/5 hover:border-white/10"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              {filterCount > 0 ? `Filters (${filterCount}) ▼` : 'Filters ▼'}
            </button>
          </div>

          {/* Collapsible Filters Section */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-[#111111] p-5 rounded-3xl border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider">Property Filter</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/10 cursor-pointer"
                    >
                      <option value="all">All Properties</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider">Status Filter</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/10 cursor-pointer"
                    >
                      <option value="all">All Ledgers</option>
                      <option value="paid">Fully Settled</option>
                      <option value="unpaid">Arrears/Overdue</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multi-select control strip */}
          <div className="flex items-center justify-between px-2 text-xs">
            <button
              onClick={toggleAll}
              className="text-[#A3A3A3] hover:text-white font-bold uppercase tracking-wider text-[10px] flex items-center gap-2 cursor-pointer"
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center",
                selectedTenantIds.size === filteredTenants.length && filteredTenants.length > 0
                  ? "bg-white border-white text-[#050505]"
                  : "border-white/20"
              )}>
                {selectedTenantIds.size === filteredTenants.length && filteredTenants.length > 0 && <Check className="w-3 h-3" />}
              </div>
              Select All Current ({filteredTenants.length})
            </button>
            <span className="text-[#A3A3A3] font-mono text-[10px] uppercase font-bold">Cycle: {activeMonth}</span>
          </div>

          {/* Tenants List Grid (Staggered fade-in) */}
          <div className="space-y-3">
            {filteredTenants.length === 0 ? (
              <div className="p-12 bg-[#111111] border border-dashed border-white/5 rounded-3xl text-center space-y-3">
                <Users className="w-10 h-10 text-[#A3A3A3] mx-auto opacity-30" />
                <h4 className="text-sm font-bold text-white">No tenants matching selection</h4>
                <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Refine your search keyword or active filters</p>
              </div>
            ) : (
              filteredTenants.map((t) => {
                const isSelected = selectedTenantIds.has(t.id);
                const isFocused = activeTenant && activeTenant.id === t.id;
                
                const prop = properties.find(p => p.id === t.propertyId);
                const baseRent = t.manualOverrides?.baseRent !== undefined ? t.manualOverrides.baseRent : t.rent;
                const prevElec = t.prevElecReading;
                const currElec = t.currElecReading;
                const elecRate = prop?.electricRate || 0;
                const elecCharges = t.manualOverrides?.electricityCharges !== undefined 
                  ? t.manualOverrides.electricityCharges 
                  : Math.max(0, currElec - prevElec) * elecRate;

                const prevWater = t.prevWaterReading;
                const currWater = t.currWaterReading;
                const waterRate = prop?.waterRate || 0;
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
                const outstanding = Math.max(0, totalDue - paid);
                
                const initials = t.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                const isPaid = outstanding <= 0;

                return (
                  <motion.div
                    key={t.id}
                    onClick={() => setFocusedTenantId(t.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative overflow-hidden",
                      isFocused 
                        ? "bg-[#181818] border-white/20 shadow-xl" 
                        : "bg-[#111111] border-white/5 hover:border-white/10 hover:bg-[#111111]/80"
                    )}
                  >
                    {/* Left details slot */}
                    <div className="flex items-center gap-3">
                      {/* Selection checkbox */}
                      <button
                        onClick={(e) => toggleSelection(t.id, e)}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0",
                          isSelected ? "bg-white border-white text-[#050505]" : "border-white/20 hover:border-white/40"
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>

                      {/* Circular Avatar */}
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white font-bold text-xs uppercase flex items-center justify-center shrink-0">
                        {initials}
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-white tracking-tight leading-tight flex items-center gap-1.5">
                          {t.name}
                          {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                        </h4>
                        <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                          Rm {t.roomNumber} • {prop?.name || 'Unknown Property'}
                        </p>
                      </div>
                    </div>

                    {/* Right outstanding block */}
                    <div className="flex flex-col sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                          isPaid ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-500"
                        )}>
                          {isPaid ? 'Settled' : 'Arrears'}
                        </span>
                        <span className={cn("text-xs font-black font-mono", isPaid ? "text-green-400" : "text-red-500")}>
                          {formatCurrency(outstanding)}
                        </span>
                      </div>

                      {/* Three primary actions: Receipt, Collect Payment, Reminder */}
                      <div className="flex items-center gap-1.5 self-end">
                        {downloadReceipt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadReceipt(t);
                            }}
                            className="p-1.5 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
                            title="Download Receipt"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModal({ 
                              open: true, 
                              tenant: t, 
                              property: properties.find(p => p.id === t.propertyId) 
                            });
                          }}
                          className="p-1.5 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
                          title="Collect Payment"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareViaWhatsApp(t);
                          }}
                          className="p-1.5 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
                          title="Send WhatsApp Reminder"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL PANE (5 columns) */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {activeTenant ? (
              <motion.div
                key={activeTenant.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6 text-left sticky top-6"
              >
                {/* Detail 1: Hero Section */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white font-sans font-black text-sm uppercase flex items-center justify-center">
                      {activeTenant.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white tracking-tight leading-tight">{activeTenant.name}</h3>
                      <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                        Rm {activeTenant.roomNumber} • {properties.find(p => p.id === activeTenant.propertyId)?.name || 'Default Property'}
                      </p>
                    </div>
                  </div>

                  <span className={cn(
                    "px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest",
                    (billingDetails?.outstanding || 0) <= 0 
                      ? "bg-green-500/10 border border-green-500/20 text-green-400" 
                      : "bg-red-500/10 border border-red-500/20 text-red-500"
                  )}>
                    {(billingDetails?.outstanding || 0) <= 0 ? 'Active Settled' : 'Arrears Active'}
                  </span>
                </div>

                {/* Detail 2: Balance Card (largest component) */}
                <div className="bg-[#181818] p-5 rounded-2xl border border-white/10 space-y-4">
                  <div>
                    <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Active Outstanding Balance</p>
                    <h4 className="text-3xl font-black text-white tracking-tight mt-1 font-mono">
                      {formatCurrency(billingDetails?.outstanding || 0)}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentModal({ 
                        open: true, 
                        tenant: activeTenant, 
                        property: properties.find(p => p.id === activeTenant.propertyId) 
                      })}
                      className="w-full py-2.5 bg-white hover:bg-neutral-100 text-[#050505] font-sans font-black text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Record Payment
                    </button>
                    
                    <button
                      onClick={() => shareViaWhatsApp(activeTenant)}
                      className="w-full py-2.5 bg-[#111111] hover:bg-white/5 border border-white/5 rounded-xl text-white font-sans font-black text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-green-400" />
                      Send Bill
                    </button>
                  </div>

                  {/* Billing Breakdown (Rent, Electricity, Water, Parking, Other) */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider mb-2">Itemized Billing Breakdown</p>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#A3A3A3]">Contract Base Rent</span>
                      <span className="font-mono text-white">{formatCurrency(billingDetails?.baseRent || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#A3A3A3]">Electricity ({billingDetails?.elecUnits || 0} Units)</span>
                      <span className="font-mono text-white">{formatCurrency(billingDetails?.elecCharges || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#A3A3A3]">Water ({billingDetails?.waterUnits || 0} Units)</span>
                      <span className="font-mono text-white">{formatCurrency(billingDetails?.waterCharges || 0)}</span>
                    </div>

                    {billingDetails?.otherFees && billingDetails?.otherFees > 0 ? (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#A3A3A3]">Other Fees / Arrears</span>
                        <span className="font-mono text-white">{formatCurrency(billingDetails?.otherFees || 0)}</span>
                      </div>
                    ) : null}

                    {billingDetails?.openingBal && billingDetails?.openingBal > 0 ? (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-red-400">Opening Arrears (Previous Dues)</span>
                        <span className="font-mono text-red-400">{formatCurrency(billingDetails?.openingBal || 0)}</span>
                      </div>
                    ) : null}

                    <div className="flex justify-between items-center text-xs border-t border-dashed border-white/5 pt-2 font-bold">
                      <span className="text-white">Total Period Billing</span>
                      <span className="font-mono text-white">{formatCurrency(billingDetails?.totalDue || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold text-green-400">
                      <span>Total Paid Amount</span>
                      <span className="font-mono">{formatCurrency(billingDetails?.paid || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Detail 3: Usage Section (minimal progress bars) */}
                <div className="space-y-3">
                  <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Utility Usage Meter Analytics</p>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-[#A3A3A3] mb-1">
                        <span>Electricity Usage Efficiency</span>
                        <span className="font-mono text-white">{billingDetails?.elecUnits || 0} Units</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ width: `${Math.min(100, ((billingDetails?.elecUnits || 0) / 200) * 100)}%` }} 
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-[#A3A3A3] mb-1">
                        <span>Water Intake Volume</span>
                        <span className="font-mono text-white">{billingDetails?.waterUnits || 0} Units</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${Math.min(100, ((billingDetails?.waterUnits || 0) / 40) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail 4: Timeline & History logs */}
                <div className="space-y-3">
                  <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest">Billing & Payment Timeline</p>
                  <div className="p-3 bg-[#181818] rounded-xl border border-white/5 space-y-2 max-h-36 overflow-y-auto">
                    {activeTenant.payments && activeTenant.payments.length > 0 ? (
                      activeTenant.payments.map((pm: PaymentRecord) => (
                        <div key={pm.id} className="flex justify-between items-center text-[10px] text-[#A3A3A3] border-b border-white/5 pb-1">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Settled cash receipt</span>
                          <span className="font-mono text-white">{formatCurrency(pm.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-[#A3A3A3] italic">No transaction deposits recorded for this cycle.</p>
                    )}
                  </div>
                </div>

                {/* Detail 5: Export & Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => onOpenProfile(activeTenant, properties.find(p => p.id === activeTenant.propertyId))}
                    className="py-2.5 bg-[#181818] hover:bg-white/[0.05] border border-white/5 text-[#A3A3A3] hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Tenant Contract
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to terminate ${activeTenant.name}'s signature contract? This will purge active logs.`)) {
                        deleteTenant(activeTenant.id);
                        setFocusedTenantId(null);
                      }
                    }}
                    className="py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Purge Contract
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#111111] p-12 rounded-3xl border border-white/5 text-center text-[#A3A3A3] space-y-2 sticky top-6">
                <SlidersHorizontal className="w-8 h-8 mx-auto opacity-30" />
                <h4 className="text-xs font-bold text-white uppercase tracking-widest">No Selection Focus</h4>
                <p className="text-[10px] uppercase tracking-wider">Select a ledger node on the left list to open interactive detail panel</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Prominent Bulk Download Section at the end of the page */}
      {handleBulkDownload && (
        <div className="mt-8 bg-[#111111] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
          <div>
            <h4 className="font-bold text-sm text-white uppercase tracking-wider">All-in-One Receipt Backup</h4>
            <p className="text-[10px] text-[#A3A3A3] mt-1 uppercase tracking-wide">Snapshot and download all tenant rent receipts as PNG images in a single ZIP file</p>
          </div>
          <button
            onClick={handleBulkDownload}
            className="w-full md:w-auto px-6 py-3 bg-white hover:bg-white/90 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download All Receipts
          </button>
        </div>
      )}
    </div>
  );
};
