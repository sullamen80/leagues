import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../common/Loading';

/**
 * ProtectedRoute component
 * Only allows access to children if user is authenticated
 */
const ProtectedRoute = ({ children, requireSuperuser = false }) => {
  const { currentUser, isSuperuser, loading } = useAuth();
  
  if (loading) {
    return <Loading message="Authenticating..." />;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (requireSuperuser && !isSuperuser) {
    return <Navigate to="/" />;
  }
  
  return children;
};

export default ProtectedRoute;