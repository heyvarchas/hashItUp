import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, FileText, BarChart2, AlertCircle } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const role = user?.claims.role;

  const getRoleLabel = (r?: string) => {
    switch (r) {
      case 'personnel':
        return 'Field Personnel';
      case 'welfare_officer':
        return 'Welfare Officer';
      case 'commander':
        return 'Unit Commander';
      case 'admin':
        return 'System Administrator';
      default:
        return 'Authorized User';
    }
  };

  return (
    <div className="min-h-screen bg-field-bg text-field-primary flex flex-col font-sans">
      {/* Top Operations Header */}
      <header className="border-b border-field-border bg-field-surface sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand / Unit Identifier */}
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded bg-field-border flex items-center justify-center text-field-primary font-bold text-xs shrink-0">
              <Shield className="w-4 h-4 text-field-primary" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-field-primary tracking-normal">
                  CAPF Welfare Command
                </span>
                <span className="text-xs text-field-muted font-normal">
                  / {getRoleLabel(role)}
                </span>
              </div>
              <span className="text-[11px] text-field-muted">
                Terminal ID: <span className="text-field-primary font-medium">{user?.claims.pseudonymous_id?.slice(0, 10)}</span>
              </span>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-1">
            {role === 'personnel' && (
              <>
                <NavLink
                  to="/personnel"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Personal Readiness</span>
                </NavLink>
                <NavLink
                  to="/personnel/checkin"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Daily Check-in</span>
                </NavLink>
              </>
            )}

            {role === 'welfare_officer' && (
              <>
                <NavLink
                  to="/welfare"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Unit Overview</span>
                </NavLink>
                <NavLink
                  to="/welfare/alerts"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Triage Queue</span>
                </NavLink>
              </>
            )}

            {role === 'commander' && (
              <NavLink
                to="/commander"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-command-blue text-white font-semibold'
                      : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                  }`
                }
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Command Overview</span>
              </NavLink>
            )}

            {role === 'admin' && (
              <>
                <NavLink
                  to="/welfare"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Personnel Roster</span>
                </NavLink>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-command-blue text-white font-semibold'
                        : 'text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                    }`
                  }
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Dataset Management</span>
                </NavLink>
              </>
            )}
          </nav>

          {/* Session Info & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block text-xs">
              <span className="text-readiness-green font-medium flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-readiness-green" />
                Live Session
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-field-muted" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Institutional Compliance Baseline Footer */}
      <footer className="border-t border-field-border bg-field-surface py-3 text-xs text-field-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CAPF Early-Warning Welfare & Fatigue Monitoring Architecture • Strict Dual-Schema Isolation Active</span>
          <span>Classification: Operational Welfare Data (Protected)</span>
        </div>
      </footer>
    </div>
  );
};
