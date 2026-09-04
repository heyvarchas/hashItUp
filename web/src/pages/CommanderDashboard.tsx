import React from 'react';
import { Shield, Users, Activity, CheckCircle2 } from 'lucide-react';

export const CommanderDashboard: React.FC = () => {
  return (
    <div className="space-y-6 font-sans">
      {/* Commander Console Header */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
            Unit Commander Console
          </span>
          <span className="text-xs text-field-muted flex items-center gap-1">
            <Shield className="w-3 h-3 text-command-blue" />
            Operational Command & Unit Readiness
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
          Battalion & Unit Command Center
        </h1>
        <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
          Executive oversight for battalion combat readiness, aggregate workforce health indicators, and operational deployment planning.
        </p>
      </div>

      {/* Operational Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-command-blue" />
              <h3 className="text-xs font-bold text-field-primary">Unit Readiness Tier</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> High Readiness
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Battalion personnel operational readiness indices remain within calibrated parameters.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-readiness-green" />
              <h3 className="text-xs font-bold text-field-primary">Workforce Health Index</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Optimal
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Aggregated health & wellness trends report positive morale and duty tempo stability.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-command-blue" />
              <h3 className="text-xs font-bold text-field-primary">Role Permissions (RBAC)</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-field-primary">
              Commander
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Isolated executive access tier segregated from medical and clinical case triage records.
          </p>
        </div>
      </div>
    </div>
  );
};
