import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';

// Mobile reinterpretation of the web header taillights + SUPERCHARG'D text.
// No buttons, just the signature mark.
export function BrandTaillights({ compact = false }) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 6 }]}>
      <View style={styles.housing}>
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
      </View>

      <View style={styles.centerText}>
        <Text style={styles.brand}>SUPERCHARG'D</Text>
      </View>

      <View style={styles.housing}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  housing: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.18)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluster: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
  },
  light: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,45,45,0.55)',
    backgroundColor: 'rgba(255,45,45,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,45,45,0.75)',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  outer: {
    width: 24,
    height: 24,
  },
  inner: {
    width: 24,
    height: 24,
    borderColor: 'rgba(255,45,45,0.45)',
    backgroundColor: 'rgba(255,45,45,0.08)',
  },
  ring: {
    position: 'absolute',
    width: '86%',
    height: '86%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,45,45,0.55)',
    opacity: 0.9,
  },
  center: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,75,75,0.75)',
  },
  centerText: {
    alignItems: 'center',
  },
  brand: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.6,
  },
});
