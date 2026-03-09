import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
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
        style={({ pressed }) => [
          styles.btn,
          pressed && !disabled && { transform: [{ scale: 0.955 }], opacity: 0.92 },
          disabled && { opacity: 0.5 },
        ]}
      >
        {/* Frosted glass base */}
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Gradient tint over the blur */}
        <LinearGradient
          colors={['rgba(56,189,248,0.28)', 'rgba(14,165,233,0.08)', 'rgba(0,0,0,0.15)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
        />

        {/* Top specular highlight */}
        <View style={styles.specular} />

        {/* Perfectly centered icon — no nested containers that shift it */}
        <Ionicons name="bluetooth" size={22} color="#7DD3FC" />
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
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.40)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.10)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  specular: {
    position: 'absolute',
    top: 4,
    left: SIZE * 0.2,
    right: SIZE * 0.2,
    height: SIZE * 0.28,
    borderRadius: SIZE * 0.14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
