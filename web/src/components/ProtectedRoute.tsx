import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-field-bg flex flex-col items-center justify-center text-field-muted">
        <div className="w-8 h-8 border-3 border-command-blue/20 border-t-command-blue rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Validating session & role permissions...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.claims.role)) {
    return (
      <div className="min-h-screen bg-field-bg flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-field-surface border border-field-border rounded-lg p-6 max-w-md w-full text-center">
          <div className="text-xs font-mono uppercase tracking-wider text-triage-amber mb-2">
            Access Restricted (RBAC)
          </div>
          <h2 className="text-lg font-bold text-field-primary mb-2">Unauthorized Operational Tier</h2>
          <p className="text-xs text-field-muted mb-6 leading-relaxed">
            Your current assigned role ({user.claims.role}) is not authorized to access this operational sector.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-field-surface-subtle hover:bg-field-surface-elevated text-field-primary text-xs font-semibold rounded border border-field-border transition-colors"
          >
            Return to Previous Screen
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
