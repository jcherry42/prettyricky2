import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { impactMedium } from '../lib/haptics';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const SIZE = 44;

interface GlassButtonProps {
  icon: string;
  iconColor: string;
  glowColor: string;
  tintColors: [string, string, string];
  onPress?: () => void;
  accessibilityLabel?: string;
}

function GlassButton({ icon, iconColor, glowColor, tintColors, onPress, accessibilityLabel }: GlassButtonProps) {
  return (
    <Pressable
      onPress={() => { impactMedium(); onPress?.(); }}
      style={({ pressed }) => [
        styles.btn,
        { shadowColor: glowColor },
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.90 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Outer glow halo */}
      <View style={[styles.halo, { shadowColor: glowColor }]} />

      {/* Glass base: dark semi-transparent background */}
      <View style={[StyleSheet.absoluteFill, styles.glassBase]} />

      {/* Colored gradient tint */}
      <LinearGradient
        colors={tintColors}
        locations={[0, 0.45, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2 }]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      {/* Top specular arc — bright crisp highlight */}
      <View style={styles.specularBright} />
      {/* Secondary softer specular */}
      <View style={styles.specularSoft} />

      {/* Inner rim highlight */}
      <View style={[styles.innerRim, { borderColor: `${glowColor}18` }]} />

      {/* Icon with glow */}
      <Ionicons
        name={icon as any}
        size={19}
        color={iconColor}
        style={{
          textShadowColor: glowColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 14,
        }}
      />
    </Pressable>
  );
}

export function FloatingButtonCluster({ onCheck, onEject, onTowerTalk }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 10;

  return (
    <View style={[styles.cluster, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.pillBar}>
        {/* Command Center — green */}
        <GlassButton
          icon="settings-outline"
          iconColor="#30D158"
          glowColor="#30D158"
          tintColors={['rgba(48,209,88,0.30)', 'rgba(48,209,88,0.08)', 'rgba(0,0,0,0.20)']}
          onPress={onCheck}
          accessibilityLabel="Command Center"
        />
        {/* Print Center — orange */}
        <GlassButton
          icon="push-outline"
          iconColor="#FF8C00"
          glowColor="#FF8C00"
          tintColors={['rgba(255,140,0,0.30)', 'rgba(255,140,0,0.08)', 'rgba(0,0,0,0.20)']}
          onPress={onEject}
          accessibilityLabel="Print Center"
        />
        {/* Tower Talk — red */}
        <GlassButton
          icon="radio-outline"
          iconColor="#FF3B30"
          glowColor="#FF3B30"
          tintColors={['rgba(255,59,48,0.30)', 'rgba(255,59,48,0.08)', 'rgba(0,0,0,0.20)']}
          onPress={onTowerTalk}
          accessibilityLabel="Tower Talk AI Assistant"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(4,6,10,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.75,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,14,20,0.75)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.60,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  glassBase: {
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(20,24,32,0.85)',
  },
  halo: {
    position: 'absolute',
    width: SIZE + 16,
    height: SIZE + 16,
    borderRadius: (SIZE + 16) / 2,
    backgroundColor: 'transparent',
    shadowOpacity: 0.65,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
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
    borderColor: 'transparent',
  },
});
