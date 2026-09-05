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
  ArrowRight,
  Sliders,
  Printer,
  X,
  FileText,
  Download
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

  // Simulation Controls State
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [simRestHours, setSimRestHours] = useState<number>(12);
  const [simMaxNightShifts, setSimMaxNightShifts] = useState<number>(2);
  const [simCrossRelief, setSimCrossRelief] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Briefing Export Modal State
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

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

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUnit(e.target.value);
  };

  // Calculate dynamic simulation values on top of actual dataset counts
  const calculateSimulatedMetrics = (baseTotal: number, baseLow: number, baseMod: number, baseHigh: number, baseCrit: number) => {
    if (!showSimulator || baseTotal === 0) {
      return { low: baseLow, moderate: baseMod, high: baseHigh, critical: baseCrit };
    }

    let critRelief = 0;
    let highRelief = 0;
    let modShift = 0;
    let lowGain = 0;

    // 1. Mandatory Rest Hours impact (Default threshold ~8h, standard ~12h, high >=14h)
    if (simRestHours >= 14) {
      critRelief += Math.ceil(baseCrit * 0.75);
      highRelief += Math.ceil(baseHigh * 0.45);
      modShift += Math.ceil(baseHigh * 0.25);
      lowGain += Math.ceil(baseHigh * 0.20) + Math.ceil(baseCrit * 0.50);
    } else if (simRestHours >= 12) {
      critRelief += Math.ceil(baseCrit * 0.50);
      highRelief += Math.ceil(baseHigh * 0.30);
      modShift += Math.ceil(baseHigh * 0.15);
      lowGain += Math.ceil(baseHigh * 0.15) + Math.ceil(baseCrit * 0.30);
    } else if (simRestHours < 8) {
      // Rest deficit worsens fatigue
      modShift += Math.ceil(baseLow * 0.15);
      highRelief -= Math.ceil(baseMod * 0.15);
    }

    // 2. Max Consecutive Night Shifts impact (threshold <= 2 shifts)
    if (simMaxNightShifts <= 2) {
      critRelief += Math.ceil(baseCrit * 0.30);
      highRelief += Math.ceil(baseHigh * 0.25);
      lowGain += Math.ceil(baseHigh * 0.15);
    } else if (simMaxNightShifts >= 4) {
      // Consecutive night strain worsens risk
      highRelief -= Math.ceil(baseMod * 0.10);
    }

    // 3. Inter-Unit / Reserve Cross-Leveling
    if (simCrossRelief) {
      highRelief += Math.ceil(baseHigh * 0.15);
      lowGain += Math.ceil(baseHigh * 0.10);
    }

    const simCrit = Math.max(0, baseCrit - critRelief);
    const simHigh = Math.max(0, Math.min(baseTotal, baseHigh - highRelief));
    const simMod = Math.max(0, Math.min(baseTotal, baseMod + modShift));
    const simLow = Math.max(0, baseTotal - (simCrit + simHigh + simMod));

    return {
      low: simLow,
      moderate: simMod,
      high: simHigh,
      critical: simCrit,
    };
  };

  const currentDisplayMetrics = data
    ? calculateSimulatedMetrics(data.total_personnel, data.low_count, data.moderate_count, data.high_count, data.critical_count)
    : { low: 0, moderate: 0, high: 0, critical: 0 };

  // Prepare chart data based on active simulation or baseline
  const chartData = data
    ? [
        { name: 'Low', count: currentDisplayMetrics.low, color: RISK_COLORS.low, range: '0–34' },
        { name: 'Moderate', count: currentDisplayMetrics.moderate, color: RISK_COLORS.moderate, range: '35–64' },
        { name: 'High', count: currentDisplayMetrics.high, color: RISK_COLORS.high, range: '65–84' },
        { name: 'Critical', count: currentDisplayMetrics.critical, color: RISK_COLORS.critical, range: '85–100' },
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

  const handleApplySimulatedRoster = () => {
    setActionNotice(
      `Simulated Roster Parameters Applied: Rest Window ≥ ${simRestHours}h, Max Night Shifts ≤ ${simMaxNightShifts}, Reserve Support: ${simCrossRelief ? 'Active' : 'Disabled'}. Projected High & Critical risk reduced across units.`
    );
    setTimeout(() => {
      setActionNotice(null);
    }, 6000);
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
              Current operational welfare status across monitored active personnel with interactive roster simulation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Unit Filter */}
            {data?.available_units && data.available_units.length > 0 && (
              <div className="flex items-center gap-2">
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

            {/* Toggle Simulator Button */}
            <button
              type="button"
              onClick={() => setShowSimulator(!showSimulator)}
              className={`px-3.5 py-2 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm ${
                showSimulator
                  ? 'bg-command-blue text-white shadow-command-blue/30'
                  : 'bg-field-surface-subtle hover:bg-field-border text-field-primary border border-field-border'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showSimulator ? 'Close Simulator' : 'Roster Simulator'}</span>
            </button>

            {/* Export Briefing Button */}
            <button
              type="button"
              onClick={() => setShowBriefingModal(true)}
              className="px-3.5 py-2 bg-field-surface-subtle hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-command-blue" />
              <span>Export Details</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchOverview(selectedUnit)}
              disabled={isRefreshing}
              className="p-2 bg-field-surface-subtle hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div className="p-3.5 bg-triage-green-bg border border-triage-green-border rounded-lg flex items-center justify-between text-xs text-readiness-green shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-readiness-green shrink-0" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-readiness-green hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERACTIVE ROSTER REBALANCE SIMULATOR PANEL              */}
      {/* ========================================================= */}
      {showSimulator && (
        <div className="bg-field-surface-elevated border-2 border-command-blue/70 rounded-lg p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-field-border pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-command-blue" />
              <h2 className="text-sm font-bold text-field-primary tracking-wide uppercase">
                Predictive Roster & Shift Rebalance Simulator {selectedUnit !== 'ALL' ? `(Unit ${selectedUnit.replace(/^UNIT[_\s-]*/i, '')})` : '(All Units)'}
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40 font-bold self-start sm:self-auto">
              Live Simulation Mode Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Slider 1: Mandatory Rest Hours */}
            <div className="space-y-2 bg-field-surface p-4 rounded-lg border border-field-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-field-primary">Mandatory Rest Window:</span>
                <span className="font-mono font-bold text-command-blue px-2.5 py-0.5 rounded bg-field-surface-subtle border border-field-border">
                  {simRestHours} hrs / turnaround
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="18"
                step="1"
                value={simRestHours}
                onChange={(e) => setSimRestHours(parseInt(e.target.value))}
                className="w-full accent-command-blue cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-field-muted font-mono">
                <span>6 hrs (Strained)</span>
                <span>12 hrs (Standard)</span>
                <span>18 hrs (Restorative)</span>
              </div>
              <p className="text-[11px] text-field-muted pt-1 leading-relaxed">
                Guarantees minimum off-duty recovery interval between scheduled active duty shifts.
              </p>
            </div>

            {/* Slider 2: Max Consecutive Night Shifts */}
            <div className="space-y-2 bg-field-surface p-4 rounded-lg border border-field-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-field-primary">Max Consecutive Night Shifts:</span>
                <span className="font-mono font-bold text-command-blue px-2.5 py-0.5 rounded bg-field-surface-subtle border border-field-border">
                  {simMaxNightShifts} shifts max
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={simMaxNightShifts}
                onChange={(e) => setSimMaxNightShifts(parseInt(e.target.value))}
                className="w-full accent-command-blue cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-field-muted font-mono">
                <span>1 shift (Optimal)</span>
                <span>2 shifts (Target)</span>
                <span>5 shifts (High Strain)</span>
              </div>
              <p className="text-[11px] text-field-muted pt-1 leading-relaxed">
                Restricts cumulative circadian disruption by capping consecutive night watch periods.
              </p>
            </div>

            {/* Toggle 3: Inter-Unit Cross-Leveling Relief */}
            <div className="space-y-2 bg-field-surface p-4 rounded-lg border border-field-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-field-primary">Reserve Squad Relief:</span>
                  <button
                    type="button"
                    onClick={() => setSimCrossRelief(!simCrossRelief)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      simCrossRelief ? 'bg-readiness-green text-white shadow-sm' : 'bg-field-surface-subtle text-field-muted border border-field-border'
                    }`}
                  >
                    {simCrossRelief ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                <p className="text-[11px] text-field-muted pt-2.5 leading-relaxed">
                  Allows temporary shift re-allocation from low-strain units to balance sector duty load.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleApplySimulatedRoster}
                  className="w-full py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Apply Simulated Parameters</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {/* 2. Top Summary Metric Cards (Reflects Active Simulation if On) */}
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
                {showSimulator && <span className="text-[10px] px-1.5 py-0.2 rounded bg-readiness-green/20 text-readiness-green font-bold font-mono">SIM</span>}
                <span className="w-2.5 h-2.5 rounded-full bg-readiness-green" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-readiness-green font-mono tracking-tight">
                {currentDisplayMetrics.low}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((currentDisplayMetrics.low / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* Moderate Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-command-blue/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-command-blue font-semibold">Moderate Risk</span>
                {showSimulator && <span className="text-[10px] px-1.5 py-0.2 rounded bg-command-blue/20 text-command-blue font-bold font-mono">SIM</span>}
                <span className="w-2.5 h-2.5 rounded-full bg-command-blue" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-command-blue font-mono tracking-tight">
                {currentDisplayMetrics.moderate}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((currentDisplayMetrics.moderate / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* High Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-triage-amber/40 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-triage-amber font-semibold">High Risk</span>
                {showSimulator && <span className="text-[10px] px-1.5 py-0.2 rounded bg-triage-amber/20 text-triage-amber font-bold font-mono">SIM</span>}
                <span className="w-2.5 h-2.5 rounded-full bg-triage-amber" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-triage-amber font-mono tracking-tight">
                {currentDisplayMetrics.high}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {data.total_personnel > 0 ? `${Math.round((currentDisplayMetrics.high / data.total_personnel) * 100)}% of monitored` : '0%'}
              </span>
            </div>

            {/* Critical Risk */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-triage-red/40 shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-triage-red font-semibold">Critical Risk</span>
                {showSimulator && <span className="text-[10px] px-1.5 py-0.2 rounded bg-triage-red/20 text-triage-red font-bold font-mono">SIM</span>}
                <span className="w-2.5 h-2.5 rounded-full bg-triage-red animate-pulse" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-triage-red font-mono tracking-tight">
                {currentDisplayMetrics.critical}
              </div>
              <span className="text-[11px] text-field-muted mt-1 block">
                {currentDisplayMetrics.critical > 0 ? 'Requires attention' : 'Nominal zero'}
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
                    Welfare Risk Distribution {showSimulator && <span className="text-command-blue font-mono text-xs">(Simulated)</span>}
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
                  <strong className="text-readiness-green">{currentDisplayMetrics.low}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">Mod (35–64)</span>
                  <strong className="text-command-blue">{currentDisplayMetrics.moderate}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">High (65–84)</span>
                  <strong className="text-triage-amber">{currentDisplayMetrics.high}</strong>
                </div>
                <div>
                  <span className="text-field-muted block text-[11px]">Crit (85–100)</span>
                  <strong className="text-triage-red">{currentDisplayMetrics.critical}</strong>
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
                  {currentDisplayMetrics.critical > 0 || (currentDisplayMetrics.high / (data.total_personnel || 1)) >= 0.2 ? (
                    <AlertTriangle className="w-8 h-8 text-triage-red animate-bounce" />
                  ) : currentDisplayMetrics.high > 0 ? (
                    <AlertCircle className="w-8 h-8 text-triage-amber" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-readiness-green" />
                  )}
                </div>

                <div>
                  <div
                    className={`text-xl sm:text-2xl font-black tracking-wide ${
                      currentDisplayMetrics.critical > 0 || (currentDisplayMetrics.high / (data.total_personnel || 1)) >= 0.2
                        ? 'text-triage-red'
                        : currentDisplayMetrics.high > 0
                        ? 'text-triage-amber'
                        : 'text-readiness-green'
                    }`}
                  >
                    {currentDisplayMetrics.critical > 0 || (currentDisplayMetrics.high / (data.total_personnel || 1)) >= 0.2
                      ? 'ATTENTION REQUIRED'
                      : currentDisplayMetrics.high > 0
                      ? 'WATCH'
                      : 'GOOD'}
                  </div>
                  <p className="text-xs text-field-muted max-w-sm mx-auto mt-2 leading-relaxed">
                    {showSimulator
                      ? 'Simulated shift intervention outcome projected based on adjusted rest window and night rotation limits.'
                      : data.overall_status.description}
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

          {/* 4. Unit-wise Welfare Overview Table (Shows Baseline & Simulated Results) */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-field-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-command-blue" />
                <h2 className="text-sm sm:text-base font-bold text-field-primary">
                  Unit-wise Welfare Overview {showSimulator && <span className="text-command-blue font-mono text-xs">(Simulated Projections)</span>}
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
                      const unitMetrics = calculateSimulatedMetrics(u.personnel_count, u.low, u.moderate, u.high, u.critical);
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
                            {unitMetrics.low}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-command-blue">
                            {unitMetrics.moderate}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-triage-amber">
                            {unitMetrics.high}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-triage-red">
                            {unitMetrics.critical}
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

      {/* ========================================================= */}
      {/* 6. BRIEFING EXPORT MODAL (PRINT & CSV READY)              */}
      {/* ========================================================= */}
      {showBriefingModal && data && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-field-surface border border-field-border rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-field-border pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-command-blue" />
                <h3 className="text-base font-bold text-field-primary uppercase font-mono">
                  Operational Welfare Intelligence Brief
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBriefingModal(false)}
                className="text-field-muted hover:text-field-primary p-1 rounded hover:bg-field-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans leading-relaxed text-field-primary">
              <div className="p-3 bg-field-surface-subtle border border-field-border rounded font-mono text-[11px] space-y-1">
                <p>
                  MONITORED SCOPE:{' '}
                  <strong>{selectedUnit === 'ALL' ? 'ENTIRE FORMATION (ALL UNITS)' : `UNIT ${selectedUnit.replace(/^UNIT[_\s-]*/i, '')}`}</strong>
                </p>
                <p>
                  PERSONNEL MONITORED: <strong>{data.total_personnel} ACTIVE SERVICE MEMBERS</strong>
                </p>
                <p>
                  DATE / TIMESTAMP: <strong>{new Date().toUTCString()}</strong>
                </p>
                <p>
                  CLASSIFICATION: <strong>CONFIDENTIAL // COMMAND OVERSIGHT ONLY</strong>
                </p>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">1. Population Welfare Stratification</h4>
                <div className="grid grid-cols-4 gap-2 text-center font-mono py-1">
                  <div className="p-2.5 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">LOW RISK</span>
                    <strong className="text-readiness-green text-base">{currentDisplayMetrics.low}</strong>
                  </div>
                  <div className="p-2.5 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">MODERATE</span>
                    <strong className="text-command-blue text-base">{currentDisplayMetrics.moderate}</strong>
                  </div>
                  <div className="p-2.5 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">HIGH RISK</span>
                    <strong className="text-triage-amber text-base">{currentDisplayMetrics.high}</strong>
                  </div>
                  <div className="p-2.5 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">CRITICAL</span>
                    <strong className="text-triage-red text-base">{currentDisplayMetrics.critical}</strong>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">2. Unit Distribution Breakdown</h4>
                <div className="border border-field-border rounded overflow-hidden">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-field-surface-subtle border-b border-field-border text-field-muted">
                      <tr>
                        <th className="p-2">Unit</th>
                        <th className="p-2 text-center">Personnel</th>
                        <th className="p-2 text-center text-readiness-green">Low</th>
                        <th className="p-2 text-center text-command-blue">Mod</th>
                        <th className="p-2 text-center text-triage-amber">High</th>
                        <th className="p-2 text-center text-triage-red">Crit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-field-border">
                      {data.units.map((u) => (
                        <tr key={u.unit_id}>
                          <td className="p-2 font-bold">Unit {u.unit_id.replace(/^UNIT[_\s-]*/i, '')}</td>
                          <td className="p-2 text-center">{u.personnel_count}</td>
                          <td className="p-2 text-center text-readiness-green">{u.low}</td>
                          <td className="p-2 text-center text-command-blue">{u.moderate}</td>
                          <td className="p-2 text-center text-triage-amber">{u.high}</td>
                          <td className="p-2 text-center text-triage-red">{u.critical}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">3. Top Contributing Fatigue Factors</h4>
                <ul className="list-disc pl-5 space-y-1 text-field-muted">
                  {data.major_factors.map((f, i) => (
                    <li key={i}>
                      <strong className="text-field-primary">{f.display_name}</strong> (+{f.aggregate_impact} pts impact)
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">4. Command Recommendations</h4>
                <div className="p-3 bg-field-surface-subtle border border-command-blue/40 rounded space-y-1">
                  {data.recommendations.map((rec, i) => (
                    <p key={i} className="text-field-primary">
                      • {rec}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-field-border">
              <button
                type="button"
                onClick={() => {
                  const headers = 'Unit,Personnel,Low,Moderate,High,Critical\n';
                  const rows = data.units.map((u) => `Unit ${u.unit_id.replace(/^UNIT[_\s-]*/i, '')},${u.personnel_count},${u.low},${u.moderate},${u.high},${u.critical}`).join('\n');
                  const blob = new Blob([headers + rows], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `welfare_overview_${selectedUnit}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3.5 py-2 bg-field-surface-subtle hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-command-blue" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Briefing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
