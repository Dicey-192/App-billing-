import React, { useState } from 'react';
import { Shield, Mail, Lock, UserCheck, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLogin: (user: { email: string; role: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('owner@nexum.com');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState<'owner' | 'manager' | 'accountant' | 'readonly'>('owner');
  const [errorCode, setErrorCode] = useState('');

  const PRESETS = {
    owner: { email: 'owner@nexum.com', password: 'password123' },
    manager: { email: 'manager@nexum.com', password: 'manager123' },
    accountant: { email: 'accountant@nexum.com', password: 'accountant123' },
    readonly: { email: 'readonly@nexum.com', password: 'readonly123' }
  };

  const handlePresetSelect = (selectedRole: typeof role) => {
    setRole(selectedRole);
    setEmail(PRESETS[selectedRole].email);
    setPassword(PRESETS[selectedRole].password);
    setErrorCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorCode('Please enter both credentials');
      return;
    }
    onLogin({ email: email.trim(), role });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md bg-[#121316]/90 backdrop-blur-2xl border border-white/5 rounded-[32px] p-8 shadow-2xl relative"
    >
      {/* Visual Accent header */}
      <div className="flex flex-col items-center text-center space-y-3 mb-8">
        <div className="w-14 h-14 bg-[#76FF03]/10 rounded-2xl flex items-center justify-center text-[#76FF03] border border-[#76FF03]/20 shadow-[0_0_15px_rgba(118,255,3,0.15)]">
          <Shield className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Nexum Auth Engine
            <span className="w-1.5 h-1.5 rounded-full bg-[#76FF03]" />
          </h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Append-Only Cryptographic Access</p>
        </div>
      </div>

      {/* Role Preset Tabs */}
      <div className="space-y-3 mb-6">
        <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase font-mono block">Tester Fast-Access Roles</span>
        <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/5 select-none text-[9px] font-sans font-bold uppercase tracking-wider">
          {Object.keys(PRESETS).map((presetKey) => {
            const active = role === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => handlePresetSelect(presetKey as any)}
                className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                  active 
                    ? "bg-[#76FF03] text-slate-950 font-black shadow-md" 
                    : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                {presetKey}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Credentials */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Corporate Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 text-slate-100 rounded-xl px-4 py-2.5 pl-11 text-xs focus:border-[#76FF03]/30 focus:outline-none font-mono"
              placeholder="e.g. employee@nexum.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Security Key / Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 text-slate-100 rounded-xl px-4 py-2.5 pl-11 text-xs focus:border-[#76FF03]/30 focus:outline-none font-mono"
              placeholder="••••••••••••"
              required
            />
          </div>
        </div>

        {errorCode && (
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wide bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 text-center">
            {errorCode}
          </p>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-[#76FF03] text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#76FF03]/20 mt-6"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Authorize Connection
        </button>
      </form>

      {/* Footer warning */}
      <div className="text-center mt-6 pt-6 border-t border-white/5">
        <span className="text-[9px] text-slate-600 font-sans tracking-tight leading-relaxed block">
          Authorized personnel only. All access, writes, and ledger overrides are cryptographically logged directly to tamper-evident audit trails.
        </span>
      </div>
    </motion.div>
  );
};
