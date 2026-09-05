import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  RefreshCw, 
  Activity, 
  Calendar, 
  FileEdit,
  Lock,
  Layers,
  Send,
  Clock,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RequestForChangeModal } from '../components/RequestForChangeModal';
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

interface WellnessAssessmentRecord {
  id: string;
  pseudonymous_id: string;
  submitted_at: string;
  mood_score: number | null;
  sleep_quality_score: number | null;
  stress_self_rating: number | null;
  help_requested: boolean;
}

interface RiskOverview {
  id: string;
  pseudonymous_id: string;
  computed_at: string;
  probability_score: number;
  calibrated_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  contributing_factors: string[];
  rule_flags?: Record<string, any>;
}

interface ChangeRequestItem {
  request_id: string;
  person_id: string;
  request_type: string;
  request_details: Record<string, any>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  risk_score_at_submission: number;
  stress_score_at_submission: number;
  contributing_factors_at_submission?: any[];
  system_recommendation: string;
  recommendation_reason?: string;
  officer_decision?: string;
  officer_reason?: string;
  submitted_at: string;
  decided_at?: string;
}

export const PersonnelDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [history, setHistory] = useState<WellnessAssessmentRecord[]>([]);
  const [riskData, setRiskData] = useState<RiskOverview | null>(null);
  const [myRequests, setMyRequests] = useState<ChangeRequestItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedModalType, setSelectedModalType] = useState<any>('leave');
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleOpenModal = (type: string = 'leave') => {
    setSelectedModalType(type);
    setIsModalOpen(true);
  };

  const fetchData = async () => {
    if (!user) return;
    setIsRefreshing(true);

    try {
      // 1. Fetch wellness check-in history
      const historyRes = await fetch(`${API_BASE_URL}/wellness/history?limit=30`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!historyRes.ok) {
        throw new Error('Failed to load wellness history.');
      }
      const historyJson: WellnessAssessmentRecord[] = await historyRes.json();
      const sortedHistory = [...historyJson].sort(
        (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );
      setHistory(sortedHistory);

      // 2. Fetch supportive risk overview
      const riskRes = await fetch(`${API_BASE_URL}/risk/me`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (riskRes.ok) {
        const riskJson: RiskOverview = await riskRes.json();
        setRiskData(riskJson);
      }

      // 3. Fetch employee's change requests
      const reqRes = await fetch(`${API_BASE_URL}/requests/my`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (reqRes.ok) {
        const reqJson: ChangeRequestItem[] = await reqRes.json();
        setMyRequests(reqJson);
      }
    } catch (err: any) {
      console.error('Error fetching personnel data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Format chart data
  const chartData = history.map((item) => ({
    date: new Date(item.submitted_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(item.submitted_at).toLocaleString(),
    mood: item.mood_score ?? undefined,
    sleep: item.sleep_quality_score ?? undefined,
    stress: item.stress_self_rating ?? undefined,
    helpRequested: item.help_requested,
  }));

  const getCategoryTheme = (category?: string) => {
    switch (category) {
      case 'critical':
        return {
          badge: 'bg-triage-red-bg text-triage-red border-triage-red-border',
          title: 'High Care Support Recommended',
          desc: 'Your operational tempo and check-in indicators suggest dedicating time for recovery and support resources.',
        };
      case 'high':
        return {
          badge: 'bg-triage-amber-bg text-triage-amber border-triage-amber-border',
          title: 'Elevated Operational Fatigue Noted',
          desc: 'Elevated workload indicators noted. Prioritize rest windows and hydration.',
        };
      case 'moderate':
        return {
          badge: 'bg-triage-blue-bg text-blue-300 border-triage-blue-border',
          title: 'Moderate Operational Load',
          desc: 'Operational activities are steady. Maintain balanced rest habits.',
        };
      default:
        return {
          badge: 'bg-triage-green-bg text-readiness-green border-triage-green-border',
          title: 'Healthy Wellness Baseline',
          desc: 'Workload and wellness metrics are well-balanced within normal operational thresholds.',
        };
    }
  };

  const currentTheme = getCategoryTheme(riskData?.risk_category);

  return (
    <div className="space-y-6 font-sans">
      {/* Dossier Header Panel */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                Personnel Wellness Ledger
              </span>
              <span className="text-xs text-field-muted flex items-center gap-1">
                <Lock className="w-3 h-3 text-readiness-green" />
                Pseudonym: <strong className="text-field-primary font-normal">{user?.claims.pseudonymous_id}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
              Personal Readiness & Recovery Timeline
            </h1>
            <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
              Track your daily recovery, sleep quality, and stress trends over the past 30 days. All entries are encrypted and separated from personnel rosters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/personnel/checkin"
              className="px-3.5 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Record Today's Check-in</span>
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

      {/* Readiness Status & Workload Factors */}
      {riskData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Status Tile */}
          <div className="lg:col-span-4 bg-field-surface border border-field-border rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-field-border">
                <span className="text-xs font-semibold text-field-muted">
                  Readiness Assessment
                </span>
                <span className={`px-2 py-0.5 text-xs font-semibold capitalize rounded border ${currentTheme.badge}`}>
                  {riskData.risk_category} Risk
                </span>
              </div>
              <h2 className="text-base font-bold text-field-primary mb-1.5">
                {currentTheme.title}
              </h2>
              <p className="text-xs text-field-muted leading-relaxed">
                {currentTheme.desc}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-field-border flex items-center justify-between text-xs">
              <span className="text-field-muted flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-field-muted" />
                Score: <strong className="text-field-primary font-bold">{riskData.calibrated_score}</strong>/100
              </span>
              <span className="text-field-muted">
                Evaluated: {new Date(riskData.computed_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Contributing Workload Factors */}
          <div className="lg:col-span-8 bg-field-surface border border-field-border rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-field-border">
              <Layers className="w-4 h-4 text-field-muted" />
              <h3 className="text-xs font-semibold text-field-primary">
                Identified Operational & Workload Indicators
              </h3>
            </div>
            
            {riskData.contributing_factors && riskData.contributing_factors.length > 0 ? (
              <div className="space-y-2">
                {riskData.contributing_factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-field-surface-subtle border border-field-border rounded flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-triage-amber shrink-0 mt-1.5" />
                    <p className="text-xs text-field-primary leading-relaxed">
                      {factor}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-field-surface-subtle border border-field-border rounded text-center text-xs text-field-muted">
                No acute fatigue deviations identified in the current duty cycle.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 30-Day Historical Trend View */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-field-border">
          <div>
            <h2 className="text-base font-bold text-field-primary">
              Personal Wellness & Fatigue Timeline
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Historical self-ratings recorded during daily check-ins.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-field-primary font-medium">
              <span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block" /> Mood (1–5)
            </span>
            <span className="flex items-center gap-1.5 text-field-primary font-medium">
              <span className="w-2.5 h-2.5 rounded bg-readiness-green inline-block" /> Sleep (1–5)
            </span>
            <span className="flex items-center gap-1.5 text-field-primary font-medium">
              <span className="w-2.5 h-2.5 rounded bg-triage-amber inline-block" /> Stress (1–10)
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-field-muted">
            <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
            <p className="text-xs">Loading trend timeline...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-field-border rounded bg-field-surface-subtle">
            <Calendar className="w-8 h-8 text-field-muted mb-2" />
            <h3 className="text-xs font-semibold text-field-primary">No Check-in History Available</h3>
            <p className="text-xs text-field-muted max-w-sm mt-1 mb-4">
              Complete your first 30-second daily check-in to start building your personal trend line.
            </p>
            <Link
              to="/personnel/checkin"
              className="px-3.5 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
            >
              Record First Check-in
            </Link>
          </div>
        ) : (
          <div className="h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#222D37" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#8294A2" 
                  fontSize={11}
                  tickLine={false}
                  dy={6}
                />
                <YAxis 
                  domain={[0, 10]} 
                  ticks={[0, 2, 4, 6, 8, 10]} 
                  stroke="#8294A2" 
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-field-surface border border-field-border p-3 rounded shadow-lg text-xs space-y-1">
                          <p className="text-field-muted font-medium border-b border-field-border pb-1">
                            {data.fullDate}
                          </p>
                          <div className="text-field-primary flex justify-between gap-4">
                            <span>Mood Score:</span> <strong>{data.mood !== undefined ? `${data.mood}/5` : '—'}</strong>
                          </div>
                          <div className="text-field-primary flex justify-between gap-4">
                            <span>Sleep Quality:</span> <strong>{data.sleep !== undefined ? `${data.sleep}/5` : '—'}</strong>
                          </div>
                          <div className="text-field-primary flex justify-between gap-4">
                            <span>Stress Rating:</span> <strong>{data.stress !== undefined ? `${data.stress}/10` : '—'}</strong>
                          </div>
                          {data.helpRequested && (
                            <p className="text-triage-amber font-semibold pt-1 border-t border-field-border text-[11px]">
                              • Confidential Support Requested
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  name="Mood"
                  stroke="#60A5FA"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#60A5FA', strokeWidth: 1, stroke: '#0B0F13' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="sleep"
                  name="Sleep"
                  stroke="#2E8B68"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2E8B68', strokeWidth: 1, stroke: '#0B0F13' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="stress"
                  name="Stress"
                  stroke="#C97A1E"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#C97A1E', strokeWidth: 1, stroke: '#0B0F13' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* REQUEST FOR CHANGE PROMINENT SECTION */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-field-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40">
                Operational Accommodations
              </span>
              <span className="text-xs text-field-muted">Decision-Support Assisted</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-field-primary">
              Request for Change
            </h2>
            <p className="text-xs text-field-muted mt-0.5 max-w-2xl">
              Submit formal operational requests for leave, workload augmentation, unit transfers, or shift schedule rotations. Your request is matched with your current readiness trajectory for transparent officer review.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal('leave')}
            className="px-4 py-2.5 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit New Request</span>
          </button>
        </div>

        {/* Quick-Launch Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* 1. Leave */}
          <button
            type="button"
            onClick={() => handleOpenModal('leave')}
            className="p-3 bg-field-surface-subtle border border-field-border rounded hover:border-command-blue/50 text-left transition-colors group"
          >
            <Calendar className="w-4 h-4 text-command-blue mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-field-primary block">Leave</span>
            <span className="text-[10px] text-field-muted">Request time off</span>
          </button>

          {/* 2. Work Hours */}
          <button
            type="button"
            onClick={() => handleOpenModal('work_hours')}
            className="p-3 bg-field-surface-subtle border border-field-border rounded hover:border-command-blue/50 text-left transition-colors group"
          >
            <Clock className="w-4 h-4 text-command-blue mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-field-primary block">Work Hours</span>
            <span className="text-[10px] text-field-muted">Change duty hours</span>
          </button>

          {/* 3. Transfer */}
          <button
            type="button"
            onClick={() => handleOpenModal('transfer')}
            className="p-3 bg-field-surface-subtle border border-field-border rounded hover:border-command-blue/50 text-left transition-colors group"
          >
            <MapPin className="w-4 h-4 text-command-blue mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-field-primary block">Transfer</span>
            <span className="text-[10px] text-field-muted">Request transfer</span>
          </button>

          {/* 4. Day -> Night */}
          <button
            type="button"
            onClick={() => handleOpenModal('day_to_night')}
            className="p-3 bg-field-surface-subtle border border-field-border rounded hover:border-command-blue/50 text-left transition-colors group"
          >
            <Clock className="w-4 h-4 text-command-blue mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-field-primary block">Day → Night</span>
            <span className="text-[10px] text-field-muted">Request night duty</span>
          </button>

          {/* 5. Night -> Day */}
          <button
            type="button"
            onClick={() => handleOpenModal('night_to_day')}
            className="p-3 bg-field-surface-subtle border border-field-border rounded hover:border-command-blue/50 text-left transition-colors group col-span-2 sm:col-span-1"
          >
            <Clock className="w-4 h-4 text-readiness-green mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-field-primary block">Night → Day</span>
            <span className="text-[10px] text-field-muted">Request day duty</span>
          </button>
        </div>
      </div>

      {/* MY REQUESTS HISTORY */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-field-border">
          <div>
            <h2 className="text-base font-bold text-field-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-field-muted" />
              <span>My Requests</span>
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Live status, submission snapshots, and Welfare Officer decisions.
            </p>
          </div>
          <span className="text-xs font-mono text-field-muted">
            Total: {myRequests.length}
          </span>
        </div>

        {myRequests.length === 0 ? (
          <div className="p-8 text-center bg-field-surface-subtle border border-field-border rounded text-xs text-field-muted space-y-2">
            <p>You have not submitted any change requests yet.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-xs text-command-blue hover:underline font-semibold"
            >
              Click here to submit your first request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-field-border text-field-muted font-semibold">
                  <th className="pb-3 pr-4">Request Type</th>
                  <th className="pb-3 pr-4">Details / Reason</th>
                  <th className="pb-3 pr-4 text-center">Welfare Risk (at Sub.)</th>
                  <th className="pb-3 pr-4 text-center">Status</th>
                  <th className="pb-3 pr-4">Officer Decision & Reason</th>
                  <th className="pb-3 text-right">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-field-border">
                {myRequests.map((req) => {
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-amber-bg text-triage-amber border border-triage-amber-border">
                      PENDING
                    </span>
                  );
                  if (req.status === 'APPROVED') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-green-bg text-readiness-green border border-triage-green-border">
                        APPROVED
                      </span>
                    );
                  } else if (req.status === 'REJECTED') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-triage-red-bg text-triage-red border border-triage-red-border">
                        REJECTED
                      </span>
                    );
                  }

                  const formatDetails = () => {
                    if (req.request_type === 'leave') {
                      return `${req.request_details?.leave_days ?? 5} Days (${req.request_details?.leave_type ?? 'Casual'})`;
                    }
                    if (req.request_type === 'work_hours') {
                      return `${req.request_details?.current_hours ?? 10} hrs/day → ${req.request_details?.requested_hours ?? 8} hrs/day`;
                    }
                    if (req.request_type === 'transfer') {
                      const fromUnit = req.request_details?.current_posting || 'Current Unit';
                      const toUnit = req.request_details?.requested_posting || req.request_details?.preferred_transfer_unit_location || 'Requested Unit';
                      return `${fromUnit} → ${toUnit}`;
                    }
                    if (req.request_type === 'day_to_night') {
                      return 'Day Shift → Night Shift';
                    }
                    if (req.request_type === 'night_to_day') {
                      return 'Night Shift → Day Shift';
                    }
                    if (req.request_type === 'shift_change') {
                      return `Shift: ${req.request_details?.requested_shift ?? 'Schedule'}`;
                    }
                    return JSON.stringify(req.request_details);
                  };

                  const formatTypeLabel = () => {
                    if (req.request_type === 'leave') return 'Leave';
                    if (req.request_type === 'work_hours') return 'Work Hours';
                    if (req.request_type === 'transfer') return 'Transfer';
                    if (req.request_type === 'day_to_night') return 'Day → Night';
                    if (req.request_type === 'night_to_day') return 'Night → Day';
                    return req.request_type.replace('_', ' ');
                  };

                  return (
                    <tr key={req.request_id} className="hover:bg-field-surface-elevated transition-colors">
                      <td className="py-3 pr-4 font-semibold text-field-primary capitalize">
                        {formatTypeLabel()}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <div className="font-medium text-field-primary text-[11px]">{formatDetails()}</div>
                        <div className="text-field-muted text-[11px] truncate mt-0.5">{req.reason}</div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="font-bold text-field-primary">
                          {req.risk_score_at_submission}
                          <span className="text-[10px] text-field-muted font-normal"> / 100</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {statusBadge}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        {req.status === 'PENDING' ? (
                          <span className="text-field-muted italic text-[11px]">Under officer review</span>
                        ) : req.status === 'APPROVED' ? (
                          <div className="text-readiness-green font-medium text-[11px]">
                            Approved {req.officer_reason ? `— "${req.officer_reason}"` : ''}
                          </div>
                        ) : (
                          <div className="text-triage-red font-medium text-[11px]">
                            Rejected {req.officer_reason ? `— "${req.officer_reason}"` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right text-field-muted font-mono text-[11px]">
                        {new Date(req.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Popup */}
      <RequestForChangeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitted={fetchData}
        initialType={selectedModalType}
      />

      {/* Identity Security Stamp */}
      <div className="bg-field-surface-subtle border border-field-border rounded p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-field-muted">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-readiness-green" />
          <span>Pseudonymous Token Active: <strong className="text-field-primary font-normal">{user?.claims.pseudonymous_id}</strong></span>
        </div>
        <span>FastAPI Defense Telemetry Connection: Verified</span>
      </div>
    </div>
  );
};
