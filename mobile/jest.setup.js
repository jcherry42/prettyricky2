// jest.setup.js — global mocks for React Native modules used by the app

// Expo SDK 54 runtime expects certain globals in test env
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}
globalThis.__ExpoImportMetaRegistry = new Proxy({}, {
  get: () => () => '',
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: (props) => React.createElement(Text, null, props.name) };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { backendUrl: '' } } },
}));

// Mock the api module
jest.mock('./src/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ translated_text: 'Hola' })),
}));

// Mock sms module
jest.mock('./src/lib/sms', () => ({
  textCustomer: jest.fn(() => Promise.resolve({ success: true })),
  sendTowerTalkSms: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock haptics
jest.mock('./src/lib/haptics', () => ({
  impactMedium: jest.fn(),
  impactLight: jest.fn(),
  notificationSuccess: jest.fn(),
  notificationError: jest.fn(),
}));
