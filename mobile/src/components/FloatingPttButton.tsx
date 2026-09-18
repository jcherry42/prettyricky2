import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactHeavy } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/layout';

const SIZE = scaleSize(58);

export function FloatingPttButton({ onPress, recording, disabled, flagLabel, badgeDirection = '\u2192' }: { onPress: () => void; recording: boolean; disabled: boolean; flagLabel: string; badgeDirection?: string }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

  const glowColor = recording ? '#FF2D2D' : '#9333EA';
  const iconColor = recording ? '#FF6B6B' : '#C084FC';

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      {/* Language / direction badge */}
      {flagLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{flagLabel}</Text>
          <Text style={styles.badgeArrow}>{badgeDirection}</Text>
        </View>
      ) : null}

      {/* Outer glow halo */}
      <View style={[styles.halo, { shadowColor: glowColor }]} />

      <Pressable
        disabled={disabled}
        onPress={() => { impactHeavy(); onPress?.(); }}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop voice translation' : 'Start voice translation'}
        accessibilityHint="Push-to-talk translator between English and the customer's language"
        accessibilityState={{ disabled: !!disabled, busy: !!recording }}
        hitSlop={12}
        style={({ pressed }) => [
          styles.btn,
          { shadowColor: glowColor },
          recording && styles.btnRecording,
          disabled && { opacity: 0.5 },
          pressed && !recording && { transform: [{ scale: 0.955 }], opacity: 0.92 },
        ]}
      >
        {/* Glass base */}
        <View style={[StyleSheet.absoluteFill, styles.glassBase]} />

        {/* Gradient tint */}
        <LinearGradient
          colors={
            recording
              ? ['rgba(255,45,45,0.45)', 'rgba(180,0,0,0.18)', 'rgba(0,0,0,0.20)']
              : ['rgba(147,51,234,0.38)', 'rgba(109,40,217,0.12)', 'rgba(0,0,0,0.20)']
          }
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />

        {/* Specular highlights */}
        <View style={[styles.specularBright, recording && styles.specularRecording]} />
        <View style={[styles.specularSoft, recording && styles.specularSoftRecording]} />

        {/* Inner rim */}
        <View style={[styles.innerRim, { borderColor: recording ? 'rgba(255,45,45,0.12)' : 'rgba(147,51,234,0.12)' }]} />

        {/* Centered Ionicon */}
        <Ionicons
          name={recording ? 'stop' : 'mic'}
          size={24}
          color={iconColor}
          style={{
            textShadowColor: glowColor,
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
    right: scaleSize(16),
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: SIZE + 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.25)',
    backgroundColor: 'rgba(15,12,8,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText:  { color: colors.text, fontSize: 12, fontWeight: '900' },
  badgeArrow: { color: 'rgba(255,159,67,0.75)', fontSize: 12, fontWeight: '900' },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
    top: -(SIZE * 0.12),
    width: SIZE + 18,
    height: SIZE + 18,
    borderRadius: (SIZE + 18) / 2,
    backgroundColor: 'transparent',
    shadowOpacity: 0.65,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.45)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.10)',
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  btnRecording: {
    borderColor: 'rgba(255,45,45,0.55)',
    backgroundColor: 'rgba(255,45,45,0.10)',
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
    backgroundColor: 'rgba(255,255,255,0.20)',
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
  specularRecording: {
    backgroundColor: 'rgba(255,180,180,0.15)',
  },
  specularSoftRecording: {
    backgroundColor: 'rgba(255,150,150,0.05)',
  },
  innerRim: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    borderWidth: 1,
  },
});
