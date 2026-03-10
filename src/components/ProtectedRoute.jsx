import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/pro" />;
  
  if (adminOnly && !currentUser.isAdmin) return <Navigate to="/pro/dashboard" />;

  return children;
}
