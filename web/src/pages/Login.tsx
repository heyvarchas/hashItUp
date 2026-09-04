import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AlertCircle, KeyRound } from 'lucide-react';

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
        throw new Error(data.detail || 'Authentication failed. Please verify service number and password.');
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
                CAPF Welfare Command
              </h1>
              <p className="text-xs text-field-muted">
                Stress & Fatigue Early-Warning System
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

        {/* Operational Role Switcher for Testing */}
        <div className="mt-6 pt-5 border-t border-field-border">
          <p className="text-xs font-semibold text-field-muted mb-2.5">
            Operational Test Accounts
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-001', 'password123')}
              className="w-full p-2.5 bg-field-surface-subtle hover:bg-field-surface-elevated text-left rounded border border-field-border flex items-center justify-between text-xs transition-colors"
            >
              <div>
                <span className="font-semibold text-field-primary block">CAPF-2024-001</span>
                <span className="text-[11px] text-field-muted">Field Personnel (30s Check-in & Personal Trends)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-field-border text-field-primary text-[11px] font-medium">
                Personnel
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('CAPF-2024-002', 'password456')}
              className="w-full p-2.5 bg-field-surface-subtle hover:bg-field-surface-elevated text-left rounded border border-field-border flex items-center justify-between text-xs transition-colors"
            >
              <div>
                <span className="font-semibold text-field-primary block">CAPF-2024-002</span>
                <span className="text-[11px] text-field-muted">Welfare Officer (Unit Overview & Triage Queue)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-triage-amber-bg text-triage-amber border border-triage-amber-border text-[11px] font-medium">
                Welfare Officer
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
