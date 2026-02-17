/**
 * PicassoSwirls Component
 * Hand-painted abstract patterns inspired by Picasso.
 * Dark mode: burgundy + teal
 * Light mode: dusty rose + sage green
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

/**
 * Animated swirl overlay for premium surfaces
 */
export function PicassoSwirls({ mode = 'dark', style, intensity = 0.6 }) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animValue]);

  const isDark = mode === 'dark';
  const color1 = isDark ? colors.picassoBurgundy : colors.picassoDustyRose;
  const color2 = isDark ? colors.picassoTeal : colors.picassoSageGreen;
  const color3 = isDark ? 'transparent' : colors.picassoIvory;

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const opacity1 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [intensity * 0.3, intensity * 0.5, intensity * 0.3],
  });

  const opacity2 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [intensity * 0.5, intensity * 0.3, intensity * 0.5],
  });

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* Swirl layer 1 - top left */}
      <Animated.View
        style={[
          styles.swirlBlob,
          styles.swirlTopLeft,
          {
            opacity: opacity1,
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={[`${color1}80`, `${color1}20`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Swirl layer 2 - bottom right */}
      <Animated.View
        style={[
          styles.swirlBlob,
          styles.swirlBottomRight,
          {
            opacity: opacity2,
            transform: [
              { translateX: Animated.multiply(translateX, -1) },
              { translateY: Animated.multiply(translateY, -1) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[`${color2}80`, `${color2}20`, 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Subtle center wash */}
      <View style={styles.centerWash}>
        <LinearGradient
          colors={['transparent', `${color3}08`, 'transparent']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

/**
 * Static Picasso accent for smaller elements
 */
export function PicassoAccent({ mode = 'dark', style }) {
  const isDark = mode === 'dark';
  const color1 = isDark ? colors.picassoBurgundy : colors.picassoDustyRose;
  const color2 = isDark ? colors.picassoTeal : colors.picassoSageGreen;

  return (
    <View style={[styles.accentContainer, style]} pointerEvents="none">
      <LinearGradient
        colors={[`${color1}30`, 'transparent', `${color2}30`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
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
    overflow: 'hidden',
  },
  swirlBlob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  swirlTopLeft: {
    top: -40,
    left: -40,
    width: 200,
    height: 200,
  },
  swirlBottomRight: {
    bottom: -40,
    right: -40,
    width: 180,
    height: 180,
  },
  centerWash: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    bottom: '20%',
  },
  accentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
