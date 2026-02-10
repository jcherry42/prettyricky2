import { buildApiUrl } from '../config/backend';

const DEFAULT_TIMEOUT = 15000;

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

  const controller = new AbortController();
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

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
      throw err;
    }

    return json;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const err = new Error(`Request timed out after ${timeout / 1000}s`);
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  }
}
