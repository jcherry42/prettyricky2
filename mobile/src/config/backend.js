import Constants from 'expo-constants';
import { getBackendUrlOverride } from './backendOverride';

/**
 * Sanitize a backend base URL.
 * - Strips trailing slashes
 * - Strips a trailing /api path segment (common user mistake when entering
 *   the URL manually — the app always appends /api/... itself)
 */
function sanitizeBase(url) {
  if (!url || typeof url !== 'string') return '';
  // Strip trailing slash first
  let clean = url.trim().replace(/\/$/, '');
  // Strip trailing /api segment so double-/api paths never form
  clean = clean.replace(/\/api$/, '');
  return clean;
}

export function getBackendUrl() {
  // Expo recommends EXPO_PUBLIC_* vars; also supports EAS updates.
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return sanitizeBase(fromEnv);
  }

  const extra = Constants?.expoConfig?.extra;
  const fromExtra = extra?.backendUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return sanitizeBase(fromExtra);
  }

  return '';
}

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
