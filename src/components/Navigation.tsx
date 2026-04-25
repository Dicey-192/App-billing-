import React from 'react';
import { Home, Users, History, Settings, LayoutDashboard, Plus, Download, Upload, Trash2, Edit3, ChevronRight, Menu, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export type ViewType = 'dashboard' | 'properties' | 'tenants' | 'history' | 'settings';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'history', label: 'Bill History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 backdrop-blur-md bg-white/5 h-screen sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/20 italic">A</div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100 leading-none">Artha<span className="text-xs font-mono text-blue-400 opacity-80 ml-1">v2.0</span></h1>
          </div>
          
          <nav className="space-y-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as ViewType)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all group",
                  currentView === item.id 
                    ? "bg-white/10 text-blue-300 shadow-sm" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", currentView === item.id ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-white/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
              <span>Next Backup</span>
              <span className="text-amber-400 font-bold">12 Days</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/50 w-[40%]" />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t-white/10 px-2 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-colors",
              currentView === item.id ? "text-blue-400 bg-white/5" : "text-slate-500"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
