import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  HeartPulse, 
  Sparkles, 
  Shield, 
  RefreshCw, 
  TrendingUp, 
  HelpCircle,
  Activity,
  Calendar,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

export const PersonnelDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [history, setHistory] = useState<WellnessAssessmentRecord[]>([]);
  const [riskData, setRiskData] = useState<RiskOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchData = async () => {
    if (!user) return;
    setIsRefreshing(true);

    try {
      // 1. Fetch wellness check-in history
      const historyRes = await fetch('http://localhost:8000/wellness/history?limit=30', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!historyRes.ok) {
        throw new Error('Failed to load wellness history.');
      }
      const historyJson: WellnessAssessmentRecord[] = await historyRes.json();
      // Sort chronologically ascending for the chart
      const sortedHistory = [...historyJson].sort(
        (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );
      setHistory(sortedHistory);

      // 2. Fetch supportive risk overview
      const riskRes = await fetch('http://localhost:8000/risk/me', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (riskRes.ok) {
        const riskJson: RiskOverview = await riskRes.json();
        setRiskData(riskJson);
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
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          title: 'High Care Support Recommended',
          desc: 'Your operational tempo & check-in indicators suggest dedicating time for recovery and support resources.',
        };
      case 'high':
        return {
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          title: 'Recovery Attention Suggested',
          desc: 'Elevated workload indicators noted. Prioritize rest windows and hydration.',
        };
      case 'moderate':
        return {
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          title: 'Moderate Operational Load',
          desc: 'Operational activities are steady. Maintain balanced rest habits.',
        };
      default:
        return {
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          title: 'Healthy Wellness Baseline',
          desc: 'Workload and wellness metrics are well-balanced within normal thresholds.',
        };
    }
  };

  const currentTheme = getCategoryTheme(riskData?.risk_category);

  return (
    <div className="space-y-6">
      {/* Welcome Hero with Supportive Framing */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900/60 to-slate-900/40 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Personnel Wellbeing Portal
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Personal Wellness & Health Trends
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Track your daily recovery, sleep, and mood ratings over time. All analytics remain fully de-identified and support proactive personnel care.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/personnel/checkin"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-lg shadow-indigo-600/25 flex items-center gap-2"
            >
              <HeartPulse className="w-4 h-4" /> Submit Today's Check-in
            </Link>
            <button
              onClick={fetchData}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              Refresh Trend Data
            </button>
          </div>
        </div>
      </div>

      {/* Supportive Wellbeing Status & Factors */}
      {riskData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wellbeing Status</span>
                <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${currentTheme.badge}`}>
                  {riskData.risk_category}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{currentTheme.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{currentTheme.desc}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                Score: <strong className="text-white">{riskData.calibrated_score}/100</strong>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Updated {new Date(riskData.computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Supportive Insights & Workload Factors
              </h3>
            </div>
            
            {riskData.contributing_factors && riskData.contributing_factors.length > 0 ? (
              <div className="space-y-3">
                {riskData.contributing_factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                      {factor}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No significant workload deviations identified.</p>
            )}
          </div>
        </div>
      )}

      {/* Personal Trend View (Recharts Line Chart) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Personal Wellness Trends</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Historical self-ratings from past check-in submissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Mood (1-5)
            </span>
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Sleep (1-5)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Stress (1-10)
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-500">
            <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium">Loading historical trend points...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <Calendar className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Assessment History Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Submit your first daily check-in to generate your wellness trend timeline.
            </p>
            <Link
              to="/personnel/checkin"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
            >
              Submit First Check-in
            </Link>
          </div>
        ) : (
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  dy={8}
                />
                <YAxis 
                  domain={[0, 10]} 
                  ticks={[0, 2, 4, 6, 8, 10]} 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5">
                          <p className="text-slate-400 font-semibold border-b border-slate-800 pb-1.5">
                            {data.fullDate}
                          </p>
                          <p className="text-indigo-400 flex justify-between gap-4">
                            <span>Mood Score:</span> <strong>{data.mood !== undefined ? `${data.mood}/5` : 'N/A'}</strong>
                          </p>
                          <p className="text-blue-400 flex justify-between gap-4">
                            <span>Sleep Quality:</span> <strong>{data.sleep !== undefined ? `${data.sleep}/5` : 'N/A'}</strong>
                          </p>
                          <p className="text-amber-400 flex justify-between gap-4">
                            <span>Stress Rating:</span> <strong>{data.stress !== undefined ? `${data.stress}/10` : 'N/A'}</strong>
                          </p>
                          {data.helpRequested && (
                            <p className="text-rose-400 font-bold pt-1 text-[11px] flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" /> Support outreach requested
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
                  name="Mood (1-5)"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#818cf8', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#818cf8' }}
                />
                <Line
                  type="monotone"
                  dataKey="sleep"
                  name="Sleep (1-5)"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#60a5fa' }}
                />
                <Line
                  type="monotone"
                  dataKey="stress"
                  name="Stress (1-10)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Identity Security Footer */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>Cryptographic isolation active: <strong>{user?.claims.pseudonymous_id}</strong></span>
        </div>
        <span>FastAPI Live Session: 8 Hours Exp</span>
      </div>
    </div>
  );
};
