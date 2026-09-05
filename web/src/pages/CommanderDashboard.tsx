import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { API_BASE_URL } from '../config';

interface UnitBreakdown {
  unit_id: string;
  personnel_count: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

interface MajorFactor {
  feature: string;
  display_name: string;
  aggregate_impact: number;
}

interface OverallStatus {
  level: 'GOOD' | 'WATCH' | 'ATTENTION REQUIRED';
  label: string;
  description: string;
}

interface CommanderSummaryData {
  total_personnel: number;
  low_count: number;
  moderate_count: number;
  high_count: number;
  critical_count: number;
  overall_status: OverallStatus;
  units: UnitBreakdown[];
  available_units: string[];
  selected_unit: string;
  major_factors: MajorFactor[];
  recommendations: string[];
}

const RISK_COLORS = {
  low: '#2E8B68',
  moderate: '#2965A8',
  high: '#C97A1E',
  critical: '#D6453D',
};

export const CommanderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CommanderSummaryData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOverview = async (unitId: string) => {
    if (!user) return;
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/commander-overview?unit_id=${unitId}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load commander overview data.');
      }
      const json: CommanderSummaryData = await res.json();
      setData(json);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred fetching dashboard metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedUnit);
  }, [user, selectedUnit]);

  // Handle unit selection change
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUnit(e.target.value);
  };

  // Prepare chart data
  const chartData = data
    ? [
        { name: 'Low', count: data.low_count, color: RISK_COLORS.low, range: '0–34' },
        { name: 'Moderate', count: data.moderate_count, color: RISK_COLORS.moderate, range: '35–64' },
        { name: 'High', count: data.high_count, color: RISK_COLORS.high, range: '65–84' },
        { name: 'Critical', count: data.critical_count, color: RISK_COLORS.critical, range: '85–100' },
      ]
    : [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const total = data?.total_personnel || 1;
      const pct = Math.round((item.count / total) * 100);
      return (
        <div className="bg-field-surface border border-field-border p-3 rounded shadow-lg text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-field-primary">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name} Risk ({item.range})</span>
          </div>
          <p className="text-field-muted">
            Personnel: <strong className="text-field-primary">{item.count}</strong> ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in text-field-primary max-w-7xl mx-auto pb-12">
      {/* 1. Header Section */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>UNIT COMMANDER</span>
              </span>
              <span className="text-xs text-field-muted">Welfare & Readiness Overview</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-field-primary">
              Executive Welfare & Readiness Overview
            </h1>
            <p className="text-xs text-field-muted mt-1">
              Current operational welfare status across monitored active personnel.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Optional Unit Filter */}
            {data?.available_units && data.available_units.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="unit-select" className="text-xs text-field-muted font-medium hidden sm:inline">
                  Filter Unit:
                </label>
                <select
                  id="unit-select"
                  value={selectedUnit}
                  onChange={handleUnitChange}
                  className="bg-field-surface-subtle border border-field-border rounded px-3 py-2 text-xs font-medium text-field-primary focus:outline-none focus:border-command-blue"
                >
                  <option value="ALL">All Units</option>
                  {data.available_units.map((u) => (
                    <option key={u} value={u}>
                      Unit {u.replace(/^UNIT[_\s-]*/i, '')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchOverview(selectedUnit)}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-field-surface-subtle hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded-lg flex items-center gap-2 text-triage-red text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-16 bg-field-surface border border-field-border rounded-lg flex flex-col items-center justify-center text-field-muted">
          <div className="w-7 h-7 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium">Calculating dynamic dataset metrics & risk distributions...</p>
        </div>
      ) : data ? (
        <>
          {/* 2. Top Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Personnel Monitored */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-command-blue/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-field-muted">Personnel Monitored</span>
                <Users className="w-4 h-4 text-command-blue" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-field-primary font-mono tracking-tight">
                {data.total_personnel}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {selectedUnit === 'ALL' ? 'Unique personnel in dataset' : `Personnel in Unit ${selectedUnit.replace(/^UNIT[_\s-]*/i, '')}`}
              </span>
            </div>

            {/* Low Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-readiness-green/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-readiness-green font-semibold">Low Risk</span>
                <span className="w-2.5 h-2.5 rounded-full bg-readiness-green" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-readiness-green font-mono tracking-tight">
                {data.low_count}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((data.low_count / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* Moderate Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-command-blue/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-command-blue font-semibold">Moderate Risk</span>
                <span className="w-2.5 h-2.5 rounded-full bg-command-blue" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-command-blue font-mono tracking-tight">
                {data.moderate_count}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((data.moderate_count / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* High Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-triage-amber/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-triage-amber font-semibold">High Risk</span>
                <span className="w-2.5 h-2.5 rounded-full bg-triage-amber" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-triage-amber font-mono tracking-tight">
                {data.high_count}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((data.high_count / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* Critical Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-triage-red/40 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-triage-red font-semibold">Critical Risk</span>
                <span className="w-2.5 h-2.5 rounded-full bg-triage-red animate-pulse" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-triage-red font-mono tracking-tight">
                {data.critical_count}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.critical_count > 0 ? 'Requires attention' : 'Nominal zero'}
              </span>
            </div>
          </div>

          {/* 3. Middle Section: Risk Distribution Chart & Overall Welfare Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Welfare Risk Distribution Chart */}
            <div className="lg:col-span-7 bg-field-surface border border-field-border rounded-lg p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-field-border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-command-blue" />
                  <h2 className="text-sm sm:text-base font-bold text-field-primary">
                    Welfare Risk Distribution
                  </h2>
                </div>
                <span className="text-xs text-field-muted font-mono">
                  Total: {data.total_personnel} Personnel
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-field-border/40" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      className="text-field-muted font-medium"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      className="text-field-muted font-mono"
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-field-border text-center text-xs">
                <div>
                  <span className="text-field-muted block text-[11px]">Low (0–34)</span>
                  <strong className="text-readiness-green">{data.low_count}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">Mod (35–64)</span>
                  <strong className="text-command-blue">{data.moderate_count}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">High (65–84)</span>
                  <strong className="text-triage-amber">{data.high_count}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">Crit (85–100)</span>
                  <strong className="text-triage-red">{data.critical_count}</strong>
                </div>
              </div>
            </div>

            {/* Overall Welfare Status Card */}
            <div className="lg:col-span-5 bg-field-surface border border-field-border rounded-lg p-5 flex flex-col justify-between space-y-4 shadow-sm">
              <div className="pb-3 border-b border-field-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-command-blue" />
                  <h2 className="text-sm sm:text-base font-bold text-field-primary">
                    Overall Welfare Status
                  </h2>
                </div>
                <span className="text-xs text-field-muted">Readiness Health</span>
              </div>

              <div className="my-auto py-3 space-y-3 text-center">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-field-surface-subtle border border-field-border">
                  {data.overall_status.level === 'ATTENTION REQUIRED' ? (
                    <AlertTriangle className="w-8 h-8 text-triage-red animate-bounce" />
                  ) : data.overall_status.level === 'WATCH' ? (
                    <AlertCircle className="w-8 h-8 text-triage-amber" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-readiness-green" />
                  )}
                </div>

                <div>
                  <div
                    className={`text-xl sm:text-2xl font-black tracking-wide ${
                      data.overall_status.level === 'ATTENTION REQUIRED'
                        ? 'text-triage-red'
                        : data.overall_status.level === 'WATCH'
                        ? 'text-triage-amber'
                        : 'text-readiness-green'
                    }`}
                  >
                    {data.overall_status.label}
                  </div>
                  <p className="text-xs text-field-muted max-w-sm mx-auto mt-2 leading-relaxed">
                    {data.overall_status.description}
                  </p>
                </div>
              </div>

              <div className="bg-field-surface-subtle border border-field-border rounded-lg p-3 text-xs flex items-center justify-between">
                <span className="text-field-muted">Monitored Unit Scope:</span>
                <strong className="text-field-primary font-semibold">
                  {selectedUnit === 'ALL' ? 'Entire Monitored Population' : `Unit ${selectedUnit.replace(/^UNIT[_\s-]*/i, '')}`}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. Unit-wise Welfare Overview Table */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-field-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-command-blue" />
                <h2 className="text-sm sm:text-base font-bold text-field-primary">
                  Unit-wise Welfare Overview
                </h2>
              </div>
              <span className="text-xs text-field-muted">
                Calculated dynamically from active {data.units.length} unit groups
              </span>
            </div>

            {data.units.length === 0 ? (
              <div className="p-8 text-center text-field-muted text-xs">
                No unit classification available in current dataset.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-field-border text-field-muted uppercase text-[11px] tracking-wider">
                      <th className="py-2.5 px-3 font-semibold">Unit</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Personnel</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-readiness-green">Low</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-command-blue">Moderate</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-triage-amber">High</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-triage-red">Critical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-field-border">
                    {data.units.map((u) => {
                      const isSelected = selectedUnit === u.unit_id;
                      const unitDisplayName = `Unit ${u.unit_id.replace(/^UNIT[_\s-]*/i, '')}`;
                      return (
                        <tr
                          key={u.unit_id}
                          onClick={() => setSelectedUnit(isSelected ? 'ALL' : u.unit_id)}
                          className={`hover:bg-field-surface-subtle transition-colors cursor-pointer ${
                            isSelected ? 'bg-command-blue/10 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-field-primary flex items-center gap-2">
                            <span>{unitDisplayName}</span>
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-command-blue/20 text-command-blue font-bold">
                                Active Filter
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-field-primary">
                            {u.personnel_count}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-readiness-green">
                            {u.low}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-command-blue">
                            {u.moderate}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-triage-amber">
                            {u.high}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-triage-red">
                            {u.critical}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-field-muted italic pt-1">
              Tip: Click any unit row in the table to filter the dashboard to that unit.
            </p>
          </div>

          {/* 5. Major Welfare Risk Factors & Recommended Actions */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Major Welfare Risk Factors */}
            <div className="md:col-span-6 bg-field-surface border border-field-border rounded-lg p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-2 pb-2.5 border-b border-field-border">
                <Sparkles className="w-4 h-4 text-command-blue" />
                <h3 className="text-sm font-bold text-field-primary">
                  Major Welfare Risk Factors
                </h3>
              </div>
              <p className="text-xs text-field-muted">
                Primary aggregated features elevating predicted risk across personnel:
              </p>

              <div className="space-y-2 pt-1">
                {data.major_factors && data.major_factors.length > 0 ? (
                  data.major_factors.map((factor, idx) => (
                    <div
                      key={factor.feature}
                      className="flex items-center justify-between p-2.5 bg-field-surface-subtle border border-field-border rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-field-border flex items-center justify-center font-mono font-bold text-[10px] text-field-muted">
                          {idx + 1}
                        </span>
                        <span className="text-field-primary font-medium">{factor.display_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-triage-amber text-[11px]">
                        +{factor.aggregate_impact} pts impact
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-field-muted">No acute factors currently flagged.</p>
                )}
              </div>
            </div>

            {/* Recommended Actions */}
            <div className="md:col-span-6 bg-field-surface border border-field-border rounded-lg p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-2 pb-2.5 border-b border-field-border">
                <CheckCircle2 className="w-4 h-4 text-readiness-green" />
                <h3 className="text-sm font-bold text-field-primary">
                  Recommended Actions
                </h3>
              </div>
              <p className="text-xs text-field-muted">
                Decision support guidance for the unit commanding echelon:
              </p>

              <div className="space-y-2 pt-1">
                {data.recommendations && data.recommendations.length > 0 ? (
                  data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-field-surface-subtle border border-field-border rounded text-xs flex items-start gap-2.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-command-blue shrink-0 mt-0.5" />
                      <span className="text-field-primary leading-relaxed">{rec}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-field-muted">All indicators nominal.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center bg-field-surface border border-field-border rounded-lg text-field-muted text-xs">
          No data available for the active dataset.
        </div>
      )}
    </div>
  );
};
