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
    // Garantir que o token seja carregado ANTES de setar loading como false
    const savedToken = localStorage.getItem('auth_token');
    
    if (savedToken) {
      // Carregar token no estado imediatamente
      setToken(savedToken);
      // Não verificar o token automaticamente - confiar que se está no localStorage, é válido
      // A verificação será feita apenas quando necessário (ex: ao fazer uma requisição)
      // O token JWT tem expiração longa (365 dias), então não precisamos verificar constantemente
    }
    
    // IMPORTANTE: setar loading como false DEPOIS de garantir que o token foi carregado
    // Isso evita que componentes vejam isAuthenticated como false durante o carregamento inicial
    setLoading(false);

    // Listener para quando o token for removido externamente (ex: após 401 explícito do backend)
    const handleTokenRemoved = () => {
      // Só remover se realmente foi um 401 - não remover por outros motivos
      const currentToken = localStorage.getItem('auth_token');
      if (!currentToken) {
        // Token já foi removido - apenas sincronizar estado
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener('auth_token_removed', handleTokenRemoved);

    return () => {
      window.removeEventListener('auth_token_removed', handleTokenRemoved);
    };
  }, []); // Executar apenas uma vez ao montar

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
        // Token realmente inválido - remover apenas neste caso EXPLÍCITO
        // Verificar se o token ainda é o mesmo antes de remover (evitar remoção acidental)
        const currentToken = localStorage.getItem('auth_token');
        if (currentToken === authToken) {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
          // Disparar evento para sincronizar outros componentes
          window.dispatchEvent(new CustomEvent('auth_token_removed'));
        }
        return false;
      } else {
        // Outros erros (rede, servidor, etc) - manter token mas não setar user
        // O token ainda pode ser válido, apenas não conseguimos verificar agora
        // NÃO REMOVER o token por erros de rede ou servidor
        console.warn('Erro ao verificar token, mas mantendo sessão:', response.status);
        return true; // Assumir válido se não for 401
      }
    } catch (error) {
      // Erro de rede - NÃO REMOVER token, pode ser temporário
      // O token JWT é válido localmente até a expiração, não precisamos verificar constantemente
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

  // Sincronizar token do localStorage quando detectamos dessincronização
  // IMPORTANTE: Este useEffect garante que o estado React sempre esteja sincronizado com localStorage
  // MAS: NUNCA remover o token do localStorage - apenas sincronizar o estado React
  useEffect(() => {
    // Não executar durante o carregamento inicial
    if (loading) return;
    
    const savedToken = localStorage.getItem('auth_token');
    
    // Se há token no localStorage mas não no estado - sincronizar imediatamente
    // Isso é especialmente importante após recarregar a página
    if (savedToken && savedToken !== token) {
      setToken(savedToken);
    }
    
    // IMPORTANTE: NÃO remover o token do localStorage aqui
    // O token só deve ser removido quando:
    // 1. O usuário faz logout explicitamente
    // 2. O backend retorna 401 (token inválido)
    // NUNCA remover por condições de corrida ou dessincronização
  }, [token, loading]);

  // isAuthenticated SEMPRE verifica localStorage diretamente - é a fonte única da verdade
  // IMPORTANTE: Mesmo durante loading, se há token no localStorage, o usuário está autenticado
  // Isso garante que mesmo durante o carregamento inicial ou após recarregar a página,
  // o isAuthenticated sempre retorna o valor correto baseado no localStorage
  // O token JWT tem expiração longa (365 dias), então não precisamos verificar constantemente
  const isAuthenticated = useMemo(() => {
    if (typeof localStorage === 'undefined') {
      // Fallback: usar estado do token se localStorage não estiver disponível (SSR)
      return !!token;
    }
    // SEMPRE ler do localStorage - é a fonte única da verdade
    // Não depender do estado 'loading' ou 'token' - se há token no localStorage, o usuário está autenticado
    // O token só será removido quando:
    // 1. O usuário faz logout explicitamente
    // 2. O backend retorna 401 EXPLICITAMENTE
    // NUNCA remover por condições de corrida ou dessincronização
    const savedToken = localStorage.getItem('auth_token');
    return !!savedToken;
  }, [token, loading]); // Recalcular quando token ou loading mudar, mas sempre ler do localStorage

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

