import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { PersonnelDashboard } from './pages/PersonnelDashboard';
import { WellnessCheckin } from './pages/WellnessCheckin';
import { WelfareDashboard } from './pages/WelfareDashboard';
import { AlertsQueue } from './pages/AlertsQueue';
import { CaseDetail } from './pages/CaseDetail';
import { CommanderDashboard } from './pages/CommanderDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.claims.role === 'personnel') {
    return <Navigate to="/personnel" replace />;
  } else if (user.claims.role === 'welfare_officer') {
    return <Navigate to="/welfare" replace />;
  } else if (user.claims.role === 'commander') {
    return <Navigate to="/commander" replace />;
  } else if (user.claims.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Routes inside AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Personnel Routes */}
              <Route element={<ProtectedRoute allowedRoles={['personnel']} />}>
                <Route path="/personnel" element={<PersonnelDashboard />} />
                <Route path="/personnel/checkin" element={<WellnessCheckin />} />
              </Route>

              {/* Welfare Officer Routes */}
              <Route element={<ProtectedRoute allowedRoles={['welfare_officer']} />}>
                <Route path="/welfare" element={<WelfareDashboard />} />
                <Route path="/welfare/alerts" element={<AlertsQueue />} />
                <Route path="/welfare/cases/:pseudonymousId" element={<CaseDetail />} />
              </Route>

              {/* Commander Routes */}
              <Route element={<ProtectedRoute allowedRoles={['commander']} />}>
                <Route path="/commander" element={<CommanderDashboard />} />
              </Route>

              {/* Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
