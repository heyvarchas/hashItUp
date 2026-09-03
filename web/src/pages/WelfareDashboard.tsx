import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ShieldCheck, RefreshCw } from 'lucide-react';

export const WelfareDashboard: React.FC = () => {
  const { user } = useAuth();
  const [authVerification, setAuthVerification] = useState<any>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);

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

  useEffect(() => {
    testServerAuth();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Welfare Hero */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900/60 to-slate-900/40 border border-emerald-500/20 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
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
          <button
            onClick={testServerAuth}
            disabled={loadingVerify}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-lg shadow-emerald-600/25 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVerify ? 'animate-spin' : ''}`} />
            Verify Backend Welfare Route
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Role</span>
          <div className="mt-2 text-xl font-bold text-emerald-400 flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span className="capitalize">{user?.claims.role.replace('_', ' ')}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Authorized for unit-level triage</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Officer ID</span>
          <div className="mt-2 text-sm font-mono font-bold text-slate-200 truncate">
            {user?.claims.person_id}
          </div>
          <p className="text-xs text-slate-500 mt-1">Audit log attribution key</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Live RBAC Route Test (/dummy/welfare-officer-only)
          </h3>
          <div className="bg-slate-950 p-3 rounded-xl font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto">
            <span className="text-slate-500">HTTP Status:</span> {authVerification.status}
            <br />
            <span className="text-slate-500">Payload:</span> {JSON.stringify(authVerification.data, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
};
