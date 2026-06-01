import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * GlassCard — Ferrari-infotainment-grade surface panel.
 * Multi-layer depth with anisotropic shimmer, warm gold micro-tint,
 * and precision top-edge specular highlight. Static/memoized to prevent
 * re-renders from ambient lighting cycles.
 */
export const GlassCard = memo(function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.outerShadow, style]}>
      <View style={styles.wrap}>
        {/* Primary surface gradient — subtle warm tone shift */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.09)',
            'rgba(255,255,255,0.028)',
            'rgba(214,178,94,0.025)',
            'rgba(255,255,255,0.018)',
            'rgba(255,255,255,0.05)',
          ]}
          locations={[0, 0.25, 0.50, 0.75, 1.0]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Top-edge specular highlight — precision machined bevel */}
        <LinearGradient
          colors={['rgba(214,178,94,0.16)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.00)']}
          locations={[0, 0.3, 1]}
          style={styles.topHighlight}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Bottom inner shadow — recessed depth */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)']}
          style={styles.bottomInnerShadow}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />
        <View style={styles.inner}>{children}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerShadow: {
    // Layered shadow system: ambient (broad, soft) + key (tight, deep)
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,14,0.92)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  bottomInnerShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  inner: {
    padding: 16,
  },
});
