import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Check, RotateCcw, Zap, Droplets, Sparkles, 
  AlertTriangle, Upload, Search, Filter, ShieldCheck, 
  HelpCircle, ChevronDown, ChevronUp, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tenant, Property } from '../types';

interface BulkReadingsViewProps {
  tenants: Tenant[];
  properties: Property[];
  activeMonth: string;
  onBack: () => void;
  onSave: (updates: { id: string; currElec: number; currWater: number }[]) => void;
  addAuditLog?: (tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => void;
  recalculateBalances?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ParsedRow {
  rawLine: string;
  roomOrNameInput: string;
  matchedTenantId: string | null;
  currElec: number | null;
  currWater: number | null;
  isMatched: boolean;
  warning?: string;
}

export const BulkReadingsView: React.FC<BulkReadingsViewProps> = ({
  tenants,
  properties,
  activeMonth,
  onBack,
  onSave,
  addAuditLog,
  recalculateBalances,
  showToast
}) => {
  // Local state for readings map: tenantId -> { currElec, currWater }
  const [readings, setReadings] = useState<{ [id: string]: { currElec: number; currWater: number } }>(() => {
    return Object.fromEntries(
      tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }])
    );
  });

  // Tracking edited rows to display status count
  const [editedTenantIds, setEditedTenantIds] = useState<Set<string>>(new Set());

  // Search, Property Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [sortOrder, setSortOrder] = useState<'room-asc' | 'room-desc' | 'name-asc'>('room-asc');

  // Bulk Paste State
  const [showPasteTool, setShowPasteTool] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Initialize/sync local readings state if tenants list changes
  useEffect(() => {
    const initialMap = Object.fromEntries(
      tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }])
    );
    setReadings(initialMap);
  }, [tenants]);

  // Filter & Sort tenants
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

  // Handle single cell update
  const handleCellUpdate = (id: string, field: 'currElec' | 'currWater', val: number) => {
    const cleanVal = isNaN(val) ? 0 : val;
    setReadings(prev => {
      const current = prev[id] || { currElec: 0, currWater: 0 };
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: cleanVal
        }
      };
    });

    setEditedTenantIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Quick Action Fillers
  const handleQuickAction = (type: 'reset_prev' | 'add5_elec' | 'add1_water' | 'clear_all') => {
    const nextReadings = { ...readings };
    const nextEdited = new Set(editedTenantIds);

    filteredSortedTenants.forEach(t => {
      const current = nextReadings[t.id] || { currElec: t.currElecReading, currWater: t.currWaterReading };
      if (type === 'reset_prev') {
        nextReadings[t.id] = { currElec: t.prevElecReading, currWater: t.prevWaterReading };
      } else if (type === 'add5_elec') {
        nextReadings[t.id] = { ...current, currElec: (current.currElec || t.prevElecReading) + 5 };
      } else if (type === 'add1_water') {
        nextReadings[t.id] = { ...current, currWater: (current.currWater || t.prevWaterReading) + 1 };
      } else if (type === 'clear_all') {
        nextReadings[t.id] = { currElec: 0, currWater: 0 };
      }
      nextEdited.add(t.id);
    });

    setReadings(nextReadings);
    setEditedTenantIds(nextEdited);

    if (showToast) {
      const labels = {
        reset_prev: 'All current readings reset to previous readings.',
        add5_elec: 'Added +5 units to Electricity for visible tenants.',
        add1_water: 'Added +1 unit to Water for visible tenants.',
        clear_all: 'Cleared current readings for visible tenants.'
      };
      showToast(labels[type]);
    }
  };

  // Bulk Paste Parsing logic
  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      if (showToast) showToast('Please paste table data into the box first.', 'error');
      return;
    }

    const lines = pasteText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const parsedList: ParsedRow[] = [];

    lines.forEach((line, index) => {
      // Split by tab, comma, or multiple spaces
      const tokens = line.split(/\t|,|\s{2,}/).map(tok => tok.trim()).filter(tok => tok.length > 0);

      if (tokens.length === 0) return;

      let roomOrName = '';
      let elecVal: number | null = null;
      let waterVal: number | null = null;

      // Extract numeric values and identifier
      if (tokens.length >= 3) {
        roomOrName = tokens[0];
        elecVal = parseFloat(tokens[1]);
        waterVal = parseFloat(tokens[2]);
      } else if (tokens.length === 2) {
        // If 2 tokens: check if first is identifier or number
        if (isNaN(Number(tokens[0]))) {
          roomOrName = tokens[0];
          elecVal = parseFloat(tokens[1]);
        } else {
          // Assume order: Elec, Water for index matching
          elecVal = parseFloat(tokens[0]);
          waterVal = parseFloat(tokens[1]);
        }
      } else if (tokens.length === 1) {
        elecVal = parseFloat(tokens[0]);
      }

      // Try matching tenant
      let matchedTenant = null;
      if (roomOrName) {
        const q = roomOrName.toLowerCase();
        matchedTenant = tenants.find(t => 
          t.roomNumber.toLowerCase() === q || 
          t.name.toLowerCase() === q ||
          t.roomNumber.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
        );
      }

      // Fallback: match by index if no name/room matched
      if (!matchedTenant && index < filteredSortedTenants.length) {
        matchedTenant = filteredSortedTenants[index];
      }

      const isMatched = !!matchedTenant;
      let warning = undefined;

      if (!isMatched) {
        warning = 'Unable to match tenant room/name automatically.';
      } else if (elecVal !== null && !isNaN(elecVal) && elecVal < matchedTenant.prevElecReading) {
        warning = `Elec reading (${elecVal}) is lower than previous (${matchedTenant.prevElecReading}).`;
      }

      parsedList.push({
        rawLine: line,
        roomOrNameInput: roomOrName || (matchedTenant ? matchedTenant.roomNumber : `Row ${index + 1}`),
        matchedTenantId: matchedTenant ? matchedTenant.id : null,
        currElec: isNaN(elecVal!) ? null : elecVal,
        currWater: isNaN(waterVal!) ? null : waterVal,
        isMatched,
        warning
      });
    });

    setParsedRows(parsedList);
    setHasParsed(true);

    const matchCount = parsedList.filter(r => r.isMatched && r.matchedTenantId).length;
    if (showToast) {
      showToast(`Parsed ${parsedList.length} rows (${matchCount} matched automatically).`);
    }
  };

  // Apply parsed rows to local readings state
  const handleApplyParsedData = () => {
    const nextReadings = { ...readings };
    const nextEdited = new Set(editedTenantIds);
    let appliedCount = 0;

    parsedRows.forEach(row => {
      if (row.matchedTenantId) {
        const existing = nextReadings[row.matchedTenantId] || { currElec: 0, currWater: 0 };
        nextReadings[row.matchedTenantId] = {
          currElec: row.currElec !== null ? row.currElec : existing.currElec,
          currWater: row.currWater !== null ? row.currWater : existing.currWater,
        };
        nextEdited.add(row.matchedTenantId);
        appliedCount++;
      }
    });

    setReadings(nextReadings);
    setEditedTenantIds(nextEdited);
    setShowPasteTool(false);
    setHasParsed(false);
    setParsedRows([]);
    setPasteText('');

    if (showToast) {
      showToast(`Applied bulk readings to ${appliedCount} tenants!`);
    }
  };

  // Manual adjustment of parsed row tenant assignment
  const handleUpdateParsedRowTenant = (rowIndex: number, tenantId: string) => {
    setParsedRows(prev => {
      const next = [...prev];
      const targetTenant = tenants.find(t => t.id === tenantId);
      next[rowIndex] = {
        ...next[rowIndex],
        matchedTenantId: tenantId || null,
        isMatched: !!tenantId,
        warning: targetTenant && next[rowIndex].currElec !== null && next[rowIndex].currElec! < targetTenant.prevElecReading
          ? `Elec reading is lower than previous (${targetTenant.prevElecReading}).`
          : undefined
      };
      return next;
    });
  };

  // Final Validation before Apply
  const validateReadings = (): boolean => {
    const errors: string[] = [];

    tenants.forEach(t => {
      const r = readings[t.id];
      if (!r) return;

      if (r.currElec < 0) {
        errors.push(`Tenant ${t.name} (Room ${t.roomNumber}): Negative electric reading (${r.currElec}) is not permitted.`);
      }
      if (r.currWater < 0) {
        errors.push(`Tenant ${t.name} (Room ${t.roomNumber}): Negative water reading (${r.currWater}) is not permitted.`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Apply all changes atomically
  const handleApplyAll = () => {
    if (!validateReadings()) {
      if (showToast) showToast('Validation errors found. Please correct negative values before saving.', 'error');
      return;
    }

    const updates = tenants.map(t => ({
      id: t.id,
      currElec: readings[t.id]?.currElec ?? t.currElecReading,
      currWater: readings[t.id]?.currWater ?? t.currWaterReading
    }));

    // Perform save
    onSave(updates);

    // Audit Log recording
    editedTenantIds.forEach(id => {
      const t = tenants.find(item => item.id === id);
      if (t && addAuditLog) {
        const r = readings[id];
        addAuditLog(
          t.id,
          t.name,
          activeMonth || 'Current Cycle',
          'Bulk Meter Readings Update',
          `Elec: ${t.currElecReading}, Water: ${t.currWaterReading}`,
          `Elec: ${r.currElec}, Water: ${r.currWater}`
        );
      }
    });

    if (recalculateBalances) {
      recalculateBalances();
    }

    if (showToast) {
      showToast('Readings rolled over/applied successfully. Ready for new entries.');
    }

    onBack();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[#111111]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3.5 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Title & Back */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              title="Return to Tenants Ledger"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md">
                  <Zap className="w-3.5 h-3.5" />
                </span>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                  Bulk Meter Readings
                </h1>
                <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-amber-400 font-bold">
                  {activeMonth || 'Active Billing Cycle'}
                </span>
              </div>
              <p className="text-[11px] text-[#A3A3A3] mt-0.5">
                Full-page table view for high-speed monthly utility meter entries.
              </p>
            </div>
          </div>

          {/* Metrics & Save Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-slate-500">Edited:</span>
              <span className="text-amber-400 font-bold">{editedTenantIds.size} / {tenants.length}</span>
            </div>

            <button
              onClick={() => setShowPasteTool(!showPasteTool)}
              className={`px-3.5 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                showPasteTool 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>{showPasteTool ? 'Hide Paste Tool' : 'Paste Spreadsheet'}</span>
            </button>

            <button
              onClick={handleApplyAll}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Apply All Readings</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Validation Errors Alert */}
        {validationErrors.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs space-y-2 animate-shake">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Validation Errors Blocking Save ({validationErrors.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-red-300/90 font-mono text-[11px]">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Expandable Bulk Spreadsheet Paste Feature */}
        <AnimatePresence>
          {showPasteTool && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 bg-[#121212] border border-amber-500/30 rounded-2xl space-y-4 shadow-2xl relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-amber-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Spreadsheet Bulk Data Import & AI Matcher
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Copy cells directly from Excel or Google Sheets. Paste them below to match readings automatically.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white/5 border border-white/10 px-2 py-1 rounded">
                    Format: Room | Elec | Water
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={`Copy & paste Excel rows here...\nExample:\n101\t1250\t340\n102\t1400\t410\n103\t1550\t480`}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 font-mono text-xs text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-y"
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 italic">
                      Support columns: Room / Name, Current Elec, Current Water (tab or comma separated).
                    </p>
                    <button
                      onClick={handleParsePaste}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-amber-400 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse & Match Data</span>
                    </button>
                  </div>
                </div>

                {/* Parsed Preview Table */}
                {hasParsed && parsedRows.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-white tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span>Parsed Preview & Match Verification ({parsedRows.filter(r => r.isMatched).length} / {parsedRows.length} Matched)</span>
                      </h4>
                      <button
                        onClick={handleApplyParsedData}
                        disabled={parsedRows.filter(r => r.matchedTenantId).length === 0}
                        className="px-4 py-1.5 bg-green-500 hover:bg-green-400 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40"
                      >
                        Confirm & Fill Table
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-white/10 rounded-xl bg-slate-950/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/10 sticky top-0 bg-[#121212]">
                          <tr>
                            <th className="px-3 py-2">Row Line</th>
                            <th className="px-3 py-2">Matched Tenant</th>
                            <th className="px-3 py-2">Pasted Elec</th>
                            <th className="px-3 py-2">Pasted Water</th>
                            <th className="px-3 py-2">Status / Warnings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                          {parsedRows.map((row, idx) => (
                            <tr key={idx} className={row.isMatched ? 'hover:bg-green-500/5' : 'bg-red-500/10'}>
                              <td className="px-3 py-2 text-slate-400 max-w-[150px] truncate">{row.rawLine}</td>
                              <td className="px-3 py-2 font-sans">
                                <select
                                  value={row.matchedTenantId || ''}
                                  onChange={e => handleUpdateParsedRowTenant(idx, e.target.value)}
                                  className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                >
                                  <option value="">-- Unmatched --</option>
                                  {tenants.map(t => (
                                    <option key={t.id} value={t.id}>
                                      RM {t.roomNumber} - {t.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-amber-300 font-bold">{row.currElec !== null ? row.currElec : '—'}</td>
                              <td className="px-3 py-2 text-cyan-300 font-bold">{row.currWater !== null ? row.currWater : '—'}</td>
                              <td className="px-3 py-2">
                                {row.warning ? (
                                  <span className="text-red-400 text-[10px]">{row.warning}</span>
                                ) : row.isMatched ? (
                                  <span className="text-green-400 text-[10px] font-bold">✓ Ready</span>
                                ) : (
                                  <span className="text-amber-400 text-[10px]">Select Tenant</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Toolbar & Filters */}
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Quick Fill Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">
                Global Actions:
              </span>
              
              <button
                onClick={() => handleQuickAction('reset_prev')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset All to Previous</span>
              </button>

              <button
                onClick={() => handleQuickAction('add5_elec')}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>+5 to All Elec</span>
              </button>

              <button
                onClick={() => handleQuickAction('add1_water')}
                className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>+1 to All Water</span>
              </button>

              <button
                onClick={() => handleQuickAction('clear_all')}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-all cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter name or room..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {properties.length > 1 && (
                <select
                  value={selectedPropertyId}
                  onChange={e => setSelectedPropertyId(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">All Properties</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as any)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="room-asc">Sort: Room ↑</option>
                <option value="room-desc">Sort: Room ↓</option>
                <option value="name-asc">Sort: Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dedicated Full Page Table Grid */}
        <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase font-mono font-bold text-slate-400">
                <tr>
                  <th className="px-5 py-4 w-56">Tenant / Room</th>
                  <th className="px-4 py-4 w-28 text-slate-500">Prev Elec</th>
                  <th className="px-5 py-4 min-w-[200px]">Current Elec Reading</th>
                  <th className="px-4 py-4 w-28 text-slate-500">Prev Water</th>
                  <th className="px-5 py-4 min-w-[200px]">Current Water Reading</th>
                  <th className="px-5 py-4 text-right">Units & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSortedTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                      No tenants found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSortedTenants.map((t) => {
                    const r = readings[t.id] || { currElec: t.currElecReading, currWater: t.currWaterReading };
                    const elecUnits = Math.max(0, r.currElec - t.prevElecReading);
                    const waterUnits = Math.max(0, r.currWater - t.prevWaterReading);
                    
                    const isElecDecreased = r.currElec < t.prevElecReading;
                    const isWaterDecreased = r.currWater < t.prevWaterReading;
                    const isEdited = editedTenantIds.has(t.id);

                    return (
                      <tr 
                        key={t.id} 
                        className={`transition-colors hover:bg-white/[0.02] ${
                          isEdited ? 'bg-amber-500/[0.02]' : ''
                        }`}
                      >
                        {/* Tenant Name & Room Number */}
                        <td className="px-5 py-4 sticky left-0 bg-[#111111]/90 backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                              RM {t.roomNumber}
                            </span>
                            <div>
                              <p className="font-bold text-white text-xs leading-tight">{t.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Rent: ${t.rent}</p>
                            </div>
                          </div>
                        </td>

                        {/* Previous Electric */}
                        <td className="px-4 py-4 font-mono text-slate-500 text-xs">
                          {t.prevElecReading}
                        </td>

                        {/* Current Electric Input */}
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                step="any"
                                value={r.currElec}
                                onChange={e => handleCellUpdate(t.id, 'currElec', parseFloat(e.target.value))}
                                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 font-mono text-sm font-bold text-amber-400 focus:outline-none focus:ring-2 transition-all ${
                                  isElecDecreased 
                                    ? 'border-red-500/50 focus:ring-red-500/50 bg-red-500/5' 
                                    : 'border-white/10 focus:ring-amber-500/50'
                                }`}
                              />
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCellUpdate(t.id, 'currElec', r.currElec + 5)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-amber-400 text-[9px] font-mono font-bold rounded cursor-pointer"
                                  title="Add +5 units"
                                >
                                  +5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCellUpdate(t.id, 'currElec', r.currElec + 10)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-amber-400 text-[9px] font-mono font-bold rounded cursor-pointer"
                                  title="Add +10 units"
                                >
                                  +10
                                </button>
                              </div>
                            </div>

                            {isElecDecreased && (
                              <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                Lower than prev ({t.prevElecReading})
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Previous Water */}
                        <td className="px-4 py-4 font-mono text-slate-500 text-xs">
                          {t.prevWaterReading}
                        </td>

                        {/* Current Water Input */}
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                step="any"
                                value={r.currWater}
                                onChange={e => handleCellUpdate(t.id, 'currWater', parseFloat(e.target.value))}
                                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 font-mono text-sm font-bold text-cyan-400 focus:outline-none focus:ring-2 transition-all ${
                                  isWaterDecreased 
                                    ? 'border-red-500/50 focus:ring-red-500/50 bg-red-500/5' 
                                    : 'border-white/10 focus:ring-cyan-500/50'
                                }`}
                              />
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCellUpdate(t.id, 'currWater', r.currWater + 1)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-cyan-400 text-[9px] font-mono font-bold rounded cursor-pointer"
                                  title="Add +1 unit"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCellUpdate(t.id, 'currWater', r.currWater + 5)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-cyan-400 text-[9px] font-mono font-bold rounded cursor-pointer"
                                  title="Add +5 units"
                                >
                                  +5
                                </button>
                              </div>
                            </div>

                            {isWaterDecreased && (
                              <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                Lower than prev ({t.prevWaterReading})
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Calculated Units & Badge */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                ⚡ +{elecUnits} U
                              </span>
                              <span className="text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                                💧 +{waterUnits} U
                              </span>
                            </div>
                            {isEdited && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-amber-500/80">
                                ● Modified
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Footer */}
          <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Showing <span className="text-white font-bold">{filteredSortedTenants.length}</span> of {tenants.length} tenants.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 cursor-pointer transition-all"
              >
                Cancel & Discard
              </button>
              <button
                onClick={handleApplyAll}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer shadow-lg transition-all"
              >
                Apply All Meter Readings
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
