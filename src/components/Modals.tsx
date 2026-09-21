import React, { useState, useEffect, useMemo } from 'react';
import { Property, Tenant, ExpenseItem, PaymentRecord, HistoryTenantSnapshot, ManualOverrides, BillingVerificationIssue } from '../types';
import { generateId, cn, formatCurrency, getTenantBillingDetails } from '../lib/utils';
import { X, Plus, Trash2, Home, Users, Zap, Droplets, CreditCard, Upload, Download, Calendar, Clipboard, ArrowDownUp, Check, AlertTriangle, LayoutList, History as HistoryIcon, IndianRupee, CheckCircle2, Edit2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className={cn(
              "relative glass-panel rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full overflow-hidden flex flex-col max-h-[90vh] border border-white/10",
              title.includes("Bulk") || title.includes("Summary") || title.includes("Historical") ? "max-w-5xl" : "max-w-lg"
            )}
          >
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const PropertyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (p: Property) => void;
  initialData?: Property;
}> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Property>>(initialData || {
    name: '',
    address: '',
    electricRate: 7,
    waterRate: 15,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, qrCodeDataUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      id: initialData?.id || generateId(),
      name: formData.name || 'Unnamed Property',
      address: formData.address || '',
      qrCodeDataUrl: formData.qrCodeDataUrl,
      electricRate: Number(formData.electricRate) || 0,
      waterRate: Number(formData.waterRate) || 0,
      createdAt: initialData?.createdAt || Date.now(),
      updatedAt: Date.now(),
      defaultExpenses: initialData?.defaultExpenses || [],
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Property" : "Add New Property"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label">Property Name</label>
          <input 
            required 
            className="input bg-slate-900/50" 
            placeholder="e.g. Skyline Apartments" 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
          />
        </div>
        <div>
          <label className="label">Full Address</label>
          <textarea 
            className="input bg-slate-900/50 min-h-[100px]" 
            placeholder="Property location details..." 
            value={formData.address} 
            onChange={e => setFormData({ ...formData, address: e.target.value })} 
          />
        </div>

        <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-4">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
            <Upload className="w-3 h-3" />
            Payment QR (Manual)
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label 
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 transition-all text-slate-500 hover:text-slate-400"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 opacity-50" />
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider">Click to upload QR</p>
                  <p className="text-[10px] opacity-60 italic">PNG or JPG (Max 2MB)</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
            
            {formData.qrCodeDataUrl && (
              <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl border border-white/5">
                <img src={formData.qrCodeDataUrl} className="w-16 h-16 rounded-lg object-contain bg-white p-1" alt="Preview" />
                <div className="flex-1">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">Live Preview</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Image successfully encoded</p>
                  <button 
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, qrCodeDataUrl: undefined }))}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase mt-2"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Elec. Rate
            </label>
            <input 
              type="number" 
              step="0.01" 
              className="input bg-slate-900/50" 
              value={formData.electricRate} 
              onChange={e => setFormData({ ...formData, electricRate: Number(e.target.value) })} 
            />
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              Water Rate
            </label>
            <input 
              type="number" 
              step="0.01" 
              className="input bg-slate-900/50" 
              value={formData.waterRate} 
              onChange={e => setFormData({ ...formData, waterRate: Number(e.target.value) })} 
            />
          </div>
        </div>
        <div className="pt-6">
          <button 
            type="submit" 
            className="btn btn-primary w-full py-4 uppercase font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
          >
            Save Property
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const PropertyRatesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  onSave?: (propertyId: string, electricRate: number, waterRate: number) => void;
  onSaveRates?: (propertyId: string, electricRate: number, waterRate: number) => void;
}> = ({ isOpen, onClose, property, onSave, onSaveRates }) => {
  const [elecRate, setElecRate] = useState<number>(0);
  const [waterRate, setWaterRate] = useState<number>(0);

  useEffect(() => {
    if (property) {
      setElecRate(property.electricRate ?? 0);
      setWaterRate(property.waterRate ?? 0);
    }
  }, [property]);

  if (!property) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saveFn = onSave || onSaveRates;
    if (saveFn) {
      saveFn(property.id, Number(elecRate) || 0, Number(waterRate) || 0);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Utility Rates - ${property.name}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Strict Rate Controls
          </p>
          <p className="text-[11px] text-amber-200/80 leading-normal">
            Updated tariff rates will apply to future billing cycles and meter calculations only. Past receipts and historical statements remain unchanged. No notifications sent.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Electricity Tariff Rate (per unit / kWh)
            </label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              required
              className="input bg-slate-900/80 text-white font-mono text-sm font-bold border border-white/10 rounded-xl px-4 py-3 w-full focus:border-amber-500 focus:outline-none" 
              value={elecRate} 
              onChange={e => setElecRate(Number(e.target.value))} 
            />
          </div>

          <div>
            <label className="label flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              Water Tariff Rate (per unit / m³)
            </label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              required
              className="input bg-slate-900/80 text-white font-mono text-sm font-bold border border-white/10 rounded-xl px-4 py-3 w-full focus:border-cyan-500 focus:outline-none" 
              value={waterRate} 
              onChange={e => setWaterRate(Number(e.target.value))} 
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest shadow-lg cursor-pointer"
          >
            Save Rates
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const PropertyQuickViewModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  tenantCount?: number;
  onEditRates?: (property: Property) => void;
  onOpenRatesEdit?: (property: Property) => void;
}> = ({ isOpen, onClose, property, tenantCount = 0, onEditRates, onOpenRatesEdit }) => {
  if (!property) return null;

  const handleEditClick = () => {
    onClose();
    const editFn = onEditRates || onOpenRatesEdit;
    if (editFn) editFn(property);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Property Overview`}>
      <div className="space-y-6">
        <div className="flex items-start justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div>
            <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase">
              ID: {property.id.slice(0, 8)}
            </span>
            <h3 className="text-lg font-black text-white mt-1.5">{property.name}</h3>
            {property.address && (
              <p className="text-xs text-slate-400 mt-1">{property.address}</p>
            )}
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-slate-400 block">Registered Tenants</span>
            <span className="text-xl font-black text-white">{tenantCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
            <span className="text-[10px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Electricity Rate
            </span>
            <p className="text-lg font-black text-white font-mono">
              NPR {property.electricRate} <span className="text-xs font-normal text-slate-400">/ unit</span>
            </p>
          </div>

          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-1">
            <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> Water Rate
            </span>
            <p className="text-lg font-black text-white font-mono">
              NPR {property.waterRate} <span className="text-xs font-normal text-slate-400">/ unit</span>
            </p>
          </div>
        </div>

        {property.qrCodeDataUrl && (
          <div className="p-4 bg-slate-900/50 border border-white/10 rounded-2xl flex items-center gap-4">
            <img src={property.qrCodeDataUrl} className="w-20 h-20 bg-white rounded-xl p-1.5 object-contain" alt="QR Code" />
            <div>
              <p className="text-xs font-bold text-white uppercase">Payment QR Configured</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Scanned by tenants for direct digital payments.</p>
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between border-t border-white/10">
          <p className="text-[10px] text-slate-500 italic">
            Rates apply to future billing cycles only.
          </p>
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Rates
          </button>
        </div>
      </div>
    </Modal>
  );
};


export const TenantModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (t: Tenant) => void;
  propertyId: string;
  initialData?: Tenant;
}> = ({ isOpen, onClose, onSave, propertyId, initialData }) => {
  const [formData, setFormData] = useState<Partial<Tenant>>(initialData || {
    name: '',
    roomNumber: '',
    rent: 0,
    previousDues: 0,
    prevElecReading: 0,
    currElecReading: 0,
    prevWaterReading: 0,
    currWaterReading: 0,
    isPaid: false,
    expenses: [],
    whatsappNumber: initialData?.whatsappNumber || '',
  });

  const [newExpense, setNewExpense] = useState({ name: '', amount: 0 });

  const addExpense = () => {
    if (newExpense.name && newExpense.amount > 0) {
      setFormData({
        ...formData,
        expenses: [...(formData.expenses || []), { id: generateId(), ...newExpense }]
      });
      setNewExpense({ name: '', amount: 0 });
    }
  };

  const removeExpense = (id: string) => {
    setFormData({
      ...formData,
      expenses: (formData.expenses || []).filter(e => e.id !== id)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id || generateId(),
      propertyId: propertyId || initialData?.propertyId || '',
      name: formData.name || 'Unnamed Tenant',
      roomNumber: formData.roomNumber || '',
      rent: Number(formData.rent) || 0,
      previousDues: Number(formData.previousDues) || 0,
      prevElecReading: Number(formData.prevElecReading) || 0,
      currElecReading: Number(formData.currElecReading) || 0,
      prevWaterReading: Number(formData.prevWaterReading) || 0,
      currWaterReading: Number(formData.currWaterReading) || 0,
      isPaid: formData.isPaid ?? false,
      expenses: formData.expenses || [],
      whatsappNumber: formData.whatsappNumber || '',
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Tenant" : "Add New Tenant"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Tenant Full Name</label>
            <input required autoFocus className="input bg-slate-900/50" placeholder="John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Room / Plot</label>
            <input required className="input bg-slate-900/50" placeholder="101" value={formData.roomNumber} onChange={e => setFormData({ ...formData, roomNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">WhatsApp Number</label>
            <input className="input bg-slate-900/50" placeholder="+91 9876543210" value={formData.whatsappNumber} onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Fixed Rent</label>
            <input type="number" className="input bg-slate-900/50" value={formData.rent} onChange={e => setFormData({ ...formData, rent: Number(e.target.value) })} />
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Meter Readings</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 ml-1">Prev Elec</label>
              <input type="number" className="input text-sm bg-slate-900/50" value={formData.prevElecReading} onChange={e => setFormData({ ...formData, prevElecReading: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 ml-1">Curr Elec</label>
              <input type="number" className="input text-sm bg-slate-900/50" value={formData.currElecReading} onChange={e => setFormData({ ...formData, currElecReading: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 ml-1">Prev Water</label>
              <input type="number" className="input text-sm bg-slate-900/50" value={formData.prevWaterReading} onChange={e => setFormData({ ...formData, prevWaterReading: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-600 ml-1">Curr Water</label>
              <input type="number" className="input text-sm bg-slate-900/50" value={formData.currWaterReading} onChange={e => setFormData({ ...formData, currWaterReading: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-white/5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Extra Charges</h4>
          <div className="space-y-3">
            {formData.expenses?.map(exp => (
              <div key={exp.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 group">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">{exp.name}</span>
                  <span className="text-[10px] text-blue-400 font-mono tracking-widest">+₹{exp.amount}</span>
                </div>
                <button type="button" onClick={() => removeExpense(exp.id)} className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input 
                className="input text-sm bg-slate-900/50 flex-1" 
                placeholder="Item Label" 
                value={newExpense.name} 
                onChange={e => setNewExpense({ ...newExpense, name: e.target.value })} 
              />
              <input 
                type="number" 
                className="input text-sm w-28 bg-slate-900/50" 
                placeholder="Amount" 
                value={newExpense.amount} 
                onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} 
              />
              <button 
                type="button" 
                onClick={addExpense} 
                className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl border border-blue-400/20 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.2)]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" className="btn btn-primary w-full py-4 uppercase font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(37,99,235,0.3)]">Update Records</button>
        </div>
      </form>
    </Modal>
  );
};

export const BatchReadingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  onSave: (updates: { id: string, currElec: number, currWater: number }[]) => void;
}> = ({ isOpen, onClose, tenants, onSave }) => {
  const [readings, setReadings] = React.useState<{ [key: string]: { currElec: number, currWater: number } }>(
    Object.fromEntries(tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }]))
  );

  React.useEffect(() => {
    setReadings(Object.fromEntries(tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }])));
  }, [tenants]);

  const handleUpdate = (id: string, field: 'currElec' | 'currWater', value: number) => {
    setReadings(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates = tenants.map(t => ({
      id: t.id,
      currElec: readings[t.id]?.currElec || 0,
      currWater: readings[t.id]?.currWater || 0
    }));
    onSave(updates);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative bg-slate-900 border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Batch Reading Entry</h3>
                <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">Update meters for all tenants after rollover</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                  <tr className="text-[10px] uppercase font-black text-slate-500 border-b border-white/5">
                    <th className="px-8 py-4">Tenant / Room</th>
                    <th className="px-8 py-4 text-center">New Elec Reading</th>
                    <th className="px-8 py-4 text-center">New Water Reading</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-4">
                        <p className="font-bold text-white text-sm">{t.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Room #{t.roomNumber}</p>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="text-[10px] text-slate-600 font-mono">Prev: {t.prevElecReading}</div>
                          <input 
                            type="number" 
                            className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={readings[t.id]?.currElec || 0}
                            onChange={e => handleUpdate(t.id, 'currElec', Number(e.target.value))}
                          />
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="text-[10px] text-slate-600 font-mono">Prev: {t.prevWaterReading}</div>
                          <input 
                            type="number" 
                            className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={readings[t.id]?.currWater || 0}
                            onChange={e => handleUpdate(t.id, 'currWater', Number(e.target.value))}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 border-t border-white/10 bg-white/5">
              <button 
                onClick={handleSubmit}
                className="btn btn-primary w-full py-4 uppercase font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >
                Apply to All {tenants.length} Tenants
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const RolloverPromptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (carryForward: boolean) => void;
  month: string;
}> = ({ isOpen, onClose, onConfirm, month }) => {
  const [carryForwardUtilities, setCarryForwardUtilities] = useState(true);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Billing Cycle Rollover">
      <div className="space-y-6">
        <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/10 text-center space-y-4">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto text-white">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-bold text-white uppercase tracking-wide">Roll over to {month}?</h4>
            <p className="text-xs text-slate-400">
              This starts a new billing month, archives all current records, and synchronizes accounts.
            </p>
          </div>
        </div>

        {/* Data Carry Forward Settings Selector Panel */}
        <div className="bg-[#1A1B20]/60 p-4.5 rounded-2xl border border-white/5 space-y-3">
          <span className="text-[9px] uppercase tracking-widest font-black text-[#8A8D98]">FORWARD PRESETS</span>
          
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={carryForwardUtilities}
                onChange={(e) => setCarryForwardUtilities(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${carryForwardUtilities ? "bg-white border-white text-slate-950" : "bg-transparent border-white/20 text-transparent"}`}>
                <Check className="w-3.5 h-3.5 font-bold" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-white group-hover:text-white/80 transition-colors">Carry Forward Utilities & Readings</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Automatically copy final electric and water meter readings and unpaid utility balances to the new month as active starting points.
              </p>
            </div>
          </label>
        </div>

        <p className="text-[10px] text-slate-500 italic text-center leading-normal">
          Clicking <strong>Later</strong> pauses this ledger transition and retains current active month logs without data forwarding.
        </p>

        <div className="pt-4 flex gap-3">
          <button 
            onClick={onClose} 
            className="btn-secondary flex-1 py-3.5 text-[10px] uppercase font-black tracking-widest cursor-pointer"
            title="Defer rollover and pause details forwarding"
          >
            Later
          </button>
          <button 
            onClick={() => onConfirm(carryForwardUtilities)} 
            className="btn-primary flex-1 py-3.5 text-[10px] uppercase font-black tracking-widest cursor-pointer"
            title="Confirm rollover and forward billing data"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
};
export const PaymentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenant?: Tenant;
  property?: Property;
  tenants?: Tenant[];
  properties?: Property[];
  onSave: (tenantId: string, updates: Partial<Tenant>) => void;
}> = ({ isOpen, onClose, tenant: initialTenant, property: initialProperty, tenants = [], properties = [], onSave }) => {
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initialTenant?.id || '');
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (initialTenant?.id) {
      setSelectedTenantId(initialTenant.id);
    } else {
      setSelectedTenantId('');
    }
  }, [initialTenant]);

  const activeTenant = useMemo(() => {
    if (initialTenant) return initialTenant;
    return tenants.find(t => t.id === selectedTenantId) || null;
  }, [initialTenant, tenants, selectedTenantId]);

  const activeProperty = useMemo(() => {
    if (initialProperty) return initialProperty;
    if (!activeTenant) return null;
    return properties.find(p => p.id === activeTenant.propertyId) || null;
  }, [initialProperty, properties, activeTenant]);

  const billingDetails = useMemo(() => {
    if (!activeTenant || !activeProperty) return null;
    return getTenantBillingDetails(activeTenant, activeProperty);
  }, [activeTenant, activeProperty]);

  const handleAddPayment = () => {
    if (!activeTenant || !activeProperty || amount <= 0) return;
    
    const billing = getTenantBillingDetails(activeTenant, activeProperty);
    const totalDue = billing.totalDue;
    const currentPaid = billing.paidAmount;
    const newPaidAmount = currentPaid + amount;
    const remainingBalance = Math.max(0, totalDue - newPaidAmount);
    const isFullyPaid = remainingBalance <= 0;

    const newRecord: PaymentRecord = {
      id: generateId(),
      amount: amount,
      date: Date.now(),
      note: note || 'Payment Received',
      remainingBalance: remainingBalance
    };

    onSave(activeTenant.id, {
      payments: [...(activeTenant.payments || []), newRecord],
      paidAmount: newPaidAmount,
      isPaid: isFullyPaid,
      manualOverrides: activeTenant.manualOverrides ? {
        ...activeTenant.manualOverrides,
        paidAmount: newPaidAmount,
        isPaid: isFullyPaid
      } : undefined
    });

    setAmount(0);
    setNote('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={activeTenant ? `Record Payment: ${activeTenant.name}` : 'Record New Payment'}>
      <div className="space-y-6">
        {!initialTenant && (
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest ml-1">Select Tenant</label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/20 cursor-pointer"
            >
              <option value="">-- Choose Tenant --</option>
              {tenants.map(t => {
                const prop = properties.find(p => p.id === t.propertyId);
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} (Rm {t.roomNumber} - {prop ? prop.name : 'Unknown'})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {billingDetails && activeTenant && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Due</p>
                 <p className="text-lg font-bold text-white font-mono">₹{(billingDetails.totalDue ?? 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Balance</p>
                 <p className={cn("text-lg font-bold font-mono", (billingDetails.outstandingBalance ?? 0) > 0 ? "text-rose-400" : "text-emerald-400")}>
                   ₹{(billingDetails.outstandingBalance ?? 0).toLocaleString()}
                 </p>
              </div>
            </div>

            <div className="space-y-4">
               {activeTenant.payments && activeTenant.payments.length > 0 && (
                 <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Payment History</p>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                       {activeTenant.payments.map((p) => (
                         <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-slate-900/50 rounded-xl border border-white/5 text-[10px]">
                            <div className="flex items-center gap-2">
                               <Check className="w-3 h-3 text-emerald-500" />
                               <span className="font-bold text-white">₹{p.amount.toLocaleString()}</span>
                               <span className="text-slate-500 italic">— {p.note || 'No note'}</span>
                            </div>
                            <span className="text-slate-600 font-mono">{new Date(p.date).toLocaleDateString()}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               <div className="space-y-3">
                  <div>
                    <label className="label">Amount Received</label>
                    <div className="relative">
                       <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                       <input 
                        type="number" 
                        className="input pl-10 bg-slate-900 border-white/10" 
                        value={amount || ''} 
                        onChange={e => setAmount(Number(e.target.value))} 
                       />
                    </div>
                  </div>
                  <div>
                    <label className="label">Payment Note</label>
                    <input 
                      className="input bg-slate-900 border-white/10" 
                      placeholder="GPay / Cash / Partial..." 
                      value={note} 
                      onChange={e => setNote(e.target.value)} 
                    />
                  </div>
               </div>
            </div>

            <button 
              onClick={handleAddPayment}
              disabled={amount <= 0}
              className="btn-primary w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl disabled:opacity-50"
            >
              Confirm Transaction
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};
export const BulkTableModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  properties: Property[];
  onSave: (updates: { id: string, currElec: number, currWater: number }[]) => void;
}> = ({ isOpen, onClose, tenants, properties, onSave }) => {
  const [readings, setReadings] = useState<{ [key: string]: { currElec: number, currWater: number } }>(
    Object.fromEntries(tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }]))
  );

  useEffect(() => {
    setReadings(Object.fromEntries(tenants.map(t => [t.id, { currElec: t.currElecReading, currWater: t.currWaterReading }])));
  }, [tenants, isOpen]);

  const handleUpdate = (id: string, field: 'currElec' | 'currWater', value: number) => {
    const cleanVal = isNaN(value) ? 0 : value;
    setReadings(prev => ({ ...prev, [id]: { ...prev[id], [field]: cleanVal } }));
  };

  const handleQuickFill = (type: 'zero' | 'add5_elec' | 'add1_water') => {
    const next = { ...readings };
    tenants.forEach(t => {
      if (type === 'zero') {
        next[t.id] = { currElec: t.prevElecReading, currWater: t.prevWaterReading };
      } else if (type === 'add5_elec') {
        next[t.id] = { ...next[t.id], currElec: (next[t.id]?.currElec || t.prevElecReading) + 5 };
      } else if (type === 'add1_water') {
        next[t.id] = { ...next[t.id], currWater: (next[t.id]?.currWater || t.prevWaterReading) + 1 };
      }
    });
    setReadings(next);
  };

  const handleSubmit = () => {
    const updates = tenants.map(t => ({
      id: t.id,
      currElec: readings[t.id]?.currElec || 0,
      currWater: readings[t.id]?.currWater || 0
    }));
    onSave(updates);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Meter Readings">
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* Quick actions toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              type="button"
              onClick={() => handleQuickFill('zero')} 
              className="h-10 px-3.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Reset to Previous
            </button>
            <button 
              type="button"
              onClick={() => handleQuickFill('add5_elec')} 
              className="h-10 px-3.5 bg-slate-900 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
            >
              +5 All Elec
            </button>
            <button 
              type="button"
              onClick={() => handleQuickFill('add1_water')} 
              className="h-10 px-3.5 bg-slate-900 border border-cyan-500/20 rounded-xl text-xs font-bold text-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer"
            >
              +1 All Water
            </button>
          </div>
          <span className="text-xs font-mono text-neutral-400 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 font-bold">
            {tenants.length} Tenants
          </span>
        </div>

        {/* Spacious Two-Column Grid of Standard-Sized Tenant Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto p-1">
          {tenants.map(t => {
            const r = readings[t.id] || { currElec: t.currElecReading, currWater: t.currWaterReading };
            const elecUnits = Math.max(0, r.currElec - t.prevElecReading);
            const waterUnits = Math.max(0, r.currWater - t.prevWaterReading);
            const isElecDecreased = r.currElec < t.prevElecReading;
            const isWaterDecreased = r.currWater < t.prevWaterReading;
            const contractRent = t.rent || 0;

            return (
              <div 
                key={t.id} 
                className="bg-[#131313] border border-white/10 hover:border-white/20 rounded-3xl p-5 space-y-4 shadow-lg transition-all"
              >
                {/* Header: Room, Tenant Name & Contract Rent */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-black text-xs sm:text-sm px-3 py-1 rounded-xl">
                        RM {t.roomNumber}
                      </span>
                      <span className="font-bold text-base text-white truncate">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                      <span className={`px-2 py-0.5 rounded-lg border ${
                        isElecDecreased ? 'text-red-400 bg-red-500/15 border-red-500/30' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        ⚡ +{elecUnits}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg border ${
                        isWaterDecreased ? 'text-red-400 bg-red-500/15 border-red-500/30' : 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20'
                      }`}>
                        💧 +{waterUnits}
                      </span>
                    </div>
                  </div>

                  {/* Contract Rent display */}
                  <div className="flex items-center justify-between text-xs bg-[#0a0a0a] border border-white/10 px-3 py-1.5 rounded-xl">
                    <span className="text-neutral-400 font-mono text-[11px] uppercase tracking-wider">Contract Rent:</span>
                    <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm">
                      ₹{contractRent.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Electricity Block */}
                <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 flex items-center gap-1">⚡ Electricity</span>
                    <span className="font-mono text-neutral-400 text-[11px]">Prev: <strong className="text-neutral-200">{t.prevElecReading}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      step="any"
                      value={r.currElec}
                      onChange={e => handleUpdate(t.id, 'currElec', parseFloat(e.target.value))}
                      aria-label={`Electricity reading for room ${t.roomNumber}`}
                      className={`w-full h-11 text-center font-mono font-black text-lg rounded-xl px-2 focus:outline-none transition-all ${
                        isElecDecreased
                          ? 'bg-red-950/20 border-2 border-red-500 text-red-300'
                          : 'bg-[#181818] border border-white/15 text-amber-300 focus:border-amber-500'
                      }`}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currElec', r.currElec + 1)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-amber-500/20 text-neutral-200 hover:text-amber-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currElec', r.currElec + 5)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-amber-500/20 text-neutral-200 hover:text-amber-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currElec', r.currElec + 10)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-amber-500/20 text-neutral-200 hover:text-amber-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +10"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>

                {/* Water Block */}
                <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400 flex items-center gap-1">💧 Water</span>
                    <span className="font-mono text-neutral-400 text-[11px]">Prev: <strong className="text-neutral-200">{t.prevWaterReading}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      step="any"
                      value={r.currWater}
                      onChange={e => handleUpdate(t.id, 'currWater', parseFloat(e.target.value))}
                      aria-label={`Water reading for room ${t.roomNumber}`}
                      className={`w-full h-11 text-center font-mono font-black text-lg rounded-xl px-2 focus:outline-none transition-all ${
                        isWaterDecreased
                          ? 'bg-red-950/20 border-2 border-red-500 text-red-300'
                          : 'bg-[#181818] border border-white/15 text-cyan-300 focus:border-cyan-500'
                      }`}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currWater', r.currWater + 1)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-cyan-500/20 text-neutral-200 hover:text-cyan-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currWater', r.currWater + 5)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-cyan-500/20 text-neutral-200 hover:text-cyan-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id, 'currWater', r.currWater + 10)}
                        className="h-11 px-2.5 bg-white/5 hover:bg-cyan-500/20 text-neutral-200 hover:text-cyan-300 border border-white/10 rounded-xl font-mono text-xs font-bold cursor-pointer"
                        title="Add +10"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-[#181818] hover:bg-white/10 text-neutral-300 font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer border border-white/10"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer"
          >
            Apply All Meter Readings
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const HistoryDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  entry: any; // BillHistoryEntry
  onUpdateTenant?: (entryId: string, tenantId: string, updates: any) => void;
  supportMasterOverrideMode?: boolean;
  addAuditLog?: (tenantId: string, tenantName: string, month: string, fieldName: string, oldValue: string, newValue: string) => void;
  recalculateBalances?: () => void;
}> = ({ isOpen, onClose, entry, onUpdateTenant, supportMasterOverrideMode, addAuditLog, recalculateBalances }) => {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('');

  // Local state for Master Support overrides
  const [overrideOpening, setOverrideOpening] = useState<number>(0);
  const [overrideTotalDue, setOverrideTotalDue] = useState<number>(0);
  const [overridePaidAmount, setOverridePaidAmount] = useState<number>(0);
  const [overrideIsPaid, setOverrideIsPaid] = useState<boolean>(false);

  const selectedTenant = entry ? entry.snapshot.tenants.find((t: any) => t.id === selectedTenantId) : null;

  useEffect(() => {
    if (selectedTenant && entry) {
      const p = entry.snapshot.property;
      const elecUnits = Math.max(0, selectedTenant.currElecReading - selectedTenant.prevElecReading);
      const waterUnits = Math.max(0, selectedTenant.currWaterReading - selectedTenant.prevWaterReading);
      const totalExtra = (selectedTenant.expenses || []).reduce((acc: number, exp: any) => acc + exp.amount, 0);
      const computedOpening = selectedTenant.manualOverrides?.openingBalance ?? selectedTenant.openingBalance ?? selectedTenant.previousDues ?? 0;
      const baseCharges = selectedTenant.rent + (elecUnits * p.electricRate) + (waterUnits * p.waterRate) + totalExtra;
      const computedTotalDue = selectedTenant.manualOverrides?.totalDue ?? (computedOpening + baseCharges);
      
      setOverrideOpening(computedOpening);
      setOverrideTotalDue(computedTotalDue);
      setOverridePaidAmount(selectedTenant.manualOverrides?.paidAmount ?? selectedTenant.paidAmount ?? 0);
      setOverrideIsPaid(selectedTenant.manualOverrides?.isPaid ?? selectedTenant.isPaid ?? false);
    }
  }, [selectedTenantId, entry, selectedTenant]);

  if (!entry) return null;

  const handleAddPayment = () => {
    if (!selectedTenantId || paymentAmount <= 0) return;
    
    const tenant = entry.snapshot.tenants.find((t: any) => t.id === selectedTenantId);
    const p = entry.snapshot.property;
    const elecUnits = Math.max(0, tenant.currElecReading - tenant.prevElecReading);
    const waterUnits = Math.max(0, tenant.currWaterReading - tenant.prevWaterReading);
    const totalExtra = tenant.expenses.reduce((acc: number, exp: any) => acc + exp.amount, 0);
    const totalDue = tenant.rent + (elecUnits * p.electricRate) + (waterUnits * p.waterRate) + totalExtra + tenant.previousDues;

    const currentPayments = Array.isArray(tenant.payments) ? tenant.payments : [];
    const currentPaid = typeof tenant.paidAmount === 'number' ? tenant.paidAmount : (tenant.isPaid ? totalDue : 0);
    const newPaidAmount = currentPaid + paymentAmount;
    const remainingBalance = Math.max(0, totalDue - newPaidAmount);
    const isFullyPaid = newPaidAmount >= totalDue;

    const newRecord: PaymentRecord = {
      id: generateId(),
      amount: paymentAmount,
      date: Date.now(),
      note: paymentNote || 'Historical Payment Received',
      remainingBalance: remainingBalance
    };

    onUpdateTenant?.(entry.id, selectedTenantId, {
      payments: [...currentPayments, newRecord],
      paidAmount: newPaidAmount,
      isPaid: isFullyPaid
    });

    setPaymentAmount(0);
    setPaymentNote('');
    setSelectedTenantId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Historical Ledger: ${entry.month}`}>
      <div className="space-y-8">
        <div className="flex items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/10">
           <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
              <HistoryIcon className="w-8 h-8" />
           </div>
           <div className="flex-1">
              <h4 className="text-2xl font-bold text-white tracking-tight">{entry.snapshot.property.name}</h4>
              <p className="text-sm text-slate-400 font-mono flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Finalized on {new Date(entry.createdAt).toLocaleDateString()}
              </p>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {entry.snapshot.tenants.map((t: any) => {
            const p = entry.snapshot.property;
            const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
            const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
            const totalExtra = t.expenses.reduce((acc: number, exp: any) => acc + exp.amount, 0);
            
            // Core Logic: totalDue in history should use openingBalance if it exists, otherwise fallback to previousDues
            const opening = t.openingBalance || t.previousDues || 0;
            const currentCharges = t.rent + (elecUnits * p.electricRate) + (waterUnits * p.waterRate) + totalExtra;
            const totalDue = currentCharges + opening;
            
            const paid = t.paidAmount || (t.isPaid ? totalDue : 0);
            const balance = totalDue - paid;

            return (
              <div key={t.id} className="relative group">
                <div className={cn(
                  "p-5 rounded-[1.5rem] border transition-all",
                  selectedTenantId === t.id ? "bg-white/10 border-blue-500/30 ring-1 ring-blue-500/20 scale-[1.02]" : "bg-slate-900/50 border-white/5 hover:bg-white/5"
                )}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-white">{t.name}</span>
                          <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-mono text-slate-500">RM {t.roomNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                            opening > 0 ? "text-rose-400 bg-rose-500/5 border-rose-500/20 shadow-[0_0_8px_rgba(239,68,68,0.05)]" : "text-slate-500 bg-slate-900 border-white/5"
                          )}>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Arrears: {formatCurrency(opening)}
                          </div>
                          <button
                            onClick={() => {
                              const newArrears = prompt(`Enter custom carried-forward Arrears amount for ${t.name}:`, String(opening));
                              if (newArrears !== null) {
                                const parsed = Number(newArrears);
                                if (!isNaN(parsed)) {
                                  addAuditLog?.(t.id, t.name, entry.month, "Carried-Over Arrears", `${formatCurrency(opening)}`, `${formatCurrency(parsed)}`);
                                  onUpdateTenant?.(entry.id, t.id, {
                                    manualOverrides: {
                                      ...(t.manualOverrides || {}),
                                      openingBalance: parsed
                                    }
                                  });
                                }
                              }
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-slate-800 active:bg-blue-500/20 text-[9px] text-blue-400 hover:text-blue-300 uppercase font-bold tracking-wider rounded-lg border border-white/5 hover:border-blue-500/20 transition-all flex items-center gap-1 cursor-pointer"
                            title="Directly edit the carried-over arrears for this past cycle"
                          >
                            <Edit2 className="w-2.5 h-2.5 shrink-0" />
                            Edit Arrears
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 mb-0.5">Current Bill</p>
                          <p className="text-sm font-bold text-white font-mono">₹{currentCharges.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 mb-0.5">Total Due</p>
                          <p className="text-sm font-bold text-white font-mono">₹{totalDue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 mb-0.5">Paid Amount</p>
                          <p className="text-sm font-bold text-emerald-400 font-mono">₹{paid.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 mb-0.5">Outstanding</p>
                          <p className={cn("text-sm font-bold font-mono", balance > 0 ? "text-rose-400" : "text-emerald-500")}>
                            ₹{balance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                       <span className={cn(
                         "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors",
                         t.isPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : balance < totalDue && paid > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                       )}>
                         {t.isPaid ? 'Settled' : balance < totalDue && paid > 0 ? 'Partial' : 'Outstanding'}
                       </span>
                       <button 
                        onClick={() => setSelectedTenantId(selectedTenantId === t.id ? null : t.id)}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 cursor-pointer",
                          supportMasterOverrideMode ? "text-amber-400 hover:text-amber-300" : "text-blue-400 hover:text-blue-300"
                        )}
                       >
                         {selectedTenantId === t.id 
                           ? (supportMasterOverrideMode ? 'Close Alterations' : 'Close Edit') 
                           : (supportMasterOverrideMode ? 'Master Alteration' : 'Edit Payment')}
                       </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedTenantId === t.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-6 pt-6 border-t border-white/10"
                      >
                        <div className="space-y-4">
                          {t.payments && t.payments.length > 0 && (
                            <div className="space-y-2 mb-4">
                              <p className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-2">Payment History</p>
                              {t.payments.map((rec: PaymentRecord) => (
                                <div key={rec.id} className="flex justify-between items-center text-xs py-2 px-3 bg-white/5 rounded-lg border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="font-mono text-slate-300">₹{rec.amount.toLocaleString()}</span>
                                    {rec.note && <span className="text-[10px] text-slate-500 italic">— {rec.note}</span>}
                                  </div>
                                  <span className="text-[10px] text-slate-600 uppercase font-bold">{new Date(rec.date).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {supportMasterOverrideMode ? (
                            <div className="space-y-4 bg-amber-500/[0.02] border border-amber-500/15 p-5 rounded-2xl">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)] animate-pulse" />
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-400">Master Support Alteration Screen</h5>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Arrears/Opening Dues</label>
                                  <div className="relative mt-1">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                      type="number"
                                      className="input text-xs pl-8 bg-slate-950 border border-white/5 text-amber-300 focus:border-amber-500 font-mono"
                                      value={overrideOpening}
                                      onChange={e => setOverrideOpening(Number(e.target.value))}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 font-sans">Total Bill Override</label>
                                  <div className="relative mt-1">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                      type="number"
                                      className="input text-xs pl-8 bg-slate-950 border border-white/5 text-amber-300 focus:border-amber-500 font-mono"
                                      value={overrideTotalDue}
                                      onChange={e => setOverrideTotalDue(Number(e.target.value))}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 font-sans">Paid Amount</label>
                                  <div className="relative mt-1">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                      type="number"
                                      className="input text-xs pl-8 bg-slate-950 border border-white/5 text-amber-300 focus:border-amber-500 font-mono"
                                      value={overridePaidAmount}
                                      onChange={e => setOverridePaidAmount(Number(e.target.value))}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 font-sans">Paid Status</label>
                                  <select
                                    className="input text-xs bg-slate-950 border border-white/5 text-amber-300 focus:border-amber-500 mt-1 h-[38px] cursor-pointer"
                                    value={overrideIsPaid ? "true" : "false"}
                                    onChange={e => setOverrideIsPaid(e.target.value === "true")}
                                  >
                                    <option value="true">Settled (Paid)</option>
                                    <option value="false">Outstanding/Partial</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const oldOpening = selectedTenant.manualOverrides?.openingBalance ?? selectedTenant.openingBalance ?? selectedTenant.previousDues ?? 0;
                                    const oldTotal = selectedTenant.manualOverrides?.totalDue ?? totalDue;
                                    const oldPaid = selectedTenant.manualOverrides?.paidAmount ?? selectedTenant.paidAmount ?? 0;
                                    const oldPaidBool = selectedTenant.manualOverrides?.isPaid ?? selectedTenant.isPaid ?? false;

                                    if (overrideOpening !== oldOpening) {
                                      addAuditLog?.(selectedTenant.id, selectedTenant.name, entry.month, "Remaining Arrears", `${formatCurrency(oldOpening)}`, `${formatCurrency(overrideOpening)}`);
                                    }
                                    if (overrideTotalDue !== oldTotal) {
                                      addAuditLog?.(selectedTenant.id, selectedTenant.name, entry.month, "Manual Bill Overridden", `${formatCurrency(oldTotal)}`, `${formatCurrency(overrideTotalDue)}`);
                                    }
                                    if (overridePaidAmount !== oldPaid) {
                                      addAuditLog?.(selectedTenant.id, selectedTenant.name, entry.month, "Manual Payment Adjusted", `${formatCurrency(oldPaid)}`, `${formatCurrency(overridePaidAmount)}`);
                                    }
                                    if (overrideIsPaid !== oldPaidBool) {
                                      addAuditLog?.(selectedTenant.id, selectedTenant.name, entry.month, "Status Overridden", `${oldPaidBool ? "Settled" : "Outstanding"}`, `${overrideIsPaid ? "Settled" : "Outstanding"}`);
                                    }

                                    onUpdateTenant?.(entry.id, selectedTenant.id, {
                                      manualOverrides: {
                                        openingBalance: overrideOpening,
                                        totalDue: overrideTotalDue,
                                        paidAmount: overridePaidAmount,
                                        isPaid: overrideIsPaid
                                      }
                                    });
                                    setSelectedTenantId(null);
                                  }}
                                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Auto-Adjust & Sync Downstream
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setSelectedTenantId(null)}
                                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                           ) : (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="col-span-2">
                                   <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Payment Note</label>
                                   <input 
                                    className="input text-xs bg-slate-950 mt-1" 
                                    placeholder="GPay / Cash / Partial payment..." 
                                    value={paymentNote}
                                    onChange={e => setPaymentNote(e.target.value)}
                                   />
                                </div>
                                <div>
                                   <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Amount</label>
                                   <div className="relative mt-1">
                                     <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                     <input 
                                      type="number" 
                                      className="input text-xs pl-8 bg-slate-950" 
                                      value={paymentAmount}
                                      onChange={e => setPaymentAmount(Number(e.target.value))}
                                     />
                                   </div>
                                </div>
                              </div>
                              <button 
                                onClick={handleAddPayment}
                                className="btn-primary w-full py-3 text-[10px] uppercase font-black bg-blue-600/20 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white cursor-pointer"
                              >
                                Record Late Payment
                              </button>
                            </>
                           )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export const TenantProfileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  property: Property;
  history: any[];
  onSaveBillEdit: (tenantId: string, overrides: Partial<ManualOverrides>) => void;
  onOpenHistoryDetail: (entry: any) => void;
  onUpdateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
}> = ({ isOpen, onClose, tenant, property, history, onSaveBillEdit, onOpenHistoryDetail, onUpdateTenant }) => {
  const billing = getTenantBillingDetails(tenant, property);
  
  const [isEditing, setIsEditing] = useState(false);
  const [baseRent, setBaseRent] = useState(billing.baseRent);
  const [elecCharges, setElecCharges] = useState(billing.electricityCharges);
  const [waterCharges, setWaterCharges] = useState(billing.waterCharges);
  const [otherFees, setOtherFees] = useState(billing.otherFees);
  const [openingBalance, setOpeningBalance] = useState(billing.openingBalance);

  const [partialPayment, setPartialPayment] = useState<number>(billing.paidAmount);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync state with tenant details when tenant changes or modal is opened
  useEffect(() => {
    setBaseRent(billing.baseRent);
    setElecCharges(billing.electricityCharges);
    setWaterCharges(billing.waterCharges);
    setOtherFees(billing.otherFees);
    setOpeningBalance(billing.openingBalance);
    setPartialPayment(billing.paidAmount);
    setValidationError(null);
  }, [tenant.id, isOpen, billing.baseRent, billing.electricityCharges, billing.waterCharges, billing.otherFees, billing.openingBalance, billing.paidAmount]);

  // Real-time calculated live total due matching direct edits
  const liveTotalDue = baseRent + elecCharges + waterCharges + otherFees + openingBalance;
  const liveOutstanding = Math.max(0, liveTotalDue - billing.paidAmount);

  // Filter history entries that contain records for this tenant
  const tenantHistory = history.filter((h: any) => 
    h.snapshot.tenants.some((t: any) => t.id === tenant.id)
  );

  const handleSave = () => {
    onSaveBillEdit(tenant.id, {
      baseRent,
      electricityCharges: elecCharges,
      waterCharges: waterCharges,
      otherFees: otherFees,
      openingBalance,
      totalDue: liveTotalDue
    });
    setIsEditing(false);
  };

  const handlePartialPaymentChange = (value: number) => {
    if (value < 0) {
      setValidationError("Amount cannot be negative");
      setPartialPayment(value);
      return;
    }
    if (value > billing.totalDue) {
      setValidationError(`Amount cannot exceed the total due of ${formatCurrency(billing.totalDue)}`);
      setPartialPayment(value);
      return;
    }
    setValidationError(null);
    setPartialPayment(value);
  };

  const handleUpdatePayment = (valueToSave: number) => {
    if (valueToSave < 0 || valueToSave > billing.totalDue) {
      return;
    }
    const isFullyPaid = valueToSave >= billing.totalDue;
    const currentPaid = billing.paidAmount;
    const delta = valueToSave - currentPaid;
    let updatedPayments = [...(tenant.payments || [])];
    const remainingBalance = Math.max(0, billing.totalDue - valueToSave);

    if (delta > 0) {
      const newRecord: PaymentRecord = {
        id: generateId(),
        amount: delta,
        date: Date.now(),
        note: 'Payment Recorded via Profile',
        remainingBalance: remainingBalance
      };
      updatedPayments.push(newRecord);
    } else if (valueToSave === 0) {
      updatedPayments = [];
    }
    
    onUpdateTenant(tenant.id, {
      payments: updatedPayments,
      paidAmount: valueToSave,
      isPaid: isFullyPaid,
      manualOverrides: tenant.manualOverrides ? {
        ...tenant.manualOverrides,
        paidAmount: valueToSave,
        isPaid: isFullyPaid
      } : undefined
    });
  };

  const [showEditDetails, setShowEditDetails] = useState(false);

  const handleExportTenantCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // Title & Metadata
    lines.push(escapeCSV("TENANT PROFILE & LEDGER REPORT"));
    lines.push(`${escapeCSV("Generated Date")},${escapeCSV(new Date().toLocaleString())}`);
    lines.push("");

    // Section 1: Tenant Core Details
    lines.push(escapeCSV("--- TENANT INFORMATION ---"));
    lines.push(`${escapeCSV("Tenant Name")},${escapeCSV(tenant.name)}`);
    lines.push(`${escapeCSV("Room Number")},${escapeCSV(tenant.roomNumber)}`);
    lines.push(`${escapeCSV("Property Name")},${escapeCSV(property.name)}`);
    lines.push(`${escapeCSV("Phone / WhatsApp")},${escapeCSV(tenant.whatsappNumber || (tenant as any).phone || "N/A")}`);
    lines.push(`${escapeCSV("Settlement Status")},${escapeCSV(billing.outstandingBalance <= 0 ? "Paid / Settled" : billing.paidAmount > 0 ? "Partial Payment" : "Unpaid / Arrears")}`);
    lines.push("");

    // Section 2: Current Cycle Billing Breakdown & Arrears
    lines.push(escapeCSV("--- CURRENT BILLING CYCLE BREAKDOWN & ARREARS ---"));
    lines.push(`${escapeCSV("Base Rent")},${escapeCSV(billing.baseRent)}`);
    lines.push(`${escapeCSV("Electricity Prev Reading")},${escapeCSV(tenant.prevElecReading)}`);
    lines.push(`${escapeCSV("Electricity Curr Reading")},${escapeCSV(tenant.currElecReading)}`);
    lines.push(`${escapeCSV("Electricity Units Consumed")},${escapeCSV(billing.elecUnits)}`);
    lines.push(`${escapeCSV("Electricity Rate Per Unit")},${escapeCSV(property.electricRate)}`);
    lines.push(`${escapeCSV("Electricity Charges")},${escapeCSV(billing.electricityCharges)}`);
    lines.push(`${escapeCSV("Water Prev Reading")},${escapeCSV(tenant.prevWaterReading)}`);
    lines.push(`${escapeCSV("Water Curr Reading")},${escapeCSV(tenant.currWaterReading)}`);
    lines.push(`${escapeCSV("Water Units Consumed")},${escapeCSV(billing.waterUnits)}`);
    lines.push(`${escapeCSV("Water Rate Per Unit")},${escapeCSV(property.waterRate)}`);
    lines.push(`${escapeCSV("Water Charges")},${escapeCSV(billing.waterCharges)}`);
    lines.push(`${escapeCSV("Other Fees / Expenses")},${escapeCSV(billing.otherFees)}`);
    lines.push(`${escapeCSV("Opening Balance / Previous Arrears")},${escapeCSV(billing.openingBalance)}`);
    lines.push(`${escapeCSV("Total Bill Due")},${escapeCSV(billing.totalDue)}`);
    lines.push(`${escapeCSV("Total Amount Paid")},${escapeCSV(billing.paidAmount)}`);
    lines.push(`${escapeCSV("Current Outstanding Balance")},${escapeCSV(billing.outstandingBalance)}`);
    lines.push("");

    // Section 3: Itemized Additional Expenses (if present)
    if (tenant.expenses && tenant.expenses.length > 0) {
      lines.push(escapeCSV("--- ITEMIZED ADDITIONAL EXPENSES ---"));
      lines.push([escapeCSV("Expense Title"), escapeCSV("Amount")].join(","));
      tenant.expenses.forEach(exp => {
        lines.push([escapeCSV(exp.title), escapeCSV(exp.amount)].join(","));
      });
      lines.push("");
    }

    // Section 4: Payments Ledger
    lines.push(escapeCSV("--- ALL PAYMENT TRANSACTIONS ---"));
    const paymentHeaders = ["Payment ID", "Date", "Amount Paid", "Note / Method", "Remaining Balance After Payment"];
    lines.push(paymentHeaders.map(escapeCSV).join(","));

    if (tenant.payments && tenant.payments.length > 0) {
      tenant.payments.forEach(p => {
        const pDate = p.date ? new Date(p.date).toLocaleString() : "N/A";
        const remBal = p.remainingBalance !== undefined ? p.remainingBalance : "N/A";
        lines.push([
          escapeCSV(p.id),
          escapeCSV(pDate),
          escapeCSV(p.amount),
          escapeCSV(p.note || "Payment"),
          escapeCSV(remBal)
        ].join(","));
      });
    } else {
      lines.push(escapeCSV("No payment transactions recorded for this tenant in current period."));
    }
    lines.push("");

    // Section 5: Historical Bills & Meter Readings
    lines.push(escapeCSV("--- BILL & METER READING HISTORY SNAPSHOTS ---"));
    const historyHeaders = [
      "History Period / Cycle",
      "Property",
      "Base Rent",
      "Elec Prev",
      "Elec Curr",
      "Elec Units",
      "Elec Charges",
      "Water Prev",
      "Water Curr",
      "Water Units",
      "Water Charges",
      "Other Fees",
      "Arrears / Opening Balance",
      "Total Due",
      "Paid Amount",
      "Outstanding Balance",
      "Status"
    ];
    lines.push(historyHeaders.map(escapeCSV).join(","));

    if (tenantHistory && tenantHistory.length > 0) {
      tenantHistory.forEach((h: any) => {
        const hTenant = h.snapshot.tenants.find((t: any) => t.id === tenant.id);
        if (!hTenant) return;
        const hProp = h.snapshot.property || property;
        const hBilling = getTenantBillingDetails(hTenant, hProp);
        const periodLabel = h.month || h.snapshot.month || (h.date ? new Date(h.date).toLocaleDateString() : "Historical");
        const statusStr = hBilling.outstandingBalance <= 0 ? "Paid" : hBilling.paidAmount > 0 ? "Partial" : "Unpaid";

        lines.push([
          escapeCSV(periodLabel),
          escapeCSV(hProp.name),
          escapeCSV(hBilling.baseRent),
          escapeCSV(hTenant.prevElecReading),
          escapeCSV(hTenant.currElecReading),
          escapeCSV(hBilling.elecUnits),
          escapeCSV(hBilling.electricityCharges),
          escapeCSV(hTenant.prevWaterReading),
          escapeCSV(hTenant.currWaterReading),
          escapeCSV(hBilling.waterUnits),
          escapeCSV(hBilling.waterCharges),
          escapeCSV(hBilling.otherFees),
          escapeCSV(hBilling.openingBalance),
          escapeCSV(hBilling.totalDue),
          escapeCSV(hBilling.paidAmount),
          escapeCSV(hBilling.outstandingBalance),
          escapeCSV(statusStr)
        ].join(","));
      });
    } else {
      lines.push(escapeCSV("No historical billing entries recorded yet."));
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const dateStr = new Date().toISOString().split('T')[0];
    const safeTenantName = tenant.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeTenantName}_report_${dateStr}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Tenant Dossier & Records`}>
        <div className="space-y-6">
          {/* Dossier Header Info */}
          <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-extrabold text-white">{tenant.name}</h4>
                <span className="px-2.5 py-0.5 bg-slate-800 rounded-lg text-[10px] font-mono text-slate-400">RM {tenant.roomNumber}</span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">{property.name}</p>
              {(tenant.whatsappNumber || (tenant as any).phone) && (
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Phone/WhatsApp: <span className="text-blue-400 font-bold">{tenant.whatsappNumber || (tenant as any).phone}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={handleExportTenantCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                title="Download full CSV report for this tenant"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
              <button
                onClick={() => setShowEditDetails(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Details
              </button>
            </div>
          </div>

        {/* Current Month Bill Profile (Inline View/Edit) */}
        <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5">
          <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
            <div>
              <h5 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Cycle Bill & Overrides</h5>
              <p className="text-[10px] text-slate-500 mt-0.5">Toggle Edit Bill to apply manual direct charge adjustments.</p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {isEditing ? 'Cancel Edit' : 'Edit Bill'}
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Base Rent (Rent)</label>
                  <input
                    type="number"
                    className="input bg-slate-950/80 border-white/10 mt-1"
                    value={baseRent}
                    onChange={e => setBaseRent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Arrears (Opening Bal)</label>
                  <input
                    type="number"
                    className="input bg-slate-950/80 border-white/10 mt-1"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Elec. Charges</label>
                  <input
                    type="number"
                    className="input bg-slate-950/80 border-white/10 mt-1"
                    value={elecCharges}
                    onChange={e => setElecCharges(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Water Charges</label>
                  <input
                    type="number"
                    className="input bg-slate-950/80 border-white/10 mt-1"
                    value={waterCharges}
                    onChange={e => setWaterCharges(Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Other Fees & Services</label>
                  <input
                    type="number"
                    className="input bg-slate-950/80 border-white/10 mt-1"
                    value={otherFees}
                    onChange={e => setOtherFees(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Dynamic Live Calculations */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 mt-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">New Bill Total</p>
                  <p className="text-xl font-bold text-white font-mono">₹{liveTotalDue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Outstanding</p>
                  <p className="text-xl font-bold text-rose-400 font-mono">₹{liveOutstanding.toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={handleSave}
                className="btn btn-primary w-full py-3 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 hover:text-white cursor-pointer"
              >
                Save Overridden Values
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/[0.03]">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Base Rent</span>
                  <span className="text-sm font-bold text-white font-mono">₹{billing.baseRent.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/[0.03]">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Electricity</span>
                  <span className="text-sm font-bold text-white font-mono">
                    ₹{billing.electricityCharges.toLocaleString()} 
                    <span className="text-[9px] text-slate-500 font-mono ml-1">({billing.elecUnits}U)</span>
                  </span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/[0.03]">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Water</span>
                  <span className="text-sm font-bold text-white font-mono">
                    ₹{billing.waterCharges.toLocaleString()}
                    <span className="text-[9px] text-slate-500 font-mono ml-1">({billing.waterUnits}U)</span>
                  </span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/[0.03]">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Other Fees</span>
                  <span className="text-sm font-bold text-white font-mono">₹{billing.otherFees.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/[0.03]">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Opening Arrears</span>
                  <span className="text-sm font-bold text-amber-500 font-mono">₹{billing.openingBalance.toLocaleString()}</span>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-blue-500/10">
                  <span className="text-[9px] uppercase tracking-wider text-blue-400 font-black block">Total Bill Due</span>
                  <span className="text-sm font-bold text-white font-mono">₹{billing.totalDue.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center mt-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Outstanding Balance</span>
                  <p className={cn("text-lg font-black font-mono", billing.outstandingBalance > 0 ? "text-rose-400" : "text-emerald-400")}>
                    ₹{billing.outstandingBalance.toLocaleString()}
                  </p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  tenant.isPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : billing.paidAmount > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                )}>
                  {tenant.isPaid ? 'Settled' : billing.paidAmount > 0 ? 'Partial' : 'Unpaid'}
                </span>
              </div>

              {/* Partial Payment / Adjust Payment Section */}
              <div className="mt-4 p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <h6 className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400">
                    Partial Payment / Adjust Payment
                  </h6>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total Due: ₹{billing.totalDue.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-xs font-bold">₦</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className={cn(
                        "input pl-8 text-xs font-mono bg-slate-950 text-amber-300 border border-white/10 focus:border-amber-500 w-full transition-colors h-10 rounded-xl",
                        validationError && "border-rose-500 focus:border-rose-500 text-rose-400"
                      )}
                      placeholder="Enter amount (₦)..."
                      value={partialPayment === 0 && isFocused === false ? "" : partialPayment}
                      onChange={e => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        handlePartialPaymentChange(val);
                      }}
                      onBlur={() => {
                        setIsFocused(false);
                        if (!validationError) {
                          handleUpdatePayment(partialPayment);
                        }
                      }}
                      onFocus={() => setIsFocused(true)}
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      if (!validationError) {
                        handleUpdatePayment(partialPayment);
                      }
                    }}
                    disabled={!!validationError}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 h-10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                  >
                    Update
                  </button>
                </div>

                {validationError ? (
                  <p className="text-[10px] text-rose-400 font-semibold">{validationError}</p>
                ) : (
                  <div className="text-[10px] text-slate-400 flex justify-between items-center bg-white/[0.02] p-2 rounded-lg border border-white/[0.02]">
                    <span className="font-bold">Partial Payment (₦)</span>
                    <span className="font-mono">
                      Remaining Balance: ₦{Math.max(0, billing.totalDue - partialPayment).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Previous Month Bill History Section */}
        <div className="space-y-3">
          <div>
            <h5 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Previous Billing History</h5>
            <p className="text-[10px] text-slate-500 mt-0.5">Click into any past month snapshot ledger to manage or alter archives.</p>
          </div>

          {tenantHistory.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {tenantHistory.map((h: any) => {
                const histTenant = h.snapshot.tenants.find((t: any) => t.id === tenant.id);
                const histProp = h.snapshot.property;
                
                // Historical calculated billing details
                const detail = getTenantBillingDetails(histTenant, histProp);

                return (
                  <div key={h.id} className="p-4 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl border border-white/5 transition-all flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{h.month}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                          histTenant.isPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}>
                          {histTenant.isPaid ? 'Paid' : 'Due'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Charges: <span className="text-slate-300 font-bold">₹{detail.totalDue.toLocaleString()}</span> &bull; 
                        Paid: <span className="text-emerald-400 font-bold">₹{detail.paidAmount.toLocaleString()}</span> &bull;
                        Outstanding: <span className="text-rose-400 font-bold">₹{detail.outstandingBalance.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onOpenHistoryDetail(h)}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-[10px] uppercase tracking-wider font-extrabold text-blue-400 border border-blue-500/15 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      View Snapshot
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5 italic text-xs text-slate-600">
              No previous ledger transactions recorded yet for this tenant.
            </div>
          )}
        </div>
      </div>
    </Modal>

    <EditTenantDetailsModal
      isOpen={showEditDetails}
      onClose={() => setShowEditDetails(false)}
      tenant={tenant}
      onUpdateTenant={onUpdateTenant}
    />
    </>
  );
};

export const EditTenantDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  onUpdateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
  showToast?: (msg: string, type?: string) => void;
}> = ({ isOpen, onClose, tenant, onUpdateTenant, showToast }) => {
  const [name, setName] = useState(tenant?.name || '');
  const [phone, setPhone] = useState(tenant?.whatsappNumber || (tenant as any)?.phone || '');

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setPhone(tenant.whatsappNumber || (tenant as any)?.phone || '');
    }
  }, [tenant, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdateTenant(tenant.id, {
      name: name.trim(),
      whatsappNumber: phone.trim(),
      phone: phone.trim()
    });
    if (showToast) {
      showToast('Tenant details updated successfully');
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Tenant Details">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
            Tenant Name
          </label>
          <input
            type="text"
            required
            className="input bg-slate-900/80 border-white/10 w-full text-sm font-bold text-white focus:border-blue-500"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
            Phone Number / WhatsApp
          </label>
          <input
            type="text"
            className="input bg-slate-900/80 border-white/10 w-full text-sm font-mono text-white focus:border-blue-500"
            placeholder="e.g. +91 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded-xl transition-colors shadow-lg cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const EditTenantContractModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  property: Property;
  onUpdateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
  showToast?: (msg: string, type?: string) => void;
}> = ({ isOpen, onClose, tenant, property, onUpdateTenant, showToast }) => {
  const elecRate = property?.electricRate || 0;
  const waterRate = property?.waterRate || 0;

  const [baseRent, setBaseRent] = useState<number>(0);
  const [prevElec, setPrevElec] = useState<number>(0);
  const [currElec, setCurrElec] = useState<number>(0);
  const [elecCharges, setElecCharges] = useState<number>(0);

  const [prevWater, setPrevWater] = useState<number>(0);
  const [currWater, setCurrWater] = useState<number>(0);
  const [waterCharges, setWaterCharges] = useState<number>(0);

  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [otherFees, setOtherFees] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  useEffect(() => {
    if (tenant) {
      const initRent = tenant.manualOverrides?.baseRent !== undefined ? tenant.manualOverrides.baseRent : (tenant.rent || 0);
      const pElec = tenant.prevElecReading || 0;
      const cElec = tenant.currElecReading || 0;
      const eCharges = tenant.manualOverrides?.electricityCharges !== undefined 
        ? tenant.manualOverrides.electricityCharges 
        : Math.max(0, cElec - pElec) * elecRate;

      const pWater = tenant.prevWaterReading || 0;
      const cWater = tenant.currWaterReading || 0;
      const wCharges = tenant.manualOverrides?.waterCharges !== undefined 
        ? tenant.manualOverrides.waterCharges 
        : Math.max(0, cWater - pWater) * waterRate;

      const oBal = tenant.manualOverrides?.openingBalance !== undefined ? tenant.manualOverrides.openingBalance : (tenant.previousDues || 0);
      const oFees = tenant.manualOverrides?.otherFees !== undefined ? tenant.manualOverrides.otherFees : ((tenant.expenses || []).reduce((s, e) => s + e.amount, 0));
      const pAmt = tenant.manualOverrides?.paidAmount !== undefined ? tenant.manualOverrides.paidAmount : (tenant.paidAmount || 0);

      setBaseRent(initRent);
      setPrevElec(pElec);
      setCurrElec(cElec);
      setElecCharges(eCharges);
      setPrevWater(pWater);
      setCurrWater(cWater);
      setWaterCharges(wCharges);
      setOpeningBalance(oBal);
      setOtherFees(oFees);
      setPaidAmount(pAmt);
    }
  }, [tenant, property, isOpen, elecRate, waterRate]);

  const handleElecReadingChange = (pVal: number, cVal: number) => {
    setPrevElec(pVal);
    setCurrElec(cVal);
    const u = Math.max(0, cVal - pVal);
    setElecCharges(u * elecRate);
  };

  const handleWaterReadingChange = (pVal: number, cVal: number) => {
    setPrevWater(pVal);
    setCurrWater(cVal);
    const u = Math.max(0, cVal - pVal);
    setWaterCharges(u * waterRate);
  };

  const elecUnits = Math.max(0, currElec - prevElec);
  const waterUnits = Math.max(0, currWater - prevWater);

  const totalPeriodBilling = baseRent + elecCharges + waterCharges + otherFees + openingBalance;
  const remainingOutstanding = totalPeriodBilling - paidAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    const isPaid = paidAmount >= totalPeriodBilling;

    onUpdateTenant(tenant.id, {
      rent: baseRent,
      prevElecReading: prevElec,
      currElecReading: currElec,
      prevWaterReading: prevWater,
      currWaterReading: currWater,
      previousDues: openingBalance,
      paidAmount: paidAmount,
      isPaid: isPaid,
      manualOverrides: {
        baseRent,
        electricityCharges: elecCharges,
        waterCharges: waterCharges,
        openingBalance,
        otherFees,
        totalDue: totalPeriodBilling,
        paidAmount,
        isPaid
      }
    });

    if (showToast) {
      showToast('Tenant contract & billing details updated successfully');
    }
    onClose();
  };

  if (!tenant) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Tenant Contract — ${tenant.name}`}>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        
        {/* Contract Base Rent */}
        <div className="bg-[#181818] p-4 rounded-2xl border border-white/10 space-y-2">
          <label className="text-xs uppercase font-extrabold text-amber-400 tracking-wider block">
            Contract Base Rent (₹)
          </label>
          <input
            type="number"
            required
            step="any"
            value={baseRent}
            onChange={e => setBaseRent(Number(e.target.value))}
            className="input bg-[#0D0D0D] border-white/10 font-mono text-base font-bold text-white w-full focus:border-amber-500"
          />
        </div>

        {/* Electricity Charges Section */}
        <div className="bg-[#181818] p-4 rounded-2xl border border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center gap-1.5">
              ⚡ Electricity Charges
            </span>
            <span className="text-[11px] font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
              Readings: {prevElec} → {currElec} ({elecUnits} Units @ ₹{elecRate.toFixed(2)}/U)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Previous Reading
              </label>
              <input
                type="number"
                step="any"
                value={prevElec}
                onChange={e => handleElecReadingChange(Number(e.target.value), currElec)}
                className="input bg-[#0D0D0D] border-white/10 font-mono text-xs text-white w-full"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Current Reading
              </label>
              <input
                type="number"
                step="any"
                value={currElec}
                onChange={e => handleElecReadingChange(prevElec, Number(e.target.value))}
                className="input bg-[#0D0D0D] border-white/10 font-mono text-xs text-white w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Calculated / Override Electricity Charge (₹)
            </label>
            <input
              type="number"
              step="any"
              value={elecCharges}
              onChange={e => setElecCharges(Number(e.target.value))}
              className="input bg-[#0D0D0D] border-white/10 font-mono text-sm font-bold text-amber-300 w-full"
            />
          </div>
        </div>

        {/* Water Charges Section */}
        <div className="bg-[#181818] p-4 rounded-2xl border border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider flex items-center gap-1.5">
              💧 Water Charges
            </span>
            <span className="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
              Readings: {prevWater} → {currWater} ({waterUnits} Units @ ₹{waterRate.toFixed(2)}/U)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Previous Reading
              </label>
              <input
                type="number"
                step="any"
                value={prevWater}
                onChange={e => handleWaterReadingChange(Number(e.target.value), currWater)}
                className="input bg-[#0D0D0D] border-white/10 font-mono text-xs text-white w-full"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Current Reading
              </label>
              <input
                type="number"
                step="any"
                value={currWater}
                onChange={e => handleWaterReadingChange(prevWater, Number(e.target.value))}
                className="input bg-[#0D0D0D] border-white/10 font-mono text-xs text-white w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Calculated / Override Water Charge (₹)
            </label>
            <input
              type="number"
              step="any"
              value={waterCharges}
              onChange={e => setWaterCharges(Number(e.target.value))}
              className="input bg-[#0D0D0D] border-white/10 font-mono text-sm font-bold text-cyan-300 w-full"
            />
          </div>
        </div>

        {/* Opening Arrears & Other Fees */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#181818] p-4 rounded-2xl border border-white/10 space-y-1">
            <label className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block">
              Opening Arrears (₹)
            </label>
            <input
              type="number"
              step="any"
              value={openingBalance}
              onChange={e => setOpeningBalance(Number(e.target.value))}
              className="input bg-[#0D0D0D] border-white/10 font-mono text-sm font-bold text-rose-300 w-full"
            />
          </div>

          <div className="bg-[#181818] p-4 rounded-2xl border border-white/10 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Other Fees & Charges (₹)
            </label>
            <input
              type="number"
              step="any"
              value={otherFees}
              onChange={e => setOtherFees(Number(e.target.value))}
              className="input bg-[#0D0D0D] border-white/10 font-mono text-sm font-bold text-white w-full"
            />
          </div>
        </div>

        {/* Summary Card */}
        <div className="p-4 bg-[#111111] rounded-2xl border border-white/10 space-y-3 font-mono">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-white uppercase font-sans">TOTAL PERIOD BILLING</span>
            <span className="text-base text-white font-bold">₹{totalPeriodBilling.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-emerald-400 uppercase font-sans">TOTAL AMOUNT PAID</span>
            <div className="w-36">
              <input
                type="number"
                step="any"
                value={paidAmount}
                onChange={e => setPaidAmount(Number(e.target.value))}
                className="input bg-[#0D0D0D] border-emerald-500/40 text-emerald-300 font-mono text-right font-bold text-sm w-full py-1 px-2"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-black pt-2 border-t border-white/10">
            <span className="text-slate-300 uppercase font-sans">REMAINING OUTSTANDING BALANCE</span>
            <span className={`text-lg font-black ${remainingOutstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ₹{remainingOutstanding.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition-colors shadow-lg cursor-pointer"
          >
            Save Contract Changes
          </button>
        </div>

      </form>
    </Modal>
  );
};

export function BillingVerificationModal({
  isOpen,
  errors,
  onClose,
  onAutoFix
}: {
  isOpen: boolean;
  errors: BillingVerificationIssue[];
  onClose: () => void;
  onAutoFix: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Billing Cycle Cross-Check Verification Failed">
      <div className="space-y-5">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-300">New Month Rollover BLOCKED</h4>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              Discrepancies were detected between tenant recorded payments and stored balances for the previous period. Next month bill generation has been halted to prevent carrying forward invalid arrears.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Affected Tenants & Discrepancies ({errors.length})</p>
          {errors.map((err) => (
            <div key={err.tenantId} className="p-4 bg-[#111111] rounded-2xl border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">{err.tenantName} <span className="text-xs font-mono text-slate-400">({err.propertyName} • Room {err.roomNumber})</span></span>
                <span className="text-xs font-mono font-bold text-rose-400">Actual Arrears: {formatCurrency(err.actualArrears)}</span>
              </div>
              <p className="text-xs text-amber-300 font-mono bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">{err.issue}</p>
              <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                <span>Expected True Arrears: <strong className="text-emerald-400">{formatCurrency(err.expectedArrears)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-xs text-emerald-300 space-y-1">
          <p className="font-bold">Recommended Resolution:</p>
          <p className="text-slate-300">Click <strong>Auto-Fix & Sync Balances</strong> below to automatically reconcile recorded payments with tenant profile balances and unblock the new billing cycle.</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#181818] hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Cancel Rollover
          </button>
          <button
            type="button"
            onClick={onAutoFix}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Auto-Fix & Sync Balances
          </button>
        </div>
      </div>
    </Modal>
  );
}
