import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { impactMedium } from '../lib/haptics';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const SIZE = 54;

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
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.90 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* ── Outer halo glow ── */}
      <View style={[styles.halo, { shadowColor: glowColor }]} />

      {/* ── Frosted glass base ── */}
      <BlurView intensity={65} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2 }]} />

      {/* ── Colored tint over blur ── */}
      <LinearGradient
        colors={tintColors}
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2 }]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
      />

      {/* ── Specular highlight ── */}
      <View style={styles.specular} />

      {/* ── Icon — direct child, perfectly centered ── */}
      <Ionicons
        name={icon as any}
        size={22}
        color={iconColor}
        style={{
          textShadowColor: glowColor,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
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
          tintColors={['rgba(48,209,88,0.22)', 'rgba(48,209,88,0.06)', 'rgba(0,0,0,0.12)']}
          onPress={onCheck}
          accessibilityLabel="Command Center"
        />

        {/* Print Center — orange */}
        <GlassButton
          icon="push-outline"
          iconColor="#FF8C00"
          glowColor="#FF8C00"
          tintColors={['rgba(255,140,0,0.22)', 'rgba(255,140,0,0.06)', 'rgba(0,0,0,0.12)']}
          onPress={onEject}
          accessibilityLabel="Print Center"
        />

        {/* Tower Talk — red */}
        <GlassButton
          icon="radio-outline"
          iconColor="#FF3B30"
          glowColor="#FF3B30"
          tintColors={['rgba(255,59,48,0.22)', 'rgba(255,59,48,0.06)', 'rgba(0,0,0,0.12)']}
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
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(4,6,10,0.82)',
    shadowColor: '#000',
    shadowOpacity: 0.70,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },

  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(10,14,20,0.70)',
    overflow: 'hidden',
    // Perfectly center icon — single alignment context, no nested views
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },

  // Outer glow halo (behind the button, not clipped by overflow:hidden)
  halo: {
    position: 'absolute',
    width: SIZE + 16,
    height: SIZE + 16,
    borderRadius: (SIZE + 16) / 2,
    backgroundColor: 'transparent',
    shadowOpacity: 0.60,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },

  // Top specular arc — sells the glass look
  specular: {
    position: 'absolute',
    top: 5,
    left: SIZE * 0.22,
    right: SIZE * 0.22,
    height: SIZE * 0.25,
    borderRadius: SIZE * 0.12,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
});
