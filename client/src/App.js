import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Registration/Register';
import Login from './pages/login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import TeamBuilder from './pages/TeamBuilder/TeamBuilder';
import Matches from './pages/Matches/Matches';
import AdminPanel from './pages/AdminPanel/AdminPanel';

// ProtectedRoute компонент - перевіряє autentyfication
const ProtectedRoute = ({ children }) => {
  const userId = localStorage.getItem('userId');

  console.log('🔐 ProtectedRoute check - userId:', userId);

  if (!userId) {
    // Якщо немає userId, редиректимо на login
    console.log('❌ No userId found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Якщо є userId, показуємо сторінку
  console.log('✅ userId found, showing dashboard');
  return children;
};

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
               <ProtectedRoute>
                 <Dashboard />
               </ProtectedRoute>
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
                <ProtectedRoute>
                  <TeamBuilder />
                </ProtectedRoute>
              }
            />

            {/* Matches сторінка */}
            <Route
              path="/matches"
              element={
                <ProtectedRoute>
                  <Matches />
                </ProtectedRoute>
              }
            />

            {/* Дефолтний маршрут - редиректить на login замість dashboard */}
            <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
  );
}

export default App;