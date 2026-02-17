/**
 * Ambient Lighting System Component
 * Displays radial gradients on screen edges with 64-color cycling
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAmbientLighting } from '../hooks/useAmbientLighting';

export function AmbientLightingSystem() {
  const { isEnabled, currentColor, opacity } = useAmbientLighting();

  if (!isEnabled) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top radial gradient */}
      <LinearGradient
        colors={[
          `${currentColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
          'transparent',
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
        style={styles.topGradient}
      />

      {/* Bottom radial gradient */}
      <LinearGradient
        colors={[
          'transparent',
          `${currentColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        ]}
        start={{ x: 0.5, y: 0.7 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomGradient}
      />

      {/* Left edge glow */}
      <LinearGradient
        colors={[
          `${currentColor}${Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0')}`,
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.15, y: 0.5 }}
        style={styles.leftGradient}
      />

      {/* Right edge glow */}
      <LinearGradient
        colors={[
          'transparent',
          `${currentColor}${Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0')}`,
        ]}
        start={{ x: 0.85, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rightGradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  leftGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '15%',
  },
  rightGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '15%',
  },
});
