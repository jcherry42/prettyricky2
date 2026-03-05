import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface GlassCardProps {
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * GlassCard — memoized, brushed aluminum premium finish.
 * Dark metallic surface with subtle anisotropic shimmer suggesting CNC-machined aluminum.
 * The AmbientLightingSystem overlay handles the global color effect;
 * individual cards stay fully static so they are never re-rendered
 * by the 468 ms ambient color cycle.
 */
export const GlassCard = memo(function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.wrap, style]}>
      {/* Brushed aluminum base — subtle horizontal gradient bands */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.085)',
          'rgba(255,255,255,0.030)',
          'rgba(255,255,255,0.060)',
          'rgba(255,255,255,0.018)',
          'rgba(255,255,255,0.045)',
        ]}
        locations={[0, 0.25, 0.50, 0.75, 1.0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      {/* Top-edge specular highlight — machined bevel */}
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.00)']}
        style={styles.topHighlight}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.inner}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,14,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  inner: {
    padding: 16,
  },
});

