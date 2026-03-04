import { buildApiUrlAsync } from '../config/backend';

const DEFAULT_TIMEOUT = 12000;
const MAX_RETRIES = 1; // Reduced: fast fail is better UX than silent 4x retry
const RETRY_DELAYS = [1200, 3000];

// ----- URL cache --------------------------------------------------------
// buildApiUrlAsync reads AsyncStorage every call. We resolve it once and
// cache it for the lifetime of the session. Call invalidateUrlCache() if
// the user changes the backend URL in settings.
let _urlCache = null;

export function invalidateUrlCache() {
  _urlCache = null;
}

async function getBaseUrl(path) {
  if (_urlCache) {
    // Re-append path to cached base
    const base = _urlCache.replace(/\/$/, '');
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${base}${clean}`;
  }
  const url = await buildApiUrlAsync(path);
  if (url) {
    // Store just the base (strip the path component) using URL parsing for robustness
    try {
      const parsed = new URL(url);
      _urlCache = `${parsed.protocol}//${parsed.host}`;
    } catch {
      // Fallback: naive string replace
      const base = url.replace(path, '').replace(/\/$/, '');
      _urlCache = base;
    }
  }
  return url;
}

// ----- Inflight GET deduplication ---------------------------------------
// If two components fire the same GET simultaneously we resolve both from
// a single network request.
const _inflight = new Map();

function isRetryable(error) {
  if (error.code === 'TIMEOUT') return true;
  if (error.code === 'NETWORK_ERROR') return true;
  if (error.status >= 500 && error.status < 600) return true;
  if (error.message?.includes('Network request failed')) return true;
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _doFetch(url, options) {
  const maxRetries = options.retries ?? MAX_RETRIES;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let lastError = null;

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
        const err = new Error(
          res.status === 404
            ? `Not found (404): ${url} — check your backend URL in Command Center → Settings → Backend`
            : (json?.detail || `Request failed: ${res.status}`)
        );
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
    } catch (e) {
      clearTimeout(timer);

      if (e.name === 'AbortError') {
        const err = new Error(`Request timed out after ${timeout / 1000}s`);
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

export async function apiFetch(path, options = {}) {
  const url = await getBaseUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL or configure in-app.');
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

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
