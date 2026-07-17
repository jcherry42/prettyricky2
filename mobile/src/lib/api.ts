import { buildApiUrlAsync } from '../config/backend';

const DEFAULT_TIMEOUT = 12000;
const MAX_RETRIES = 1; // Reduced: fast fail is better UX than silent 4x retry
const RETRY_DELAYS = [1200, 3000];

// ----- Extended Error type for API errors --------------------------------
interface ApiError extends Error {
  status?: number;
  payload?: unknown;
  code?: string;
}

// ----- URL cache --------------------------------------------------------
let _urlCache: string | null = null;

export function invalidateUrlCache() {
  _urlCache = null;
}

async function getBaseUrl(path: string): Promise<string | null> {
  if (_urlCache) {
    const base = _urlCache.replace(/\/$/, '');
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${base}${clean}`;
  }
  const url = await buildApiUrlAsync(path);
  if (url) {
    try {
      const parsed = new URL(url);
      _urlCache = `${parsed.protocol}//${parsed.host}`;
    } catch {
      const base = url.replace(path, '').replace(/\/$/, '');
      _urlCache = base;
    }
  }
  return url;
}

/** Return type from an API call — kept loose because callers narrow to their own shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResult = any;
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: string | FormData | null;
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
  isFormData?: boolean;
  // Internal / legacy hooks — kept for backward compatibility
  _skipAuth?: boolean;
  _noRetryRefresh?: boolean;
}

// ----- Inflight GET deduplication ---------------------------------------
const _inflight = new Map<string, Promise<ApiResult>>();

// ----- Token refresh ---------------------------------------------------
// SecureStore keys (kept in sync with AuthContext)
const ACCESS_KEY = 'sc_access_token';
const REFRESH_KEY = 'sc_refresh_token';

// Shared refresh promise so multiple concurrent 401s only trigger ONE refresh.
let _refreshPromise: Promise<string | null> | null = null;

// Callback invoked when refresh fails — AuthContext registers this to force logout.
let _onRefreshFailure: (() => void) | null = null;

export function onRefreshFailure(cb: () => void) {
  _onRefreshFailure = cb;
}

async function _readToken(key: string): Promise<string | null> {
  try {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function _writeAccessToken(token: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(ACCESS_KEY, token);
  } catch {
    // SecureStore unavailable — token lives in memory via the next apiFetch call
  }
}

async function _writeRefreshToken(token: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } catch {
    // SecureStore unavailable
  }
}

/**
 * Attempt to exchange the refresh token for a fresh access token.
 * Returns the new access token on success, null on failure.
 *
 * All concurrent callers share the same in-flight refresh promise so we never
 * burst the backend with multiple refresh attempts when several requests
 * 401 at the same time.
 */
async function _refreshAccessToken(baseUrl: string): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const rt = await _readToken(REFRESH_KEY);
    if (!rt) return null;

    try {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const newToken = json?.access_token;
      const newRefresh = json?.refresh_token;
      if (newToken) {
        await _writeAccessToken(newToken);
        // Backend rotates refresh tokens — persist the new one so the old jti
        // (already revoked server-side) never gets reused.
        if (newRefresh) {
          await _writeRefreshToken(newRefresh);
        }
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      // Clear the shared lock after this attempt completes
      setTimeout(() => { _refreshPromise = null; }, 0);
    }
  })();

  return _refreshPromise;
}

function isRetryable(error: unknown): boolean {
  const e = error as { code?: string; status?: number; message?: string };
  if (e?.code === 'TIMEOUT') return true;
  if (e?.code === 'NETWORK_ERROR') return true;
  if (typeof e?.status === 'number' && e.status >= 500 && e.status < 600) return true;
  if (e?.message?.includes('Network request failed')) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _doFetch(url: string, options: ApiFetchOptions) {
  const maxRetries = options.retries ?? MAX_RETRIES;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };

      // For FormData bodies let the runtime set Content-Type (with boundary).
      // For everything else default to JSON.
      const isForm = options.isFormData || (options.body instanceof FormData);
      if (isForm) {
        delete headers['Content-Type'];
      } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const fetchOptions: RequestInit & { retries?: number; timeout?: number; isFormData?: boolean } = {
        ...options,
        signal: controller.signal,
        headers,
        body: options.body ?? undefined,
      };
      delete fetchOptions.retries;
      delete fetchOptions.timeout;
      delete fetchOptions.isFormData;

      const res = await fetch(url, fetchOptions);
      clearTimeout(timer);

      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

      if (!res.ok) {
        // 404 auto-recovery: if the cached URL produced a 404, clear the cache
        // and retry with a freshly resolved URL. This handles stale URL cache
        // scenarios that previously caused persistent 404 errors.
        if (res.status === 404 && _urlCache && attempt === 0) {
          _urlCache = null;
          lastError = new Error(`404 at ${url} — retrying with fresh URL`) as ApiError;
          (lastError as ApiError).status = 404;
          continue;
        }

        const err = new Error(
          res.status === 404
            ? `Not found (404): ${url} — verify your backend URL in Command Center → Settings`
            : (json?.detail || `Request failed: ${res.status}`)
        ) as ApiError;
        err.status = res.status;
        err.payload = json;
        if (isRetryable(err) && attempt < maxRetries) {
          lastError = err;
          await delay(RETRY_DELAYS[attempt] || 3000);
          continue;
        }
        throw err;
      }

      return json;
    } catch (e: unknown) {
      clearTimeout(timer);

      if (e instanceof Error && e.name === 'AbortError') {
        const err = new Error(`Request timed out after ${timeout / 1000}s`) as ApiError;
        err.code = 'TIMEOUT';
        if (attempt < maxRetries) {
          lastError = err;
          await delay(RETRY_DELAYS[attempt] || 3000);
          continue;
        }
        throw err;
      }

      if (isRetryable(e) && attempt < maxRetries) {
        lastError = e as ApiError;
        await delay(RETRY_DELAYS[attempt] || 3000);
        continue;
      }

      throw e;
    }
  }

  if (lastError) {
    lastError.message = `${lastError.message} (after ${maxRetries + 1} attempts)`;
    throw lastError;
  }
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<ApiResult> {
  const url = await getBaseUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL or configure in-app.') as ApiError;
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

  // Auto-inject Bearer token unless _skipAuth is set
  if (!options._skipAuth) {
    const token = await _readToken(ACCESS_KEY);
    if (token) {
      options.headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  const skipAuth = Boolean(options._skipAuth);
  const noRetryRefresh = Boolean(options._noRetryRefresh);
  // Remove internal flags before passing to fetch
  delete options._skipAuth;
  delete options._noRetryRefresh;

  const method = (options.method || 'GET').toUpperCase();

  // Wrap _doFetch with 401 → refresh → retry once.
  const fetchWithRefresh = async (): Promise<ApiResult> => {
    try {
      return await _doFetch(url, options);
    } catch (e: unknown) {
      // Only refresh on a real 401 from a request that ought to be authenticated.
      // Skip if the caller opted out, this IS the refresh call, or this was a retry attempt.
      if ((e as { status?: number })?.status !== 401 || skipAuth || noRetryRefresh || path.startsWith('/api/auth/')) {
        throw e;
      }

      // Resolve the backend base URL via the module's URL cache (already populated by getBaseUrl above).
      const baseUrl = _urlCache || url.replace(path, '').replace(/\/$/, '');
      const newAccess = await _refreshAccessToken(baseUrl);
      if (!newAccess) {
        // Refresh failed — caller is no longer authenticated. Notify AuthContext.
        if (_onRefreshFailure) {
          try { _onRefreshFailure(); } catch { /* ignore */ }
        }
        throw e;
      }

      // Retry the original request once with the new token.
      options.headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      };
      options._noRetryRefresh = true; // belt-and-suspenders against loops
      return _doFetch(url, options);
    }
  };

  // Deduplicate concurrent identical GET requests
  if (method === 'GET') {
    const key = url;
    if (_inflight.has(key)) return _inflight.get(key);
    const promise = fetchWithRefresh().finally(() => _inflight.delete(key));
    _inflight.set(key, promise);
    return promise;
  }

  return fetchWithRefresh();
}
