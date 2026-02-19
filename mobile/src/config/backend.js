import Constants from 'expo-constants';
import { getBackendUrlOverride } from './backendOverride';

export function getBackendUrl() {
  // Expo recommends EXPO_PUBLIC_* vars; also supports EAS updates.
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  const extra = Constants?.expoConfig?.extra;
  const fromExtra = extra?.backendUrl;
  if (fromExtra && typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim().replace(/\/$/, '');
  }

  return '';
}

export async function getBackendUrlAsync() {
  const override = await getBackendUrlOverride();
  if (override && override.trim().length > 0) return override.trim().replace(/\/$/, '');
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
