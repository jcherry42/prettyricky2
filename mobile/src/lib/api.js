import { buildApiUrlAsync } from '../config/backend';
import { useToast } from '../context/ToastContext';

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Check if an error is retryable (network errors, 5xx, timeout)
 */
function isRetryable(error) {
  if (error.code === 'TIMEOUT') return true;
  if (error.code === 'NETWORK_ERROR') return true;
  if (error.status >= 500 && error.status < 600) return true;
  if (error.message?.includes('Network request failed')) return true;
  if (error.message?.includes('fetch')) return true;
  return false;
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enhanced API fetch with retry logic and timeout handling.
 * - Automatic retry with exponential backoff for network/server errors
 * - Configurable timeout
 * - Clean error objects with status codes
 */
export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

  const maxRetries = options.retries ?? MAX_RETRIES;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      // Determine if we should use Content-Type: application/json
      const headers = { ...(options.headers || {}) };
      if (!options.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers,
      };
      // Remove custom keys
      delete fetchOptions.retries;
      delete fetchOptions.timeout;
      delete fetchOptions.isFormData;

      const res = await fetch(url, fetchOptions);
      clearTimeout(timer);

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        const err = new Error(json?.detail || `Request failed: ${res.status}`);
        err.status = res.status;
        err.payload = json;

        // Only retry on server errors
        if (isRetryable(err) && attempt < maxRetries) {
          lastError = err;
          await delay(RETRY_DELAYS[attempt] || 4000);
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
          await delay(RETRY_DELAYS[attempt] || 4000);
          continue;
        }

        throw err;
      }

      // Network errors - retryable
      if (isRetryable(e) && attempt < maxRetries) {
        lastError = e;
        await delay(RETRY_DELAYS[attempt] || 4000);
        continue;
      }

      throw e;
    }
  }

  // All retries exhausted
  if (lastError) {
    lastError.message = `${lastError.message} (after ${maxRetries + 1} attempts)`;
    throw lastError;
  }
}
