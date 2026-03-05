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
import { StyleSheet, View, Pressable, Text, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
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

// ─── Flame GIF (transparent background) ──────────────────────────────────────

const FLAME_GIF = require('../../assets/flames/flame.gif');

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
      glowOpacity.value = withTiming(1, { duration: 220 });
    } else {
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0, { duration: 250 });
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


  return (
    <View style={styles.wrap}>

      <Animated.View style={[styles.flameWrap, glowStyle]} pointerEvents="none">
        <Image source={FLAME_GIF} style={styles.flameGif} />
      </Animated.View>

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
  flameWrap: {
    position: 'absolute',
    width: 140,
    height: 200,
    left: -30,
    bottom: -80,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flameGif: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
