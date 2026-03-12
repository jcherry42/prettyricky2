import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sc_v1_backend_url_override';

export async function getBackendUrlOverride(): Promise<string> {
  try {
    const url = await AsyncStorage.getItem(KEY);
    return url || '';
  } catch {
    return '';
  }
}

export async function setBackendUrlOverride(url: string): Promise<string> {
  const clean = String(url || '').trim().replace(/\/$/, '');
  if (!clean) {
    await AsyncStorage.removeItem(KEY);
    return '';
  }
  await AsyncStorage.setItem(KEY, clean);
  return clean;
}

export async function clearBackendUrlOverride(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
