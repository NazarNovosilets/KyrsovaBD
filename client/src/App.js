import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Registration/Register';
import Login from './pages/login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import TeamBuilder from './pages/TeamBuilder/TeamBuilder';
import Matches from './pages/Matches/Matches';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import AnalyticsMatches from './pages/Analytics/AnalyticsMatches';
import AnalyticsMatchEvaluation from './pages/Analytics/AnalyticsMatchEvaluation';

// AdminRoute компонент - перевіряє autentyfication і роль адміністратора
const AdminRoute = ({ children }) => {
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  console.log('🔐 AdminRoute check - userId:', userId, 'role:', role);

  if (!userId) {
    console.log('❌ No userId found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (role !== 'admin') {
    console.log('❌ User is not admin, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ Admin access granted');
  return children;
};

const AnalystRoute = ({ children }) => {
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'analyst' && role !== 'analytics') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const UserRoute = ({ children }) => {
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'analyst' || role === 'analytics') {
    return <Navigate to="/analytics" replace />;
  }

  return children;
};

function App() {
  return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

           {/* Захищена сторінка - потрібна autentyfication */}
           <Route
             path="/dashboard"
             element={
               <UserRoute>
                 <Dashboard />
               </UserRoute>
             }
           />

           {/* Admin Panel - тільки для адміністраторів */}
           <Route
             path="/admin"
             element={
               <AdminRoute>
                 <AdminPanel />
               </AdminRoute>
             }
           />

           {/* Team Builder сторінка */}
            <Route
              path="/team-builder"
              element={
                <UserRoute>
                  <TeamBuilder />
                </UserRoute>
              }
            />

            {/* Matches сторінка */}
            <Route
              path="/matches"
              element={
                <UserRoute>
                  <Matches />
                </UserRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <AnalystRoute>
                  <AnalyticsMatches />
                </AnalystRoute>
              }
            />

            <Route
              path="/analytics/matches/:matchId/evaluation"
              element={
                <AnalystRoute>
                  <AnalyticsMatchEvaluation />
                </AnalystRoute>
              }
            />

            {/* Дефолтний маршрут - редиректить на login замість dashboard */}
            <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
  );
}

export default App;
