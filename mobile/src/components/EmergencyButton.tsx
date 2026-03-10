import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View } from 'react-native';
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
        {/* Glass base */}
        <View style={[StyleSheet.absoluteFill, styles.glassBase]} />

        {/* Red gradient tint */}
        <LinearGradient
          colors={['rgba(255,50,50,0.48)', 'rgba(180,20,20,0.22)', 'rgba(0,0,0,0.22)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />

        {/* Specular highlights */}
        <View style={styles.specularBright} />
        <View style={styles.specularSoft} />

        {/* Inner rim */}
        <View style={styles.innerRim} />

        {/* Centered icon with glow */}
        <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.75, 1] }) }}>
          <Ionicons
            name="alert-circle"
            size={26}
            color="#FFFFFF"
            style={{
              textShadowColor: '#FF2D2D',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
            }}
          />
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
    shadowOpacity: 0.85,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.50)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,20,20,0.12)',
    shadowColor: '#FF2D2D',
    shadowOpacity: 0.80,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  glassBase: {
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(20,24,32,0.85)',
  },
  specularBright: {
    position: 'absolute',
    top: 4,
    left: SIZE * 0.24,
    right: SIZE * 0.24,
    height: SIZE * 0.18,
    borderRadius: SIZE * 0.09,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  specularSoft: {
    position: 'absolute',
    top: 3,
    left: SIZE * 0.15,
    right: SIZE * 0.15,
    height: SIZE * 0.28,
    borderRadius: SIZE * 0.14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.12)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
});
