import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';

export function HomeScreen({ navigation }) {
  return (
    <Screen>
      <ScreenHeader title="Supercharg'd" subtitle="Sales Weapon" />

      <View style={{ height: 14 }} />

      <GlassCard style={styles.hero}>
        <Text style={styles.heroTitle}>Calm authority. Fast execution.</Text>
        <Text style={styles.heroBody}>
          Scan VIN and Driver’s License. Save inventory offline. Use Tower Talk to close high-stakes,
          emotional deals. SPORT unlocks translation + PTT.
        </Text>
      </GlassCard>

      <View style={{ height: 14 }} />

      <Pressable onPress={() => navigation.navigate('Scan')} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.primaryBtnText}>Open Scan</Text>
      </Pressable>

      <View style={{ height: 14 }} />

      <View style={styles.grid}>
        <GlassCard style={styles.tile}>
          <Text style={styles.tileLabel}>CHECK</Text>
          <Text style={styles.tileBody}>Command Center + Printer setup. Long-press for Print Center.</Text>
        </GlassCard>
        <GlassCard style={styles.tile}>
          <Text style={styles.tileLabel}>ONSTAR</Text>
          <Text style={styles.tileBody}>Tower Talk: high-performance closing and objection handling.</Text>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 26,
  },
  heroTitle: {
    color: colors.text,
    ...type.h2,
  },
  heroBody: {
    marginTop: 10,
    color: colors.textDim,
    ...type.body,
    lineHeight: 19,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.70)',
    backgroundColor: 'rgba(214,178,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.gold,
    ...type.label,
  },
  grid: {
    flexDirection: 'row',
    gap: 14,
  },
  tile: {
    flex: 1,
    borderRadius: 22,
  },
  tileLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  tileBody: {
    marginTop: 10,
    color: colors.textDim,
    ...type.bodyDim,
    lineHeight: 18,
  },
});
