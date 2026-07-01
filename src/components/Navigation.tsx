import React from 'react';
import { Users, LayoutDashboard, Settings, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export type ViewType = 'dashboard' | 'tenants' | 'admin';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  hasOverdueAlert?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, hasOverdueAlert }) => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants Ledger', icon: Users },
    { id: 'admin', label: 'Admin Hub', icon: Settings },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg select-none">
      {/* Apple-inspired Floating Pill Navigation bar with frosted glassmorphism */}
      <div className="bg-[#121316]/60 backdrop-blur-3xl border border-white/10 rounded-full p-2 flex items-center justify-between gap-1 shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08)]">
        {items.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={cn(
                "relative flex-1 py-3.5 rounded-full flex flex-col sm:flex-row items-center justify-center gap-2 transition-all duration-300 cursor-pointer group text-xs",
                active ? "text-black" : "text-neutral-400 hover:text-white"
              )}
            >
              {/* Framer-motion active pill background for smooth transition */}
              {active && (
                <motion.div
                  layoutId="active-pill-bg"
                  className="absolute inset-0 bg-white rounded-full shadow-[0_8px_20px_rgba(255,255,255,0.15)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              
              <span className="relative z-10 flex items-center justify-center">
                <item.icon className={cn("w-4.5 h-4.5 stroke-[1.75]", active ? "text-black" : "text-neutral-400 group-hover:text-white transition-colors")} />
                {item.id === 'tenants' && hasOverdueAlert && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#121316] animate-pulse" />
                )}
              </span>

              <span className={cn(
                "relative z-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest font-sans hidden md:inline",
                active ? "text-black" : "text-neutral-400 group-hover:text-white transition-colors"
              )}>
                {item.label}
              </span>

              {/* Floating Tooltip popover for small screens where text is hidden */}
              <span className="absolute -top-10 scale-0 group-hover:scale-100 px-2.5 py-1.5 rounded-lg bg-[#181818] text-white border border-white/10 text-[9px] font-bold uppercase tracking-widest transition-transform duration-200 shadow-2xl whitespace-nowrap z-50 font-mono pointer-events-none md:hidden">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
