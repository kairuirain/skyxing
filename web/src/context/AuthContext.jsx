import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('skyxing_token');
    if (token) {
      api.setToken(token);
      api.getMe()
        .then(data => setUser(data.user))
        .catch(() => { api.setToken(null); setUser(null); })
        .finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      return data.user;
    } catch (e) { return null; }
  }, []);

  const login = useCallback(async (username, password, turnstileToken) => {
    const data = await api.login({ username, password, turnstileToken });
    if (data.requireTotp) return data;
    api.setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const complete2FALogin = useCallback(async (tempToken, code) => {
    const data = await api.verify2FALogin(tempToken, code);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    const data = await api.register(userData);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    const data = await api.updateUser(user.id, updates);
    setUser(data.user);
    return data;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, complete2FALogin, register, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthContext');
  return context;
}
