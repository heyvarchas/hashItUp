import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RefreshCw,
  AlertTriangle,
  Lock,
  AlertCircle,
  Search,
  Users,
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

interface PersonnelRow {
  person_id: string;
  record_date: string;
  unit_id: string;
  role: string;
  stress_score: number;
  welfare_risk_score: number;
  risk_probability: number;
  risk_category: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  sleep_hours: number;
  duty_hours: number;
  help_requested: boolean;
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
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState<UnitSummaryData | null>(null);
  const [personnelList, setPersonnelList] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  const fetchData = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch aggregate statistics
      const resSummary = await fetch('http://localhost:8000/dashboard/unit-summary', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (resSummary.ok) {
        const data: UnitSummaryData = await resSummary.json();
        const formattedDist = data.distribution.map((d) => ({
          ...d,
          color: CATEGORY_COLORS[d.category] || d.color,
        }));
        setSummaryData({ ...data, distribution: formattedDist });
      }

      // 2. Fetch all personnel latest records from Master Dataset
      const resPersonnel = await fetch('http://localhost:8000/api/personnel', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (resPersonnel.ok) {
        const pList: PersonnelRow[] = await resPersonnel.json();
        setPersonnelList(pList);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while loading unit summary statistics.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Derive unique units for filter dropdown
  const uniqueUnits = Array.from(new Set(personnelList.map((p) => p.unit_id))).sort();

  // Filtered personnel roster
  const filteredPersonnel = personnelList.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.person_id.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.unit_id.toLowerCase().includes(q);

    const matchesCategory =
      categoryFilter === 'ALL' || p.risk_category.toUpperCase() === categoryFilter.toUpperCase();

    const matchesUnit = unitFilter === 'ALL' || p.unit_id === unitFilter;

    return matchesSearch && matchesCategory && matchesUnit;
  });

  const getRiskBadge = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-red-bg text-triage-red border border-triage-red-border">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-amber-bg text-triage-amber border border-triage-amber-border">
            HIGH
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-blue-bg text-blue-300 border border-triage-blue-border">
            MODERATE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-green-bg text-readiness-green border border-triage-green-border">
            LOW
          </span>
        );
    }
  };

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
                Single Master Dataset • Real-Time Predictive Telemetry
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
              Personnel Welfare & Stress Risk Monitoring
            </h1>
            <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
              Continuous early-warning welfare risk detection across unit personnel. The ML model predicts 30-day welfare risk probability, while current stress indicates real-time observed load.
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
              onClick={fetchData}
              disabled={isRefreshing}
              className="px-3 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-field-surface border border-field-border rounded-lg flex flex-col items-center justify-center text-field-muted">
          <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
          <p className="text-xs">Loading unit distribution metrics & personnel roster...</p>
        </div>
      ) : summaryData ? (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Personnel */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-field-muted block">
                Total Monitored Personnel
              </span>
              <div className="mt-2 text-2xl font-bold text-field-primary">
                {personnelList.length || summaryData.total_personnel}
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">Active master dataset records</p>
            </div>

            {/* Average Calibrated Score */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-field-muted block">
                Mean Welfare Risk Score
              </span>
              <div className="mt-2 text-2xl font-bold text-field-primary flex items-baseline gap-1">
                <span>{summaryData.average_calibrated_score}</span>
                <span className="text-xs font-normal text-field-muted">/ 100</span>
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">Calibrated ML population mean</p>
            </div>

            {/* Stable Baseline Percentage */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4">
              <span className="text-xs font-semibold text-readiness-green block">
                Low Risk Cohort
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
                Elevated Welfare Risk
              </span>
              <div className="mt-2 text-2xl font-bold text-triage-red flex items-baseline gap-1.5">
                <span>{elevatedPercent}%</span>
                <span className="text-xs font-normal text-field-muted">
                  ({summaryData.high_count + summaryData.critical_count})
                </span>
              </div>
              <p className="text-[11px] text-field-muted mt-0.5">High and Critical triage tiers</p>
            </div>
          </div>

          {/* Aggregate Risk Category Breakdown Bar Chart */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-field-border">
              <div>
                <h2 className="text-base font-bold text-field-primary">
                  Unit Welfare Risk Distribution
                </h2>
                <p className="text-xs text-field-muted mt-0.5">
                  Macro breakdown across predictive operational tiers (Low &lt; 35, Moderate 35-64, High 65-84, Critical &ge; 85).
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

            <div className="w-full h-56 pt-1">
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

          {/* MAIN PERSONNEL OPERATIONAL ROSTER TABLE */}
          <div className="bg-field-surface border border-field-border rounded-lg overflow-hidden space-y-4 p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-field-border">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-command-blue" />
                  <h2 className="text-base font-bold text-field-primary">
                    Active Personnel Roster & Welfare Predictions
                  </h2>
                </div>
                <p className="text-xs text-field-muted mt-0.5">
                  Showing {filteredPersonnel.length} of {personnelList.length} personnel. Click any individual's risk score to inspect top SHAP factors & historical trajectory.
                </p>
              </div>

              {/* Controls: Search, Category Filter, Unit Filter */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-field-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, role, or unit..."
                    className="bg-field-surface-subtle border border-field-border rounded pl-8 pr-3 py-1.5 text-xs text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue w-48 sm:w-56"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-field-surface-subtle border border-field-border text-field-primary text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-command-blue"
                >
                  <option value="ALL">All Categories</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="bg-field-surface-subtle border border-field-border text-field-primary text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-command-blue"
                >
                  <option value="ALL">All Units</option>
                  {uniqueUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Personnel Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-field-border text-field-muted font-semibold">
                    <th className="pb-3 pr-4">Person ID</th>
                    <th className="pb-3 pr-4">Unit</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4 text-center">Observed Stress</th>
                    <th className="pb-3 pr-4 text-center">Welfare Risk Score</th>
                    <th className="pb-3 pr-4">Risk Category</th>
                    <th className="pb-3 pr-4">Latest Date</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-field-muted">
                        No personnel records match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((person) => (
                      <tr
                        key={person.person_id}
                        onClick={() => navigate(`/welfare/personnel/${person.person_id}`)}
                        className="hover:bg-field-surface-elevated cursor-pointer transition-colors group"
                      >
                        <td className="py-3 pr-4 font-mono font-bold text-command-blue">
                          {person.person_id}
                        </td>
                        <td className="py-3 pr-4 text-field-primary font-medium">
                          {person.unit_id}
                        </td>
                        <td className="py-3 pr-4 text-field-primary">
                          {person.role}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="font-semibold text-triage-amber">
                            {person.stress_score} <span className="text-field-muted font-normal text-[11px]">/ 10</span>
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-flex items-center gap-1.5 font-bold text-sm text-field-primary group-hover:text-command-blue transition-colors">
                            {person.welfare_risk_score}
                            <span className="text-field-muted font-normal text-[11px]">/ 100</span>
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {getRiskBadge(person.risk_category)}
                        </td>
                        <td className="py-3 pr-4 text-field-muted font-mono text-[11px]">
                          {person.record_date}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/welfare/personnel/${person.person_id}`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border text-[11px] font-semibold transition-colors"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3 text-field-muted group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
