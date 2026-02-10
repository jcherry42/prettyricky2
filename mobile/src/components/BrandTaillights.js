import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';

// Mobile reinterpretation of the web header taillights + SUPERCHARG'D text.
// No buttons, just the signature mark.
export function BrandTaillights({ compact = false }) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 6 }]}>
      <View style={styles.cluster}>
        <View style={[styles.light, styles.outer]}>
          <View style={styles.ring} />
          <View style={styles.center} />
        </View>
        <View style={[styles.light, styles.inner]}>
          <View style={styles.ring} />
          <View style={styles.center} />
        </View>
      </View>

      <View style={styles.centerText}>
        <Text style={styles.brand}>SUPERCHARG'D</Text>
      </View>

      <View style={styles.cluster}>
        <View style={[styles.light, styles.inner]}>
          <View style={styles.ring} />
          <View style={styles.center} />
        </View>
        <View style={[styles.light, styles.outer]}>
          <View style={styles.ring} />
          <View style={styles.center} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  cluster: {
    flexDirection: 'row',
    gap: 8,
  },
  light: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.45)',
    backgroundColor: 'rgba(255,45,45,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,45,45,0.55)',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  outer: {
    width: 24,
    height: 24,
  },
  inner: {
    width: 20,
    height: 20,
    borderColor: 'rgba(255,45,45,0.35)',
    backgroundColor: 'rgba(255,45,45,0.08)',
  },
  ring: {
    position: 'absolute',
    width: '88%',
    height: '88%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.45)',
    opacity: 0.9,
  },
  center: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,75,75,0.60)',
  },
  centerText: {
    flex: 1,
    alignItems: 'center',
  },
  brand: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.4,
  },
});
