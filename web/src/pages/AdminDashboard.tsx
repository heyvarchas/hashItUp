import React from 'react';
import { Shield, Database, Server } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 border border-amber-500/20 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Shield className="w-3.5 h-3.5" /> System Administrator View
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          System Administration & Audit
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
          Manage system configurations, user accounts, and cryptographic key rotation policies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Server className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Backend Status</h3>
          </div>
          <p className="text-xs text-slate-400">FastAPI backend operational on port 8000.</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Database className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Database Schemas</h3>
          </div>
          <p className="text-xs text-slate-400">Dual schema architecture (identity, analytics) isolated.</p>
        </div>
      </div>
    </div>
  );
};
