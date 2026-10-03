import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authApi, TOKEN_KEY, USER_KEY } from '../services/api';

const AuthContext = createContext(null);

export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Fleet Manager',
  TECHNICIAN: 'Technician',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  // Re-validate the stored token against the API on first mount.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .profile()
      .then((profile) => {
        setUser(profile);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: loggedIn, token } = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedIn));
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: created, token } = await authApi.register(payload);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(created));
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((next) => {
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
      /** True when the signed-in user holds any of the given roles. */
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
      isAdmin: user?.role === ROLES.ADMIN,
      isManager: user?.role === ROLES.MANAGER,
      isTechnician: user?.role === ROLES.TECHNICIAN,
    }),
    [user, loading, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

export default AuthContext;
