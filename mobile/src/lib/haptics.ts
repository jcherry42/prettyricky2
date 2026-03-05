import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Unified haptics helper. Silent on web.
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export function impactLight() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function impactMedium() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function impactHeavy() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function notificationSuccess() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notificationError() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function selectionTap() {
  if (isNative) Haptics.selectionAsync().catch(() => {});
}
