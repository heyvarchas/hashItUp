import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, HeartPulse } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();

  const role = user?.claims.role;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              CAPF Welfare Portal
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {role}
              </span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Pseudo ID: {user?.claims.pseudonymous_id.slice(0, 8)}...
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {role === 'personnel' && (
            <>
              <NavLink
                to="/personnel"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/personnel/checkin"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                Check-in Form
              </NavLink>
            </>
          )}

          {role === 'welfare_officer' && (
            <>
              <NavLink
                to="/welfare"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                Unit Overview
              </NavLink>
              <NavLink
                to="/welfare/alerts"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                Alerts & Triage
              </NavLink>
            </>
          )}

          {role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              System Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-200">Authenticated</p>
            <p className="text-[10px] text-slate-400 font-mono">Token valid 8h</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-300 transition-all shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};
