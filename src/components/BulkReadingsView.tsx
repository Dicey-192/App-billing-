import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Check, RotateCcw, Zap, Droplets, Sparkles, 
  AlertTriangle, Search, ShieldCheck, 
  FileSpreadsheet, X, Trash2
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

  // Tracking edited rows
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

  // Sync local readings if tenants change
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

  // Handle single field update
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

  // Quick Action Fillers across visible tenants
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
        reset_prev: 'Reset all visible readings to previous values.',
        add5_elec: 'Added +5 units to Electricity for all visible tenants.',
        add1_water: 'Added +1 unit to Water for all visible tenants.',
        clear_all: 'Cleared current readings for all visible tenants.'
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
      const tokens = line.split(/\t|,|\s{2,}/).map(tok => tok.trim()).filter(tok => tok.length > 0);

      if (tokens.length === 0) return;

      let roomOrName = '';
      let elecVal: number | null = null;
      let waterVal: number | null = null;

      if (tokens.length >= 3) {
        roomOrName = tokens[0];
        elecVal = parseFloat(tokens[1]);
        waterVal = parseFloat(tokens[2]);
      } else if (tokens.length === 2) {
        if (isNaN(Number(tokens[0]))) {
          roomOrName = tokens[0];
          elecVal = parseFloat(tokens[1]);
        } else {
          elecVal = parseFloat(tokens[0]);
          waterVal = parseFloat(tokens[1]);
        }
      } else if (tokens.length === 1) {
        elecVal = parseFloat(tokens[0]);
      }

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
      showToast(`Parsed ${parsedList.length} rows (${matchCount} matched).`);
    }
  };

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

    onSave(updates);

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
      showToast('All meter readings saved and balances updated successfully!');
    }

    onBack();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 flex flex-col font-sans">
      
      {/* 1. Full Page Top Header */}
      <header className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-xl border-b border-white/10 px-4 py-4 sm:px-8 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Title, Period & Back button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 bg-[#181818] hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Return to Tenants"
            >
              <ArrowLeft className="w-5 h-5 text-blue-400" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Bulk Meter Readings
                </h1>
                <span className="text-xs bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 rounded-full font-mono text-amber-400 font-bold">
                  {activeMonth || 'Active Billing Cycle'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fast card-based utility entry for high-volume monthly readings.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 bg-[#181818] border border-white/10 px-3.5 py-1.5 rounded-xl font-mono text-xs">
            <span className="text-slate-400">Modified:</span>
            <span className="text-amber-400 font-bold">{editedTenantIds.size} / {tenants.length}</span>
          </div>

        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-28">

        {/* Validation Errors Alert */}
        {validationErrors.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs space-y-2">
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

        {/* 2. Top Row: Paste Spreadsheet | Reset All to Previous */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setShowPasteTool(!showPasteTool)}
            className={`p-3.5 border rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              showPasteTool 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                : 'bg-[#111111] hover:bg-white/10 border-white/10 text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>{showPasteTool ? 'Hide Paste Tool' : 'Paste Spreadsheet'}</span>
          </button>

          <button
            onClick={() => handleQuickAction('reset_prev')}
            className="p-3.5 bg-[#111111] hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Reset All to Previous</span>
          </button>
        </div>

        {/* Expandable Bulk Spreadsheet Paste Feature */}
        <AnimatePresence>
          {showPasteTool && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 bg-[#111111] border border-amber-500/30 rounded-3xl space-y-4 shadow-2xl relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-amber-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Spreadsheet Bulk Data Import
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Copy cells directly from Excel or Google Sheets (Room | Elec | Water). Paste them below.
                    </p>
                  </div>
                  <button onClick={() => setShowPasteTool(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={`Copy & paste Excel rows here...\nExample:\n101\t1250\t340\n102\t1400\t410\n103\t1550\t480`}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl p-3.5 font-mono text-xs text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-y"
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 italic">
                      Columns: Room/Name, Elec, Water (tab or comma separated).
                    </p>
                    <button
                      onClick={handleParsePaste}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider hover:bg-amber-400 cursor-pointer flex items-center gap-1.5 shadow-md"
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
                        <span>Parsed Preview ({parsedRows.filter(r => r.isMatched).length} / {parsedRows.length} Matched)</span>
                      </h4>
                      <button
                        onClick={handleApplyParsedData}
                        disabled={parsedRows.filter(r => r.matchedTenantId).length === 0}
                        className="px-4 py-1.5 bg-green-500 hover:bg-green-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40 shadow-md"
                      >
                        Apply Parsed Values
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-white/10 rounded-2xl bg-[#0A0A0A]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/10 sticky top-0 bg-[#111111]">
                          <tr>
                            <th className="px-3 py-2">Raw Line</th>
                            <th className="px-3 py-2">Matched Tenant</th>
                            <th className="px-3 py-2">Pasted Elec</th>
                            <th className="px-3 py-2">Pasted Water</th>
                            <th className="px-3 py-2">Status</th>
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
                                  className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs text-white"
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

        {/* 3. Second Row: +5 All Elec | +1 All Water | Clear All */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleQuickAction('add5_elec')}
            className="p-3 bg-[#111111] hover:bg-amber-500/10 border border-amber-500/20 rounded-2xl font-extrabold text-xs uppercase tracking-wider text-amber-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>+5 All Elec</span>
          </button>

          <button
            onClick={() => handleQuickAction('add1_water')}
            className="p-3 bg-[#111111] hover:bg-cyan-500/10 border border-cyan-500/20 rounded-2xl font-extrabold text-xs uppercase tracking-wider text-cyan-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span>+1 All Water</span>
          </button>

          <button
            onClick={() => handleQuickAction('clear_all')}
            className="p-3 bg-[#111111] hover:bg-red-500/10 border border-red-500/20 rounded-2xl font-extrabold text-xs uppercase tracking-wider text-red-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Clear All</span>
          </button>
        </div>

        {/* 4. Filters: Search + Property Dropdown + Sort */}
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenant name or room number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#181818] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Property Filter Dropdown */}
            <select
              value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value)}
              className="w-full sm:w-48 bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="w-full sm:w-44 bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="room-asc">Room Number ↑</option>
              <option value="room-desc">Room Number ↓</option>
              <option value="name-asc">Tenant Name</option>
            </select>
          </div>
        </div>

        {/* 5. Main Area: Vertical Stacked Tenant Cards */}
        <div className="space-y-4">
          {filteredSortedTenants.length === 0 ? (
            <div className="p-12 bg-[#111111] border border-dashed border-white/10 rounded-3xl text-center space-y-2">
              <Search className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">No tenants match the active filters</h4>
              <p className="text-xs text-slate-500">Try adjusting your search query or property filter.</p>
            </div>
          ) : (
            filteredSortedTenants.map((t) => {
              const r = readings[t.id] || { currElec: t.currElecReading, currWater: t.currWaterReading };
              const prop = properties.find(p => p.id === t.propertyId);
              
              const elecUnits = Math.max(0, r.currElec - t.prevElecReading);
              const waterUnits = Math.max(0, r.currWater - t.prevWaterReading);
              
              const isElecDecreased = r.currElec < t.prevElecReading;
              const isWaterDecreased = r.currWater < t.prevWaterReading;
              const isEdited = editedTenantIds.has(t.id);

              return (
                <div 
                  key={t.id}
                  className={`bg-[#111111] border rounded-3xl p-5 space-y-4 transition-all shadow-lg ${
                    isEdited 
                      ? 'border-amber-500/30 bg-[#141414]' 
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Card Header: Room Number, Tenant Name, Property, Base Rent & Calculated Units Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-black rounded-xl shrink-0">
                        RM {t.roomNumber}
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-white leading-tight flex items-center gap-2">
                          {t.name}
                          {isEdited && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              Edited
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {prop?.name || 'Property'} • Contract Rent: <span className="text-slate-200 font-bold">${t.rent}</span>
                        </p>
                      </div>
                    </div>

                    {/* Calculated Units Badges */}
                    <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto">
                      <span className={`px-2.5 py-1 rounded-xl font-bold border ${
                        isElecDecreased ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        ⚡ +{elecUnits} U
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl font-bold border ${
                        isWaterDecreased ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      }`}>
                        💧 +{waterUnits} U
                      </span>
                    </div>
                  </div>

                  {/* Prominent Input Grid: Electricity & Water Side-by-Side on Desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Electricity Input Block */}
                    <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" /> Electricity Reading
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          Prev: <strong className="text-slate-200 font-bold">{t.prevElecReading}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          step="any"
                          value={r.currElec}
                          onChange={e => handleCellUpdate(t.id, 'currElec', parseFloat(e.target.value))}
                          className={`w-full bg-[#0D0D0D] border rounded-xl px-4 py-2.5 font-mono text-lg font-black text-amber-300 focus:outline-none transition-all ${
                            isElecDecreased 
                              ? 'border-red-500/60 bg-red-500/10 focus:border-red-500' 
                              : 'border-white/10 focus:border-amber-500'
                          }`}
                        />
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currElec', r.currElec + 1)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-amber-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +1 unit"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currElec', r.currElec + 5)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-amber-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +5 units"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currElec', r.currElec + 10)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-amber-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +10 units"
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {isElecDecreased && (
                        <p className="text-[11px] text-red-400 font-mono flex items-center gap-1 pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Reading is lower than previous ({t.prevElecReading})
                        </p>
                      )}
                    </div>

                    {/* Water Input Block */}
                    <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5" /> Water Reading
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          Prev: <strong className="text-slate-200 font-bold">{t.prevWaterReading}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          step="any"
                          value={r.currWater}
                          onChange={e => handleCellUpdate(t.id, 'currWater', parseFloat(e.target.value))}
                          className={`w-full bg-[#0D0D0D] border rounded-xl px-4 py-2.5 font-mono text-lg font-black text-cyan-300 focus:outline-none transition-all ${
                            isWaterDecreased 
                              ? 'border-red-500/60 bg-red-500/10 focus:border-red-500' 
                              : 'border-white/10 focus:border-cyan-500'
                          }`}
                        />
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currWater', r.currWater + 1)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-cyan-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +1 unit"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currWater', r.currWater + 2)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-cyan-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +2 units"
                          >
                            +2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCellUpdate(t.id, 'currWater', r.currWater + 5)}
                            className="px-2.5 py-2.5 bg-[#222222] hover:bg-white/10 border border-white/10 text-cyan-400 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                            title="Add +5 units"
                          >
                            +5
                          </button>
                        </div>
                      </div>

                      {isWaterDecreased && (
                        <p className="text-[11px] text-red-400 font-mono flex items-center gap-1 pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Reading is lower than previous ({t.prevWaterReading})
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* 6. Sticky Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[#111111]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3.5 sm:px-8 shadow-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-[#181818] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 cursor-pointer transition-all"
          >
            Cancel & Discard
          </button>

          <button
            onClick={handleApplyAll}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Apply All Meter Readings</span>
          </button>
        </div>
      </footer>

    </div>
  );
};
