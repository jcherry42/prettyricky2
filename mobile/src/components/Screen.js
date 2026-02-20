import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Screen = memo(function Screen({ children, style }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(12, insets.top + 8),
          paddingBottom: Math.max(12, insets.bottom + 12),
          paddingLeft: Math.max(16, insets.left + 16),
          paddingRight: Math.max(16, insets.right + 16),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
});
