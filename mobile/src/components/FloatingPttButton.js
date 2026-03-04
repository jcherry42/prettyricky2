import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactMedium, impactHeavy } from '../lib/haptics';
import { scaleSize } from '../theme/layout';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

export function FloatingPttButton({ onPress, recording, disabled, flagLabel, badgeDirection = '→' }) {
  const insets = useSafeAreaInsets();
  // Position above cluster (tab bar + safe area + cluster height + gap) — mirrors customer button
  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + scaleSize(76);

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      {flagLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{flagLabel}</Text>
          <Text style={styles.badgeArrow}>{badgeDirection}</Text>
        </View>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={() => { impactHeavy(); onPress?.(); }}
        style={({ pressed }) => [
          styles.btn,
          recording && styles.btnRecording,
          disabled && { opacity: 0.75 },
          pressed && !recording && { transform: [{ scale: 0.985 }], opacity: 0.94 },
        ]}
      >
        <LinearGradient
          colors={recording ? ['rgba(255,45,45,0.35)', 'rgba(0,0,0,0.25)'] : ['rgba(147,51,234,0.18)', 'rgba(0,0,0,0.25)']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
        />
        <Text style={styles.icon}>{recording ? '■' : '🎙'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: scaleSize(16),
    // bottom is now dynamic — set inline using insets
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 70,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.25)',
    backgroundColor: 'rgba(15, 12, 8, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  badgeArrow: {
    color: 'rgba(255, 159, 67, 0.75)',
    fontSize: 12,
    fontWeight: '900',
  },
  btn: {
    width: scaleSize(56),
    height: scaleSize(56),
    borderRadius: scaleSize(28),
    borderWidth: 2,
    borderColor: 'rgba(147,51,234,0.40)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(147,51,234,0.25)',
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    backgroundColor: 'rgba(126,34,206,0.12)',
  },
  btnRecording: {
    borderColor: 'rgba(255,45,45,0.55)',
    shadowColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.10)',
  },
  icon: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
