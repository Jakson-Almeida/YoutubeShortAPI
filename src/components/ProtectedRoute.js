import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Login from './Auth/Login';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('[ProtectedRoute] Verificando autenticação - loading:', loading, '| isAuthenticated:', isAuthenticated);

  if (loading) {
    console.log('[ProtectedRoute] Mostrando spinner durante carregamento');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Usuário não autenticado, redirecionando para home com login');
    // Redirecionar para home com modal de login
    return <Navigate to="/?login=true" replace />;
  }

  console.log('[ProtectedRoute] Usuário autenticado, renderizando conteúdo protegido');
  return children;
};

export default ProtectedRoute;

