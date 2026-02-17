import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { useAmbientLighting } from '../hooks/useAmbientLighting';

export function GlassCard({ children, style, ambientGlow = true }) {
  const { isEnabled, currentColor, opacity } = useAmbientLighting();

  const showGlow = ambientGlow && isEnabled && currentColor;

  // Compute a subtle glow border from ambient color
  const glowBorder = showGlow
    ? `${currentColor}${Math.round(opacity * 2 * 255).toString(16).padStart(2, '0')}`
    : 'rgba(214,178,94,0.16)';

  const glowShadow = showGlow ? currentColor : '#000';
  const glowShadowOpacity = showGlow ? opacity * 3 : 0.5;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: glowBorder,
          shadowColor: glowShadow,
          shadowOpacity: glowShadowOpacity,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Subtle ambient glow overlay at the top edge */}
      {showGlow && (
        <LinearGradient
          colors={[
            `${currentColor}${Math.round(opacity * 1.5 * 255).toString(16).padStart(2, '0')}`,
            'transparent',
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={styles.ambientOverlay}
          pointerEvents="none"
        />
      )}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.16)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,12,0.74)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  inner: {
    padding: 16,
  },
  ambientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
});
