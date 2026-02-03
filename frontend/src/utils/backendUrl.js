const STORAGE_KEY = 'superchargd_backend_url';

export function isCapacitorOrigin() {
  if (typeof window === 'undefined') return false;
  const origin = window.location?.origin || '';
  const protocol = window.location?.protocol || '';
  return protocol === 'capacitor:' || origin.startsWith('capacitor://');
}

export function normalizeBackendUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) return '';
  return u.replace(/\/$/, '');
}

export function getBackendUrl() {
  // Preferred: build-time injected Vite env
  const envUrl = normalizeBackendUrl(import.meta.env.VITE_BACKEND_URL);
  if (envUrl) return envUrl;

  // Native fallback: user-configured endpoint stored on device
  if (typeof window !== 'undefined') {
    const stored = normalizeBackendUrl(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;

    // Web fallback: same-origin API
    if (!isCapacitorOrigin()) {
      return window.location.origin;
    }
  }

  // Native with no config = cannot call API.
  return '';
}

export function setBackendUrl(url) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeBackendUrl(url);
  if (normalized) {
    localStorage.setItem(STORAGE_KEY, normalized);
  }
}

export function clearBackendUrl() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
