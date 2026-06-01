import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

const ACCESS_KEY = 'sc_access_token';
const REFRESH_KEY = 'sc_refresh_token';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
  lockoutUntil: Date | null;
  pendingResetCode: string | null;
  login: (pin: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<boolean>;
  resetPin: (resetCode: string) => Promise<boolean>;
  dismissResetCode: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — manages PIN auth lifecycle with JWT tokens.
 *
 * Flow:
 *   1. App mount → check SecureStore for refresh token
 *   2. If valid refresh → auto-refresh access token → authenticated
 *   3. If no tokens → show PIN screen (setup or login)
 *   4. All API calls via apiFetch include Bearer token
 *   5. On 401 → attempt refresh → if fail → lock screen
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [pendingResetCode, setPendingResetCode] = useState<string | null>(null); // shown once after setup
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  // Store tokens securely
  const _storeTokens = useCallback(async (access: string, refresh: string) => {
    accessTokenRef.current = access;
    refreshTokenRef.current = refresh;
    try {
      await SecureStore.setItemAsync(ACCESS_KEY, access);
      if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    } catch (e: any) {
      // SecureStore might fail on some devices — fallback to memory-only
      console.warn('[Auth] SecureStore write failed:', e.message);
    }
  }, []);

  const _clearTokens = useCallback(async () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    try {
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch (e: any) {
      console.warn('[Auth] SecureStore clear failed:', e.message);
    }
  }, []);

  // Attempt to refresh the access token using the refresh token
  const refreshAccessToken = useCallback(async () => {
    const rt = refreshTokenRef.current;
    if (!rt) return false;

    try {
      const data = await apiFetch('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: rt }),
        _skipAuth: true, // Don't add Bearer header for this call
      });
      if (data?.access_token) {
        await _storeTokens(data.access_token, rt);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [_storeTokens]);

  // Boot-time: check if we have valid tokens
  useEffect(() => {
    (async () => {
      try {
        // 1. Check if PIN is configured
        const statusRes = await apiFetch('/api/auth/status', { _skipAuth: true });
        setNeedsSetup(!statusRes?.pin_set);

        if (!statusRes?.pin_set) {
          setIsLoading(false);
          return;
        }

        // 2. Try to restore tokens from SecureStore
        const storedAccess = await SecureStore.getItemAsync(ACCESS_KEY).catch((): string | null => null);
        const storedRefresh = await SecureStore.getItemAsync(REFRESH_KEY).catch((): string | null => null);

        if (storedAccess && storedRefresh) {
          accessTokenRef.current = storedAccess;
          refreshTokenRef.current = storedRefresh;

          // 3. Verify access token
          try {
            const verifyRes = await apiFetch('/api/auth/verify', {
              headers: { Authorization: `Bearer ${storedAccess}` },
              _skipAuth: true,
            });
            if (verifyRes?.valid) {
              setIsAuthenticated(true);
              setIsLoading(false);
              return;
            }
          } catch {
            // Access token expired — try refresh
          }

          // 4. Refresh
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        }

        // No valid tokens — need PIN entry
        await _clearTokens();
      } catch (e: any) {
        console.warn('[Auth] Boot check failed:', e.message);
      }
      setIsLoading(false);
    })();
  }, [refreshAccessToken, _clearTokens]);

  // Login with PIN — reads lockout details from 429 / 401 responses
  const login = useCallback(async (pin: string) => {
    setError(null);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ pin }),
        _skipAuth: true,
      });
      if (data?.success && data.access_token) {
        await _storeTokens(data.access_token, data.refresh_token);
        setIsAuthenticated(true);
        setNeedsSetup(false);
        setLockoutUntil(null);
        return true;
      }
      setError('Invalid PIN');
      return false;
    } catch (e: any) {
      const msg = e?.message || '';
      // Parse lockout duration from 429 detail
      const lockMatch = msg.match(/(\d+)\s*second/);
      if (lockMatch) {
        const seconds = parseInt(lockMatch[1], 10);
        setLockoutUntil(new Date(Date.now() + seconds * 1000));
        setError(`Too many attempts. Locked for ${seconds}s.`);
      } else if (msg.includes('Invalid PIN') || msg.includes('401')) {
        setError(msg.replace(/^.*?:\s*/, '')); // strip "Error: " prefix
      } else {
        setError('Connection error. Try again.');
      }
      return false;
    }
  }, [_storeTokens]);

  // Setup new PIN — returns reset_code that must be shown to user once
  const setupPin = useCallback(async (pin: string) => {
    setError(null);
    try {
      const data = await apiFetch('/api/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
        _skipAuth: true,
      });
      if (data?.success && data.access_token) {
        await _storeTokens(data.access_token, data.refresh_token);
        // Store reset code temporarily so PinScreen can display it
        if (data.reset_code) setPendingResetCode(data.reset_code);
        setIsAuthenticated(true);
        setNeedsSetup(false);
        return true;
      }
      setError('Setup failed. Try again.');
      return false;
    } catch (e: any) {
      setError(e?.message || 'Setup failed');
      return false;
    }
  }, [_storeTokens]);

  // Reset PIN using the master reset code — wipes PIN record, returns to setup
  const resetPin = useCallback(async (resetCode: string) => {
    setError(null);
    try {
      const data = await apiFetch('/api/auth/reset-pin', {
        method: 'POST',
        body: JSON.stringify({ reset_code: resetCode.toUpperCase().trim() }),
        _skipAuth: true,
      });
      if (data?.success) {
        await _clearTokens();
        setIsAuthenticated(false);
        setNeedsSetup(true);
        setLockoutUntil(null);
        return true;
      }
      return false;
    } catch (e: any) {
      const msg = e?.message || 'Invalid reset code';
      setError(msg.replace(/^.*?:\s*/, ''));
      return false;
    }
  }, [_clearTokens]);

  const dismissResetCode = useCallback(() => setPendingResetCode(null), []);

  // Logout — clear tokens, lock screen
  const logout = useCallback(async () => {
    await _clearTokens();
    setIsAuthenticated(false);
  }, [_clearTokens]);

  // Get current access token (for apiFetch integration)
  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  const value = {
    isAuthenticated,
    isLoading,
    needsSetup,
    error,
    lockoutUntil,
    pendingResetCode,
    login,
    setupPin,
    resetPin,
    dismissResetCode,
    logout,
    getAccessToken,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
