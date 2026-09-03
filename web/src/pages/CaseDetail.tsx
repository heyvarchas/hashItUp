import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Info,
  Calendar,
  Activity,
  FileCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface RiskAssessmentDetail {
  id: string;
  pseudonymous_id: string;
  computed_at: string;
  probability_score: number;
  calibrated_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  contributing_factors: string[];
  rule_flags?: Record<string, any>;
  recommendations?: Array<{
    id: string;
    risk_score_id: string;
    recommendation_type: string;
    rationale?: string;
    generated_at: string;
  }>;
}

export const CaseDetail: React.FC = () => {
  const { pseudonymousId } = useParams<{ pseudonymousId: string }>();
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get('alert_id');

  const { user } = useAuth();
  const navigate = useNavigate();

  const [riskDetail, setRiskDetail] = useState<RiskAssessmentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCaseDetail = async () => {
    if (!user || !pseudonymousId) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`http://localhost:8000/personnel/${pseudonymousId}/risk`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load case detail (${res.status} ${res.statusText})`);
      }

      const data: RiskAssessmentDetail = await res.json();
      setRiskDetail(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching personnel case assessment.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCaseDetail();
  }, [pseudonymousId, user]);

  const getRiskCategoryBadge = (category: string) => {
    switch (category) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Flame className="w-3.5 h-3.5" /> Critical Risk
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

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    if (score >= 65) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (score >= 35) return 'text-blue-400 border-blue-500/40 bg-blue-500/10';
    return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Navigation and Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/welfare/alerts')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Alerts Queue
        </button>

        <button
          onClick={fetchCaseDetail}
          disabled={isRefreshing}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold transition flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Case
        </button>
      </div>

      {/* Case Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Clinical Triage View
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Case Detail
            </h1>
            <p className="text-slate-400 font-mono text-xs">
              Pseudonymous ID: <span className="text-slate-200 font-semibold">{pseudonymousId}</span>
            </p>
            {alertId && (
              <p className="text-slate-500 text-xs">
                Active Alert ID: <span className="font-mono text-slate-400">{alertId}</span>
              </p>
            )}
          </div>

          {riskDetail && (
            <div className="flex items-center gap-4">
              <div className={`w-24 h-24 rounded-2xl border flex flex-col items-center justify-center p-2 shadow-inner ${getScoreColor(riskDetail.calibrated_score)}`}>
                <span className="text-3xl font-black">{riskDetail.calibrated_score}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Score / 100</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Triage Tier</span>
                <div>{getRiskCategoryBadge(riskDetail.risk_category)}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  <span>Computed: {new Date(riskDetail.computed_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
          <div className="w-9 h-9 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium text-slate-400">Loading comprehensive case risk model...</p>
        </div>
      ) : riskDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Clinical Contributing Factors & Recommended Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contributing Factors */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Clinical & Operational Contributing Factors</h2>
              </div>

              {riskDetail.contributing_factors && riskDetail.contributing_factors.length > 0 ? (
                <div className="space-y-3">
                  {riskDetail.contributing_factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl flex items-start gap-3.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs sm:text-sm font-semibold text-slate-200">
                          {factor}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No significant risk factor flags.</p>
              )}
            </div>

            {/* Recommended Clinical / Operational Actions */}
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
                      className="p-4 bg-slate-950/70 border border-emerald-500/20 rounded-2xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 capitalize">
                          {rec.recommendation_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500">
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
                <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl">
                  <p className="text-xs text-slate-400">
                    Standard routine monitoring protocol applies. No urgent escalations required.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Case Summary & Ready for Phase 9.2 Interventions */}
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Triage Overview
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Model Probability</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {(riskDetail.probability_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Calibrated Score</span>
                  <span className="font-bold text-slate-200">{riskDetail.calibrated_score} / 100</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">De-identification</span>
                  <span className="text-emerald-400 font-medium">Active (Zero PII)</span>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Confidential Protocol
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Actions recorded here will be strictly attributed to your officer account in the immutable audit log.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
