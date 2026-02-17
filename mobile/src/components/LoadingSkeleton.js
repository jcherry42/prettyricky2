/**
 * Loading Skeleton Component
 * Designo-styled shimmer placeholder for loading states.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonLine({ width = '100%', height = 14, style }) {
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(8,10,12,0.50)',
  },
  listContainer: {
    paddingTop: 8,
  },
});
