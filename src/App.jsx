import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages & Contexts
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LegacyApp from './pages/LegacyApp';
import ProLogin from './pages/ProLogin';
import ProDashboard from './pages/ProDashboard';
import ProTeamDashboard from './pages/ProTeamDashboard';
import ProProfile from './pages/ProProfile';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          {/* The Classic App Route */}
          <Route path="/app" element={
            <div className="bg-slate-50 min-h-screen">
              <div className="bg-blue-600 text-white text-[10px] font-black p-1 text-center uppercase tracking-widest relative z-[100] border-b border-blue-700">
                <a href="/" className="absolute left-4 top-1 flex items-center hover:text-blue-200 transition-colors cursor-pointer">
                  Exit
                </a>
                Legacy Guest Mode
              </div>
              <LegacyApp />
            </div>
          } />
          
          {/* SaaS App Auth Route */}
          <Route path="/pro" element={<ProLogin />} />
          
          {/* SaaS App Profile Route */}
          <Route path="/pro/profile" element={
            <ProtectedRoute>
               <ProProfile />
            </ProtectedRoute>
          } />
          
          {/* SaaS App Dashboard Route */}
          <Route path="/pro/dashboard" element={
            <ProtectedRoute>
               <ProDashboard />
            </ProtectedRoute>
          } />
          
          {/* SaaS Specific Team Route */}
          <Route path="/pro/team/:teamId" element={
             <ProtectedRoute>
                <ProTeamDashboard />
             </ProtectedRoute>
          } />
          
          {/* Placeholder for Admin Panel Route */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly={true}>
              <div className="p-8 text-center mt-20"><h1 className="text-2xl font-black text-rose-600">Admin Area Status: Under Construction</h1><a href="/pro/dashboard" className="text-emerald-600 font-bold mt-4 block">Return to Dashboard</a></div>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
