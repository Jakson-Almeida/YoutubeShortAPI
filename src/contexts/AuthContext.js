import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';

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

  // Carregar token e user do localStorage ao montar
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken) {
      setToken(savedToken);
      // Carregar user do localStorage imediatamente para exibir na UI
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } catch (error) {
          console.warn('Erro ao parsear user do localStorage:', error);
        }
      }
      // Verificar token no backend (atualizará o user se necessário)
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        // Salvar user no localStorage
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        // Garantir que o token está salvo
        if (authToken) {
          setToken(authToken);
          localStorage.setItem('auth_token', authToken);
        }
      } else if (response.status === 401) {
        // Apenas remover token se o backend confirmar que é inválido (401)
        console.log('Token inválido ou expirado. Removendo...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } else {
        // Outros erros (500, 503, etc) - manter token e user, pode ser erro temporário do servidor
        console.warn('Erro ao verificar token (status:', response.status, '). Mantendo token e user.');
        // Manter token e user do localStorage
        setToken(authToken);
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (error) {
            console.warn('Erro ao parsear user do localStorage:', error);
          }
        }
      }
    } catch (error) {
      // Erro de rede - não remover token, pode ser problema temporário
      console.warn('Erro de rede ao verificar token. Mantendo token e user do localStorage:', error.message);
      // Manter token e user do localStorage
      setToken(authToken);
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.warn('Erro ao parsear user do localStorage:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
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
        // Salvar user no localStorage
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
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
      const response = await fetch('/api/auth/register', {
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
        // Salvar user no localStorage
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
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
      // Verificar token no estado ou localStorage
      const authToken = token || localStorage.getItem('auth_token');
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
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
      localStorage.removeItem('user');
    }
  };

  const getAuthHeaders = () => {
    // Verificar primeiro no estado, depois no localStorage
    const authToken = token || localStorage.getItem('auth_token');
    if (authToken) {
      return {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  // Verificar autenticação: considerar autenticado se houver token no localStorage
  // mesmo que a verificação ainda não tenha sido concluída ou tenha falhado por erro de rede
  const isAuthenticated = useMemo(() => {
    const hasToken = token || localStorage.getItem('auth_token');
    return !!hasToken;
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

