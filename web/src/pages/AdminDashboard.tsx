import React from 'react';
import { Database, Server, Key, CheckCircle2, Lock } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6 font-sans">
      {/* System Administration Header */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-field-muted font-mono uppercase tracking-wider">
          <Lock className="w-3.5 h-3.5 text-readiness-green" />
          <span>System Administration • Defense Security Tier</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
          System Administration & Cryptographic Audit
        </h1>
        <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
          Manage system configurations, dual-schema pseudonymity isolation policies, telemetry endpoints, and cryptographic key rotation cycles.
        </p>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-command-blue" />
              <h3 className="text-xs font-bold text-field-primary">FastAPI Backend</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Nominal
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Service active on port 8000. Real-time predictive risk scoring pipelines online.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-readiness-green" />
              <h3 className="text-xs font-bold text-field-primary">Dual-Schema Isolation</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enforced
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Identity schema strictly decoupled from analytics and assessment tables.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-triage-amber" />
              <h3 className="text-xs font-bold text-field-primary">Key Rotation</h3>
            </div>
            <span className="text-[11px] text-field-muted font-mono">
              Auto: 90 Days
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Cryptographic salting and token generation functioning under defense compliance standards.
          </p>
        </div>
      </div>
    </div>
  );
};
