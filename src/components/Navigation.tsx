import React from 'react';
import { Users, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export type ViewType = 'tenants' | 'admin';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const items = [
    { id: 'tenants', label: 'Tenants Ledger', icon: Users },
    { id: 'admin', label: 'Administrative Hub', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Navigation Hover/Floating Dock Pane - Vertical Left/Top Side */}
      <aside className="hidden md:flex flex-col items-center py-8 px-4 w-24 border-r border-white/5 backdrop-blur-xl bg-[#121316]/90 h-screen sticky top-0 shrink-0 z-30 select-none justify-between">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Platform Emblem */}
          <div className="w-12 h-12 bg-[#76FF03] rounded-2xl flex items-center justify-center text-[#121316] font-sans font-black text-xl shadow-lg shadow-[#76FF03]/20 border border-[#76FF03]/30">
            A
          </div>
          
          {/* Vertical Selection Dock Area */}
          <div className="flex flex-col gap-4 w-full items-center mt-6">
            {items.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewType)}
                  className={cn(
                    "relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group cursor-pointer border",
                    active 
                      ? "bg-[#76FF03] text-[#121316] border-[#76FF03]/40 shadow-[0_0_15px_rgba(118,255,3,0.3)]" 
                      : "bg-[#282A30]/30 text-[#8A8D98] border-white/5 hover:text-white hover:bg-white/[0.05]"
                  )}
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                  {active && (
                    <span className="absolute -left-1.5 w-1 h-4 bg-[#76FF03] rounded-r-md" />
                  )}
                  
                  {/* Floating tooltip popover */}
                  <span className="absolute left-16 px-2.5 py-1.5 rounded-lg bg-[#1D1E22] text-white border border-white/10 text-[10px] font-bold uppercase tracking-wider scale-0 group-hover:scale-100 origin-left transition-transform duration-200 shadow-xl whitespace-nowrap z-55">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lower dock diagnostic telemetry indicator */}
        <div className="flex flex-col items-center gap-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#76FF03] animate-pulse shadow-[0_0_8px_rgba(118,255,3,0.6)]" />
          <span className="text-[9px] font-mono tracking-widest text-[#8A8D98] font-bold select-none uppercase">LIVE</span>
        </div>
      </aside>

      {/* Mobile Floating App-Dock Pane - Fixed Bottom Navigation Bar inside Thumb Zone */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1B20]/95 border-t border-white/5 pb-[env(safe-area-inset-bottom,16px)] pt-3 px-6 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl rounded-t-[24px]">
        {items.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-300 relative select-none cursor-pointer",
                active 
                  ? "text-[#76FF03]" 
                  : "text-[#8A8D98] hover:text-white"
              )}
            >
              {active && (
                <motion.div 
                  layoutId="active-nav-glow" 
                  className="absolute -top-1 w-10 h-1 bg-[#76FF03] rounded-full shadow-[0_0_12px_#76FF03]"
                />
              )}
              <item.icon className="w-5 h-5 transition-transform duration-300 active:scale-95" />
              <span className="text-[9px] font-black uppercase tracking-wider font-sans">{item.id === 'tenants' ? 'Tenants' : 'Admin Hub'}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
