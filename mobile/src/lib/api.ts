import { buildApiUrlAsync } from '../config/backend';

const DEFAULT_TIMEOUT = 12000;
const MAX_RETRIES = 1; // Reduced: fast fail is better UX than silent 4x retry
const RETRY_DELAYS = [1200, 3000];

// ----- Extended Error type for API errors --------------------------------
interface ApiError extends Error {
  status?: number;
  payload?: any;
  code?: string;
}

// ----- URL cache --------------------------------------------------------
let _urlCache: string | null = null;

export function invalidateUrlCache() {
  _urlCache = null;
}

/**
 * Health check — pings /api/health to verify backend connectivity.
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    const url = await getBaseUrl('/api/health');
    if (!url) return { ok: false, url: '', error: 'No backend URL configured' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { ok: true, url, latencyMs };
    }
    return { ok: false, url, error: `HTTP ${res.status}`, latencyMs };
  } catch (e: any) {
    return { ok: false, url: _urlCache || '', error: e.message, latencyMs: Date.now() - start };
  }
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

// ----- Inflight GET deduplication ---------------------------------------
const _inflight = new Map<string, Promise<any>>();

function isRetryable(error: any): boolean {
  if (error.code === 'TIMEOUT') return true;
  if (error.code === 'NETWORK_ERROR') return true;
  if (error.status >= 500 && error.status < 600) return true;
  if (error.message?.includes('Network request failed')) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _doFetch(url: string, options: any) {
  const maxRetries = options.retries ?? MAX_RETRIES;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = { ...(options.headers || {}) };
      if (!options.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const fetchOptions = { ...options, signal: controller.signal, headers };
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
    } catch (e: any) {
      clearTimeout(timer);

      if (e.name === 'AbortError') {
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
        lastError = e;
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

export async function apiFetch(path: string, options: any = {}) {
  const url = await getBaseUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL or configure in-app.') as ApiError;
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

  // Auto-inject Bearer token unless _skipAuth is set
  if (!options._skipAuth) {
    try {
      const SecureStore = require('expo-secure-store');
      const token = await SecureStore.getItemAsync('sc_access_token');
      if (token) {
        options.headers = {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        };
      }
    } catch {
      // SecureStore not available (e.g., web) — continue without token
    }
  }
  // Remove internal flag before passing to fetch
  delete options._skipAuth;

  const method = (options.method || 'GET').toUpperCase();

  // Deduplicate concurrent identical GET requests
  if (method === 'GET') {
    const key = url;
    if (_inflight.has(key)) return _inflight.get(key);
    const promise = _doFetch(url, options).finally(() => _inflight.delete(key));
    _inflight.set(key, promise);
    return promise;
  }

  return _doFetch(url, options);
}
