import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactMedium } from '../lib/haptics';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

/* ─── Liquid glass pill button ─── */
function GlassButton({ icon, iconColor, glowColor, onPress, size = 52, accessibilityLabel }) {
  return (
    <Pressable
      onPress={() => { impactMedium(); onPress?.(); }}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.94 }], opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.glassOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        {/* Liquid glass layers */}
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.10)']}
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <View style={[styles.glassInner, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.15)']}
            locations={[0, 0.45, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: (size - 4) / 2 }]}
          />
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        {/* Glow ring */}
        {glowColor && (
          <View style={[styles.glowRing, {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            shadowColor: glowColor,
          }]} />
        )}
      </View>
    </Pressable>
  );
}

export function FloatingButtonCluster({ onCheck, onEject, onTowerTalk }) {
  const insets = useSafeAreaInsets();
  // Position cluster just above the tab bar (tab bar height + safe area + spacing)
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 10;

  return (
    <View style={[styles.cluster, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.pillBar}>
        {/* CHECK - Command Center */}
        <GlassButton
          icon="settings-outline"
          iconColor={colors.gold}
          glowColor="rgba(214,178,94,0.35)"
          onPress={onCheck}
          accessibilityLabel="Command Center"
        />

        <GlassButton
          icon="push-outline"
          iconColor="#FF8C00"
          glowColor="rgba(255,140,0,0.50)"
          onPress={onEject}
          accessibilityLabel="Print Center"
        />

        <GlassButton
          icon="radio-outline"
          iconColor="#FF2D2D"
          glowColor="rgba(255,45,45,0.45)"
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
    // bottom is now dynamic — set inline using insets
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(6,8,12,0.80)',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  glassOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(14,18,24,0.70)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  glassInner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(20,24,30,0.55)',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowOpacity: 0.70,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
