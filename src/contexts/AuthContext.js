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
  // Inicializar token diretamente do localStorage no estado inicial
  // Isso garante que o token esteja disponível desde o primeiro render
  const getInitialToken = () => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(getInitialToken);

  // Carregar token do localStorage ao montar - SEM verificação automática
  // IMPORTANTE: Não remover o token aqui - apenas carregar
  useEffect(() => {
    console.log('[AuthContext] Inicializando autenticação...');
    
    // Garantir que o token seja carregado ANTES de setar loading como false
    const savedToken = localStorage.getItem('auth_token');
    
    console.log('[AuthContext] Token no localStorage:', savedToken ? 'presente' : 'ausente');
    
    if (savedToken) {
      // Carregar token no estado imediatamente (se ainda não foi carregado)
      if (savedToken !== token) {
        console.log('[AuthContext] Sincronizando token do localStorage para o estado');
        setToken(savedToken);
      }
      // Não verificar o token automaticamente - confiar que se está no localStorage, é válido
      // A verificação será feita apenas quando necessário (ex: ao fazer uma requisição)
      // O token JWT tem expiração longa (365 dias), então não precisamos verificar constantemente
    } else {
      console.log('[AuthContext] Nenhum token encontrado no localStorage');
      // Se não há token, garantir que o estado também está null
      if (token) {
        console.log('[AuthContext] Removendo token do estado (não há no localStorage)');
        setToken(null);
      }
    }
    
    // IMPORTANTE: setar loading como false DEPOIS de garantir que o token foi carregado
    // Isso evita que componentes vejam isAuthenticated como false durante o carregamento inicial
    console.log('[AuthContext] Finalizando carregamento inicial, loading = false');
    setLoading(false);

    // Listener para quando o token for removido externamente (ex: após 401 explícito do backend)
    const handleTokenRemoved = () => {
      console.log('[AuthContext] Evento auth_token_removed recebido');
      // Só remover se realmente foi um 401 - não remover por outros motivos
      const currentToken = localStorage.getItem('auth_token');
      if (!currentToken) {
        // Token já foi removido - apenas sincronizar estado
        console.log('[AuthContext] Token já foi removido do localStorage, sincronizando estado');
        setToken(null);
        setUser(null);
      } else {
        console.log('[AuthContext] Token ainda existe no localStorage, ignorando evento (possível condição de corrida)');
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
      console.log('[AuthContext] Iniciando login para:', email);
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[AuthContext] Login bem-sucedido, salvando token no localStorage e estado');
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.access_token);
        console.log('[AuthContext] Token salvo com sucesso');
        return { success: true };
      } else {
        console.log('[AuthContext] Login falhou:', data.error);
        return { success: false, error: data.error || 'Erro ao fazer login' };
      }
    } catch (error) {
      console.error('[AuthContext] Erro ao fazer login:', error);
      return { success: false, error: 'Erro de conexão. Tente novamente.' };
    }
  };

  const register = async (email, password) => {
    try {
      console.log('[AuthContext] Iniciando registro para:', email);
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[AuthContext] Registro bem-sucedido, salvando token no localStorage e estado');
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.access_token);
        console.log('[AuthContext] Token salvo com sucesso');
        return { success: true };
      } else {
        console.log('[AuthContext] Registro falhou:', data.error);
        return { success: false, error: data.error || 'Erro ao registrar' };
      }
    } catch (error) {
      console.error('[AuthContext] Erro ao registrar:', error);
      return { success: false, error: 'Erro de conexão. Tente novamente.' };
    }
  };

  const logout = async () => {
    try {
      console.log('[AuthContext] Iniciando logout');
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
      console.error('[AuthContext] Erro ao fazer logout:', error);
    } finally {
      console.log('[AuthContext] Removendo token do localStorage e estado');
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
      console.log('[AuthContext] Logout concluído');
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
    if (loading) {
      console.log('[AuthContext] Sincronização: pulando durante loading inicial');
      return;
    }
    
    const savedToken = localStorage.getItem('auth_token');
    
    // Se há token no localStorage mas não no estado - sincronizar imediatamente
    // Isso é especialmente importante após recarregar a página
    if (savedToken && savedToken !== token) {
      console.log('[AuthContext] Sincronização: token no localStorage mas não no estado, sincronizando...');
      setToken(savedToken);
    } else if (!savedToken && token) {
      // Se não há token no localStorage mas há no estado, isso é um problema
      // Mas NÃO vamos remover o token do estado aqui - pode ser uma condição de corrida
      // O token só será removido quando:
      // 1. O usuário faz logout explicitamente
      // 2. O backend retorna 401 (token inválido)
      console.warn('[AuthContext] Sincronização: token no estado mas não no localStorage - possível condição de corrida, mantendo estado');
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
      const result = !!token;
      console.log('[AuthContext] isAuthenticated (SSR fallback):', result);
      return result;
    }
    // SEMPRE ler do localStorage - é a fonte única da verdade
    // Não depender do estado 'loading' ou 'token' - se há token no localStorage, o usuário está autenticado
    // O token só será removido quando:
    // 1. O usuário faz logout explicitamente
    // 2. O backend retorna 401 EXPLICITAMENTE
    // NUNCA remover por condições de corrida ou dessincronização
    const savedToken = localStorage.getItem('auth_token');
    const result = !!savedToken;
    console.log('[AuthContext] isAuthenticated (localStorage):', result, '| loading:', loading, '| token no estado:', !!token);
    return result;
  }, [token, loading]); // Recalcular quando token ou loading mudar, mas sempre ler do localStorage

  // Função de debug para inspecionar o localStorage (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || window.location.hostname.includes('localhost')) {
      // Expor função global para debug do localStorage
      window.debugAuth = () => {
        const token = localStorage.getItem('auth_token');
        console.log('=== DEBUG AUTENTICAÇÃO ===');
        console.log('Token no localStorage:', token ? 'PRESENTE' : 'AUSENTE');
        if (token) {
          try {
            // Decodificar JWT para ver informações (sem verificar assinatura)
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              console.log('Token decodificado:', {
                user_id: payload.sub,
                expira_em: new Date(payload.exp * 1000).toLocaleString('pt-BR'),
                expirado: Date.now() > payload.exp * 1000,
                criado_em: new Date(payload.iat * 1000).toLocaleString('pt-BR')
              });
            }
          } catch (e) {
            console.log('Erro ao decodificar token:', e);
          }
        }
        console.log('Estado React:', {
          token: token ? 'PRESENTE' : 'AUSENTE',
          user: user,
          loading: loading,
          isAuthenticated: isAuthenticated
        });
        console.log('========================');
        return {
          localStorage: { token: token ? 'PRESENTE' : 'AUSENTE' },
          reactState: { token: !!token, user, loading, isAuthenticated }
        };
      };
      
      console.log('%c🔍 Debug de Autenticação disponível!', 'color: #4CAF50; font-weight: bold; font-size: 14px');
      console.log('Digite debugAuth() no console para verificar o estado da autenticação');
    }
  }, [user, loading, isAuthenticated]);

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

