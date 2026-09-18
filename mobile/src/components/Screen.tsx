import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface ScreenProps {
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * Screen — premium root wrapper with deep obsidian gradient.
 * Multi-stop gradient creates spatial depth without competing
 * with card-level surfaces. Subtle warm undertone at the centre
 * gives the screen a rich, automotive-cockpit feel.
 */
export const Screen = memo(function Screen({ children, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, style]}>
      {/* Primary depth gradient */}
      <LinearGradient
        colors={[colors.bg0, '#060810', colors.bg2, '#060810', colors.bg0]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle warm vignette at centre — premium depth perception */}
      <LinearGradient
        colors={['rgba(214,178,94,0.012)', 'rgba(214,178,94,0.006)', 'rgba(0,0,0,0)']}
        style={styles.warmVignette}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
      <View
        style={{
          flex: 1,
          paddingTop: Math.max(8, insets.top + 6),
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
  warmVignette: {
    ...StyleSheet.absoluteFill,
  },
});
