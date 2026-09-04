import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  FileSearch,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-red-bg text-triage-red border border-triage-red-border">
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-amber-bg text-triage-amber border border-triage-amber-border">
            High Risk
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-blue-bg text-blue-300 border border-triage-blue-border">
            Moderate
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-field-surface-elevated text-field-muted border border-field-border">
            Info
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-red-bg text-triage-red border border-triage-red-border">
            <span className="w-1.5 h-1.5 rounded-full bg-triage-red" /> Open
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-amber-bg text-triage-amber border border-triage-amber-border">
            <span className="w-1.5 h-1.5 rounded-full bg-triage-amber" /> In Review
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-triage-green-bg text-readiness-green border border-triage-green-border">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const openCounts = alerts.filter((a) => a.status === 'open').length;
  const criticalCounts = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Triage Manifest Header */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
                Welfare Triage Roster
              </span>
              <span className="text-xs text-field-muted flex items-center gap-1">
                <Lock className="w-3 h-3 text-readiness-green" />
                De-identified Personnel Cases
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
              Active Welfare Concerns & Fatigue Triage
            </h1>
            <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
              Prioritized triage queue of personnel exhibiting elevated operational strain or requesting welfare outreach. Select a case to inspect workload factors and log interventions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchAlerts}
              disabled={isRefreshing}
              className="px-3 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-field-muted ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Triage Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-field-border text-xs">
          <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
            <span className="text-field-muted block">Active Open Cases</span>
            <span className="text-xl font-bold text-field-primary mt-1 block">{openCounts}</span>
          </div>
          <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
            <span className="text-triage-red block">Critical Urgency</span>
            <span className="text-xl font-bold text-triage-red mt-1 block">{criticalCounts}</span>
          </div>
          <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
            <span className="text-field-muted block">Sorting Order</span>
            <span className="text-xs font-medium text-field-primary mt-2 block">Severity First (Auto-ranked)</span>
          </div>
          <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
            <span className="text-readiness-green block">Identity Security</span>
            <span className="text-xs font-medium text-field-primary mt-2 block">Pseudonymous IDs Active</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-field-surface border border-field-border rounded-lg p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-field-muted font-medium mr-1">Status:</span>
          {(['open', 'acknowledged', 'resolved', 'all'] as const).map((st) => (
            <button
              key={st}
              onClick={() => handleStatusChange(st)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-command-blue text-white font-semibold'
                  : 'bg-field-surface-subtle text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
              }`}
            >
              {st === 'all' ? 'All' : st}
            </button>
          ))}
        </div>

        {/* Severity & Search Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-field-muted font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => handleSeverityChange(e.target.value)}
              className="bg-field-surface-subtle border border-field-border text-field-primary text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-command-blue"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-field-muted" />
            <input
              type="text"
              placeholder="Search by ID or factor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-field-surface-subtle border border-field-border rounded pl-8 pr-3 py-1.5 text-xs text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Alerts Table / Manifest */}
      <div className="bg-field-surface border border-field-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-field-muted">
            <div className="w-6 h-6 border-2 border-field-border border-t-command-blue rounded-full animate-spin mb-2" />
            <p className="text-xs">Loading triage manifest...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-readiness-green mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-field-primary">No Matching Alerts in Queue</h3>
            <p className="text-xs text-field-muted max-w-sm mx-auto mt-1">
              There are currently no active cases matching the selected status ({statusFilter}) and severity ({severityFilter}) filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-field-border">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  if (alert.pseudonymous_id) {
                    navigate(`/welfare/cases/${alert.pseudonymous_id}?alert_id=${alert.id}`);
                  }
                }}
                className="p-4 hover:bg-field-surface-elevated cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  {/* Score Indicator Box */}
                  <div className={`w-11 h-11 rounded flex flex-col items-center justify-center shrink-0 border ${
                    alert.severity === 'critical'
                      ? 'bg-triage-red-bg border-triage-red-border text-triage-red'
                      : alert.severity === 'high'
                      ? 'bg-triage-amber-bg border-triage-amber-border text-triage-amber'
                      : 'bg-triage-blue-bg border-triage-blue-border text-blue-300'
                  }`}>
                    <span className="text-xs font-bold leading-none">
                      {alert.calibrated_score ?? '--'}
                    </span>
                    <span className="text-[9px] font-medium opacity-80 mt-0.5">
                      Risk
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSeverityBadge(alert.severity)}
                      {getStatusBadge(alert.status)}
                      <span className="text-xs font-semibold text-field-primary">
                        Pseudonym: {alert.pseudonymous_id?.slice(0, 12)}...
                      </span>
                    </div>

                    {/* Contributing Factors */}
                    {alert.contributing_factors && alert.contributing_factors.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {alert.contributing_factors.slice(0, 2).map((factor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-field-surface-subtle border border-field-border rounded text-[11px] text-field-primary font-normal"
                          >
                            {factor}
                          </span>
                        ))}
                        {alert.contributing_factors.length > 2 && (
                          <span className="text-[11px] text-field-muted">
                            +{alert.contributing_factors.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-field-muted italic">Routine triage alert.</p>
                    )}
                  </div>
                </div>

                {/* Right Meta & Action */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-field-border">
                  <div className="flex items-center gap-1.5 text-field-muted text-xs">
                    <Clock className="w-3.5 h-3.5 text-field-muted" />
                    <span>{new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <span className="px-2.5 py-1 bg-field-surface-elevated hover:bg-field-border border border-field-border rounded text-xs font-medium text-field-primary transition-colors flex items-center gap-1">
                    <FileSearch className="w-3.5 h-3.5 text-command-blue" />
                    <span>Review Case</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
