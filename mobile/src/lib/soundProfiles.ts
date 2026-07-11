/**
 * Sound Profile System for SPORT Mode
 *
 * 3 engine sound profiles:
 *   merica — Ford Mustang Shelby GT500 (V8 thunder)
 *   euro   — Sports car revving (high-revving exotic)
 *   jdm    — JDM car transition (turbo/resonant)
 *
 * Each profile plays the user's custom WAV file + a haptic pattern.
 * Same file is used for both activate and deactivate (as requested).
 *
 * Audio files live at mobile/assets/sounds/ and are bundled with the app.
 *
 * Migrated from expo-av → expo-audio (Expo SDK 54+).
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { errorMessage } from './errors';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// ── Static asset map ────────────────────────────────────────────────────────
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

// ── Active player ref — stop previous before playing new ────────────────────
let _activePlayer: AudioPlayer | null = null;

/**
 * Stop any currently playing sound, then release it.
 */
function stopActivePlayer() {
  if (_activePlayer) {
    try {
      _activePlayer.pause();
      _activePlayer.remove();
    } catch {
      // ignore — player may have already finished
    }
    _activePlayer = null;
  }
}

/**
 * Set the audio session to play through the speaker at full volume,
 * even when the silent switch is engaged (user-initiated sound).
 * Called every time before playback to ensure iOS/Android audio routing.
 */
async function configureAudioSession() {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  } catch (e: unknown) {
    // Non-fatal — audio will still play on most devices without this
    console.warn('[SoundProfile] Audio session config failed:', errorMessage(e));
  }
}

/**
 * Core playback: create a player, load the asset, and play immediately.
 * Fresh player avoids any stale state that can cause silence or distortion.
 * Returns the AudioPlayer object so callers can control it (e.g. fade out).
 */
async function playAsset(asset: number): Promise<AudioPlayer | null> {
  // Stop anything currently playing (hard stop — only used for activation)
  stopActivePlayer();

  // Configure audio session right before playback
  await configureAudioSession();

  try {
    const player = createAudioPlayer(asset, { updateInterval: 100 });
    player.volume = 1.0;
    player.loop = false;

    _activePlayer = player;

    // Auto-release when playback finishes naturally
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        player.remove();
        if (_activePlayer === player) _activePlayer = null;
      }
    });

    player.play();
    return player;
  } catch (e: unknown) {
    console.warn('[SoundProfile] Failed to load/play asset:', errorMessage(e));
    _activePlayer = null;
    return null;
  }
}

/**
 * Fade the currently active player from its current volume down to 0,
 * then stop and release it. Smooth 1.5-second fade.
 */
async function fadeOutActivePlayer(durationMs = 1500) {
  const player = _activePlayer;
  if (!player) return;

  const STEPS = 30;
  const stepMs = durationMs / STEPS;

  try {
    for (let i = STEPS - 1; i >= 0; i--) {
      // If another player started while we were fading, bail out
      if (_activePlayer !== player) return;
      const vol = parseFloat((i / STEPS).toFixed(3));
      try { player.volume = vol; } catch { /* ignore */ }
      await delay(stepMs);
    }
    // Fully silent — now stop and release
    if (_activePlayer === player) {
      try {
        player.pause();
        player.remove();
      } catch { /* ignore */ }
      _activePlayer = null;
    }
  } catch {
    // Player may have already been removed naturally — no-op
    if (_activePlayer === player) _activePlayer = null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * SPORT MODE ON — play activation sound with auto-fade + haptics.
 * The sound plays at full volume for ~2 s then fades to silence over 1.5 s
 * so it never cuts off abruptly.
 */
export async function playActivationSound(profileId: string = 'merica') {
  const id = (SOUND_PROFILES as Record<string, unknown>)[profileId] ? profileId : 'merica';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hapticFn = (HAPTICS as Record<string, any>)[id]?.activate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asset = (AUDIO_ASSETS as Record<string, any>)[id]?.activate;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promises: Promise<any>[] = [];
  if (asset) {
    promises.push(
      playAsset(asset).then((player) => {
        if (!player) return;
        // Let the impactful part play for 2 s, then fade to silence over 1.5 s
        return delay(2000).then(() => fadeOutActivePlayer(1500));
      })
    );
  }
  if (hapticFn) promises.push(hapticFn().catch(() => {}));

  await Promise.allSettled(promises);
}

/**
 * SPORT MODE OFF — haptics only, no audio.
 * Any still-playing activation sound is killed immediately (hard stop).
 */
export async function playDeactivationSound(profileId: string = 'merica') {
  const id = (SOUND_PROFILES as Record<string, unknown>)[profileId] ? profileId : 'merica';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hapticFn = (HAPTICS as Record<string, any>)[id]?.deactivate;

  // Kill any lingering activation audio instantly — user expects silence
  stopActivePlayer();

  // Haptics only
  if (hapticFn) await hapticFn().catch(() => {});
}

// ── Internal helpers ─────────────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
