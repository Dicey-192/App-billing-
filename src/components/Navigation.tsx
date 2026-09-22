import React from 'react';
import { Users, LayoutDashboard, Settings, CreditCard, Plus, Zap, HeartHandshake } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export type ViewType = 'dashboard' | 'tenants' | 'payments' | 'settings' | 'bulk-readings';

interface NavigationProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  hasOverdueAlert?: boolean;
  onFabClick: (view: ViewType) => void;
}

export const Sidebar: React.FC<NavigationProps> = ({ currentView, setView, hasOverdueAlert, onFabClick }) => {
  // Standard 4 items with clear micro-labels
  const items = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'placeholder-fab', label: '', icon: Plus, isPlaceholder: true }, // Spacer for the FAB
    { id: 'payments', label: 'Bills', icon: CreditCard },
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg select-none mb-1">
      {/* Floating Pill Bottom Navigation Dock with 16px Clearance */}
      <div className="relative bg-[#181818]/90 backdrop-blur-2xl border border-[#2C2C2E] rounded-full px-2 py-1.5 flex items-center justify-between gap-1 shadow-[0_20px_40px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08)]">
        
        {items.map((item) => {
          if (item.isPlaceholder) {
            // Invisible slot in the items array to keep spacing perfectly balanced around center FAB
            return <div key="fab-spacer" className="w-14 h-12 flex-1" />;
          }

          const active = currentView === item.id;
          return (
            <button
              id={`nav-tab-${item.id}`}
              key={item.id}
              onClick={() => setView(item.id as ViewType)}
              className={cn(
                "relative flex-1 py-1.5 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer group",
                active ? "text-white" : "text-[#A1A1AA] hover:text-white"
              )}
            >
              {/* Framer-motion active pill background for smooth transition */}
              {active && (
                <motion.div
                  layoutId="active-pill-bg"
                  className="absolute inset-0 bg-white/10 border border-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              
              {/* 24x24px standardized navigation icon */}
              <span className="relative z-10 flex items-center justify-center w-6 h-6">
                <item.icon className={cn("w-6 h-6 stroke-[1.85]", active ? "text-white" : "text-[#A1A1AA] group-hover:text-white transition-colors")} />
                {item.id === 'tenants' && hasOverdueAlert && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-[#181818] animate-pulse" />
                )}
              </span>

              {/* 10px Medium micro-label directly beneath navigation icon on all screens */}
              <span className={cn(
                "relative z-10 text-[10px] font-medium leading-none mt-1 tracking-tight",
                active ? "text-white font-bold" : "text-[#A1A1AA] group-hover:text-white transition-colors"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Center Floating Action Button (FAB) with clearance */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <motion.button
            id="center-fab-action"
            whileHover={{ scale: 1.06, y: -14 }}
            whileTap={{ scale: 0.95 }}
            initial={{ y: -12 }}
            onClick={() => onFabClick(currentView)}
            className="w-13 h-13 rounded-full bg-white text-[#050505] flex items-center justify-center shadow-[0_10px_25px_rgba(255,255,255,0.25),0_0_12px_rgba(255,255,255,0.1)] hover:bg-neutral-100 transition-colors cursor-pointer border border-white/20"
            title={fab.tooltip}
          >
            <FabIcon className="w-6 h-6 stroke-[2.25]" />
          </motion.button>
        </div>

      </div>
    </div>
  );
};
