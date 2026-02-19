import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sc_v1_backend_url_override';

export async function getBackendUrlOverride() {
  try {
    const url = await AsyncStorage.getItem(KEY);
    return url || '';
  } catch {
    return '';
  }
}

export async function setBackendUrlOverride(url) {
  const clean = String(url || '').trim().replace(/\/$/, '');
  if (!clean) {
    await AsyncStorage.removeItem(KEY);
    return '';
  }
  await AsyncStorage.setItem(KEY, clean);
  return clean;
}

export async function clearBackendUrlOverride() {
  await AsyncStorage.removeItem(KEY);
}
