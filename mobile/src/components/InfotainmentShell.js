import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { AmbientLightingSystem } from './AmbientLightingSystem';

export function InfotainmentShell({ children }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bg0, colors.bg1, '#05070A']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* subtle "machined" highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.00)', 'rgba(255,255,255,0.06)']}
        locations={[0, 0.4, 1]}
        style={styles.highlight}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        pointerEvents="none"
      />

      {/* 64-color ambient lighting system */}
      <AmbientLightingSystem />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  content: {
    flex: 1,
    width: '100%',
  },

  highlight: {
    position: 'absolute',
    left: -120,
    top: -180,
    width: 520,
    height: 520,
    transform: [{ rotate: '18deg' }],
    opacity: 0.9,
  },
});
