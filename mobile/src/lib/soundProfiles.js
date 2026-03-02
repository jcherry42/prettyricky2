/**
 * Sound Profile System for SPORT Mode
 *
 * 3 engine sound profiles:
 *   merica — American V8 thundering rumble
 *   euro   — Euro exotic high-revving whine
 *   jdm    — JDM turbo spool + blow-off valve
 *
 * Each profile plays:
 *   1. A synthesized engine WAV (from /assets/sounds/) via expo-av
 *   2. A haptic pattern that matches the engine character
 *
 * Audio files are generated at build time by scripts/generate_engine_sounds.py
 * and bundled as static assets — no network required.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// ── Static asset map ────────────────────────────────────────────────────────
// All 6 WAV files live at mobile/assets/sounds/ and are bundled with the app.
const AUDIO_ASSETS = {
  merica: {
    activate: require('../../assets/sounds/merica_activate.wav'),
    deactivate: require('../../assets/sounds/merica_deactivate.wav'),
  },
  euro: {
    activate: require('../../assets/sounds/euro_activate.wav'),
    deactivate: require('../../assets/sounds/euro_deactivate.wav'),
  },
  jdm: {
    activate: require('../../assets/sounds/jdm_activate.wav'),
    deactivate: require('../../assets/sounds/jdm_deactivate.wav'),
  },
};

// ── Audio mode setup (called once before any playback) ──────────────────────
let audioModeSet = false;

async function ensureAudioMode() {
  if (audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,    // Sport mode is user-initiated — always play the engine sound
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
    audioModeSet = true;
  } catch {
    // silently ignore — audio will still work on most devices
  }
}

// ── Haptic patterns (profile-specific tactile feedback) ─────────────────────
const HAPTICS = {
  merica: {
    activate: async () => {
      if (!isNative) return;
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
    deactivate: async () => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(160);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },
  euro: {
    activate: async () => {
      if (!isNative) return;
      for (let i = 0; i < 6; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(40 + i * 5);
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(30);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    deactivate: async () => {
      if (!isNative) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(120);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  },
  jdm: {
    activate: async () => {
      if (!isNative) return;
      for (let i = 0; i < 8; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(Math.max(15, 60 - i * 7));
      }
      await delay(30);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(20);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    deactivate: async () => {
      if (!isNative) return;
      for (let i = 0; i < 4; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await delay(40 + i * 20);
      }
    },
  },
};

// ── Sound profile definitions (metadata only) ───────────────────────────────
export const SOUND_PROFILES = {
  merica: {
    id: 'merica',
    name: 'AMERICAN V8',
    emoji: '\uD83C\uDDFA\uD83C\uDDF8',
    description: 'Thundering V8 rumble',
    color: '#FF4444',
    hapticPattern: 'heavy',
  },
  euro: {
    id: 'euro',
    name: 'EURO EXOTIC',
    emoji: '\uD83C\uDDEA\uD83C\uDDFA',
    description: 'High-revving exotic whine',
    color: '#FFD700',
    hapticPattern: 'medium',
  },
  jdm: {
    id: 'jdm',
    name: 'JDM TURBO',
    emoji: '\uD83C\uDDEF\uD83C\uDDF5',
    description: 'Turbo spool & blow-off',
    color: '#00CCFF',
    hapticPattern: 'light',
  },
};

export const PROFILE_KEYS = Object.keys(SOUND_PROFILES);

// ── Core audio playback helper ───────────────────────────────────────────────

// Preloaded sound cache — load once, replay instantly
const _preloaded = {};

/**
 * Preload all sound assets for instant playback.
 * Called lazily on first activation, then cached.
 */
async function preloadSounds() {
  if (Object.keys(_preloaded).length > 0) return;
  await ensureAudioMode();

  for (const [profileId, assets] of Object.entries(AUDIO_ASSETS)) {
    for (const [type, asset] of Object.entries(assets)) {
      const key = `${profileId}_${type}`;
      try {
        const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false, volume: 1.0 });
        _preloaded[key] = sound;
      } catch {
        // If preload fails, we'll fall back to on-demand loading
      }
    }
  }
}

/**
 * Play a sound asset — uses preloaded cache for instant response,
 * falls back to on-demand loading if cache miss.
 */
async function playAsset(asset, cacheKey) {
  let sound = null;
  try {
    await ensureAudioMode();

    // Try preloaded cache first (instant playback)
    if (cacheKey && _preloaded[cacheKey]) {
      sound = _preloaded[cacheKey];
      await sound.setPositionAsync(0);
      await sound.playAsync();
      return;
    }

    // Fallback: load and play on demand
    const { sound: s } = await Audio.Sound.createAsync(
      asset,
      { shouldPlay: true, volume: 1.0 }
    );
    sound = s;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish && sound) {
        sound.unloadAsync().catch(() => {});
        sound = null;
      }
    });
  } catch (e) {
    if (sound && !_preloaded[`${cacheKey}`]) {
      await sound.unloadAsync().catch(() => {});
    }
    // Silently ignore audio errors — haptics still run
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Play activation sound + haptics for a given profile.
 * Audio and haptics run concurrently for immediate sensation.
 * Preloads all sounds on first call for instant future playback.
 */
export async function playActivationSound(profileId = 'merica') {
  const id = SOUND_PROFILES[profileId] ? profileId : 'merica';
  const hapticFn = HAPTICS[id]?.activate;
  const asset = AUDIO_ASSETS[id]?.activate;
  const cacheKey = `${id}_activate`;

  // Ensure sounds are preloaded for this and future calls
  preloadSounds().catch(() => {});

  // Run haptics + audio simultaneously for best immediacy
  const promises = [];
  if (asset) promises.push(playAsset(asset, cacheKey));
  if (hapticFn) promises.push(hapticFn().catch(() => {}));

  await Promise.allSettled(promises);
}

/**
 * Play deactivation sound + haptics for a given profile.
 */
export async function playDeactivationSound(profileId = 'merica') {
  const id = SOUND_PROFILES[profileId] ? profileId : 'merica';
  const hapticFn = HAPTICS[id]?.deactivate;
  const asset = AUDIO_ASSETS[id]?.deactivate;
  const cacheKey = `${id}_deactivate`;

  const promises = [];
  if (asset) promises.push(playAsset(asset, cacheKey));
  if (hapticFn) promises.push(hapticFn().catch(() => {}));

  await Promise.allSettled(promises);
}

// ── Internal helpers ─────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
