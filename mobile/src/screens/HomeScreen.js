import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SUPERCHARG'D</Text>
      <Text style={styles.subtitle}>Sales Weapon System</Text>

      <GlassCard style={{ marginTop: 18 }}>
        <Text style={styles.cardTitle}>Zero wasted motion.</Text>
        <Text style={styles.cardBody}>
          VIN decode, Driver’s License capture, real-time translation and AI sales assist — tuned for
          speed.
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  brand: {
    color: colors.text,
    letterSpacing: 3.5,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: colors.textMute,
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardBody: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
});
