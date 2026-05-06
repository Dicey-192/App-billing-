/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar, ViewType } from './components/Navigation';
import { useStorage } from './lib/storage';
import { formatCurrency, generateId, cn } from './lib/utils';
import { Property, Tenant, AppData, PaymentRecord } from './types';
import { Plus, Search, Filter, Download, MoreVertical, Trash2, Edit2, AlertCircle, FileText, CheckCircle2, LayoutGrid, List, Home, History, Upload, Users, Undo2, Redo2, Database, Calendar, CreditCard, MessageCircle, Send, ArrowDownUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptTemplate } from './components/ReceiptTemplate';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { PropertyModal, TenantModal, BatchReadingModal, HistoryDetailModal, RolloverPromptModal, BulkTableModal, PaymentModal } from './components/Modals';

export default function App() {
  const [currentView, setView] = useState<ViewType>('dashboard');
  const { data, properties, tenants, history, addProperty, updateProperty, deleteProperty, addTenant, updateTenant, updateTenants, deleteTenant, addHistory, addManyHistory, rollover, setActiveMonth, dismissRollover, updateHistoryTenant, cleanOldHistory, restoreData, quotaUsage, dataStats, setData, recalculateBalances } = useStorage();

  // Modals state
  const [propertyModal, setPropertyModal] = useState<{ open: boolean; data?: Property }>({ open: false });
  const [tenantModal, setTenantModal] = useState<{ open: boolean; data?: Tenant; propertyId?: string }>({ open: false });
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; tenant?: Tenant; property?: Property }>({ open: false });
  const [batchModal, setBatchModal] = useState<{ open: boolean; tenants: Tenant[] }>({ open: false, tenants: [] });
  const [bulkTableModal, setBulkTableModal] = useState<{ open: boolean }>({ open: false });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; data?: any }>({ open: false });
  const [rolloverPrompt, setRolloverPrompt] = useState<{ open: boolean; month: string }>({ open: false, month: '' });
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<AppData[]>([]);
  const [redoStack, setRedoStack] = useState<AppData[]>([]);

  const pushToUndo = () => {
    setUndoStack(prev => [data, ...prev].slice(0, 50));
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [last, ...rest] = undoStack;
    setRedoStack(prev => [data, ...prev]);
    setData(last);
    setUndoStack(rest);
    showToast('Action undone');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const [next, ...rest] = redoStack;
    setUndoStack(prev => [data, ...prev]);
    setData(next);
    setRedoStack(rest);
    showToast('Action redone');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, data]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Month detection effect
  useEffect(() => {
    if (properties.length === 0) return;

    const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!data.activeMonth) {
      setActiveMonth(currentMonth);
    } else if (data.activeMonth !== currentMonth && data.dismissedMonth !== currentMonth) {
      if (!rolloverPrompt.open || rolloverPrompt.month !== currentMonth) {
        setRolloverPrompt({ open: true, month: currentMonth });
      }
    }
  }, [data.activeMonth, data.dismissedMonth, properties.length, setActiveMonth, rolloverPrompt.open, rolloverPrompt.month]);

  // ... rest of useMemo ...
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | 'all'>('all');

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'paid' ? t.isPaid : !t.isPaid);
      const matchesProperty = selectedPropertyId === 'all' || t.propertyId === selectedPropertyId;
      return matchesSearch && matchesStatus && matchesProperty;
    });
  }, [tenants, searchQuery, statusFilter, selectedPropertyId]);

  const activeProperty = useMemo(() => {
    if (selectedPropertyId === 'all') return properties[0];
    return properties.find(p => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  const handleRollover = (confirmedMonth?: string) => {
    const targetProperties = properties;
    if (targetProperties.length === 0 || tenants.length === 0) return;
    
    // Determine the billing period label
    const month = confirmedMonth || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    
    const historyEntries: any[] = [];
    const tenantUpdates: { id: string, updates: Partial<Tenant> }[] = [];
    const rolledOverTenants: Tenant[] = [];

    targetProperties.forEach(prop => {
      const propertyTenants = tenants.filter(t => t.propertyId === prop.id);
      if (propertyTenants.length === 0) return;

      // Create history snapshot
      historyEntries.push({
        id: generateId(),
        propertyId: prop.id,
        month,
        snapshot: {
          property: { ...prop },
          tenants: propertyTenants.map(t => ({ ...t })),
        },
        createdAt: Date.now(),
      });

      propertyTenants.forEach(t => {
        const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
        const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
        const elecAmount = elecUnits * prop.electricRate;
        const waterAmount = waterUnits * prop.waterRate;
        const totalExtra = t.expenses.reduce((acc, exp) => acc + exp.amount, 0);
        const totalDue = t.rent + elecAmount + waterAmount + totalExtra + t.previousDues;
        
        const paid = t.paidAmount || 0;
        const remainingDues = Math.max(0, totalDue - paid);

        const updates = {
          prevElecReading: t.currElecReading, // current month's reading becomes starting for next month
          currElecReading: 0, // reset to 0 as requested
          prevWaterReading: t.currWaterReading,
          currWaterReading: 0, // reset to 0 as requested
          isPaid: remainingDues <= 0,
          paidAmount: 0,
          payments: [],
          previousDues: remainingDues,
          updatedAt: Date.now(),
        };

        tenantUpdates.push({ id: t.id, updates: updates as Partial<Tenant> });
        rolledOverTenants.push({ ...t, ...updates });
      });
    });

    if (historyEntries.length > 0 || tenantUpdates.length > 0) {
      rollover(month, historyEntries, tenantUpdates);
    } else {
      // Even if no data to roll over (just properties but no tenants), update the month
      // data.setActiveMonth(month); // Assuming setActiveMonth is available
    }

    setBatchModal({ open: true, tenants: rolledOverTenants });
  };

  const handleBatchSave = (updates: { id: string, currElec: number, currWater: number }[]) => {
    updateTenants(updates.map(u => ({
      id: u.id,
      updates: {
        currElecReading: u.currElec,
        currWaterReading: u.currWater
      }
    })));
    showToast('Batch readings applied!');
  };

  const getWhatsAppMessage = (tenant: Tenant, prop: Property) => {
    const elecUnits = Math.max(0, tenant.currElecReading - tenant.prevElecReading);
    const waterUnits = Math.max(0, tenant.currWaterReading - tenant.prevWaterReading);
    const totalExtra = tenant.expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const totalDue = tenant.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra + tenant.previousDues;
    
    return `*Rent Bill - ${data.activeMonth || 'Current Month'}*\n\n` +
           `*Tenant:* ${tenant.name}\n` +
           `*Property:* ${prop.name} (Room ${tenant.roomNumber})\n\n` +
           `*Readings:*\n` +
           `- Elec: ${tenant.currElecReading} (${elecUnits} units)\n` +
           `- Water: ${tenant.currWaterReading} (${waterUnits} units)\n\n` +
           `*Total Amount:* ₹${totalDue.toLocaleString()}\n` +
           `*Status:* ${tenant.isPaid ? 'PAID ✅' : 'PENDING ⏳'}\n\n` +
           `_Please pay by the 5th to avoid late fees._`;
  };

  const shareViaWhatsApp = async (tenant: Tenant) => {
    const prop = properties.find(p => p.id === tenant.propertyId);
    if (!prop) return;

    if (!tenant.whatsappNumber) {
      alert(`No WhatsApp number found for ${tenant.name}. Please edit tenant to add it.`);
      return;
    }

    setProcessingId(tenant.id);
    try {
      const element = document.getElementById(`receipt-${tenant.id}`);
      if (element) {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#020617' });
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
        
        const message = getWhatsAppMessage(tenant, prop);
        const encodedMsg = encodeURIComponent(message);
        const waUrl = `https://wa.me/${tenant.whatsappNumber.replace(/\D/g, '')}?text=${encodedMsg}`;

        // Attempt Web Share API first (best for mobile)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'bill.png', { type: 'image/png' })] })) {
          await navigator.share({
            files: [new File([blob], 'bill.png', { type: 'image/png' })],
            title: `Bill for ${tenant.name}`,
            text: message,
          });
          showToast('Shared successfully');
        } else {
          // Fallback: Download image and open WhatsApp
          const url = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = url;
          link.download = `bill_${tenant.name.replace(/\s+/g, '_')}.png`;
          link.click();
          
          window.open(waUrl, '_blank');
          showToast('Image downloaded. Sending message...');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('WhatsApp sharing failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkWhatsApp = async () => {
    const selectedTenants = tenants.filter(t => selectedTenantIds.has(t.id));
    if (selectedTenants.length === 0) {
      showToast('Select tenants first');
      return;
    }

    setIsBulkSending(true);
    let count = 0;
    for (const tenant of selectedTenants) {
      setBulkProgress(Math.round((count / selectedTenants.length) * 100));
      // Process one by one with a slight delay
      await shareViaWhatsApp(tenant);
      count++;
      // Give user time to see each before moving to next if bulk
      await new Promise(r => setTimeout(r, 1500));
    }
    setIsBulkSending(false);
    setBulkProgress(0);
    setSelectedTenantIds(new Set());
    showToast(`Bulk send completed for ${count} tenants`);
  };

  const handleDeleteProperty = (id: string) => {
    if (confirm('Are you sure you want to delete this property? All associated tenants will also be removed.')) {
      pushToUndo();
      deleteProperty(id);
      showToast('Property deleted');
    }
  };

  const handleDeleteTenant = (id: string) => {
    if (confirm('Remove this tenant from the records?')) {
      pushToUndo();
      deleteTenant(id);
      showToast('Tenant deleted');
    }
  };

  const downloadSummaryCSV = () => {
    const propertyTenants = tenants.filter(t => selectedPropertyId === 'all' || t.propertyId === selectedPropertyId);
    let csv = "Name,Room,Rent,Elec Units,Water Units,Total Extra,Prev Dues,Total Due,Status\n";
    
    propertyTenants.forEach(t => {
      const prop = properties.find(p => p.id === t.propertyId)!;
      const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
      const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
      const totalExtra = t.expenses.reduce((acc, exp) => acc + exp.amount, 0);
      const totalDue = t.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra + t.previousDues;
      
      csv += `${t.name},${t.roomNumber},${t.rent},${elecUnits},${waterUnits},${totalExtra},${t.previousDues},${totalDue},${t.isPaid ? 'Paid' : 'Unpaid'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `summary_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden selection:bg-blue-500/30">
      {/* Background Mesh Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[140px] animate-pulse delay-700" />
      </div>

      <Sidebar currentView={currentView} setView={setView} />
      
      <main className="flex-1 flex flex-col p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Operations Overview</p>
            <h1 className="text-4xl font-bold text-white capitalize tracking-tight flex items-center gap-3">
              {currentView}
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.8)]" />
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex gap-1 mr-4">
               <button 
                onClick={handleUndo} 
                disabled={undoStack.length === 0}
                className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all text-slate-400 hover:text-white"
                title="Undo (Ctrl+Z)"
               >
                 <Undo2 className="w-5 h-5" />
               </button>
               <button 
                onClick={handleRedo} 
                disabled={redoStack.length === 0}
                className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all text-slate-400 hover:text-white"
                title="Redo (Ctrl+Shift+Z)"
               >
                 <Redo2 className="w-5 h-5" />
               </button>
             </div>

             {currentView === 'tenants' && (
               <button 
                onClick={() => {
                  if (properties.length === 0) {
                    alert('Please create a property first');
                    return;
                  }
                  setTenantModal({ open: true, propertyId: selectedPropertyId === 'all' ? properties[0].id : selectedPropertyId });
                }}
                className="btn btn-primary gap-2"
               >
                 <Plus className="w-5 h-5" />
                 Add Tenant
               </button>
             )}
              {currentView === 'properties' && (
               <button 
                onClick={() => setPropertyModal({ open: true })}
                className="btn btn-primary gap-2"
               >
                 <Plus className="w-5 h-5" />
                 New Property
               </button>
             )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1"
          >
            {currentView === 'dashboard' && <DashboardView data={data} setBatchModal={setBatchModal} setBulkTableModal={setBulkTableModal} properties={properties} />}
            {currentView === 'properties' && (
              <PropertiesView 
                properties={properties} 
                addProperty={addProperty} 
                updateProperty={updateProperty} 
                deleteProperty={handleDeleteProperty} 
                setPropertyModal={setPropertyModal}
              />
            )}
            {currentView === 'tenants' && (
              <TenantsView 
                tenants={filteredTenants}
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                setSelectedPropertyId={setSelectedPropertyId}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                updateTenant={updateTenant}
                deleteTenant={handleDeleteTenant}
                setTenantModal={setTenantModal}
                downloadSummaryCSV={downloadSummaryCSV}
                setBatchModal={setBatchModal}
                setBulkTableModal={setBulkTableModal}
                rolloverPrompt={rolloverPrompt}
                setRolloverPrompt={setRolloverPrompt}
                setPaymentModal={setPaymentModal}
                pushToUndo={pushToUndo}
                selectedTenantIds={selectedTenantIds}
                setSelectedTenantIds={setSelectedTenantIds}
                shareViaWhatsApp={shareViaWhatsApp}
                handleBulkWhatsApp={handleBulkWhatsApp}
                isBulkSending={isBulkSending}
                bulkProgress={bulkProgress}
                processingId={processingId}
                setProcessingId={setProcessingId}
              />
            )}
            {currentView === 'settings' && (
              <SettingsView 
                data={data} 
                restoreData={restoreData} 
                quotaUsage={quotaUsage} 
                cleanOldHistory={cleanOldHistory}
                dataStats={dataStats}
                recalculateBalances={recalculateBalances}
              />
            )}
            {currentView === 'history' && (
              <HistoryView 
                history={history} 
                onShowDetail={(entry: any) => setHistoryModal({ open: true, data: entry })}
                updateHistoryTenant={(eid: string, tid: string, up: any) => {
                  pushToUndo();
                  updateHistoryTenant(eid, tid, up);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Off-screen Receipt templates for capture */}
      <div className="fixed -left-[4000px] top-0 pointer-events-none" aria-hidden="true">
        {tenants.map(t => {
          const prop = properties.find(p => p.id === t.propertyId);
          if (!prop) return null;
          return <ReceiptTemplate key={t.id} property={prop} tenant={t} month="Current Cycle" />;
        })}
      </div>

      {/* Modals */}
      <PropertyModal 
        isOpen={propertyModal.open} 
        onClose={() => setPropertyModal({ open: false })}
        onSave={(p) => {
          pushToUndo();
          propertyModal.data ? updateProperty(p.id, p) : addProperty(p);
        }}
        initialData={propertyModal.data}
      />
      
      {tenantModal.propertyId && (
        <TenantModal 
          isOpen={tenantModal.open}
          onClose={() => setTenantModal({ open: false })}
          propertyId={tenantModal.propertyId}
          onSave={(t) => {
            pushToUndo();
            tenantModal.data ? updateTenant(t.id, t) : addTenant(t);
          }}
          initialData={tenantModal.data}
        />
      )}

      <BatchReadingModal 
        isOpen={batchModal.open}
        onClose={() => setBatchModal({ open: false, tenants: [] })}
        tenants={batchModal.tenants}
        onSave={handleBatchSave}
      />

      {paymentModal.tenant && paymentModal.property && (
        <PaymentModal
          isOpen={paymentModal.open}
          tenant={paymentModal.tenant}
          property={paymentModal.property}
          onClose={() => setPaymentModal({ open: false })}
          onSave={(up) => {
            pushToUndo();
            updateTenant(paymentModal.tenant!.id, up);
          }}
        />
      )}

      <HistoryDetailModal 
        isOpen={historyModal.open}
        onClose={() => setHistoryModal({ open: false })}
        entry={historyModal.data}
        onUpdateTenant={updateHistoryTenant}
      />

      <RolloverPromptModal 
        isOpen={rolloverPrompt.open}
        month={rolloverPrompt.month}
        onClose={() => {
          dismissRollover(rolloverPrompt.month);
          setRolloverPrompt({ ...rolloverPrompt, open: false });
        }}
        onConfirm={() => {
          handleRollover(rolloverPrompt.month);
          setRolloverPrompt({ ...rolloverPrompt, open: false });
          setUndoStack([]); // Clear undo as requested
        }}
      />

      <BulkTableModal
        isOpen={bulkTableModal.open}
        onClose={() => setBulkTableModal({ open: false })}
        tenants={tenants}
        properties={properties}
        onSave={(updates) => {
          handleBatchSave(updates);
          setBulkTableModal({ open: false });
        }}
      />

      <AnimatePresence>
        {isBulkSending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
             <div className="glass-panel p-8 rounded-3xl max-w-sm w-full text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                   <Send className="w-8 h-8 animate-bounce" />
                </div>
                <div className="space-y-2">
                   <h2 className="text-xl font-bold text-white uppercase tracking-tight">Bulk Sending Active</h2>
                   <p className="text-xs text-slate-500 italic uppercase tracking-widest">Please handle each notification on your device</p>
                </div>
                
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${bulkProgress}%` }}
                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                   />
                </div>
                <p className="text-xs font-bold text-emerald-400 font-mono">{bulkProgress}% Complete</p>
             </div>
          </motion.div>
        )}

        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-white text-slate-900 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-widest z-[100]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardView({ data, setBatchModal, setBulkTableModal, properties }: { data: AppData; setBatchModal: any; setBulkTableModal: any; properties: Property[] }) {
  const stats = useMemo(() => {
    let totalPotential = 0;
    let totalCollected = 0;
    let totalArrears = 0;

    data.tenants.forEach(t => {
      const prop = properties.find(p => p.id === t.propertyId);
      if (!prop) return;

      const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
      const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
      const totalExtra = t.expenses.reduce((acc, exp) => acc + exp.amount, 0);
      
      const openingBalance = t.previousDues || 0;
      const monthlyDue = t.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra;
      const totalDue = monthlyDue + openingBalance;
      const paid = t.paidAmount || 0;

      totalPotential += totalDue;
      totalCollected += paid;
      totalArrears += openingBalance;
    });

    const pendingRevenue = totalPotential - totalCollected;
    const paidCount = data.tenants.filter(t => t.isPaid).length;
    const totalCount = data.tenants.length;

    return { totalPotential, totalCollected, pendingRevenue, totalCount, paidCount, totalArrears };
  }, [data.tenants, properties]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Portfolio Value', value: formatCurrency(stats.totalPotential), color: 'text-white' },
          { label: 'Collected', value: formatCurrency(stats.totalCollected), color: 'text-emerald-400' },
          { label: 'Total Pending', value: formatCurrency(stats.pendingRevenue), color: 'text-rose-400' },
          { 
            label: 'Cycle Status', 
            value: `${stats.paidCount} / ${stats.totalCount}`, 
            color: 'text-white',
            badge: stats.totalArrears > 0 ? `₹${stats.totalArrears.toLocaleString()} Arrears` : 'Clean Slate ↑' 
          }
        ].map((s, idx) => (
          <motion.div key={idx} variants={item} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-colors group cursor-default">
            <p className="text-[10px] text-slate-500 uppercase mb-2 tracking-widest font-black group-hover:text-blue-400 transition-colors">{s.label}</p>
            <div className="flex items-end justify-between">
              <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</p>
              {s.badge && <span className="text-[10px] text-emerald-400 mb-1 font-bold">{s.badge}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-3xl flex flex-col items-center justify-center p-12 text-center space-y-6 border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)] relative z-10">
            <FileText className="w-10 h-10" />
          </div>
          <div className="space-y-2 relative z-10">
            <h3 className="text-2xl font-bold text-white tracking-tight">Portfolio Summary</h3>
            <p className="text-slate-400 max-w-sm text-sm leading-relaxed">System healthy. All properties and tenants are up to date for the {data.activeMonth} billing cycle.</p>
          </div>
          <div className="flex gap-3 relative z-10">
             <button 
              onClick={() => setBulkTableModal({ open: true })}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
             >
                Bulk Entry
             </button>
             <div className="px-4 py-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Cycle</span>
             </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PropertiesView({ properties, addProperty, updateProperty, deleteProperty, setPropertyModal }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((p: any) => (
        <div key={p.id} className="card group hover:bg-white/[0.08]">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                <Home className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setPropertyModal({ open: true, data: p })}
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => deleteProperty(p.id)}
                  className="p-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{p.name}</h3>
            <p className="text-slate-400 text-sm mb-6 line-clamp-1 opacity-60 italic">{p.address}</p>
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
               <div>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Elec Rate</p>
                 <p className="font-mono font-bold text-blue-300">{formatCurrency(p.electricRate)}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Water Rate</p>
                 <p className="font-mono font-bold text-blue-300">{formatCurrency(p.waterRate)}</p>
               </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Empty State / Add New */}
      {properties.length === 0 && (
         <div 
          onClick={() => setPropertyModal({ open: true })}
          className="col-span-full border-2 border-dashed border-white/10 rounded-3xl p-16 text-center hover:border-blue-500/50 hover:bg-white/5 transition-all cursor-pointer group"
         >
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/20 transition-all">
              <Plus className="w-10 h-10 text-slate-600 group-hover:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Create your first property</h3>
            <p className="text-slate-500 text-sm mt-3 max-w-xs mx-auto">Add a house, building or society to start managed billing.</p>
         </div>
      )}
    </div>
  );
}

function TenantsView({ tenants, properties, selectedPropertyId, setSelectedPropertyId, searchQuery, setSearchQuery, statusFilter, setStatusFilter, updateTenant, deleteTenant, setTenantModal, downloadSummaryCSV, setBatchModal, setBulkTableModal, rolloverPrompt, setRolloverPrompt, setPaymentModal, pushToUndo, selectedTenantIds, setSelectedTenantIds, shareViaWhatsApp, handleBulkWhatsApp, isBulkSending, bulkProgress, processingId, setProcessingId }: any) {
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  const toggleSelection = (id: string) => {
    const next = new Set(selectedTenantIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTenantIds(next);
  };

  const toggleAll = () => {
    if (selectedTenantIds.size === tenants.length) {
      setSelectedTenantIds(new Set());
    } else {
      setSelectedTenantIds(new Set(tenants.map((t: any) => t.id)));
    }
  };
  const handleManualBatch = () => {
    if (tenants.length === 0) {
      alert('No tenants found in current selection');
      return;
    }
    setBatchModal({ open: true, tenants });
  };

  const downloadReceipt = async (tenant: any) => {
    setProcessingId(tenant.id);
    console.log(`Starting download for ${tenant.name}`);
    try {
      const element = document.getElementById(`receipt-${tenant.id}`);
      if (!element) throw new Error("Receipt element not found");
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        logging: true,
        backgroundColor: '#020617' // Match template bg
      });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt_${tenant.name.replace(/\s+/g, '_')}_${tenant.roomNumber}.png`;
      link.click();
    } catch (e) {
      console.error("Download failed for tenant:", tenant.name, e);
      alert(`Failed to generate receipt for ${tenant.name}. Check console for details.`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkDownload = async () => {
    setBulkProcessing(true);
    const zip = new JSZip();
    const folder = zip.folder("receipts");
    
    try {
      for (const tenant of tenants) {
        const element = document.getElementById(`receipt-${tenant.id}`);
        if (element) {
          const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#020617'
          });
          const imgData = canvas.toDataURL("image/png").split(',')[1];
          folder?.file(`${tenant.name.replace(/\s+/g, '_')}_${tenant.roomNumber}.png`, imgData, { base64: true });
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `Artha_Receipts_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (e) {
      console.error("Bulk download failed", e);
      alert("Bulk download failed. Check console for details.");
    } finally {
      setBulkProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 glass-panel p-4 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search tenants..." 
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="input w-auto min-w-[160px] bg-slate-900/50"
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
          >
            <option value="all">All Properties</option>
            {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            className="input w-auto min-w-[140px] bg-slate-900/50"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tenants.length} Tenants Listed</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Editing: {properties.find((p: any) => p.id === selectedPropertyId)?.name || 'All Properties'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedTenantIds.size > 0 && (
              <button 
                onClick={handleBulkWhatsApp}
                className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 rounded-xl text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-2"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp ({selectedTenantIds.size})
              </button>
            )}
            <button 
              onClick={() => rolloverPrompt.month ? setRolloverPrompt({ ...rolloverPrompt, open: true }) : setRolloverPrompt({ open: true, month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) })}
              className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl text-[10px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20 transition-all flex items-center gap-2"
              aria-label="Start New Billing Month"
            >
              <Calendar className="w-3.5 h-3.5" />
              New Month
            </button>
            <button 
              onClick={handleManualBatch}
              className="px-3 py-1.5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all flex items-center gap-2"
              aria-label="Open Batch Reading Entry"
            >
              <Users className="w-3.5 h-3.5" />
              Batch Entry
            </button>
            <button 
              disabled={bulkProcessing || tenants.length === 0}
              onClick={handleBulkDownload} 
              className="px-3 py-1.5 bg-white text-slate-950 rounded-xl text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              aria-label="Download all receipts as ZIP"
            >
              {bulkProcessing ? "Generating..." : "ZIP Receipts"}
            </button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[11px] uppercase tracking-widest text-slate-500 border-b border-white/10">
                <th className="px-6 py-4 font-bold text-center w-12">
                   <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-white/10 bg-slate-900 accent-blue-500" 
                    checked={selectedTenantIds.size === tenants.length && tenants.length > 0}
                    onChange={toggleAll}
                   />
                </th>
                <th className="px-6 py-4 font-bold">Tenant Details</th>
                <th className="px-6 py-4 font-bold text-right">Meter Status (E/W)</th>
                <th className="px-6 py-4 font-bold text-center">Payment</th>
                <th className="px-6 py-4 font-bold text-right">Total Due</th>
                <th className="px-6 py-4 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t: any) => {
                const prop = properties.find((p: any) => p.id === t.propertyId)!;
                const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
                const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
                const totalExtra = t.expenses.reduce((acc: number, exp: any) => acc + exp.amount, 0);
                const totalDue = t.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra + t.previousDues;

                return (
                  <tr key={t.id} className={cn(
                    "hover:bg-white/5 transition-colors group",
                    !t.isPaid && t.prevElecReading > t.currElecReading ? "bg-red-500/5" : "",
                    selectedTenantIds.has(t.id) ? "bg-blue-500/5" : ""
                  )}>
                    <td className="px-6 py-4 text-center">
                       <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-white/10 bg-slate-900 accent-blue-500" 
                        checked={selectedTenantIds.has(t.id)}
                        onChange={() => toggleSelection(t.id)}
                       />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tight">Room {t.roomNumber} • {prop.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={cn(
                        "font-mono text-sm inline-block px-2 py-0.5 rounded",
                        t.currElecReading < t.prevElecReading ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-slate-400"
                      )}>
                        {t.currElecReading} <span className="opacity-40">/ {t.prevElecReading}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          pushToUndo();
                          updateTenant(t.id, { isPaid: !t.isPaid });
                        }}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter border transition-all",
                          t.isPaid 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}
                      >
                        {t.isPaid ? 'Paid' : 'Unpaid'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-white tracking-wide">{formatCurrency(totalDue)}</div>
                      {t.paidAmount && t.paidAmount > 0 && t.paidAmount < totalDue && (
                        <div className="text-[9px] text-rose-400 font-bold uppercase tracking-tighter">
                          Bal: {formatCurrency(totalDue - t.paidAmount)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          onClick={() => shareViaWhatsApp(t)}
                          className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all hover:scale-110"
                          title="Send WhatsApp Bill"
                         >
                           {processingId === t.id ? (
                             <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                           ) : (
                             <MessageCircle className="w-4 h-4" />
                           )}
                         </button>
                         <button 
                          onClick={() => setPaymentModal({ open: true, tenant: t, property: prop })}
                          className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500"
                          title="Record Payment"
                         >
                           <CreditCard className="w-4 h-4" />
                         </button>
                         <button 
                          disabled={processingId === t.id}
                          onClick={() => downloadReceipt(t)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white disabled:opacity-50"
                          title="Download Receipt"
                         >
                           {processingId === t.id ? (
                             <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                           ) : (
                             <Download className="w-4 h-4" />
                           )}
                         </button>
                         <button 
                          onClick={() => setTenantModal({ open: true, data: t, propertyId: t.propertyId })}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white"
                          title="Edit"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                         <button 
                          onClick={() => deleteTenant(t.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400"
                          title="Delete"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Stacked Cards */}
        <div className="md:hidden divide-y divide-white/5">
           {tenants.map((t: any) => {
             const prop = properties.find((p: any) => p.id === t.propertyId)!;
             const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
             const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
             const totalExtra = t.expenses.reduce((acc: number, exp: any) => acc + exp.amount, 0);
             const totalDue = t.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra + t.previousDues;

             return (
               <div key={t.id} className={cn(
                 "p-4 space-y-4",
                 selectedTenantIds.has(t.id) ? "bg-blue-500/5" : ""
               )}>
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                        <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded border-white/10 bg-slate-900 accent-blue-500" 
                         checked={selectedTenantIds.has(t.id)}
                         onChange={() => toggleSelection(t.id)}
                        />
                        <div>
                          <div className="font-bold text-white text-base">{t.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-tight">Room {t.roomNumber} • {prop.name}</div>
                        </div>
                     </div>
                     <button 
                      onClick={() => updateTenant(t.id, { isPaid: !t.isPaid })}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border",
                        t.isPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}
                     >
                       {t.isPaid ? 'Paid' : 'Unpaid'}
                     </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
                     <div>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Meter E/W</p>
                        <p className="text-xs font-mono text-slate-300">{t.currElecReading} / {t.currWaterReading}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Total Due</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(totalDue)}</p>
                     </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                     <div className="flex gap-1">
                        <button onClick={() => shareViaWhatsApp(t)} className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                           <MessageCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => setPaymentModal({ open: true, tenant: t, property: prop })} className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                           <CreditCard className="w-5 h-5" />
                        </button>
                        <button 
                          disabled={processingId === t.id}
                          onClick={() => downloadReceipt(t)} 
                          className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-white disabled:opacity-50"
                        >
                           {processingId === t.id ? (
                             <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                           ) : (
                             <Download className="w-5 h-5" />
                           )}
                        </button>
                     </div>
                     <div className="flex gap-1">
                        <button onClick={() => setTenantModal({ open: true, data: t, propertyId: t.propertyId })} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-500">
                           <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteTenant(t.id)} className="p-2.5 hover:bg-rose-500/10 rounded-xl text-slate-500 hover:text-rose-400">
                           <Trash2 className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
               </div>
             );
           })}
        </div>
        
        {tenants.length === 0 && (
          <div className="py-20 text-center text-slate-500 bg-white/5">
            <Search className="w-12 h-12 opacity-10 mx-auto mb-4" />
            <p className="text-sm italic">No tenants found matches your criteria.</p>
          </div>
        )}

        <div className="p-4 bg-slate-900/40 border-t border-white/10 flex justify-between items-center">
           <div className="flex gap-2">
              <button onClick={downloadSummaryCSV} className="btn-secondary text-[10px] px-3 py-1 uppercase font-bold rounded-lg border-white/5">Export CSV</button>
              <button onClick={() => window.print()} className="btn-secondary text-[10px] px-3 py-1 uppercase font-bold rounded-lg border-white/5">Print All</button>
           </div>
           <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cycle Total</p>
              <p className="text-sm font-bold text-white tracking-widest">
                {formatCurrency(tenants.reduce((acc: number, t: any) => {
                   const prop = properties.find((p: any) => p.id === t.propertyId)!;
                   const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
                   const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
                   const totalExtra = t.expenses.reduce((exAcc: number, exp: any) => exAcc + exp.amount, 0);
                   return acc + t.rent + (elecUnits * prop.electricRate) + (waterUnits * prop.waterRate) + totalExtra + t.previousDues;
                }, 0))}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ history, onShowDetail, updateHistoryTenant }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-white tracking-tight">Archive Records</h2>
         <div className="flex gap-2">
            <button className="btn btn-secondary text-[10px] uppercase font-bold tracking-widest px-3 py-1.5">Filter Month</button>
         </div>
      </div>
      
      {history.length === 0 ? (
        <div className="glass-panel p-20 text-center space-y-6 rounded-3xl">
           <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-600">
             <History className="w-8 h-8" />
           </div>
           <p className="text-slate-500 text-sm italic">The archive is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {history.map((h: any) => (
             <div key={h.id} className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                     <FileText className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-bold text-white tracking-wide">{h.snapshot.property.name}</h4>
                     <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{h.month}</p>
                   </div>
                </div>
                <button 
                  onClick={() => onShowDetail(h)}
                  className="btn btn-secondary text-[10px] uppercase font-bold tracking-widest gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Snapshot
                </button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ data, restoreData, quotaUsage, cleanOldHistory, dataStats, recalculateBalances }: any) {
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `artha_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newData = JSON.parse(event.target?.result as string);
          if (confirm('Are you sure? This will overwrite your current data with the backup contents.')) {
            restoreData(newData);
            alert('Data restored successfully!');
          }
        } catch (err) {
          alert('Invalid backup file');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="max-w-4xl space-y-10">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
            Data & Backup
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </h3>
          <div className="flex gap-2">
            <button onClick={exportData} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400 border border-white/5 uppercase tracking-widest flex items-center gap-2 transition-all">
                <Download className="w-3 h-3" />
                Backup JSON
            </button>
            <label className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400 border border-white/5 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all">
                <Upload className="w-3 h-3" />
                Restore
                <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-rose-500/20 transition-all group">
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
               <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">6 Months Pruning</h4>
              <p className="text-[10px] text-slate-500 mt-1">Keep 6 months of archive history and delete older entries.</p>
            </div>
            <button onClick={() => confirm('Prune old history?') && cleanOldHistory(6)} className="w-full py-2 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Prune Records</button>
          </div>

          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-blue-500/20 transition-all group">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
               <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">1 Year Archival</h4>
              <p className="text-[10px] text-slate-500 mt-1">Efficient for long-term tracking. Deletes older than 12 months.</p>
            </div>
            <button onClick={() => confirm('Prune records older than 12 months?') && cleanOldHistory(12)} className="w-full py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all">Cleanup History</button>
          </div>

          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-emerald-500/20 transition-all group">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
               <ArrowDownUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Full Balance Audit</h4>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Recalculate all arrears and opening balances across history.</p>
            </div>
            <button onClick={() => {
              if (confirm('Run full accounting audit? This will recalculate all opening balances based on payment history.')) {
                recalculateBalances();
                alert('Audit complete! All balances synchronized.');
              }
            }} className="w-full py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">Recalculate All</button>
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-white/5 pt-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white tracking-tight">System Storage</h3>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", 
            quotaUsage > 80 ? "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          )}>
            {quotaUsage.toFixed(2)}% Capacity Used
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 p-0.5">
           <div 
             className={cn("h-full rounded-full transition-all duration-1000", quotaUsage > 80 ? "bg-rose-500" : "bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]")}
             style={{ width: `${quotaUsage}%` }}
           />
        </div>
        {quotaUsage > 80 && (
          <div className="flex gap-4 p-5 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-rose-300 text-xs leading-relaxed animate-pulse">
             <AlertCircle className="w-5 h-5 shrink-0" />
             <p>High localStorage usage detected. To maintain performance, consider downloading a backup and clearing your old bill history or optimizing property metadata.</p>
          </div>
        )}
      </section>
      
      <section className="space-y-4 border-t border-white/5 pt-10">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Operational Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Total Properties</p>
              <p className="text-lg font-bold text-white">{data.properties.length}</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Active Tenants</p>
              <p className="text-lg font-bold text-white">{data.tenants.length}</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">History Entries</p>
              <p className="text-lg font-bold text-white">{data.history.length}</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Archive Size</p>
              <p className="text-lg font-bold text-white">{(dataStats?.history / 1024).toFixed(1)} KB</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Active Cycle</p>
              <p className="text-xs font-bold text-blue-400 truncate">{data.activeMonth}</p>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
           <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
              <span className="text-slate-500 uppercase tracking-widest">Metadata Props</span>
              <span className="font-mono text-slate-300">{(dataStats?.properties / 1024).toFixed(1)} KB</span>
           </div>
           <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5 flex justify-between items-center text-[10px]">
              <span className="text-slate-500 uppercase tracking-widest">Metadata Tenants</span>
              <span className="font-mono text-slate-300">{(dataStats?.tenants / 1024).toFixed(1)} KB</span>
           </div>
        </div>
      </section>
    </div>
  );
}

