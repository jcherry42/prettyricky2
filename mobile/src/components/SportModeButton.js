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

// ─── Flame tongue definitions (match reference GIF) ───────────────────────────
// Each flame tongue:
//   x, y: bottom-left anchor
//   w, h: size of the flame tongue
//   rise: vertical travel
//   sway: horizontal sway
//   sp:  animation period (ms)
//   dl:  start delay (ms)
//   op:  peak opacity
//   fg:  render in FRONT of button face
//   tilt: base rotation
//   stretch: peak vertical stretch

const FLAMES = [
  // Back row (tall tongues)
  { x: -6, y: -10, w: 18, h: 34, rise: 6,  sway: 3, sp: 760, dl:   0, op: 0.82, fg: false, tilt: -6, stretch: 1.10 },
  { x:  4, y:  -8, w: 20, h: 40, rise: 8,  sway: 4, sp: 820, dl:  70, op: 0.90, fg: false, tilt: -3, stretch: 1.16 },
  { x: 16, y:  -8, w: 22, h: 46, rise: 10, sway: 5, sp: 880, dl: 140, op: 0.94, fg: false, tilt:  1, stretch: 1.20 },
  { x: 28, y:  -6, w: 24, h: 52, rise: 12, sway: 6, sp: 920, dl:  30, op: 0.98, fg: false, tilt: -1, stretch: 1.25 },
  { x: 42, y:  -8, w: 22, h: 48, rise: 10, sway: 5, sp: 900, dl: 110, op: 0.95, fg: false, tilt:  2, stretch: 1.20 },
  { x: 54, y:  -8, w: 20, h: 42, rise: 8,  sway: 4, sp: 840, dl: 200, op: 0.90, fg: false, tilt:  3, stretch: 1.15 },
  { x: 66, y: -10, w: 18, h: 34, rise: 6,  sway: 3, sp: 780, dl:  90, op: 0.82, fg: false, tilt:  6, stretch: 1.10 },
  { x: 74, y: -12, w: 16, h: 30, rise: 5,  sway: 3, sp: 740, dl: 160, op: 0.78, fg: false, tilt:  7, stretch: 1.08 },

  // Foreground tongues (shorter, brighter)
  { x:  8, y:  -2, w: 16, h: 28, rise: 7,  sway: 3, sp: 720, dl: 120, op: 0.55, fg: true,  tilt: -6, stretch: 1.20 },
  { x: 34, y:  -1, w: 18, h: 30, rise: 8,  sway: 4, sp: 760, dl:  60, op: 0.60, fg: true,  tilt:  2, stretch: 1.22 },
  { x: 58, y:  -2, w: 16, h: 26, rise: 6,  sway: 3, sp: 700, dl: 180, op: 0.50, fg: true,  tilt:  5, stretch: 1.18 },
];

const SPARKS = [
  { x: 10, y:  6, size: 2.0, rise: 18, sp: 820, dl:  30, op: 0.70 },
  { x: 24, y:  8, size: 2.6, rise: 20, sp: 900, dl: 110, op: 0.65 },
  { x: 38, y:  6, size: 2.2, rise: 16, sp: 780, dl: 170, op: 0.60 },
  { x: 52, y:  8, size: 2.4, rise: 18, sp: 860, dl:  80, op: 0.65 },
  { x: 66, y:  6, size: 2.0, rise: 15, sp: 820, dl: 140, op: 0.60 },
];

// ─── Flame tongue particle (matches reference GIF) ───────────────────────────

const FlameTongue = React.memo(function FlameTongue({ cfg, active }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const stretchVal = useSharedValue(1);
  const opVal      = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(riseVal);
      cancelAnimation(swayVal);
      cancelAnimation(stretchVal);
      cancelAnimation(opVal);
      riseVal.value = 0;
      swayVal.value = 0;
      stretchVal.value = 1;
      opVal.value = withTiming(0, { duration: 250 });
      return;
    }

    opVal.value = withTiming(1, { duration: 180 });
    const eio = Easing.inOut(Easing.sin);

    riseVal.value = withDelay(cfg.dl,
      withRepeat(
        withSequence(
          withTiming(-cfg.rise, { duration: cfg.sp, easing: eio }),
          withTiming(0,         { duration: Math.floor(cfg.sp * 1.12), easing: eio })
        ), -1
      )
    );

    swayVal.value = withDelay(Math.floor(cfg.dl * 0.6),
      withRepeat(
        withSequence(
          withTiming( cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio }),
          withTiming(-cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio })
        ), -1
      )
    );

    stretchVal.value = withDelay(Math.floor(cfg.dl * 0.45),
      withRepeat(
        withSequence(
          withTiming(cfg.stretch, { duration: Math.floor(cfg.sp * 0.45), easing: Easing.inOut(Easing.ease) }),
          withTiming(1,           { duration: Math.floor(cfg.sp * 0.45), easing: Easing.inOut(Easing.ease) })
        ), -1
      )
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swayVal.value },
      { translateY: riseVal.value },
      { scaleY: stretchVal.value },
      { rotateZ: `${cfg.tilt}deg` },
    ],
    opacity: opVal.value * cfg.op,
  }));

  const topRadius = cfg.w * 0.6;
  const bottomRadius = cfg.w * 0.28;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cfg.x,
          bottom: cfg.y,
          width: cfg.w,
          height: cfg.h,
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
          overflow: 'hidden',
          shadowColor: '#FF6D00',
          shadowOpacity: 0.9,
          shadowRadius: cfg.w * 1.2,
          shadowOffset: { width: 0, height: -2 },
          elevation: Platform.OS === 'android' ? Math.ceil(cfg.w * 0.6) : 0,
          zIndex: cfg.fg ? 12 : 2,
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,230,0.98)', '#FFD36A', '#FF8A00', '#FF3D00']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(255,214,120,0.85)', 'rgba(255,120,0,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{
          position: 'absolute',
          bottom: 0,
          alignSelf: 'center',
          width: cfg.w * 0.42,
          height: cfg.h * 0.6,
          borderRadius: cfg.w * 0.4,
        }}
      />
    </Animated.View>
  );
});

// ─── Flying sparks ───────────────────────────────────────────────────────────

const FlameSpark = React.memo(function FlameSpark({ cfg, active }) {
  const riseVal = useSharedValue(0);
  const opVal   = useSharedValue(0);
  const scVal   = useSharedValue(0.6);

  useEffect(() => {
    if (!active) {
      cancelAnimation(riseVal);
      cancelAnimation(opVal);
      cancelAnimation(scVal);
      riseVal.value = 0;
      opVal.value = 0;
      scVal.value = 0.6;
      return;
    }

    riseVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(-cfg.rise, { duration: cfg.sp, easing: Easing.out(Easing.quad) }),
        withTiming(0,         { duration: 0 })
      ), -1)
    );

    opVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(cfg.op, { duration: Math.floor(cfg.sp * 0.2) }),
        withTiming(0,      { duration: Math.floor(cfg.sp * 0.8), easing: Easing.out(Easing.ease) })
      ), -1)
    );

    scVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(1.4, { duration: Math.floor(cfg.sp * 0.25) }),
        withTiming(0.6, { duration: Math.floor(cfg.sp * 0.75) })
      ), -1)
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    opacity: opVal.value,
    transform: [{ translateY: riseVal.value }, { scale: scVal.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cfg.x,
          bottom: cfg.y,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
          backgroundColor: '#FFD36A',
          shadowColor: '#FF6D00',
          shadowOpacity: 0.9,
          shadowRadius: cfg.size * 4,
          shadowOffset: { width: 0, height: -1 },
          elevation: Platform.OS === 'android' ? 3 : 0,
          zIndex: 8,
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

  const bg = FLAMES.filter(p => !p.fg);
  const fg = FLAMES.filter(p =>  p.fg);

  return (
    <View style={styles.wrap}>
      {/* Ambient heat cloud — soft orange/red radial glow */}
      <Animated.View style={[styles.heatCloud, glowStyle]} />

      {/* Background flame tongues */}
      {bg.map((cfg, i) => <FlameTongue key={`bg${i}`} cfg={cfg} active={active} />)}
      {SPARKS.map((cfg, i) => <FlameSpark key={`sp${i}`} cfg={cfg} active={active} />)}

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

      {/* Foreground flame tongues */}
      {fg.map((cfg, i) => <FlameTongue key={`fg${i}`} cfg={cfg} active={active} />)}

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
    width: 96,
    height: 130,
    borderRadius: 60,
    backgroundColor: 'rgba(255,120,20,0.22)',
    shadowColor: '#FF6A00',
    shadowOpacity: 0.95,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: -6 },
    elevation: 0,
    ...(Platform.OS === 'web' ? {
      filter: 'blur(18px)',
      mixBlendMode: 'screen',
      backgroundColor: 'rgba(255,120,20,0.35)',
      width: 120,
      height: 150,
      borderRadius: 70,
    } : {}),
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
