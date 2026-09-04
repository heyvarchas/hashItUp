import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Activity,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Send,
  Clock,
  Check,
  HeartHandshake,
  Stethoscope,
  Briefcase,
  Coffee,
  Lock,
  FileText
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
    icon: Shield,
    description: 'Assign a senior buddy or mentor for structured peer support.',
  },
  {
    type: 'commander_conference',
    label: 'Commander Conference',
    icon: FileText,
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

      // 2. Fetch Active Alert
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
          // fallback to list
        }
      }

      if (!targetAlert) {
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
        `Intervention recorded successfully. Alert status updated to "${targetStatus.toUpperCase()}".`
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-triage-red-bg text-triage-red border border-triage-red-border">
            Critical Urgency
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-triage-amber-bg text-triage-amber border border-triage-amber-border">
            High Risk
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-triage-blue-bg text-blue-300 border border-triage-blue-border">
            Moderate Risk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-triage-green-bg text-readiness-green border border-triage-green-border">
            Low / Stable
          </span>
        );
    }
  };

  const getGaugeStrokeColor = (score: number) => {
    if (score >= 85) return '#D6453D';
    if (score >= 65) return '#C97A1E';
    if (score >= 35) return '#2965A8';
    return '#2E8B68';
  };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = Math.min(Math.max(riskDetail?.calibrated_score || 0, 0), 100);
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header Rail */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/welfare/alerts')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-field-surface hover:bg-field-surface-elevated text-field-primary border border-field-border text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Triage Queue</span>
        </button>

        <button
          onClick={fetchCaseData}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Case</span>
        </button>
      </div>

      {/* Case Dossier Summary Panel */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                Confidential Case Review
              </span>

              {activeAlert && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${
                    activeAlert.status === 'open'
                      ? 'bg-triage-red-bg text-triage-red border-triage-red-border'
                      : activeAlert.status === 'acknowledged'
                      ? 'bg-triage-amber-bg text-triage-amber border-triage-amber-border'
                      : 'bg-triage-green-bg text-readiness-green border-triage-green-border'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeAlert.status === 'open'
                        ? 'bg-triage-red'
                        : activeAlert.status === 'acknowledged'
                        ? 'bg-triage-amber'
                        : 'bg-readiness-green'
                    }`}
                  />
                  Alert Status: {activeAlert.status.toUpperCase()}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
              Clinical Assessment & Intervention Triage
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-field-muted">
              <div>
                Pseudonym: <strong className="text-field-primary font-medium">{pseudonymousId}</strong>
              </div>
              {activeAlert && (
                <div className="border-l border-field-border pl-4">
                  Alert ID: <span className="text-field-primary">{activeAlert.id.slice(0, 10)}</span>
                </div>
              )}
              <div className="border-l border-field-border pl-4 flex items-center gap-1">
                <Lock className="w-3 h-3 text-readiness-green" />
                <span>Encrypted & De-identified</span>
              </div>
            </div>
          </div>

          {/* High-Precision Risk Score Gauge */}
          {riskDetail && (
            <div className="flex items-center gap-4 bg-field-surface-subtle border border-field-border rounded p-3.5 shrink-0">
              <div className="relative flex items-center justify-center w-20 h-20">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="#222D37"
                    strokeWidth="8"
                    fill="transparent"
                  />
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
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-bold text-field-primary leading-none">
                    {riskDetail.calibrated_score}
                  </span>
                  <span className="text-[9px] text-field-muted mt-0.5">
                    / 100
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-field-muted block">Risk Tier</span>
                <div>{getRiskCategoryBadge(riskDetail.risk_category)}</div>
                <div className="text-[11px] text-field-muted pt-0.5">
                  Probability: {(riskDetail.probability_score * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
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
          <p className="text-xs">Loading case assessment and triage logs...</p>
        </div>
      ) : riskDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Factors, Recommendations, History */}
          <div className="lg:col-span-7 space-y-5">
            {/* Contributing Factors */}
            <div className="bg-field-surface border border-field-border rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-field-border">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-field-muted" />
                  <h2 className="text-sm font-bold text-field-primary">
                    Identified Operational & Clinical Factors
                  </h2>
                </div>
                <span className="text-xs text-field-muted px-2 py-0.5 rounded bg-field-surface-elevated border border-field-border font-medium">
                  {riskDetail.contributing_factors?.length || 0} Indicators
                </span>
              </div>

              {riskDetail.contributing_factors && riskDetail.contributing_factors.length > 0 ? (
                <div className="space-y-2">
                  {riskDetail.contributing_factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-field-surface-subtle border border-field-border rounded flex items-start gap-2.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-triage-amber shrink-0 mt-1.5" />
                      <p className="text-xs text-field-primary leading-relaxed font-medium">
                        {factor}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-field-surface-subtle border border-field-border rounded text-center text-xs text-field-muted">
                  No active risk factor deviations recorded.
                </div>
              )}
            </div>

            {/* System Recommended Proposals */}
            <div className="bg-field-surface border border-field-border rounded-lg p-5">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-field-border">
                <FileCheck className="w-4 h-4 text-readiness-green" />
                <h2 className="text-sm font-bold text-field-primary">
                  System Suggested Operational Actions
                </h2>
              </div>

              {riskDetail.recommendations && riskDetail.recommendations.length > 0 ? (
                <div className="space-y-2.5">
                  {riskDetail.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3.5 bg-field-surface-subtle border border-field-border rounded space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-readiness-green uppercase tracking-normal">
                          {rec.recommendation_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-field-muted">
                          {new Date(rec.generated_at).toLocaleDateString()}
                        </span>
                      </div>
                      {rec.rationale && (
                        <p className="text-xs text-field-primary leading-relaxed">
                          {rec.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-field-surface-subtle border border-field-border rounded text-center text-xs text-field-muted">
                  Standard operational protocol active. No immediate clinical escalation required.
                </div>
              )}
            </div>

            {/* Recorded Intervention Audit Log */}
            {interventionsList.length > 0 && (
              <div className="bg-field-surface border border-field-border rounded-lg p-5">
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-field-border">
                  <Clock className="w-4 h-4 text-field-muted" />
                  <h2 className="text-sm font-bold text-field-primary">
                    Logged Officer Interventions
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {interventionsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-field-surface-subtle border border-field-border rounded space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-field-primary">
                          {item.intervention_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-field-muted text-[11px]">
                          {new Date(item.recorded_at).toLocaleString()}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-field-muted bg-field-surface p-2.5 rounded border border-field-border text-xs leading-relaxed">
                          {item.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-field-muted">
                        <span>Logged by Officer: {item.recorded_by_person_id?.slice(0, 8)}...</span>
                        {item.alert_status && (
                          <span className="px-1.5 py-0.5 rounded bg-field-border text-field-primary font-medium uppercase text-[10px]">
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

          {/* Right 5 Cols: Intervention Recording Console */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-field-surface border border-field-border rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-field-border">
                <div>
                  <h3 className="text-sm font-bold text-field-primary">
                    Record Officer Intervention
                  </h3>
                  <p className="text-[11px] text-field-muted">Formal action entry and alert state transition</p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                  POST /interventions
                </span>
              </div>

              {submitSuccess && (
                <div className="mb-4 p-3 bg-triage-green-bg border border-triage-green-border rounded text-readiness-green text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Action Recorded Successfully</span>
                  </div>
                  <p className="text-[11px]">{submitSuccess}</p>
                </div>
              )}

              {formError && (
                <div className="mb-4 p-3 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRecordIntervention} className="space-y-4">
                {/* Intervention Presets */}
                <div>
                  <label className="block text-xs font-semibold text-field-primary mb-1.5">
                    Select Standard Welfare Action
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {INTERVENTION_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      const isSelected = selectedType === preset.type;
                      return (
                        <button
                          key={preset.type}
                          type="button"
                          onClick={() => setSelectedType(preset.type)}
                          className={`p-2.5 rounded border text-left transition-colors flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-command-blue text-white border-blue-400 font-semibold'
                              : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className="w-3.5 h-3.5" />
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-xs leading-tight">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Alert Status */}
                <div>
                  <label className="block text-xs font-semibold text-field-primary mb-1.5">
                    Target Alert Resolution Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetStatus('resolved')}
                      className={`p-2 rounded border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        targetStatus === 'resolved'
                          ? 'bg-triage-green-bg border-triage-green-border text-readiness-green'
                          : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetStatus('acknowledged')}
                      className={`p-2 rounded border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        targetStatus === 'acknowledged'
                          ? 'bg-triage-amber-bg border-triage-amber-border text-triage-amber'
                          : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Keep In Review</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-field-muted mt-1">
                    {targetStatus === 'resolved'
                      ? 'Resolving this alert removes it from the active Open triage queue.'
                      : 'Retains this case for ongoing clinical follow-up.'}
                  </p>
                </div>

                {/* Clinical Notes */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-field-primary">
                      Intervention Notes & Rationale
                    </label>
                    <span className="text-[11px] text-field-muted">Encrypted at rest</span>
                  </div>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Document discussion points, clinical recommendations, follow-up timelines, or duty adjustments..."
                    className="w-full bg-field-surface-subtle border border-field-border rounded p-2.5 text-xs text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue resize-none"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || !activeAlert}
                  className="w-full py-2.5 px-4 bg-command-blue hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Commit Intervention & Update Case</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-field-border text-[11px] text-field-muted flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-field-muted shrink-0" />
                <span>Officer Audit Attribution: ID {user?.claims.person_id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
