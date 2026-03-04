/**
 * Sport Mode Button with realistic flame animation.
 *
 * Flame design:
 *  - Each tongue is a teardrop/flame shape built from a tall oval with
 *    asymmetric border radii (wider at base, pinched at tip).
 *  - Each tongue is a LinearGradient: deep-red base → orange mid → bright-yellow tip.
 *  - Animations: translateY (rise), translateX (sway), scaleX (flicker) all
 *    running at different speeds/offsets for organic, randomized feel.
 *  - 6 flame tongues at varied positions, sizes, and phase offsets.
 *
 * The button glows a deep ember red when active.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAppSettings } from '../context/AppSettingsContext';
import { playActivationSound, playDeactivationSound, SOUND_PROFILES } from '../lib/soundProfiles';
import { SportModeActivation } from './SportModeActivation';
import { flagFor } from '../utils/language';
import { useState } from 'react';

// ─── Flame tongue config ──────────────────────────────────────────────────────
// Each entry defines one flame tongue: position, size, animation timing.
const FLAME_TONGUES = [
  // Centre — tallest, brightest
  { left: '42%',  bottom: -4,  width: 18, height: 42, riseRange: 8,  swayRange: 3,  flickerSpeed: 520, riseSpeed: 700, delay: 0,   phase: 0    },
  // Left inner
  { left: '20%',  bottom: -2,  width: 14, height: 33, riseRange: 6,  swayRange: 4,  flickerSpeed: 480, riseSpeed: 650, delay: 80,  phase: 0.3  },
  // Right inner
  { left: '62%',  bottom: -2,  width: 13, height: 31, riseRange: 7,  swayRange: -4, flickerSpeed: 500, riseSpeed: 680, delay: 50,  phase: 0.5  },
  // Far left — shorter
  { left: '5%',   bottom: 2,   width: 11, height: 26, riseRange: 5,  swayRange: 3,  flickerSpeed: 440, riseSpeed: 600, delay: 140, phase: 0.7  },
  // Far right — shorter
  { left: '72%',  bottom: 1,   width: 10, height: 24, riseRange: 5,  swayRange: -3, flickerSpeed: 460, riseSpeed: 620, delay: 110, phase: 0.2  },
  // Very centre background — wide, low-opacity base fill
  { left: '30%',  bottom: -6,  width: 26, height: 22, riseRange: 3,  swayRange: 2,  flickerSpeed: 900, riseSpeed: 900, delay: 0,   phase: 0.1  },
];

function FlameTongue({ cfg, active, profileColor }) {
  const rise    = useRef(new Animated.Value(cfg.phase)).current;
  const sway    = useRef(new Animated.Value(cfg.phase * 0.5)).current;
  const flicker = useRef(new Animated.Value(cfg.phase)).current;

  useEffect(() => {
    if (!active) {
      rise.stopAnimation();    rise.setValue(0);
      sway.stopAnimation();    sway.setValue(0);
      flicker.stopAnimation(); flicker.setValue(0);
      return;
    }

    const riseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rise, { toValue: 1, duration: cfg.riseSpeed + cfg.delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: cfg.riseSpeed,            easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: cfg.riseSpeed * 1.3,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: cfg.riseSpeed * 1.3,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: cfg.flickerSpeed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: cfg.flickerSpeed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    riseLoop.start();
    swayLoop.start();
    flickerLoop.start();
    return () => { riseLoop.stop(); swayLoop.stop(); flickerLoop.stop(); };
  }, [active, cfg, rise, sway, flicker]);

  if (!active) return null;

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.riseRange] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.swayRange] });
  const scaleX = flicker.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 0.88] });
  // Opacity: base of tongue is more opaque, subtly flickers
  const opacity = flicker.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.82, 1.0, 0.75] });

  // Flame shape: oval narrowed at top via borderRadius
  // top corners very tight (flame tip), bottom corners wide (base)
  const shape = {
    width: cfg.width,
    height: cfg.height,
    borderTopLeftRadius: cfg.width * 0.48,
    borderTopRightRadius: cfg.width * 0.48,
    borderBottomLeftRadius: cfg.width * 0.42,
    borderBottomRightRadius: cfg.width * 0.42,
    overflow: 'hidden',
  };

  // Gradient: transparent (tip, top) → yellow → orange → deep red (base, bottom)
  const base = profileColor || '#FF4800';
  // Derive yellow tip from profile color (always bright)
  const tipColor = '#FFF176';
  const midColor = '#FFAB40';
  const baseColor = base;
  const deepBase = 'rgba(120,20,0,0.6)';

  return (
    <Animated.View
      style={[
        styles.flameTongue,
        { left: cfg.left, bottom: cfg.bottom, ...shape },
        { transform: [{ translateY }, { translateX }, { scaleX }], opacity },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', tipColor, midColor, baseColor, deepBase]}
        locations={[0, 0.08, 0.35, 0.72, 1]}
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
  const active = Boolean(settings.sportMode);
  const flag = flagFor(settings.defaultTargetLanguage);
  const profileId = settings.soundProfile || 'merica';
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;
  const profileColor = profile.color || '#FF5000';

  const [showActivation, setShowActivation] = useState(false);

  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(0)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;
  const glowScale  = useRef(new Animated.Value(1)).current;

  // Glow pulse when active
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim,  { toValue: 1, duration: 900,  useNativeDriver: true }),
          Animated.timing(pulseAnim,  { toValue: 0, duration: 900,  useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.12, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 0.9,  duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(0);
      glowScale.stopAnimation(); glowScale.setValue(1);
    }
  }, [active, pulseAnim, glowScale]);

  const handlePress = useCallback(async () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.82, duration: 75,  useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    friction: 3, tension: 220, useNativeDriver: true }),
    ]).start();

    if (!active) {
      setShowActivation(true);
      playActivationSound(profileId);
      toggleSportMode();
    } else {
      playDeactivationSound(profileId);
      Animated.timing(fadeOutAnim, {
        toValue: 0, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start(() => { toggleSportMode(); fadeOutAnim.setValue(1); });
    }
  }, [active, toggleSportMode, scaleAnim, profileId, fadeOutAnim]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });

  return (
    <View style={styles.sportWrap}>
      {/* Radial ember glow behind button */}
      {active && (
        <Animated.View style={[
          styles.sportGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
            backgroundColor: `${profileColor}30`,
            shadowColor: profileColor,
          },
        ]} />
      )}

      {/* 6 flame tongues — rise from the button's bottom */}
      {FLAME_TONGUES.map((cfg, i) => (
        <FlameTongue key={i} cfg={cfg} active={active} profileColor={profileColor} />
      ))}

      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeOutAnim }}>
        <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
          <View style={[
            styles.sportBtn,
            active && styles.sportBtnActive,
            active && { borderColor: `${profileColor}BB`, shadowColor: profileColor },
          ]}>
            <Ionicons
              name="flame"
              size={active ? 28 : 22}
              color={active ? profileColor : colors.textMute}
            />
            {!active && <Text style={styles.sportLabel}>SPORT</Text>}
            {active && (
              <View style={styles.flagBadge}>
                <Text style={{ fontSize: 10 }}>{flag}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Profile colour dot */}
      {active && (
        <View style={[styles.profileDot, { backgroundColor: profileColor }]} />
      )}

      <SportModeActivation
        visible={showActivation}
        profileId={profileId}
        onComplete={() => setShowActivation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sportWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 68,
    height: 68,
  },
  sportGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    shadowOpacity: 0.85,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  flameTongue: {
    position: 'absolute',
    zIndex: 1,
  },
  sportBtn: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(14,16,20,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sportBtnActive: {
    backgroundColor: 'rgba(60,10,5,0.96)',
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  sportLabel: {
    color: colors.textMute,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  flagBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 7,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  profileDot: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 6,
  },
});
