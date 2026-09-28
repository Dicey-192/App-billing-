import React, { useState, useMemo, useEffect } from 'react';
import { 
  Check, 
  ChevronRight, 
  AlertTriangle, 
  Calendar, 
  Zap, 
  Droplets, 
  FileText, 
  CheckCircle2, 
  ArrowLeft, 
  FileSpreadsheet, 
  RefreshCw, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Home, 
  Users, 
  ArrowRight,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { Tenant, Property, BillHistoryEntry } from '../types';
import { formatCurrency, formatMonthStr, getTenantBillingDetails, verifyPreviousBillingCycle } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface GuidedBillingFlowProps {
  tenants: Tenant[];
  properties: Property[];
  activeMonth: string;
  onMonthChange: (month: string) => void;
  onBack: () => void;
  onNavigateToTenants: () => void;
  onSaveReadings: (updates: { id: string; currElec: number; currWater: number }[]) => void;
  confirmAndGenerateBill: (
    tenantId: string,
    period: string,
    finalElec: number,
    finalWater: number,
    calculations: {
      baseRent: number;
      electricityCharges: number;
      waterCharges: number;
      otherFees: number;
      openingBalance: number;
      totalDue: number;
    }
  ) => any;
  rollover: (month: string, historyEntries: BillHistoryEntry[], updates: { id: string; updates: Partial<Tenant> }[]) => void;
  history: BillHistoryEntry[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: { email: string; role: 'owner' | 'manager' | 'accountant' | 'readonly' } | null;
  initialStep?: 'rollover' | 'entry';
}

type FlowStep = 'rollover' | 'entry' | 'queue' | 'review' | 'completion';

export function getCurrentNepaliMonth(): string {
  try {
    const nd = new NepaliDate();
    return `BS-${nd.getYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

export function getNextNepaliMonth(currentMonthStr: string): string {
  if (!currentMonthStr) return getCurrentNepaliMonth();
  const match = currentMonthStr.match(/^BS-(\d{4})-(\d{1,2})$/);
  if (match) {
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    if (month >= 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
    return `BS-${year}-${String(month).padStart(2, '0')}`;
  }
  return getCurrentNepaliMonth();
}

export const GuidedBillingFlow: React.FC<GuidedBillingFlowProps> = ({
  tenants,
  properties,
  activeMonth,
  onMonthChange,
  onBack,
  onNavigateToTenants,
  onSaveReadings,
  confirmAndGenerateBill,
  rollover,
  history,
  showToast,
  currentUser,
  initialStep
}) => {
  const currentCalendarNepaliMonth = useMemo(() => getCurrentNepaliMonth(), []);

  // Determine detected target month for rollover
  const detectedTargetMonth = useMemo(() => {
    // If active month is behind current calendar, detected target is current calendar month
    if (activeMonth && activeMonth !== currentCalendarNepaliMonth) {
      return currentCalendarNepaliMonth;
    }
    // Otherwise next logical cycle
    return getNextNepaliMonth(activeMonth);
  }, [activeMonth, currentCalendarNepaliMonth]);

  // Is rollover already completed for current month?
  const isRolloverCompletedForCurrent = useMemo(() => {
    if (!activeMonth) return false;
    return activeMonth === currentCalendarNepaliMonth;
  }, [activeMonth, currentCalendarNepaliMonth]);

  // Determine initial step: if new month detected and not rolled over, start at 'rollover'; otherwise 'entry'
  const [currentStep, setCurrentStep] = useState<FlowStep>(() => {
    if (initialStep) return initialStep;
    if (!activeMonth || activeMonth !== currentCalendarNepaliMonth) {
      return 'rollover';
    }
    return 'entry';
  });

  // Track typed readings: tenantId -> { elec: string, water: string }
  const [readingsMap, setReadingsMap] = useState<Record<string, { elec: string; water: string }>>(() => {
    const init: Record<string, { elec: string; water: string }> = {};
    tenants.forEach(t => {
      init[t.id] = {
        elec: t.currElecReading ? String(t.currElecReading) : '',
        water: t.currWaterReading ? String(t.currWaterReading) : ''
      };
    });
    return init;
  });

  // Track tenants whose bill has been confirmed in this session or in history for this cycle
  const [confirmedTenantIds, setConfirmedTenantIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (Array.isArray(history)) {
      history.forEach(h => {
        if (h.month === activeMonth) {
          if (Array.isArray(h.snapshot?.tenants)) {
            h.snapshot.tenants.forEach(st => set.add(st.id));
          }
          tenants.forEach(t => {
            if (h.id.includes(t.id)) set.add(t.id);
          });
        }
      });
    }
    return set;
  });

  // Active reviewing tenant for Step 3
  const [reviewingTenantId, setReviewingTenantId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');

  // Spreadsheet paste tool state
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteResultMsg, setPasteResultMsg] = useState<string | null>(null);

  // Rollover in progress flag
  const [isRollingOver, setIsRollingOver] = useState(false);

  // Sync readingsMap when tenants prop changes
  useEffect(() => {
    setReadingsMap(prev => {
      const next = { ...prev };
      tenants.forEach(t => {
        if (next[t.id] === undefined) {
          next[t.id] = {
            elec: t.currElecReading ? String(t.currElecReading) : '',
            water: t.currWaterReading ? String(t.currWaterReading) : ''
          };
        }
      });
      return next;
    });
  }, [tenants]);

  // Handle Reading Input Change (Manual numeric typing only!)
  const handleReadingChange = (tenantId: string, field: 'elec' | 'water', value: string) => {
    // Only allow numbers and decimal
    const sanitized = value.replace(/[^0-9.]/g, '');
    setReadingsMap(prev => ({
      ...prev,
      [tenantId]: {
        ...prev[tenantId],
        [field]: sanitized
      }
    }));
  };

  // Calculate readiness status for all tenants
  const tenantReadinessList = useMemo(() => {
    return tenants.map(t => {
      const r = readingsMap[t.id] || { elec: '', water: '' };
      const hasElec = r.elec !== '' && !isNaN(Number(r.elec));
      const hasWater = r.water !== '' && !isNaN(Number(r.water));
      const isReady = hasElec && hasWater;
      const isConfirmed = confirmedTenantIds.has(t.id);

      const numElec = hasElec ? Number(r.elec) : t.currElecReading;
      const numWater = hasWater ? Number(r.water) : t.currWaterReading;

      const prop = properties.find(p => p.id === t.propertyId);
      const elecUnits = Math.max(0, numElec - t.prevElecReading);
      const elecCost = elecUnits * (prop?.electricRate || 0);
      const waterUnits = Math.max(0, numWater - t.prevWaterReading);
      const waterCost = waterUnits * (prop?.waterRate || 0);
      const baseRent = t.rent || 0;
      const otherFees = (t.expenses || []).reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
      const openingBalance = t.previousDues || 0;
      const totalDue = baseRent + elecCost + waterCost + otherFees + openingBalance;

      return {
        tenant: t,
        property: prop,
        hasElec,
        hasWater,
        numElec,
        numWater,
        elecUnits,
        elecCost,
        waterUnits,
        waterCost,
        baseRent,
        otherFees,
        openingBalance,
        totalDue,
        isReady,
        isConfirmed
      };
    });
  }, [tenants, properties, readingsMap, confirmedTenantIds]);

  // Filtered tenants for Step 1
  const filteredTenantCards = useMemo(() => {
    return tenantReadinessList.filter(item => {
      const matchProperty = selectedPropertyId === 'all' || item.tenant.propertyId === selectedPropertyId;
      const matchSearch = item.tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tenant.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchProperty && matchSearch;
    });
  }, [tenantReadinessList, selectedPropertyId, searchQuery]);

  // Ready tenants queue for Step 2
  const readyQueue = useMemo(() => {
    return tenantReadinessList.filter(item => item.isReady && !item.isConfirmed);
  }, [tenantReadinessList]);

  // Total ready count
  const readyCount = readyQueue.length;

  // Total confirmed count for this cycle
  const confirmedCount = confirmedTenantIds.size;

  // Handle Spreadsheet Data Parse
  const handleParseSpreadsheetData = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let matched = 0;
    const newMap = { ...readingsMap };

    for (const line of lines) {
      // Split by tab, comma, or pipe
      const tokens = line.split(/[\t,|]+/).map(t => t.trim()).filter(Boolean);
      if (tokens.length < 2) continue;

      // Extract potential numbers from tokens
      const numbers: string[] = [];
      let roomCandidate = '';
      let nameCandidate = '';

      tokens.forEach(tok => {
        if (/^\d+(\.\d+)?$/.test(tok)) {
          numbers.push(tok);
        } else if (!roomCandidate && /^[a-zA-Z0-9_-]+$/.test(tok) && tok.length <= 6) {
          roomCandidate = tok.toLowerCase();
        } else if (!nameCandidate) {
          nameCandidate = tok.toLowerCase();
        }
      });

      // Find matching tenant
      const found = tenants.find(t => {
        if (roomCandidate && t.roomNumber.toLowerCase() === roomCandidate) return true;
        if (nameCandidate && t.name.toLowerCase().includes(nameCandidate)) return true;
        return false;
      });

      if (found && numbers.length >= 2) {
        newMap[found.id] = {
          elec: numbers[0],
          water: numbers[1]
        };
        matched++;
      }
    }

    setReadingsMap(newMap);
    setPasteResultMsg(`Successfully matched and updated ${matched} tenant(s) from pasted data.`);
    if (showToast) showToast(`Parsed readings for ${matched} tenant(s).`, 'success');
  };

  // Step 0: Perform Rollover
  const handleExecuteRollover = () => {
    // Role protection
    if (currentUser && currentUser.role !== 'owner') {
      if (showToast) showToast('Access Denied: Billing Rollover requires Owner permissions.', 'error');
      return;
    }

    // Safety Rule 2: Cannot perform Rollover more than once in the same month
    if (isRolloverCompletedForCurrent) {
      if (showToast) showToast('Rollover already completed for this month. You cannot roll over again.', 'error');
      return;
    }

    setIsRollingOver(true);

    setTimeout(() => {
      try {
        const targetMonth = detectedTargetMonth;

        // Perform previous cycle cross-check
        const check = verifyPreviousBillingCycle(tenants, properties, history);
        if (!check.valid) {
          console.warn('[ROLLOVER_WARNING] Verification issues detected:', check.errors);
        }

        const historyEntries: BillHistoryEntry[] = [];
        const tenantUpdates: { id: string; updates: Partial<Tenant> }[] = [];

        for (const prop of properties) {
          const propTenants = tenants.filter(t => t.propertyId === prop.id);
          if (propTenants.length === 0) continue;

          // Snapshot of ending cycle
          const snapshotEntry: BillHistoryEntry = {
            id: `rollover_snap_${prop.id}_${activeMonth || 'PREV'}_${Date.now()}`,
            propertyId: prop.id,
            month: activeMonth || 'Previous Cycle',
            snapshot: {
              property: { ...prop },
              tenants: propTenants.map(t => ({ ...t }))
            },
            createdAt: Date.now()
          };
          historyEntries.push(snapshotEntry);

          // Update each tenant for the new cycle
          for (const t of propTenants) {
            const billing = getTenantBillingDetails(t, prop);
            const balanceForward = billing.outstandingBalance;

            const updates: Partial<Tenant> = {
              prevElecReading: t.currElecReading,
              currElecReading: 0,
              prevWaterReading: t.currWaterReading,
              currWaterReading: 0,
              isPaid: balanceForward <= 0,
              paidAmount: 0,
              payments: [],
              previousDues: balanceForward,
              manualOverrides: undefined,
              updatedAt: Date.now()
            };

            tenantUpdates.push({ id: t.id, updates });
          }
        }

        rollover(targetMonth, historyEntries, tenantUpdates);
        onMonthChange(targetMonth);

        // Reset local readings inputs for the fresh month
        const freshInputs: Record<string, { elec: string; water: string }> = {};
        tenants.forEach(t => {
          freshInputs[t.id] = { elec: '', water: '' };
        });
        setReadingsMap(freshInputs);
        setConfirmedTenantIds(new Set());

        if (showToast) showToast(`Successfully rolled over to ${formatMonthStr(targetMonth)}!`, 'success');
        
        // Transition to Step 1: Enter Meter Readings
        setCurrentStep('entry');
      } catch (err: any) {
        console.error('Rollover error:', err);
        if (showToast) showToast(`Rollover failed: ${err.message || 'Unknown error'}`, 'error');
      } finally {
        setIsRollingOver(false);
      }
    }, 150);
  };

  // Step 1: Continue to Review Queue
  const handleContinueToReview = () => {
    // Persist draft readings to tenants state
    const updatesToSave: { id: string; currElec: number; currWater: number }[] = [];
    tenantReadinessList.forEach(item => {
      if (item.hasElec || item.hasWater) {
        updatesToSave.push({
          id: item.tenant.id,
          currElec: item.numElec,
          currWater: item.numWater
        });
      }
    });

    if (updatesToSave.length > 0) {
      onSaveReadings(updatesToSave);
    }

    if (readyCount === 0) {
      if (showToast) showToast('Please enter both electricity and water readings for at least one tenant.', 'info');
      return;
    }

    setCurrentStep('queue');
  };

  // Step 2 -> Step 3: Open Bill Review for a specific tenant
  const handleOpenReview = (tenantId: string) => {
    setReviewingTenantId(tenantId);
    setCurrentStep('review');
  };

  // Step 3: Confirm and Generate Bill
  const handleConfirmBill = (item: (typeof tenantReadinessList)[0]) => {
    const t = item.tenant;
    const finalElec = item.numElec;
    const finalWater = item.numWater;

    const calculations = {
      baseRent: item.baseRent,
      electricityCharges: item.elecCost,
      waterCharges: item.waterCost,
      otherFees: item.otherFees,
      openingBalance: item.openingBalance,
      totalDue: item.totalDue
    };

    // Save permanently via storage hook
    confirmAndGenerateBill(t.id, activeMonth, finalElec, finalWater, calculations);

    // Mark as confirmed in session
    setConfirmedTenantIds(prev => new Set(prev).add(t.id));

    if (showToast) showToast(`Bill confirmed and generated for ${t.name}!`, 'success');

    // Check remaining in queue
    const remaining = readyQueue.filter(q => q.tenant.id !== t.id);
    if (remaining.length > 0) {
      // Auto-advance to next ready tenant
      setReviewingTenantId(remaining[0].tenant.id);
    } else {
      // All ready tenants confirmed -> Completion screen
      setReviewingTenantId(null);
      setCurrentStep('completion');
    }
  };

  // Active reviewing tenant item for Step 3
  const activeReviewItem = useMemo(() => {
    if (!reviewingTenantId) return null;
    return tenantReadinessList.find(item => item.tenant.id === reviewingTenantId) || null;
  }, [reviewingTenantId, tenantReadinessList]);

  // Stepper Header definitions
  const stepsConfig: { id: FlowStep; label: string; num: number }[] = [
    { id: 'rollover', label: '1. Rollover', num: 1 },
    { id: 'entry', label: '2. Meter Readings', num: 2 },
    { id: 'queue', label: '3. Review Queue', num: 3 },
    { id: 'review', label: '3. Bill Review', num: 3 },
    { id: 'completion', label: '4. Generate & Done', num: 4 }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-24 text-left">
      {/* Top Bar with Navigation & Cycle Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3A3] font-mono">
                Guided Billing Process
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#76FF03]/10 text-[#76FF03] border border-[#76FF03]/20 font-mono">
                {activeMonth ? formatMonthStr(activeMonth) : 'Current Cycle'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5 font-sans">
              Monthly Billing Workflow
            </h1>
          </div>
        </div>

        {/* Action Status Indicator */}
        <div className="flex items-center gap-2">
          {readyCount > 0 && currentStep === 'entry' && (
            <button
              onClick={handleContinueToReview}
              className="px-4 py-2 bg-[#76FF03] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#68e000] transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span>Continue to Review ({readyCount})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Safety Rule 4: Clear Progress Indicator Stepper */}
      <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 shadow-xl">
        <div className="grid grid-cols-4 gap-2">
          {/* Step 1: Rollover */}
          <div 
            onClick={() => {
              if (currentStep !== 'rollover' && !isRolloverCompletedForCurrent) {
                setCurrentStep('rollover');
              }
            }}
            className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${
              currentStep === 'rollover'
                ? 'bg-white/10 border border-white/20 text-white shadow-inner font-bold'
                : isRolloverCompletedForCurrent
                ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/20'
                : 'text-neutral-400 hover:bg-white/5'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
              isRolloverCompletedForCurrent ? 'bg-emerald-500 text-black' : currentStep === 'rollover' ? 'bg-white text-black' : 'bg-white/10 text-neutral-400'
            }`}>
              {isRolloverCompletedForCurrent ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider leading-tight">Rollover</p>
              <p className="text-[9px] text-neutral-400 hidden sm:block">
                {isRolloverCompletedForCurrent ? 'Completed ✓' : 'Cycle Setup'}
              </p>
            </div>
          </div>

          {/* Step 2: Meter Readings */}
          <div 
            onClick={() => setCurrentStep('entry')}
            className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${
              currentStep === 'entry'
                ? 'bg-white/10 border border-white/20 text-white shadow-inner font-bold'
                : readyCount > 0
                ? 'bg-white/5 text-neutral-200'
                : 'text-neutral-400 hover:bg-white/5'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
              currentStep === 'entry' ? 'bg-[#76FF03] text-black font-black' : readyCount > 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-neutral-400'
            }`}>
              2
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider leading-tight">Readings</p>
              <p className="text-[9px] text-neutral-400 hidden sm:block">
                {readyCount > 0 ? `${readyCount} Ready` : 'Entry Mode'}
              </p>
            </div>
          </div>

          {/* Step 3: Review Queue */}
          <div 
            onClick={() => {
              if (readyCount > 0) setCurrentStep('queue');
            }}
            className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${
              currentStep === 'queue' || currentStep === 'review'
                ? 'bg-white/10 border border-white/20 text-white shadow-inner font-bold'
                : readyCount > 0
                ? 'text-neutral-300 hover:bg-white/5'
                : 'text-neutral-500 opacity-60'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
              currentStep === 'queue' || currentStep === 'review' ? 'bg-white text-black font-black' : 'bg-white/10 text-neutral-400'
            }`}>
              3
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider leading-tight">Review</p>
              <p className="text-[9px] text-neutral-400 hidden sm:block">
                Queue ({readyCount})
              </p>
            </div>
          </div>

          {/* Step 4: Generate & Done */}
          <div 
            onClick={() => {
              if (confirmedCount > 0) setCurrentStep('completion');
            }}
            className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${
              currentStep === 'completion'
                ? 'bg-white/10 border border-white/20 text-white shadow-inner font-bold'
                : confirmedCount > 0
                ? 'text-neutral-300 hover:bg-white/5'
                : 'text-neutral-500 opacity-60'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
              currentStep === 'completion' ? 'bg-[#76FF03] text-black font-black' : confirmedCount > 0 ? 'bg-emerald-600 text-white' : 'bg-white/10 text-neutral-400'
            }`}>
              4
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider leading-tight">Complete</p>
              <p className="text-[9px] text-neutral-400 hidden sm:block">
                {confirmedCount > 0 ? `${confirmedCount} Done` : 'Final'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 0: New Month Detection & Rollover (First Screen) */}
      {/* ========================================================================= */}
      {currentStep === 'rollover' && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="space-y-6"
        >
          <div className="bg-[#18181B] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
            {/* Big Title & Header */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>Nepali Calendar Detection: {formatMonthStr(currentCalendarNepaliMonth)}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white font-sans tracking-tight">
                New Month Detected
              </h2>
              <p className="text-base text-neutral-300 max-w-2xl font-sans leading-relaxed">
                You need to <strong className="text-white">Roll Over to the new month</strong> before entering new meter readings and generating bills.
              </p>
            </div>

            {/* Cycle Comparison Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">Current System Cycle</p>
                <p className="text-lg font-bold text-white mt-1 font-sans">{activeMonth ? formatMonthStr(activeMonth) : 'None'}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{activeMonth || 'Not initialized'}</p>
              </div>
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 font-mono">Target Rollover Cycle</p>
                <p className="text-lg font-black text-white mt-1 font-sans">{formatMonthStr(detectedTargetMonth)}</p>
                <p className="text-xs text-emerald-400 mt-0.5">{detectedTargetMonth}</p>
              </div>
            </div>

            {/* What Will Happen - Simple List */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#76FF03]" />
                What will happen during Rollover:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Readings Reset</p>
                    <p className="text-xs text-neutral-400">Current readings will become Previous readings</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Fields Cleared</p>
                    <p className="text-xs text-neutral-400">Current reading input fields will be cleared for fresh entry</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Arrears Carried Forward</p>
                    <p className="text-xs text-neutral-400">Any unpaid balances & arrears will automatically carry forward</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">New Month Rent</p>
                    <p className="text-xs text-neutral-400">New month base rent will be applied to all active tenants</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Protection: Multiple Rollover Prevention (Safety Rule 2) */}
            {isRolloverCompletedForCurrent ? (
              <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-300">
                    Rollover already completed for this month. You cannot roll over again.
                  </p>
                  <p className="text-xs text-amber-200/80">
                    Your active billing month is already synchronized with {formatMonthStr(activeMonth)}. Performing multiple rollovers in the same cycle would duplicate rent charges.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {isRolloverCompletedForCurrent ? (
                <>
                  <button
                    disabled
                    className="w-full sm:w-auto px-6 py-3.5 bg-neutral-800 text-neutral-500 font-black text-sm uppercase tracking-wider rounded-xl cursor-not-allowed border border-white/5"
                  >
                    Roll Over to Next Month (Blocked)
                  </button>
                  <button
                    onClick={() => setCurrentStep('entry')}
                    className="w-full sm:w-auto px-6 py-3.5 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Enter Meter Readings</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleExecuteRollover}
                    disabled={isRollingOver}
                    className="w-full sm:w-auto px-8 py-4 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRollingOver ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Rollover...</span>
                      </>
                    ) : (
                      <>
                        <span>Roll Over to Next Month</span>
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={onBack}
                    className="w-full sm:w-auto px-6 py-4 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-sm rounded-xl transition-all border border-white/5 cursor-pointer"
                  >
                    Cancel / Later
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: Enter Meter Readings */}
      {/* ========================================================================= */}
      {currentStep === 'entry' && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="space-y-6"
        >
          {/* Top Instruction & Filters */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white font-sans">
                  Meter Readings Entry
                </h2>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Enter new electricity and water readings for any tenants. Manual typing only.
                </p>
              </div>

              {/* Cycle badge */}
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs font-mono text-neutral-300 shrink-0">
                <Calendar className="w-4 h-4 text-[#76FF03]" />
                <span className="font-bold text-white">{activeMonth ? formatMonthStr(activeMonth) : 'Current'}</span>
              </div>
            </div>

            {/* Search and Property Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by tenant name or room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#76FF03]/50 font-sans"
                />
              </div>

              {properties.length > 1 && (
                <div className="w-full sm:w-56 shrink-0">
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#76FF03]/50 font-sans cursor-pointer"
                  >
                    <option value="all">All Properties</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggle Spreadsheet Section */}
              <button
                onClick={() => setIsSpreadsheetOpen(prev => !prev)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Bulk Paste</span>
                {isSpreadsheetOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* B. Spreadsheet Bulk Data Import (Collapsible) */}
            <AnimatePresence>
              {isSpreadsheetOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <div className="p-4 bg-black/50 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        Spreadsheet Bulk Data Import
                      </span>
                      <span className="text-[11px] text-neutral-400">Copy columns from Excel / Google Sheets and paste below</span>
                    </div>

                    <p className="text-xs text-neutral-400">
                      <strong>Expected format:</strong> Room | Tenant Name | Current Electricity | Current Water
                    </p>

                    <textarea
                      rows={4}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`101\tAlice\t120\t55\n102\tBob\t85\t30`}
                      className="w-full p-3 bg-black/80 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#76FF03]/50"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleParseSpreadsheetData}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Parse & Match Data</span>
                      </button>

                      {pasteResultMsg && (
                        <span className="text-xs text-[#76FF03] font-mono">{pasteResultMsg}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* A. Compact Tenant Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTenantCards.map(item => {
              const t = item.tenant;
              const r = readingsMap[t.id] || { elec: '', water: '' };

              return (
                <div
                  key={t.id}
                  className={`bg-[#18181B] border rounded-2xl p-4 shadow-lg transition-all space-y-3 ${
                    item.isConfirmed
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : item.isReady
                      ? 'border-[#76FF03]/40 bg-[#76FF03]/5'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Card Header: Room + Tenant Name + Rent */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs font-black font-mono">
                        Rm {t.roomNumber}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-white font-sans leading-tight">
                          {t.name}
                        </h3>
                        <p className="text-[11px] text-neutral-400">
                          {item.property ? item.property.name : 'Property'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-white font-mono">
                        {formatCurrency(t.rent)}
                      </span>
                      <p className="text-[10px] text-neutral-500 font-mono">Base Rent</p>
                    </div>
                  </div>

                  {/* Readings Inputs Grid: Manual Typing Only! No +1/+5 buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Electricity Reading */}
                    <div className="space-y-1.5 p-2.5 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-300 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Electricity
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Prev: {t.prevElecReading}
                        </span>
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.elec}
                        onChange={(e) => handleReadingChange(t.id, 'elec', e.target.value)}
                        placeholder={`e.g. ${t.prevElecReading + 10}`}
                        className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-amber-400/50"
                      />

                      {item.hasElec && (
                        <p className="text-[10px] text-amber-400 font-mono">
                          +{item.elecUnits} units ({formatCurrency(item.elecCost)})
                        </p>
                      )}
                    </div>

                    {/* Water Reading */}
                    <div className="space-y-1.5 p-2.5 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-300 flex items-center gap-1">
                          <Droplets className="w-3.5 h-3.5 text-sky-400" />
                          Water
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Prev: {t.prevWaterReading}
                        </span>
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.water}
                        onChange={(e) => handleReadingChange(t.id, 'water', e.target.value)}
                        placeholder={`e.g. ${t.prevWaterReading + 5}`}
                        className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-sky-400/50"
                      />

                      {item.hasWater && (
                        <p className="text-[10px] text-sky-400 font-mono">
                          +{item.waterUnits} units ({formatCurrency(item.waterCost)})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Status Indicator */}
                  <div className="flex items-center justify-between pt-1">
                    {item.isConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Bill Generated for {activeMonth}
                      </span>
                    ) : item.isReady ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#76FF03] font-mono">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Ready for Review (Total: {formatCurrency(item.totalDue)})
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500">
                        Enter both electricity & water to review
                      </span>
                    )}

                    {item.isReady && !item.isConfirmed && (
                      <button
                        onClick={() => handleOpenReview(t.id)}
                        className="text-xs font-bold text-white hover:text-[#76FF03] flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="sticky bottom-6 z-40 bg-[#18181B]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold text-white font-sans">
                {readyCount > 0 ? (
                  <span className="text-[#76FF03] font-mono font-black">{readyCount} tenant(s) ready for review</span>
                ) : (
                  <span className="text-neutral-400">No tenants ready yet (need both electricity & water)</span>
                )}
              </p>
              <p className="text-[10px] text-neutral-500">
                {confirmedCount} bill(s) confirmed and generated for this cycle
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  // Save draft readings
                  const updatesToSave: { id: string; currElec: number; currWater: number }[] = [];
                  tenantReadinessList.forEach(item => {
                    if (item.hasElec || item.hasWater) {
                      updatesToSave.push({
                        id: item.tenant.id,
                        currElec: item.numElec,
                        currWater: item.numWater
                      });
                    }
                  });
                  if (updatesToSave.length > 0) {
                    onSaveReadings(updatesToSave);
                    if (showToast) showToast('Draft meter readings saved permanently.', 'success');
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-3 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/5 cursor-pointer"
              >
                Save Draft
              </button>

              <button
                onClick={handleContinueToReview}
                disabled={readyCount === 0}
                className="flex-1 sm:flex-none px-6 py-3 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: Review Queue */}
      {/* ========================================================================= */}
      {currentStep === 'queue' && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white font-sans">Ready for Review</h2>
              <p className="text-sm text-neutral-400 mt-0.5">
                Tenants with both electricity and water readings entered for this cycle.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('entry')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold rounded-xl transition-all border border-white/5 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Readings</span>
            </button>
          </div>

          {readyQueue.length === 0 ? (
            <div className="bg-[#18181B] border border-white/10 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 bg-white/5 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No tenants ready yet</h3>
                <p className="text-sm text-neutral-400 max-w-sm mx-auto">
                  Go back and enter both electricity and water readings for your tenants to generate bills.
                </p>
              </div>
              <button
                onClick={() => setCurrentStep('entry')}
                className="px-6 py-3 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back to Readings</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {readyQueue.map(item => (
                <div
                  key={item.tenant.id}
                  className="bg-[#18181B] border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-white/10 text-white rounded-md text-xs font-black font-mono">
                        Rm {item.tenant.roomNumber}
                      </span>
                      <h3 className="font-bold text-base text-white font-sans">{item.tenant.name}</h3>
                      <span className="text-xs text-neutral-500">• {item.property?.name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 pt-1">
                      <span>Rent: <strong className="text-white">{formatCurrency(item.baseRent)}</strong></span>
                      <span>Elec ({item.elecUnits} U): <strong className="text-white">{formatCurrency(item.elecCost)}</strong></span>
                      <span>Water ({item.waterUnits} U): <strong className="text-white">{formatCurrency(item.waterCost)}</strong></span>
                      {item.openingBalance > 0 && (
                        <span>Arrears: <strong className="text-amber-400">{formatCurrency(item.openingBalance)}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Total Calculated</p>
                      <p className="text-xl font-black text-[#76FF03] font-mono leading-none mt-0.5">
                        {formatCurrency(item.totalDue)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenReview(item.tenant.id)}
                      className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>Review Bill</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: One-by-One Bill Review (Large Preview) */}
      {/* ========================================================================= */}
      {currentStep === 'review' && activeReviewItem && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep('queue')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold rounded-xl transition-all border border-white/5 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Queue</span>
            </button>

            <span className="text-xs text-neutral-400 font-mono">
              Reviewing Bill for {activeReviewItem.tenant.name}
            </span>
          </div>

          {/* Large Clear Full Bill Preview Card */}
          <div className="bg-[#18181B] border border-white/15 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
            {/* Header: Property & Tenant Info */}
            <div className="border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#76FF03] font-mono">Statement of Account</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight mt-1">
                  {activeReviewItem.tenant.name}
                </h2>
                <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                  <span>Room: <strong className="text-white">{activeReviewItem.tenant.roomNumber}</strong></span>
                  <span>•</span>
                  <span>Property: <strong className="text-white">{activeReviewItem.property?.name || 'Main Property'}</strong></span>
                </div>
              </div>

              <div className="text-left sm:text-right p-3 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 font-mono">Billing Cycle</p>
                <p className="text-base font-black text-white font-mono mt-0.5">{formatMonthStr(activeMonth)}</p>
                <p className="text-xs text-neutral-400">{activeMonth}</p>
              </div>
            </div>

            {/* Itemized Charges Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">Itemized Charges</h3>

              <div className="bg-black/40 border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
                {/* 1. Base Rent */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Monthly Base Rent</p>
                    <p className="text-xs text-neutral-400">Regular recurring room rate</p>
                  </div>
                  <span className="text-base font-black text-white font-mono">
                    {formatCurrency(activeReviewItem.baseRent)}
                  </span>
                </div>

                {/* 2. Electricity Fee */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <p className="text-sm font-bold text-white">Electricity Charges</p>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Prev: <strong className="text-neutral-300">{activeReviewItem.tenant.prevElecReading}</strong> → Curr: <strong className="text-neutral-300">{activeReviewItem.numElec}</strong> ({activeReviewItem.elecUnits} units @ ₹{activeReviewItem.property?.electricRate || 0}/U)
                    </p>
                  </div>
                  <span className="text-base font-black text-white font-mono">
                    {formatCurrency(activeReviewItem.elecCost)}
                  </span>
                </div>

                {/* 3. Water Fee */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-sky-400" />
                      <p className="text-sm font-bold text-white">Water Charges</p>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Prev: <strong className="text-neutral-300">{activeReviewItem.tenant.prevWaterReading}</strong> → Curr: <strong className="text-neutral-300">{activeReviewItem.numWater}</strong> ({activeReviewItem.waterUnits} units @ ₹{activeReviewItem.property?.waterRate || 0}/U)
                    </p>
                  </div>
                  <span className="text-base font-black text-white font-mono">
                    {formatCurrency(activeReviewItem.waterCost)}
                  </span>
                </div>

                {/* 4. Additional Charges / Other Fees */}
                {activeReviewItem.otherFees > 0 && (
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Additional Utility / Maintenance Fees</p>
                      <p className="text-xs text-neutral-400">Extra itemized expenses</p>
                    </div>
                    <span className="text-base font-black text-white font-mono">
                      {formatCurrency(activeReviewItem.otherFees)}
                    </span>
                  </div>
                )}

                {/* 5. Opening Balance / Arrears */}
                <div className="p-4 flex items-center justify-between bg-amber-500/5">
                  <div>
                    <p className="text-sm font-bold text-amber-300">Previous Arrears / Balance Forward</p>
                    <p className="text-xs text-amber-200/70">Unpaid dues from previous cycle</p>
                  </div>
                  <span className={`text-base font-black font-mono ${activeReviewItem.openingBalance > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {formatCurrency(activeReviewItem.openingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Summary Banner */}
            <div className="p-5 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-black border border-[#76FF03]/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#76FF03] font-mono">Net Payable Amount</p>
                <p className="text-xs text-neutral-400 mt-0.5">Total due for {formatMonthStr(activeMonth)} cycle</p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                  {formatCurrency(activeReviewItem.totalDue)}
                </span>
              </div>
            </div>

            {/* Bottom Buttons: Confirm & Generate vs Skip/Back */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setCurrentStep('queue')}
                className="w-full sm:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-sm rounded-xl transition-all border border-white/5 cursor-pointer"
              >
                Skip / Back to Queue
              </button>

              <button
                onClick={() => handleConfirmBill(activeReviewItem)}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Confirm & Generate Bill</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: Completion */}
      {/* ========================================================================= */}
      {currentStep === 'completion' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="space-y-6"
        >
          <div className="bg-[#18181B] border border-white/15 rounded-3xl p-8 sm:p-12 text-center space-y-8 shadow-2xl">
            {/* Celebration Icon */}
            <div className="w-20 h-20 bg-[#76FF03]/10 border-2 border-[#76FF03]/40 rounded-full flex items-center justify-center mx-auto text-[#76FF03] shadow-lg shadow-[#76FF03]/10">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-3xl sm:text-4xl font-black text-white font-sans tracking-tight">
                Billing Cycle Complete!
              </h2>
              <p className="text-base text-neutral-300 font-sans">
                <strong className="text-white">{confirmedCount} bill(s)</strong> have been generated successfully for <strong className="text-[#76FF03]">{formatMonthStr(activeMonth)}</strong>.
              </p>
              <p className="text-xs text-neutral-500 font-mono pt-1">
                All records, meter readings, and arrears have been permanently written to storage.
              </p>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Confirmed Bills</p>
                <p className="text-2xl font-black text-white font-mono mt-1">{confirmedCount}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Billing Cycle</p>
                <p className="text-base font-black text-[#76FF03] font-mono mt-2">{activeMonth}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Status</p>
                <p className="text-base font-black text-emerald-400 font-mono mt-2">Saved Permanently</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setCurrentStep('entry')}
                className="w-full sm:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/5 cursor-pointer"
              >
                Generate More Bills
              </button>

              <button
                onClick={onNavigateToTenants}
                className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/10 cursor-pointer"
              >
                Go to Tenants Ledger
              </button>

              <button
                onClick={onBack}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#76FF03] hover:bg-[#68e000] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
