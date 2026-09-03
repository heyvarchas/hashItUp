import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  Users,
  Activity,
  CheckCircle2,
  Flame,
  Info,
  Lock,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';

interface RiskCategoryStat {
  category: 'low' | 'moderate' | 'high' | 'critical';
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface UnitSummaryData {
  total_personnel: number;
  average_calibrated_score: number;
  distribution: RiskCategoryStat[];
  critical_count: number;
  high_count: number;
  moderate_count: number;
  low_count: number;
  open_alerts_count: number;
  acknowledged_alerts_count: number;
}

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RiskCategoryStat;
    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-white">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.label}</span>
        </div>
        <div className="text-slate-300 font-semibold">
          Personnel Count: <span className="font-mono text-white font-bold">{data.count}</span>
        </div>
        <div className="text-slate-400">
          Share of Unit: <span className="font-mono text-indigo-300 font-bold">{data.percentage}%</span>
        </div>
        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
          Aggregate statistic (Privacy preserved)
        </div>
      </div>
    );
  }
  return null;
};

export const WelfareDashboard: React.FC = () => {
  const { user } = useAuth();
  const [summaryData, setSummaryData] = useState<UnitSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUnitSummary = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('http://localhost:8000/dashboard/unit-summary', {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch unit summary (${res.status} ${res.statusText})`);
      }

      const data: UnitSummaryData = await res.json();
      setSummaryData(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while loading unit summary statistics.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUnitSummary();
  }, [user]);

  const elevatedPercent = summaryData
    ? (
        ((summaryData.high_count + summaryData.critical_count) /
          (summaryData.total_personnel || 1)) *
        100
      ).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/70 to-slate-900/50 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Unit Welfare & Summary Tab
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Unit Population Stress & Health Distribution
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Aggregated population metrics and macro-level risk distribution across all active unit personnel.
              Strictly non-identifiable to guarantee personnel privacy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/welfare/alerts"
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-lg shadow-rose-600/25 flex items-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Open Alert Queue ({summaryData?.open_alerts_count ?? 0})
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={fetchUnitSummary}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Strict Privacy Protocol Notice */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Aggregate-Only Protection Active: No individual drill-down or PII disclosure.</span>
          </div>
          <span className="font-mono text-slate-500 text-[11px]">
            API: GET /dashboard/unit-summary
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
          <div className="w-9 h-9 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium text-slate-400">Loading aggregate unit distribution...</p>
        </div>
      ) : summaryData ? (
        <div className="space-y-6">
          {/* Key Aggregate Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Monitored Personnel */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Total Personnel
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {summaryData.total_personnel}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Active monitored cohort</p>
            </div>

            {/* Average Population Calibrated Score */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Mean Risk Index
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-black text-white flex items-baseline gap-1.5">
                <span>{summaryData.average_calibrated_score}</span>
                <span className="text-xs font-semibold text-slate-500">/ 100</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Population weighted average</p>
            </div>

            {/* Low / Baseline Risk Percentage */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  Low / Stable Baseline
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-black text-emerald-400 flex items-baseline gap-1.5">
                <span>
                  {summaryData.total_personnel > 0
                    ? ((summaryData.low_count / summaryData.total_personnel) * 100).toFixed(1)
                    : '0'}
                  %
                </span>
                <span className="text-xs font-normal text-slate-400">({summaryData.low_count})</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Optimal wellness & resilience</p>
            </div>

            {/* High / Critical Concern Percentage */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
                  Elevated Concern
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-black text-rose-400 flex items-baseline gap-1.5">
                <span>{elevatedPercent}%</span>
                <span className="text-xs font-normal text-slate-400">
                  ({summaryData.high_count + summaryData.critical_count})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">High & Critical urgency cases</p>
            </div>
          </div>

          {/* Aggregate-Only Bar Chart Section */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">Risk Category Distribution</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Macro breakdown of unit personnel across triage tiers. Pure aggregate summary with zero record drill-down.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {summaryData.distribution.map((item) => (
                  <div key={item.category} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summaryData.distribution}
                  margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#1e293b33' }} />
                  <Bar
                    dataKey="count"
                    radius={[8, 8, 0, 0]}
                    barSize={60}
                    isAnimationActive={true}
                    animationDuration={800}
                  >
                    {summaryData.distribution.map((entry) => (
                      <Cell key={`cell-${entry.category}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Category Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryData.distribution.map((cat) => {
              const getIcon = () => {
                switch (cat.category) {
                  case 'critical':
                    return <Flame className="w-4 h-4 text-rose-400" />;
                  case 'high':
                    return <AlertTriangle className="w-4 h-4 text-amber-400" />;
                  case 'moderate':
                    return <Info className="w-4 h-4 text-blue-400" />;
                  default:
                    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                }
              };

              return (
                <div
                  key={cat.category}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon()}
                      <span className="text-xs font-bold text-white">{cat.label}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {cat.percentage}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(cat.percentage, 2)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Monitored Cohort</span>
                    <span className="font-bold text-white font-mono">{cat.count} Personnel</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy Protocol Guarantee Footer Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Privacy & Data Governance Policy
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aggregate distributions are computed using de-identified telemetry. Drill-down into individual records is restricted exclusively to active triage alerts in the separate queue.
                </p>
              </div>
            </div>

            <Link
              to="/welfare/alerts"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <span>Go to Alert Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};
