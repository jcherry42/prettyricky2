/**
 * DesignoTextures Component
 * Luxury accents inspired by Mercedes-Benz designo materials.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Chrome Accent Line
 * High-polish chrome divider.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ChromeAccent({ style }: { style?: any }) {
  return (
    <View style={[styles.chromeWrap, style]}>
      <LinearGradient
        colors={[
          'transparent',
          'rgba(192,200,208,0.25)',
          'rgba(214,178,94,0.20)',
          'rgba(192,200,208,0.45)',
          'rgba(214,178,94,0.20)',
          'rgba(192,200,208,0.25)',
          'transparent',
        ]}
        locations={[0, 0.12, 0.35, 0.5, 0.65, 0.88, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.chromeAccent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chromeWrap: {
    height: 1.5,
    width: '100%',
    shadowColor: 'rgba(214,178,94,0.4)',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  chromeAccent: {
    height: 1.5,
    width: '100%',
    borderRadius: 1,
  },
});
