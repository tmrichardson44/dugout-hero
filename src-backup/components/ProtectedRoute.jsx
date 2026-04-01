import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/pro" />;
  
  if (requiredRole === 'super_admin' && currentUser.systemRole !== 'super_admin') {
    return <Navigate to="/pro/dashboard" />;
  }

  return children;
}
