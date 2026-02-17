/**
 * Sport Mode Activation Overlay
 * Full-screen flash effect when SPORT mode is activated.
 * Shows the sound profile name + flames animation.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SOUND_PROFILES } from '../lib/soundProfiles';
import { colors } from '../theme/colors';

export function SportModeActivation({ visible, profileId = 'merica', onComplete }) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;

  useEffect(() => {
    if (visible) {
      // Flash in
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
      ]).start();

      // Auto-dismiss after 1.2s with fade-out
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start(() => {
          onComplete?.();
        });
      }, 500);

      return () => clearTimeout(timer);
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.6);
      textOpacity.setValue(0);
    }
  }, [visible, opacityAnim, scaleAnim, textOpacity, onComplete]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: opacityAnim }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          `${profile.color}15`,
          `${profile.color}25`,
          `${profile.color}15`,
          'rgba(0,0,0,0)',
        ]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.Text style={[styles.emoji, { opacity: textOpacity }]}>
          {profile.emoji}
        </Animated.Text>
        <Animated.Text style={[styles.profileName, { opacity: textOpacity, color: profile.color }]}>
          {profile.name}
        </Animated.Text>
        <Animated.Text style={[styles.sportText, { opacity: textOpacity }]}>
          SPORT MODE ENGAGED
        </Animated.Text>
      </Animated.View>

      {/* Edge glow lines */}
      <View style={[styles.edgeGlow, styles.edgeTop, { backgroundColor: profile.color }]} />
      <View style={[styles.edgeGlow, styles.edgeBottom, { backgroundColor: profile.color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 48,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  sportText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 4,
  },
  edgeGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
  edgeTop: {
    top: 0,
  },
  edgeBottom: {
    bottom: 0,
  },
});
