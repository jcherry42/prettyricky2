import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
