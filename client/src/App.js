import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Registration/Register';
import Login from './pages/login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import TeamBuilder from './pages/TeamBuilder/TeamBuilder';
import Matches from './pages/Matches/Matches';

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