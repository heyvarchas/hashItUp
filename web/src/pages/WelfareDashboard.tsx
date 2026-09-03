import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, RefreshCw, AlertTriangle, ChevronRight, ArrowUpRight } from 'lucide-react';

export const WelfareDashboard: React.FC = () => {
  const { user } = useAuth();
  const [authVerification, setAuthVerification] = useState<any>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [alertStats, setAlertStats] = useState<{ open: number; critical: number }>({ open: 0, critical: 0 });

  const testServerAuth = async () => {
    if (!user) return;
    setLoadingVerify(true);
    try {
      const res = await fetch('http://localhost:8000/dummy/welfare-officer-only', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      setAuthVerification({ status: res.status, data });
    } catch (e: any) {
      setAuthVerification({ status: 'Error', data: e.message });
    } finally {
      setLoadingVerify(false);
    }
  };

  const fetchAlertStats = async () => {
    if (!user) return;
    try {
      const res = await fetch('http://localhost:8000/alerts?status=open', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const open = data.length;
        const critical = data.filter((a: any) => a.severity === 'critical').length;
        setAlertStats({ open, critical });
      }
    } catch (e) {
      // quiet fail for preview card
    }
  };

  useEffect(() => {
    testServerAuth();
    fetchAlertStats();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Welfare Hero */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900/60 to-slate-900/40 border border-emerald-500/20 rounded-3xl p-6 md:p-8 backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <ShieldCheck className="w-3.5 h-3.5" /> Welfare Officer View
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Unit Welfare & Health Monitoring
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
          Aggregated, privacy-preserving risk assessment and early-intervention triage dashboard for unit commanders and welfare officers.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/welfare/alerts"
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-lg shadow-rose-600/25 flex items-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Open Alert Queue ({alertStats.open})
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={testServerAuth}
            disabled={loadingVerify}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tracking-wide transition shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVerify ? 'animate-spin' : ''}`} />
            Verify Welfare Route
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/welfare/alerts"
          className="bg-slate-900/80 hover:bg-slate-800/80 transition-all border border-slate-800 hover:border-rose-500/30 rounded-3xl p-6 shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Alert Queue</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition" />
          </div>
          <div className="mt-2 text-2xl font-black text-white flex items-center gap-2">
            <span>{alertStats.open} Active Alerts</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {alertStats.critical > 0 ? (
              <span className="text-rose-400 font-semibold">{alertStats.critical} critical urgency requiring attention</span>
            ) : (
              'Prioritized triage queue'
            )}
          </p>
        </Link>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Officer ID</span>
          <div className="mt-2 text-sm font-mono font-bold text-slate-200 truncate">
            {user?.claims.person_id}
          </div>
          <p className="text-xs text-slate-500 mt-1">Audit log attribution key</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Privacy Protocol</span>
          <div className="mt-2 text-base font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Strict De-identification Active
          </div>
          <p className="text-xs text-slate-500 mt-1">Zero PII in analytics queries</p>
        </div>
      </div>

      {/* Backend Verification Status Card */}
      {authVerification && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Live RBAC Route Test (/dummy/welfare-officer-only)
          </h3>
          <div className="bg-slate-950 p-4 rounded-2xl font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto">
            <span className="text-slate-500">HTTP Status:</span> {authVerification.status}
            <br />
            <span className="text-slate-500">Payload:</span> {JSON.stringify(authVerification.data, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
};

