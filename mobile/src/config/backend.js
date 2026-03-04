import Constants from 'expo-constants';
import { getBackendUrlOverride } from './backendOverride';

/**
 * Hardcoded fallback URL — ensures the app ALWAYS has a valid backend URL
 * even when .env is missing, AsyncStorage is cleared, or the app is freshly installed.
 *
 * This is the ROOT FIX for the persistent 404 error. Previous versions returned
 * an empty string when no env var was set, causing all API calls to fail.
 *
 * Updated on each deployment. EXPO_PUBLIC_BACKEND_URL in .env takes priority.
 */
const FALLBACK_BACKEND_URL = 'https://2df4e716-9ac1-495b-84db-1256279b5353.preview.emergentagent.com';

/**
 * Sanitize a backend base URL.
 * - Strips trailing slashes
 * - Strips a trailing /api path segment (common user mistake when entering
 *   the URL manually — the app always appends /api/... itself)
 */
function sanitizeBase(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/\/$/, '');
  clean = clean.replace(/\/api$/, '');
  return clean;
}

/**
 * Get the backend URL synchronously.
 * Priority chain: env var → Expo config → web origin → hardcoded fallback
 */
export function getBackendUrl() {
  // 1. EXPO_PUBLIC_BACKEND_URL env var (highest priority – set via .env or EAS build)
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return sanitizeBase(fromEnv);
  }

  // 2. Expo config extra (populated by app.config.js from the same env var)
  const extra = Constants?.expoConfig?.extra;
  const fromExtra = extra?.backendUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return sanitizeBase(fromExtra);
  }

  // 3. Web platform: derive from current window.location.origin (auto-detection)
  if (typeof window !== 'undefined' && window.location?.origin &&
      window.location.origin !== 'null' && window.location.protocol?.startsWith('http')) {
    return sanitizeBase(window.location.origin);
  }

  // 4. Hardcoded fallback — ALWAYS available, prevents empty-URL failures
  return sanitizeBase(FALLBACK_BACKEND_URL);
}

/**
 * Get the backend URL asynchronously.
 * Checks user AsyncStorage override first (manual in-app config), then falls back.
 */
export async function getBackendUrlAsync() {
  const override = await getBackendUrlOverride();
  if (override && override.trim().length > 0) return sanitizeBase(override);
  return getBackendUrl();
}

export async function buildApiUrlAsync(path) {
  const base = await getBackendUrlAsync();
  if (!base) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function buildApiUrl(path) {
  const base = getBackendUrl();
  if (!base) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
