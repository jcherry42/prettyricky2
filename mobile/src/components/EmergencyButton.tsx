import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { impactMedium } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const SIZE = scaleSize(58);

export function EmergencyButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const insets    = useSafeAreaInsets();
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
      {/* Pulsing outer glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: pulseAnim }]} />

      <Pressable
        onPress={() => { impactMedium(); onPress?.(); }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityLabel="Emergency responses"
        accessibilityRole="button"
      >
        {/* Frosted glass base */}
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Red gradient tint */}
        <LinearGradient
          colors={['rgba(255,50,50,0.42)', 'rgba(180,20,20,0.22)', 'rgba(0,0,0,0.18)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />

        {/* Top specular highlight */}
        <View style={styles.specular} />

        {/* Perfectly centered icon */}
        <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.75, 1] }) }}>
          <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: SIZE + 20,
    height: SIZE + 20,
    borderRadius: (SIZE + 20) / 2,
    backgroundColor: 'rgba(255,45,45,0.22)',
    shadowColor: '#FF2D2D',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.45)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,20,20,0.12)',
    shadowColor: '#FF2D2D',
    shadowOpacity: 0.75,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  specular: {
    position: 'absolute',
    top: 4,
    left: SIZE * 0.22,
    right: SIZE * 0.22,
    height: SIZE * 0.26,
    borderRadius: SIZE * 0.13,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
});
