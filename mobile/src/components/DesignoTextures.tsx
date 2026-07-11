/**
 * DesignoTextures Component
 * Provides luxury texture overlays inspired by Mercedes-Benz designo materials.
 * Quilted leather, wood grain, brushed metal patterns for React Native.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

/**
 * Quilted Leather Overlay
 * Diamond pattern typical of Nappa leather seats.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function QuiltedLeatherOverlay({ style, tint = 'dark' }: { style?: any; tint?: string }) {
  const base = tint === 'light'
    ? 'rgba(232,220,200,0.04)'
    : 'rgba(74,31,47,0.06)';
  const line = tint === 'light'
    ? 'rgba(232,220,200,0.08)'
    : 'rgba(214,178,94,0.06)';

  return (
    <View style={[styles.overlay, style]} pointerEvents="none">
      {/* Diagonal lines creating diamond pattern */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={`ql-${i}`}
          style={[
            styles.quiltLine,
            {
              top: i * 28,
              backgroundColor: line,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={`qr-${i}`}
          style={[
            styles.quiltLine,
            {
              top: i * 28,
              backgroundColor: line,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
      ))}
      {/* Subtle leather tint */}
      <LinearGradient
        colors={[base, 'transparent', base]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Wood Bezel Frame
 * Burr walnut or Bird's-Eye Maple frame effect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function WoodBezelFrame({ children, style, variant = 'walnut' }: { children?: React.ReactNode; style?: any; variant?: string }) {
  const woodColors = (variant === 'maple'
    ? [colors.woodBirdsEyeMaple, colors.woodBirdsEyeMapleLight, colors.woodBirdsEyeMaple]
    : [colors.woodBurrWalnut, colors.woodBurrWalnutLight, colors.woodBurrWalnut]) as [string, string, ...string[]];

  return (
    <View style={[styles.woodBezelOuter, style]}>
      <LinearGradient
        colors={woodColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.woodBezelGradient}
      >
        {/* Wood grain texture lines */}
        <View style={styles.woodGrainContainer} pointerEvents="none">
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={`wg-${i}`}
              style={[
                styles.woodGrainLine,
                {
                  top: 2 + i * 5,
                  opacity: 0.08 + (i % 3) * 0.04,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.woodBezelInner}>
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

/**
 * Brushed Metal Surface
 * Fine horizontal brushing pattern for premium surfaces.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BrushedMetalSurface({ children, style }: { children?: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.metalSurface, style]}>
      <LinearGradient
        colors={[
          'rgba(168,178,188,0.08)',
          'rgba(192,200,208,0.04)',
          'rgba(168,178,188,0.08)',
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Fine brushing lines */}
      <View style={styles.brushContainer} pointerEvents="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={`br-${i}`}
            style={[
              styles.brushLine,
              {
                top: i * 4,
                opacity: 0.03 + (i % 4) * 0.015,
              },
            ]}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

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

/**
 * Contrast Stitching Line
 * Decorative gold stitch pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ContrastStitching({ style, horizontal = true }: { style?: any; horizontal?: boolean }) {
  return (
    <View
      style={[
        horizontal ? styles.stitchingH : styles.stitchingV,
        style,
      ]}
      pointerEvents="none"
    >
      {Array.from({ length: horizontal ? 30 : 20 }).map((_, i) => (
        <View
          key={`st-${i}`}
          style={[
            styles.stitch,
            horizontal
              ? { width: 6, height: 1, marginRight: 4 }
              : { width: 1, height: 6, marginBottom: 4 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  quiltLine: {
    position: 'absolute',
    left: -50,
    right: -50,
    height: 0.5,
  },
  woodBezelOuter: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  woodBezelGradient: {
    padding: 3,
    borderRadius: 16,
    position: 'relative',
  },
  woodGrainContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  woodGrainLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  woodBezelInner: {
    borderRadius: 13,
    overflow: 'hidden',
  },
  metalSurface: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  brushContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  brushLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
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
  stitchingH: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stitchingV: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  stitch: {
    backgroundColor: colors.contrastStitching,
    opacity: 0.25,
    borderRadius: 0.5,
  },
});
