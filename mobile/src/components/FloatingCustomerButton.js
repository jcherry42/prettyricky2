import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { impactMedium, impactHeavy } from '../lib/haptics';

export function FloatingCustomerButton({ onPress, disabled }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
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

const SIZE = 56;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    bottom: 152,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(56,189,248,0.55)',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
    backgroundColor: 'rgba(8,47,73,0.9)',
  },
  innerCircle: {
    width: SIZE - 18,
    height: SIZE - 18,
    borderRadius: (SIZE - 18) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(15,23,42,0.95)',
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
