import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(api.getToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth session on boot
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
        if (res.user?.preferences?.theme) {
          document.body.setAttribute('data-theme', res.user.preferences.theme);
        }
      } catch (err) {
        console.warn('Session expired or invalid, logging out.', err);
        api.setToken('');
        setTokenState('');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.login(email, password);
      api.setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      if (res.user?.preferences?.theme) {
        document.body.setAttribute('data-theme', res.user.preferences.theme);
      }
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const res = await api.register(name, email, password);
      api.setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      if (res.user?.preferences?.theme) {
        document.body.setAttribute('data-theme', res.user.preferences.theme);
      }
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      api.setToken('');
      setTokenState('');
      setUser(null);
      document.body.removeAttribute('data-theme');
    }
  };

  const updatePreferences = (newPrefs) => {
    if (user) {
      const updated = { ...user, preferences: { ...user.preferences, ...newPrefs } };
      setUser(updated);
      if (newPrefs.theme) {
        document.body.setAttribute('data-theme', newPrefs.theme);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        updatePreferences,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
