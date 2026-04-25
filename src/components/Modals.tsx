import React, { useState } from 'react';
import { Property, Tenant, ExpenseItem } from '../types';
import { generateId } from '../lib/utils';
import { X, Plus, Trash2, Home, Users, Zap, Droplets, CreditCard, Upload, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => (
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
          className="relative glass-panel rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-white/10"
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
            <input required className="input bg-slate-900/50" placeholder="John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Room / Plot</label>
            <input required className="input bg-slate-900/50" placeholder="101" value={formData.roomNumber} onChange={e => setFormData({ ...formData, roomNumber: e.target.value })} />
          </div>
          <div>
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
  onConfirm: () => void;
  month: string;
}> = ({ isOpen, onClose, onConfirm, month }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Month Detected">
      <div className="space-y-6">
        <div className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-400">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-bold text-white">Roll over to {month}?</h4>
            <p className="text-sm text-slate-400">
              Archiving previous records and resetting meters for the new month.
            </p>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button 
            onClick={onClose} 
            className="btn-secondary flex-1 py-3 text-xs uppercase font-bold tracking-widest"
          >
            Later
          </button>
          <button 
            onClick={onConfirm} 
            className="btn-primary flex-1 py-3 text-xs uppercase font-bold tracking-widest"
          >
            Confirm
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
}> = ({ isOpen, onClose, entry }) => {
  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Summary: ${entry.month}`}>
      <div className="space-y-6">
        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">Property Snaphot</p>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                <Home className="w-6 h-6" />
             </div>
             <div>
                <h4 className="text-xl font-bold text-white">{entry.snapshot.property.name}</h4>
                <p className="text-xs text-slate-400 italic">{entry.snapshot.property.address}</p>
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Finalized Tenant Billings</p>
          <div className="space-y-2">
            {entry.snapshot.tenants.map((t: any) => {
              const p = entry.snapshot.property;
              const elecUnits = Math.max(0, t.currElecReading - t.prevElecReading);
              const waterUnits = Math.max(0, t.currWaterReading - t.prevWaterReading);
              const totalExtra = t.expenses.reduce((acc: number, exp: any) => acc + exp.amount, 0);
              const totalDue = t.rent + (elecUnits * p.electricRate) + (waterUnits * p.waterRate) + totalExtra + t.previousDues;

              return (
                <div key={t.id} className="p-4 bg-slate-900/50 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/5 transition-all">
                  <div>
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">Room {t.roomNumber} • {t.isPaid ? 'PAID' : 'UNPAID'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-400 font-mono">₹{totalDue.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest leading-none mt-1">Total Aggregate</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3 text-xs uppercase font-bold tracking-widest">Close Record</button>
        </div>
      </div>
    </Modal>
  );
};
