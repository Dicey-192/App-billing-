import React, { useState } from 'react';
import { Shield, Sparkles, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { googleSignIn, getFirebaseErrorMessage } from '../lib/googleAuth';

interface LoginScreenProps {
  onLogin: (user: { email: string; role: 'owner' | 'manager' | 'accountant' | 'readonly' }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'accountant' | 'readonly'>('owner');

  const PRESETS = {
    owner: { email: 'owner@nexum.com' },
    manager: { email: 'manager@nexum.com' },
    accountant: { email: 'accountant@nexum.com' },
    readonly: { email: 'readonly@nexum.com' }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorCode('');
    try {
      const result = await googleSignIn();
      if (result) {
        onLogin({ 
          email: result.user.email || 'authenticated-user@nexum.com', 
          role: 'owner' // Authenticators are ledger Owners
        });
      } else {
        setErrorCode('Google Sign-In was cancelled or another flow is already in progress.');
      }
    } catch (err: any) {
      console.error('[LoginScreen] Google Auth Error:', err);
      const errMsg = getFirebaseErrorMessage(err);
      setErrorCode(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (selectedRole: typeof role) => {
    setRole(selectedRole);
    setErrorCode('');
  };

  const handlePresetLogin = () => {
    onLogin({ 
      email: PRESETS[role].email, 
      role 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md bg-[#121316]/90 backdrop-blur-2xl border border-white/5 rounded-[32px] p-8 shadow-2xl relative"
    >
      {/* Decorative backdrop glow */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#76FF03]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Visual Accent header */}
      <div className="flex flex-col items-center text-center space-y-3 mb-8">
        <div className="w-14 h-14 bg-[#76FF03]/10 rounded-2xl flex items-center justify-center text-[#76FF03] border border-[#76FF03]/20 shadow-[0_0_15px_rgba(118,255,3,0.15)]">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Nexum Auth Engine
            <span className="w-1.5 h-1.5 rounded-full bg-[#76FF03]" />
          </h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Multi-Tenant Vault Authentication</p>
        </div>
      </div>

      {/* Google Interactive Signin Button */}
      <div className="space-y-4 mb-8">
        <div>
          <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase font-mono block mb-3">Secure Identity Provider</span>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3 shadow-lg shadow-[#76FF03]/5"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-slate-950 animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            )}
            {loading ? 'CONNECTING VAULT...' : 'CONTINUE WITH GOOGLE'}
          </button>
        </div>

        {errorCode && (
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wide bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 text-center animate-shake">
            {errorCode}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/5" />
        </div>
        <span className="relative px-3 bg-[#121316] text-[8px] font-mono tracking-widest text-slate-500 uppercase">OR BYPASS AUTH</span>
      </div>

      {/* Tester Fast Access Section */}
      <div className="space-y-4">
        <div>
          <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase font-mono block mb-2.5">FAST ACCESS DESKTOP ROLES</span>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/5 select-none text-[8.5px] font-sans font-bold uppercase tracking-wider">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((presetKey) => {
              const active = role === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handlePresetSelect(presetKey)}
                  className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                    active 
                      ? "bg-slate-800 text-white font-black" 
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {presetKey}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePresetLogin}
          className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <LogIn className="w-3.5 h-3.5 text-slate-500" />
          By-pass connection as {role}
        </button>
      </div>

      {/* Footer warning */}
      <div className="text-center mt-6 pt-6 border-t border-white/5">
        <span className="text-[9px] text-slate-600 font-sans tracking-tight leading-relaxed block leading-5">
          Authorized personnel only. Deep backup and Google Drive secure storage access require Google Identity validation to prevent accidental overwrites.
        </span>
      </div>
    </motion.div>
  );
};
