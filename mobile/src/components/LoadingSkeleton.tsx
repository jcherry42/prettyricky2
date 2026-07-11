/**
 * Loading Skeleton Component
 * Designo-styled shimmer placeholder for loading states.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SkeletonLine({ width = '100%', height = 14, style }: { width?: string | number; height?: number; style?: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.line,
        { width, height, opacity },
        style,
      ]}
    />
  );
}

export function CustomerCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonLine width="60%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonLine width="45%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonLine width="70%" height={12} />
    </View>
  );
}

export function CustomerListSkeleton({ count = 5 }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <CustomerCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    borderRadius: 6,
    backgroundColor: 'rgba(214,178,94,0.06)',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
    backgroundColor: 'rgba(6,8,12,0.55)',
  },
  listContainer: {
    paddingTop: 8,
  },
});
