import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { api, setAuthToken, setSessionExpiredHandler } from './api';
import type { Role, User } from './types';

const TOKEN_KEY = 'smartpark_token';
const USER_KEY = 'smartpark_user';

const storage = {
  get: async (key: string) =>
    Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) =>
    Platform.OS === 'web' ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: async (key: string) =>
    Platform.OS === 'web' ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

function decodeJwt(token: string): { role?: Role; exp?: number } | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  role: Role | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (form: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = { token: string; user: User };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, role: null });

  const logout = useCallback(async () => {
    setAuthToken(null);
    setState({ status: 'signedOut', user: null, role: null });
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]).catch(() => {});
  }, []);

  const openSession = useCallback(async ({ token, user }: AuthResponse) => {
    setAuthToken(token);
    setState({ status: 'signedIn', user, role: decodeJwt(token)?.role ?? user.role });
    await Promise.all([storage.set(TOKEN_KEY, token), storage.set(USER_KEY, JSON.stringify(user))])
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => { logout(); });
    (async () => {
      try {
        const [token, savedUser] = await Promise.all([storage.get(TOKEN_KEY), storage.get(USER_KEY)]);
        const payload = token ? decodeJwt(token) : null;
        if (token && savedUser && payload?.exp && payload.exp * 1000 > Date.now()) {
          setAuthToken(token);
          const user: User = JSON.parse(savedUser);
          setState({ status: 'signedIn', user, role: payload.role ?? user.role });
          return;
        }
      } catch {}
      await logout();
    })();
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login: async (email, password) => {
      await openSession(await api.post<AuthResponse>('/auth/login', { email, password }));
    },
    register: async (form) => {
      await openSession(await api.post<AuthResponse>('/auth/register', form));
    },
    logout,
    updateUser: (user) => {
      setState((current) => ({ ...current, user }));
      storage.set(USER_KEY, JSON.stringify(user)).catch(() => {});
    },
  }), [state, openSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
