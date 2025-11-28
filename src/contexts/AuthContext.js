import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';

import API_BASE_URL from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Carregar token do localStorage ao montar
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      // Verificar token em background, mas não bloquear nem remover se falhar
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else if (response.status === 401) {
        // Apenas remover se for realmente um token inválido (401)
        // Erros de rede ou outros erros não devem deslogar o usuário
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      } else {
        // Outros erros (rede, servidor, etc) - manter token mas não setar user
        // O token ainda pode ser válido, apenas não conseguimos verificar agora
        console.warn('Erro ao verificar token, mas mantendo sessão:', response.status);
      }
    } catch (error) {
      // Erro de rede - não remover token, pode ser temporário
      console.warn('Erro de conexão ao verificar token, mantendo sessão:', error);
      // Não remover token em caso de erro de rede
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.access_token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Erro ao fazer login' };
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return { success: false, error: 'Erro de conexão. Tente novamente.' };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.access_token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Erro ao registrar' };
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
      return { success: false, error: 'Erro de conexão. Tente novamente.' };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
    }
  };

  const getAuthHeaders = () => {
    const authToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (authToken) {
      return {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  // Sincronizar token do localStorage quando componente monta ou quando token muda
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken && savedToken !== token) {
      setToken(savedToken);
    }
  }, [token]);

  // Sempre verificar localStorage diretamente para garantir que não perdemos a autenticação
  const isAuthenticated = useMemo(() => {
    // Sempre verificar localStorage primeiro - é a fonte da verdade
    if (typeof localStorage !== 'undefined') {
      return !!localStorage.getItem('auth_token');
    }
    return !!token;
  }, [token]);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    getAuthHeaders
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

