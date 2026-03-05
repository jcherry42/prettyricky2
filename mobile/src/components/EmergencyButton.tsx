import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactMedium } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

export function EmergencyButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const glowAnim  = useRef(new Animated.Value(0.3)).current;
  const insets    = useSafeAreaInsets();

  // Same vertical row as the Bluetooth (left) and PTT (right) buttons
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

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
    return () => { pulse.stop(); glow.stop(); };
  }, [pulseAnim, glowAnim]);

  return (
    // Span full width, center the button horizontally → sits between left and right floating buttons
    <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
      {/* Outer glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />

      <Pressable
        onPress={() => { impactMedium(); onPress?.(); }}
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

const SIZE = scaleSize(56);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',    // horizontally centered between left and right floaters
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: SIZE + 14,
    height: SIZE + 14,
    borderRadius: (SIZE + 14) / 2,
    backgroundColor: 'rgba(255,45,45,0.25)',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#FF2D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  inner: {
    flex: 1,
    borderRadius: SIZE / 2,
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
