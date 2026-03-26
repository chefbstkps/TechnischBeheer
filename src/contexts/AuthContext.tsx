import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AppUser, LoginCredentials, LoginOptions, LoginResult, UserPageVisibility } from '../types/auth';
import * as AuthService from '../services/authService';

interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (credentials: LoginCredentials, options?: LoginOptions) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: () => boolean;
  isSuperUser: () => boolean;
  isSuperUserOrAdmin: () => boolean;
  updateLastActivity: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const validationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(AuthService.authStorageKeys.user);
      localStorage.removeItem(AuthService.authStorageKeys.sessionToken);
      localStorage.removeItem(AuthService.authStorageKeys.loggedInAt);
      localStorage.removeItem(AuthService.authStorageKeys.lastActivityAt);
    } catch {}
    setState((s) => (s.user ? { ...s, user: null } : s));
  }, []);

  const invalidateSession = useCallback(() => {
    clearSession();
    setState({ user: null, loading: false });
    window.location.replace('/login');
  }, [clearSession]);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    const raw = localStorage.getItem(AuthService.authStorageKeys.user);
    const sessionToken = localStorage.getItem(AuthService.authStorageKeys.sessionToken);
    if (!raw || !sessionToken) {
      clearSession();
      setState({ user: null, loading: false });
      return false;
    }
    let stored: AppUser;
    try {
      stored = JSON.parse(raw);
    } catch {
      clearSession();
      setState({ user: null, loading: false });
      return false;
    }
    const isValid = await AuthService.validateSession(stored.id, sessionToken);
    if (!isValid) {
      clearSession();
      setState({ user: null, loading: false });
      return false;
    }
    const user = await AuthService.getCurrentUser(stored.id);
    if (!user) {
      clearSession();
      setState({ user: null, loading: false });
      return false;
    }
    const visibility = await AuthService.getUserPageVisibility(user.id);
    const merged: AppUser = { ...user, page_visibility: visibility };
    try {
      localStorage.setItem(AuthService.authStorageKeys.user, JSON.stringify(merged));
    } catch {}
    setState({ user: merged, loading: false });
    return true;
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    await restoreSession();
  }, [restoreSession]);

  const updateLastActivity = useCallback(() => {
    try {
      const t = Date.now().toString();
      localStorage.setItem(AuthService.authStorageKeys.lastActivityAt, t);
    } catch {}
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!state.user) {
      if (validationRef.current) {
        clearInterval(validationRef.current);
        validationRef.current = null;
      }
      return;
    }

    const validate = async () => {
      const sessionToken = localStorage.getItem(AuthService.authStorageKeys.sessionToken);
      if (!sessionToken) {
        invalidateSession();
        return;
      }
      const valid = await AuthService.validateSession(state.user!.id, sessionToken);
      if (!valid) {
        invalidateSession();
      }
    };

    void validate();
    validationRef.current = setInterval(() => {
      void validate();
    }, 30_000);

    const handleFocus = () => {
      void validate();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      if (validationRef.current) {
        clearInterval(validationRef.current);
        validationRef.current = null;
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [state.user, invalidateSession]);

  // Session timeout check every minute
  useEffect(() => {
    if (!state.user?.session_timeout_minutes) {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    const minutes = state.user.session_timeout_minutes;
    const type = state.user.session_timeout_type ?? 'since_login';

    function getExpiry(): number | null {
      try {
        if (type === 'since_login') {
          const at = localStorage.getItem(AuthService.authStorageKeys.loggedInAt);
          if (!at) return null;
          return parseInt(at, 10) + minutes * 60 * 1000;
        }
        const at = localStorage.getItem(AuthService.authStorageKeys.lastActivityAt);
        if (!at) return null;
        return parseInt(at, 10) + minutes * 60 * 1000;
      } catch {
        return null;
      }
    }

    const check = () => {
      const expiry = getExpiry();
      if (expiry != null && Date.now() >= expiry) {
        if (timeoutRef.current) clearInterval(timeoutRef.current);
        timeoutRef.current = null;
        const sessionToken = localStorage.getItem(AuthService.authStorageKeys.sessionToken);
        AuthService.logout(state.user!.id, sessionToken).catch(() => {});
        clearSession();
        window.location.replace('/login');
      }
    };

    check();
    timeoutRef.current = setInterval(check, 60 * 1000);
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [state.user?.id, state.user?.session_timeout_minutes, state.user?.session_timeout_type, clearSession]);

  // Inactivity: update lastActivityAt on user interaction
  useEffect(() => {
    if (!state.user || state.user.session_timeout_type !== 'inactivity') return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => updateLastActivity();
    events.forEach((e) => window.addEventListener(e, handler));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [state.user?.id, state.user?.session_timeout_type, updateLastActivity]);

  const signIn = useCallback(
    async (credentials: LoginCredentials, options: LoginOptions = {}) => {
      const result = await AuthService.login(credentials, options);
      if (result.status === 'conflict') {
        return result;
      }

      const visibility: UserPageVisibility = await AuthService.getUserPageVisibility(result.user.id);
      const merged: AppUser = { ...result.user, page_visibility: visibility };
      const now = Date.now().toString();
      try {
        localStorage.setItem(AuthService.authStorageKeys.user, JSON.stringify(merged));
        localStorage.setItem(AuthService.authStorageKeys.sessionToken, result.sessionToken);
        localStorage.setItem(AuthService.authStorageKeys.loggedInAt, now);
        localStorage.setItem(AuthService.authStorageKeys.lastActivityAt, now);
      } catch (e) {
        throw new Error('Sessie opslaan mislukt');
      }
      setState({ user: merged, loading: false });
      return result;
    },
    []
  );

  const signOut = useCallback(async () => {
    const sessionToken = localStorage.getItem(AuthService.authStorageKeys.sessionToken);
    if (state.user) await AuthService.logout(state.user.id, sessionToken).catch(() => {});
    clearSession();
  }, [state.user, clearSession]);

  const isAdmin = useCallback(() => state.user?.role === 'admin', [state.user?.role]);
  const isSuperUser = useCallback(() => state.user?.role === 'super_user', [state.user?.role]);
  const isSuperUserOrAdmin = useCallback(
    () => state.user?.role === 'admin' || state.user?.role === 'super_user',
    [state.user?.role]
  );

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    refreshUser,
    isAdmin,
    isSuperUser,
    isSuperUserOrAdmin,
    updateLastActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
