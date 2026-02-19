/**
 * EmergencyButton
 * Floating red "emergency" button positioned bottom-left on the HomeScreen.
 * Pulses with a subtle glow to draw attention.
 * Opens the EmergencyInquiryModal on press.
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { impactMedium } from '../lib/haptics';

export function EmergencyButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    glow.start();
    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  const handlePress = () => {
    impactMedium();
    onPress?.();
  };

  return (
    <View style={styles.container}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />

      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityLabel="Emergency responses"
        accessibilityRole="button"
      >
        <Animated.View style={[styles.inner, { opacity: pulseAnim }]}>
          <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 220,
    left: 20,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,45,45,0.25)',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#FF2D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  inner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#CC1A1A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,80,80,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.93 }],
  },
});
