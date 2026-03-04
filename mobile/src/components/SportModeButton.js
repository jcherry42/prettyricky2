/**
 * SportModeButton — "engulfed by wildfire" flame animation.
 *
 * Flame design principles (matching real fire, not lego blocks):
 *
 *  GRADIENT DIRECTION: Transparent at the TIP (top), opaque at the BASE (bottom).
 *    Real fire is brightest and most opaque where it's hottest — the base.
 *    The tip dissipates into the air as a nearly-transparent wisp.
 *
 *  SHAPE: Very narrow at top (almost pinched to a point), wider at base.
 *    Uses asymmetric borderRadius: topLeft/Right close to 50% (full circle = point),
 *    bottomLeft/Right around 30-40% (wider oval = base).
 *
 *  LEAN: Each tongue has a slight pre-set tilt via `rotate` so they don't all
 *    stand perfectly vertical. Combined with sway, this gives organic movement.
 *
 *  DENSITY: 18 tongues in 3 tiers — base embers (short/wide), core tongues
 *    (medium), and whisps (tall/thin). This creates the layered depth of a real fire.
 *
 *  SPEED: Flicker (scaleX) is FAST (120-280ms) — barely perceptible per frame,
 *    which is what makes fire look real. Rise (500-900ms) and sway (350-700ms)
 *    are slower, creating the rolling motion of a living flame.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAppSettings } from '../context/AppSettingsContext';
import { playActivationSound, playDeactivationSound, SOUND_PROFILES } from '../lib/soundProfiles';
import { SportModeActivation } from './SportModeActivation';
import { flagFor } from '../utils/language';

// ─── Tongue config ────────────────────────────────────────────────────────────
// Tier 1: Base embers — short, wide, low, very opaque
// Tier 2: Core tongues — medium height, full color
// Tier 3: Whisps — tall, thin, lean, near-transparent tip
//
// left: position from center of 68px wrap  (can be %)
// w/h: width/height in pixels
// rise: vertical travel range (px) — small = smoldering, large = roaring
// sway: horizontal travel range (px) — negative = lean left
// flickerMs: scaleX flicker period — LOWER = faster flicker
// riseMs: rise period
// lean: static rotation applied to the whole tongue (degrees) for organic variety
// delay: ms before first loop starts (creates offset phases)
// baseOpacity: max opacity at the flame base

const TONGUES = [
  // ── Tier 1: Base embers ──────────────────────────────────────────
  { left: '14%', w: 22, h: 28, rise: 5,  sway:  2, flickerMs: 160, riseMs: 600, lean:  2, delay:   0, baseOpacity: 0.95 },
  { left: '31%', w: 28, h: 24, rise: 4,  sway: -2, flickerMs: 190, riseMs: 650, lean: -3, delay:  55, baseOpacity: 0.95 },
  { left: '50%', w: 26, h: 26, rise: 5,  sway:  1, flickerMs: 170, riseMs: 580, lean:  1, delay: 110, baseOpacity: 0.95 },
  { left: '67%', w: 24, h: 22, rise: 4,  sway: -1, flickerMs: 200, riseMs: 630, lean: -2, delay:  30, baseOpacity: 0.95 },
  { left: '82%', w: 20, h: 24, rise: 5,  sway:  2, flickerMs: 175, riseMs: 610, lean:  3, delay:  80, baseOpacity: 0.90 },

  // ── Tier 2: Core tongues ─────────────────────────────────────────
  { left: '10%', w: 14, h: 44, rise: 10, sway:  5, flickerMs: 210, riseMs: 720, lean: -6, delay:  20, baseOpacity: 0.92 },
  { left: '24%', w: 16, h: 50, rise: 12, sway: -4, flickerMs: 230, riseMs: 760, lean:  4, delay:  90, baseOpacity: 0.94 },
  { left: '38%', w: 18, h: 54, rise: 11, sway:  6, flickerMs: 195, riseMs: 700, lean: -3, delay: 160, baseOpacity: 0.96 },
  { left: '52%', w: 20, h: 58, rise: 13, sway: -5, flickerMs: 220, riseMs: 740, lean:  5, delay:  40, baseOpacity: 0.96 },
  { left: '66%', w: 16, h: 48, rise: 10, sway:  4, flickerMs: 215, riseMs: 715, lean: -4, delay: 130, baseOpacity: 0.93 },
  { left: '78%', w: 14, h: 44, rise: 9,  sway: -5, flickerMs: 205, riseMs: 690, lean:  6, delay:  70, baseOpacity: 0.91 },

  // ── Tier 3: Whisps ───────────────────────────────────────────────
  { left: '6%',  w: 8,  h: 65, rise: 18, sway:  7, flickerMs: 240, riseMs: 850, lean: -9, delay:  50, baseOpacity: 0.75 },
  { left: '20%', w: 10, h: 70, rise: 20, sway: -8, flickerMs: 260, riseMs: 880, lean:  8, delay: 170, baseOpacity: 0.80 },
  { left: '35%', w: 9,  h: 68, rise: 17, sway:  6, flickerMs: 245, riseMs: 830, lean: -7, delay: 220, baseOpacity: 0.78 },
  { left: '49%', w: 12, h: 74, rise: 22, sway: -6, flickerMs: 255, riseMs: 900, lean:  5, delay:  95, baseOpacity: 0.82 },
  { left: '63%', w: 8,  h: 66, rise: 16, sway:  8, flickerMs: 240, riseMs: 845, lean: -8, delay: 145, baseOpacity: 0.76 },
  { left: '76%', w: 10, h: 72, rise: 19, sway: -7, flickerMs: 265, riseMs: 875, lean:  9, delay: 200, baseOpacity: 0.79 },
  { left: '90%', w: 8,  h: 60, rise: 15, sway:  6, flickerMs: 235, riseMs: 810, lean: -6, delay:  65, baseOpacity: 0.72 },
];

// ─── Single flame tongue ─────────────────────────────────────────────────────

function Tongue({ cfg, active }) {
  const riseAnim    = useRef(new Animated.Value(0)).current;
  const swayAnim    = useRef(new Animated.Value(0)).current;
  const flickerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      riseAnim.stopAnimation();
      swayAnim.stopAnimation();
      flickerAnim.stopAnimation();
      riseAnim.setValue(0);
      swayAnim.setValue(0);
      flickerAnim.setValue(1);
      return;
    }

    const riseLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(riseAnim, { toValue: 1, duration: cfg.riseMs,                     easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(riseAnim, { toValue: 0, duration: cfg.riseMs + cfg.delay * 0.5,   easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay * 0.7),
        Animated.timing(swayAnim, { toValue: 1,  duration: cfg.riseMs * 0.72, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swayAnim, { toValue: -1, duration: cfg.riseMs * 0.72, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    // Flicker is the most important — fast scaleX gives the chaotic shimmer
    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, { toValue: 1.22, duration: cfg.flickerMs,       easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 0.78, duration: cfg.flickerMs * 0.8, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1.05, duration: cfg.flickerMs * 0.6, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    riseLoop.start();
    swayLoop.start();
    flickerLoop.start();

    return () => {
      riseLoop.stop();
      swayLoop.stop();
      flickerLoop.stop();
    };
  }, [active, cfg, riseAnim, swayAnim, flickerAnim]);

  if (!active) return null;

  const translateY = riseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.rise] });
  const translateX = swayAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-cfg.sway, 0, cfg.sway] });

  return (
    <Animated.View
      style={[
        styles.tongue,
        {
          left: cfg.left,
          bottom: -4,
          width: cfg.w,
          height: cfg.h,
          // Flame shape: pinched tip (nearly full-circle top corners), wider base
          borderTopLeftRadius: cfg.w * 0.5,
          borderTopRightRadius: cfg.w * 0.5,
          borderBottomLeftRadius: cfg.w * 0.32,
          borderBottomRightRadius: cfg.w * 0.32,
          transform: [
            { translateY },
            { translateX },
            { scaleX: flickerAnim },
            { rotate: `${cfg.lean}deg` }, // static organic lean
          ],
        },
      ]}
    >
      {/*
        GRADIENT: transparent at TOP (tip), full color at BOTTOM (base).
        This is the opposite of a candle — fire is hottest and densest at the base.
        Colors: tip → whisp yellow → vivid orange → deep red/ember base
      */}
      <LinearGradient
        colors={[
          `rgba(255,255,180,0)`,              // tip — fully transparent
          `rgba(255,230,80,${cfg.baseOpacity * 0.28})`,  // upper whisp — faint yellow
          `rgba(255,160,20,${cfg.baseOpacity * 0.62})`,  // mid flame — orange
          `rgba(255,80,0,${cfg.baseOpacity * 0.90})`,    // lower flame — vivid orange-red
          `rgba(200,30,0,${cfg.baseOpacity})`,           // base — deep combustion red
        ]}
        locations={[0, 0.18, 0.48, 0.76, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Main button ─────────────────────────────────────────────────────────────

export function SportModeButton() {
  const { settings, toggleSportMode } = useAppSettings();
  const active    = Boolean(settings.sportMode);
  const flag      = flagFor(settings.defaultTargetLanguage);
  const profileId = settings.soundProfile || 'merica';
  const profile   = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;

  const [showActivation, setShowActivation] = useState(false);

  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const glowPulse   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(1)).current;

  // Pulsing ember glow when active
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(glowPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowPulse.stopAnimation();
      glowPulse.setValue(0);
    }
  }, [active, glowPulse]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.84, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim,  { toValue: 1, friction: 4, tension: 240, useNativeDriver: true }),
    ]).start();

    if (!active) {
      setShowActivation(true);
      playActivationSound(profileId);
      toggleSportMode();
    } else {
      playDeactivationSound(profileId);
      Animated.timing(fadeAnim, { toValue: 0, duration: 900, useNativeDriver: true })
        .start(() => { toggleSportMode(); fadeAnim.setValue(1); });
    }
  }, [active, toggleSportMode, scaleAnim, profileId, fadeAnim]);

  const glowRadius = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [18, 32] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] });

  return (
    <View style={styles.wrap}>
      {/* Ember heat-cloud behind everything */}
      {active && (
        <Animated.View
          style={[
            styles.heatCloud,
            { opacity: glowOpacity, shadowRadius: glowRadius },
          ]}
        />
      )}

      {/* All 18 flame tongues — positioned behind the button face */}
      {TONGUES.map((cfg, i) => (
        <Tongue key={i} cfg={cfg} active={active} />
      ))}

      {/* Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim, zIndex: 10 }}>
        <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
          <View style={[styles.btn, active && styles.btnActive]}>
            {/* Inner fire glow gradient when active */}
            {active && (
              <LinearGradient
                colors={['rgba(255,80,0,0.25)', 'rgba(150,20,0,0.55)', 'rgba(80,5,0,0.75)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
            )}
            <Ionicons
              name="flame"
              size={active ? 27 : 22}
              color={active ? '#FF9A3C' : colors.textMute}
            />
            {!active && <Text style={styles.label}>SPORT</Text>}
            {active && (
              <View style={styles.flagBadge}>
                <Text style={{ fontSize: 10 }}>{flag}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>

      <SportModeActivation
        visible={showActivation}
        profileId={profileId}
        onComplete={() => setShowActivation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heatCloud: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,60,0,0.18)',
    shadowColor: '#FF4400',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  tongue: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 2,
  },
  btn: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,10,12,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  btnActive: {
    borderColor: 'rgba(255,100,0,0.65)',
    shadowColor: '#FF4400',
    shadowOpacity: 0.80,
    shadowRadius: 20,
    backgroundColor: 'rgba(40,8,0,0.97)',
  },
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
    backgroundColor: 'rgba(0,0,0,0.80)',
    borderRadius: 7,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
