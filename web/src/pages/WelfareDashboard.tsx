import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RefreshCw,
  AlertTriangle,
  Lock,
  AlertCircle,
  Search,
  Users,
  ArrowRight,
  ClipboardList,
  CheckCircle,
  XCircle,
  Sparkles,
  Eye,
  X
} from 'lucide-react';
import { API_BASE_URL } from '../config';
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

interface PendingChangeRequest {
  request_id: string;
  person_id: string;
  request_type: string;
  request_details: Record<string, any>;
  reason: string;
  status: string;
  risk_score_at_submission: number;
  stress_score_at_submission: number;
  contributing_factors_at_submission?: Array<{
    raw_feature?: string;
    display_name: string;
    points_impact: number;
    impact_direction?: string;
    actual_value?: any;
  }>;
  system_recommendation: string;
  recommendation_reason?: string;
  officer_decision?: string;
  officer_reason?: string;
  submitted_at: string;
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
  const [requestsList, setRequestsList] = useState<PendingChangeRequest[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('PENDING');
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>('ALL');
  const [requestRiskFilter, setRequestRiskFilter] = useState<string>('ALL');
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState<PendingChangeRequest | null>(null);
  const [detailPersonnelInfo, setDetailPersonnelInfo] = useState<any | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filtering States for Roster
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  const fetchData = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch aggregate statistics
      const resSummary = await fetch(`${API_BASE_URL}/dashboard/unit-summary`, {
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
      const resPersonnel = await fetch(`${API_BASE_URL}/api/personnel`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (resPersonnel.ok) {
        const pList: PersonnelRow[] = await resPersonnel.json();
        setPersonnelList(pList);
      }

      // 3. Fetch change requests for welfare officer
      const resReqs = await fetch(`${API_BASE_URL}/requests`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (resReqs.ok) {
        const reqsData: PendingChangeRequest[] = await resReqs.json();
        setRequestsList(reqsData);
      } else {
        // Fallback to /requests/pending if /requests not available
        const fallbackRes = await fetch(`${API_BASE_URL}/requests/pending`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          setRequestsList(fbData);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while loading unit summary statistics.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleOpenDetailModal = async (req: PendingChangeRequest) => {
    setSelectedRequestForDetail(req);
    try {
      const res = await fetch(`${API_BASE_URL}/api/personnel/${req.person_id}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailPersonnelInfo(data);
      } else {
        setDetailPersonnelInfo(null);
      }
    } catch {
      setDetailPersonnelInfo(null);
    }
  };

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    const reason = (rejectionReasons[requestId] || '').trim();
    if (decision === 'REJECTED' && !reason) {
      alert('Please enter a specific rejection reason for the personnel.');
      return;
    }

    setDecidingId(requestId);
    setActionSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/requests/${requestId}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          decision,
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to submit decision.');
      }

      await res.json();
      setActionSuccessMsg(`Request successfully ${decision === 'APPROVED' ? 'approved' : 'rejected'}. Employee notified.`);
      // Update requests list
      setRequestsList((prev) =>
        prev.map((r) => (r.request_id === requestId ? { ...r, status: decision, officer_decision: decision, officer_reason: reason } : r))
      );
      if (selectedRequestForDetail?.request_id === requestId) {
        setSelectedRequestForDetail((prev) => (prev ? { ...prev, status: decision, officer_decision: decision, officer_reason: reason } : null));
      }
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Decision error: ${err.message}`);
    } finally {
      setDecidingId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Filter requests
  const filteredRequests = requestsList.filter((r) => {
    if (requestStatusFilter !== 'ALL' && r.status !== requestStatusFilter) return false;
    if (requestTypeFilter !== 'ALL' && r.request_type !== requestTypeFilter) return false;
    if (requestRiskFilter !== 'ALL') {
      const isHigh = r.risk_score_at_submission >= 65;
      const isModerate = r.risk_score_at_submission >= 40 && r.risk_score_at_submission < 65;
      const isLow = r.risk_score_at_submission < 40;
      if (requestRiskFilter === 'HIGH' && !isHigh) return false;
      if (requestRiskFilter === 'MODERATE' && !isModerate) return false;
      if (requestRiskFilter === 'LOW' && !isLow) return false;
    }
    return true;
  });

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
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-blue-bg text-triage-blue border border-triage-blue-border">
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

  // Accurately derive population counts across Low, Moderate, High, and Critical tiers
  const totalCount = personnelList.length > 0 ? personnelList.length : (summaryData?.total_personnel || 0);

  const lowCount = personnelList.length > 0
    ? personnelList.filter((p) => p.risk_category.toUpperCase() === 'LOW').length
    : (summaryData?.low_count || 0);

  const moderateCount = personnelList.length > 0
    ? personnelList.filter((p) => p.risk_category.toUpperCase() === 'MODERATE').length
    : (summaryData?.moderate_count || 0);

  const highCount = personnelList.length > 0
    ? personnelList.filter((p) => p.risk_category.toUpperCase() === 'HIGH').length
    : (summaryData?.high_count || 0);

  const criticalCount = personnelList.length > 0
    ? personnelList.filter((p) => p.risk_category.toUpperCase() === 'CRITICAL').length
    : (summaryData?.critical_count || 0);

  const lowPercent = totalCount > 0 ? ((lowCount / totalCount) * 100).toFixed(1) : '0.0';
  const moderatePercent = totalCount > 0 ? ((moderateCount / totalCount) * 100).toFixed(1) : '0.0';
  const highPercent = totalCount > 0 ? ((highCount / totalCount) * 100).toFixed(1) : '0.0';
  const criticalPercent = totalCount > 0 ? ((criticalCount / totalCount) * 100).toFixed(1) : '0.0';

  // Minimalistic distribution list matching the exact 4 tiers
  const activeDistribution: RiskCategoryStat[] = [
    {
      category: 'low',
      label: 'Low Risk',
      count: lowCount,
      percentage: Number(lowPercent),
      color: '#2E8B68',
    },
    {
      category: 'moderate',
      label: 'Moderate Risk',
      count: moderateCount,
      percentage: Number(moderatePercent),
      color: '#2965A8',
    },
    {
      category: 'high',
      label: 'High Risk',
      count: highCount,
      percentage: Number(highPercent),
      color: '#C97A1E',
    },
    {
      category: 'critical',
      label: 'Critical Urgency',
      count: criticalCount,
      percentage: Number(criticalPercent),
      color: '#D6453D',
    },
  ];

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

      {/* Action Success Notification */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-triage-green-bg border border-triage-green-border rounded flex items-center gap-2 text-readiness-green text-xs font-semibold">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* CHANGE REQUESTS SECTION */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-field-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40">
                Decision Support
              </span>
              <span className="text-xs text-field-muted">Welfare Officer Authority Required</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-field-primary flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-command-blue" />
              <span>Pending Requests ({filteredRequests.filter((r) => r.status === 'PENDING').length} Pending / {filteredRequests.length} Total)</span>
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Review personnel requests for leave, work hours, unit transfers, or shift rotations with ML risk context and TreeSHAP attribution.
            </p>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={requestStatusFilter}
              onChange={(e) => setRequestStatusFilter(e.target.value)}
              className="bg-field-surface border border-field-border rounded px-2.5 py-1.5 text-field-primary focus:outline-none focus:border-command-blue"
            >
              <option value="ALL">Status: All</option>
              <option value="PENDING">Status: Pending</option>
              <option value="APPROVED">Status: Approved</option>
              <option value="REJECTED">Status: Rejected</option>
            </select>

            {/* Request Type Filter */}
            <select
              value={requestTypeFilter}
              onChange={(e) => setRequestTypeFilter(e.target.value)}
              className="bg-field-surface border border-field-border rounded px-2.5 py-1.5 text-field-primary focus:outline-none focus:border-command-blue"
            >
              <option value="ALL">Type: All</option>
              <option value="leave">Leave</option>
              <option value="work_hours">Work Hours</option>
              <option value="transfer">Transfer</option>
              <option value="day_to_night">Day → Night</option>
              <option value="night_to_day">Night → Day</option>
            </select>

            {/* Risk Level Filter */}
            <select
              value={requestRiskFilter}
              onChange={(e) => setRequestRiskFilter(e.target.value)}
              className="bg-field-surface border border-field-border rounded px-2.5 py-1.5 text-field-primary focus:outline-none focus:border-command-blue"
            >
              <option value="ALL">Risk: All</option>
              <option value="HIGH">Risk: High (≥65)</option>
              <option value="MODERATE">Risk: Moderate (40-64)</option>
              <option value="LOW">Risk: Low (&lt;40)</option>
            </select>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-6 text-center bg-field-surface-subtle border border-field-border rounded text-xs text-field-muted">
            ✓ No requests match the selected filters.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const formatTypeLabel = () => {
                if (req.request_type === 'leave') return 'LEAVE';
                if (req.request_type === 'work_hours') return 'WORK HOURS';
                if (req.request_type === 'transfer') return 'TRANSFER';
                if (req.request_type === 'day_to_night') return 'DAY → NIGHT';
                if (req.request_type === 'night_to_day') return 'NIGHT → DAY';
                return req.request_type.replace('_', ' ').toUpperCase();
              };
              const reqLabel = formatTypeLabel();
              const isRejecting = showRejectInput[req.request_id];
              const formatDetails = () => {
                if (req.request_type === 'leave') {
                  return `${req.request_details?.leave_days ?? 5} Days (${req.request_details?.leave_type ?? 'Casual Leave'})`;
                }
                if (req.request_type === 'work_hours') {
                  return `Current: ${req.request_details?.current_hours ?? 10} hrs/day → Requested: ${req.request_details?.requested_hours ?? 8} hrs/day`;
                }
                if (req.request_type === 'transfer') {
                  const fromU = req.request_details?.current_posting || 'Current Unit';
                  const toU = req.request_details?.requested_posting || req.request_details?.preferred_transfer_unit_location || 'Requested Unit';
                  return `Current: ${fromU} → Requested: ${toU}`;
                }
                if (req.request_type === 'day_to_night') {
                  return 'Current Shift: Day → Requested Shift: Night';
                }
                if (req.request_type === 'night_to_day') {
                  return 'Current Shift: Night → Requested Shift: Day';
                }
                if (req.request_type === 'shift_change') {
                  return `Requested: ${req.request_details?.requested_shift ?? 'Schedule Change'}`;
                }
                return JSON.stringify(req.request_details);
              };

              // Determine recommendation styling
              const isRecApprove = req.system_recommendation.includes('APPROVE') || req.system_recommendation.toLowerCase().includes('consider');
              const isRecReject = req.system_recommendation.includes('REJECT') || req.system_recommendation.toLowerCase().includes('carefully');

              return (
                <div
                  key={req.request_id}
                  className="p-5 bg-field-surface-subtle border border-field-border rounded-lg space-y-4 hover:border-field-primary/30 transition-colors"
                >
                  {/* Card Header: Employee & Request summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-field-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-field-border flex items-center justify-center font-mono font-bold text-xs text-command-blue">
                        {req.person_id.slice(-4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-field-primary font-mono">
                            Personnel: {req.person_id}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-command-blue/15 text-command-blue font-semibold border border-command-blue/30">
                            {reqLabel}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              req.status === 'APPROVED'
                                ? 'bg-readiness-green/15 text-readiness-green border-readiness-green/30'
                                : req.status === 'REJECTED'
                                ? 'bg-triage-red/15 text-triage-red border-triage-red/30'
                                : 'bg-triage-amber/15 text-triage-amber border-triage-amber/30'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div className="text-xs text-field-primary font-semibold mt-0.5">
                          Request: <span className="text-field-muted font-normal">{formatDetails()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-field-muted block text-[11px]">Welfare Risk</span>
                        <span className="font-bold text-sm text-field-primary">
                          {req.risk_score_at_submission} / 100
                          <span className={`ml-1.5 text-[10px] uppercase font-bold ${
                            req.risk_score_at_submission >= 65 ? 'text-triage-red' : 'text-triage-amber'
                          }`}>
                            {req.risk_score_at_submission >= 65 ? '— HIGH' : '— MODERATE'}
                          </span>
                        </span>
                      </div>
                      <div className="text-right border-l border-field-border pl-4">
                        <span className="text-field-muted block text-[11px]">Stress</span>
                        <span className="font-bold text-sm text-triage-amber">
                          {req.stress_score_at_submission} / 10
                          <span className="ml-1 text-[10px] font-semibold text-field-muted">
                            {req.stress_score_at_submission >= 6 ? '— HIGH' : ''}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reason & SHAP Contributing Factors */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                    <div className="md:col-span-6 space-y-2">
                      <span className="text-field-muted font-semibold block">Personnel Stated Reason:</span>
                      <p className="p-3 bg-field-surface border border-field-border rounded text-field-primary leading-relaxed">
                        "{req.reason}"
                      </p>
                      {req.request_details?.additional_note && (
                        <p className="text-[11px] text-field-muted italic">
                          Additional note: {req.request_details.additional_note}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-6 space-y-2">
                      <span className="text-field-muted font-semibold block">Main Factors (Risk Attribution):</span>
                      <div className="space-y-1.5 bg-field-surface border border-field-border p-3 rounded">
                        {req.contributing_factors_at_submission && req.contributing_factors_at_submission.length > 0 ? (
                          req.contributing_factors_at_submission.slice(0, 4).map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className="text-field-primary">{f.display_name}</span>
                              <span className={`font-mono font-semibold ${f.points_impact >= 0 ? 'text-triage-red' : 'text-readiness-green'}`}>
                                {f.points_impact >= 0 ? `+${f.points_impact}` : f.points_impact}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-field-muted text-[11px]">No acute fatigue factors flagged.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* System Decision-Support Recommendation */}
                  <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRecApprove
                      ? 'bg-triage-green-bg/60 border-triage-green-border'
                      : isRecReject
                      ? 'bg-triage-amber-bg/60 border-triage-amber-border'
                      : 'bg-field-surface border-field-border'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-command-blue" />
                        <span className="text-xs font-bold uppercase tracking-wide text-field-primary">
                          Recommendation:
                        </span>
                        <span className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                          isRecApprove
                            ? 'bg-readiness-green/20 text-readiness-green'
                            : 'bg-triage-amber/20 text-triage-amber'
                        }`}>
                          {req.system_recommendation}
                        </span>
                      </div>
                      <p className="text-xs text-field-primary leading-relaxed">
                        Reason: {req.recommendation_reason}
                      </p>
                    </div>

                    {/* Officer Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(req)}
                        className="px-3 py-2 bg-field-surface hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-command-blue" />
                        <span>View Details</span>
                      </button>

                      {req.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={decidingId === req.request_id}
                            onClick={() => handleDecision(req.request_id, 'APPROVED')}
                            className="px-3.5 py-2 bg-readiness-green hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            disabled={decidingId === req.request_id}
                            onClick={() => {
                              setShowRejectInput((prev) => ({
                                ...prev,
                                [req.request_id]: !prev[req.request_id],
                              }));
                            }}
                            className="px-3 py-2 bg-field-surface hover:bg-triage-red-bg text-triage-red border border-triage-red-border rounded text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject...</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rejection Reason Input Panel */}
                  {isRejecting && req.status === 'PENDING' && (
                    <div className="p-3.5 bg-field-surface border border-triage-red-border/60 rounded-lg space-y-2">
                      <label className="text-xs font-semibold text-triage-red block">
                        Rejection Reason (Required for Personnel Notification):
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Current operational requirements do not permit the requested schedule change at this time."
                          value={rejectionReasons[req.request_id] || ''}
                          onChange={(e) =>
                            setRejectionReasons((prev) => ({
                              ...prev,
                              [req.request_id]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-field-surface-subtle border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-triage-red"
                        />
                        <button
                          type="button"
                          disabled={decidingId === req.request_id}
                          onClick={() => handleDecision(req.request_id, 'REJECTED')}
                          className="px-4 py-1.5 bg-triage-red hover:bg-red-700 text-white rounded text-xs font-bold transition-colors shrink-0 disabled:opacity-50"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Resolved Decision Note (if decided) */}
                  {req.status !== 'PENDING' && (
                    <div className="p-3 bg-field-surface rounded border border-field-border text-xs text-field-muted flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-field-primary">Officer Decision:</span>{' '}
                        <span className={req.status === 'APPROVED' ? 'text-readiness-green font-bold' : 'text-triage-red font-bold'}>
                          {req.status}
                        </span>
                        {req.officer_reason && <span className="ml-2">— Reason: "{req.officer_reason}"</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REQUEST DETAIL VIEW MODAL */}
      {selectedRequestForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-field-surface border border-field-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-field-border flex items-center justify-between bg-field-surface-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-command-blue/20 text-command-blue flex items-center justify-center font-mono font-bold text-sm">
                  {selectedRequestForDetail.person_id.slice(-4)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-field-primary flex items-center gap-2">
                    <span>Request Details — {selectedRequestForDetail.person_id}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        selectedRequestForDetail.status === 'APPROVED'
                          ? 'bg-readiness-green/15 text-readiness-green border-readiness-green/30'
                          : selectedRequestForDetail.status === 'REJECTED'
                          ? 'bg-triage-red/15 text-triage-red border-triage-red/30'
                          : 'bg-triage-amber/15 text-triage-amber border-triage-amber/30'
                      }`}
                    >
                      {selectedRequestForDetail.status}
                    </span>
                  </h3>
                  <p className="text-xs text-field-muted mt-0.5">
                    Submitted: {new Date(selectedRequestForDetail.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequestForDetail(null)}
                className="p-1.5 text-field-muted hover:text-field-primary rounded-lg hover:bg-field-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-field-primary">
              {/* 1. Request Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-field-muted flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-command-blue" />
                  <span>Request Information</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-field-surface-subtle p-4 rounded-lg border border-field-border">
                  <div>
                    <span className="text-field-muted block text-[11px]">Request Type</span>
                    <span className="font-semibold text-field-primary text-sm uppercase">
                      {selectedRequestForDetail.request_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-field-muted block text-[11px]">Personnel ID</span>
                    <span className="font-mono font-bold text-field-primary text-sm">
                      {selectedRequestForDetail.person_id}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-field-muted block text-[11px]">Requested Change Details</span>
                    <span className="font-semibold text-field-primary">
                      {selectedRequestForDetail.request_type === 'leave' &&
                        `${selectedRequestForDetail.request_details?.leave_days ?? 5} Days (${selectedRequestForDetail.request_details?.leave_type ?? 'Casual Leave'})`}
                      {selectedRequestForDetail.request_type === 'work_hours' &&
                        `Current: ${selectedRequestForDetail.request_details?.current_hours ?? 10} hrs/day → Requested: ${selectedRequestForDetail.request_details?.requested_hours ?? 8} hrs/day`}
                      {selectedRequestForDetail.request_type === 'transfer' &&
                        `Current Posting: ${selectedRequestForDetail.request_details?.current_posting || 'Current Unit'} → Requested Posting: ${selectedRequestForDetail.request_details?.requested_posting || selectedRequestForDetail.request_details?.preferred_transfer_unit_location || 'Requested Unit'}`}
                      {selectedRequestForDetail.request_type === 'day_to_night' && 'Current Shift: Day → Requested Shift: Night'}
                      {selectedRequestForDetail.request_type === 'night_to_day' && 'Current Shift: Night → Requested Shift: Day'}
                      {selectedRequestForDetail.request_type === 'shift_change' &&
                        `Requested: ${selectedRequestForDetail.request_details?.requested_shift}`}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-field-muted block text-[11px]">Stated Reason</span>
                    <p className="mt-1 p-2.5 bg-field-surface border border-field-border rounded text-field-primary">
                      "{selectedRequestForDetail.reason}"
                    </p>
                  </div>
                  {selectedRequestForDetail.request_details?.additional_note && (
                    <div className="sm:col-span-2">
                      <span className="text-field-muted block text-[11px]">Additional Note</span>
                      <p className="mt-1 text-field-muted italic">
                        {selectedRequestForDetail.request_details.additional_note}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Current Welfare Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-field-muted flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-triage-amber" />
                  <span>Current Welfare Status</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-field-surface-subtle border border-field-border rounded-lg text-center">
                    <span className="text-[11px] text-field-muted block">Stress Score</span>
                    <span className="text-xl font-bold text-triage-amber mt-0.5 block">
                      {detailPersonnelInfo?.wellness?.stress_score ?? selectedRequestForDetail.stress_score_at_submission} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-field-surface-subtle border border-field-border rounded-lg text-center">
                    <span className="text-[11px] text-field-muted block">Welfare Risk</span>
                    <span className="text-xl font-bold text-field-primary mt-0.5 block">
                      {detailPersonnelInfo?.welfare_risk?.welfare_risk_score ?? selectedRequestForDetail.risk_score_at_submission} / 100
                    </span>
                  </div>
                  <div className="p-3 bg-field-surface-subtle border border-field-border rounded-lg text-center">
                    <span className="text-[11px] text-field-muted block">Risk Category</span>
                    <span className="text-sm font-bold text-triage-red mt-1.5 block">
                      {detailPersonnelInfo?.welfare_risk?.risk_category ?? (selectedRequestForDetail.risk_score_at_submission >= 65 ? 'HIGH' : 'MODERATE')}
                    </span>
                  </div>
                  <div className="p-3 bg-field-surface-subtle border border-field-border rounded-lg text-center">
                    <span className="text-[11px] text-field-muted block">Sleep / Fatigue</span>
                    <span className="text-sm font-bold text-field-primary mt-1.5 block">
                      {detailPersonnelInfo?.wellness?.sleep_hours ?? 6}h / Fatigue: {detailPersonnelInfo?.wellness?.fatigue_score ?? 6}/10
                    </span>
                  </div>
                </div>

                {/* Additional metrics if personnel info is loaded */}
                {detailPersonnelInfo && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-field-muted bg-field-surface-subtle p-3 rounded-lg border border-field-border">
                    <div>Duty Hours: <strong className="text-field-primary">{detailPersonnelInfo.workload?.duty_hours} hrs/d</strong></div>
                    <div>Shift: <strong className="text-field-primary">{detailPersonnelInfo.workload?.shift_type}</strong></div>
                    <div>Days Since Leave: <strong className="text-field-primary">{detailPersonnelInfo.leave?.days_since_last_leave} days</strong></div>
                    <div>Posting/Unit: <strong className="text-field-primary">{detailPersonnelInfo.personnel?.unit_id}</strong></div>
                  </div>
                )}
              </div>

              {/* 3. Model Explanation (SHAP Factors) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-field-muted flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-command-blue" />
                  <span>Factors Contributing to Current Risk (Explainable ML Attribution)</span>
                </h4>
                <div className="space-y-2 bg-field-surface-subtle p-4 rounded-lg border border-field-border">
                  {selectedRequestForDetail.contributing_factors_at_submission && selectedRequestForDetail.contributing_factors_at_submission.length > 0 ? (
                    selectedRequestForDetail.contributing_factors_at_submission.slice(0, 5).map((factor, idx) => {
                      const impact = factor.points_impact;
                      const widthPercent = Math.min(100, Math.max(15, Math.abs(impact) * 4));
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-field-primary">{factor.display_name}</span>
                            <span className={`font-mono font-bold ${impact >= 0 ? 'text-triage-red' : 'text-readiness-green'}`}>
                              {impact >= 0 ? `+${impact}` : impact}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-field-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${impact >= 0 ? 'bg-triage-red' : 'bg-readiness-green'}`}
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-field-muted">No specific factor contributions recorded at submission.</p>
                  )}
                </div>
              </div>

              {/* 4. Decision Support Recommendation */}
              <div className="p-4 bg-command-blue/10 border border-command-blue/30 rounded-lg space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-command-blue" />
                  <span className="text-xs font-bold uppercase tracking-wide text-command-blue">
                    System Decision Support
                  </span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-command-blue/20 text-command-blue">
                    {selectedRequestForDetail.system_recommendation}
                  </span>
                </div>
                <p className="text-xs text-field-primary leading-relaxed">
                  Reason: {selectedRequestForDetail.recommendation_reason}
                </p>
                <p className="text-[11px] text-field-muted italic pt-1">
                  Note: Decision-support recommendations are informative guidance based on current welfare indicators. Final administrative authority belongs to the Welfare Officer.
                </p>
              </div>

              {/* Officer Decision Action Section */}
              {selectedRequestForDetail.status === 'PENDING' ? (
                <div className="p-4 bg-field-surface-subtle border border-field-border rounded-lg space-y-3">
                  <span className="font-bold text-xs text-field-primary block">Welfare Officer Action</span>
                  <div className="space-y-2">
                    <label className="text-xs text-field-muted block">
                      Decision Note / Rejection Reason (Required if rejecting):
                    </label>
                    <input
                      type="text"
                      placeholder="Enter reason or note to personnel..."
                      value={rejectionReasons[selectedRequestForDetail.request_id] || ''}
                      onChange={(e) =>
                        setRejectionReasons((prev) => ({
                          ...prev,
                          [selectedRequestForDetail.request_id]: e.target.value,
                        }))
                      }
                      className="w-full bg-field-surface border border-field-border rounded px-3 py-2 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={decidingId === selectedRequestForDetail.request_id}
                      onClick={() => handleDecision(selectedRequestForDetail.request_id, 'REJECTED')}
                      className="px-4 py-2 bg-triage-red hover:bg-red-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === selectedRequestForDetail.request_id}
                      onClick={() => handleDecision(selectedRequestForDetail.request_id, 'APPROVED')}
                      className="px-5 py-2 bg-readiness-green hover:bg-emerald-600 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Approve Request
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-field-surface-subtle border border-field-border rounded-lg text-xs space-y-1">
                  <div className="font-bold text-field-primary">
                    Officer Decision: <span className={selectedRequestForDetail.status === 'APPROVED' ? 'text-readiness-green' : 'text-triage-red'}>{selectedRequestForDetail.status}</span>
                  </div>
                  {selectedRequestForDetail.officer_reason && (
                    <div className="text-field-muted">
                      Reason: "{selectedRequestForDetail.officer_reason}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-field-border flex justify-end bg-field-surface-subtle">
              <button
                type="button"
                onClick={() => setSelectedRequestForDetail(null)}
                className="px-4 py-2 bg-field-border hover:bg-field-border/80 text-field-primary rounded text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-16 bg-field-surface border border-field-border rounded-lg flex flex-col items-center justify-center text-field-muted">
          <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
          <p className="text-xs">Loading unit distribution metrics & personnel roster...</p>
        </div>
      ) : summaryData ? (
        <div className="space-y-6">
          {/* Minimalistic Population Risk Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Monitored */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-field-primary/20">
              <span className="text-xs font-medium text-field-muted block">
                Total Personnel
              </span>
              <div className="mt-1.5 text-2xl sm:text-3xl font-bold text-field-primary tracking-tight">
                {totalCount}
              </div>
              <p className="text-[11px] text-field-muted mt-1">100% active monitored unit</p>
            </div>

            {/* Low Risk Card */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-readiness-green/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-readiness-green flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-readiness-green" />
                  Low Risk
                </span>
                <span className="text-[11px] font-mono text-field-muted">&lt; 35 score</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-readiness-green">
                  {lowCount}
                </span>
                <span className="text-xs text-field-muted font-mono">
                  ({lowPercent}%)
                </span>
              </div>
              <p className="text-[11px] text-field-muted mt-1">Nominal baseline readiness</p>
            </div>

            {/* Moderate Risk Card */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-command-blue/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-command-blue flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-command-blue" />
                  Moderate Risk
                </span>
                <span className="text-[11px] font-mono text-field-muted">35 - 64 score</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-command-blue">
                  {moderateCount}
                </span>
                <span className="text-xs text-field-muted font-mono">
                  ({moderatePercent}%)
                </span>
              </div>
              <p className="text-[11px] text-field-muted mt-1">Routine monitoring tier</p>
            </div>

            {/* High & Critical Risk Card */}
            <div className="bg-field-surface border border-field-border rounded-lg p-4 transition-all hover:border-triage-red/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-triage-red flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-triage-red" />
                  High & Critical Risk
                </span>
                <span className="text-[11px] font-mono text-field-muted">&ge; 65 score</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-triage-red">
                  {highCount + criticalCount}
                </span>
                <span className="text-xs text-field-muted font-mono">
                  ({(Number(highPercent) + Number(criticalPercent)).toFixed(1)}%)
                </span>
              </div>
              <p className="text-[11px] text-field-muted mt-1">
                {highCount} high + {criticalCount} critical urgency
              </p>
            </div>
          </div>

          {/* Minimalistic Risk Distribution Overview */}
          <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-field-primary">
                  Personnel Welfare Risk Distribution
                </h2>
                <p className="text-xs text-field-muted mt-0.5">
                  Proportionate distribution of personnel across predictive risk categories.
                </p>
              </div>

              {/* Minimalistic inline stats badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2E8B68]" />
                  <span className="text-field-muted">Low:</span>
                  <strong className="text-field-primary">{lowCount}</strong>
                  <span className="text-field-muted">({lowPercent}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2965A8]" />
                  <span className="text-field-muted">Moderate:</span>
                  <strong className="text-field-primary">{moderateCount}</strong>
                  <span className="text-field-muted">({moderatePercent}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#C97A1E]" />
                  <span className="text-field-muted">High:</span>
                  <strong className="text-field-primary">{highCount}</strong>
                  <span className="text-field-muted">({highPercent}%)</span>
                </div>
                {criticalCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D6453D]" />
                    <span className="text-field-muted">Critical:</span>
                    <strong className="text-field-primary">{criticalCount}</strong>
                    <span className="text-field-muted">({criticalPercent}%)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Minimalistic Multi-segment Progress Bar */}
            <div className="w-full bg-field-surface-subtle border border-field-border rounded-full h-3.5 overflow-hidden flex shadow-inner">
              {lowCount > 0 && (
                <div
                  style={{ width: `${lowPercent}%` }}
                  className="bg-[#2E8B68] h-full transition-all duration-500 hover:opacity-90"
                  title={`Low Risk: ${lowCount} personnel (${lowPercent}%)`}
                />
              )}
              {moderateCount > 0 && (
                <div
                  style={{ width: `${moderatePercent}%` }}
                  className="bg-[#2965A8] h-full transition-all duration-500 hover:opacity-90"
                  title={`Moderate Risk: ${moderateCount} personnel (${moderatePercent}%)`}
                />
              )}
              {highCount > 0 && (
                <div
                  style={{ width: `${highPercent}%` }}
                  className="bg-[#C97A1E] h-full transition-all duration-500 hover:opacity-90"
                  title={`High Risk: ${highCount} personnel (${highPercent}%)`}
                />
              )}
              {criticalCount > 0 && (
                <div
                  style={{ width: `${criticalPercent}%` }}
                  className="bg-[#D6453D] h-full transition-all duration-500 hover:opacity-90"
                  title={`Critical Urgency: ${criticalCount} personnel (${criticalPercent}%)`}
                />
              )}
            </div>

            {/* Bar Chart Container */}
            <div className="w-full h-44 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeDistribution}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--color-field-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-field-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-field-border)' }}
                  />
                  <YAxis
                    stroke="var(--color-field-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-field-border)' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'var(--color-field-surface-subtle)' }} />
                  <Bar
                    dataKey="count"
                    radius={[3, 3, 0, 0]}
                    barSize={40}
                    isAnimationActive={true}
                  >
                    {activeDistribution.map((entry) => (
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
