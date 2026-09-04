import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  Lock,
  AlertCircle
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

const CATEGORY_COLORS: Record<string, string> = {
  critical: '#D6453D',
  high: '#C97A1E',
  moderate: '#2965A8',
  low: '#2E8B68',
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RiskCategoryStat;
    return (
      <div className="bg-field-surface border border-field-border rounded p-3 text-xs space-y-1 shadow-lg">
        <div className="flex items-center gap-2 font-semibold text-field-primary">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.label}</span>
        </div>
        <div className="text-field-muted">
          Personnel Count: <strong className="text-field-primary">{data.count}</strong>
        </div>
        <div className="text-field-muted">
          Unit Proportion: <strong className="text-field-primary">{data.percentage}%</strong>
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
      // Ensure colors match our named palette
      const formattedDist = data.distribution.map((d) => ({
        ...d,
        color: CATEGORY_COLORS[d.category] || d.color,
      }));
      setSummaryData({ ...data, distribution: formattedDist });
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
    <div className="space-y-6 font-sans">
      {/* Unit Command Header */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                Unit Command Overview
              </span>
              <span className="text-xs text-field-muted flex items-center gap-1">
                <Lock className="w-3 h-3 text-readiness-green" />
                Aggregate Telemetry (Zero Individual PII Disclosure)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
              Unit Population Fatigue & Stress Distribution
            </h1>
            <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
              Macro-level operational readiness and risk distribution across active unit personnel. Drill-downs are restricted exclusively to prioritized triage alerts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/welfare/alerts"
              className="px-3.5 py-2 bg-triage-red-bg hover:bg-red-950/60 text-triage-red border border-triage-red-border rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Open Triage Queue ({summaryData?.open_alerts_count ?? 0})</span>
            </Link>

            <button
              onClick={fetchUnitSummary}
              disabled={isRefreshing}
              className="px-3 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-field-surface border border-field-border rounded-lg flex flex-col items-center justify-center text-field-muted">
          <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
          <p className="text-xs">Loading unit distribution metrics...</p>
        </div>
      ) : summaryData ? (
        <div className="space-y-5">
          {/* High-Density Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Personnel */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-field-muted block">
                Total Monitored Strength
              </span>
              <div className="mt-2 text-2xl font-bold text-field-primary">
                {summaryData.total_personnel}
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">Active unit roster</p>
            </div>

            {/* Average Calibrated Score */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-field-muted block">
                Mean Unit Fatigue Index
              </span>
              <div className="mt-2 text-2xl font-bold text-field-primary flex items-baseline gap-1">
                <span>{summaryData.average_calibrated_score}</span>
                <span className="text-xs font-normal text-field-muted">/ 100</span>
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">Population weighted average</p>
            </div>

            {/* Stable Baseline Percentage */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-readiness-green block">
                Stable / Low Risk Cohort
              </span>
              <div className="mt-2 text-2xl font-bold text-readiness-green flex items-baseline gap-1.5">
                <span>
                  {summaryData.total_personnel > 0
                    ? ((summaryData.low_count / summaryData.total_personnel) * 100).toFixed(1)
                    : '0'}
                  %
                </span>
                <span className="text-xs font-normal text-field-muted">({summaryData.low_count})</span>
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">Nominal readiness threshold</p>
            </div>

            {/* Elevated Concern Percentage */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-triage-red block">
                Elevated / High Urgency
              </span>
              <div className="mt-2 text-2xl font-bold text-triage-red flex items-baseline gap-1.5">
                <span>{elevatedPercent}%</span>
                <span className="text-xs font-normal text-field-muted">
                  ({summaryData.high_count + summaryData.critical_count})
                </span>
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">High and Critical triage cases</p>
            </div>
          </div>

          {/* Bar Chart Section */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-field-border">
              <div>
                <h2 className="text-base font-bold text-field-primary">
                  Risk Category Breakdown (Aggregate)
                </h2>
                <p className="text-xs text-field-muted mt-0.5">
                  Macro breakdown of personnel across operational fatigue tiers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {summaryData.distribution.map((item) => (
                  <div key={item.category} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-field-muted">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full h-72 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summaryData.distribution}
                  margin={{ top: 10, right: 15, left: -20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="#222D37" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#8294A2"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#222D37' }}
                  />
                  <YAxis
                    stroke="#8294A2"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#222D37' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#141C22' }} />
                  <Bar
                    dataKey="count"
                    radius={[2, 2, 0, 0]}
                    barSize={48}
                    isAnimationActive={false}
                  >
                    {summaryData.distribution.map((entry) => (
                      <Cell key={`cell-${entry.category}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Summary Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryData.distribution.map((cat) => (
              <div
                key={cat.category}
                className="bg-field-surface border border-field-border rounded p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-semibold text-field-primary">{cat.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-field-primary">
                    {cat.percentage}%
                  </span>
                </div>

                <div className="w-full bg-field-surface-subtle rounded-full h-1.5 overflow-hidden border border-field-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(cat.percentage, 1)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-field-muted">
                  <span>Count:</span>
                  <strong className="text-field-primary font-medium">{cat.count} Personnel</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Governance Protocol Stamp */}
          <div className="bg-field-surface-subtle border border-field-border rounded p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-field-muted">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-readiness-green shrink-0" />
              <span>
                Data Governance: Statistical telemetry only. Individual identity unmasking requires multi-officer incident authorization in the separate triage queue.
              </span>
            </div>
            <Link
              to="/welfare/alerts"
              className="px-3 py-1.5 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold transition-colors shrink-0"
            >
              Open Alert Triage Roster
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};
