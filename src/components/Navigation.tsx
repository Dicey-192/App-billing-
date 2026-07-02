import React from 'react';
import { Users, LayoutDashboard, Settings, CreditCard, Plus, Zap, HeartHandshake } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export type ViewType = 'dashboard' | 'tenants' | 'payments' | 'settings';

interface NavigationProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  hasOverdueAlert?: boolean;
  onFabClick: (view: ViewType) => void;
}

export const Sidebar: React.FC<NavigationProps> = ({ currentView, setView, hasOverdueAlert, onFabClick }) => {
  // 4 items as requested
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'placeholder-fab', label: '', icon: Plus, isPlaceholder: true }, // Spacer for the FAB
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Get dynamic FAB icon and label based on current view
  const getFabConfig = () => {
    switch (currentView) {
      case 'dashboard':
        return { icon: Zap, label: 'Quick Actions', tooltip: 'Quick Operations Menu' };
      case 'tenants':
        return { icon: Plus, label: 'Add Tenant', tooltip: 'Add New Tenant Deposit' };
      case 'payments':
        return { icon: CreditCard, label: 'Collect Payment', tooltip: 'Collect Tenant Payment' };
      case 'settings':
        return { icon: Plus, label: 'Add Property', tooltip: 'Register New Property' };
      default:
        return { icon: Plus, label: 'Add', tooltip: 'Quick Add' };
    }
  };

  const fab = getFabConfig();
  const FabIcon = fab.icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl select-none">
      {/* Floating Pill Bottom Navigation Dock with Frosted Glassmorphism */}
      <div className="relative bg-[#181818]/80 backdrop-blur-3xl border border-white/10 rounded-full p-2 flex items-center justify-between gap-1 shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08)]">
        
        {items.map((item) => {
          if (item.isPlaceholder) {
            // Invisible slot in the items array to keep spacing perfectly balanced
            return <div key="fab-spacer" className="w-14 h-12 flex-1" />;
          }

          const active = currentView === item.id;
          return (
            <button
              id={`nav-tab-${item.id}`}
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={cn(
                "relative flex-1 py-3 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer group text-xs",
                active ? "text-white" : "text-neutral-400 hover:text-white"
              )}
            >
              {/* Framer-motion active pill background for smooth transition */}
              {active && (
                <motion.div
                  layoutId="active-pill-bg"
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              
              <span className="relative z-10 flex items-center justify-center">
                <item.icon className={cn("w-4.5 h-4.5 stroke-[1.75]", active ? "text-white" : "text-neutral-400 group-hover:text-white transition-colors")} />
                {item.id === 'tenants' && hasOverdueAlert && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#121316] animate-pulse" />
                )}
              </span>

              <span className={cn(
                "relative z-10 text-[9px] font-bold uppercase tracking-wider font-sans hidden sm:inline-block",
                active ? "text-white font-black" : "text-neutral-400 group-hover:text-white transition-colors"
              )}>
                {item.label}
              </span>

              {/* Tooltip for small screens */}
              <span className="absolute -top-10 scale-0 group-hover:scale-100 px-2 py-1 rounded-lg bg-[#111111] text-white border border-white/10 text-[8px] font-bold uppercase tracking-widest transition-transform duration-200 shadow-2xl whitespace-nowrap z-50 font-mono pointer-events-none sm:hidden">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Floating Action Button (FAB) nested right in the visual center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <motion.button
            id="center-fab-action"
            whileHover={{ scale: 1.08, y: -18 }}
            whileTap={{ scale: 0.95 }}
            initial={{ y: -16 }}
            onClick={() => onFabClick(currentView)}
            className="w-13 h-13 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-[0_12px_24px_rgba(255,255,255,0.25),0_0_15px_rgba(255,255,255,0.1),inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:bg-neutral-100 transition-colors cursor-pointer border border-white/20"
            title={fab.tooltip}
          >
            <FabIcon className="w-5.5 h-5.5 stroke-[2.25]" />
          </motion.button>
        </div>

      </div>
    </div>
  );
};
