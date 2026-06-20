import React, { useState, useMemo, useEffect } from 'react';
import { Property } from '../types';
import { db } from '../lib/db';
import { formatCurrency, generateId } from '../lib/utils';
import { Plus, Trash2, Calendar, FileText, AlertCircle, Sparkles, Receipt, Tag, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CompanyExpense {
  id: string;
  type: 'maintenance' | 'repair' | 'utility' | 'staff';
  amount: number;
  date: string; // YYYY-MM-DD
  propertyId: string;
  propertyName?: string;
  note?: string;
}

interface ExpensesViewProps {
  properties: Property[];
  formatCurrency: (amount: number) => string;
  showToast: (msg: string) => void;
  currentUser?: { email: string; role: string };
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  properties,
  formatCurrency,
  showToast,
  currentUser
}) => {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [type, setType] = useState<'maintenance' | 'repair' | 'utility' | 'staff'>('maintenance');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [propertyId, setPropertyId] = useState(() => properties[0]?.id || '');
  const [note, setNote] = useState('');

  // Load expenses from BackendDB on mount
  useEffect(() => {
    async function loadExpenses() {
      const data = await db.get<CompanyExpense[]>('company_expenses');
      if (data) {
        setExpenses(data);
      }
    }
    loadExpenses();
  }, []);

  const totalMonthlyExpenses = useMemo(() => {
    const activePeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    return expenses
      .filter(e => e.date.startsWith(activePeriod))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'owner') {
      showToast('Access Denied: Owner role required to log expenses.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    const prop = properties.find(p => p.id === propertyId);
    const newExpense: CompanyExpense = {
      id: crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      date,
      propertyId,
      propertyName: prop ? prop.name : 'Unknown Property',
      note: note.trim()
    };

    const nextExpenses = [newExpense, ...expenses];
    setExpenses(nextExpenses);
    await db.set('company_expenses', nextExpenses);
    
    // Clear Form
    setAmount('');
    setNote('');
    showToast('Expense recorded successfully!');
  };

  const handleDelete = async (id: string) => {
    if (!currentUser || currentUser.role !== 'owner') {
      showToast('Access Denied: Only owners can delete records.');
      return;
    }

    if (confirm('Delete this expense record? This action is immutable.')) {
      const nextExpenses = expenses.filter(e => e.id !== id);
      setExpenses(nextExpenses);
      await db.set('company_expenses', nextExpenses);
      showToast('Expense deleted.');
    }
  };

  return (
    <div id="expenses-view-stage" className="space-y-8 animate-fade-in pb-16">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white font-sans tracking-tight">Landlord Expenses Ledger</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Facility Maintenance, Repairs, Utilities & Staff Compensation Log</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
          <TrendingDown className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div className="text-[9px] text-slate-500 uppercase font-black tracking-tight leading-none">Active Month Expenses</div>
            <div className="text-lg font-bold text-white mt-1 leading-none">{formatCurrency(totalMonthlyExpenses)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/10 space-y-4 self-start">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Log Corporate Expense</h4>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Expense Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-white/5 text-slate-300 rounded-xl px-4 py-2.5 text-xs focus:border-[#76FF03]/30 focus:outline-none"
              >
                <option value="maintenance">Facility Maintenance</option>
                <option value="repair">Structural Repair</option>
                <option value="utility">Main Utility Bills</option>
                <option value="staff">Staff Compensation</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Cost (NPR)</label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="NPR 0.00"
                className="w-full bg-slate-950 border border-white/5 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:border-[#76FF03]/30 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 text-slate-300 rounded-xl px-4 py-2.5 text-xs focus:border-[#76FF03]/30 focus:outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Target Property</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 text-slate-300 rounded-xl px-4 py-2.5 text-xs focus:border-[#76FF03]/30 focus:outline-none"
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Explanatory Note / Bill No.</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief transactional annotation..."
                className="w-full bg-slate-950 border border-white/5 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:border-[#76FF03]/30 focus:outline-none h-20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#76FF03] text-slate-950 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-[#76FF03]/20"
            >
              Log Outflow Entry
            </button>
          </form>
        </div>

        {/* List Container */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Outflow Audit Ledger</h4>
              <p className="text-[10px] text-slate-500 uppercase tracking-tight">Strict record of administrative expense disbursements</p>
            </div>

            {expenses.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500 italic">No business expenses logged in current session databases.</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                <AnimatePresence>
                  {expenses.map((exp) => (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl flex items-center justify-between gap-4 hover:border-white/10 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{exp.note || 'Logged Expense'}</span>
                          <span className="text-[9px] bg-slate-900 border border-white/5 text-slate-400 px-2 py-0.5 rounded-md uppercase font-bold tracking-widest font-mono">
                            {exp.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                          <span>Property: <span className="text-slate-300 font-sans">{exp.propertyName}</span></span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {exp.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-rose-400 font-mono">-{formatCurrency(exp.amount)}</span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
