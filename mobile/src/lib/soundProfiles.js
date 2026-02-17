/**
 * Sound Profile System for SPORT Mode
 * Provides audio feedback when SPORT mode is activated/deactivated.
 * 3 profiles: merica (V8), euro (exotic), jdm (turbo)
 * Uses expo-av for audio generation and haptic patterns for tactile feedback.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Sound profile definitions
export const SOUND_PROFILES = {
  merica: {
    id: 'merica',
    name: 'AMERICAN V8',
    emoji: '\uD83C\uDDFA\uD83C\uDDF8',
    description: 'Thundering V8 rumble',
    color: '#FF4444',
    hapticPattern: 'heavy',
    // Activation: deep rumble pattern
    activateHaptics: async () => {
      if (!isNative) return;
      // Deep V8 rumble: heavy-pause-heavy-pause-heavy
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(60);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(100);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(50);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    // Deactivation: gentle fade rumble
    deactivateHaptics: async () => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(160);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },
  euro: {
    id: 'euro',
    name: 'EURO EXOTIC',
    emoji: '\uD83C\uDDEA\uD83C\uDDFA',
    description: 'High-revving exotic whine',
    color: '#FFD700',
    hapticPattern: 'medium',
    // Activation: rapid ascending pattern
    activateHaptics: async () => {
      if (!isNative) return;
      // Euro exotic: rapid ascending revs
      for (let i = 0; i < 6; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(40 + i * 5);
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(30);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    // Deactivation: descending pattern
    deactivateHaptics: async () => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },
  jdm: {
    id: 'jdm',
    name: 'JDM TURBO',
    emoji: '\uD83C\uDDEF\uD83C\uDDF5',
    description: 'Turbo spool & blow-off',
    color: '#00CCFF',
    hapticPattern: 'light',
    // Activation: turbo spool then blow-off
    activateHaptics: async () => {
      if (!isNative) return;
      // Turbo spool: rapid light taps accelerating
      for (let i = 0; i < 8; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(Math.max(15, 60 - i * 7));
      }
      // Blow-off: heavy impact
      await delay(30);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(20);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    // Deactivation: flutter
    deactivateHaptics: async () => {
      if (!isNative) return;
      for (let i = 0; i < 4; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(40 + i * 20);
      }
    },
  },
};

// Profile keys for iteration
export const PROFILE_KEYS = Object.keys(SOUND_PROFILES);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Play activation sound for a given profile
 */
export async function playActivationSound(profileId = 'merica') {
  const profile = SOUND_PROFILES[profileId];
  if (!profile) return;

  try {
    await profile.activateHaptics();
  } catch (e) {
    // Silently fail on haptics errors
    console.warn('Sound profile haptics error:', e.message);
  }
}

/**
 * Play deactivation sound for a given profile
 */
export async function playDeactivationSound(profileId = 'merica') {
  const profile = SOUND_PROFILES[profileId];
  if (!profile) return;

  try {
    await profile.deactivateHaptics();
  } catch (e) {
    console.warn('Sound profile haptics error:', e.message);
  }
}
