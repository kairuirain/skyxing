import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiClient from '../../shared/api';

const storage = {
  getItem: async (key) => await AsyncStorage.getItem(key),
  setItem: async (key, value) => await AsyncStorage.setItem(key, value),
  removeItem: async (key) => await AsyncStorage.removeItem(key),
};

const api = new ApiClient(storage);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('skyxing_token');
      if (token) {
        await api.setToken(token);
        try {
          const data = await api.getMe();
          setUser(data.user);
        } catch {
          await api.setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login({ username, password });
    await api.setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    const data = await api.register(userData);
    await api.setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    const data = await api.updateUser(user.id, updates);
    setUser(data.user);
    return data;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { api };
