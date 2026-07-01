import React, { useState } from 'react';
import { Shield, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLogin: (user: { email: string; role: 'owner' | 'manager' | 'accountant' | 'readonly' }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [role, setRole] = useState<'owner' | 'manager' | 'accountant' | 'readonly'>('owner');

  const PRESETS = {
    owner: { email: 'owner@nexum.com', title: 'System Owner', desc: 'Full administration, properties & tenants control, deletes, and financial rollovers' },
    manager: { email: 'manager@nexum.com', title: 'Property Manager', desc: 'Full read & write access for property and tenant entries' },
    accountant: { email: 'accountant@nexum.com', title: 'Accountant', desc: 'Manage invoices, record utility logs, and view general ledgers' },
    readonly: { email: 'readonly@nexum.com', title: 'Auditor (Read-Only)', desc: 'View ledgers, transactions, and download invoice summaries' }
  };

  const handlePresetSelect = (selectedRole: typeof role) => {
    setRole(selectedRole);
  };

  const handlePresetLogin = () => {
    onLogin({ 
      email: PRESETS[role].email, 
      role 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-[0_24px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
    >
      {/* Soft ambient monochromatic lighting */}
      <div className="absolute -top-20 -left-20 w-52 h-52 bg-white/[0.04] rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Visual Accent header */}
      <div className="flex flex-col items-center text-center space-y-4 mb-8">
        <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
          <Shield className="w-5 h-5 stroke-[1.5]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Nexum Auth Engine
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </h3>
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest mt-1 font-mono">Multi-Tenant Vault Access</p>
        </div>
      </div>

      {/* Role Selection Section */}
      <div className="space-y-6">
        <div>
          <span className="text-[9px] font-bold tracking-widest text-neutral-400 uppercase font-mono block mb-3 text-center">Select System Access Level</span>
          <div className="grid grid-cols-4 gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/5 select-none text-[8.5px] font-sans font-bold uppercase tracking-wider">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((presetKey) => {
              const active = role === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handlePresetSelect(presetKey)}
                  className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                    active 
                      ? "bg-white text-black font-extrabold shadow-sm" 
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {presetKey}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Role Meta Details Card */}
        <div className="bg-black/20 border border-white/5 p-5 rounded-[22px] space-y-1.5 backdrop-blur-md">
          <h4 className="text-[11px] font-bold text-white font-mono tracking-wider uppercase">
            {PRESETS[role].title}
          </h4>
          <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">
            {PRESETS[role].desc}
          </p>
          <div className="text-[8px] text-neutral-500 font-mono pt-1 border-t border-white/5 mt-2">
            System Email: {PRESETS[role].email}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePresetLogin}
          className="w-full py-4 bg-white hover:bg-neutral-100 text-black font-bold text-xs uppercase tracking-widest rounded-full active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-xl shadow-white/5"
        >
          <LogIn className="w-4 h-4 text-black stroke-[1.75]" />
          Enter Secure Vault
        </button>
      </div>

      {/* Footer info */}
      <div className="text-center mt-8 pt-6 border-t border-white/5">
        <span className="text-[9px] text-neutral-500 font-mono tracking-tight leading-relaxed block max-w-[280px] mx-auto">
          Authorized personnel only. Sessions persist locally. Use the Backup tab to import or export ledger JSON dumps.
        </span>
      </div>
    </motion.div>
  );
};
