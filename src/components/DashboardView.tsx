import React, { useMemo, useEffect, useState } from 'react';
import { Property, Tenant, BillHistoryEntry } from '../types';
import { formatCurrency, formatMonthStr } from '../lib/utils';
import { TrendingUp, Users, Home, ShieldAlert, CheckCircle2, TrendingDown, ArrowUpRight, DollarSign, Wallet, Percent, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  properties: Property[];
  tenants: Tenant[];
  history: BillHistoryEntry[];
  formatCurrency: (amount: number) => string;
  setView: (view: any) => void;
  activeMonth: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  properties,
  tenants,
  history,
  formatCurrency,
  setView,
  activeMonth
}) => {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(true);
  }, []);

  // 1. Calculations for KPIs
  // Total Revenue: Sum of all payments recorded in currently active tenants and history log
  const stats = useMemo(() => {
    let totalRevenue = 0;
    
    // Sum from current tenants' payments
    tenants.forEach(t => {
      const tenantPayments = t.payments || [];
      tenantPayments.forEach(p => {
        totalRevenue += p.amount;
      });
      // Fallback if payments list is empty but paidAmount is set
      if (tenantPayments.length === 0 && t.paidAmount) {
        totalRevenue += t.paidAmount;
      }
    });

    // Sum from history tenants
    history.forEach(h => {
      const hTenants = h.snapshot?.tenants || [];
      hTenants.forEach(ht => {
        const htPayments = ht.payments || [];
        htPayments.forEach(p => {
          totalRevenue += p.amount;
        });
        if (htPayments.length === 0 && ht.paidAmount) {
          totalRevenue += ht.paidAmount;
        }
      });
    });

    // Pending Revenue: Outstanding balance of current active month billing
    let pendingRevenue = 0;
    tenants.forEach(t => {
      // Calculate outstanding
      const baseRent = t.manualOverrides?.baseRent !== undefined ? t.manualOverrides.baseRent : t.rent;
      const prevElec = t.prevElecReading;
      const currElec = t.currElecReading;
      const elecRate = properties.find(p => p.id === t.propertyId)?.electricRate || 0;
      const elecCharges = t.manualOverrides?.electricityCharges !== undefined 
        ? t.manualOverrides.electricityCharges 
        : Math.max(0, currElec - prevElec) * elecRate;

      const prevWater = t.prevWaterReading;
      const currWater = t.currWaterReading;
      const waterRate = properties.find(p => p.id === t.propertyId)?.waterRate || 0;
      const waterCharges = t.manualOverrides?.waterCharges !== undefined 
        ? t.manualOverrides.waterCharges 
        : Math.max(0, currWater - prevWater) * waterRate;

      const otherFees = t.manualOverrides?.otherFees !== undefined 
        ? t.manualOverrides.otherFees 
        : (t.expenses || []).reduce((sum, e) => sum + e.amount, 0);

      const openingBal = t.manualOverrides?.openingBalance !== undefined ? t.manualOverrides.openingBalance : t.previousDues;
      
      let totalDue = t.manualOverrides?.totalDue !== undefined 
        ? t.manualOverrides.totalDue 
        : (baseRent + elecCharges + waterCharges + otherFees + openingBal);

      const paid = t.manualOverrides?.paidAmount !== undefined ? t.manualOverrides.paidAmount : (t.paidAmount || 0);
      const remaining = totalDue - paid;
      if (remaining > 0) {
        pendingRevenue += remaining;
      }
    });

    // Occupancy Rate: Occupied rooms vs total rooms
    // Let's assume each property has a default of 5 rooms capacity, or count total tenants compared to dynamic capacity
    const totalRooms = properties.length * 6 || 6;
    const occupiedRooms = tenants.filter(t => t.propertyId).length;
    const occupancyRate = Math.min(100, Math.round((occupiedRooms / (totalRooms || 1)) * 100));

    // Collection Rate: Paid bills vs total bills count in current period
    const totalCurrentBills = tenants.length;
    const paidCurrentBills = tenants.filter(t => t.isPaid).length;
    const collectionRate = totalCurrentBills > 0 ? Math.round((paidCurrentBills / totalCurrentBills) * 100) : 100;

    const activeTenantsCount = tenants.length;
    const totalPropertiesCount = properties.length;

    return {
      totalRevenue,
      pendingRevenue,
      occupancyRate,
      collectionRate,
      activeTenantsCount,
      totalPropertiesCount
    };
  }, [tenants, properties, history]);

  // 2. Collections of Last 6 Months (grouped by month string: YYYY-MM)
  const chartData = useMemo(() => {
    const monthsMap = new Map<string, number>();

    // Initialize last 6 months with 0
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(mStr, 0);
    }

    // Add revenue from history entries
    history.forEach(h => {
      const m = h.month; // YYYY-MM format
      if (monthsMap.has(m)) {
        let monthTotal = 0;
        const hTenants = h.snapshot?.tenants || [];
        hTenants.forEach(ht => {
          monthTotal += ht.paidAmount || 0;
        });
        monthsMap.set(m, monthsMap.get(m)! + monthTotal);
      }
    });

    // Add current tenant paid value if matching active month
    if (activeMonth && monthsMap.has(activeMonth)) {
      let currentTotal = 0;
      tenants.forEach(t => {
        currentTotal += t.paidAmount || 0;
      });
      monthsMap.set(activeMonth, monthsMap.get(activeMonth)! + currentTotal);
    }

    return Array.from(monthsMap.entries()).map(([month, value]) => ({
      month,
      label: formatMonthStrOnly(month),
      value
    }));
  }, [history, tenants, activeMonth]);

  function formatMonthStrOnly(mStr: string) {
    if (!mStr) return mStr;
    const parts = mStr.split('-');
    if (parts[0] === 'BS') {
      const NEPALI_MONTHS_SHORT = [
        'Bai', 'Jet', 'Asa', 'Sau', 'Bha', 'Aso',
        'Kat', 'Man', 'Pus', 'Mag', 'Pha', 'Cha'
      ];
      const monthIdx = parseInt(parts[2] || '1', 10) - 1;
      return NEPALI_MONTHS_SHORT[monthIdx] || '';
    }
    if (!mStr.includes('-')) return mStr;
    const [year, month] = mStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short' });
  }

  // Max value in chart for scale
  const maxChartVal = useMemo(() => {
    const vals = chartData.map(c => c.value);
    const max = Math.max(...vals, 1000); // at least scale base to 1000
    return max * 1.15; // 15% padding top
  }, [chartData]);

  // Premium 6 KPI Cards list
  const kpiCards = [
    {
      title: "Total Revenue Collected",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "border-l-yellow-600 text-yellow-500",
      bg: "from-yellow-500/5 to-transparent",
      desc: "Cumulative collections across all periods"
    },
    {
      title: "Pending Outstanding dues",
      value: formatCurrency(stats.pendingRevenue),
      icon: Wallet,
      color: "border-l-rose-500 text-rose-500",
      bg: "from-rose-500/5 to-transparent",
      desc: "Unearned active cycle arrears"
    },
    {
      title: "Occupancy Rate",
      value: `${stats.occupancyRate}%`,
      icon: Home,
      color: "border-l-emerald-500 text-emerald-400",
      bg: "from-emerald-500/5 to-transparent",
      desc: `${tenants.length} rooms occupied out of capacity`
    },
    {
      title: "Collection Rate",
      value: `${stats.collectionRate}%`,
      icon: Percent,
      color: "border-l-cyan-500 text-cyan-400",
      bg: "from-cyan-500/5 to-transparent",
      desc: "Paid tenant accounts in active cycle"
    },
    {
      title: "Active Tenants",
      value: stats.activeTenantsCount.toString(),
      icon: UserCheck,
      color: "border-l-amber-500 text-amber-500",
      bg: "from-amber-505/5 to-transparent",
      desc: "Tenants currently holding signatures"
    },
    {
      title: "Total Properties",
      value: stats.totalPropertiesCount.toString(),
      icon: Users,
      color: "border-l-blue-500 text-blue-400",
      bg: "from-blue-500/5 to-transparent",
      desc: "Registered facilities on administrative grid"
    }
  ];

  return (
    <div id="dashboard-view-stage" className="space-y-8 pb-16 animate-fade-in">
      {/* Upper Title Group */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white font-sans tracking-tight">Executive Dashboard</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Real-time SaaS Telemetry & Collection Auditing</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl font-mono text-slate-400">
            Active Cycle: <span className="text-white font-bold">{formatMonthStr(activeMonth)}</span>
          </span>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, idx) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`glass-panel p-6 rounded-3xl border border-white/5 hover:border-yellow-600/30 transition-all duration-300 flex flex-col justify-between group overflow-hidden relative border-l-4 ${kpi.color} bg-gradient-to-tr ${kpi.bg}`}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:animate-shimmer" />
            
            <div className="flex justify-between items-start mb-4">
              <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-slate-400 leading-tight">
                {kpi.title}
              </span>
              <kpi.icon className="w-5 h-5 opacity-60 group-hover:scale-110 transition-transform duration-300" />
            </div>

            <div>
              <h3 className="text-3xl font-black font-sans tracking-tight text-white mb-1">
                {kpi.value}
              </h3>
              <p className="text-[10px] text-slate-500 leading-normal line-clamp-1">
                {kpi.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytical Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Collections Chart */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-white/5 space-y-6 flex flex-col justify-between bg-slate-950/20">
          <div>
            <h4 className="text-sm font-bold text-white font-sans uppercase tracking-wider">Dynamic Revenue Collections (NPR)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tight">Dynamic grouped metrics from the previous 6 billing cycles</p>
          </div>

          {/* Core SVG Chart bar representation */}
          <div className="h-64 flex items-end justify-between px-4 pt-4 border-b border-white/5 relative">
            {chartData.map((data, idx) => {
              const barHeightPercent = maxChartVal > 0 ? (data.value / maxChartVal) * 100 : 0;
              return (
                <div key={data.month} className="flex flex-col items-center gap-2 group w-1/6 relative z-10">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-12 bg-slate-900 border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-[9px] font-bold tracking-widest uppercase shadow-2xl scale-0 group-hover:scale-100 transition-all origin-bottom duration-200 pointer-events-none whitespace-nowrap z-50">
                    {formatCurrency(data.value)}
                  </div>

                  {/* SVG Bar with Gradient */}
                  <div className="w-8 sm:w-12 bg-[#2D3039]/30 rounded-t-lg overflow-hidden h-48 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={animate ? { height: `${barHeightPercent}%` } : { height: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.1 }}
                      className="w-full bg-gradient-to-t from-yellow-700 via-yellow-500 to-amber-400 rounded-t-lg shadow-[0_0_12px_rgba(245,158,11,0.3)] group-hover:brightness-110 transition-all"
                    />
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider pt-1">{data.label}</span>
                </div>
              );
            })}

            {/* Grid Line Markers */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5 pr-2 py-4">
              <div className="border-b border-white w-full" />
              <div className="border-b border-white w-full" />
              <div className="border-b border-white w-full" />
              <div className="border-b border-white w-full" />
            </div>
          </div>
        </div>

        {/* Quick action Panel & Diagnostics */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-white/5 space-y-6 flex flex-col justify-between bg-slate-900/10">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Operational Channels</h4>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tight">Direct navigation controls and security stats</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setView('tenants')}
              className="w-full p-4 bg-slate-950/40 border border-white/5 hover:border-white/20 rounded-2xl flex items-center justify-between text-left group transition-all duration-300 cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-white" />
                  Access Tenant Ledger
                </span>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Review receipts and collect bills</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

            <button
              onClick={() => setView('expenses')}
              className="w-full p-4 bg-slate-950/40 border border-white/5 hover:border-yellow-500/20 rounded-2xl flex items-center justify-between text-left group transition-all duration-300 cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-500" />
                  Expenses & Profit Margin
                </span>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Manage repair costs & staff payments</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-yellow-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

            <button
              onClick={() => setView('admin')}
              className="w-full p-4 bg-slate-950/40 border border-white/5 hover:border-blue-500/20 rounded-2xl flex items-center justify-between text-left group transition-all duration-300 cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-400" />
                  Manage Properties
                </span>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1">Add property parameters & rates</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>
          </div>

          <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/10 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span className="text-[9px] text-white font-bold uppercase tracking-widest font-mono select-none">Nexum SaaS Engine Core Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};
