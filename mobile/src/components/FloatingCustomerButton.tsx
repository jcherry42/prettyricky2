import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { impactHeavy } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const SIZE = scaleSize(58);

export function FloatingCustomerButton({ onPress, disabled }: { onPress?: () => void; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      {/* Outer glow halo */}
      <View style={styles.halo} />

      <Pressable
        disabled={disabled}
        onPress={() => { impactHeavy(); onPress?.(); }}
        accessibilityRole="button"
        accessibilityLabel="Add or find a customer"
        accessibilityHint="Opens the customer intake and directory"
        accessibilityState={{ disabled: !!disabled }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.btn,
          pressed && !disabled && { transform: [{ scale: 0.955 }], opacity: 0.92 },
          disabled && { opacity: 0.5 },
        ]}
      >
        {/* Glass base */}
        <View style={[StyleSheet.absoluteFill, styles.glassBase]} />

        {/* Gradient tint */}
        <LinearGradient
          colors={['rgba(56,189,248,0.35)', 'rgba(14,165,233,0.10)', 'rgba(0,0,0,0.20)']}
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
        <Ionicons
          name="bluetooth"
          size={22}
          color="#7DD3FC"
          style={{
            textShadowColor: '#38BDF8',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 14,
          }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: scaleSize(16),
  },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
    top: -(SIZE * 0.12),
    width: SIZE + 18,
    height: SIZE + 18,
    borderRadius: (SIZE + 18) / 2,
    backgroundColor: 'transparent',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.60,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.10)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
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
    borderColor: 'rgba(56,189,248,0.12)',
  },
});
