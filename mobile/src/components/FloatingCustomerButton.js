import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactMedium, impactHeavy } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

export function FloatingCustomerButton({ onPress, disabled }) {
  const insets = useSafeAreaInsets();
  // Position above cluster (tab bar + safe area + cluster height + gap)
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <Pressable
        disabled={disabled}
        onPress={() => {
          impactHeavy();
          onPress?.();
        }}
        style={({ pressed }) => [
          styles.btn,
          pressed && !disabled && { transform: [{ scale: 0.96 }], opacity: 0.96 },
          disabled && { opacity: 0.65 },
        ]}
      >
        <LinearGradient
          colors={['rgba(56,189,248,0.35)', 'rgba(8,47,73,0.95)']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
        />
        <View style={styles.innerCircle}>
          <Ionicons name="bluetooth" size={22} color={colors.text} />
        </View>
        <View style={styles.glow} />
      </Pressable>
    </View>
  );
}

const SIZE = scaleSize(56);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: scaleSize(16),
    // bottom is now dynamic — set inline using insets
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(56,189,248,0.75)',
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  innerCircle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: SIZE + 14,
    height: SIZE + 14,
    borderRadius: (SIZE + 14) / 2,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: 'rgba(56,189,248,0.75)',
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
});
