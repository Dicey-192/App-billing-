import React, { useState, useMemo } from 'react';
import { Property, BillHistoryEntry } from '../types';
import { formatCurrency } from '../lib/utils';
import { normalizeAndValidateBackup } from '../lib/storage';
import { 
  Home, Users, ShieldAlert, Sparkles, SlidersHorizontal, AlertCircle, 
  Trash2, Edit2, Plus, Calendar, RefreshCw, KeyRound, Download, 
  Upload, CheckCircle2, ChevronRight, Info, Settings, Bell, Palette, 
  BookOpen, LogOut, Check, History, FileText, Search, Zap, Droplets,
  Folder, Lock, ShieldCheck, HardDrive
} from 'lucide-react';
import { motion } from 'motion/react';
import { PropertyRatesModal, PropertyQuickViewModal } from './Modals';

interface SettingsViewProps {
  properties: Property[];
  addProperty: (prop: any) => void;
  updateProperty: (id: string, updates: any) => void;
  deleteProperty: (id: string) => void;
  setPropertyModal: (modal: any) => void;
  history: BillHistoryEntry[];
  onShowDetail: (entry: any) => void;
  updateHistoryTenant: (eid: string, tid: string, up: any) => void;
  data: any;
  restoreData: (newData: any) => Promise<boolean>;
  quotaUsage: any;
  cleanOldHistory: () => void;
  dataStats: any;
  recalculateBalances: () => void;
  auditLogs: any[];
  supportMasterOverrideMode: boolean;
  toggleSupportMasterMode: () => void;
  clearAuditLogs: () => void;
  googleUser: any;
  googleToken: string | null;
  googleBackups: any[];
  isDriveBackingUp: boolean;
  isDriveLoadingBackups: boolean;
  isDriveRestoring: boolean;
  googleAuthError: string | null;
  setGoogleAuthError: (err: string | null) => void;
  handleGoogleSignIn: () => void;
  handleGoogleLogout: () => void;
  handleBackupToDrive: () => void;
  handleRestoreFromDrive: (fileId: string) => void;
  fetchDriveBackups: () => void;
  showToast: (msg: string, type?: any) => void;
  calendarSystem: 'AD' | 'BS';
  setCalendarSystem: (sys: 'AD' | 'BS') => void;
  isSimulatedCloud?: boolean;
  setIsSimulatedCloud?: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  properties,
  addProperty,
  updateProperty,
  deleteProperty,
  setPropertyModal,
  history,
  onShowDetail,
  updateHistoryTenant,
  data,
  restoreData,
  quotaUsage,
  cleanOldHistory,
  dataStats,
  recalculateBalances,
  auditLogs,
  supportMasterOverrideMode,
  toggleSupportMasterMode,
  clearAuditLogs,
  googleUser,
  googleToken,
  googleBackups,
  isDriveBackingUp,
  isDriveLoadingBackups,
  isDriveRestoring,
  googleAuthError,
  setGoogleAuthError,
  handleGoogleSignIn,
  handleGoogleLogout,
  handleBackupToDrive,
  handleRestoreFromDrive,
  fetchDriveBackups,
  showToast,
  calendarSystem,
  setCalendarSystem,
  isSimulatedCloud = false,
  setIsSimulatedCloud
}) => {
  const [activeSection, setActiveSection] = useState<'properties' | 'history' | 'rates' | 'utilities' | 'backup' | 'security' | 'other'>('properties');
  const [jsonBackupString, setJsonBackupString] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [editingRatesProperty, setEditingRatesProperty] = useState<Property | null>(null);
  const [quickViewProperty, setQuickViewProperty] = useState<Property | null>(null);

  const filteredProperties = useMemo(() => {
    const q = propertySearch.toLowerCase().trim();
    if (!q) return properties;
    return properties.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.id.toLowerCase().includes(q)
    );
  }, [properties, propertySearch]);

  const [isExportingFolder, setIsExportingFolder] = useState(false);

  const handleExportLocalFolder = async () => {
    setIsExportingFolder(true);
    try {
      const res = await fetch('/api/local-storage/export-folder');
      if (!res.ok) throw new Error("Failed to generate folder zip archive");
      const blob = await res.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rentflo_Local_Data_Folder_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Private app storage folder exported as ZIP successfully", "success");
    } catch (err) {
      showToast("Folder export failed", "error");
    } finally {
      setIsExportingFolder(false);
    }
  };

  const [testValidationResult, setTestValidationResult] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    message: string;
    details?: { properties: number; tenants: number; history: number };
  }>({ status: 'idle', message: '' });

  // Handle local export file trigger using Blob to prevent data truncation
  const handleExportJSON = (customName?: string) => {
    try {
      const fileName = customName || 'Rentflo_Backup_21Sep2026_Fresh.json';
      const cleanData = {
        properties: data.properties || [],
        tenants: data.tenants || [],
        history: data.history || [],
        activeMonth: data.activeMonth || '',
        calendarSystem: data.calendarSystem || 'AD',
        auditLogs: data.auditLogs || [],
        exportedAt: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(cleanData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = fileName;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      showToast(`Fresh backup "${fileName}" downloaded successfully!`, "success");
    } catch (e: any) {
      showToast(`Backup export failed: ${e?.message || 'unknown error'}`, "error");
    }
  };

  // Test / Verify backup integrity without overwriting database
  const handleTestBackup = (sourceString?: string) => {
    try {
      const contentToTest = sourceString || jsonBackupString || JSON.stringify(data);
      const validated = normalizeAndValidateBackup(contentToTest);
      setTestValidationResult({
        status: 'valid',
        message: `Validation passed! Backup is completely intact and ready to import.`,
        details: {
          properties: validated.properties.length,
          tenants: validated.tenants.length,
          history: validated.history.length
        }
      });
      showToast(`Backup verified: ${validated.properties.length} properties, ${validated.tenants.length} tenants, ${validated.history.length} bills`, "success");
    } catch (err: any) {
      setTestValidationResult({
        status: 'invalid',
        message: `Validation failed: ${err?.message || 'Invalid format'}`
      });
      showToast(`Verification failed: ${err?.message}`, "error");
    }
  };

  // Handle local import pasted string trigger
  const handleImportJSON = async () => {
    if (!jsonBackupString.trim()) {
      alert("Please paste a valid JSON backup string in the input field first.");
      return;
    }
    try {
      const validatedData = normalizeAndValidateBackup(jsonBackupString.trim());
      
      const confirmMsg = `Found valid backup:\n- ${validatedData.properties.length} Properties\n- ${validatedData.tenants.length} Tenants\n- ${validatedData.history.length} Bills in History\n\nDo you want to restore this data to your app now?`;
      if (confirm(confirmMsg)) {
        const success = await restoreData(validatedData);
        if (success) {
          showToast(`Database restored successfully (${validatedData.tenants.length} tenants, ${validatedData.history.length} bills)`, "success");
          setJsonBackupString('');
          setTestValidationResult({
            status: 'valid',
            message: `Successfully imported ${validatedData.tenants.length} tenants and ${validatedData.history.length} bills!`,
            details: {
              properties: validatedData.properties.length,
              tenants: validatedData.tenants.length,
              history: validatedData.history.length
            }
          });
        } else {
          showToast("Failed to restore data to persistent storage", "error");
        }
      }
    } catch (e: any) {
      alert(`Import failed: ${e?.message || "Verify the copied JSON backup is standard Rentflo format."}`);
    }
  };

  // Handle local backup file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const validatedData = normalizeAndValidateBackup(text);

        const confirmMsg = `Backup file "${file.name}" is valid:\n- ${validatedData.properties.length} Properties\n- ${validatedData.tenants.length} Tenants\n- ${validatedData.history.length} Bills in History\n\nDo you want to restore this data into your app?`;
        if (confirm(confirmMsg)) {
          const success = await restoreData(validatedData);
          if (success) {
            showToast(`Database restored successfully from "${file.name}"!`, "success");
            setJsonBackupString('');
            setTestValidationResult({
              status: 'valid',
              message: `Successfully imported "${file.name}"!`,
              details: {
                properties: validatedData.properties.length,
                tenants: validatedData.tenants.length,
                history: validatedData.history.length
              }
            });
          } else {
            showToast("Failed to write data to persistent storage", "error");
          }
        }
      } catch (err: any) {
        alert(`Import failed for "${file.name}": ${err?.message || "Please verify this is a valid Rentflo JSON file."}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input so same file can be chosen again
  };

  return (
    <div className="space-y-6 text-left pb-16">
      {/* Page Header */}
      <div className="border-b border-[#2C2C2E] pb-4">
        <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider">System Settings</p>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">Preferences & Configurations</h2>
      </div>

      {/* Spacing & Layout for Settings Section Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Sidebar: Clean vertical lists grouped under clear category titles */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Category: Property Management */}
          <div className="bg-[#111111] p-3 rounded-2xl border border-[#2C2C2E] space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] px-2.5 py-1">
              Property Management
            </p>
            
            <button
              onClick={() => setActiveSection('properties')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'properties' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Properties Directory</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>

            <button
              onClick={() => setActiveSection('rates')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'rates' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Utility Rates</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>

            <button
              onClick={() => setActiveSection('history')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'history' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Transaction History</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>
          </div>

          {/* Category: Localization & Preferences */}
          <div className="bg-[#111111] p-3 rounded-2xl border border-[#2C2C2E] space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] px-2.5 py-1">
              Localization & Preferences
            </p>

            <button
              onClick={() => setActiveSection('utilities')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'utilities' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Calendar Systems</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>

            <button
              onClick={() => setActiveSection('other')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'other' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Theme & Preferences</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>
          </div>

          {/* Category: Security & Data */}
          <div className="bg-[#111111] p-3 rounded-2xl border border-[#2C2C2E] space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] px-2.5 py-1">
              Security & Data
            </p>

            <button
              onClick={() => setActiveSection('backup')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'backup' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Cloud & Local Backups</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>

            <button
              onClick={() => setActiveSection('security')}
              className={`w-full h-12 px-3.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                activeSection === 'security' 
                  ? 'bg-[#181818] border border-[#2C2C2E] text-white shadow-sm' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Audit & Override Security</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />
            </button>
          </div>

        </div>

        {/* Content Panel Box (8 columns) */}
        <div className="lg:col-span-8 bg-[#111111] p-5 sm:p-6 rounded-3xl border border-[#2C2C2E] space-y-6">
          
          {/* TRANSACTION HISTORY PANEL */}
          {activeSection === 'history' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Historical Billing Cycles</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Access and view previous closed billing cycle ledger snapshots</p>
              </div>

              {history.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/5 rounded-2xl text-[#A3A3A3]">
                  <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  <p className="text-xs font-bold text-white">The archive is currently empty</p>
                  <p className="text-[10px] uppercase tracking-wider mt-1">Roll over a billing cycle to generate archive nodes here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {history.map((h: any) => (
                    <div key={h.id} className="p-4 bg-[#181818] border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#A3A3A3]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white tracking-wide">{h.snapshot.property?.name || 'Property Portfolio'}</h4>
                          <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider font-mono mt-0.5">{h.month}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => onShowDetail(h)}
                        className="px-3 py-1.5 bg-[#111111] hover:bg-white/5 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Snapshot
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROPERTIES PANEL */}
          {activeSection === 'properties' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-white/5 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">Properties Directory</h3>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Register new buildings or physical facilities</p>
                </div>
                
                <button
                  onClick={() => setPropertyModal({ open: true })}
                  className="px-3.5 py-2 bg-white text-[#050505] font-sans font-black text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:bg-slate-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Property
                </button>
              </div>

              {/* Search/filter by ID or name at top */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter properties by ID or Name..."
                  value={propertySearch}
                  onChange={e => setPropertySearch(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-3">
                {filteredProperties.length === 0 ? (
                  <p className="text-xs text-[#A3A3A3] italic py-8 text-center border border-dashed border-[#2C2C2E] rounded-2xl">
                    {propertySearch ? 'No properties matched your filter.' : 'No active facilities registered. Add properties to configure utility meters.'}
                  </p>
                ) : (
                  filteredProperties.map(p => {
                    const tenantCount = data?.tenants ? data.tenants.filter((t: any) => t.propertyId === p.id).length : 0;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => setQuickViewProperty(p)}
                        className="p-4 bg-[#181818] hover:bg-[#1f1f1f] active:scale-[0.99] border border-[#2C2C2E] rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-[#2C2C2E] flex items-center justify-center shrink-0">
                            <Home className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-bold text-white truncate">
                              {p.name}
                            </h4>
                            <p className="text-xs font-normal text-[#9CA3AF] mt-0.5 truncate">
                              {tenantCount} {tenantCount === 1 ? 'Unit' : 'Units'} • {p.address || 'Kathmandu'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
                          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#A1A1AA] mr-2">
                            <span>⚡ ₹{p.electricRate}/U</span>
                            <span>•</span>
                            <span>💧 ₹{p.waterRate}/U</span>
                          </div>
                          <button
                            onClick={() => setEditingRatesProperty(p)}
                            className="p-2 bg-[#111111] hover:bg-amber-500/20 border border-[#2C2C2E] hover:border-amber-500/30 rounded-xl text-[#A1A1AA] hover:text-amber-400 cursor-pointer transition-all"
                            title="Edit Utility Rates Only"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to completely delete ${p.name}? This action is irreversible.`)) {
                                deleteProperty(p.id);
                              }
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl cursor-pointer transition-all"
                            title="Delete Property"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-white transition-colors ml-1" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Minimal Tariff Rates Modal */}
              <PropertyRatesModal
                isOpen={!!editingRatesProperty}
                onClose={() => setEditingRatesProperty(null)}
                property={editingRatesProperty}
                onSaveRates={(propId, elecRate, waterRate) => {
                  updateProperty(propId, { electricRate: elecRate, waterRate: waterRate });
                  showToast("Utility tariff rates updated for future cycles successfully.", "success");
                }}
              />

              {/* Tappable Card Quick View Modal */}
              <PropertyQuickViewModal
                isOpen={!!quickViewProperty}
                onClose={() => setQuickViewProperty(null)}
                property={quickViewProperty}
                tenantCount={quickViewProperty ? (data?.tenants ? data.tenants.filter((t: any) => t.propertyId === quickViewProperty.id).length : 0) : 0}
                onOpenRatesEdit={(p) => setEditingRatesProperty(p)}
              />
            </div>
          )}

          {/* UTILITY RATES PANEL */}
          {activeSection === 'rates' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Utility Tariff Rates</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Adjust electricity and water rates assigned per property</p>
              </div>

              <div className="p-4 bg-[#181818] rounded-2xl border border-white/5 space-y-4">
                <p className="text-xs text-[#A3A3A3] leading-relaxed">
                  Water and electricity billing parameters are inherited by tenants automatically when calculating active billing cycle reports. You can update tariffs by editing individual properties above.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[9px] font-mono uppercase text-[#A3A3A3] block mb-1">Standard Electric Threshold</span>
                    <span className="text-sm font-black text-white">Inherited from property profiles</span>
                  </div>

                  <div className="p-4 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[9px] font-mono uppercase text-[#A3A3A3] block mb-1">Standard Water Rate</span>
                    <span className="text-sm font-black text-white">Inherited per sub-meter readings</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR SYSTEMS PANEL */}
          {activeSection === 'utilities' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Nepal Calendar System</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Toggle between standard Gregorian and Nepalese Bikram Sambat calendar cycles</p>
              </div>

              <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-white uppercase tracking-tight">Active Calendar Engine</h4>
                    <p className="text-[10px] text-[#A3A3A3] mt-0.5">Determines dynamic text in receipt headers and rollover cycle cycles.</p>
                  </div>

                  <div className="flex bg-[#111111] p-1 border border-white/5 rounded-xl">
                    <button
                      onClick={() => setCalendarSystem('AD')}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase transition-all cursor-pointer ${
                        calendarSystem === 'AD' ? 'bg-white text-slate-950 font-black' : 'text-[#A3A3A3]'
                      }`}
                    >
                      Gregorian (AD)
                    </button>
                    <button
                      onClick={() => setCalendarSystem('BS')}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase transition-all cursor-pointer ${
                        calendarSystem === 'BS' ? 'bg-white text-slate-950 font-black' : 'text-[#A3A3A3]'
                      }`}
                    >
                      Nepalese (BS)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLOUD & SYNC BACKUPS PANEL */}
          {activeSection === 'backup' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Cloud Synchronization & Local Backup</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Sync with Google Drive backups or copy raw JSON data locally</p>
              </div>

              {/* Google Drive Block */}
              <div className="p-5 bg-[#181818] border border-white/5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h4 className="font-bold text-xs text-white">Google Drive Backup Cloud</h4>
                    <p className="text-[10px] text-[#A3A3A3] mt-0.5">Securely store encrypted JSON database files directly to your cloud drive space.</p>
                  </div>

                  {googleUser ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-green-500/10 border border-green-500/20 px-2 py-1 rounded text-green-400 font-bold uppercase">
                        {isSimulatedCloud ? 'SIMULATED:' : 'CONNECTED:'} {googleUser.email}
                      </span>
                      <button
                        onClick={handleGoogleLogout}
                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg cursor-pointer animate-fade-in"
                        title="Sign Out"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGoogleSignIn}
                      className="px-3 py-1.5 bg-[#111111] hover:bg-white/5 border border-white/10 rounded-xl text-[9px] font-bold uppercase tracking-wider text-white cursor-pointer"
                    >
                      Connect Google Account
                    </button>
                  )}
                </div>

                {/* Simulated Mode Option */}
                <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSimulatedCloud ? 'bg-amber-500 animate-pulse' : 'bg-neutral-600'}`} />
                      <span className="text-white font-bold uppercase text-[9px]">Simulated Cloud (Demo Mode)</span>
                    </div>
                    <p className="text-[8px] text-[#A3A3A3] mt-0.5">Use a local simulated drive inside the iframe sandbox to completely test cloud backups.</p>
                  </div>
                  <button
                    onClick={() => setIsSimulatedCloud?.(!isSimulatedCloud)}
                    className={`px-2 py-1 font-mono font-black text-[8px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex-shrink-0 ${
                      isSimulatedCloud 
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold' 
                        : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    {isSimulatedCloud ? 'DISABLE' : 'ACTIVATE'}
                  </button>
                </div>

                {/* Connection Error Banner */}
                {googleAuthError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-[10px] uppercase tracking-wider">Google Connection Issue</p>
                        <p className="text-[10px] mt-0.5 leading-relaxed text-red-400/80">{googleAuthError}</p>
                      </div>
                    </div>
                    {!isSimulatedCloud && (
                      <div className="flex items-center gap-2 pt-1.5 border-t border-red-500/10">
                        <span className="text-[9px] text-[#A3A3A3] uppercase">Blocked by sandbox?</span>
                        <button
                          onClick={() => {
                            setIsSimulatedCloud?.(true);
                            setGoogleAuthError(null);
                          }}
                          className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/20 text-amber-400 font-mono font-bold text-[8px] uppercase tracking-wider rounded cursor-pointer"
                        >
                          Enable Simulated Sandbox
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {googleUser && (
                  <div className="grid grid-cols-2 gap-2 border-t border-dashed border-white/5 pt-3">
                    <button
                      onClick={handleBackupToDrive}
                      disabled={isDriveBackingUp}
                      className="w-full py-2 bg-white text-slate-950 font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isDriveBackingUp ? 'Backing Up...' : 'Backup Now'}
                    </button>

                    <button
                      onClick={fetchDriveBackups}
                      disabled={isDriveLoadingBackups}
                      className="w-full py-2 bg-[#111111] hover:bg-white/5 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {isDriveLoadingBackups ? 'Loading List...' : 'Fetch Backups'}
                    </button>
                  </div>
                )}

                {/* Backup List rendering */}
                {googleBackups && googleBackups.length > 0 && (
                  <div className="space-y-2 border-t border-dashed border-white/5 pt-3">
                    <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider">Available Cloud Snapshots</p>
                    {googleBackups.map((bk) => (
                      <div key={bk.id} className="p-2.5 bg-[#111111] border border-white/5 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-white font-mono text-[10px]">{bk.name}</span>
                          <span className="block text-[8px] text-[#A3A3A3] mt-0.5">
                            {bk.createdTime ? new Date(bk.createdTime).toLocaleString() : 'Unknown Date'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestoreFromDrive(bk.id, bk.name)}
                          disabled={isDriveRestoring}
                          className="px-2 py-1 bg-white text-slate-950 font-black rounded text-[8px] uppercase tracking-wider cursor-pointer"
                        >
                          {isDriveRestoring ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Private App Folder Storage Card */}
              <div className="p-5 bg-[#181818] border border-emerald-500/20 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-xs text-white uppercase tracking-wide">Private App Storage Folder</h4>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold rounded">100% LOCAL & PRIVATE</span>
                    </div>
                    <p className="text-[10px] text-[#A3A3A3] mt-1 leading-relaxed">
                      All data (tenants, properties, readings, payments, receipt PNGs) is locked inside your private local storage folder (<code className="text-emerald-300 font-mono">.rentflo_data/</code>). Data never leaves your device.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[9px] font-mono">
                  <div className="p-2 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[#A3A3A3] block uppercase">Tenants Subfolder</span>
                    <span className="text-white font-bold">{data?.tenants?.length || 0} Records</span>
                  </div>
                  <div className="p-2 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[#A3A3A3] block uppercase">Properties Subfolder</span>
                    <span className="text-white font-bold">{data?.properties?.length || 0} Facilities</span>
                  </div>
                  <div className="p-2 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[#A3A3A3] block uppercase">Payments Subfolder</span>
                    <span className="text-white font-bold">{data?.history?.length || 0} Archives</span>
                  </div>
                  <div className="p-2 bg-[#111111] border border-white/5 rounded-xl">
                    <span className="text-[#A3A3A3] block uppercase">Receipts Subfolder</span>
                    <span className="text-white font-bold">Cached PNG Files</span>
                  </div>
                </div>

                <button
                  onClick={handleExportLocalFolder}
                  disabled={isExportingFolder}
                  className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono font-black text-[10px] tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Folder className="w-4 h-4" />
                  {isExportingFolder ? 'Packaging Storage Folder...' : 'Export Entire Private Folder (.zip)'}
                </button>
              </div>

              {/* Local File Export / Import JSON */}
              <div className="p-5 bg-[#181818] border border-white/5 rounded-2xl space-y-4">
                <div>
                  <h4 className="font-bold text-xs text-white">Local Ledger Backup & Integrity Tool</h4>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">Export reliable JSON backup files or verify and restore previous backups safely.</p>
                </div>

                {/* Primary Fresh Backup Button as requested */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Recommended Fresh Backup</span>
                      <span className="text-[10px] text-emerald-300/80 font-mono block mt-0.5">Rentflo_Backup_21Sep2026_Fresh.json</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold uppercase rounded">
                      {data.tenants?.length || 0} Tenants • {data.history?.length || 0} Bills
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleExportJSON('Rentflo_Backup_21Sep2026_Fresh.json')}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      Download Fresh Backup (.json)
                    </button>

                    <button
                      onClick={() => handleTestBackup()}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-bold text-[10px] tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Test Current Ledger Integrity
                    </button>
                  </div>
                </div>

                {/* Validation Test Status Feedback Banner */}
                {testValidationResult.status !== 'idle' && (
                  <div className={`p-3 rounded-xl border text-xs ${
                    testValidationResult.status === 'valid'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                      {testValidationResult.status === 'valid' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                      {testValidationResult.message}
                    </div>
                    {testValidationResult.details && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono grid grid-cols-3 gap-2">
                        <div>Properties: <span className="font-bold text-white">{testValidationResult.details.properties}</span></div>
                        <div>Tenants: <span className="font-bold text-white">{testValidationResult.details.tenants}</span></div>
                        <div>Bill Records: <span className="font-bold text-white">{testValidationResult.details.history}</span></div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  {/* File Upload Selector Zone */}
                  <div className="border border-dashed border-white/10 rounded-2xl p-4 bg-[#111111]/50 flex flex-col items-center justify-center gap-3 text-center transition-all duration-300 hover:border-white/20 hover:bg-[#111111]/80 group">
                    <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#A3A3A3] group-hover:text-white group-hover:border-white/20 transition-all">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">Select Backup JSON File</span>
                      <span className="text-[9px] text-[#A3A3A3] uppercase tracking-wider block mt-0.5">Supports fresh or historical Rentflo JSON files (with automatic schema unwrapping)</span>
                    </div>
                    <label className="px-4 py-2 bg-white text-slate-950 hover:bg-neutral-100 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                      Browse & Restore File
                      <input type="file" className="hidden" accept=".json" onChange={handleFileSelect} />
                    </label>
                  </div>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="flex-shrink mx-3 text-[9px] text-[#A3A3A3]/60 uppercase tracking-widest font-mono">Or test/paste raw JSON text string</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={jsonBackupString}
                      onChange={(e) => setJsonBackupString(e.target.value)}
                      placeholder="Paste raw JSON backup content here to test or restore..."
                      className="w-full h-20 bg-[#111111] border border-white/5 rounded-xl p-3 text-xs font-mono text-[#A3A3A3] placeholder-[#A3A3A3]/40 focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTestBackup(jsonBackupString)}
                        disabled={!jsonBackupString.trim()}
                        className="w-full py-2 bg-[#111111] hover:bg-white/5 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        Verify Pasted String
                      </button>

                      <button
                        onClick={handleImportJSON}
                        disabled={!jsonBackupString.trim()}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Restore Pasted Text
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY & AUDIT PANEL */}
          {activeSection === 'security' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-[#2C2C2E] pb-3">
                <h3 className="font-bold text-base text-white">Audit & Override Security</h3>
                <p className="text-xs text-[#A1A1AA] mt-0.5">Manage administrative overrides and inspect database audit logs</p>
              </div>

              {/* Master Override Mode block */}
              <div className="bg-[#181818] p-5 rounded-2xl border border-[#2C2C2E] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-bold text-sm text-white">Support Override Mode</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      supportMasterOverrideMode 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'bg-white/5 text-[#A1A1AA] border border-white/10'
                    }`}>
                      {supportMasterOverrideMode ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Permits direct manual edits of rent and utility invoice fields, historical recalculations, and emergency ledger corrections.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleSupportMasterMode}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    supportMasterOverrideMode ? 'bg-amber-500' : 'bg-white/15'
                  }`}
                  aria-label="Toggle Support Master Override Mode"
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-transform ${
                    supportMasterOverrideMode ? 'translate-x-5.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Database Audit Log */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                    Database Operations Audit Logs ({auditLogs.length})
                  </p>
                  {auditLogs.length > 0 && (
                    <button
                      onClick={clearAuditLogs}
                      className="text-red-400 hover:text-red-300 font-semibold text-xs cursor-pointer transition-colors"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>

                <div className="p-3 bg-[#181818] rounded-xl border border-[#2C2C2E] max-h-56 overflow-y-auto space-y-2 text-xs font-mono text-[#A1A1AA]">
                  {auditLogs.length === 0 ? (
                    <p className="italic text-center py-6 text-[#A1A1AA]">
                      No logged records. Actions like collections or adding properties create tamper-evident audit nodes.
                    </p>
                  ) : (
                    auditLogs.map((log, idx) => (
                      <div key={idx} className="border-b border-[#2C2C2E] pb-1.5 flex justify-between gap-4 last:border-0">
                        <span className="text-neutral-300">
                          <span className="text-[#A1A1AA]">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.action} - {log.details}
                        </span>
                        <span className="text-amber-400 font-bold shrink-0">{log.user || 'System'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* OTHER: THEME, ABOUT & NOTIFICATIONS */}
          {activeSection === 'other' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="border-b border-[#2C2C2E] pb-3">
                <h3 className="font-bold text-base text-white">Theme & Preferences</h3>
                <p className="text-xs text-[#A1A1AA] mt-0.5">Application appearance and automated messaging preferences</p>
              </div>

              {/* Users Details */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-[#2C2C2E] space-y-1.5">
                <span className="text-xs font-semibold text-[#A1A1AA] block">User Identity Profile</span>
                <p className="text-sm text-white font-bold">Role Privilege Level: Property Owner</p>
                <p className="text-xs text-[#A1A1AA]">Full write permissions enabled on all IndexedDB tables. Cryptography key synchronized.</p>
              </div>

              {/* Theme & Brand Block */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-[#2C2C2E] space-y-1.5">
                <span className="text-xs font-semibold text-[#A1A1AA] block">Visual Theme Details</span>
                <p className="text-sm text-white font-bold">Premium Cosmic Slate Theme (Active)</p>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Strictly conforms to monochrome high-contrast dark visual structures. Built on Apple HIG, Stripe, and Revolut Dashboard layout rules for low-cognitive strain during bookkeeping sessions.
                </p>
              </div>

              {/* Notifications Status */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-[#2C2C2E] space-y-1.5">
                <span className="text-xs font-semibold text-[#A1A1AA] block">Notification Channels</span>
                <p className="text-sm text-white font-bold">WhatsApp Reminder Engine: Active</p>
                <p className="text-xs text-[#A1A1AA]">Automated text formatting templates with quick-action click targets for tenants.</p>
              </div>

              {/* About Block */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-[#2C2C2E] text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-white font-bold">Rentflo SaaS Engine Secure Base v2.4.2</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
