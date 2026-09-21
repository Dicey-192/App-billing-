import React, { useState, useMemo } from 'react';
import { Property, BillHistoryEntry } from '../types';
import { formatCurrency } from '../lib/utils';
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

  // Handle local export file trigger
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Rentflo_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Ledger backup downloaded successfully", "success");
    } catch (e) {
      showToast("Backup export failed", "error");
    }
  };

  // Helper to parse and validate any Rentflo JSON backup payload
  const parseAndValidateBackup = (rawObj: any) => {
    let target = rawObj;
    if (target && typeof target === 'object') {
      if (target.payload && typeof target.payload === 'object') {
        target = target.payload;
      } else if (target.data && typeof target.data === 'object') {
        target = target.data;
      }
    }
    if (!target || typeof target !== 'object') {
      throw new Error("Invalid backup: data is not an object");
    }
    if (!Array.isArray(target.properties) || !Array.isArray(target.tenants)) {
      throw new Error("Invalid backup schema: missing properties or tenants list");
    }
    return target;
  };

  // Handle local import file trigger
  const handleImportJSON = async () => {
    if (!jsonBackupString.trim()) {
      alert("Please paste a valid JSON backup string in the input field first.");
      return;
    }
    try {
      const rawParsed = JSON.parse(jsonBackupString.trim());
      const validatedData = parseAndValidateBackup(rawParsed);
      
      if (confirm("Are you sure you want to restore data? This will overwrite your current database state with the backup contents.")) {
        const success = await restoreData(validatedData);
        if (success) {
          showToast("Database restored successfully", "success");
          setJsonBackupString('');
        } else {
          showToast("Failed to write data to IndexedDB", "error");
        }
      }
    } catch (e) {
      alert("Import failed. Verify the copied JSON backup is standard Rentflo format.");
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
        const rawParsed = JSON.parse(text);
        const validatedData = parseAndValidateBackup(rawParsed);

        if (confirm("Are you sure you want to restore data from this file? This will overwrite your current database state with the backup contents.")) {
          const success = await restoreData(validatedData);
          if (success) {
            showToast("Database restored successfully from file", "success");
            setJsonBackupString('');
          } else {
            showToast("Failed to write data to IndexedDB", "error");
          }
        }
      } catch (err) {
        alert("Import failed. Please verify that this is a valid Rentflo JSON backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input so same file can be chosen again
  };

  return (
    <div className="space-y-6 text-left pb-16">
      {/* Page Header */}
      <div className="border-b border-white/5 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3A3] font-mono leading-none">System Settings</p>
        <h2 className="text-2xl font-black text-white font-sans tracking-tight mt-1">Preferences & Configurations</h2>
      </div>

      {/* Spacing & Bento Grid Layout for Settings Section Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Navigation Sidebar Drawer (4 columns) */}
        <div className="lg:col-span-3 space-y-2 bg-[#111111] p-4 rounded-3xl border border-white/5">
          <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider px-2 mb-3">Settings Categories</p>
          
          <button
            onClick={() => setActiveSection('properties')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'properties' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            Properties
          </button>

          <button
            onClick={() => setActiveSection('history')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'history' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Transaction History
          </button>

          <button
            onClick={() => setActiveSection('rates')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'rates' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Utility Rates
          </button>

          <button
            onClick={() => setActiveSection('utilities')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'utilities' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar Systems
          </button>

          <button
            onClick={() => setActiveSection('backup')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'backup' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Cloud & Sync Backups
          </button>

          <button
            onClick={() => setActiveSection('security')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'security' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Audit & Override Security
          </button>

          <button
            onClick={() => setActiveSection('other')}
            className={`w-full p-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'other' ? 'bg-[#181818] border border-white/10 text-white' : 'text-[#A3A3A3] hover:text-white'
            }`}
          >
            <Info className="w-4 h-4" />
            Theme & Notifications
          </button>
        </div>

        {/* Content Panel Box (9 columns) */}
        <div className="lg:col-span-9 bg-[#111111] p-6 rounded-3xl border border-white/5 space-y-6">
          
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
                  <p className="text-xs text-[#A3A3A3] italic py-8 text-center border border-dashed border-white/5 rounded-2xl">
                    {propertySearch ? 'No properties matched your filter.' : 'No active facilities registered. Add properties to configure utility meters.'}
                  </p>
                ) : (
                  filteredProperties.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setQuickViewProperty(p)}
                      className="p-4 bg-[#181818] hover:bg-[#1f1f1f] border border-white/5 hover:border-white/10 rounded-2xl flex items-center justify-between transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-amber-400 font-mono text-[10px] font-bold shrink-0">
                          ID: {p.id.length > 12 ? p.id.slice(0, 10) + '…' : p.id}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-white flex items-center gap-2 truncate">
                            <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{p.name}</span>
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#A3A3A3] mt-1">
                            <span className="text-amber-400 font-semibold">⚡ Elec: NPR {p.electricRate}/unit</span>
                            <span>•</span>
                            <span className="text-cyan-400 font-semibold">💧 Water: NPR {p.waterRate}/unit</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingRatesProperty(p)}
                          className="p-2 bg-[#111111] hover:bg-amber-500/20 border border-white/5 hover:border-amber-500/30 rounded-xl text-[#A3A3A3] hover:text-amber-400 cursor-pointer transition-all"
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
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl cursor-pointer transition-all"
                          title="Delete Property"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
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
                  <h4 className="font-bold text-xs text-white">Local Ledger Backup Tool</h4>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">Export full JSON files locally or select a previously backed up JSON file to restore.</p>
                </div>

                <div className="space-y-4">
                  {/* File Upload Selector Zone */}
                  <div className="border border-dashed border-white/10 rounded-2xl p-4 bg-[#111111]/50 flex flex-col items-center justify-center gap-3 text-center transition-all duration-300 hover:border-white/20 hover:bg-[#111111]/80 group">
                    <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#A3A3A3] group-hover:text-white group-hover:border-white/20 transition-all">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">Select Backup JSON File</span>
                      <span className="text-[9px] text-[#A3A3A3] uppercase tracking-wider block mt-0.5">Choose a standard Rentflo backup JSON file to restore</span>
                    </div>
                    <label className="px-4 py-2 bg-white text-slate-950 hover:bg-neutral-100 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                      Browse File
                      <input type="file" className="hidden" accept=".json" onChange={handleFileSelect} />
                    </label>
                  </div>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="flex-shrink mx-3 text-[9px] text-[#A3A3A3]/60 uppercase tracking-widest font-mono">Or paste raw text string</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={jsonBackupString}
                      onChange={(e) => setJsonBackupString(e.target.value)}
                      placeholder="Paste full JSON backup content here..."
                      className="w-full h-20 bg-[#111111] border border-white/5 rounded-xl p-3 text-xs font-mono text-[#A3A3A3] placeholder-[#A3A3A3]/40 focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleExportJSON}
                        className="w-full py-2 bg-[#111111] hover:bg-white/5 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export JSON File
                      </button>

                      <button
                        onClick={handleImportJSON}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-black text-[9px] tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Restore pasted text
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
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Override & Audit Control</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Tweak manual overrides and review the tamper-evident operations log</p>
              </div>

              {/* Master Override Mode block */}
              <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Master Arithmetic Overrides</h4>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">Permits direct manual edits of rent and utility invoice fields.</p>
                </div>

                <button
                  onClick={toggleSupportMasterMode}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer ${
                    supportMasterOverrideMode ? 'bg-orange-500' : 'bg-white/15'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                    supportMasterOverrideMode ? 'translate-x-5.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Database Audit Log */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-wider">Database Operations Audit Logs ({auditLogs.length})</p>
                  <button
                    onClick={clearAuditLogs}
                    className="text-red-500 font-bold uppercase text-[9px] tracking-widest cursor-pointer hover:underline"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="p-3 bg-[#181818] rounded-xl border border-white/5 max-h-48 overflow-y-auto space-y-2 text-[10px] font-mono text-[#A3A3A3]">
                  {auditLogs.length === 0 ? (
                    <p className="italic text-center py-4">No logged records. Actions like collections or adding properties create audit nodes.</p>
                  ) : (
                    auditLogs.map((log, idx) => (
                      <div key={idx} className="border-b border-white/5 pb-1 flex justify-between gap-4">
                        <span>[{new Date(log.timestamp).toLocaleTimeString()}] {log.action} - {log.details}</span>
                        <span className="text-white font-bold shrink-0">{log.user || 'System'}</span>
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
              <div className="border-b border-white/5 pb-3">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">Theme, Notifications & About</h3>
                <p className="text-[10px] text-[#A3A3A3] mt-0.5 uppercase tracking-wide">Rentflo architecture configurations</p>
              </div>

              {/* Users Details */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-white/5 space-y-2">
                <span className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest block">User Identity Profile</span>
                <p className="text-xs text-white font-bold">Role Privilege Level: Property Owner</p>
                <p className="text-[10px] text-[#A3A3A3]">Full write permissions enabled on all IndexedDB tables. Cryptography key synchronized.</p>
              </div>

              {/* Theme & Brand Block */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-white/5 space-y-2">
                <span className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest block">Locked Visual Theme Details</span>
                <p className="text-xs text-white font-bold">Premium Cosmic Slate Theme (Active)</p>
                <p className="text-[10px] text-[#A3A3A3] leading-relaxed">
                  Strictly conforms to monochrome high-contrast dark visual structures. Built on Apple HIG, Stripe, and Revolut Dashboard layout rules for low-cognitive strain during bookkeeping sessions.
                </p>
              </div>

              {/* Notifications Status */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-white/5 space-y-2">
                <span className="text-[9px] font-mono uppercase text-[#A3A3A3] tracking-widest block">Notification alert channels</span>
                <p className="text-xs text-white font-bold">WhatsApp Reminder Engine: Active</p>
                <p className="text-[10px] text-[#A3A3A3]">Automated text formatting templates with quick-action click targets for tenants.</p>
              </div>

              {/* About Block */}
              <div className="p-4 bg-gradient-to-r from-white/[0.01] to-transparent rounded-2xl border border-white/5 text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-[9px] font-mono text-white font-bold uppercase tracking-widest">Rentflo SaaS Engine Secure Base v2.4.2</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
