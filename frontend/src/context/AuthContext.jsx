import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler, tokenStore } from '../services/api';
import { AuthAPI } from '../services/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (tokenStore.get()) setSessionExpired(true);
      tokenStore.clear();
      setUser(null);
    });
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    AuthAPI.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const applyToken = useCallback((res) => {
    tokenStore.set(res.access_token);
    setSessionExpired(false);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (email, password) => applyToken(await AuthAPI.login(email, password)), [applyToken]);
  const register = useCallback(async (body) => applyToken(await AuthAPI.register(body)), [applyToken]);

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, logout, sessionExpired, isAdmin: user?.role === 'admin' }),
    [user, loading, login, register, logout, sessionExpired],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const homeFor = (user) => (user?.role === 'admin' ? '/admin/dashboard' : '/app/dashboard');
