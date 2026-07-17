import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

export function InfotainmentShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      {/* Deep obsidian base gradient */}
      <LinearGradient
        colors={[colors.bg0, '#060810', colors.bg1, '#05070A']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Precision machined highlight — anisotropic shimmer */}
      <LinearGradient
        colors={['rgba(214,178,94,0.06)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.00)', 'rgba(214,178,94,0.03)']}
        locations={[0, 0.2, 0.5, 1]}
        style={styles.highlight}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        pointerEvents="none"
      />

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
    opacity: 0.85,
  },
});
