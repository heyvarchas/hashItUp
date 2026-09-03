import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, User, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_number: serviceNumber,
          password: password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Authentication failed. Please check your credentials.');
      }

      const data = await response.json();
      login(data.access_token);

      // Route based on role
      if (data.role === 'personnel') {
        navigate('/personnel');
      } else if (data.role === 'welfare_officer') {
        navigate('/welfare');
      } else if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (serviceNum: string, pass: string) => {
    setServiceNumber(serviceNum);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welfare & Stress Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in with your service credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Service Number
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value)}
                placeholder="e.g. CAPF-2024-001"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-xs text-slate-400 font-medium mb-3">Quick demo test accounts:</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-001', 'password123')}
              className="w-full py-2 px-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700/50 text-left flex justify-between items-center transition-colors"
            >
              <span className="font-mono text-indigo-300">CAPF-2024-001</span>
              <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">Personnel Role</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-002', 'password456')}
              className="w-full py-2 px-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700/50 text-left flex justify-between items-center transition-colors"
            >
              <span className="font-mono text-indigo-300">CAPF-2024-002</span>
              <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Welfare Officer Role</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
