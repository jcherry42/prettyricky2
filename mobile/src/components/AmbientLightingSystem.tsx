/**
 * Ambient Lighting System Component
 * Displays radial gradients on screen edges with 64-color cycling.
 * 30-second full spectrum cycle. 3 intensity levels.
 * Eco-mode aware: disables when eco mode is on.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAmbientLighting } from '../hooks/useAmbientLighting';
import { useAppSettings } from '../context/AppSettingsContext';

function hexOpacity(color: string, opacity: number) {
  const clamped = Math.max(0, Math.min(1, opacity));
  const hex = Math.round(clamped * 255).toString(16).padStart(2, '0');
  return `${color}${hex}`;
}

export function AmbientLightingSystem() {
  const { isEnabled, currentColor, opacity } = useAmbientLighting();
  const { settings } = useAppSettings();

  // Disable if eco mode is on or ambient lighting is off
  if (!isEnabled || settings?.ecoMode) return null;
  if (!currentColor) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top edge glow */}
      <LinearGradient
        colors={[hexOpacity(currentColor, opacity), 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.25 }}
        style={styles.topGradient}
      />

      {/* Bottom edge glow */}
      <LinearGradient
        colors={['transparent', hexOpacity(currentColor, opacity)]}
        start={{ x: 0.5, y: 0.75 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomGradient}
      />

      {/* Left edge glow */}
      <LinearGradient
        colors={[hexOpacity(currentColor, opacity * 0.6), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.12, y: 0.5 }}
        style={styles.leftGradient}
      />

      {/* Right edge glow */}
      <LinearGradient
        colors={['transparent', hexOpacity(currentColor, opacity * 0.6)]}
        start={{ x: 0.88, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rightGradient}
      />

      {/* Corner accents for extra premium feel */}
      <LinearGradient
        colors={[hexOpacity(currentColor, opacity * 0.4), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 0.3 }}
        style={styles.cornerTopLeft}
      />
      <LinearGradient
        colors={[hexOpacity(currentColor, opacity * 0.4), 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.7, y: 0.3 }}
        style={styles.cornerTopRight}
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
    height: '25%',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '25%',
  },
  leftGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '12%',
  },
  rightGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '12%',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
  },
});
