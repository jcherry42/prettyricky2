/**
 * SportModeButton — wildfire flame system using react-native-reanimated 4.
 *
 * WHY THIS LOOKS LIKE REAL FIRE:
 *
 *  1. DENSITY over geometry — 52 individual particles creates the illusion
 *     of irregular, feathery flame edges through overlap and transparency.
 *     A handful of large shapes = lego. Dozens of tiny capsules = fire.
 *
 *  2. Reanimated worklets run on the UI thread (not JS thread), so every
 *     particle animates at native 60/120fps independently — no dropped frames.
 *
 *  3. Correct gradient direction: TRANSPARENT at the tip (top), OPAQUE at
 *     the base (bottom). Real fire is densest/hottest at the base.
 *
 *  4. Three-tier layering:
 *       - Layer A (behind button): ember bed + core particles
 *       - Button face (zIndex 10)
 *       - Layer B (in front of button): a few foreground particles
 *     This makes the button look INSIDE a fire, not on top of it.
 *
 *  5. Fast flicker (120–200ms) on scaleX creates the chaotic shimmer
 *     characteristic of real flames. Rise and sway are slower (500–900ms)
 *     to give rolling depth.
 *
 *  6. Skew (skewX / skewY) breaks perfect symmetry — no two particles
 *     move identically.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
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

// ─── Particle Definitions ─────────────────────────────────────────────────────
// Each particle:
//   x  : left offset from wrap left edge (px, wrap is 80px wide)
//   y  : bottom anchor px (negative = below wrap = longer rise)
//   w  : width (px)
//   h  : height (px)
//   rise: vertical travel (px upward)
//   sway: lateral travel (px, absolute — direction randomised by sk sign)
//   fm : flicker period ms (LOWER = more chaotic)
//   rm : rise period ms
//   sk : skewX degrees (organic tilt)
//   dl : delay ms
//   op : peak base opacity
//   fg : render in FRONT of button face

const PARTICLES = [
  // ── Ember bed — wide/short, brightest, behind ────────────────────────────
  { x:  2, y: -6, w: 30, h: 22, rise:  4, sway:  2, fm: 210, rm: 500, sk:  2, dl:   0, op: 0.95, fg: false },
  { x: 14, y: -4, w: 36, h: 26, rise:  5, sway: -2, fm: 200, rm: 520, sk: -3, dl:  30, op: 0.98, fg: false },
  { x: 28, y: -6, w: 38, h: 24, rise:  5, sway:  2, fm: 205, rm: 490, sk:  1, dl:  60, op: 0.98, fg: false },
  { x: 44, y: -4, w: 32, h: 22, rise:  4, sway: -2, fm: 215, rm: 510, sk: -2, dl:  90, op: 0.95, fg: false },
  { x: 57, y: -6, w: 28, h: 20, rise:  4, sway:  2, fm: 210, rm: 500, sk:  3, dl: 120, op: 0.92, fg: false },

  // ── Core tongues — behind ─────────────────────────────────────────────────
  { x:  0, y: -2, w:  9, h: 44, rise: 13, sway:  6, fm: 175, rm: 680, sk: -7, dl:  10, op: 0.90, fg: false },
  { x:  8, y:  0, w: 11, h: 52, rise: 15, sway: -5, fm: 162, rm: 720, sk:  5, dl:  75, op: 0.93, fg: false },
  { x: 16, y: -2, w: 13, h: 56, rise: 17, sway:  7, fm: 168, rm: 700, sk: -4, dl: 140, op: 0.95, fg: false },
  { x: 24, y:  0, w: 15, h: 60, rise: 19, sway: -6, fm: 158, rm: 740, sk:  6, dl:  20, op: 0.96, fg: false },
  { x: 33, y: -2, w: 17, h: 64, rise: 20, sway:  5, fm: 152, rm: 760, sk: -5, dl: 105, op: 0.97, fg: false },
  { x: 42, y:  0, w: 15, h: 60, rise: 18, sway: -7, fm: 160, rm: 730, sk:  4, dl:  55, op: 0.95, fg: false },
  { x: 51, y: -2, w: 13, h: 54, rise: 16, sway:  6, fm: 165, rm: 710, sk: -6, dl: 175, op: 0.93, fg: false },
  { x: 59, y:  0, w: 11, h: 48, rise: 14, sway: -5, fm: 172, rm: 690, sk:  7, dl:  45, op: 0.91, fg: false },
  { x: 67, y: -2, w:  9, h: 42, rise: 12, sway:  5, fm: 178, rm: 670, sk: -6, dl: 215, op: 0.88, fg: false },

  // ── Whisps — tall/thin, behind ────────────────────────────────────────────
  { x:  2, y:  4, w:  5, h: 70, rise: 24, sway:  9, fm: 145, rm: 840, sk:-10, dl:  35, op: 0.72, fg: false },
  { x: 10, y:  2, w:  7, h: 74, rise: 25, sway: -8, fm: 138, rm: 870, sk:  8, dl: 130, op: 0.75, fg: false },
  { x: 19, y:  4, w:  6, h: 77, rise: 26, sway: 10, fm: 132, rm: 900, sk: -7, dl: 240, op: 0.73, fg: false },
  { x: 27, y:  2, w:  8, h: 80, rise: 27, sway: -9, fm: 130, rm: 920, sk:  9, dl:  65, op: 0.76, fg: false },
  { x: 36, y:  4, w:  9, h: 84, rise: 29, sway:  8, fm: 126, rm: 950, sk: -8, dl: 185, op: 0.78, fg: false },
  { x: 45, y:  2, w:  8, h: 80, rise: 27, sway: -8, fm: 130, rm: 935, sk:  7, dl:  95, op: 0.76, fg: false },
  { x: 53, y:  4, w:  6, h: 75, rise: 25, sway:  9, fm: 135, rm: 890, sk: -9, dl: 290, op: 0.74, fg: false },
  { x: 61, y:  2, w:  5, h: 70, rise: 23, sway: -8, fm: 140, rm: 860, sk:  8, dl: 155, op: 0.71, fg: false },
  { x: 69, y:  4, w:  5, h: 66, rise: 21, sway:  7, fm: 145, rm: 830, sk:-10, dl:  25, op: 0.69, fg: false },

  // ── Foreground — IN FRONT of button face ──────────────────────────────────
  { x: 22, y:  6, w:  6, h: 42, rise: 15, sway:  5, fm: 158, rm: 720, sk: -5, dl:  40, op: 0.52, fg: true  },
  { x: 34, y:  8, w:  8, h: 50, rise: 18, sway: -5, fm: 148, rm: 760, sk:  4, dl: 160, op: 0.56, fg: true  },
  { x: 45, y:  6, w:  6, h: 44, rise: 16, sway:  6, fm: 153, rm: 740, sk: -6, dl:  80, op: 0.50, fg: true  },

  // ── Side eruptions ────────────────────────────────────────────────────────
  { x: -8, y:  0, w:  8, h: 40, rise: 14, sway:  4, fm: 168, rm: 680, sk: 12, dl:  50, op: 0.65, fg: false },
  { x: 70, y:  0, w:  8, h: 38, rise: 13, sway: -4, fm: 170, rm: 670, sk:-12, dl: 120, op: 0.63, fg: false },
  { x: -4, y:  8, w:  5, h: 54, rise: 19, sway:  6, fm: 142, rm: 800, sk: 14, dl: 200, op: 0.52, fg: false },
  { x: 74, y:  8, w:  5, h: 52, rise: 18, sway: -6, fm: 145, rm: 790, sk:-14, dl:  70, op: 0.50, fg: false },

  // ── Gap-fill embers ───────────────────────────────────────────────────────
  { x:  5, y:  0, w:  4, h: 30, rise: 10, sway:  4, fm: 185, rm: 600, sk: -5, dl: 170, op: 0.60, fg: false },
  { x: 13, y:  2, w:  4, h: 34, rise: 11, sway: -4, fm: 180, rm: 620, sk:  4, dl:  90, op: 0.63, fg: false },
  { x: 21, y:  0, w:  5, h: 32, rise: 10, sway:  5, fm: 182, rm: 610, sk: -6, dl: 270, op: 0.61, fg: false },
  { x: 39, y:  2, w:  5, h: 36, rise: 12, sway: -5, fm: 177, rm: 640, sk:  5, dl: 110, op: 0.64, fg: false },
  { x: 47, y:  0, w:  4, h: 30, rise: 10, sway:  4, fm: 185, rm: 600, sk: -4, dl: 340, op: 0.60, fg: false },
  { x: 55, y:  2, w:  4, h: 32, rise: 11, sway: -4, fm: 180, rm: 615, sk:  6, dl: 190, op: 0.62, fg: false },
  { x: 63, y:  0, w:  4, h: 28, rise:  9, sway:  4, fm: 186, rm: 595, sk: -5, dl:  60, op: 0.58, fg: false },
];

// ─── Single particle ──────────────────────────────────────────────────────────

function Particle({ cfg, active }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const flickerVal = useSharedValue(1);
  const opVal      = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(riseVal);
      cancelAnimation(swayVal);
      cancelAnimation(flickerVal);
      cancelAnimation(opVal);
      riseVal.value    = 0;
      swayVal.value    = 0;
      flickerVal.value = 1;
      opVal.value      = withTiming(0, { duration: 300 });
      return;
    }

    opVal.value = withTiming(1, { duration: 280 });
    const eio = Easing.inOut(Easing.sin);

    riseVal.value = withDelay(cfg.dl,
      withRepeat(
        withSequence(
          withTiming(-cfg.rise, { duration: cfg.rm,                    easing: eio }),
          withTiming(0,         { duration: cfg.rm + cfg.dl * 0.25,    easing: eio })
        ), -1
      )
    );

    swayVal.value = withDelay(Math.floor(cfg.dl * 0.55),
      withRepeat(
        withSequence(
          withTiming( cfg.sway, { duration: Math.floor(cfg.rm * 0.68), easing: eio }),
          withTiming(-cfg.sway, { duration: Math.floor(cfg.rm * 0.68), easing: eio })
        ), -1
      )
    );

    // Fast, irregular flicker — 4-step sequence creates unpredictable rhythm
    flickerVal.value = withRepeat(
      withSequence(
        withTiming(1.30, { duration: cfg.fm,                    easing: Easing.inOut(Easing.ease) }),
        withTiming(0.70, { duration: Math.floor(cfg.fm * 0.72), easing: Easing.inOut(Easing.ease) }),
        withTiming(1.10, { duration: Math.floor(cfg.fm * 0.48), easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: Math.floor(cfg.fm * 0.60), easing: Easing.inOut(Easing.ease) })
      ), -1
    );
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: riseVal.value },
      { translateX: swayVal.value },
      { scaleX: flickerVal.value },
      { skewX: `${cfg.sk}deg` },
    ],
    opacity: opVal.value,
  }));

  const r = cfg.w / 2;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cfg.x,
          bottom: cfg.y,
          width: cfg.w,
          height: cfg.h,
          borderTopLeftRadius: r,
          borderTopRightRadius: r,
          borderBottomLeftRadius: Math.floor(r * 0.52),
          borderBottomRightRadius: Math.floor(r * 0.52),
          overflow: 'hidden',
          zIndex: cfg.fg ? 12 : 2,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,160,0)',
          `rgba(255,230,60,${cfg.op * 0.18})`,
          `rgba(255,150,10,${cfg.op * 0.55})`,
          `rgba(255,55,0,${cfg.op * 0.88})`,
          `rgba(180,15,0,${cfg.op})`,
        ]}
        locations={[0, 0.14, 0.42, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Main Button ─────────────────────────────────────────────────────────────

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
  const glowRadius  = useSharedValue(16);

  useEffect(() => {
    if (active) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.88, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.40, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ), -1
      );
      glowRadius.value = withRepeat(
        withSequence(
          withTiming(34, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(18, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ), -1
      );
    } else {
      cancelAnimation(glowOpacity);
      cancelAnimation(glowRadius);
      glowOpacity.value = withTiming(0, { duration: 400 });
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: btnOpacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    shadowRadius: glowRadius.value,
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

  const bg = PARTICLES.filter(p => !p.fg);
  const fg = PARTICLES.filter(p =>  p.fg);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.heatCloud, glowStyle]} />

      {bg.map((cfg, i) => <Particle key={`bg${i}`} cfg={cfg} active={active} />)}

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

      {fg.map((cfg, i) => <Particle key={`fg${i}`} cfg={cfg} active={active} />)}

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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,50,0,0.15)',
    shadowColor: '#FF4400',
    shadowOpacity: 1,
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
