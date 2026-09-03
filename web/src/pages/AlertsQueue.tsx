import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Flame,
  ShieldAlert,
  Clock,
  Filter,
  RefreshCw,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  Info,
  ArrowUpDown,
  Search,
} from 'lucide-react';

export interface AlertItem {
  id: string;
  risk_score_id: string;
  severity: 'critical' | 'high' | 'moderate' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  pseudonymous_id?: string;
  calibrated_score?: number | null;
  risk_category?: string | null;
  contributing_factors?: string[] | null;
}

export const AlertsQueue: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters from state or URL
  const statusFilter = searchParams.get('status') || 'open';
  const severityFilter = searchParams.get('severity') || 'all';
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAlerts = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      let url = `http://localhost:8000/alerts?`;
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (severityFilter && severityFilter !== 'all') {
        params.append('severity', severityFilter);
      }
      url += params.toString();

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch alerts (${res.status} ${res.statusText})`);
      }

      const data: AlertItem[] = await res.json();
      setAlerts(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while loading the alert queue.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter, user]);

  const handleStatusChange = (newStatus: string) => {
    const next = new URLSearchParams(searchParams);
    if (newStatus === 'all') {
      next.delete('status');
    } else {
      next.set('status', newStatus);
    }
    setSearchParams(next);
  };

  const handleSeverityChange = (newSeverity: string) => {
    const next = new URLSearchParams(searchParams);
    if (newSeverity === 'all') {
      next.delete('severity');
    } else {
      next.set('severity', newSeverity);
    }
    setSearchParams(next);
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const pidMatch = alert.pseudonymous_id?.toLowerCase().includes(query);
    const factorMatch = alert.contributing_factors?.some((f) => f.toLowerCase().includes(query));
    const sevMatch = alert.severity.toLowerCase().includes(query);
    return pidMatch || factorMatch || sevMatch;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Flame className="w-3.5 h-3.5" /> CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> HIGH
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" /> MODERATE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            INFO
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> Open
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const openCounts = alerts.filter((a) => a.status === 'open').length;
  const criticalCounts = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/40 border border-rose-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldAlert className="w-3.5 h-3.5" /> Early Intervention Triage
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welfare Alert Queue
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Prioritized triage queue of active welfare concerns. Click any alert to inspect clinical risk factors, operational history, and record interventions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAlerts}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Active Open Alerts</span>
            <div className="text-2xl font-bold text-white mt-1">{openCounts}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[11px] text-rose-400 uppercase font-semibold">Critical Urgency</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{criticalCounts}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Queue Order</span>
            <div className="text-xs font-semibold text-slate-300 mt-2 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" /> Severity First
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[11px] text-emerald-400 uppercase font-semibold">Privacy Mode</span>
            <div className="text-xs font-semibold text-emerald-300 mt-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> De-identified IDs
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {(['open', 'acknowledged', 'resolved', 'all'] as const).map((st) => (
            <button
              key={st}
              onClick={() => handleStatusChange(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st === 'all' ? 'All Statuses' : st}
            </button>
          ))}
        </div>

        {/* Severity Filter & Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => handleSeverityChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID or factor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Alerts Table / List View */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500">
            <div className="w-9 h-9 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-400">Loading prioritized alert queue...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Alerts Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              There are currently no alerts matching the selected status ({statusFilter}) and severity ({severityFilter}) filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.pseudonymous_id) {
                    navigate(`/welfare/cases/${alert.pseudonymous_id}?alert_id=${alert.id}`);
                  }
                }}
                className="p-5 hover:bg-slate-800/50 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-4">
                  {/* Score Indicator Ring */}
                  <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${
                    alert.severity === 'critical'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : alert.severity === 'high'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}>
                    <span className="text-xs font-black leading-none">
                      {alert.calibrated_score ?? '--'}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80 mt-0.5">
                      Risk
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {getSeverityBadge(alert.severity)}
                      {getStatusBadge(alert.status)}
                      <span className="font-mono text-xs font-bold text-slate-200">
                        Pseudonym: {alert.pseudonymous_id?.slice(0, 13)}...
                      </span>
                    </div>

                    {/* Contributing Factors preview */}
                    {alert.contributing_factors && alert.contributing_factors.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {alert.contributing_factors.slice(0, 2).map((factor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-slate-300 font-medium"
                          >
                            {factor}
                          </span>
                        ))}
                        {alert.contributing_factors.length > 2 && (
                          <span className="text-[11px] text-slate-500">
                            +{alert.contributing_factors.length - 2} more factors
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No specific contributing factors logged.</p>
                    )}
                  </div>
                </div>

                {/* Right Metadata and Action Button */}
                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold group-hover:text-indigo-300 transition-colors">
                    <span>View Case Detail</span>
                    <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
