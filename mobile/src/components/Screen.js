import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

/**
 * Screen — premium root wrapper with designo deep-obsidian gradient.
 * The gradient runs vertically from pure black to a hint of dark navy,
 * giving depth without competing with card-level surfaces.
 */
export const Screen = memo(function Screen({ children, style }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[colors.bg0, colors.bg1, colors.bg2, colors.bg1]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flex: 1,
          paddingTop: Math.max(12, insets.top + 8),
          paddingBottom: Math.max(12, insets.bottom + 12),
          paddingLeft: Math.max(16, insets.left + 16),
          paddingRight: Math.max(16, insets.right + 16),
        }}
      >
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
});
