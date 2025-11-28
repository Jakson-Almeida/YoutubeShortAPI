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

  // Carregar token do localStorage ao montar - SEM verificação automática
  // IMPORTANTE: Não remover o token aqui - apenas carregar
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      // Não verificar o token automaticamente - confiar que se está no localStorage, é válido
      // A verificação será feita apenas quando necessário (ex: ao fazer uma requisição)
    }
    setLoading(false);
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
        return true;
      } else if (response.status === 401) {
        // Token realmente inválido - remover apenas neste caso
        console.log('[AuthContext] verifyToken - Token inválido (401), removendo...');
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        return false;
      } else {
        // Outros erros (rede, servidor, etc) - manter token mas não setar user
        // O token ainda pode ser válido, apenas não conseguimos verificar agora
        console.warn('Erro ao verificar token, mas mantendo sessão:', response.status);
        return true; // Assumir válido se não for 401
      }
    } catch (error) {
      // Erro de rede - não remover token, pode ser temporário
      console.warn('Erro de conexão ao verificar token, mantendo sessão:', error);
      return true; // Assumir válido em caso de erro de rede
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
      console.log('[AuthContext] logout - Removendo token e limpando estado');
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

  // isAuthenticated SEMPRE verifica localStorage diretamente - é a fonte única da verdade
  // IMPORTANTE: Mesmo durante loading, se há token no localStorage, o usuário está autenticado
  // Usa token como dependência apenas para causar re-renderização quando login/logout acontecer
  const isAuthenticated = useMemo(() => {
    if (typeof localStorage === 'undefined') {
      // Fallback: usar estado do token se localStorage não estiver disponível
      return !!token;
    }
    // SEMPRE ler do localStorage - é a fonte única da verdade
    // Não depender do estado 'loading' - se há token no localStorage, o usuário está autenticado
    const savedToken = localStorage.getItem('auth_token');
    const result = !!savedToken;
    // Log apenas quando mudar (para não poluir o console)
    if (result !== (token ? true : false)) {
      console.log('[AuthContext] isAuthenticated mudou - localStorage tem token:', result, 'estado token:', !!token);
    }
    return result;
  }, [token]); // Recalcular quando token muda (login/logout), mas sempre ler do localStorage

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

