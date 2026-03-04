import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

/**
 * Screen — premium root wrapper with designo deep-obsidian gradient.
 * The gradient runs vertically from pure black to a hint of dark navy,
 * giving depth without competing with card-level surfaces.
 *
 * Note: paddingBottom is intentionally minimal here because each screen's
 * FlatList/ScrollView adds its own dynamic bottom padding based on safe area +
 * floating button positions. This prevents double-padding.
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
          // Top: account for status bar on screens without a navigation header
          paddingTop: Math.max(8, insets.top + 6),
          // Bottom: minimal — individual screens manage their own scroll padding
          paddingBottom: 0,
          paddingLeft: Math.max(0, insets.left),
          paddingRight: Math.max(0, insets.right),
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
