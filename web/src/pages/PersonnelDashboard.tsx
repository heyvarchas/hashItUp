import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HeartPulse, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PersonnelDashboard: React.FC = () => {
  const { user } = useAuth();
  const [authVerification, setAuthVerification] = useState<any>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);

  const testServerAuth = async () => {
    if (!user) return;
    setLoadingVerify(true);
    try {
      const res = await fetch('http://localhost:8000/dummy/personnel-only', {
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
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900/60 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Personnel Welfare Portal
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome, Personnel Member
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Your self-assessment and wellness data are strictly pseudorandomized and protected with cryptographic controls. Only anonymous indicators assist support staff in proactive care.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/personnel/checkin"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wide transition shadow-lg shadow-indigo-600/25 flex items-center gap-2"
            >
              <HeartPulse className="w-4 h-4" /> Start Wellness Check-in
            </Link>
            <button
              onClick={testServerAuth}
              disabled={loadingVerify}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingVerify ? 'animate-spin' : ''}`} />
              Verify Backend Personnel Route
            </button>
          </div>
        </div>
      </div>

      {/* Identity & Claims Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Role Claim</span>
          <div className="mt-2 text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span className="capitalize">{user?.claims.role}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Verified by FastAPI backend</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pseudonymous ID</span>
          <div className="mt-2 text-sm font-mono font-bold text-indigo-300 truncate">
            {user?.claims.pseudonymous_id}
          </div>
          <p className="text-xs text-slate-500 mt-1">Analytics schema isolation key</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Token Expiration</span>
          <div className="mt-2 text-sm font-mono text-slate-200">
            {user?.claims.exp ? new Date(user.claims.exp * 1000).toLocaleTimeString() : 'N/A'}
          </div>
          <p className="text-xs text-slate-500 mt-1">8-hour session window</p>
        </div>
      </div>

      {/* Backend Verification Status Card */}
      {authVerification && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Live RBAC Route Test (/dummy/personnel-only)
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
