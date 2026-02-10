import { buildApiUrl } from '../config/backend';

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  if (!url) {
    const err = new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');
    err.code = 'BACKEND_URL_MISSING';
    throw err;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

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
}
