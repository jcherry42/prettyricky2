import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

/**
 * GlassCard — memoized, no ambient hook.
 * The AmbientLightingSystem overlay handles the global color effect;
 * individual cards stay fully static so they are never re-rendered
 * by the 468 ms ambient color cycle.
 */
export const GlassCard = memo(function GlassCard({ children, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.inner}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.16)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,12,0.74)',
    shadowColor: '#000',
    shadowOpacity: 0.50,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  inner: {
    padding: 16,
  },
});
