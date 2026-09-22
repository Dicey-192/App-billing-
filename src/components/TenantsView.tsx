import React, { useState, useMemo } from 'react';
import { Property, Tenant, PaymentRecord } from '../types';
import { formatCurrency, getTenantBillingDetails, cn } from '../lib/utils';
import { 
  Plus, Search, Filter, Download, MoreVertical, Trash2, Edit2, 
  AlertCircle, FileText, CheckCircle2, List, Home, History, 
  Upload, Users, Undo2, Redo2, Database, Calendar, CreditCard, 
  MessageCircle, Send, ArrowDownUp, Clipboard, ChevronRight, X, 
  Check, Bell, ShieldAlert, Sparkles, SlidersHorizontal, Info, Zap, RotateCw, ArrowLeft, Loader2,
  HelpCircle, Archive
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
  rolloverPrompt?: { open: boolean; month: string };
  setRolloverPrompt?: (p: { open: boolean; month: string }) => void;
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
  calendarSystem?: string;
  pushToUndo?: () => void;
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
  onBack,
  rolloverPrompt,
  setRolloverPrompt
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
  const [quickFilter, setQuickFilter] = useState<'all' | 'overdue' | 'paid' | 'high_arrears' | 'this_cycle'>('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

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

  // Quick chips count computation
  const quickChipCounts = useMemo(() => {
    let overdue = 0;
    let paid = 0;
    let highArrears = 0;

    tenants.forEach(t => {
      const p = properties.find(prop => prop.id === t.propertyId);
      const b = p ? getTenantBillingDetails(t, p) : null;
      const outstanding = b ? b.outstandingBalance : (t.rent - (t.paidAmount || 0));
      if (outstanding > 0) overdue++;
      if (outstanding <= 0) paid++;
      if (outstanding >= 5000 || (t.rent > 0 && outstanding > t.rent)) highArrears++;
    });

    return {
      all: tenants.length,
      overdue,
      paid,
      highArrears,
      thisCycle: tenants.length
    };
  }, [tenants, properties]);

  const quickChips: { id: 'all' | 'overdue' | 'paid' | 'high_arrears' | 'this_cycle'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: quickChipCounts.all },
    { id: 'overdue', label: 'Overdue', count: quickChipCounts.overdue },
    { id: 'paid', label: 'Paid', count: quickChipCounts.paid },
    { id: 'high_arrears', label: 'High Arrears', count: quickChipCounts.highArrears },
    { id: 'this_cycle', label: 'This Cycle', count: quickChipCounts.thisCycle },
  ];

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
      
      const isOverdue = outstanding > 0;
      const isHighArrears = outstanding >= 5000 || (t.rent > 0 && outstanding > t.rent);

      let matchesStatus = true;
      if (statusFilter === 'paid') {
        matchesStatus = !isOverdue;
      } else if (statusFilter === 'unpaid') {
        matchesStatus = isOverdue;
      }

      let matchesQuick = true;
      if (quickFilter === 'overdue') {
        matchesQuick = isOverdue;
      } else if (quickFilter === 'paid') {
        matchesQuick = !isOverdue;
      } else if (quickFilter === 'high_arrears') {
        matchesQuick = isHighArrears;
      } else if (quickFilter === 'this_cycle') {
        matchesQuick = true;
      }

      return matchSearch && matchProperty && matchesStatus && matchesQuick;
    });
  }, [tenants, properties, searchQuery, selectedPropertyId, statusFilter, quickFilter]);

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
    <div className="space-y-6 text-left max-w-6xl mx-auto pb-36 sm:pb-40">
      {/* 1. Clean Header */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Tenants Ledger</h1>
        </div>

        {/* Right: Single Notification Bell only */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-xl bg-[#181818] hover:bg-white/10 border border-white/10 text-[#A3A3A3] hover:text-white flex items-center justify-center transition-all cursor-pointer relative"
            title="Alerts & Notifications"
            aria-label="Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {quickChipCounts.overdue > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          {/* Notifications dropdown popover */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute right-0 top-12 w-72 bg-[#181818] border border-white/10 rounded-2xl p-4 shadow-2xl z-30 space-y-3 text-left"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-black uppercase text-white tracking-wider">Ledger Alerts</span>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-[#A3A3A3] hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {quickChipCounts.overdue > 0 ? (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        {quickChipCounts.overdue} Overdue Accounts
                      </p>
                      <p className="text-[10px] text-red-300/80 mt-1">
                        Tenants with outstanding dues in cycle {activeMonth || 'active'}.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        All Accounts Settled
                      </p>
                      <p className="text-[10px] text-emerald-300/80 mt-1">
                        Zero overdue balances recorded for this cycle.
                      </p>
                    </div>
                  )}
                  <div className="text-[10px] text-[#A3A3A3] pt-1">
                    Active Cycle: <span className="font-mono text-white font-bold">{activeMonth || 'Current'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. Action Toolbar (single horizontal row: 38px filled primary + 38px square outline icon buttons) */}
      <div className="flex items-center gap-2">
        {/* Bulk Meter Readings (primary filled button, 38px height) */}
        <button
          onClick={() => onNavigateToBulkReadings ? onNavigateToBulkReadings() : setBulkTableModal({ open: true })}
          className="h-[38px] flex-1 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] truncate"
          title="Bulk Meter Readings"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span className="truncate">Bulk Meter Readings</span>
        </button>

        {/* Export CSV (secondary 38px square outline icon button) */}
        <button
          onClick={handleExportCSV}
          className="w-[38px] h-[38px] bg-[#181818] hover:bg-white/10 border border-[#2C2C2E] text-[#A1A1AA] hover:text-white rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.98]"
          title="Export CSV"
          aria-label="Export CSV"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Roll Over to Next Month (secondary 38px square outline icon button) */}
        <button
          onClick={() => {
            if (setRolloverPrompt) {
              setRolloverPrompt({ open: true, month: activeMonth });
            } else if (onNavigateToBulkReadings) {
              onNavigateToBulkReadings();
            } else if (setBulkTableModal) {
              setBulkTableModal({ open: true });
            }
          }}
          className="w-[38px] h-[38px] bg-[#181818] hover:bg-white/10 border border-[#2C2C2E] text-amber-400 hover:text-amber-300 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.98]"
          title="Roll Over to Next Month"
          aria-label="Roll Over to Next Month"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Search Bar: 40px height positioned immediately below toolbar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tenant name or room number…"
          className="w-full h-10 bg-[#111111] border border-[#2C2C2E] focus:border-white/30 rounded-xl pl-10 pr-9 text-xs font-sans text-white placeholder-[#A1A1AA] focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 4. Quick Filter Chips (32px height, 12px horizontal padding, high contrast) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {quickChips.map((chip) => {
          const isActive = quickFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setQuickFilter(chip.id)}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border",
                isActive
                  ? "bg-white text-slate-950 border-white shadow-sm font-bold"
                  : "bg-[#181818] border-[#2C2C2E] text-[#A1A1AA] hover:text-white hover:border-white/20"
              )}
            >
              <span>{chip.label}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                isActive ? "bg-slate-900/15 text-slate-950 font-bold" : "bg-white/5 text-[#A1A1AA]"
              )}>
                {chip.count}
              </span>
            </button>
          );
        })}

        {properties.length > 1 && (
          <div className="relative shrink-0">
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="h-8 px-3 rounded-full text-xs font-semibold bg-[#181818] border border-[#2C2C2E] text-[#A1A1AA] hover:text-white hover:border-white/20 focus:outline-none cursor-pointer appearance-none pr-7"
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 text-[#A1A1AA] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
          </div>
        )}
      </div>

      {/* 5. Select & Cycle Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs">
          {/* Left: Checkbox + “Select All Current (X)” */}
          <button
            onClick={toggleAll}
            className="text-[#A3A3A3] hover:text-white font-bold uppercase tracking-wider text-xs flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              selectedTenantIds.size === filteredTenants.length && filteredTenants.length > 0
                ? "bg-white border-white text-slate-950"
                : "border-white/20 bg-[#181818]"
            )}>
              {selectedTenantIds.size === filteredTenants.length && filteredTenants.length > 0 && (
                <Check className="w-3 h-3 stroke-[3]" />
              )}
            </div>
            <span>Select All Current ({filteredTenants.length})</span>
          </button>

          {/* Right: Current Cycle badge (e.g. BS-2083-07) */}
          <div className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl font-mono text-xs font-bold text-slate-300 flex items-center gap-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeMonth || 'BS-2083-07'}</span>
          </div>
        </div>

        {/* Contextual batch bar when multiple tenants selected */}
        {selectedTenantIds.size > 0 && (
          <div className="p-3 bg-[#181818] border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
            <span className="text-xs font-mono font-black text-white">
              {selectedTenantIds.size} TENANT{selectedTenantIds.size > 1 ? 'S' : ''} SELECTED
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkWhatsApp}
                disabled={isBulkSending}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                WhatsApp
              </button>
              {handleBulkDownload && (
                <button
                  onClick={handleBulkDownload}
                  className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  PNG Receipts
                </button>
              )}
              {printAllReceipts && (
                <button
                  onClick={printAllReceipts}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  Print
                </button>
              )}
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Tenant Cards (main content) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {filteredTenants.length === 0 ? (
          <div className="col-span-full p-12 bg-[#111111] border border-dashed border-white/5 rounded-3xl text-center space-y-3">
            <Users className="w-10 h-10 text-[#A3A3A3] mx-auto opacity-30" />
            <h4 className="text-sm font-bold text-white">No tenants matching criteria</h4>
            <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Try refining your search keyword or selecting a different quick filter chip</p>
          </div>
        ) : (
          filteredTenants.map((t) => {
            const isSelected = selectedTenantIds.has(t.id);
            const prop = properties.find(p => p.id === t.propertyId);
            const b = prop ? getTenantBillingDetails(t, prop) : {
              baseRent: t.rent,
              totalDue: t.rent,
              paidAmount: t.paidAmount || 0,
              outstandingBalance: Math.max(0, t.rent - (t.paidAmount || 0)),
              isPaid: (t.paidAmount || 0) >= t.rent
            };
            const outstanding = b.outstandingBalance;
            const paidAmount = b.paidAmount || 0;
            const totalDue = b.totalDue || 1;
            const isPaid = outstanding <= 0;
            const isPartial = !isPaid && paidAmount > 0;
            const isOverdue = !isPaid && paidAmount === 0;
            const isHighArrears = outstanding >= 5000 || (t.rent > 0 && outstanding > t.rent);
            const initials = t.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

            // Progress bar calculations
            const progressPercent = Math.min(100, Math.max(0, Math.round((paidAmount / totalDue) * 100)));

            return (
              <div
                key={t.id}
                onClick={() => updateViewingTenantId(t.id)}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border border-l-4 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group relative bg-[#111111] hover:bg-[#151515]",
                  isPaid 
                    ? "border-l-emerald-500" 
                    : isHighArrears 
                    ? "border-l-red-500" 
                    : isPartial 
                    ? "border-l-amber-500" 
                    : "border-l-red-500",
                  isSelected ? "border-white/30 bg-[#161616]" : "border-[#2C2C2E] hover:border-white/20"
                )}
              >
                {/* Top details block */}
                <div className="flex items-start justify-between gap-3">
                  {/* Left side: Avatar circle + Tenant Name (16px Bold) + Room number */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-white font-bold text-sm uppercase flex items-center justify-center shrink-0 shadow-inner">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Tenant Name: 16px Bold */}
                        <h4 className="font-bold text-base text-white tracking-tight truncate">
                          {t.name}
                        </h4>
                        {/* Status badge: rounded tag, High Arrears has #3F1212 fill and #EF4444 text */}
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0",
                          isPaid 
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            : isHighArrears
                            ? "bg-[#3F1212] border-[#EF4444]/30 text-[#EF4444]"
                            : isPartial
                            ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                            : "bg-[#3F1212] border-[#EF4444]/30 text-[#EF4444]"
                        )}>
                          {isPaid ? "Paid" : isHighArrears ? "High Arrears" : isPartial ? "Partial" : "Overdue"}
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                        Room #{t.roomNumber} • {prop?.name || 'Main Property'}
                      </p>
                    </div>
                  </div>

                  {/* Right side: 18px Bold Arrears amount + 12px Regular off-white (#9CA3AF) label */}
                  <div className="text-right shrink-0">
                    <span className="text-xs text-[#9CA3AF] font-medium block">
                      {isPaid ? "Balance" : "Outstanding"}
                    </span>
                    <span className={cn(
                      "text-lg font-bold font-mono tracking-tight",
                      isPaid
                        ? "text-emerald-400"
                        : "text-red-500"
                    )}>
                      {formatCurrency(outstanding)}
                    </span>
                  </div>
                </div>

                {/* Thin progress bar under the name showing paid vs remaining */}
                <div className="w-full space-y-1">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isPaid ? "bg-emerald-400" : progressPercent > 0 ? "bg-amber-400" : "bg-red-500"
                      )}
                      style={{ width: `${isPaid ? 100 : progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono text-[#9CA3AF]">
                    <span>Paid: {formatCurrency(paidAmount)}</span>
                    <span>Remaining: {formatCurrency(outstanding)}</span>
                  </div>
                </div>

                {/* Bottom of card: 36x36px circular icon buttons with explicit touch boundaries */}
                <div className="pt-2.5 border-t border-[#2C2C2E] flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => toggleSelection(t.id, e)}
                    className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      isSelected ? "bg-white border-white text-slate-950" : "border-white/20 bg-[#181818]"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="hidden sm:inline font-medium">Select</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Statement / Download Receipt: 36x36px circular button */}
                    {downloadReceipt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReceipt(t);
                        }}
                        disabled={processingId === t.id}
                        className="w-9 h-9 rounded-full bg-[#181818] hover:bg-white/10 border border-[#2C2C2E] text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                        title="Download Statement Receipt"
                        aria-label="Download Statement Receipt"
                      >
                        {processingId === t.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Chat / WhatsApp Reminder: 36x36px circular button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        shareViaWhatsApp(t);
                      }}
                      className="w-9 h-9 rounded-full bg-[#181818] hover:bg-white/10 border border-[#2C2C2E] text-zinc-300 hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
                      title="Chat / WhatsApp Reminder"
                      aria-label="Chat / WhatsApp Reminder"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Dossier Profile View: 36x36px circular button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateViewingTenantId(t.id);
                      }}
                      className="w-9 h-9 rounded-full bg-[#181818] hover:bg-white/10 border border-[#2C2C2E] text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                      title="View Tenant Dossier"
                      aria-label="View Tenant Dossier"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 7. Bottom Section – Compact Horizontal Banner with 1px border and inline CTA */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-[#2C2C2E] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-[#2C2C2E] flex items-center justify-center text-white shrink-0">
            <Archive className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-white">All-in-One Receipt Backup</h4>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Zip archive of high-res rent receipts for all tenants</p>
          </div>
        </div>

        <button
          onClick={handleBulkDownload}
          disabled={!handleBulkDownload}
          className="w-full sm:w-auto px-4 h-10 bg-white hover:bg-neutral-100 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 active:scale-[0.99]"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Download All</span>
        </button>
      </div>

      {/* Support / Documentation Modal */}
      <AnimatePresence>
        {showSupportModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#181818] border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-5 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Tenants Ledger Guide</h3>
                </div>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="text-[#A3A3A3] hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#A3A3A3] leading-relaxed">
                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider block">Bulk Meter Readings</span>
                  <p>Record electricity and water meter units in bulk. Consumption calculations automatically balance tenant dues and itemized statements.</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider block">Tenant Deposits & Payments</span>
                  <p>Collect cash settlements, advances, or security deposits directly from any individual tenant card or the main Payments tab.</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider block">Roll Over to Next Month</span>
                  <p>Forwards ending meter readings as starting baselines for the next cycle and carries forward unpaid arrears safely.</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider block">All-in-One Receipt Backup</span>
                  <p>Generates crisp PNG receipts for every active tenant and downloads them zipped together in one click.</p>
                </div>
              </div>

              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full py-3 bg-white text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[44px]"
              >
                Close Guide
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
