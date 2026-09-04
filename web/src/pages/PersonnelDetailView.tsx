import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Shield,
  Activity,
  Calendar,
  Clock,
  Coffee,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Moon,
  MapPin
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface ShapFactor {
  raw_feature: string;
  display_name: string;
  shap_value: number;
  absolute_impact: number;
  impact_direction: 'elevates_risk' | 'lowers_risk';
  points_impact: number;
  actual_value: any;
}

interface Recommendation {
  title: string;
  reason: string;
  action_type: string;
}

interface PersonnelDetailData {
  personnel: {
    person_id: string;
    record_date: string;
    unit_id: string;
    role: string;
    age: number;
    experience_years: number;
    role_difficulty_score: number;
  };
  welfare_risk: {
    welfare_risk_score: number;
    risk_probability: number;
    risk_category: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    model_version: string;
  };
  wellness: {
    stress_score: number;
    sleep_hours: number;
    sleep_quality: number;
    mood_score: number;
    fatigue_score: number;
    help_requested: boolean;
  };
  workload: {
    duty_hours: number;
    overtime_hours: number;
    shift_type: string;
    night_shift: number;
    consecutive_work_days: number;
    consecutive_night_shifts: number;
    avg_duty_hours_30d: number;
    night_shifts_30d: number;
  };
  leave: {
    days_since_last_leave: number;
    leave_days: number;
    leave_type: string;
    leave_approved: number;
    leave_frequency: number;
    leave_days_30d: number;
  };
  deployment: {
    deployment_status: string;
    deployment_duration_days: number;
    deployment_hardship_score: number;
    recent_deployment: number;
    transfer_event: number;
    days_since_transfer: number;
  };
  shap_factors: ShapFactor[];
  recommendations: Recommendation[];
}

interface HistoricalPoint {
  record_date: string;
  stress_score: number;
  welfare_risk_score: number;
  sleep_hours: number;
  mood_score: number;
  duty_hours: number;
  fatigue_score: number;
  risk_category: string;
}

export const PersonnelDetailView: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PersonnelDetailData | null>(null);
  const [history, setHistory] = useState<HistoricalPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPersonnelData = async () => {
    if (!user || !personId) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch detail & SHAP factors
      const detailRes = await fetch(`${API_BASE_URL}/api/personnel/${personId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!detailRes.ok) {
        throw new Error(`Failed to load personnel details (${detailRes.status})`);
      }
      const detailData: PersonnelDetailData = await detailRes.json();
      setDetail(detailData);

      // 2. Fetch longitudinal history for charts
      const histRes = await fetch(`${API_BASE_URL}/api/personnel/${personId}/history`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (histRes.ok) {
        const histData: HistoricalPoint[] = await histRes.json();
        setHistory(histData);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while loading personnel assessment.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPersonnelData();
  }, [personId, user]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-triage-red-bg text-triage-red border border-triage-red-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-triage-red animate-pulse" />
            CRITICAL RISK
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-triage-amber-bg text-triage-amber border border-triage-amber-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-triage-amber" />
            HIGH RISK
          </span>
        );
      case 'MODERATE':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-triage-blue-bg text-blue-300 border border-triage-blue-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            MODERATE RISK
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-triage-green-bg text-readiness-green border border-triage-green-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-readiness-green" />
            LOW RISK
          </span>
        );
    }
  };

  // SVG Gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const riskScore = detail?.welfare_risk.welfare_risk_score ?? 0;
  const strokeDashoffset = circumference - (Math.min(Math.max(riskScore, 0), 100) / 100) * circumference;

  const getGaugeStrokeColor = (score: number) => {
    if (score >= 85) return '#D6453D';
    if (score >= 65) return '#C97A1E';
    if (score >= 35) return '#2965A8';
    return '#2E8B68';
  };

  // Find max absolute SHAP impact among top factors for relative bar width
  const maxShapImpact = detail && detail.shap_factors.length > 0
    ? Math.max(...detail.shap_factors.map((f) => f.absolute_impact), 0.01)
    : 1;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Rail */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/welfare')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-field-surface hover:bg-field-surface-elevated text-field-primary border border-field-border text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Personnel Roster</span>
        </button>

        <button
          onClick={fetchPersonnelData}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-field-surface border border-field-border rounded-lg flex flex-col items-center justify-center text-field-muted">
          <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
          <p className="text-xs">Loading comprehensive personnel file & SHAP factors...</p>
        </div>
      ) : detail ? (
        <div className="space-y-6">
          {/* Main Personnel & Prominent Risk Score Dossier */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Personnel Demographics */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                    Comprehensive Dossier
                  </span>
                  <span className="text-xs font-mono text-command-blue font-semibold px-2 py-0.5 rounded bg-blue-950/40 border border-blue-900/50">
                    {detail.personnel.person_id}
                  </span>
                  {getCategoryBadge(detail.welfare_risk.risk_category)}
                </div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
                    {detail.personnel.role} • {detail.personnel.unit_id}
                  </h1>
                  <p className="text-xs text-field-muted mt-0.5">
                    Latest observation recorded on <strong>{detail.personnel.record_date}</strong> (Active Model: {detail.welfare_risk.model_version})
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
                  <div>
                    <span className="text-field-muted block">Age</span>
                    <strong className="text-field-primary text-sm font-semibold">{detail.personnel.age} yrs</strong>
                  </div>
                  <div>
                    <span className="text-field-muted block">Experience</span>
                    <strong className="text-field-primary text-sm font-semibold">{detail.personnel.experience_years} yrs</strong>
                  </div>
                  <div>
                    <span className="text-field-muted block">Role Difficulty</span>
                    <strong className="text-field-primary text-sm font-semibold">{detail.personnel.role_difficulty_score} / 100</strong>
                  </div>
                  <div>
                    <span className="text-field-muted block">Observed Stress</span>
                    <strong className="text-triage-amber text-sm font-semibold">{detail.wellness.stress_score} / 10</strong>
                  </div>
                </div>
              </div>

              {/* Prominent Welfare Risk Score Gauge */}
              <div className="flex items-center gap-5 bg-field-surface-subtle border border-field-border rounded-lg p-4 sm:p-5 shrink-0">
                <div className="relative flex items-center justify-center w-24 h-24">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} stroke="#222D37" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke={getGaugeStrokeColor(riskScore)}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-field-primary leading-none">
                      {detail.welfare_risk.welfare_risk_score}
                    </span>
                    <span className="text-[10px] text-field-muted mt-0.5">/ 100</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <span className="text-field-muted font-medium block">Welfare Risk Score</span>
                  <div className="text-base font-bold text-field-primary">
                    {detail.welfare_risk.welfare_risk_score} / 100
                  </div>
                  <div className="text-[11px] text-field-muted">
                    Model Probability: <strong className="text-field-primary font-medium">{(detail.welfare_risk.risk_probability * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="text-[11px] text-field-muted">
                    Supporting Stress: <strong className="text-triage-amber font-semibold">{detail.wellness.stress_score} / 10</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout: SHAP Explanations & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Top 5 SHAP Feature Attribution */}
            <div className="lg:col-span-7 bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-field-border">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-field-primary flex items-center gap-2">
                    <Activity className="w-4 h-4 text-command-blue" />
                    Why is this person's risk elevated?
                  </h2>
                  <p className="text-xs text-field-muted mt-0.5">
                    Factors contributing to the model's risk prediction (Top 5 by absolute SHAP value).
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                  TreeSHAP
                </span>
              </div>

              {detail.shap_factors && detail.shap_factors.length > 0 ? (
                <div className="space-y-3 pt-1">
                  {detail.shap_factors.map((factor, idx) => {
                    const isPositive = factor.impact_direction === 'elevates_risk';
                    const barWidthPercent = Math.min(Math.round((factor.absolute_impact / maxShapImpact) * 100), 100);

                    return (
                      <div key={idx} className="p-3 bg-field-surface-subtle border border-field-border rounded space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-field-primary">{factor.display_name}</span>
                            {factor.actual_value !== undefined && factor.actual_value !== null && (
                              <span className="text-[11px] text-field-muted">
                                (Value: <span className="text-field-primary font-mono">{String(factor.actual_value)}</span>)
                              </span>
                            )}
                          </div>
                          <span className={`font-mono font-bold text-xs ${isPositive ? 'text-triage-red' : 'text-readiness-green'}`}>
                            {isPositive ? `+${factor.points_impact}` : `${factor.points_impact}`} pts
                          </span>
                        </div>

                        {/* Visual Impact Bar */}
                        <div className="w-full bg-field-surface-elevated rounded h-2 overflow-hidden border border-field-border">
                          <div
                            className={`h-full rounded transition-all ${
                              isPositive ? 'bg-gradient-to-r from-amber-500 to-triage-red' : 'bg-gradient-to-r from-teal-500 to-readiness-green'
                            }`}
                            style={{ width: `${Math.max(barWidthPercent, 8)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-field-muted">
                          <span>
                            {isPositive
                              ? 'Pushed model toward higher welfare risk'
                              : 'Pushed model toward lower welfare risk'}
                          </span>
                          <span className="font-mono text-[10px]">
                            SHAP: {factor.shap_value > 0 ? `+${factor.shap_value.toFixed(3)}` : factor.shap_value.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-field-muted">
                  No significant feature deviations found for this record.
                </div>
              )}

              <div className="pt-2 text-[11px] text-field-muted border-t border-field-border flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-readiness-green shrink-0" />
                <span>These factors had the strongest mathematical influence on this prediction. They represent statistical model attributions, not direct causality.</span>
              </div>
            </div>

            {/* Right 5 Cols: Actionable Operational Recommendations */}
            <div className="lg:col-span-5 bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-field-border">
                <FileCheck className="w-4 h-4 text-readiness-green" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-field-primary">
                    Practical Recommendations
                  </h2>
                  <p className="text-xs text-field-muted mt-0.5">
                    Deterministic actions tailored to the strongest risk drivers.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {detail.recommendations && detail.recommendations.length > 0 ? (
                  detail.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3.5 bg-field-surface-subtle border border-field-border rounded space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-readiness-green flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {rec.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                          {rec.action_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-field-primary leading-relaxed">
                        <strong className="text-field-muted font-normal">Reason: </strong>
                        {rec.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-field-muted">
                    Standard operational protocol active. Continue routine monitoring.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Historical Trends (Longitudinal Analysis) */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-field-border">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-field-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-command-blue" />
                  Historical Trajectory & Multi-Week Trends
                </h2>
                <p className="text-xs text-field-muted mt-0.5">
                  Longitudinal comparison of observed stress, model-predicted welfare risk, and sleep over time.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-field-primary font-medium">
                  <span className="w-3 h-0.5 bg-command-blue inline-block" /> Welfare Risk (0-100)
                </span>
                <span className="flex items-center gap-1 text-field-primary font-medium">
                  <span className="w-3 h-0.5 bg-triage-amber inline-block" /> Stress (1-10)
                </span>
                <span className="flex items-center gap-1 text-field-primary font-medium">
                  <span className="w-3 h-0.5 bg-readiness-green inline-block" /> Sleep (hrs)
                </span>
              </div>
            </div>

            {history.length > 0 ? (
              <div className="w-full h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#222D37" vertical={false} />
                    <XAxis
                      dataKey="record_date"
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141C22',
                        borderColor: '#222D37',
                        borderRadius: '0.375rem',
                        fontSize: '12px',
                        color: '#F4F7F9',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="welfare_risk_score"
                      name="Welfare Risk Score"
                      stroke="#2965A8"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#2965A8' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="stress_score"
                      name="Stress Score (1-10)"
                      stroke="#C97A1E"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#C97A1E' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sleep_hours"
                      name="Sleep Hours"
                      stroke="#2E8B68"
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                      dot={{ r: 2.5, fill: '#2E8B68' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-field-muted">
                No historical observations found for this individual.
              </div>
            )}
          </div>

          {/* Categorized Operational Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Wellness */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-field-primary uppercase tracking-wider pb-2 border-b border-field-border flex items-center justify-between">
                <span>Current Wellness</span>
                <Moon className="w-3.5 h-3.5 text-readiness-green" />
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-field-muted">Stress Score:</span>
                  <strong className="text-triage-amber font-semibold">{detail.wellness.stress_score} / 10</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Sleep Hours:</span>
                  <strong className="text-field-primary">{detail.wellness.sleep_hours} hrs</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Sleep Quality:</span>
                  <strong className="text-field-primary">{detail.wellness.sleep_quality} / 10</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Mood Score:</span>
                  <strong className="text-field-primary">{detail.wellness.mood_score} / 10</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Fatigue Score:</span>
                  <strong className="text-field-primary">{detail.wellness.fatigue_score} / 10</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Help Requested:</span>
                  <span className={`font-semibold ${detail.wellness.help_requested ? 'text-triage-red' : 'text-field-muted'}`}>
                    {detail.wellness.help_requested ? 'YES' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Workload */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-field-primary uppercase tracking-wider pb-2 border-b border-field-border flex items-center justify-between">
                <span>Duty & Workload</span>
                <Clock className="w-3.5 h-3.5 text-command-blue" />
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-field-muted">Shift Duty Hours:</span>
                  <strong className="text-field-primary">{detail.workload.duty_hours} hrs</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Overtime:</span>
                  <strong className="text-field-primary">{detail.workload.overtime_hours} hrs</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Shift Type:</span>
                  <strong className="text-field-primary">{detail.workload.shift_type}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Consecutive Days:</span>
                  <strong className="text-field-primary">{detail.workload.consecutive_work_days} days</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Consecutive Nights:</span>
                  <strong className={`font-semibold ${detail.workload.consecutive_night_shifts >= 3 ? 'text-triage-red' : 'text-field-primary'}`}>
                    {detail.workload.consecutive_night_shifts}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Avg Duty (30d):</span>
                  <strong className="text-field-primary">{detail.workload.avg_duty_hours_30d} hrs</strong>
                </div>
              </div>
            </div>

            {/* 3. Leave */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-field-primary uppercase tracking-wider pb-2 border-b border-field-border flex items-center justify-between">
                <span>Leave Status</span>
                <Coffee className="w-3.5 h-3.5 text-triage-amber" />
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-field-muted">Days Since Leave:</span>
                  <strong className={`font-semibold ${detail.leave.days_since_last_leave >= 60 ? 'text-triage-amber' : 'text-field-primary'}`}>
                    {detail.leave.days_since_last_leave} days
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Leave Taken:</span>
                  <strong className="text-field-primary">{detail.leave.leave_days} days</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Leave Type:</span>
                  <strong className="text-field-primary">{detail.leave.leave_type}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Leave Frequency:</span>
                  <strong className="text-field-primary">{detail.leave.leave_frequency.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Leave in 30d:</span>
                  <strong className="text-field-primary">{detail.leave.leave_days_30d} days</strong>
                </div>
              </div>
            </div>

            {/* 4. Deployment */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-field-primary uppercase tracking-wider pb-2 border-b border-field-border flex items-center justify-between">
                <span>Deployment & Transfer</span>
                <MapPin className="w-3.5 h-3.5 text-readiness-green" />
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-field-muted">Deployment Status:</span>
                  <strong className="text-field-primary">{detail.deployment.deployment_status}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Duration:</span>
                  <strong className="text-field-primary">{detail.deployment.deployment_duration_days} days</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Hardship Score:</span>
                  <strong className="text-field-primary">{detail.deployment.deployment_hardship_score}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Recent Deployment:</span>
                  <strong className="text-field-primary">{detail.deployment.recent_deployment ? 'Yes' : 'No'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-field-muted">Days Since Transfer:</span>
                  <strong className="text-field-primary">{detail.deployment.days_since_transfer} days</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
