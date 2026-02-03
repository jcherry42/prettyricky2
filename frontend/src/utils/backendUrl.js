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
  // 1. Build-time injected Vite env variable (CRITICAL for Capacitor builds)
  // This MUST be set in .env or .env.production files
  const envUrl = normalizeBackendUrl(import.meta.env.VITE_BACKEND_URL);
  
  // Log for debugging in development
  if (import.meta.env.DEV) {
    console.log('[BackendURL Debug]', {
      rawEnv: import.meta.env.VITE_BACKEND_URL,
      normalized: envUrl,
      isCapacitor: isCapacitorOrigin(),
      mode: import.meta.env.MODE,
      allEnvVars: import.meta.env
    });
  }
  
  if (envUrl) {
    // In Capacitor builds, always log the backend URL for verification
    if (isCapacitorOrigin()) {
      console.log('[BackendURL] Using build-time URL in Capacitor:', envUrl);
    }
    return envUrl;
  }

  // 2. Native fallback: user-configured endpoint stored on device
  if (typeof window !== 'undefined') {
    const stored = normalizeBackendUrl(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      console.log('[BackendURL] Using stored URL from localStorage:', stored);
      return stored;
    }

    // 3. Web fallback: same-origin API (only for non-Capacitor web builds)
    if (!isCapacitorOrigin()) {
      const webOrigin = window.location.origin;
      console.log('[BackendURL] Using web origin:', webOrigin);
      return webOrigin;
    }
  }

  // 4. No valid backend URL found - this is an error state for Capacitor
  console.error('[BackendURL] CRITICAL: No backend URL configured!', {
    envVarSet: !!import.meta.env.VITE_BACKEND_URL,
    isCapacitor: isCapacitorOrigin(),
    mode: import.meta.env.MODE
  });
  
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
