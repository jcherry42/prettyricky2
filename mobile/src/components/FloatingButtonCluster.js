import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { impactMedium } from '../lib/haptics';

/* ─── Liquid glass pill button ─── */
function GlassButton({ icon, iconColor, label, glowColor, onPress, onLongPress, size = 52 }) {
  return (
    <Pressable
      onPress={() => { impactMedium(); onPress?.(); }}
      onLongPress={onLongPress ? () => { impactMedium(); onLongPress(); } : undefined}
      delayLongPress={380}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.94 }], opacity: 0.92 }]}
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
  return (
    <View style={styles.cluster} pointerEvents="box-none">
      <View style={styles.pillBar}>
        {/* CHECK - Command Center */}
        <GlassButton
          icon="settings-outline"
          iconColor={colors.gold}
          label="CHECK"
          glowColor="rgba(214,178,94,0.35)"
          onPress={onCheck}
        />

        {/* EJECT - Print Center */}
        <GlassButton
          icon="push-outline"
          iconColor="#FF8C00"
          label="EJECT"
          glowColor="rgba(255,140,0,0.50)"
          onPress={onEject}
          size={52}
        />

        {/* TOWER TALK - AI Assistant */}
        <GlassButton
          icon="radio-outline"
          iconColor="#FF2D2D"
          label="TALK"
          glowColor="rgba(255,45,45,0.45)"
          onPress={onTowerTalk}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    position: 'absolute',
    bottom: 76,
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
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,12,16,0.75)',
    shadowColor: 'rgba(0,0,0,0.60)',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  glassOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(20,24,30,0.65)',
    overflow: 'visible',
    shadowColor: 'rgba(0,0,0,0.40)',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  glassInner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(25,28,35,0.50)',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
});
