import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Info,
  Activity,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Send,
  Clock,
  UserCheck,
  Check,
  HeartHandshake,
  Stethoscope,
  Briefcase,
  Coffee,
  Sparkles,
} from 'lucide-react';

interface RecommendationItem {
  id: string;
  risk_score_id: string;
  recommendation_type: string;
  rationale?: string;
  generated_at: string;
}

interface RiskAssessmentDetail {
  id: string;
  pseudonymous_id: string;
  computed_at: string;
  probability_score: number;
  calibrated_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  contributing_factors: string[];
  rule_flags?: Record<string, any>;
  recommendations?: RecommendationItem[];
}

interface AlertDetail {
  id: string;
  risk_score_id: string;
  severity: 'critical' | 'high' | 'moderate' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  pseudonymous_id?: string;
}

interface InterventionRecord {
  id: string;
  alert_id: string;
  recorded_by_person_id: string;
  intervention_type: string;
  notes?: string;
  recorded_at: string;
  alert_status?: string;
}

const INTERVENTION_PRESETS = [
  {
    type: 'mandatory_rest_leave',
    label: 'Emergency Rest / Leave',
    icon: Coffee,
    description: 'Grant 3–7 days mandatory rest or emergency leave.',
  },
  {
    type: 'psychological_counseling',
    label: 'Counseling Referral',
    icon: HeartHandshake,
    description: 'Schedule clinical 1-on-1 counseling with unit psychologist.',
  },
  {
    type: 'duty_reassignment',
    label: 'Duty Reassignment',
    icon: Briefcase,
    description: 'Temporarily assign to light administrative or base duties.',
  },
  {
    type: 'medical_referral',
    label: 'Medical Specialist',
    icon: Stethoscope,
    description: 'Refer to base medical officer for physical & sleep evaluation.',
  },
  {
    type: 'peer_support_assigned',
    label: 'Peer Support Buddy',
    icon: UserCheck,
    description: 'Assign a senior buddy or mentor for structured peer support.',
  },
  {
    type: 'commander_conference',
    label: 'Commander Conference',
    icon: ShieldCheck,
    description: 'Conduct confidential welfare review with unit commanding officer.',
  },
];

export const CaseDetail: React.FC = () => {
  const { pseudonymousId } = useParams<{ pseudonymousId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertIdParam = searchParams.get('alert_id');

  const { user } = useAuth();
  const navigate = useNavigate();

  const [riskDetail, setRiskDetail] = useState<RiskAssessmentDetail | null>(null);
  const [activeAlert, setActiveAlert] = useState<AlertDetail | null>(null);
  const [interventionsList, setInterventionsList] = useState<InterventionRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Intervention Form State
  const [selectedType, setSelectedType] = useState<string>('mandatory_rest_leave');
  const [targetStatus, setTargetStatus] = useState<string>('resolved');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCaseData = async () => {
    if (!user || !pseudonymousId) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch Risk Assessment Detail
      const riskRes = await fetch(`http://localhost:8000/personnel/${pseudonymousId}/risk`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!riskRes.ok) {
        throw new Error(`Failed to load case detail (${riskRes.status} ${riskRes.statusText})`);
      }

      const riskData: RiskAssessmentDetail = await riskRes.json();
      setRiskDetail(riskData);

      // 2. Fetch Active Alert if alert_id is provided or query alerts for this pseudonymous_id
      let targetAlert: AlertDetail | null = null;
      if (alertIdParam) {
        try {
          const alertRes = await fetch(`http://localhost:8000/alerts/${alertIdParam}`, {
            headers: { Authorization: `Bearer ${user.token}` },
          });
          if (alertRes.ok) {
            targetAlert = await alertRes.json();
          }
        } catch {
          // fallback to list query
        }
      }

      if (!targetAlert) {
        // Query open alerts to see if this personnel has an open one
        const allAlertsRes = await fetch(`http://localhost:8000/alerts`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (allAlertsRes.ok) {
          const alertsList: AlertDetail[] = await allAlertsRes.json();
          const match = alertsList.find(
            (a) => a.pseudonymous_id === pseudonymousId && a.status !== 'resolved'
          ) || alertsList.find((a) => a.pseudonymous_id === pseudonymousId);
          if (match) {
            targetAlert = match;
            if (!alertIdParam) {
              setSearchParams({ alert_id: match.id }, { replace: true });
            }
          }
        }
      }

      setActiveAlert(targetAlert);

      // 3. Fetch past Interventions
      try {
        const intRes = await fetch(
          `http://localhost:8000/interventions?pseudonymous_id=${pseudonymousId}`,
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        if (intRes.ok) {
          const intData: InterventionRecord[] = await intRes.json();
          setInterventionsList(intData);
        }
      } catch {
        // quiet fail on past interventions fetch
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching personnel case assessment.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCaseData();
  }, [pseudonymousId, alertIdParam, user]);

  const handleRecordIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setSubmitSuccess(null);

    const alertIdToUse = activeAlert?.id || alertIdParam;

    if (!alertIdToUse) {
      setFormError('No associated alert found to bind this intervention to.');
      return;
    }

    if (!selectedType) {
      setFormError('Please choose an intervention type.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          alert_id: alertIdToUse,
          intervention_type: selectedType,
          notes: notes.trim() || undefined,
          new_alert_status: targetStatus,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to record intervention (${response.status})`);
      }

      const recorded: InterventionRecord = await response.json();

      // Update local alert status
      if (activeAlert) {
        setActiveAlert({
          ...activeAlert,
          status: (targetStatus as any) || 'resolved',
        });
      }

      // Add to local interventions list
      setInterventionsList((prev) => [recorded, ...prev]);

      setSubmitSuccess(
        `Intervention recorded successfully! Alert status transitioned to "${targetStatus.toUpperCase()}".`
      );
      setNotes('');
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the intervention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskCategoryBadge = (category: string) => {
    switch (category) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Flame className="w-3.5 h-3.5" /> Critical Urgency
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> High Risk
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" /> Moderate Risk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Low Risk
          </span>
        );
    }
  };

  const getGaugeStrokeColor = (score: number) => {
    if (score >= 85) return '#f43f5e'; // rose
    if (score >= 65) return '#f59e0b'; // amber
    if (score >= 35) return '#3b82f6'; // blue
    return '#10b981'; // emerald
  };

  // Circular gauge calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = Math.min(Math.max(riskDetail?.calibrated_score || 0, 0), 100);
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/welfare/alerts')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Alerts Queue
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCaseData}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Case
          </button>
        </div>
      </div>

      {/* Hero Header & Circular Risk Gauge */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" /> Confidential Case Review
              </span>

              {activeAlert && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                    activeAlert.status === 'open'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : activeAlert.status === 'acknowledged'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeAlert.status === 'open'
                        ? 'bg-rose-400 animate-pulse'
                        : activeAlert.status === 'acknowledged'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  Alert Status: {activeAlert.status}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Clinical Assessment & Intervention Triage
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
              <div>
                Pseudonym:{' '}
                <span className="text-slate-200 font-bold">{pseudonymousId}</span>
              </div>
              {activeAlert && (
                <div className="border-l border-slate-800 pl-4 text-slate-500">
                  Alert Ref: <span className="text-slate-300 font-mono">{activeAlert.id.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Circular Risk Gauge */}
          {riskDetail && (
            <div className="flex items-center gap-5 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shrink-0">
              <div className="relative flex items-center justify-center w-28 h-28">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-800/80"
                  />
                  {/* Active Value Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={getGaugeStrokeColor(riskDetail.calibrated_score)}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* Center Gauge Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-white leading-none">
                    {riskDetail.calibrated_score}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                    Risk / 100
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Triage Tier</span>
                <div>{getRiskCategoryBadge(riskDetail.risk_category)}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono pt-1">
                  <span>Prob: {(riskDetail.probability_score * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(riskDetail.computed_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Error Message */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
          <div className="w-9 h-9 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium text-slate-400">Loading case assessment and alerts...</p>
        </div>
      ) : riskDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: Contributing Factors & Recommendations */}
          <div className="lg:col-span-7 space-y-6">
            {/* Contributing Factors Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">Clinical & Operational Contributing Factors</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                  {riskDetail.contributing_factors?.length || 0} Indicators
                </span>
              </div>

              {riskDetail.contributing_factors && riskDetail.contributing_factors.length > 0 ? (
                <div className="space-y-3">
                  {riskDetail.contributing_factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-950/70 border border-slate-800/90 hover:border-slate-700/80 transition rounded-2xl flex items-start gap-3.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-slate-200">
                          {factor}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-950/40 border border-slate-800/60 rounded-2xl text-center text-slate-500 text-xs">
                  No significant risk factor flags identified in current monitoring cycle.
                </div>
              )}
            </div>

            {/* System Recommended Clinical & Command Actions */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">System Recommended Actions</h2>
              </div>

              {riskDetail.recommendations && riskDetail.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {riskDetail.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 bg-slate-950/70 border border-emerald-500/20 rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          {rec.recommendation_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(rec.generated_at).toLocaleDateString()}
                        </span>
                      </div>
                      {rec.rationale && (
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {rec.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-950/40 border border-slate-800/60 rounded-2xl text-center text-slate-400 text-xs">
                  Routine monitoring protocol active. No immediate clinical escalations required.
                </div>
              )}
            </div>

            {/* Past Interventions History Timeline */}
            {interventionsList.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">Recorded Interventions History</h2>
                </div>

                <div className="space-y-3">
                  {interventionsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                          {item.intervention_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(item.recorded_at).toLocaleDateString()} {new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800">
                          {item.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Recorded by Officer: <span className="font-mono text-slate-400">{item.recorded_by_person_id?.slice(0, 8)}...</span></span>
                        {item.alert_status && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                            {item.alert_status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Columns: Intervention Recording Form (POST /interventions) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <HeartHandshake className="w-4 h-4" /> Intervention Action Form
                  </div>
                  <h3 className="text-base font-bold text-white">Record Officer Intervention</h3>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  POST /interventions
                </span>
              </div>

              {submitSuccess && (
                <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Action Recorded</span>
                  </div>
                  <p>{submitSuccess}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/welfare/alerts')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                  >
                    View Updated Alerts Queue <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              )}

              {formError && (
                <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2.5 text-rose-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRecordIntervention} className="space-y-5">
                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Quick Action Presets
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTERVENTION_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      const isSelected = selectedType === preset.type;
                      return (
                        <button
                          key={preset.type}
                          type="button"
                          onClick={() => setSelectedType(preset.type)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <span className="text-xs font-semibold leading-tight">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Intervention Type Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Intervention Type Category
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="mandatory_rest_leave">Emergency Rest / Leave Granted</option>
                    <option value="psychological_counseling">Clinical Psychological Counseling</option>
                    <option value="duty_reassignment">Duty Reassignment (Light / Base Duties)</option>
                    <option value="medical_referral">Medical Specialist Referral</option>
                    <option value="peer_support_assigned">Peer Support / Buddy Assigned</option>
                    <option value="commander_conference">Unit Commander Welfare Conference</option>
                    <option value="routine_checkin">Routine Supportive Follow-up</option>
                    <option value="other_support">Other Direct Supportive Action</option>
                  </select>
                </div>

                {/* Target Alert Resolution Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Alert Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetStatus('resolved')}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        targetStatus === 'resolved'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetStatus('acknowledged')}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        targetStatus === 'acknowledged'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Keep Acknowledged
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {targetStatus === 'resolved'
                      ? 'Resolving this alert removes it from the active Open queue.'
                      : 'Acknowledging retains the alert for ongoing clinical follow-up.'}
                  </p>
                </div>

                {/* Clinical Notes */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Intervention Notes & Rationale
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Encrypted at rest</span>
                  </div>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Document discussion points, clinical recommendations, follow-up timelines, or duty adjustments..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !activeAlert}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Record Intervention & Update Alert
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Audit Attribution: Officer Person ID {user?.claims.person_id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
