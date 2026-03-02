// import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import AppDashboard from './pages/AppDashboard';
import './App.css';

// Apply saved theme immediately so there's no flash on load
const savedTheme = localStorage.getItem('xp_theme');
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
} else {
  document.documentElement.removeAttribute('data-theme');
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="xp-loading">
      <div className="xp-spinner" />
      <span className="xp-loading-text">LOADING</span>
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="xp-loading">
      <div className="xp-spinner" />
      <span className="xp-loading-text">LOADING</span>
    </div>
  );
  return !user ? children : <Navigate to="/app" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
          <Route path="/app" element={<ProtectedRoute><AppDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}