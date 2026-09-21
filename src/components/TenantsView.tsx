import React, { useState, useMemo } from 'react';
import { Property, Tenant, PaymentRecord } from '../types';
import { formatCurrency, getTenantBillingDetails, cn } from '../lib/utils';
import { 
  Plus, Search, Filter, Download, MoreVertical, Trash2, Edit2, 
  AlertCircle, FileText, CheckCircle2, List, Home, History, 
  Upload, Users, Undo2, Redo2, Database, Calendar, CreditCard, 
  MessageCircle, Send, ArrowDownUp, Clipboard, ChevronRight, X, 
  Check, Bell, ShieldAlert, Sparkles, SlidersHorizontal, Info, Zap, RotateCw, ArrowLeft, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EditTenantDetailsModal, EditTenantContractModal } from './Modals';

interface TenantsViewProps {
  tenants: Tenant[];
  allTenants?: Tenant[];
  properties: Property[];
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  updateTenant: (id: string, updates: any) => void;
  updateTenants?: (updates: { id: string; updates: Partial<Tenant> }[]) => void;
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
  addAuditLog?: (tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => void;
  showToast?: (msg: string, type?: any) => void;
  onNavigateToBulkReadings?: () => void;
  viewingTenantId?: string | null;
  setViewingTenantId?: (id: string | null) => void;
  onBack?: () => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  tenants,
  allTenants,
  properties,
  selectedPropertyId,
  setSelectedPropertyId,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  updateTenant,
  updateTenants,
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
  printAllReceipts,
  addAuditLog,
  showToast,
  onNavigateToBulkReadings,
  viewingTenantId: controlledViewingTenantId,
  setViewingTenantId: controlledSetViewingTenantId,
  onBack
}) => {
  const [focusedTenantId, setFocusedTenantId] = useState<string | null>(null);
  const [internalViewingTenantId, setInternalViewingTenantId] = useState<string | null>(null);
  const activeViewingTenantId = controlledViewingTenantId !== undefined ? controlledViewingTenantId : internalViewingTenantId;
  const updateViewingTenantId = (id: string | null) => {
    if (controlledSetViewingTenantId) {
      controlledSetViewingTenantId(id);
    } else {
      setInternalViewingTenantId(id);
    }
  };
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Export CSV Handler
  const handleExportCSV = () => {
    const targetList = selectedTenantIds.size > 0 
      ? filteredTenants.filter(t => selectedTenantIds.has(t.id))
      : filteredTenants;

    if (targetList.length === 0) {
      if (showToast) showToast("No tenants available to export.", "error");
      return;
    }

    const headers = [
      "Property",
      "Tenant Name",
      "Phone",
      "Room",
      "Base Rent",
      "Elec Prev Reading",
      "Elec Curr Reading",
      "Elec Units",
      "Elec Charges",
      "Water Prev Reading",
      "Water Curr Reading",
      "Water Units",
      "Water Charges",
      "Other Fees",
      "Opening Balance / Arrears",
      "Total Due",
      "Paid Amount",
      "Outstanding Balance",
      "Status"
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.map(escapeCSV).join(",") + "\n";

    targetList.forEach(t => {
      const prop = properties.find(p => p.id === t.propertyId);
      const b = prop ? getTenantBillingDetails(t, prop) : {
        baseRent: t.rent,
        elecUnits: Math.max(0, t.currElecReading - t.prevElecReading),
        electricityCharges: 0,
        waterUnits: Math.max(0, t.currWaterReading - t.prevWaterReading),
        waterCharges: 0,
        otherFees: 0,
        openingBalance: t.previousDues || 0,
        totalDue: 0,
        paidAmount: t.paidAmount || 0,
        outstandingBalance: 0
      };

      const status = b.outstandingBalance <= 0 ? "Paid" : b.paidAmount > 0 ? "Partial" : "Unpaid";

      const row = [
        prop?.name || "N/A",
        t.name,
        t.phone || "",
        t.roomNumber,
        b.baseRent,
        t.prevElecReading,
        t.currElecReading,
        b.elecUnits,
        b.electricityCharges,
        t.prevWaterReading,
        t.currWaterReading,
        b.waterUnits,
        b.waterCharges,
        b.otherFees,
        b.openingBalance,
        b.totalDue,
        b.paidAmount,
        b.outstandingBalance,
        status
      ];

      csvContent += row.map(escapeCSV).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `tenants_ledger_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (showToast) {
      showToast(`Exported CSV for ${targetList.length} tenant(s)`, "success");
    }
  };

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

  // Active viewing tenant calculations
  const viewingTenant = useMemo(() => {
    if (!activeViewingTenantId) return null;
    return tenants.find(t => t.id === activeViewingTenantId) || null;
  }, [activeViewingTenantId, tenants]);

  const viewingProperty = useMemo(() => {
    if (!viewingTenant) return null;
    return properties.find(p => p.id === viewingTenant.propertyId) || null;
  }, [viewingTenant, properties]);

  const viewingBilling = useMemo(() => {
    if (!viewingTenant || !viewingProperty) return null;
    return getTenantBillingDetails(viewingTenant, viewingProperty);
  }, [viewingTenant, viewingProperty]);

  if (viewingTenant && viewingBilling && viewingProperty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6 text-left max-w-6xl mx-auto pb-20"
      >
        {/* Top Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-3xl border border-white/10 shadow-lg">
          <button
            onClick={() => onBack ? onBack() : updateViewingTenantId(null)}
            className="px-4 py-2.5 bg-[#181818] hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            Back to Tenants
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase text-[#A3A3A3] tracking-widest hidden sm:inline">
              Tenant Profile & Dossier
            </span>
            <button
              onClick={() => setShowEditDetailsModal(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <Edit2 className="w-4 h-4" />
              Edit Tenant Details
            </button>
          </div>
        </div>

        {/* Tenant Profile Hero Card */}
        <div className="bg-[#111111] p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 text-white font-black text-xl uppercase flex items-center justify-center shrink-0 shadow-inner">
                {viewingTenant.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black text-white tracking-tight">{viewingTenant.name}</h2>
                  <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-300">
                    RM {viewingTenant.roomNumber}
                  </span>
                </div>
                <p className="text-xs text-[#A3A3A3] font-medium mt-1">
                  Property: <span className="text-white font-bold">{viewingProperty.name}</span>
                </p>
                {(viewingTenant.whatsappNumber || (viewingTenant as any).phone) && (
                  <p className="text-xs text-blue-400 font-mono font-bold mt-1">
                    Phone / WhatsApp: {viewingTenant.whatsappNumber || (viewingTenant as any).phone}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end justify-center">
              <span className="text-[10px] font-mono uppercase text-[#A3A3A3] tracking-widest mb-1">Payment Status</span>
              <span className={cn(
                "px-4 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest border",
                viewingBilling.outstandingBalance <= 0
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : viewingBilling.paidAmount > 0
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              )}>
                {viewingBilling.outstandingBalance <= 0 ? 'Fully Settled' : viewingBilling.paidAmount > 0 ? 'Partial Payment' : 'Unpaid / Arrears'}
              </span>
            </div>
          </div>

          {/* Active Balance Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#181818] p-6 rounded-2xl border border-white/5">
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase text-[#A3A3A3] tracking-widest">Active Outstanding Balance</p>
              <h3 className={cn(
                "text-3xl font-black font-mono tracking-tight",
                viewingBilling.outstandingBalance <= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {formatCurrency(viewingBilling.outstandingBalance)}
              </h3>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase text-[#A3A3A3] tracking-widest">Total Period Billing</p>
              <h3 className="text-2xl font-black font-mono text-white tracking-tight">
                {formatCurrency(viewingBilling.totalDue)}
              </h3>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase text-[#A3A3A3] tracking-widest">Total Amount Paid</p>
              <h3 className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
                {formatCurrency(viewingBilling.paidAmount)}
              </h3>
            </div>
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setPaymentModal({ open: true, tenant: viewingTenant, property: viewingProperty })}
              className="py-3 px-4 bg-white hover:bg-neutral-100 text-[#050505] font-black text-xs tracking-wider uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>

            <button
              onClick={() => shareViaWhatsApp(viewingTenant)}
              className="py-3 px-4 bg-[#181818] hover:bg-white/10 border border-white/10 text-white font-black text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-green-400" />
              Send Bill (WhatsApp)
            </button>

            {downloadReceipt && (
              <button
                onClick={() => downloadReceipt(viewingTenant)}
                disabled={processingId === viewingTenant.id}
                className="py-3 px-4 bg-[#181818] hover:bg-white/10 border border-white/10 text-white font-black text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {processingId === viewingTenant.id ? (
                  <>
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-blue-400" />
                    Download Receipt
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Itemized Breakdown & Utility Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Itemized Billing Breakdown */}
          <div className="lg:col-span-7 bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Itemized Financial Breakdown</h3>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">Complete breakdown of charges, utilities, and previous arrears</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs p-3 bg-[#181818] rounded-xl border border-white/5">
                <span className="text-[#A3A3A3]">Contract Base Rent</span>
                <span className="font-mono text-white font-bold">{formatCurrency(viewingBilling.baseRent)}</span>
              </div>

              <div className="flex justify-between items-center text-xs p-3 bg-[#181818] rounded-xl border border-white/5">
                <div>
                  <span className="text-[#A3A3A3] block font-bold">Electricity Charges</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Readings: {viewingTenant.prevElecReading} → {viewingTenant.currElecReading} ({viewingBilling.elecUnits} Units @ {formatCurrency(viewingProperty.electricRate)}/U)
                  </span>
                </div>
                <span className="font-mono text-white font-bold">{formatCurrency(viewingBilling.electricityCharges)}</span>
              </div>

              <div className="flex justify-between items-center text-xs p-3 bg-[#181818] rounded-xl border border-white/5">
                <div>
                  <span className="text-[#A3A3A3] block font-bold">Water Charges</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Readings: {viewingTenant.prevWaterReading} → {viewingTenant.currWaterReading} ({viewingBilling.waterUnits} Units @ {formatCurrency(viewingProperty.waterRate)}/U)
                  </span>
                </div>
                <span className="font-mono text-white font-bold">{formatCurrency(viewingBilling.waterCharges)}</span>
              </div>

              {viewingBilling.otherFees > 0 && (
                <div className="flex justify-between items-center text-xs p-3 bg-[#181818] rounded-xl border border-white/5">
                  <span className="text-[#A3A3A3]">Other Fees & Maintenance</span>
                  <span className="font-mono text-white font-bold">{formatCurrency(viewingBilling.otherFees)}</span>
                </div>
              )}

              {viewingBilling.openingBalance > 0 && (
                <div className="flex justify-between items-center text-xs p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 font-bold">
                  <span className="text-rose-400">Opening Arrears (Previous Balance)</span>
                  <span className="font-mono text-rose-400">{formatCurrency(viewingBilling.openingBalance)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-dashed border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-white uppercase">Total Period Billing</span>
                  <span className="font-mono text-white text-sm">{formatCurrency(viewingBilling.totalDue)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black text-emerald-400">
                  <span className="uppercase">Total Amount Paid</span>
                  <span className="font-mono text-sm">{formatCurrency(viewingBilling.paidAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black text-rose-400 pt-2 border-t border-white/5">
                  <span className="uppercase">Remaining Outstanding Balance</span>
                  <span className="font-mono text-base">{formatCurrency(viewingBilling.outstandingBalance)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Utility Analytics & Billing Timeline */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Utility Usage Meter Analytics */}
            <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Utility Meter Analytics</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5">Usage efficiency tracking for active billing cycle</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-[#A3A3A3] mb-1.5 font-medium">
                    <span>Electricity Consumption</span>
                    <span className="font-mono text-white font-bold">{viewingBilling.elecUnits} Units</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all" 
                      style={{ width: `${Math.min(100, (viewingBilling.elecUnits / 200) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#A3A3A3] mb-1.5 font-medium">
                    <span>Water Consumption Volume</span>
                    <span className="font-mono text-white font-bold">{viewingBilling.waterUnits} Units</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all" 
                      style={{ width: `${Math.min(100, (viewingBilling.waterUnits / 40) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing & Payment Timeline */}
            <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Payment & Billing Timeline</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5">Recorded transaction deposits and cash receipts</p>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {viewingTenant.payments && viewingTenant.payments.length > 0 ? (
                  viewingTenant.payments.map((pm: PaymentRecord) => (
                    <div key={pm.id} className="p-3 bg-[#181818] rounded-xl border border-white/5 flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1.5 text-white font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Settled Payment
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">{formatCurrency(pm.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-[#181818] rounded-2xl text-center text-[#A3A3A3] text-xs italic">
                    No payment deposits recorded for this cycle yet.
                  </div>
                )}
              </div>
            </div>

            {/* Contract Options / Delete */}
            <div className="bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-3">
              <button
                onClick={() => setShowEditContractModal(true)}
                className="w-full py-3 bg-[#181818] hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                Edit Tenant Contract
              </button>

              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${viewingTenant.name}'s record? This cannot be undone.`)) {
                    deleteTenant(viewingTenant.id);
                    updateViewingTenantId(null);
                  }
                }}
                className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                Purge / Delete Tenant
              </button>
            </div>

          </div>

        </div>

        <EditTenantDetailsModal
          isOpen={showEditDetailsModal}
          onClose={() => setShowEditDetailsModal(false)}
          tenant={viewingTenant}
          onUpdateTenant={(tid, updates) => {
            updateTenant(tid, updates);
            if (showToast) showToast('Tenant details updated successfully');
          }}
          showToast={showToast}
        />

        <EditTenantContractModal
          isOpen={showEditContractModal}
          onClose={() => setShowEditContractModal(false)}
          tenant={viewingTenant}
          property={viewingProperty}
          onUpdateTenant={(tid, updates) => {
            updateTenant(tid, updates);
            if (recalculateBalances) recalculateBalances();
            if (showToast) showToast('Tenant contract & billing updated successfully');
          }}
          showToast={showToast}
        />
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto pb-20">
      {/* 1. Header Area with Bulk Operations Contextual Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3A3] font-mono leading-none">Security Ledger</p>
          <h2 className="text-2xl font-black text-white font-sans tracking-tight mt-1">Tenants Ledger</h2>
        </div>

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
              <button
                onClick={handleExportCSV}
                className="px-2 py-1 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 cursor-pointer"
                title="Export selected tenants CSV"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                CSV
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Export tenants page data as CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>

          <button
            onClick={() => onNavigateToBulkReadings ? onNavigateToBulkReadings() : setBulkTableModal({ open: true })}
            className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Roll over readings and advance to next month in Bulk Readings"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            Roll Over to Next Month
          </button>

          <button
            onClick={() => onNavigateToBulkReadings ? onNavigateToBulkReadings() : setBulkTableModal({ open: true })}
            className="px-3 py-2 bg-[#111111] hover:bg-[#181818] border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Bulk Meter Readings
          </button>
        </div>
      </div>

      {/* Search & Filters */}
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

      {/* Collapsible Filters */}
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

      {/* Selection Bar */}
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

      {/* Tenants Summary List Grid */}
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
            const prop = properties.find(p => p.id === t.propertyId);
            const b = prop ? getTenantBillingDetails(t, prop) : null;
            const outstanding = b ? b.outstandingBalance : 0;
            const initials = t.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
            const isPaid = outstanding <= 0;

            return (
              <motion.div
                key={t.id}
                onClick={() => updateViewingTenantId(t.id)}
                className="p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative overflow-hidden bg-[#111111] border-white/5 hover:border-white/20 hover:bg-[#181818]"
              >
                {/* Left details slot */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => toggleSelection(t.id, e)}
                    className={cn(
                      "w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0",
                      isSelected ? "bg-white border-white text-[#050505]" : "border-white/20 hover:border-white/40"
                    )}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>

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

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end">
                    {downloadReceipt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReceipt(t);
                        }}
                        disabled={processingId === t.id}
                        className="p-1.5 bg-[#111111] hover:bg-white/10 border border-white/5 rounded-lg text-[#A3A3A3] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        title="Download Receipt"
                      >
                        {processingId === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
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

      {/* Prominent Bulk Download Section at bottom */}
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
