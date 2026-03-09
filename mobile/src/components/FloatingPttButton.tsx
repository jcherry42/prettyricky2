import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactHeavy } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const SIZE = scaleSize(58);

export function FloatingPttButton({ onPress, recording, disabled, flagLabel, badgeDirection = '→' }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

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
      <View style={[styles.halo, recording && styles.haloRecording]} />

      <Pressable
        disabled={disabled}
        onPress={() => { impactHeavy(); onPress?.(); }}
        style={({ pressed }) => [
          styles.btn,
          recording && styles.btnRecording,
          disabled && { opacity: 0.5 },
          pressed && !recording && { transform: [{ scale: 0.955 }], opacity: 0.92 },
        ]}
      >
        {/* Frosted glass base */}
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Gradient tint */}
        <LinearGradient
          colors={
            recording
              ? ['rgba(255,45,45,0.42)', 'rgba(180,0,0,0.18)', 'rgba(0,0,0,0.15)']
              : ['rgba(147,51,234,0.32)', 'rgba(109,40,217,0.12)', 'rgba(0,0,0,0.15)']
          }
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
        />

        {/* Top specular highlight */}
        <View style={[styles.specular, recording && styles.specularRecording]} />

        {/* Perfectly centered icon */}
        <Text style={styles.icon}>{recording ? '■' : '🎙'}</Text>
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
    shadowColor: '#9333EA',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  haloRecording: {
    shadowColor: '#FF2D2D',
    shadowOpacity: 0.7,
  },

  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.42)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.10)',
    shadowColor: '#9333EA',
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  btnRecording: {
    borderColor: 'rgba(255,45,45,0.50)',
    backgroundColor: 'rgba(255,45,45,0.10)',
    shadowColor: '#FF2D2D',
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
  specularRecording: {
    backgroundColor: 'rgba(255,150,150,0.10)',
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,        // explicit lineHeight prevents emoji baseline shifts
    textAlignVertical: 'center',
    includeFontPadding: false,  // Android: removes hidden top padding that shifts icons down
  },
});
