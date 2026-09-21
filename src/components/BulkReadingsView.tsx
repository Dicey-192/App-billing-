import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  Search, 
  RotateCcw, 
  FileSpreadsheet, 
  Zap, 
  Droplets, 
  AlertTriangle, 
  Check, 
  CheckCircle2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  Layers,
  ChevronRight,
  Eye,
  FileText,
  Printer,
  Sparkles,
  ArrowRight,
  ClipboardPaste,
  HelpCircle,
  Copy
} from 'lucide-react';
import { Tenant, Property, BillHistoryEntry } from '../types';
import { getTenantBillingDetails } from '../lib/utils';
import { ReceiptTemplate } from './ReceiptTemplate';

export interface BulkReadingsViewProps {
  tenants: Tenant[];
  properties: Property[];
  activeMonth: string;
  onMonthChange?: (month: string) => void;
  onBack: () => void;
  onSave: (updates: { id: string; currElec: number; currWater: number }[]) => void;
  addAuditLog?: (tenantId: string, tenantName: string, month: string, action: string, previousValue?: string, newValue?: string) => void;
  recalculateBalances?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  updateTenant?: (id: string, updates: Partial<Tenant>) => void;
  addHistory?: (entry: BillHistoryEntry) => void;
  history?: BillHistoryEntry[];
  downloadReceipt?: (tenant: any) => Promise<void>;
}

// Local storage key for confirmed/generated bills in a cycle
const getGeneratedStorageKey = (month: string) => `rentflo_generated_bills_${month}`;

export const BulkReadingsView: React.FC<BulkReadingsViewProps> = ({
  tenants,
  properties,
  activeMonth,
  onMonthChange,
  onBack,
  onSave,
  addAuditLog,
  recalculateBalances,
  showToast,
  updateTenant,
  addHistory,
  downloadReceipt
}) => {
  // Current active view tab: 'entry' | 'queue' | 'generated'
  const [activeTab, setActiveTab] = useState<'entry' | 'queue' | 'generated'>('entry');

  // Selected Billing Period
  const [selectedPeriod, setSelectedPeriod] = useState<string>(activeMonth || 'BS-2083-05');
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState<boolean>(false);

  // Search & Filters for Entry tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [sortOrder, setSortOrder] = useState<'room-asc' | 'room-desc' | 'name-asc'>('room-asc');

  // Spreadsheet Bulk Data Import (Paste Tool) State
  const [isPasteToolOpen, setIsPasteToolOpen] = useState<boolean>(false);
  const [pasteInputText, setPasteInputText] = useState<string>('');
  const [pasteFeedback, setPasteFeedback] = useState<{
    matchedCount: number;
    unmatchedRows: string[];
  } | null>(null);
  const [justMatchedTenantIds, setJustMatchedTenantIds] = useState<Set<string>>(new Set());

  // Local state for raw typed string values: tenantId -> { elec: string, water: string }
  // Storing as string allows smooth manual typing without cursor jumps or number coercions
  const [inputMap, setInputMap] = useState<{ [id: string]: { elec: string; water: string } }>(() => {
    const initial: { [id: string]: { elec: string; water: string } } = {};
    tenants.forEach(t => {
      const currElec = t.currElecReading ? String(t.currElecReading) : '';
      const currWater = t.currWaterReading ? String(t.currWaterReading) : '';
      initial[t.id] = { elec: currElec, water: currWater };
    });
    return initial;
  });

  // Track tenants whose bill for selectedPeriod has been confirmed & generated
  const [generatedTenantIds, setGeneratedTenantIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(getGeneratedStorageKey(selectedPeriod));
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
    return new Set<string>();
  });

  // Save generatedTenantIds to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(
        getGeneratedStorageKey(selectedPeriod),
        JSON.stringify(Array.from(generatedTenantIds))
      );
    } catch (e) {
      console.error(e);
    }
  }, [generatedTenantIds, selectedPeriod]);

  // Sync selectedPeriod with prop
  useEffect(() => {
    if (activeMonth && activeMonth !== selectedPeriod) {
      setSelectedPeriod(activeMonth);
      try {
        const stored = localStorage.getItem(getGeneratedStorageKey(activeMonth));
        if (stored) {
          setGeneratedTenantIds(new Set(JSON.parse(stored)));
        } else {
          setGeneratedTenantIds(new Set<string>());
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [activeMonth]);

  // Sync inputMap if tenants list changes
  useEffect(() => {
    setInputMap(prev => {
      const next = { ...prev };
      tenants.forEach(t => {
        if (!next[t.id]) {
          const currElec = t.currElecReading ? String(t.currElecReading) : '';
          const currWater = t.currWaterReading ? String(t.currWaterReading) : '';
          next[t.id] = { elec: currElec, water: currWater };
        }
      });
      return next;
    });
  }, [tenants]);

  // Modal State for Large One-by-One Bill Preview
  const [reviewTenantId, setReviewTenantId] = useState<string | null>(null);

  // Property lookup map
  const propertyMap = useMemo(() => {
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  // Tenant lookup map
  const tenantMap = useMemo(() => {
    return new Map(tenants.map(t => [t.id, t]));
  }, [tenants]);

  // Helper: check if a tenant has valid manual inputs
  const getReadingsForTenant = useCallback((tenantId: string) => {
    const entry = inputMap[tenantId];
    const elecStr = entry?.elec?.trim() ?? '';
    const waterStr = entry?.water?.trim() ?? '';

    const hasElec = elecStr !== '' && !isNaN(Number(elecStr)) && Number(elecStr) >= 0;
    const hasWater = waterStr !== '' && !isNaN(Number(waterStr)) && Number(waterStr) >= 0;

    const numElec = hasElec ? Number(elecStr) : null;
    const numWater = hasWater ? Number(waterStr) : null;

    return {
      elecStr,
      waterStr,
      hasElec,
      hasWater,
      numElec,
      numWater,
      isComplete: hasElec && hasWater
    };
  }, [inputMap]);

  // Handle manual typing for electricity or water
  const handleInputChange = (tenantId: string, field: 'elec' | 'water', value: string) => {
    setInputMap(prev => ({
      ...prev,
      [tenantId]: {
        ...(prev[tenantId] || { elec: '', water: '' }),
        [field]: value
      }
    }));
  };

  // =========================================================================
  // SPREADSHEET BULK DATA IMPORT (PASTE TOOL) LOGIC
  // Format: Room/Name , Electricity Reading , Water Reading
  // Also supports tab-separated values copied directly from Excel / Google Sheets
  // =========================================================================
  const handleParseAndFillSpreadsheet = () => {
    if (!pasteInputText.trim()) {
      if (showToast) showToast('Please paste spreadsheet data first.', 'error');
      return;
    }

    const lines = pasteInputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let matched = 0;
    const unmatched: string[] = [];
    const nextInputMap = { ...inputMap };
    const matchedIds = new Set<string>();

    for (const line of lines) {
      // Split by tab, comma, semicolon, or double-space
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim());
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim());
      } else if (line.includes(';')) {
        parts = line.split(';').map(p => p.trim());
      } else {
        parts = line.split(/\s{2,}|\s+/).map(p => p.trim());
      }

      if (parts.length < 2) {
        unmatched.push(`"${line}" (needs room & at least electricity reading)`);
        continue;
      }

      const roomOrName = parts[0];
      const elecVal = parts[1]?.replace(/[^\d.]/g, '') || '';
      const waterVal = parts[2]?.replace(/[^\d.]/g, '') || '';

      // Match tenant:
      // 1. Clean room number: strip "RM", "Room", "#", spaces
      const cleanInputRoom = roomOrName.toLowerCase().replace(/^(room|rm|#|\s)+/i, '').trim();
      const matchedTenant = tenants.find(t => {
        const cleanTenantRoom = t.roomNumber.toLowerCase().replace(/^(room|rm|#|\s)+/i, '').trim();
        if (cleanTenantRoom === cleanInputRoom) return true;
        if (t.name.toLowerCase() === roomOrName.toLowerCase()) return true;
        if (t.name.toLowerCase().includes(roomOrName.toLowerCase()) && roomOrName.length >= 3) return true;
        return false;
      });

      if (matchedTenant) {
        matched++;
        matchedIds.add(matchedTenant.id);
        nextInputMap[matchedTenant.id] = {
          elec: elecVal !== '' ? elecVal : (nextInputMap[matchedTenant.id]?.elec ?? ''),
          water: waterVal !== '' ? waterVal : (nextInputMap[matchedTenant.id]?.water ?? '')
        };
      } else {
        unmatched.push(`"${roomOrName}" (no matching room number or tenant name)`);
      }
    }

    setInputMap(nextInputMap);
    setJustMatchedTenantIds(matchedIds);
    setPasteFeedback({
      matchedCount: matched,
      unmatchedRows: unmatched
    });

    if (matched > 0) {
      if (showToast) {
        showToast(`Spreadsheet parsed: matched and filled readings for ${matched} tenants!`, 'success');
      }
      // Clear transient glow after 5 seconds
      setTimeout(() => {
        setJustMatchedTenantIds(new Set());
      }, 5000);
    } else {
      if (showToast) {
        showToast('No matching tenants found. Check room numbers or tenant names.', 'error');
      }
    }
  };

  // Filtered and sorted tenants for Entry Tab
  const filteredSortedTenants = useMemo(() => {
    let list = tenants.filter(t => {
      const matchesProp = selectedPropertyId === 'all' || t.propertyId === selectedPropertyId;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.roomNumber.toLowerCase().includes(q);
      return matchesProp && matchesSearch;
    });

    list.sort((a, b) => {
      if (sortOrder === 'room-asc') {
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      } else if (sortOrder === 'room-desc') {
        return b.roomNumber.localeCompare(a.roomNumber, undefined, { numeric: true });
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [tenants, selectedPropertyId, searchQuery, sortOrder]);

  // Ready for Review Tenants:
  // Must have BOTH electricity and water readings entered AND not yet confirmed/generated for this period
  const readyTenants = useMemo(() => {
    return tenants.filter(t => {
      if (generatedTenantIds.has(t.id)) return false;
      const { isComplete } = getReadingsForTenant(t.id);
      return isComplete;
    });
  }, [tenants, generatedTenantIds, getReadingsForTenant]);

  // Already generated tenants
  const generatedTenants = useMemo(() => {
    return tenants.filter(t => generatedTenantIds.has(t.id));
  }, [tenants, generatedTenantIds]);

  // Calculation details helper for any tenant given current typed inputs
  const calculateBillingForTenant = useCallback((t: Tenant, overrideElec?: number, overrideWater?: number) => {
    const prop = propertyMap.get(t.propertyId) || {
      id: t.propertyId,
      name: 'Property',
      address: '',
      electricRate: 14,
      waterRate: 300,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      defaultExpenses: []
    };

    const r = getReadingsForTenant(t.id);
    const currElec = overrideElec !== undefined ? overrideElec : (r.numElec ?? t.currElecReading);
    const currWater = overrideWater !== undefined ? overrideWater : (r.numWater ?? t.currWaterReading);

    const syntheticTenant: Tenant = {
      ...t,
      currElecReading: currElec,
      currWaterReading: currWater,
    };

    const billing = getTenantBillingDetails(syntheticTenant, prop);
    const elecUnits = Math.max(0, currElec - t.prevElecReading);
    const elecCost = elecUnits * prop.electricRate;
    const waterUnits = Math.max(0, currWater - t.prevWaterReading);
    const waterCost = waterUnits * prop.waterRate;
    const arrears = billing.openingBalance;
    const otherFees = billing.otherFees;
    const additionalCharges = arrears + otherFees;
    const currentSubtotal = billing.baseRent + elecCost + waterCost + additionalCharges;
    const paidAmount = billing.paidAmount;
    const totalDue = Math.max(0, currentSubtotal - paidAmount);

    return {
      prop,
      currElec,
      currWater,
      elecUnits,
      elecCost,
      waterUnits,
      waterCost,
      contractRent: billing.baseRent,
      arrears,
      otherFees,
      additionalCharges,
      currentSubtotal,
      paidAmount,
      totalDue,
      isElecDecreased: currElec < t.prevElecReading,
      isWaterDecreased: currWater < t.prevWaterReading,
    };
  }, [propertyMap, getReadingsForTenant]);

  // Save in-progress typed readings to the database / parent state anytime
  const handleSaveInProgressReadings = () => {
    const updates: { id: string; currElec: number; currWater: number }[] = [];
    tenants.forEach(t => {
      const r = getReadingsForTenant(t.id);
      if (r.hasElec || r.hasWater) {
        updates.push({
          id: t.id,
          currElec: r.hasElec ? (r.numElec as number) : t.currElecReading,
          currWater: r.hasWater ? (r.numWater as number) : t.currWaterReading,
        });
      }
    });

    if (updates.length === 0) {
      if (showToast) showToast('No new readings have been entered yet.', 'info');
      return;
    }

    onSave(updates);
    if (showToast) {
      showToast(`Saved readings for ${updates.length} tenants.`, 'success');
    }
  };

  // CONFIRM & GENERATE BILL for a single tenant during manual review
  const handleConfirmAndGenerate = (tenantId: string) => {
    const t = tenantMap.get(tenantId);
    if (!t) return;

    const r = getReadingsForTenant(t.id);
    const finalElec = r.numElec ?? t.currElecReading;
    const finalWater = r.numWater ?? t.currWaterReading;
    const prop = propertyMap.get(t.propertyId);

    // 1. Update tenant with confirmed meter readings
    if (updateTenant) {
      updateTenant(t.id, {
        currElecReading: finalElec,
        currWaterReading: finalWater,
      });
    }

    // 2. Add history entry snapshot permanently linking the bill
    if (addHistory && prop) {
      const snapshotTenant = {
        ...t,
        currElecReading: finalElec,
        currWaterReading: finalWater,
      };
      const historyEntry: BillHistoryEntry = {
        id: `bill_${t.id}_${selectedPeriod}_${Date.now()}`,
        propertyId: prop.id,
        month: selectedPeriod,
        snapshot: {
          property: prop,
          tenants: [snapshotTenant],
        },
        createdAt: Date.now(),
      };
      addHistory(historyEntry);
    }

    // 3. Add audit log entry
    if (addAuditLog) {
      addAuditLog(
        t.id,
        t.name,
        selectedPeriod,
        'Bill Confirmed & Generated',
        `Prev Elec: ${t.prevElecReading}, Prev Water: ${t.prevWaterReading}`,
        `Elec: ${finalElec}, Water: ${finalWater}`
      );
    }

    // 4. Recalculate billing balances
    if (recalculateBalances) {
      recalculateBalances();
    }

    // 5. Permanently record this tenant as generated in local state & storage
    setGeneratedTenantIds(prev => {
      const next = new Set(prev);
      next.add(tenantId);
      return next;
    });

    if (showToast) {
      showToast(`Bill confirmed and generated for ${t.name} (Room ${t.roomNumber})!`, 'success');
    }

    // 6. Advance to next ready tenant in queue if available
    const remainingInQueue = readyTenants.filter(item => item.id !== tenantId);
    if (remainingInQueue.length > 0) {
      setReviewTenantId(remainingInQueue[0].id);
    } else {
      setReviewTenantId(null);
      if (showToast) {
        showToast('All ready bills have been confirmed!', 'success');
      }
    }
  };

  // Period Change Handler
  const handleSelectPeriod = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    setIsPeriodPickerOpen(false);
    if (onMonthChange) {
      onMonthChange(newPeriod);
    }
    // Load generated status for the new period
    try {
      const stored = localStorage.getItem(getGeneratedStorageKey(newPeriod));
      if (stored) {
        setGeneratedTenantIds(new Set(JSON.parse(stored)));
      } else {
        setGeneratedTenantIds(new Set<string>());
      }
    } catch (e) {
      console.error(e);
    }
    if (showToast) {
      showToast(`Switched to period ${newPeriod}`);
    }
  };

  // Reset inputs to previous readings
  const handleResetToPrevious = () => {
    const nextInputMap = { ...inputMap };
    tenants.forEach(t => {
      nextInputMap[t.id] = {
        elec: String(t.prevElecReading),
        water: String(t.prevWaterReading)
      };
    });
    setInputMap(nextInputMap);
    if (showToast) showToast('Reset all readings to previous cycle values.');
  };

  const periodOptions = [
    'BS-2083-05',
    'BS-2083-04',
    'BS-2083-03',
    'BS-2083-02',
    'BS-2083-01',
    'BS-2082-12',
    'BS-2082-11',
    'BS-2082-10',
  ];

  // Currently reviewed tenant object
  const activeReviewTenant = reviewTenantId ? tenantMap.get(reviewTenantId) : null;
  const activeReviewBilling = activeReviewTenant ? calculateBillingForTenant(activeReviewTenant) : null;

  // Queue position for modal header
  const reviewQueueIndex = reviewTenantId ? readyTenants.findIndex(t => t.id === reviewTenantId) : -1;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 flex flex-col font-sans">
      
      {/* ========================================================
          1. HEADER AREA
          - Title: Bulk Meter Readings
          - Period selector (BS-2083-05)
          - Navigation Tabs: Meter Readings | Review Queue (N) | Generated (M)
          - Top actions: Spreadsheet Paste, Reset to Prev, Save Progress
         ======================================================== */}
      <header className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-8 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Back button & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="h-10 w-10 sm:h-11 sm:w-11 bg-[#181818] hover:bg-white/10 border border-white/15 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
              title="Return to Previous Screen"
            >
              <ArrowLeft className="w-5 h-5 text-amber-400" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                Bulk Meter Readings
              </h1>
              <p className="text-[11px] text-neutral-400 font-medium truncate hidden sm:block">
                Manual entry + Spreadsheet paste • Review queue with one-by-one bill verification
              </p>
            </div>
          </div>

          {/* Period Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            
            {/* Period Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPeriodPickerOpen(!isPeriodPickerOpen)}
                className="h-10 sm:h-11 px-3.5 rounded-xl bg-[#161616] hover:bg-[#202020] border border-amber-500/35 hover:border-amber-500/70 text-amber-300 font-mono font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95"
                title="Select Billing Cycle Period"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{selectedPeriod}</span>
                <ChevronDown className="w-3 h-3 text-amber-400" />
              </button>

              {isPeriodPickerOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#161616] border border-amber-500/40 rounded-xl p-1.5 shadow-2xl z-50 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-white/10">
                    Select Billing Period
                  </div>
                  {periodOptions.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectPeriod(p)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        selectedPeriod === p 
                          ? 'bg-amber-500 text-black font-black' 
                          : 'text-neutral-200 hover:bg-white/10'
                      }`}
                    >
                      <span>{p}</span>
                      {selectedPeriod === p && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle Spreadsheet Paste Tool Button */}
            <button
              type="button"
              onClick={() => setIsPasteToolOpen(!isPasteToolOpen)}
              className={`h-10 sm:h-11 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm border ${
                isPasteToolOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-emerald-500/20'
                  : 'bg-[#181818] hover:bg-white/10 border-white/15 text-neutral-300 hover:text-white'
              }`}
              title="Open or close the spreadsheet bulk paste tool"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isPasteToolOpen ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>{isPasteToolOpen ? 'Hide Paste Tool' : 'Spreadsheet Paste'}</span>
            </button>

            {/* Reset All to Previous */}
            <button
              type="button"
              onClick={handleResetToPrevious}
              className="h-10 sm:h-11 px-3 bg-[#181818] hover:bg-white/10 border border-white/15 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Reset all inputs to previous cycle values"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden md:inline">Reset to Prev</span>
            </button>

            {/* Save In-Progress Readings */}
            <button
              type="button"
              onClick={handleSaveInProgressReadings}
              className="h-10 sm:h-11 px-4 bg-[#1f1f1f] hover:bg-[#282828] border border-white/20 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Save typed readings into storage"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save Progress</span>
            </button>

          </div>

        </div>

        {/* Navigation Tabs Strip */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-2 border-t border-white/5 pt-2">
          
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'entry'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300'
            }`}
          >
            <span>1. Meter Readings Entry</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'entry' ? 'bg-black/20 text-slate-950 font-black' : 'bg-white/10 text-neutral-400'
            }`}>
              {tenants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'queue'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300'
            }`}
          >
            <span>2. Ready for Review</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'queue' ? 'bg-black/20 text-slate-950 font-black' : 'bg-emerald-500/20 text-emerald-300 font-black'
            }`}>
              {readyTenants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('generated')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'generated'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300'
            }`}
          >
            <span>3. Generated Bills</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'generated' ? 'bg-black/20 text-slate-950 font-black' : 'bg-white/10 text-neutral-400'
            }`}>
              {generatedTenants.length}
            </span>
          </button>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5 pb-32">

        {/* Flexible Entry Rule Banner Notification */}
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </span>
            <span className="text-neutral-300 leading-tight">
              <strong>Flexible Entry Active:</strong> Enter readings for any number of tenants anytime via compact cards or spreadsheet paste. Tenants with both readings entered automatically appear in the <strong>Review Queue</strong> for one-by-one verification.
            </span>
          </div>

          {readyTenants.length > 0 && activeTab !== 'queue' && (
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <span>{readyTenants.length} Ready for Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ========================================================
            SPREADSHEET BULK DATA IMPORT (PASTE TOOL) PANEL
            - Collapsible section
            - Format: Room/Name , Electricity Reading , Water Reading
            - Supports tab-separated rows from Excel / Google Sheets
            - Parses & fills current readings automatically
            - Matched tenants become ready for review
           ======================================================== */}
        {isPasteToolOpen && (
          <div className="bg-[#121413] border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Spreadsheet Bulk Data Import (Paste Tool)
                  </h2>
                </div>
                <p className="text-xs text-neutral-400">
                  Copy rows directly from Excel or Google Sheets and paste them below. The system matches rooms or tenant names, sets their current readings, and adds them to the Review Queue.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPasteToolOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                title="Close Paste Tool"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Format Guidance & Quick Examples */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0c0e0d] border border-white/10 rounded-xl p-3 text-xs font-mono">
              <div className="text-neutral-300">
                <span className="text-emerald-400 font-bold">Format: </span>
                <span>Room/Name , Electricity Reading , Water Reading</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 text-[11px]">Example:</span>
                <button
                  type="button"
                  onClick={() => {
                    const sample = tenants.slice(0, 3).map((t, idx) => 
                      `${t.roomNumber}, ${t.prevElecReading + 120 + idx * 5}, ${t.prevWaterReading + 8 + idx}`
                    ).join('\n');
                    setPasteInputText(sample);
                  }}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-neutral-300 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Fill Sample Data
                </button>
              </div>
            </div>

            {/* Multi-row Paste Textarea */}
            <textarea
              rows={5}
              value={pasteInputText}
              onChange={e => setPasteInputText(e.target.value)}
              placeholder={`101, 14280, 195\n102, 11450, 210\nAatif Ansari, 15300, 220`}
              className="w-full bg-[#0d0f0e] border border-white/15 focus:border-emerald-500 rounded-2xl p-3.5 font-mono text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none transition-all shadow-inner leading-relaxed"
            />

            {/* Paste Feedback / Parsing Results */}
            {pasteFeedback && (
              <div className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                pasteFeedback.matchedCount > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Matched & Updated: {pasteFeedback.matchedCount} tenants</span>
                  {readyTenants.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('queue')}
                      className="underline font-bold hover:text-white cursor-pointer"
                    >
                      View in Review Queue ({readyTenants.length}) →
                    </button>
                  )}
                </div>
                {pasteFeedback.unmatchedRows.length > 0 && (
                  <div className="text-[11px] text-neutral-400 pt-1 border-t border-white/5 space-y-0.5">
                    <span className="text-amber-300 font-semibold block">Unmatched Rows:</span>
                    {pasteFeedback.unmatchedRows.map((r, i) => (
                      <div key={i} className="truncate">• {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons for Paste Tool */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPasteInputText('');
                  setPasteFeedback(null);
                }}
                className="h-10 px-4 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear Paste Box
              </button>

              <button
                type="button"
                onClick={handleParseAndFillSpreadsheet}
                className="h-11 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Parse & Fill Current Readings</span>
              </button>
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 1: METER READINGS ENTRY (COMPACT CARDS)
            - Two-column layout when screen allows
            - Small, standard compact size cards
            - Manual typing only (no +1, +5, +10 buttons)
            - Search & filters
           ======================================================== */}
        {activeTab === 'entry' && (
          <div className="space-y-4">
            
            {/* Search and Filters Strip */}
            <div className="bg-[#121212] border border-white/10 p-3 sm:p-3.5 rounded-2xl shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tenant or room..."
                    className="w-full h-10 bg-[#181818] border border-white/10 rounded-xl pl-10 pr-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Property Filter */}
                <div>
                  <select
                    value={selectedPropertyId}
                    onChange={e => setSelectedPropertyId(e.target.value)}
                    aria-label="Filter by property"
                    className="w-full h-10 bg-[#181818] border border-white/10 rounded-xl px-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                  >
                    <option value="all">All Properties ({tenants.length} tenants)</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as any)}
                    aria-label="Sort order"
                    className="w-full h-10 bg-[#181818] border border-white/10 rounded-xl px-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                  >
                    <option value="room-asc">Sort: Room Number (Low → High)</option>
                    <option value="room-desc">Sort: Room Number (High → Low)</option>
                    <option value="name-asc">Sort: Tenant Name (A → Z)</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Compact Cards Grid (Two Columns on md+) */}
            {filteredSortedTenants.length === 0 ? (
              <div className="p-10 text-center bg-[#121212] border border-white/10 rounded-2xl space-y-2">
                <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
                <p className="text-white font-bold text-sm">No tenants match the search filter.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedPropertyId('all'); }}
                  className="text-xs text-amber-400 hover:underline font-mono cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSortedTenants.map(t => {
                  const r = getReadingsForTenant(t.id);
                  const isGenerated = generatedTenantIds.has(t.id);
                  const isReady = r.isComplete && !isGenerated;
                  const isJustPasted = justMatchedTenantIds.has(t.id);
                  const billing = calculateBillingForTenant(t);
                  const prop = propertyMap.get(t.propertyId);

                  return (
                    <div
                      key={t.id}
                      id={`tenant-card-${t.id}`}
                      className={`rounded-2xl p-3.5 sm:p-4 border transition-all duration-150 flex flex-col justify-between gap-3 shadow-md ${
                        isJustPasted
                          ? 'border-emerald-500 bg-[#0e1712] ring-2 ring-emerald-500/40'
                          : isGenerated
                            ? 'border-emerald-500/40 bg-[#0e1611]'
                            : isReady
                              ? 'border-amber-500/50 bg-[#17140e] ring-1 ring-amber-500/30'
                              : 'border-white/10 hover:border-white/20 bg-[#131313]'
                      }`}
                    >
                      {/* Top row: Room badge + Tenant Name & Contract Rent */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0 bg-amber-500/15 border border-amber-500/35 text-amber-300 px-2.5 py-0.5 rounded-lg text-xs font-black font-mono">
                            RM {t.roomNumber}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate leading-snug">
                              {t.name}
                            </h3>
                            {prop?.name && (
                              <p className="text-[10px] text-neutral-400 truncate">
                                {prop.name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Contract Rent Badge */}
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] text-neutral-400 block">Rent</span>
                          <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                            ₹{t.rent.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Electricity & Water Rows (Compact, manual typing only) */}
                      <div className="space-y-2 pt-1 border-t border-white/5">
                        
                        {/* Electricity Row */}
                        <div className="flex items-center justify-between gap-2 bg-[#0d0d0d] border border-white/5 rounded-xl px-3 py-1.5">
                          <div className="min-w-0 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <div className="text-[11px] font-mono leading-tight">
                              <span className="text-neutral-300 font-semibold">Elec</span>
                              <span className="text-neutral-500 ml-1.5">Prev: <strong className="text-neutral-300">{t.prevElecReading}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {r.hasElec && (
                              <span className={`text-[10px] font-mono hidden sm:inline ${billing.isElecDecreased ? 'text-red-400' : 'text-amber-400'}`}>
                                {billing.isElecDecreased ? 'Lower!' : `+${billing.elecUnits}U (₹${billing.elecCost})`}
                              </span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              step="any"
                              value={inputMap[t.id]?.elec ?? ''}
                              onChange={e => handleInputChange(t.id, 'elec', e.target.value)}
                              placeholder="Type reading"
                              aria-label={`Current electricity reading for room ${t.roomNumber}`}
                              className="w-24 sm:w-28 h-9 text-right font-mono font-bold text-xs sm:text-sm bg-[#161616] border border-white/15 focus:border-amber-500 rounded-lg px-2.5 text-amber-300 focus:outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Water Row */}
                        <div className="flex items-center justify-between gap-2 bg-[#0d0d0d] border border-white/5 rounded-xl px-3 py-1.5">
                          <div className="min-w-0 flex items-center gap-2">
                            <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <div className="text-[11px] font-mono leading-tight">
                              <span className="text-neutral-300 font-semibold">Water</span>
                              <span className="text-neutral-500 ml-1.5">Prev: <strong className="text-neutral-300">{t.prevWaterReading}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {r.hasWater && (
                              <span className={`text-[10px] font-mono hidden sm:inline ${billing.isWaterDecreased ? 'text-red-400' : 'text-cyan-400'}`}>
                                {billing.isWaterDecreased ? 'Lower!' : `+${billing.waterUnits}U (₹${billing.waterCost})`}
                              </span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              step="any"
                              value={inputMap[t.id]?.water ?? ''}
                              onChange={e => handleInputChange(t.id, 'water', e.target.value)}
                              placeholder="Type reading"
                              aria-label={`Current water reading for room ${t.roomNumber}`}
                              className="w-24 sm:w-28 h-9 text-right font-mono font-bold text-xs sm:text-sm bg-[#161616] border border-white/15 focus:border-cyan-500 rounded-lg px-2.5 text-cyan-300 focus:outline-none transition-all"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Card Bottom: Status Indicator & Review Action */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
                        {/* Status Label */}
                        <div className="min-w-0 truncate">
                          {isJustPasted ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Updated from Paste
                            </span>
                          ) : isGenerated ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Bill Generated
                            </span>
                          ) : isReady ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Ready for Review
                            </span>
                          ) : (
                            <span className="text-neutral-500">
                              {!r.hasElec && !r.hasWater ? 'Readings pending' : !r.hasElec ? 'Enter electricity' : 'Enter water'}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isGenerated ? (
                            <button
                              type="button"
                              onClick={() => setReviewTenantId(t.id)}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View Bill
                            </button>
                          ) : isReady ? (
                            <button
                              type="button"
                              onClick={() => setReviewTenantId(t.id)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-1"
                            >
                              <span>Review Bill</span>
                              <ChevronRight className="w-3 h-3 stroke-[3]" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-500">
                              Est: ₹{billing.totalDue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ========================================================
            TAB 2: READY FOR REVIEW QUEUE
            - Only tenants who have BOTH electricity and water entered
            - Compact summary card with calculated totals
            - One-by-one review action
           ======================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            
            {/* Review Queue Header & Bulk Trigger */}
            <div className="bg-[#121212] border border-white/10 p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>Review Queue</span>
                  <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-mono border border-amber-500/30">
                    {readyTenants.length} tenants waiting
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Tap any tenant card to open the large bill preview, inspect calculations, and confirm receipt generation.
                </p>
              </div>

              {readyTenants.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewTenantId(readyTenants[0].id)}
                  className="h-11 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Start Review ({readyTenants[0].roomNumber})</span>
                </button>
              )}
            </div>

            {readyTenants.length === 0 ? (
              <div className="p-12 text-center bg-[#121212] border border-white/10 rounded-2xl space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-white font-bold text-sm">No tenants currently pending review.</h3>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Type both electricity and water meter readings on the <strong>Meter Readings Entry</strong> tab (or paste spreadsheet rows) to add tenants to this queue.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('entry')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-all"
                >
                  Go to Meter Readings Entry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {readyTenants.map((t, index) => {
                  const b = calculateBillingForTenant(t);
                  const prop = propertyMap.get(t.propertyId);

                  return (
                    <div
                      key={t.id}
                      className="bg-[#141414] hover:bg-[#181818] border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-150 flex flex-col justify-between gap-3.5 shadow-md group"
                    >
                      {/* Top: Room, Name, Position */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0 bg-amber-500/15 border border-amber-500/35 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-black font-mono">
                            RM {t.roomNumber}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white tracking-tight truncate">
                              {t.name}
                            </h3>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {prop?.name || 'Property'} • Queue #{index + 1}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                          Ready
                        </span>
                      </div>

                      {/* Calculations Summary Breakdown */}
                      <div className="bg-[#0c0c0c] border border-white/5 rounded-xl p-3 space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Contract Rent:</span>
                          <span className="font-bold text-white">₹{b.contractRent.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>⚡ Electricity ({b.currElec} - {t.prevElecReading} = {b.elecUnits} U):</span>
                          <span className="text-amber-300 font-semibold">₹{b.elecCost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>💧 Water ({b.currWater} - {t.prevWaterReading} = {b.waterUnits} U):</span>
                          <span className="text-cyan-300 font-semibold">₹{b.waterCost.toLocaleString()}</span>
                        </div>
                        {b.additionalCharges > 0 && (
                          <div className="flex items-center justify-between text-neutral-400">
                            <span>Arrears / Additional:</span>
                            <span className="text-rose-300 font-semibold">₹{b.additionalCharges.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-sm">
                          <span className="font-bold text-white">Total Amount Due:</span>
                          <span className="font-black text-amber-400 text-base">₹{b.totalDue.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => setReviewTenantId(t.id)}
                        className="w-full h-11 bg-[#1e1e1e] group-hover:bg-amber-500 group-hover:text-slate-950 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review Bill & Confirm</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ========================================================
            TAB 3: GENERATED BILLS (ALREADY CONFIRMED)
           ======================================================== */}
        {activeTab === 'generated' && (
          <div className="space-y-4">
            <div className="bg-[#121212] border border-white/10 p-4 rounded-2xl flex items-center justify-between text-xs text-neutral-400">
              <span>
                Showing <strong className="text-white">{generatedTenants.length}</strong> confirmed and generated bills for <strong>{selectedPeriod}</strong>.
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                Linked & Allocated
              </span>
            </div>

            {generatedTenants.length === 0 ? (
              <div className="p-12 text-center bg-[#121212] border border-white/10 rounded-2xl space-y-2">
                <FileText className="w-8 h-8 text-neutral-500 mx-auto" />
                <p className="text-white font-bold text-sm">No bills generated for {selectedPeriod} yet.</p>
                <p className="text-xs text-neutral-400">
                  Confirm tenants in the Ready for Review queue to generate official receipts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {generatedTenants.map(t => {
                  const b = calculateBillingForTenant(t);
                  const prop = propertyMap.get(t.propertyId);

                  return (
                    <div
                      key={t.id}
                      className="bg-[#0f1411] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0 bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-black font-mono">
                            RM {t.roomNumber}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-white tracking-tight truncate">
                              {t.name}
                            </h3>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {prop?.name} • Bill Generated
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-neutral-400 block font-mono">Total Due</span>
                          <span className="text-base font-black font-mono text-emerald-400">
                            ₹{b.totalDue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs font-mono text-neutral-400">
                        <span>⚡ {b.currElec} U • 💧 {b.currWater} U</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewTenantId(t.id)}
                            className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View Bill
                          </button>
                          {downloadReceipt && (
                            <button
                              type="button"
                              onClick={() => downloadReceipt(t)}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" /> Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ========================================================
          4. ONE-BY-ONE MANUAL REVIEW (LARGE FULL-SIZE BILL PREVIEW)
          - Large, full-size bill preview modal
          - Every detail easy to read:
            - Tenant details
            - Rent
            - Electricity (readings + calculated fee)
            - Water (readings + calculated fee)
            - Additional Charges / Arrears
            - Payments Received
            - Total Amount Due
          - User can check calculations and make corrections
          - Two clear actions:
            - Confirm & Generate
            - Skip / Back
         ======================================================== */}
      {reviewTenantId && activeReviewTenant && activeReviewBilling && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#111111] border-2 border-white/15 rounded-3xl max-w-2xl w-full p-5 sm:p-8 space-y-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col justify-between overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-black font-mono px-2.5 py-0.5 rounded-lg">
                    RM {activeReviewTenant.roomNumber}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Period: <strong className="text-white">{selectedPeriod}</strong>
                  </span>
                  {reviewQueueIndex >= 0 && (
                    <span className="text-[10px] font-mono bg-white/10 text-neutral-300 px-2 py-0.5 rounded-md">
                      Queue: {reviewQueueIndex + 1} of {readyTenants.length}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {activeReviewTenant.name}
                </h2>
                <p className="text-xs text-neutral-400">
                  {activeReviewBilling.prop.name} • {activeReviewBilling.prop.address || 'Standard Tenancy'}
                </p>
              </div>

              {/* Close / Skip button */}
              <button
                type="button"
                onClick={() => setReviewTenantId(null)}
                className="h-9 w-9 bg-white/5 hover:bg-white/15 rounded-xl text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Close bill preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Clear Bill Preview Details */}
            <div className="space-y-4 text-xs sm:text-sm">
              
              {/* 1. Rent */}
              <div className="flex items-center justify-between p-3.5 bg-[#171717] rounded-xl border border-white/5 font-mono">
                <div>
                  <span className="text-white font-bold block text-sm">1. Contract Rent</span>
                  <span className="text-[11px] text-neutral-400">Base monthly tenancy agreement</span>
                </div>
                <span className="text-base sm:text-lg font-black text-white">
                  ₹{activeReviewBilling.contractRent.toLocaleString()}
                </span>
              </div>

              {/* 2. Electricity (readings + fee + editable input for correction) */}
              <div className="p-3.5 bg-[#171717] rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 font-bold text-sm">2. Electricity Charges</span>
                  </div>
                  <span className="text-base font-black font-mono text-amber-300">
                    ₹{activeReviewBilling.elecCost.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs text-neutral-300">
                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Prev Reading</span>
                    <strong className="text-neutral-200">{activeReviewTenant.prevElecReading}</strong>
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Current (Editable)</span>
                    <input
                      type="number"
                      value={inputMap[activeReviewTenant.id]?.elec ?? ''}
                      onChange={e => handleInputChange(activeReviewTenant.id, 'elec', e.target.value)}
                      className="w-full bg-transparent font-bold text-amber-300 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Consumed</span>
                    <strong className="text-white">{activeReviewBilling.elecUnits} Units</strong>
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Rate</span>
                    <strong className="text-neutral-300">₹{activeReviewBilling.prop.electricRate}/U</strong>
                  </div>
                </div>
              </div>

              {/* 3. Water (readings + fee + editable input for correction) */}
              <div className="p-3.5 bg-[#171717] rounded-xl border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300 font-bold text-sm">3. Water Charges</span>
                  </div>
                  <span className="text-base font-black font-mono text-cyan-300">
                    ₹{activeReviewBilling.waterCost.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs text-neutral-300">
                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Prev Reading</span>
                    <strong className="text-neutral-200">{activeReviewTenant.prevWaterReading}</strong>
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Current (Editable)</span>
                    <input
                      type="number"
                      value={inputMap[activeReviewTenant.id]?.water ?? ''}
                      onChange={e => handleInputChange(activeReviewTenant.id, 'water', e.target.value)}
                      className="w-full bg-transparent font-bold text-cyan-300 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Consumed</span>
                    <strong className="text-white">{activeReviewBilling.waterUnits} Units</strong>
                  </div>

                  <div className="bg-[#0f0f0f] p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-neutral-500 block">Rate</span>
                    <strong className="text-neutral-300">₹{activeReviewBilling.prop.waterRate}/U</strong>
                  </div>
                </div>
              </div>

              {/* 4. Additional Charges / Arrears */}
              <div className="flex items-center justify-between p-3.5 bg-[#171717] rounded-xl border border-white/5 font-mono">
                <div>
                  <span className="text-white font-bold block text-sm">4. Additional Charges / Arrears</span>
                  <span className="text-[11px] text-neutral-400">
                    {activeReviewBilling.arrears > 0 ? `Unsettled dues from previous cycle` : `No arrears pending`}
                  </span>
                </div>
                <span className="text-base font-black text-rose-300">
                  ₹{activeReviewBilling.additionalCharges.toLocaleString()}
                </span>
              </div>

              {/* 5. Payments Received */}
              <div className="flex items-center justify-between p-3.5 bg-[#171717] rounded-xl border border-white/5 font-mono">
                <div>
                  <span className="text-white font-bold block text-sm">5. Payments Received</span>
                  <span className="text-[11px] text-neutral-400">Deposits or advance payments this cycle</span>
                </div>
                <span className="text-base font-black text-emerald-400">
                  ₹{activeReviewBilling.paidAmount.toLocaleString()}
                </span>
              </div>

              {/* 6. Total Amount Due (Highlighted Prominent Box) */}
              <div className="p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl flex items-center justify-between font-mono">
                <div className="space-y-0.5">
                  <span className="text-xs uppercase tracking-wider text-amber-300 font-bold block">
                    Total Amount Due
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Subtotal ₹{activeReviewBilling.currentSubtotal.toLocaleString()} - Paid ₹{activeReviewBilling.paidAmount.toLocaleString()}
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-white">
                  ₹{activeReviewBilling.totalDue.toLocaleString()}
                </span>
              </div>

            </div>

            {/* Bottom Actions: Skip / Back vs Confirm & Generate */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
              
              {/* Skip / Back Button */}
              <button
                type="button"
                onClick={() => setReviewTenantId(null)}
                className="h-12 px-5 sm:px-6 bg-[#181818] hover:bg-white/10 border border-white/15 rounded-xl text-neutral-300 hover:text-white text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Skip / Back</span>
              </button>

              {/* Confirm & Generate Button */}
              <button
                type="button"
                onClick={() => handleConfirmAndGenerate(activeReviewTenant.id)}
                className="h-12 px-6 sm:px-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xl shadow-emerald-500/25 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>Confirm & Generate</span>
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Hidden container to mount ReceiptTemplate for html2canvas live receipt export */}
      {tenants.map(t => {
        const prop = propertyMap.get(t.propertyId);
        if (!prop) return null;
        return (
          <div key={`hidden-receipt-${t.id}`} className="sr-only opacity-0 pointer-events-none fixed -top-[9999px] -left-[9999px]">
            <ReceiptTemplate property={prop} tenant={t} month={selectedPeriod} />
          </div>
        );
      })}

      {/* Fixed Footer Bar for Quick Navigation / Global Save */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-[#111111]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 sm:px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2 font-mono">
            <span className="text-neutral-400">Active Cycle:</span>
            <strong className="text-amber-400 font-bold">{selectedPeriod}</strong>
            <span className="text-neutral-600 hidden sm:inline">•</span>
            <span className="text-neutral-400 hidden sm:inline">
              Ready: <strong className="text-white">{readyTenants.length}</strong> | Generated: <strong className="text-emerald-400">{generatedTenants.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {readyTenants.length > 0 && activeTab !== 'queue' && (
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <span>Review Queue ({readyTenants.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveInProgressReadings}
              className="h-10 px-4 bg-[#202020] hover:bg-[#282828] border border-white/15 text-neutral-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
            >
              Save All Typed Readings
            </button>
          </div>

        </div>
      </footer>

    </div>
  );
};
