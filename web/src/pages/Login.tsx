import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AlertCircle, KeyRound } from 'lucide-react';
import { API_BASE_URL } from '../config';

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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
        throw new Error(data.detail || 'Authentication failed. Please verify service number and password.');
      }

      const data = await response.json();
      login(data.access_token);

      // Route based on role
      if (data.role === 'personnel') {
        navigate('/personnel');
      } else if (data.role === 'welfare_officer') {
        navigate('/welfare');
      } else if (data.role === 'commander') {
        navigate('/commander');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-field-bg font-sans">
      <div className="w-full max-w-md bg-field-surface border border-field-border rounded-lg p-6 sm:p-8">
        {/* Security & System Header */}
        <div className="border-b border-field-border pb-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded bg-field-surface-elevated border border-field-border flex items-center justify-center text-field-primary">
              <Shield className="w-5 h-5 text-field-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-field-primary leading-tight">
                STHIRA
              </h1>
              <p className="text-xs text-field-muted">
                Stress & Fatigue Monitering System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-field-muted bg-field-surface-subtle p-2 rounded border border-field-border">
            <Lock className="w-3.5 h-3.5 text-readiness-green shrink-0" />
            <span>Dual-schema cryptographic pseudonymity enabled</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-start gap-2.5 text-triage-red text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-field-primary mb-1.5">
              Service Identification Number
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-field-muted" />
              <input
                type="text"
                required
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value)}
                placeholder="e.g. CAPF-2024-001"
                className="w-full bg-field-surface-subtle border border-field-border rounded pl-9 pr-3 py-2 text-xs sm:text-sm text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-field-primary mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-field-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-field-surface-subtle border border-field-border rounded pl-9 pr-3 py-2 text-xs sm:text-sm text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-command-blue hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Authenticate & Sign In'
            )}
          </button>
        </form>

        {/* Operational Credentials Reference */}
        <div className="mt-6 pt-4 border-t border-field-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-field-muted">
              Demo Credentials Reference
            </span>
            <span className="text-[10px] text-field-muted">Click role to fill</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-001', 'password123')}
              className="w-full py-1.5 px-2.5 rounded bg-field-surface-subtle hover:bg-field-surface-elevated text-left flex items-center justify-between text-field-muted hover:text-field-primary transition-colors border border-field-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-field-primary font-sans font-medium text-xs">Personnel</span>
                <span className="text-field-muted text-[11px]">CAPF-2024-001</span>
              </div>
              <span className="text-[11px] text-command-blue font-sans">Fill</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-002', 'password456')}
              className="w-full py-1.5 px-2.5 rounded bg-field-surface-subtle hover:bg-field-surface-elevated text-left flex items-center justify-between text-field-muted hover:text-field-primary transition-colors border border-field-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-field-primary font-sans font-medium text-xs">Welfare Officer</span>
                <span className="text-field-muted text-[11px]">CAPF-2024-002</span>
              </div>
              <span className="text-[11px] text-command-blue font-sans">Fill</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-003', 'password789')}
              className="w-full py-1.5 px-2.5 rounded bg-field-surface-subtle hover:bg-field-surface-elevated text-left flex items-center justify-between text-field-muted hover:text-field-primary transition-colors border border-field-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-field-primary font-sans font-medium text-xs">Unit Commander</span>
                <span className="text-field-muted text-[11px]">CAPF-2024-003</span>
              </div>
              <span className="text-[11px] text-command-blue font-sans">Fill</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('ADMIN-001', 'admin123')}
              className="w-full py-1.5 px-2.5 rounded bg-field-surface-subtle hover:bg-field-surface-elevated text-left flex items-center justify-between text-field-muted hover:text-field-primary transition-colors border border-field-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-field-primary font-sans font-medium text-xs">Administrator</span>
                <span className="text-field-muted text-[11px]">ADMIN-001</span>
              </div>
              <span className="text-[11px] text-command-blue font-sans">Fill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
