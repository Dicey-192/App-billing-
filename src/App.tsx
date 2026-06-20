/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sidebar, ViewType } from './components/Navigation';
import { useStorage } from './lib/storage';
import { formatCurrency, generateId, cn, getTenantBillingDetails, formatMonthStr } from './lib/utils';
import { Property, Tenant, AppData, PaymentRecord } from './types';
import { Plus, Search, Filter, Download, MoreVertical, Trash2, Edit2, AlertCircle, FileText, CheckCircle2, LayoutGrid, List, Home, History, Upload, Users, Undo2, Redo2, Database, Calendar, CreditCard, MessageCircle, Send, ArrowDownUp, Clipboard, ChevronRight, X, Check, Bell, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptTemplate } from './components/ReceiptTemplate';
import { AIAssistant } from './components/AIAssistant';
import html2canvas from 'html2canvas';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { ExpensesView } from './components/ExpensesView';
import { db, AuditDB } from './lib/db';

const oklabToRgbString = (L: number, a: number, b: number, alpha: number): string => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076182910 * s;

  const gamma = (x: number) => {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };

  const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(bl) * 255)));

  if (isNaN(R) || isNaN(G) || isNaN(B)) {
    return `rgb(128, 128, 128)`;
  }

  if (alpha === 1) {
    return `rgb(${R}, ${G}, ${B})`;
  } else {
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
};

const convertOklchToRgb = (oklchStr: string): string => {
  const oklchRegex = /oklch\(\s*([0-9.+-]+%?)\s*,?\s*([0-9.+-]+%?)\s*,?\s*([0-9.+-]+(?:deg|rad|turn)?%?)\s*(?:\/\s*([0-9.+-]+%?)|,\s*([0-9.+-]+%?))?\s*\)/gi;

  return oklchStr.replace(oklchRegex, (match, lStr, cStr, hStr, aStr1, aStr2) => {
    try {
      let L = parseFloat(lStr);
      if (lStr.includes('%')) L /= 100;

      let C = parseFloat(cStr);
      if (cStr.includes('%')) C /= 100;

      let H = parseFloat(hStr);
      if (hStr.includes('rad')) {
        H = (parseFloat(hStr) * 180) / Math.PI;
      } else if (hStr.includes('turn')) {
        H = parseFloat(hStr) * 360;
      }

      const aStr = aStr1 || aStr2;
      let alpha = 1;
      if (aStr) {
        alpha = parseFloat(aStr);
        if (aStr.includes('%')) alpha /= 100;
      }

      const hr = (H * Math.PI) / 180;
      const a = C * Math.cos(hr);
      const b = C * Math.sin(hr);

      return oklabToRgbString(L, a, b, alpha);
    } catch {
      return 'rgb(255, 255, 255)';
    }
  });
};

const convertOklabToRgb = (oklabStr: string): string => {
  const oklabRegex = /oklab\(\s*([0-9.+-]+%?)\s*,?\s*([0-9.+-]+%?)\s*,?\s*([0-9.+-]+%?)\s*(?:\/\s*([0-9.+-]+%?)|,\s*([0-9.+-]+%?))?\s*\)/gi;

  return oklabStr.replace(oklabRegex, (match, lStr, oklabA, oklabB, alphaStr1, alphaStr2) => {
    try {
      let L = parseFloat(lStr);
      if (lStr.includes('%')) L /= 100;

      let a = parseFloat(oklabA);
      if (oklabA.includes('%')) a /= 100;

      let b = parseFloat(oklabB);
      if (oklabB.includes('%')) b /= 100;

      const alphaValStr = alphaStr1 || alphaStr2;
      let alpha = 1;
      if (alphaValStr) {
        alpha = parseFloat(alphaValStr);
        if (alphaValStr.includes('%')) alpha /= 100;
      }

      return oklabToRgbString(L, a, b, alpha);
    } catch {
      return 'rgb(255, 255, 255)';
    }
  });
};

const cleanModernColors = (text: string): string => {
  if (!text) return text;
  let temp = text;
  if (/oklch/i.test(temp)) {
    temp = convertOklchToRgb(temp);
  }
  if (/oklab/i.test(temp)) {
    temp = convertOklabToRgb(temp);
  }
  if (/lab\(/i.test(temp)) {
    temp = temp.replace(/lab\([^)]+\)/gi, 'rgb(128,128,128)');
  }
  if (/lch\(/i.test(temp)) {
    temp = temp.replace(/lch\([^)]+\)/gi, 'rgb(128,128,128)');
  }
  return temp;
};

const safeHtml2Canvas = async (element: HTMLElement, options: any) => {
  const originalGetComputedStyle = window.getComputedStyle;

  // Intercept getComputedStyle to bypass native oklch / oklab style evaluations
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(property: string) {
            const val = target.getPropertyValue(property);
            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('lab(') || val.includes('lch('))) {
              return cleanModernColors(val);
            }
            return val;
          };
        }
        const val = target[prop as any];
        if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab') || val.includes('lab(') || val.includes('lch('))) {
          return cleanModernColors(val);
        }
        if (typeof val === 'function') {
          return (val as any).bind(target);
        }
        return val;
      }
    });
  };

  const originalNodes: Array<{ node: HTMLStyleElement | HTMLLinkElement; parent: Node; nextSibling: Node | null }> = [];
  const styleAndLinkElements = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')) as Array<HTMLStyleElement | HTMLLinkElement>;
  const tempStyles: HTMLStyleElement[] = [];

  let combinedCss = '';

  const processStyleSheet = (sheet: CSSStyleSheet) => {
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) return;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule instanceof CSSImportRule && rule.styleSheet) {
          processStyleSheet(rule.styleSheet);
        } else if (rule.cssText) {
          combinedCss += rule.cssText + '\n';
        }
      }
    } catch (e) {
      // Cross-origin rules or stylesheet loading permission exceptions: skip safely
    }
  };

  // 1. Gather all CSS rules from existing loaded stylesheet sheets
  const sheets = Array.from(document.styleSheets) as CSSStyleSheet[];
  for (const sheet of sheets) {
    processStyleSheet(sheet);
  }

  // 2. Detach original styles from DOM entirely so html2canvas's own stylesheet scanner never reads them
  for (const el of styleAndLinkElements) {
    if (el.parentNode) {
      originalNodes.push({
        node: el,
        parent: el.parentNode,
        nextSibling: el.nextSibling
      });
      el.parentNode.removeChild(el);
    }
  }

  // 3. Inject our temporary cleaned Stylesheet
  const sanitizedCss = cleanModernColors(combinedCss);
  const tempStyle = document.createElement('style');
  tempStyle.id = 'temp-clean-css-rules';
  tempStyle.textContent = sanitizedCss;
  document.head.appendChild(tempStyle);
  tempStyles.push(tempStyle);

  try {
    const canvas = await html2canvas(element, options);
    return canvas;
  } finally {
    // 4. Restore original window.getComputedStyle and stylesheet DOM nodes
    window.getComputedStyle = originalGetComputedStyle;

    for (const temp of tempStyles) {
      temp.remove();
    }

    for (let i = originalNodes.length - 1; i >= 0; i--) {
      const { node, parent, nextSibling } = originalNodes[i];
      if (nextSibling) {
        parent.insertBefore(node, nextSibling);
      } else {
        parent.appendChild(node);
      }
    }
  }
};

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { PropertyModal, TenantModal, BatchReadingModal, HistoryDetailModal, RolloverPromptModal, BulkTableModal, PaymentModal, TenantProfileModal } from './components/Modals';

export default function App() {
  const [currentView, setView] = useState<ViewType>('dashboard');
  const { data, properties, tenants, history, auditLogs, supportMasterOverrideMode, addProperty, updateProperty, deleteProperty, addTenant, updateTenant, updateTenants, deleteTenant, addHistory, addManyHistory, rollover, setActiveMonth, dismissRollover, updateHistoryTenant, cleanOldHistory, restoreData, quotaUsage, dataStats, setData, recalculateBalances, addAuditLog, toggleSupportMasterMode, clearAuditLogs } = useStorage();

  // Authentication role states
  const [currentUser, setCurrentUser] = useState<{ email: string; role: 'owner' | 'manager' | 'accountant' | 'readonly' } | null>({ email: 'me.ansari.aatif@gmail.com', role: 'owner' });
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Modals state
  const [profileModal, setProfileModal] = useState<{ open: boolean; tenant?: Tenant; property?: Property }>({ open: false });
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

  // Check Backup on mount
  useEffect(() => {
    db.get('ROLLOVER_BACKUP').then(b => setHasBackup(!!b));
  }, []);

  // State Diff Typings & State Mutators
  interface StateDiff {
    path: string;
    oldVal: any;
    newVal: any;
    timestamp: number;
  }

  const [beforeSnapshot, setBeforeSnapshot] = useState<AppData | null>(null);
  const [undoStack, setUndoStack] = useState<StateDiff[][]>([]);
  const [redoStack, setRedoStack] = useState<StateDiff[][]>([]);

  function setDeepValue(obj: any, path: string, val: any) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      let part = parts[i];
      const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/);
      if (arrayMatch) {
        const [, field, id] = arrayMatch;
        const arr = current[field];
        if (Array.isArray(arr)) {
          const item = arr.find((x: any) => x.id === id);
          if (item) current = item;
          else return;
        } else return;
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
    const lastPart = parts[parts.length - 1];
    current[lastPart] = val;
  }

  function computeStateDiff(oldState: AppData, newState: AppData): StateDiff[] {
    const diffs: StateDiff[] = [];
    const timestamp = Date.now();
    if (oldState.activeMonth !== newState.activeMonth) {
      diffs.push({ path: 'activeMonth', oldVal: oldState.activeMonth, newVal: newState.activeMonth, timestamp });
    }
    const oldProps = oldState.properties || [];
    const newProps = newState.properties || [];
    newProps.forEach(np => {
      const op = oldProps.find(p => p.id === np.id);
      if (op) {
        if (op.name !== np.name) diffs.push({ path: `properties[${np.id}].name`, oldVal: op.name, newVal: np.name, timestamp });
        if (op.address !== np.address) diffs.push({ path: `properties[${np.id}].address`, oldVal: op.address, newVal: np.address, timestamp });
        if (op.electricRate !== np.electricRate) diffs.push({ path: `properties[${np.id}].electricRate`, oldVal: op.electricRate, newVal: np.electricRate, timestamp });
        if (op.waterRate !== np.waterRate) diffs.push({ path: `properties[${np.id}].waterRate`, oldVal: op.waterRate, newVal: np.waterRate, timestamp });
      }
    });
    const oldTenants = oldState.tenants || [];
    const newTenants = newState.tenants || [];
    newTenants.forEach(nt => {
      const ot = oldTenants.find(t => t.id === nt.id);
      if (ot) {
        if (ot.name !== nt.name) diffs.push({ path: `tenants[${nt.id}].name`, oldVal: ot.name, newVal: nt.name, timestamp });
        if (ot.currElecReading !== nt.currElecReading) diffs.push({ path: `tenants[${nt.id}].currElecReading`, oldVal: ot.currElecReading, newVal: nt.currElecReading, timestamp });
        if (ot.currWaterReading !== nt.currWaterReading) diffs.push({ path: `tenants[${nt.id}].currWaterReading`, oldVal: ot.currWaterReading, newVal: nt.currWaterReading, timestamp });
        if (ot.prevElecReading !== nt.prevElecReading) diffs.push({ path: `tenants[${nt.id}].prevElecReading`, oldVal: ot.prevElecReading, newVal: nt.prevElecReading, timestamp });
        if (ot.prevWaterReading !== nt.prevWaterReading) diffs.push({ path: `tenants[${nt.id}].prevWaterReading`, oldVal: ot.prevWaterReading, newVal: nt.prevWaterReading, timestamp });
        if (ot.paidAmount !== nt.paidAmount) diffs.push({ path: `tenants[${nt.id}].paidAmount`, oldVal: ot.paidAmount, newVal: nt.paidAmount, timestamp });
        if (ot.isPaid !== nt.isPaid) diffs.push({ path: `tenants[${nt.id}].isPaid`, oldVal: ot.isPaid, newVal: nt.isPaid, timestamp });
        if (ot.previousDues !== nt.previousDues) diffs.push({ path: `tenants[${nt.id}].previousDues`, oldVal: ot.previousDues, newVal: nt.previousDues, timestamp });
      }
    });
    if (oldState.tenants?.length !== newState.tenants?.length) {
      diffs.push({ path: 'tenants', oldVal: oldState.tenants, newVal: newState.tenants, timestamp });
    }
    if (oldState.properties?.length !== newState.properties?.length) {
      diffs.push({ path: 'properties', oldVal: oldState.properties, newVal: newState.properties, timestamp });
    }
    if (oldState.history?.length !== newState.history?.length) {
      diffs.push({ path: 'history', oldVal: oldState.history, newVal: newState.history, timestamp });
    }
    return diffs;
  }

  function applyDiff(state: AppData, diff: StateDiff, reverse: boolean): AppData {
    const next = structuredClone(state);
    const valueToApply = reverse ? diff.oldVal : diff.newVal;
    if (diff.path === 'tenants' || diff.path === 'properties' || diff.path === 'history' || diff.path === 'activeMonth') {
      (next as any)[diff.path] = valueToApply;
    } else {
      setDeepValue(next, diff.path, valueToApply);
    }
    return next;
  }

  const pushToUndo = () => {
    setBeforeSnapshot(structuredClone(data));
  };

  useEffect(() => {
    if (beforeSnapshot) {
      const diffs = computeStateDiff(beforeSnapshot, data);
      if (diffs.length > 0) {
        setUndoStack(prev => [diffs, ...prev].slice(0, 30));
        setRedoStack([]);
      }
      setBeforeSnapshot(null);
    }
  }, [data, beforeSnapshot]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [lastDiffs, ...rest] = undoStack;
    
    setData(prev => {
      let current = structuredClone(prev);
      for (const diff of lastDiffs) {
        current = applyDiff(current, diff, true);
      }
      return current;
    });

    setRedoStack(prev => [lastDiffs, ...prev].slice(0, 30));
    setUndoStack(rest);
    showToast('Action undone');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const [nextDiffs, ...rest] = redoStack;

    setData(prev => {
      let current = structuredClone(prev);
      for (const diff of nextDiffs) {
        current = applyDiff(current, diff, false);
      }
      return current;
    });

    setUndoStack(prev => [nextDiffs, ...prev].slice(0, 30));
    setRedoStack(rest);
    showToast('Action redone');
  };

  // Keyboard Command Palette and Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette(prev => !prev);
        setPaletteQuery('');
      } else if (e.key === 'Escape') {
        setShowPalette(false);
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

  // Smart Alerts state
  const smartAlerts = useMemo(() => {
    const alerts: { id: string; text: string; type: 'warning' | 'info' | 'success' }[] = [];
    let allPaid = true;

    tenants.forEach((t: any) => {
      const prop = properties.find((p: any) => p.id === t.propertyId);
      if (!prop) return;
      const detail = getTenantBillingDetails(t, prop);
      const outstanding = detail.totalDue - (t.paidAmount || 0);

      if (!t.isPaid && outstanding > 0) {
        allPaid = false;
        alerts.push({
          id: `overdue-${t.id}`,
          text: `Overdue: ${t.name} — NPR ${outstanding.toLocaleString()}`,
          type: 'warning'
        });
      }

      if (t.currElecReading === t.prevElecReading) {
        alerts.push({
          id: `elec-${t.id}`,
          text: `Missing electric reading: ${t.name} (Rm ${t.roomNumber})`,
          type: 'info'
        });
      }
      if (t.currWaterReading === t.prevWaterReading) {
        alerts.push({
          id: `water-${t.id}`,
          text: `Missing water reading: ${t.name} (Rm ${t.roomNumber})`,
          type: 'info'
        });
      }
    });

    if (tenants.length > 0 && allPaid) {
      alerts.push({
        id: 'all-clear',
        text: 'All payments cleared this month.',
        type: 'success'
      });
    }

    return alerts;
  }, [tenants, properties]);

  // Month detection effect
  useEffect(() => {
    if (properties.length === 0) return;
    
    // YYYY-MM format used for storage as string
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
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

  const handleRollover = (confirmedMonth?: string, carryForwardUtilities = true) => {
    // Role check: Only Owner has permissions to perform rollover
    if (currentUser && currentUser.role !== 'owner') {
      showToast('Access Denied: Billing Rollover requires Owner permissions.');
      return;
    }

    setIsRollingOver(true);
    
    setTimeout(async () => {
      try {
        console.log('[DEBUG-ROLLOVER] Starting thread-yielded handleRollover.');
        
        // 0.5 — Save pre-rollover backup snapshot
        await db.set('ROLLOVER_BACKUP', data);
        setHasBackup(true);

        const targetProperties = properties;
        if (targetProperties.length === 0 || tenants.length === 0) {
          console.warn('[DEBUG-ROLLOVER] Cannot roll over; holdings empty.');
          setIsRollingOver(false);
          return;
        }

        // Determine correct month (storing strictly as locale-independent YYYY-MM)
        let month = confirmedMonth;
        if (!month) {
          const d = new Date();
          month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        
        let historyEntries: any[] = [];
        let tenantUpdates: { id: string; updates: Partial<Tenant> }[] = [];
        let rolledOverTenants: Tenant[] = [];

        let propIdx = 0;
        let propIterations = 0;
        const maxIterations = 500;

        while (propIdx < targetProperties.length) {
          propIterations++;
          if (propIterations > maxIterations) {
            console.error('[ROLLOVER] Safe guard limit triggered on properties loop.');
            break;
          }

          const prop = targetProperties[propIdx];
          propIdx++;

          const propertyTenants = tenants.filter(t => t.propertyId === prop.id);
          if (propertyTenants.length === 0) continue;

          // Snapshot entry
          const snapshotEntry = {
            id: crypto.randomUUID(),
            propertyId: prop.id,
            month,
            snapshot: {
              property: { id: prop.id, name: prop.name, address: prop.address, electricRate: prop.electricRate, waterRate: prop.waterRate, defaultExpenses: prop.defaultExpenses },
              tenants: propertyTenants.map(t => ({
                id: t.id,
                name: t.name,
                roomNumber: t.roomNumber,
                rent: t.rent,
                previousDues: t.previousDues,
                prevElecReading: t.prevElecReading,
                currElecReading: t.currElecReading,
                prevWaterReading: t.prevWaterReading,
                currWaterReading: t.currWaterReading,
                isPaid: t.isPaid,
                paidAmount: t.paidAmount || 0,
                expenses: t.expenses,
                manualOverrides: t.manualOverrides ? { ...t.manualOverrides } : undefined
              })),
            },
            createdAt: Date.now(),
          };
          historyEntries.push(snapshotEntry);

          let tenantIdx = 0;
          let tenantIterations = 0;
          while (tenantIdx < propertyTenants.length) {
            tenantIterations++;
            if (tenantIterations > maxIterations) {
              console.error('[ROLLOVER] Safe guard limit triggered on tenants loop.');
              break;
            }

            const t = propertyTenants[tenantIdx];
            tenantIdx++;

            const billing = getTenantBillingDetails(t, prop);
            
            // balanceForward = outstandingBalance (net dues remaining of previous outstanding + current charges - paidAmount)
            const balanceForward = billing.outstandingBalance;

            const updates = {
              prevElecReading: t.currElecReading,
              currElecReading: carryForwardUtilities ? t.currElecReading : 0,
              prevWaterReading: t.currWaterReading,
              currWaterReading: carryForwardUtilities ? t.currWaterReading : 0,
              isPaid: balanceForward <= 0,
              paidAmount: 0,
              payments: [],
              previousDues: balanceForward, // Negative represents landlord credit carry over!
              manualOverrides: undefined,   // Clear overrides to prevent downstream corruption
              updatedAt: Date.now(),
            };

            tenantUpdates.push({ id: t.id, updates });
            rolledOverTenants.push({ ...t, ...updates });
          }
        }

        if (historyEntries.length > 0 || tenantUpdates.length > 0) {
          rollover(month, historyEntries, tenantUpdates);
          
          // Secure system audit logging
          await AuditDB.addAuditEntry(
            'ROLLOVER',
            currentUser ? currentUser.email : 'System',
            `Ran billing cycle rollover for period ${month}. Snapshots recorded: ${historyEntries.length}. Total tenant updates: ${tenantUpdates.length}`,
            null,
            null
          );
        }

        setBatchModal({ open: true, tenants: rolledOverTenants });
        showToast('Billing rollover completed successfully!');

        // 0.5 — Null temp variables for garbage collection / memory safety
        historyEntries = null;
        tenantUpdates = null;
        rolledOverTenants = null;

      } catch (err) {
        console.error('[ROLLOVER_ERROR]', err);
        showToast('Rollover failed due to data error.');
      } finally {
        setIsRollingOver(false);
      }
    }, 10);
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
        const canvas = await safeHtml2Canvas(element, { scale: 2, backgroundColor: '#020617' });
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
        
        const message = getWhatsAppMessage(tenant, prop);
        const encodedMsg = encodeURIComponent(message);
        const waUrl = `https://wa.me/${tenant.whatsappNumber.replace(/\D/g, '')}?text=${encodedMsg}`;

        // Attempt Web Share API first (best for mobile)
        let shared = false;
        let attemptShare = false;
        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'bill.png', { type: 'image/png' })] })) {
            attemptShare = true;
          }
        } catch (canShareError) {
          console.warn("navigator.canShare check failed:", canShareError);
        }

        if (attemptShare) {
          try {
            await navigator.share({
              files: [new File([blob], 'bill.png', { type: 'image/png' })],
              title: `Bill for ${tenant.name}`,
              text: message,
            });
            showToast('Shared successfully');
            shared = true;
          } catch (shareError: any) {
            console.warn("navigator.share failed or canceled:", shareError);
            const isCancel = shareError.name === 'AbortError' || (shareError.message && (shareError.message.toLowerCase().includes('cancel') || shareError.message.toLowerCase().includes('abort')));
            if (isCancel) {
              showToast('Share canceled');
              shared = true; // User intentionally cancelled; do not trigger fallback
            }
          }
        }

        if (!shared) {
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
    if (currentUser?.role !== 'owner') {
      showToast('Access Denied: Owner permissions required to delete properties.');
      return;
    }
    if (confirm('Are you sure you want to delete this property? All associated tenants will also be removed.')) {
      pushToUndo();
      deleteProperty(id);
      showToast('Property deleted');
    }
  };

  const handleDeleteTenant = (id: string) => {
    if (currentUser?.role !== 'owner') {
      showToast('Access Denied: Owner permissions required to delete tenants.');
      return;
    }
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

  // Keyboard shortcut search filter logic
  const searchPaletteItems = () => {
    if (!paletteQuery) return [];
    
    const results: { text: string; category: string; action: () => void }[] = [];
    
    // Filter properties
    properties.forEach(p => {
      if (p.name.toLowerCase().includes(paletteQuery.toLowerCase())) {
        results.push({
          text: `Property: ${p.name} (${p.address})`,
          category: 'Properties',
          action: () => {
            setSelectedPropertyId(p.id);
            setView('tenants');
            setShowPalette(false);
          }
        });
      }
    });

    // Filter tenants
    tenants.forEach(t => {
      if (t.name.toLowerCase().includes(paletteQuery.toLowerCase())) {
        results.push({
          text: `Tenant: ${t.name} (Rm ${t.roomNumber})`,
          category: 'Tenants',
          action: () => {
            setSelectedPropertyId(t.propertyId);
            setView('tenants');
            setShowPalette(false);
          }
        });
      }
    });

    // Navigation sections
    const sections = [
      { text: 'Analytics Dashboard', view: 'dashboard' },
      { text: 'Tenants Ledger Ledger', view: 'tenants' },
      { text: 'Corporate Expenses Ledger', view: 'expenses' },
      { text: 'Administrative Hub / Settings', view: 'admin' }
    ];

    sections.forEach(s => {
      if (s.text.toLowerCase().includes(paletteQuery.toLowerCase())) {
        results.push({
          text: `Go to ${s.text}`,
          category: 'Navigation',
          action: () => {
            setView(s.view as any);
            setShowPalette(false);
          }
        });
      }
    });

    return results.slice(0, 8);
  };

  const paletteResults = searchPaletteItems();

  return (
    <div className="flex min-h-screen bg-[#070A13] text-[#F4F4F6] relative overflow-hidden selection:bg-[#76FF03]/30 select-none">
      {/* Background Mesh Gradients - Premium Subtle Luminous Green Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[5%] left-[5%] w-[45%] h-[45%] bg-[#76FF03]/[0.015] rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[5%] right-[5%] w-[40%] h-[40%] bg-[#76FF03]/[0.012] rounded-full blur-[140px] animate-pulse delay-500" />
      </div>

      {/* 3.5 — Command Palette Overlay Modal */}
      <AnimatePresence>
        {showPalette && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-md pt-[10vh] px-4 cursor-pointer"
            onClick={() => setShowPalette(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }}
              className="w-full max-w-xl bg-[#121316] border border-white/10 rounded-[24px] p-4 shadow-2xl relative cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Ctrl+K Search tenants, properties, or sections..."
                  value={paletteQuery}
                  onChange={e => setPaletteQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 text-slate-100 rounded-xl px-4 py-2.5 pl-11 text-xs focus:border-[#76FF03]/30 focus:outline-none font-sans font-medium"
                />
              </div>

              {paletteQuery && (
                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                  {paletteResults.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic text-center py-4">No matching records found.</p>
                  ) : (
                    paletteResults.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={item.action}
                        className="w-full p-2.5 rounded-xl border border-white/5 hover:border-[#76FF03]/30 flex items-center justify-between text-left hover:bg-white/[0.02] cursor-pointer transition-all"
                      >
                        <span className="text-[11px] font-bold text-slate-200">{item.text}</span>
                        <span className="text-[9px] font-mono font-bold uppercase text-[#76FF03] bg-[#76FF03]/10 px-2 py-0.5 rounded-full border border-[#76FF03]/20">{item.category}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3 text-[9px] font-mono text-slate-500">
                <span>Type to filter...</span>
                <span>ESC to close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0.2 — Glass-morphism Rollover Thread-yield active state */}
      <AnimatePresence>
        {isRollingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md text-white border border-white/5"
          >
            <div className="relative flex flex-col items-center space-y-6 max-w-sm text-center px-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-t-transparent border-[#76FF03] animate-spin shadow-lg shadow-[#76FF03]/20" />
                <span className="absolute inset-x-0 bottom-0 text-[8px] font-black tracking-widest text-[#76FF03] uppercase font-mono text-center">NEX</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black tracking-tight font-sans uppercase">Rolling Over Cycle</h3>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">Rolling over billing cycle. Please wait.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar currentView={currentView} setView={setView} />
      
      <main className="flex-1 flex flex-col p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-[#76FF03] rounded-full shadow-[0_0_8px_rgba(118,255,3,0.4)]" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8A8D98] font-mono leading-none">ARTHA ADMINISTRATIVE COMMAND</p>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider mt-1.5 flex items-center gap-3 font-sans">
                {currentView === 'dashboard' ? 'Dynamic Analytics' : currentView === 'expenses' ? 'Expense Log' : currentView === 'tenants' ? 'Tenants Ledger' : 'Administrative Hub'}
                <span className="w-1.5 h-1.5 rounded-full bg-[#76FF03] shadow-[0_0_8px_#76FF03]" />
              </h1>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             {/* System Override console marker */}
             <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-[9px] shrink-0">
               <span className="text-[9px] uppercase tracking-widest font-bold text-[#8A8D98] font-mono">SUPPORT OVERRIDE</span>
               <button
                 type="button"
                 onClick={toggleSupportMasterMode}
                 className={cn(
                   "relative w-9 h-4.5 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer",
                   supportMasterOverrideMode ? "bg-[#76FF03]" : "bg-zinc-800"
                 )}
               >
                 <div
                   className={cn(
                     "bg-[#070A13] w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-150",
                     supportMasterOverrideMode ? "translate-x-4" : "translate-x-0"
                   )}
                 />
               </button>
             </div>

             {/* Dynamic Undo/Redo Engine */}
             <div className="flex gap-1 bg-white/[0.01] border border-white/5 p-1 rounded-xl">
               <button 
                onClick={handleUndo} 
                disabled={undoStack.length === 0}
                className="p-1.5 hover:bg-[#76FF03]/10 rounded-lg disabled:opacity-10 transition-all text-slate-400 hover:text-[#76FF03]"
                title="Undo (Ctrl+Z)"
               >
                 <Undo2 className="w-4 h-4" />
               </button>
               <button 
                onClick={handleRedo} 
                disabled={redoStack.length === 0}
                className="p-1.5 hover:bg-[#76FF03]/10 rounded-lg disabled:opacity-10 transition-all text-slate-400 hover:text-[#76FF03]"
                title="Redo (Ctrl+Shift+Z)"
               >
                 <Redo2 className="w-4 h-4" />
               </button>
             </div>

             {/* 3.3 — Smart Diagnostic Notification Alerts Bell Popover */}
             <div className="relative shrink-0">
               <button 
                 onClick={() => setShowAlertsDropdown(prev => !prev)}
                 className="relative p-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-xl text-slate-400 hover:text-[#76FF03] transition-all cursor-pointer"
                 title="Smart Diagnostic Alerts"
               >
                 <Bell className="w-4 h-4" />
                 {smartAlerts.length > 0 && (
                   <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                     {smartAlerts.length}
                   </span>
                 )}
               </button>
               
               <AnimatePresence>
                 {showAlertsDropdown && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowAlertsDropdown(false)} />
                     <motion.div 
                       initial={{ opacity: 0, scale: 0.95, y: 10 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95, y: 10 }}
                       className="absolute right-0 mt-3 w-80 bg-[#121316] border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3 z-50 cursor-default"
                     >
                       <div className="flex items-center justify-between border-b border-white/5 pb-2">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Smart Alerts</span>
                         <span className="text-[9px] font-mono text-[#76FF03]">{smartAlerts.length} active</span>
                       </div>
                       <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                         {smartAlerts.length === 0 ? (
                           <p className="text-[11px] text-slate-500 italic text-center py-2">No active warnings. Code compliant.</p>
                         ) : (
                           smartAlerts.map(alert => (
                             <div key={alert.id} className="p-2.5 rounded-xl border border-white/5 flex items-start gap-2 bg-slate-950/40 text-left">
                               {alert.type === 'warning' ? (
                                 <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                               ) : (
                                 <AlertCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                               )}
                               <span className="text-[10px] text-slate-300 font-medium leading-relaxed">{alert.text}</span>
                             </div>
                           ))
                         )}
                       </div>
                     </motion.div>
                   </>
                 )}
               </AnimatePresence>
             </div>

             {/* User profile with admin display chip */}
             {currentUser && (
               <div className="flex items-center gap-3 bg-white/[0.02] border border-white/10 pl-3 pr-3 py-1.5 rounded-xl text-left font-sans select-none shrink-0">
                 <div className="flex flex-col text-right">
                   <span className="text-[10px] font-bold text-white leading-none truncate max-w-[110px]">{currentUser.email.split('@')[0]}</span>
                   <span className="text-[8px] font-mono uppercase text-[#76FF03] tracking-widest mt-0.5">{currentUser.role}</span>
                 </div>
               </div>
             )}

             {/* Action triggers dynamically depending on active context */}
             {currentView === 'tenants' && (
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setBulkTableModal({ open: true })}
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-[#76FF03] border border-[#76FF03]/20 font-sans font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md hover:scale-[1.02] cursor-pointer flex items-center gap-2 animate-pulse"
                    title="Enter all electricity and water data units serially in a tabular format"
                  >
                    <Clipboard className="w-4 h-4" />
                    BULK DATA ENTRY
                  </button>
                  <button 
                    onClick={() => {
                      if (properties.length === 0) {
                        alert('Please create a property first');
                        return;
                      }
                      setTenantModal({ open: true, propertyId: selectedPropertyId === 'all' ? properties[0].id : selectedPropertyId });
                    }}
                    className="px-4 py-2.5 bg-[#76FF03] hover:bg-[#76FF03]/90 text-[#121316] font-sans font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg hover:scale-[1.02] cursor-pointer flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    ADD TENANT DEPOSIT
                  </button>
                </div>
              )}
          </div>
        </header>

        {supportMasterOverrideMode && (
          <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse text-amber-500" />
              <div>
                <h4 className="text-sm font-bold">Support Override Console Active</h4>
                <p className="text-[10px] text-amber-500/70 mt-0.5 uppercase tracking-wide">You can manually alter any past/present bill fields or arrears downstream.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  recalculateBalances();
                  alert('Forced Sync Success: All historical arrears recalculations solved and downstream payments balanced!');
                }}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold uppercase tracking-widest text-[9px] rounded-xl hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowDownUp className="w-3 h-3" />
                Sync Late Payments Now
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1"
          >
            {currentView === 'dashboard' && (
              <DashboardView
                properties={properties}
                tenants={tenants}
                history={history}
                formatCurrency={formatCurrency}
                setView={setView}
                activeMonth={data.activeMonth || ''}
              />
            )}
            {currentView === 'expenses' && (
              <ExpensesView
                properties={properties}
                formatCurrency={formatCurrency}
                showToast={showToast}
                currentUser={currentUser}
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
                onOpenProfile={(tenant, property) => setProfileModal({ open: true, tenant, property })}
                recalculateBalances={recalculateBalances}
                activeMonth={data.activeMonth}
              />
            )}
            {currentView === 'admin' && (
              <AdministrativeHubView 
                properties={properties} 
                addProperty={addProperty} 
                updateProperty={updateProperty} 
                deleteProperty={handleDeleteProperty} 
                setPropertyModal={setPropertyModal}
                history={history} 
                onShowDetail={(entry: any) => setHistoryModal({ open: true, data: entry })}
                updateHistoryTenant={(eid: string, tid: string, up: any) => {
                  pushToUndo();
                  updateHistoryTenant(eid, tid, up);
                }}
                data={data} 
                restoreData={restoreData} 
                quotaUsage={quotaUsage} 
                cleanOldHistory={cleanOldHistory}
                dataStats={dataStats}
                recalculateBalances={recalculateBalances}
                auditLogs={auditLogs}
                supportMasterOverrideMode={supportMasterOverrideMode}
                toggleSupportMasterMode={toggleSupportMasterMode}
                clearAuditLogs={clearAuditLogs}
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

      {/* Sentient AI Concierge Assistant "Aurelia" */}
      <AIAssistant 
        tenants={tenants}
        properties={properties}
        history={history}
        activeMonth={data.activeMonth}
        updateTenant={(tid, up) => {
          pushToUndo();
          updateTenant(tid, up);
        }}
      />

      {/* Modals */}
      {profileModal.open && profileModal.tenant && profileModal.property && (
        <TenantProfileModal 
          isOpen={profileModal.open}
          onClose={() => setProfileModal({ open: false })}
          tenant={profileModal.tenant}
          property={profileModal.property}
          history={history}
          onSaveBillEdit={(tenantId, overrides) => {
            pushToUndo();
            updateTenant(tenantId, { manualOverrides: overrides });
            // Immediate UI feedback within the open profile modal
            setProfileModal(prev => {
              if (prev.tenant && prev.tenant.id === tenantId) {
                return {
                  ...prev,
                  tenant: {
                    ...prev.tenant,
                    manualOverrides: overrides
                  }
                };
              }
              return prev;
            });
          }}
          onOpenHistoryDetail={(entry) => setHistoryModal({ open: true, data: entry })}
          onUpdateTenant={(tenantId, updates) => {
            pushToUndo();
            updateTenant(tenantId, updates);
            // Immediate UI feedback within the open profile modal
            setProfileModal(prev => {
              if (prev.tenant && prev.tenant.id === tenantId) {
                return {
                  ...prev,
                  tenant: {
                    ...prev.tenant,
                    ...updates
                  }
                };
              }
              return prev;
            });
          }}
        />
      )}

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
        supportMasterOverrideMode={supportMasterOverrideMode}
        addAuditLog={addAuditLog}
        recalculateBalances={recalculateBalances}
      />

      <RolloverPromptModal 
        isOpen={rolloverPrompt.open}
        month={rolloverPrompt.month}
        onClose={() => {
          dismissRollover(rolloverPrompt.month);
          setRolloverPrompt({ ...rolloverPrompt, open: false });
        }}
        onConfirm={(carryForward: boolean) => {
          handleRollover(rolloverPrompt.month, carryForward);
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

function LegacyDashboardPlaceholder({ data, setBatchModal, setBulkTableModal, properties }: { data: AppData; setBatchModal: any; setBulkTableModal: any; properties: Property[] }) {
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

  const collectionPercentage = useMemo(() => {
    if (stats.totalPotential === 0) return 100;
    return Math.round((stats.totalCollected / stats.totalPotential) * 100);
  }, [stats]);

  const occupancyRate = useMemo(() => {
    if (properties.length === 0) return 0;
    const estimatedCapacity = properties.length * 8; // Assumed ultra-elite units
    return Math.min(100, Math.round((data.tenants.length / estimatedCapacity) * 100));
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
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 select-none"
    >
      {/* Premium Welcome Command Banner styled like a high-end luxury tablet interface */}
      <motion.div 
        variants={item}
        className="relative overflow-hidden p-8 rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#0B0C10] via-[#0D111A] to-[#121824] shadow-2xl"
      >
        <div className="absolute inset-0 bg-[#D4AF37]/[0.02] backdrop-blur-3xl" />
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#D4AF37]/5 blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_12px_#D4AF37]" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] font-mono font-bold">AURELIA DEPOSITORY PROTOCOL</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-light font-serif text-[#FFFBF0]">
              Welcome Back, <span className="font-semibold text-white">Chief Commander</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
              System telemetry operational. Total portfolio yield optimization status is synchronized with cycle <span className="text-[#D4AF37] font-semibold">{data.activeMonth}</span>.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setBulkTableModal({ open: true })}
              className="px-6 py-3 bg-gradient-to-r from-[#BF953F] to-[#FCF6BA] hover:from-[#FCF6BA] hover:to-[#BF953F] text-slate-950 font-serif font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg shadow-[#D4AF37]/15 cursor-pointer"
            >
              Bulk Entry Terminal
            </button>
            <div className="px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] font-mono">LIVE COGNITION ACCORD</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Zone A: Gorgeous KPI Cards reflecting Salesforce layout with stacked occupant heads and progress-pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Portfolio Valuation', 
            value: formatCurrency(stats.totalPotential), 
            color: 'text-white', 
            icon: Database,
            progressUrl: 75,
            progressColor: 'from-[#BF953F] to-[#FCF6BA]',
            accent: 'from-[#0F1321] via-[#0D101C] to-[#080A12] border-[#D4AF37]/20 hover:border-[#D4AF37]/50',
            heads: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop',
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop'
            ]
          },
          { 
            label: 'Secured Receipts', 
            value: formatCurrency(stats.totalCollected), 
            color: 'text-emerald-400', 
            icon: CheckCircle2,
            progressUrl: collectionPercentage,
            progressColor: 'from-emerald-500 to-teal-400',
            accent: 'from-[#0F1321] via-[#0B1516] to-[#080A12] border-emerald-500/15 hover:border-emerald-500/40',
            heads: [
              'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop',
              'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop'
            ]
          },
          { 
            label: 'Pending Receivables', 
            value: formatCurrency(stats.pendingRevenue), 
            color: 'text-rose-400', 
            icon: CreditCard,
            progressUrl: Math.max(10, 100 - collectionPercentage),
            progressColor: 'from-rose-500 to-red-400',
            accent: 'from-[#0F1321] via-[#160D12] to-[#080A12] border-rose-500/15 hover:border-rose-500/40',
            heads: [
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=50&h=50&fit=crop'
            ]
          },
          { 
            label: 'Active Occupancy', 
            value: `${occupancyRate}%`, 
            color: 'text-[#D4AF37]', 
            icon: Users,
            progressUrl: occupancyRate,
            progressColor: 'from-blue-500 to-indigo-400',
            accent: 'from-[#0F1321] via-[#0D1524] to-[#080A12] border-blue-500/15 hover:border-blue-500/40',
            heads: [
              'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=50&h=50&fit=crop',
              'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=50&h=50&fit=crop'
            ]
          }
        ].map((s, idx) => (
          <motion.div 
            key={idx} 
            variants={item} 
            className={cn(
              "p-6 rounded-[2rem] bg-gradient-to-br border backdrop-blur-md transition-all duration-300 relative group cursor-default shadow-xl",
              s.accent
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] text-slate-500 uppercase tracking-[0.25em] font-black group-hover:text-white transition-colors font-mono">{s.label}</span>
              <div className="p-2 bg-white/[0.02] border border-white/5 rounded-full text-[#D4AF37]">
                <s.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className={cn("text-xl md:text-2xl font-bold font-mono tracking-tight", s.color)}>{s.value}</p>
              
              {/* Miniature progress capsule bar & User pile from Salesforce reference image */}
              <div className="mt-5 flex items-center justify-between gap-3 bg-black/40 px-3.5 py-2 rounded-full border border-white/[0.04]">
                <div className="flex -space-x-2">
                  {s.heads.map((url, hidx) => (
                    <img 
                      key={hidx} 
                      src={url} 
                      className="w-4.5 h-4.5 rounded-full border border-slate-950 object-cover shrink-0" 
                      alt="occupant visual" 
                    />
                  ))}
                </div>
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-1000", s.progressColor)} style={{ width: `${s.progressUrl}%` }} />
                </div>
                <span className="text-[8px] font-mono text-[#D4AF37] font-bold">{s.progressUrl}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Zone B: Two Columns layout (66% Left / 33% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (66%) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Revenue Trend SVG Chart */}
          <motion.div 
            variants={item}
            className="p-6 rounded-3xl border border-[#D4AF37]/15 bg-[#0B0C10]/90 backdrop-blur-md relative overflow-hidden shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">FINANCIAL FORECAST</p>
                <h3 className="text-lg font-serif font-bold text-white uppercase tracking-wider mt-1">Sovereign Revenue Matrix</h3>
              </div>
              <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 px-3 py-1.5 rounded-lg text-[9px] font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                CURRENT BI-QUARTERLY TREND
              </div>
            </div>

            {/* Pristine Gold Vector SVG Line Chart */}
            <div className="w-full h-56 mt-4 relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  {/* Glowing gold drop shadow */}
                  <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#D4AF37" floodOpacity="0.25" />
                  </filter>
                  {/* Subtle vertical gradient fill */}
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(214,175,55,0.05)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(214,175,55,0.05)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="140" x2="500" y2="140" stroke="rgba(214,175,55,0.05)" strokeWidth="1" strokeDasharray="3 3" />
                
                {/* Real-looking revenue path curving up beautifully */}
                <path 
                  d="M 10 150 Q 100 130 180 90 T 350 70 T 490 35" 
                  fill="none" 
                  stroke="url(#chart-gradient)" 
                  strokeWidth="0"
                />
                
                {/* Gradient area */}
                <path 
                  d="M 10 150 Q 100 130 180 90 T 350 70 T 490 35 L 490 190 L 10 190 Z" 
                  fill="url(#chart-gradient)" 
                />

                {/* Main Glowing Gold Curve */}
                <path 
                  d="M 10 150 Q 100 130 180 90 T 350 70 T 490 35" 
                  fill="none" 
                  stroke="#D4AF37" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  filter="url(#gold-glow)"
                />

                {/* Highlight Anchor Nodes */}
                <circle cx="10" cy="150" r="4" fill="#0B0C10" stroke="#D4AF37" strokeWidth="2" />
                <circle cx="135" cy="113" r="4" fill="#0B0C10" stroke="#D4AF37" strokeWidth="2" />
                <circle cx="265" cy="80" r="4" fill="#0B0C10" stroke="#D4AF37" strokeWidth="2" />
                <circle cx="390" cy="50" r="4" fill="#0B0C10" stroke="#D4AF37" strokeWidth="2" />
                <circle cx="490" cy="35" r="5" fill="#FFFBF0" stroke="#D4AF37" strokeWidth="3" />
              </svg>
            </div>

            {/* X-Axis labels */}
            <div className="flex justify-between items-center px-2 pt-3 border-t border-white/[0.03] text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">
              <span>Nov</span>
              <span>Jan</span>
              <span>Mar</span>
              <span>May</span>
              <span>Active Cycle ({data.activeMonth})</span>
            </div>
          </motion.div>

          {/* Properties Hub Showcase */}
          <motion.div 
            variants={item}
            className="p-6 rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-md shadow-lg"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">REAL ESTATE PORTFOLIO</p>
                <h3 className="text-base font-serif font-bold text-white uppercase tracking-wider mt-1">Sovereign Properties</h3>
              </div>
              <span className="text-xs text-[#D4AF37] font-mono font-bold">{properties.length} Active Holdings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.slice(0, 4).map((p: any) => {
                const count = data.tenants.filter(t => t.propertyId === p.id).length;
                return (
                  <div key={p.id} className="p-4 rounded-2xl bg-white/[0.02] border border-[#D4AF37]/10 flex items-center justify-between group hover:border-[#D4AF37]/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl flex items-center justify-center text-[#D4AF37]">
                        <Home className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-serif font-black text-white uppercase tracking-wide">{p.name}</h4>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase tracking-wider">Rooms Occupied: {count}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#D4AF37] transition-all transform group-hover:translate-x-1" />
                  </div>
                );
              })}
            </div>
          </motion.div>

        </div>

        {/* Right Column (33%) */}
        <div className="space-y-8">
          
          {/* Financial Health Circular SVG Ring and details */}
          <motion.div 
            variants={item}
            className="p-6 rounded-3xl border border-[#D4AF37]/15 bg-[#0B0C10]/95 backdrop-blur-md shadow-xl text-center flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-6">VAULT REVENUE DISTRIBUTION</p>
              
              {/* Premium Glow progress ring */}
              <div className="relative w-44 h-44 mx-auto mb-8 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track ring */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="rgba(255,255,255,0.02)" 
                    strokeWidth="8" 
                  />
                  {/* Glowing neon shadow ring */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="#D4AF37" 
                    strokeWidth="8" 
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * collectionPercentage) / 100}
                    strokeLinecap="round"
                    className="opacity-20 blur-[4px]"
                  />
                  {/* Active gold progress ring */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="url(#gold-glow)" 
                    strokeWidth="8" 
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * collectionPercentage) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ stroke: '#D4AF37' }}
                  />
                </svg>
                {/* Center Stats */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold font-mono text-[#FFFBF0] tracking-tight">{collectionPercentage}%</span>
                  <span className="text-[8px] font-black uppercase text-[#D4AF37] font-mono tracking-widest mt-1">SECURED RATIO</span>
                </div>
              </div>

              {/* Status information ledger */}
              <div className="space-y-3.5 text-left pt-4 border-t border-white/[0.04] text-xs font-medium">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">Paid Accounts</span>
                  </div>
                  <span className="font-mono text-white font-bold">{stats.paidCount} of {stats.totalCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-slate-400">Awaiting Depositories</span>
                  </div>
                  <span className="font-mono text-white font-bold">{stats.totalCount - stats.paidCount} tenants</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-400">Total Delayed Arrears</span>
                  </div>
                  <span className="font-mono text-slate-100 font-bold">{formatCurrency(stats.totalArrears)}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Action shortcuts & Console Actions */}
          <motion.div 
            variants={item}
            className="p-6 rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-md shadow-lg"
          >
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-4 text-left">QUICK ACTION CONSOLE</p>
            <div className="space-y-3">
              <button 
                onClick={() => setBatchModal({ open: true })}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/35 hover:bg-white/[0.04] font-serif uppercase tracking-widest font-black text-[9px] text-[#D4AF37] text-left transition-all cursor-pointer"
              >
                <span>Initialize Batch Overrides</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
              
              <div className="p-3 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/10 flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <div className="text-left">
                  <h4 className="text-[10px] font-serif font-black text-[#FFFBF0] uppercase">Auditable Logs Secure</h4>
                  <p className="text-[8px] text-slate-400 font-mono mt-0.5">Database integrity holds clean signatures.</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

      </div>

    </motion.div>
  );
}

function AdministrativeHubView({ 
  properties, addProperty, updateProperty, deleteProperty, setPropertyModal,
  history, onShowDetail, updateHistoryTenant,
  data, restoreData, quotaUsage, cleanOldHistory, dataStats, recalculateBalances, auditLogs, supportMasterOverrideMode, toggleSupportMasterMode, clearAuditLogs
}: any) {
  const [activeSubTab, setActiveSubTab] = useState<'properties' | 'history' | 'settings'>('properties');
  
  return (
    <div className="space-y-6">
      {/* Sub tabs of Administrative Hub: Clean modern design, absolutely zero gold */}
      <div className="flex gap-2 p-1.5 bg-[#1A1B20]/80 rounded-[20px] border border-white/5 max-w-xl">
        {[
          { id: 'properties', label: 'Holdings & Properties' },
          { id: 'history', label: 'Transaction History' },
          { id: 'settings', label: 'System Configurations' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer",
              activeSubTab === tab.id 
                ? "bg-[#76FF03] text-[#121316] font-black shadow-[0_0_12px_rgba(118,255,3,0.25)]" 
                : "text-[#8A8D98] hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'properties' && (
            <PropertiesView 
              properties={properties} 
              addProperty={addProperty} 
              updateProperty={updateProperty} 
              deleteProperty={deleteProperty} 
              setPropertyModal={setPropertyModal}
            />
          )}
          {activeSubTab === 'history' && (
            <HistoryView 
              history={history} 
              onShowDetail={onShowDetail}
              updateHistoryTenant={updateHistoryTenant}
            />
          )}
          {activeSubTab === 'settings' && (
            <SettingsView 
              data={data} 
              restoreData={restoreData} 
              quotaUsage={quotaUsage} 
              cleanOldHistory={cleanOldHistory}
              dataStats={dataStats}
              recalculateBalances={recalculateBalances}
              auditLogs={auditLogs}
              supportMasterOverrideMode={supportMasterOverrideMode}
              toggleSupportMasterMode={toggleSupportMasterMode}
              clearAuditLogs={clearAuditLogs}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PropertiesView({ properties, addProperty, updateProperty, deleteProperty, setPropertyModal }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Properties Holdings</h2>
          <p className="text-[#8A8D98] text-[10px] uppercase font-mono tracking-widest mt-1 mb-1">{properties.length} Active Estates</p>
        </div>
        <button 
          onClick={() => setPropertyModal({ open: true })}
          className="px-4 py-2 bg-[#76FF03] hover:bg-[#76FF03]/90 text-[#121316] font-sans font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md hover:scale-[1.02] cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Property
        </button>
      </div>

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
    </div>
  );
}

function TenantsView({ tenants, properties, selectedPropertyId, setSelectedPropertyId, searchQuery, setSearchQuery, statusFilter, setStatusFilter, updateTenant, deleteTenant, setTenantModal, downloadSummaryCSV, setBatchModal, setBulkTableModal, rolloverPrompt, setRolloverPrompt, setPaymentModal, pushToUndo, selectedTenantIds, setSelectedTenantIds, shareViaWhatsApp, handleBulkWhatsApp, isBulkSending, bulkProgress, processingId, setProcessingId, onOpenProfile, recalculateBalances, activeMonth }: any) {
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [focusedTenantId, setFocusedTenantId] = useState<string | null>(null);
  
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selection card focus trigger
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
      
      const canvas = await safeHtml2Canvas(element, { 
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
          const canvas = await safeHtml2Canvas(element, { 
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

  // Determine active detailed tenant profile
  const activeTenant = tenants.find((t: any) => t.id === focusedTenantId) || tenants[0];
  const activeProp = activeTenant ? properties.find((p: any) => p.id === activeTenant.propertyId) : null;
  const activeDetail = activeTenant && activeProp ? getTenantBillingDetails(activeTenant, activeProp) : null;

  return (
    <div className="space-y-6">
      {/* Main Dual-Column/Triple-Column Workspace transformed into a responsive bento-inspired high-fidelity grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1: VERTICAL CONTROLS DOCK (Separated but aligned vertically) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Glass Card 1: Search */}
          <div className="p-4 rounded-[24px] bg-[#1A1B20]/80 backdrop-blur-md border border-white/5 space-y-3">
            <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Search Ledger</span>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8D98]" />
              <input 
                type="text" 
                placeholder="Search portfolios..." 
                className="w-full bg-[#282A30]/40 border border-white/5 rounded-full px-5 py-2.5 pl-11 text-xs text-white placeholder-[#8A8D98] focus:ring-1 focus:ring-[#76FF03] outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Glass Card 2: Property Filter */}
          <div className="p-4 rounded-[24px] bg-[#1A1B20]/80 backdrop-blur-md border border-white/5 space-y-3">
            <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Holdings filter</span>
            <select 
              className="w-full bg-[#282A30]/50 hover:bg-[#282A30]/70 text-slate-300 font-mono text-[10px] uppercase tracking-wider rounded-full px-4 py-2.5 outline-none border border-white/5 cursor-pointer"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <option value="all">Properties: All</option>
              {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Glass Card 3: Status Filter */}
          <div className="p-4 rounded-[24px] bg-[#1A1B20]/80 backdrop-blur-md border border-white/5 space-y-3">
            <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Invoice status</span>
            <select 
              className="w-full bg-[#282A30]/50 hover:bg-[#282A30]/70 text-slate-300 font-mono text-[10px] uppercase tracking-wider rounded-full px-4 py-2.5 outline-none border border-white/5 cursor-pointer"
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="paid">Paid Only</option>
              <option value="unpaid">Unpaid Only</option>
            </select>
          </div>

          {/* Glass Card 4: Action & Operations */}
          <div className="p-4 rounded-[24px] bg-[#1A1B20]/80 backdrop-blur-md border border-white/5 space-y-3">
            <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Actions</span>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setBulkTableModal({ open: true })}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-[#76FF03]/20 text-[#76FF03] font-black uppercase tracking-wider rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 text-[10px]"
                title="Enter all electricity and water data units serially in a tabular format"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Bulk Utility Entry
              </button>
              <button
                onClick={() => {
                  recalculateBalances();
                  alert('Arrears Recalculation Triggered: Auto-sync completed and remaining balances recalculated downstream.');
                }}
                className="w-full py-2.5 bg-[#76FF03]/10 hover:bg-[#76FF03]/20 text-[#76FF03] font-black uppercase tracking-wider rounded-full border border-[#76FF03]/30 transition-all cursor-pointer flex items-center justify-center gap-2 text-[10px]"
                title="Force synchronization with past months' arrears"
              >
                <ArrowDownUp className="w-3.5 h-3.5 animate-pulse" />
                Sync Now
              </button>
            </div>
          </div>

          {/* Glass Card 5: Month Rollover Control */}
          <div className="p-4 rounded-[24px] bg-[#1A1B20]/80 backdrop-blur-md border border-white/5 space-y-3">
            <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Monthly Rollover</span>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Current Cycle</span>
                <span className="text-[10px] font-bold text-[#76FF03] font-mono">{activeMonth || 'Current Month'}</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#8A8D98] font-mono border-t border-white/5 pt-2">
                <span>Utility Carriage</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
            </div>
            
            <button
              onClick={() => {
                const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                setRolloverPrompt({ open: true, month: currentMonth });
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 text-amber-400 font-black uppercase tracking-wider rounded-full border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-center gap-2 text-[10px]"
              title="Carry forward utility billing data to the next month"
            >
              <Calendar className="w-3.5 h-3.5" />
              Roll Over Month
            </button>
          </div>
        </div>

        {/* COLUMN 2: DIGITALLY POLISHED TENANT CARD GRID BLOCK (Replacing simple list/table) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="neo-contrast-light-block p-6 flex flex-col min-h-[550px] relative">
            
            {/* Header capsule control band */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-stone-200">
              <div>
                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block font-mono">PORTFOLIO REGISTRY</span>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight font-serif flex items-center gap-2">
                  Bill Ledger Cards
                  <span className="px-2.5 py-0.5 bg-stone-100 text-stone-700 rounded-full font-mono font-black text-[9px]">{tenants.length}</span>
                </h3>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={toggleAll}
                  className="px-2.5 py-1 text-[8px] font-mono tracking-widest uppercase font-black bg-stone-50 hover:bg-stone-150 text-stone-700 rounded-md border border-stone-200 transition-colors cursor-pointer"
                >
                  {selectedTenantIds.size === tenants.length ? "Clear All" : "Select All"}
                </button>
              </div>
            </div>

            {/* Grid of cards replacing the current list/table */}
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1.5 custom-scrollbar">
              {tenants.map((t: any) => {
                const prop = properties.find((p: any) => p.id === t.propertyId)!;
                if (!prop) return null;
                
                const detail = getTenantBillingDetails(t, prop);
                const isSelected = selectedTenantIds.has(t.id);
                const isFocused = activeTenant?.id === t.id;

                const outstanding = detail.totalDue - (t.paidAmount || 0);

                // Status Badge Logic: Paid | Partial | Overdue
                let status = "Overdue";
                let statusClass = "bg-rose-500/10 text-rose-600 border border-rose-500/10";
                if (t.isPaid || outstanding <= 0) {
                  status = "Paid";
                  statusClass = "bg-emerald-500/10 text-emerald-600 border border-[#76FF03]/20";
                } else if (t.paidAmount > 0) {
                  status = "Partial";
                  statusClass = "bg-amber-500/10 text-amber-600 border border-amber-500/15";
                }

                const dueColor = outstanding <= 0 ? "text-emerald-500" : "text-rose-600";
                const initials = t.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

                return (
                  <div 
                    key={t.id} 
                    onClick={() => setFocusedTenantId(t.id)}
                    className={cn(
                      "p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden text-left",
                      isFocused 
                        ? "bg-[#121316] border-[#76FF03]/50 shadow-xl" 
                        : "bg-white border-stone-200 hover:border-stone-400 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* selection checkbox */}
                        <button 
                          onClick={(e) => toggleSelection(t.id, e)}
                          className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center transition-colors border shrink-0",
                            isSelected 
                              ? "bg-[#76FF03] border-[#76FF03] text-[#121316]" 
                              : isFocused 
                                ? "border-slate-600 hover:border-[#76FF03]"
                                : "border-stone-300 hover:border-stone-500"
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>

                        {/* Circular Avatar */}
                        <div className={cn(
                          "w-11 h-11 rounded-full font-bold font-sans text-xs flex items-center justify-center border shrink-0 uppercase shadow-sm",
                          isFocused 
                            ? "bg-slate-800 text-[#76FF03] border-slate-700" 
                            : "bg-stone-100 text-stone-850 border-stone-200"
                        )}>
                          {initials}
                        </div>

                        <div className="space-y-0.5">
                          <h4 className={cn(
                            "font-bold text-sm tracking-tight font-sans",
                            isFocused ? "text-white" : "text-slate-900"
                          )}>
                            {t.name}
                          </h4>
                          <p className={cn(
                            "text-[10px] font-medium",
                            isFocused ? "text-slate-400" : "text-stone-500"
                          )}>
                            {prop ? prop.name : 'Unknown'} • Rm {t.roomNumber}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider", statusClass)}>
                          {status}
                        </span>
                        <span className={cn("font-mono font-black text-xs tracking-tight", isFocused ? dueColor : outstanding <= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {formatCurrency(outstanding)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Buttons Grid for Tactile Operations in Center block */}
                    <div className="grid grid-cols-3 gap-2 border-t border-dashed pt-3 border-stone-200/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedTenantId(t.id);
                          downloadReceipt(t);
                        }}
                        className={cn(
                          "py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border",
                          isFocused 
                            ? "bg-slate-900 text-[#76FF03] border-slate-800 hover:bg-slate-800" 
                            : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#121316] hover:text-white"
                        )}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Receipt
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedTenantId(t.id);
                          setPaymentModal({ open: true, tenant: t });
                        }}
                        className={cn(
                          "py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border",
                          isFocused 
                            ? "bg-[#76FF03] text-slate-950 border-[#76FF03] hover:bg-opacity-95" 
                            : "bg-emerald-50 text-white border-emerald-500 hover:bg-emerald-600"
                        )}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Pay
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          shareViaWhatsApp(t);
                        }}
                        className={cn(
                          "py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border",
                          isFocused 
                            ? "bg-slate-900 text-[#76FF03] border-slate-800 hover:bg-slate-800" 
                            : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#121316] hover:text-white"
                        )}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Alert
                      </button>
                    </div>
                  </div>
                );
              })}

              {tenants.length === 0 && (
                <div className="py-20 text-center text-stone-400">
                  <Search className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p className="text-xs italic">No matching tenants found.</p>
                </div>
              )}
            </div>

            {/* Bottom Outstanding Dues Display */}
            <div className="pt-4 border-t border-stone-200 mt-4 flex items-center justify-between text-stone-500">
              <span className="text-[9px] font-mono font-bold block">TOTAL OUTSTANDING DEPOSIT</span>
              <span className="text-sm font-bold font-serif text-stone-900">
                {formatCurrency(tenants.reduce((acc: number, t: any) => {
                   const prop = properties.find((p: any) => p.id === t.propertyId)!;
                   if (!prop) return acc;
                   const detail = getTenantBillingDetails(t, prop);
                   const outstanding = detail.totalDue - (t.paidAmount || 0);
                   return acc + (outstanding > 0 ? outstanding : 0);
                }, 0))}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Luxurious Dark obsidian dashboard detailed deck + separate vertical action dock */}
        <div className="lg:col-span-5 flex flex-col md:flex-row gap-4 items-start">
          {activeTenant ? (
            <>
              {/* Separate Vertical Action Dock (Sleek Glassmorphic Circles, separated but kept together) */}
              <div className="flex md:flex-col flex-row gap-3 w-full md:w-auto p-2 bg-[#1A1B20]/80 backdrop-blur-md rounded-[24px] border border-white/5 justify-center items-center md:sticky md:top-24 select-none shrink-0 md:h-[350px]">
                <div className="flex md:flex-col gap-3 p-1.5 justify-center items-center">
                  <button 
                    onClick={() => shareViaWhatsApp(activeTenant)}
                    className="w-11 h-11 bg-[#282A30]/60 hover:bg-[#76FF03]/25 hover:text-[#76FF03] hover:border-[#76FF03]/35 rounded-full text-[#76FF03] border border-white/5 transition-all flex items-center justify-center cursor-pointer group shadow-sm"
                    title="Send WhatsApp details"
                  >
                    {processingId === activeTenant.id ? (
                      <div className="w-4 h-4 border-2 border-[#76FF03] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                  
                  <button 
                    onClick={() => downloadReceipt(activeTenant)}
                    className="w-11 h-11 bg-[#282A30]/60 hover:bg-[#76FF03]/25 hover:text-[#76FF03] hover:border-[#76FF03]/35 rounded-full text-slate-300 hover:text-[#76FF03] border border-white/5 transition-all flex items-center justify-center cursor-pointer group shadow-sm"
                    title="Generate Receipt Image"
                  >
                    {processingId === activeTenant.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    )}
                  </button>

                  <button 
                    onClick={() => onOpenProfile(activeTenant, activeProp)}
                    className="w-11 h-11 bg-[#282A30]/60 hover:bg-[#76FF03]/25 hover:text-[#76FF03] hover:border-[#76FF03]/35 rounded-full text-[#76FF03] border border-white/5 transition-all flex items-center justify-center cursor-pointer group shadow-sm"
                    title="Ledger Ledger Manager"
                  >
                    <Edit2 className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                <div className="w-full md:w-[1px] h-[1px] md:h-12 bg-white/5 my-1" />

                <div className="flex md:flex-col gap-3 p-1.5 justify-center items-center">
                  <button 
                    onClick={() => {
                      pushToUndo();
                      updateTenant(activeTenant.id, { isPaid: !activeTenant.isPaid });
                    }}
                    className={cn(
                      "w-11 h-11 rounded-full border transition-all flex items-center justify-center cursor-pointer shadow-md group",
                      activeTenant.isPaid 
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/15 hover:bg-rose-500/20" 
                        : "bg-emerald-500/10 text-[#76FF03] border-emerald-500/15 hover:bg-emerald-500/25"
                    )}
                    title={activeTenant.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                  >
                    {activeTenant.isPaid ? <X className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform" /> : <Check className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />}
                  </button>

                  <button 
                    onClick={() => deleteTenant(activeTenant.id)}
                    className="w-11 h-11 bg-rose-500/5 hover:bg-rose-500/20 rounded-full text-rose-400 border border-rose-500/10 transition-all flex items-center justify-center cursor-pointer shadow-md group"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4.5 h-4.5 group-hover:scale-115 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Main Detail Dossier Card */}
              <motion.div 
                layoutId={`active-tenant-panel-${activeTenant.id}`}
                className="flex-1 p-8 rounded-[24px] bg-[#1A1B20]/95 border border-white/5 relative overflow-hidden space-y-6 w-full"
              >
                {/* Backglow element */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-[#76FF03]/5 blur-3xl rounded-full pointer-events-none" />

                {/* Top Row: Name, room, and status */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#8A8D98] uppercase tracking-[0.25em] font-mono">portfolio dossier</span>
                    <h3 className="text-2xl font-bold tracking-tight text-white">{activeTenant.name}</h3>
                    <div className="text-[11px] text-[#76FF03] tracking-wider uppercase font-semibold flex items-center gap-1.5 font-mono">
                      <Home className="w-3 h-3" />
                      Property: {activeProp?.name} — Room {activeTenant.roomNumber}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => rolloverPrompt.month ? setRolloverPrompt({ ...rolloverPrompt, open: true }) : setRolloverPrompt({ open: true, month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) })}
                      className="p-2 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 rounded-xl border border-white/10 transition-all flex items-center justify-center cursor-pointer"
                      title="Initialize Billing Month rollover"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <span className={cn(
                      "px-4.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      activeTenant.isPaid 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                    )}>
                      {activeTenant.isPaid ? 'Active / Paid' : 'Draft / Unpaid'}
                    </span>
                  </div>
                </div>

                {/* Billing Itemized Grid */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-[#76FF03] uppercase tracking-widest font-mono">Billing Matrix Breakdown</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Rent Widget details */}
                    <div className="bg-[#282A30]/40 border border-white/5 rounded-2xl p-4 space-y-1">
                      <span className="text-[9px] text-[#8A8D98] uppercase font-mono tracking-wider font-bold">Standard Base Rent</span>
                      <p className="text-base font-bold font-mono text-white">{formatCurrency(activeDetail?.baseRent || 0)}</p>
                    </div>

                    {/* Arrears and balances breakdown */}
                    <div className="bg-[#282A30]/40 border border-white/5 rounded-2xl p-4 space-y-1">
                      <span className="text-[9px] text-[#8A8D98] uppercase font-mono tracking-wider font-bold">Outstanding Arrears</span>
                      <p className="text-base font-bold font-mono text-rose-400">{formatCurrency(activeDetail?.openingBalance || 0)}</p>
                    </div>

                    {/* Electricity detailed bill */}
                    <div className="bg-[#282A30]/40 border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-[#8A8D98] uppercase font-mono tracking-wider font-bold">Electricity Cost</span>
                        <span className="text-[9px] text-[#76FF03] font-mono font-bold">Rate: {formatCurrency(activeProp?.electricRate || 0)}</span>
                      </div>
                      <p className="text-base font-bold font-mono text-white">{formatCurrency(activeDetail?.electricityCharges || 0)}</p>
                      <div className="text-[9px] text-slate-400 font-mono">
                        Cycle: {activeTenant.currElecReading} <span className="text-slate-500">prev ({activeTenant.prevElecReading})</span>
                      </div>
                    </div>

                    {/* Water detailed cost */}
                    <div className="bg-[#282A30]/40 border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-[#8A8D98] uppercase font-mono tracking-wider font-bold">Water Consumption</span>
                        <span className="text-[9px] text-[#76FF03] font-mono font-bold">Rate: {formatCurrency(activeProp?.waterRate || 0)}</span>
                      </div>
                      <p className="text-base font-bold font-mono text-white">{formatCurrency(activeDetail?.waterCharges || 0)}</p>
                      <div className="text-[9px] text-slate-400 font-mono">
                        Cycle: {activeTenant.currWaterReading} <span className="text-slate-500 font-normal">prev ({activeTenant.prevWaterReading})</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Utility usage progress capsule bar from Salesforce dashboard design */}
                <div className="bg-black/40 p-5 rounded-2xl border border-white/[0.03] space-y-3">
                  <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest block font-mono">Utility usage visual telemetry</span>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Electricity Reading Level</span>
                      <span className="text-[#76FF03] font-bold">{activeTenant.currElecReading} Units</span>
                    </div>
                    <div className="h-1.5 bg-[#282A30] rounded-full overflow-hidden">
                      <div className="h-full bg-[#76FF03] rounded-full" style={{ width: `${Math.min(100, (activeTenant.currElecReading / 1500) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Water Consumption Level</span>
                      <span className="text-[#76FF03] font-bold">{activeTenant.currWaterReading} Units</span>
                    </div>
                    <div className="h-1.5 bg-[#282A30] rounded-full overflow-hidden">
                      <div className="h-full bg-[#76FF03] rounded-full" style={{ width: `${Math.min(100, (activeTenant.currWaterReading / 1000) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Combined Balance totals and fast payout button */}
                <div className="flex items-center justify-between p-5 bg-[#121316] rounded-3xl border border-white/5">
                  <div>
                    <span className="text-[9px] font-black text-[#8A8D98] uppercase tracking-widest font-mono block">Balance Due</span>
                    <span className="text-2xl font-bold font-mono tracking-tight text-white">{formatCurrency(activeDetail?.totalDue || 0)}</span>
                  </div>
                  
                  <button
                    onClick={() => setPaymentModal({ open: true, tenant: activeTenant, property: activeProp })}
                    className="px-6 py-3.5 rounded-full text-[10px] tracking-widest uppercase font-mono font-black bg-[#76FF03] hover:scale-105 active:scale-95 transition-all text-[#121316] flex items-center gap-2 cursor-pointer shadow-lg shadow-[#76FF03]/10"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Pay Out Now
                  </button>
                </div>
              </motion.div>
            </>
          ) : (
            <div className="glass-panel p-20 text-center rounded-[2rem] border-dashed border-white/10 text-slate-500">
              <Users className="w-12 h-12 opacity-10 mx-auto mb-4" />
              <p className="text-sm italic">Select a tenant ledger on the left card panel to preview operational details</p>
            </div>
          )}
        </div>

      </div>

      {/* Global export utilities row styled cleanly at bottom */}
      <div className="flex flex-col sm:flex-row justify-between items-center pt-2 gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={downloadSummaryCSV} className="btn-secondary text-[10px] px-4.5 py-2 uppercase font-bold rounded-xl border-white/5 select-none text-slate-400 hover:text-white">Export CSV</button>
          <button onClick={() => window.print()} className="btn-secondary text-[10px] px-4.5 py-2 uppercase font-bold rounded-xl border-white/5 select-none text-slate-400 hover:text-white">Print All</button>
          <button 
            disabled={bulkProcessing || tenants.length === 0}
            onClick={handleBulkDownload} 
            className="px-4.5 py-2 bg-[#76FF03] hover:scale-[1.02] text-[#121316] hover:bg-[#76FF03]/90 transition-all rounded-xl text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 select-none"
          >
            {bulkProcessing ? "Generating..." : "ZIP Receipts"}
          </button>
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

function SettingsView({ data, restoreData, quotaUsage, cleanOldHistory, dataStats, recalculateBalances, auditLogs, supportMasterOverrideMode, toggleSupportMasterMode, clearAuditLogs }: any) {
  const [activeTab, setActiveTab ] = React.useState<'backups' | 'overrides' | 'metrics'>('backups');
  const [hasSystemBackup, setHasSystemBackup] = React.useState(false);

  React.useEffect(() => {
    db.get('ROLLOVER_BACKUP').then(val => {
      if (val) setHasSystemBackup(true);
    });
  }, []);

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

  const tabs = [
    { id: 'backups', label: 'Data & Backups', icon: Database },
    { id: 'overrides', label: 'Overrides & Logs', icon: Clipboard },
    { id: 'metrics', label: 'Storage & Metrics', icon: History }
  ];

  return (
    <div className="max-w-4xl space-y-8">
      {/* Sub-tab Pill Button Selectors */}
      <div className="flex flex-wrap gap-2 bg-slate-950/80 backdrop-blur-md p-2 rounded-2xl border border-white/5 w-full sm:w-max">
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 select-none cursor-pointer border",
                active 
                  ? "bg-[#76FF03]/10 text-[#76FF03] border-[#76FF03]/20 shadow-md shadow-[#76FF03]/5"
                  : "bg-transparent text-slate-400 border-transparent hover:text-white"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'backups' && (
          <motion.div
            key="backups"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    Data & Backup
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Download and restore full JSON database records</p>
                </div>
                <div className="flex flex-wrap gap-2 self-start sm:self-center">
                  {hasSystemBackup && (
                    <button 
                      onClick={async () => {
                        const backup = await db.get('ROLLOVER_BACKUP');
                        if (backup && confirm('Are you sure you want to restore the pre-rollover backup? This will revert the entire billing cycle.')) {
                          restoreData(backup);
                          alert('System restored to pre-rollover state successfully!');
                          setHasSystemBackup(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 rounded-xl text-[10px] font-extrabold text-amber-400 border border-amber-500/30 uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
                      title="Restore data from last rollover backup"
                    >
                      <History className="w-3 h-3 animate-spin duration-3000" />
                      Restore Rollover Backup
                    </button>
                  )}
                  <button onClick={exportData} className="px-3.5 py-2 bg-[#76FF03]/5 hover:bg-[#76FF03]/10 rounded-xl text-[10px] font-bold text-[#76FF03] border border-[#76FF03]/10 uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer">
                      <Download className="w-3 h-3" />
                      Backup JSON
                  </button>
                  <label className="px-3.5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-slate-400 border border-white/5 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all">
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
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Keep 6 months of archive history and delete older entries.</p>
                  </div>
                  <button onClick={() => confirm('Prune old history?') && cleanOldHistory(6)} className="w-full py-2 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all cursor-pointer">Prune Records</button>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-blue-500/20 transition-all group">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                     <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">1 Year Archival</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Efficient for long-term tracking. Deletes older than 12 months.</p>
                  </div>
                  <button onClick={() => confirm('Prune records older than 12 months?') && cleanOldHistory(12)} className="w-full py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all cursor-pointer">Cleanup History</button>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-emerald-500/20 transition-all group">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                     <ArrowDownUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Full Balance Audit</h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter leading-relaxed">Recalculate all arrears and opening balances across history.</p>
                  </div>
                  <button onClick={() => {
                    if (confirm('Run full accounting audit? This will recalculate all opening balances based on payment history.')) {
                      recalculateBalances();
                      alert('Audit complete! All balances synchronized.');
                    }
                  }} className="w-full py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all cursor-pointer">Recalculate All</button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'overrides' && (
          <motion.div
            key="overrides"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <section className="space-y-6 bg-gradient-to-b from-amber-500/[0.02] to-transparent p-6 rounded-3xl border border-amber-500/5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    Admin Master Support Control Panel
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      supportMasterOverrideMode ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" : "bg-slate-500"
                    )} />
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Authorized Audit Log & Override Engine</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 border border-white/5 px-4 py-2 rounded-2xl select-none shrink-0 self-start sm:self-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">Override Toggle</span>
                  <button
                    onClick={toggleSupportMasterMode}
                    className={cn(
                      "relative w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer",
                      supportMasterOverrideMode ? "bg-amber-500" : "bg-slate-700"
                    )}
                  >
                    <div
                      className={cn(
                        "bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200",
                        supportMasterOverrideMode ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 mb-3">
                      <ArrowDownUp className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Manual Balance Sync & Override</h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter leading-normal">
                      Force synchronizes late payments and carryovers. Recalculates all balances downstream starting from any manual updates.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      recalculateBalances();
                      alert('Verification success: Late payments synced and outstanding balances balanced downstream!');
                    }} 
                    className="w-full mt-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Sync Late Payments Now
                  </button>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 hover:border-blue-500/20 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-3">
                      <Clipboard className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Security & Audit Status</h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter leading-normal">
                      Total Manual Alterations Recorded: {auditLogs.length} logs
                    </p>
                  </div>
                  <button 
                    disabled={auditLogs.length === 0}
                    onClick={() => {
                      if(confirm('Clear all historical system override logs?')) {
                        clearAuditLogs();
                      }
                    }} 
                    className="w-full mt-4 py-2 bg-slate-850 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 hover:text-rose-400 transition-all disabled:opacity-20 cursor-pointer"
                  >
                    Clear Audit Logs
                  </button>
                </div>
              </div>

              {/* Audit Details Ledger Grid */}
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-slate-900/30">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 flex items-center gap-2">
                  Archived Adjustment Logs
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" />
                </p>
                {auditLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic">No manual billing overrides have been recorded. System is fully synchronized chronologically.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl pr-2">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="p-3 bg-slate-950 border border-white/5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs group hover:bg-white/[0.01]">
                        <div className="space-y-1">
                          <p className="text-white font-bold text-[11px] flex items-center gap-2">
                            {log.tenantName} 
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="text-blue-400 font-normal">{log.month}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Field: <span className="text-slate-300 font-semibold">{log.fieldName}</span> | Value Updated: <span className="text-rose-400 line-through">{log.oldValue}</span> → <span className="text-emerald-400 font-bold">{log.newValue}</span>
                          </p>
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono self-start sm:self-center bg-slate-900 border border-white/5 px-2 py-0.5 rounded-md whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'metrics' && (
          <motion.div
            key="metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <section className="space-y-6">
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
            
            <section className="space-y-4 border-t border-white/5 pt-6">
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
                 <div className="p-4 bg-[#76FF03]/5 rounded-2xl border border-[#76FF03]/10">
                    <p className="text-[9px] font-black text-[#76FF03] uppercase mb-1">History Entries</p>
                    <p className="text-lg font-bold text-white">{data.history.length}</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Archive Size</p>
                    <p className="text-lg font-bold text-white">{(dataStats?.history / 1024).toFixed(1)} KB</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Active Cycle</p>
                    <p className="text-xs font-bold text-[#76FF03] truncate">{data.activeMonth}</p>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

console.log('✨ AI Assistant Awakened — TenantBilling Elite is now sentient — TenantBilling Elite is now sentient');

