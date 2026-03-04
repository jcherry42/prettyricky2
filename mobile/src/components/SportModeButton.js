/**
 * SportModeButton — realistic wildfire glow-ember system.
 *
 * WHY THIS LOOKS LIKE REAL FIRE:
 *
 *  1. GLOW PARTICLES: Each particle is a tiny circle (2-7px) with a large
 *     iOS shadowRadius (8-20px) in flame colors. The shadow IS the fire;
 *     the dot is just the hottest pixel. Overlapping glows blend naturally.
 *
 *  2. CORRECT COLOR TEMPERATURE: White-hot at the base, transitioning through
 *     yellow → orange → red → dark crimson at the tips. This matches the
 *     blackbody radiation curve of real fire.
 *
 *  3. ORGANIC SHAPES: Circles with soft glow edges, NOT rectangles. Real flames
 *     have no straight edges.
 *
 *  4. DENSITY: 48 particles with overlapping glow fields create a continuous,
 *     feathery fire mass rather than individual visible shapes.
 *
 *  5. THREE-LAYER DEPTH:
 *       - Layer A (behind button): ember bed + rising flames
 *       - Button face (zIndex 10)
 *       - Layer B (in front): faint foreground embers for depth
 *
 *  6. CHAOTIC FLICKER: Each particle independently varies in scale and
 *     opacity with fast, irregular timing — no two flicker in sync.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAppSettings } from '../context/AppSettingsContext';
import { playActivationSound, playDeactivationSound, SOUND_PROFILES } from '../lib/soundProfiles';
import { SportModeActivation } from './SportModeActivation';
import { flagFor } from '../utils/language';

// ─── Ember definitions ────────────────────────────────────────────────────────
// Each ember:
//   x:  left offset (px, from wrap left)      wrap is 80px wide
//   y:  bottom anchor (px from wrap bottom)    negative = below wrap
//   s:  core dot diameter (px)
//   g:  glow radius (iOS shadowRadius)
//   c:  core color
//   gc: glow (shadow) color
//   rise: vertical travel (px upward)
//   sway: lateral travel (px, alternating)
//   sp: animation period (ms — lower = faster)
//   dl: start delay (ms)
//   op: peak opacity
//   fg: render in FRONT of button face

const EMBERS = [
  // ── BASE EMBER BED — white-hot / bright yellow, wide glow ──────────────────
  { x:  6, y: -4, s: 5, g: 14, c: '#FFFFFF', gc: '#FFD54F', rise: 4, sway: 2,  sp: 500, dl:   0, op: 0.95, fg: false },
  { x: 14, y: -2, s: 6, g: 16, c: '#FFF8E1', gc: '#FFC107', rise: 5, sway:-2,  sp: 480, dl:  40, op: 0.98, fg: false },
  { x: 22, y: -4, s: 5, g: 14, c: '#FFFFFF', gc: '#FFD54F', rise: 4, sway: 3,  sp: 510, dl:  80, op: 0.96, fg: false },
  { x: 30, y: -2, s: 7, g: 18, c: '#FFF9C4', gc: '#FFC107', rise: 5, sway:-2,  sp: 490, dl:  20, op: 0.99, fg: false },
  { x: 38, y: -3, s: 6, g: 16, c: '#FFFFFF', gc: '#FFD54F', rise: 4, sway: 2,  sp: 520, dl:  60, op: 0.98, fg: false },
  { x: 46, y: -2, s: 7, g: 18, c: '#FFF8E1', gc: '#FFC107', rise: 5, sway:-3,  sp: 485, dl: 100, op: 0.99, fg: false },
  { x: 54, y: -4, s: 5, g: 14, c: '#FFFFFF', gc: '#FFD54F', rise: 4, sway: 2,  sp: 505, dl: 140, op: 0.96, fg: false },
  { x: 62, y: -2, s: 6, g: 16, c: '#FFF8E1', gc: '#FFC107', rise: 5, sway:-2,  sp: 475, dl:  30, op: 0.97, fg: false },
  { x: 72, y: -4, s: 5, g: 14, c: '#FFF9C4', gc: '#FFD54F', rise: 4, sway: 3,  sp: 515, dl: 110, op: 0.95, fg: false },

  // ── CORE FLAMES — yellow / orange, rising from base ────────────────────────
  { x:  8, y:  2, s: 4, g: 12, c: '#FFD54F', gc: '#FF9800', rise: 14, sway: 5,  sp: 680, dl:  15, op: 0.90, fg: false },
  { x: 16, y:  4, s: 5, g: 14, c: '#FFCA28', gc: '#FF6D00', rise: 16, sway:-6,  sp: 720, dl:  90, op: 0.92, fg: false },
  { x: 24, y:  2, s: 4, g: 12, c: '#FFD54F', gc: '#FF9800', rise: 18, sway: 5,  sp: 700, dl: 160, op: 0.94, fg: false },
  { x: 32, y:  4, s: 5, g: 14, c: '#FFC107', gc: '#FF6D00', rise: 20, sway:-7,  sp: 740, dl:  25, op: 0.95, fg: false },
  { x: 40, y:  2, s: 6, g: 16, c: '#FFD54F', gc: '#FF9800', rise: 22, sway: 6,  sp: 720, dl: 120, op: 0.96, fg: false },
  { x: 48, y:  4, s: 5, g: 14, c: '#FFCA28', gc: '#FF6D00', rise: 20, sway:-5,  sp: 700, dl:  55, op: 0.94, fg: false },
  { x: 56, y:  2, s: 4, g: 12, c: '#FFD54F', gc: '#FF9800', rise: 17, sway: 6,  sp: 730, dl: 180, op: 0.92, fg: false },
  { x: 64, y:  4, s: 5, g: 14, c: '#FFC107', gc: '#FF6D00', rise: 15, sway:-5,  sp: 690, dl:  70, op: 0.90, fg: false },
  { x: 72, y:  2, s: 4, g: 12, c: '#FFD54F', gc: '#FF9800', rise: 13, sway: 4,  sp: 660, dl: 200, op: 0.88, fg: false },

  // ── MID TONGUES — orange / red ─────────────────────────────────────────────
  { x: 12, y:  8, s: 3, g: 10, c: '#FF9800', gc: '#FF3D00', rise: 22, sway: 7,  sp: 820, dl:  45, op: 0.82, fg: false },
  { x: 20, y: 10, s: 4, g: 12, c: '#FF6D00', gc: '#DD2C00', rise: 25, sway:-8,  sp: 860, dl: 130, op: 0.85, fg: false },
  { x: 28, y:  8, s: 3, g: 10, c: '#F4511E', gc: '#FF3D00', rise: 28, sway: 8,  sp: 900, dl: 220, op: 0.83, fg: false },
  { x: 36, y: 10, s: 4, g: 12, c: '#FF9800', gc: '#DD2C00', rise: 30, sway:-7,  sp: 880, dl:  10, op: 0.87, fg: false },
  { x: 44, y:  8, s: 4, g: 12, c: '#FF6D00', gc: '#FF3D00', rise: 28, sway: 9,  sp: 840, dl: 165, op: 0.85, fg: false },
  { x: 52, y: 10, s: 3, g: 10, c: '#F4511E', gc: '#DD2C00', rise: 25, sway:-8,  sp: 870, dl:  85, op: 0.83, fg: false },
  { x: 60, y:  8, s: 4, g: 12, c: '#FF9800', gc: '#FF3D00', rise: 22, sway: 7,  sp: 830, dl: 250, op: 0.80, fg: false },
  { x: 68, y: 10, s: 3, g: 10, c: '#FF6D00', gc: '#DD2C00', rise: 20, sway:-6,  sp: 800, dl:  50, op: 0.78, fg: false },

  // ── UPPER WISPS — red / dark crimson ────────────────────────────────────────
  { x: 16, y: 16, s: 3, g: 8,  c: '#FF3D00', gc: '#B71C1C', rise: 30, sway: 9,  sp: 950, dl:  75, op: 0.65, fg: false },
  { x: 24, y: 18, s: 2, g: 6,  c: '#DD2C00', gc: '#880E4F', rise: 34, sway:-10, sp:1000, dl: 190, op: 0.60, fg: false },
  { x: 32, y: 16, s: 3, g: 8,  c: '#D32F2F', gc: '#B71C1C', rise: 36, sway: 8,  sp: 980, dl: 280, op: 0.62, fg: false },
  { x: 40, y: 18, s: 3, g: 8,  c: '#FF3D00', gc: '#880E4F', rise: 38, sway:-9,  sp:1020, dl:  35, op: 0.68, fg: false },
  { x: 48, y: 16, s: 2, g: 6,  c: '#DD2C00', gc: '#B71C1C', rise: 36, sway: 10, sp: 970, dl: 145, op: 0.60, fg: false },
  { x: 56, y: 18, s: 3, g: 8,  c: '#D32F2F', gc: '#880E4F', rise: 32, sway:-8,  sp: 940, dl: 240, op: 0.63, fg: false },
  { x: 64, y: 16, s: 2, g: 6,  c: '#FF3D00', gc: '#B71C1C', rise: 28, sway: 7,  sp: 920, dl: 105, op: 0.58, fg: false },

  // ── SIDE ERUPTIONS — reaching out from button edges ─────────────────────────
  { x: -6, y:  4, s: 3, g: 10, c: '#FF6D00', gc: '#FF3D00', rise: 16, sway: 4,  sp: 750, dl:  60, op: 0.70, fg: false },
  { x: 84, y:  4, s: 3, g: 10, c: '#FF6D00', gc: '#FF3D00', rise: 15, sway:-4,  sp: 740, dl: 130, op: 0.68, fg: false },
  { x: -3, y: 12, s: 2, g:  8, c: '#FF3D00', gc: '#DD2C00', rise: 22, sway: 6,  sp: 850, dl: 200, op: 0.55, fg: false },
  { x: 83, y: 12, s: 2, g:  8, c: '#FF3D00', gc: '#DD2C00', rise: 21, sway:-6,  sp: 840, dl:  70, op: 0.53, fg: false },

  // ── FOREGROUND (in front of button — faint depth layer) ─────────────────────
  { x: 26, y: 14, s: 3, g:  8, c: '#FF9800', gc: '#FF6D00', rise: 18, sway: 5,  sp: 760, dl:  40, op: 0.32, fg: true },
  { x: 40, y: 17, s: 4, g: 10, c: '#FFD54F', gc: '#FF9800', rise: 20, sway:-6,  sp: 780, dl: 150, op: 0.35, fg: true },
  { x: 54, y: 14, s: 3, g:  8, c: '#FF9800', gc: '#FF6D00', rise: 17, sway: 5,  sp: 740, dl:  95, op: 0.30, fg: true },

  // ── GAP-FILL EMBERS ─────────────────────────────────────────────────────────
  { x: 10, y:  0, s: 3, g: 10, c: '#FFD54F', gc: '#FF9800', rise:  8, sway: 3,  sp: 580, dl: 170, op: 0.78, fg: false },
  { x: 18, y:  2, s: 2, g:  8, c: '#FFCA28', gc: '#FF6D00', rise: 10, sway:-3,  sp: 600, dl:  90, op: 0.75, fg: false },
  { x: 34, y:  0, s: 3, g: 10, c: '#FFD54F', gc: '#FF9800', rise:  9, sway: 4,  sp: 590, dl: 210, op: 0.80, fg: false },
  { x: 50, y:  2, s: 2, g:  8, c: '#FFCA28', gc: '#FF6D00', rise: 10, sway:-3,  sp: 570, dl: 120, op: 0.76, fg: false },
  { x: 58, y:  0, s: 3, g: 10, c: '#FFD54F', gc: '#FF9800', rise:  8, sway: 3,  sp: 610, dl:  50, op: 0.77, fg: false },
  { x: 66, y:  2, s: 2, g:  8, c: '#FFCA28', gc: '#FF6D00', rise:  9, sway:-4,  sp: 585, dl: 260, op: 0.74, fg: false },
];

// ─── Single ember particle ────────────────────────────────────────────────────

const Ember = React.memo(function Ember({ cfg, active }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const flickerSc  = useSharedValue(1);
  const opVal      = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(riseVal);
      cancelAnimation(swayVal);
      cancelAnimation(flickerSc);
      cancelAnimation(opVal);
      riseVal.value   = 0;
      swayVal.value   = 0;
      flickerSc.value = 1;
      opVal.value     = withTiming(0, { duration: 350 });
      return;
    }

    // Fade in
    opVal.value = withTiming(1, { duration: 250 });

    const eio = Easing.inOut(Easing.sin);

    // Rise: smooth upward travel then reset
    riseVal.value = withDelay(cfg.dl,
      withRepeat(
        withSequence(
          withTiming(-cfg.rise, { duration: cfg.sp,              easing: eio }),
          withTiming(0,         { duration: cfg.sp + cfg.dl * 0.2, easing: eio })
        ), -1
      )
    );

    // Sway: lateral oscillation
    swayVal.value = withDelay(Math.floor(cfg.dl * 0.55),
      withRepeat(
        withSequence(
          withTiming( cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio }),
          withTiming(-cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio })
        ), -1
      )
    );

    // Flicker: 4-step irregular scale pulse — creates chaotic shimmer
    const fm = Math.max(80, Math.floor(cfg.sp * 0.18));
    flickerSc.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: fm,                    easing: Easing.inOut(Easing.ease) }),
        withTiming(0.65, { duration: Math.floor(fm * 0.72), easing: Easing.inOut(Easing.ease) }),
        withTiming(1.15, { duration: Math.floor(fm * 0.48), easing: Easing.inOut(Easing.ease) }),
        withTiming(0.80, { duration: Math.floor(fm * 0.60), easing: Easing.inOut(Easing.ease) })
      ), -1
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: riseVal.value },
      { translateX: swayVal.value },
      { scale: flickerSc.value },
    ],
    opacity: opVal.value * cfg.op,
  }));

  const half = cfg.s / 2;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cfg.x - half,
          bottom: cfg.y,
          width: cfg.s,
          height: cfg.s * 1.3,
          borderRadius: half,
          backgroundColor: cfg.c,
          // iOS glow — the shadow IS the visible fire
          shadowColor: cfg.gc,
          shadowOpacity: 0.95,
          shadowRadius: cfg.g,
          shadowOffset: { width: 0, height: -1 },
          // Android fallback — limited but provides some visual weight
          elevation: Platform.OS === 'android' ? Math.ceil(cfg.g * 0.5) : 0,
          zIndex: cfg.fg ? 12 : 2,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Main Button ──────────────────────────────────────────────────────────────

export function SportModeButton() {
  const { settings, toggleSportMode } = useAppSettings();
  const active    = Boolean(settings.sportMode);
  const flag      = flagFor(settings.defaultTargetLanguage);
  const profileId = settings.soundProfile || 'merica';
  const profile   = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;

  const [showActivation, setShowActivation] = useState(false);

  const pressScale  = useSharedValue(1);
  const btnOpacity  = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ), -1
      );
    } else {
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0, { duration: 400 });
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: btnOpacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePress = useCallback(() => {
    pressScale.value = withSequence(
      withTiming(0.82, { duration: 65 }),
      withTiming(1.0,  { duration: 220, easing: Easing.out(Easing.elastic(1.6)) })
    );
    if (!active) {
      setShowActivation(true);
      playActivationSound(profileId);
      toggleSportMode();
    } else {
      playDeactivationSound(profileId);
      btnOpacity.value = withSequence(
        withTiming(0, { duration: 900 }),
        withTiming(1, { duration: 0 })
      );
      setTimeout(toggleSportMode, 900);
    }
  }, [active, toggleSportMode, profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = EMBERS.filter(p => !p.fg);
  const fg = EMBERS.filter(p =>  p.fg);

  return (
    <View style={styles.wrap}>
      {/* Ambient heat cloud — soft orange/red radial glow */}
      <Animated.View style={[styles.heatCloud, glowStyle]} />

      {/* Background ember field */}
      {bg.map((cfg, i) => <Ember key={`bg${i}`} cfg={cfg} active={active} />)}

      {/* Button face (zIndex 10) */}
      <Animated.View style={[styles.btnWrap, pressStyle]}>
        <Pressable onPress={handlePress} style={({ pressed }) => pressed && styles.pressed}>
          <View style={[styles.btn, active && styles.btnActive]}>
            {active && (
              <LinearGradient
                colors={['rgba(255,70,0,0.20)', 'rgba(140,15,0,0.55)', 'rgba(60,0,0,0.80)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
            )}
            <Ionicons name="flame" size={active ? 26 : 22} color={active ? '#FF9030' : colors.textMute} />
            {!active && <Text style={styles.label}>SPORT</Text>}
            {active && (
              <View style={styles.flagBadge}>
                <Text style={{ fontSize: 10 }}>{flag}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Foreground ember layer (in front of button for depth) */}
      {fg.map((cfg, i) => <Ember key={`fg${i}`} cfg={cfg} active={active} />)}

      <SportModeActivation visible={showActivation} profileId={profileId} onComplete={() => setShowActivation(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heatCloud: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,80,0,0.12)',
    shadowColor: '#FF4400',
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  btnWrap: { zIndex: 10 },
  btn: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,10,12,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  btnActive: {
    borderColor: 'rgba(255,90,0,0.70)',
    shadowColor: '#FF5500',
    shadowOpacity: 0.85,
    shadowRadius: 22,
    backgroundColor: 'rgba(35,5,0,0.98)',
  },
  pressed: { opacity: 0.88 },
  label: {
    color: colors.textMute,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  flagBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 7,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
