import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';

// Mobile reinterpretation of the web header taillights + SUPERCHARG'D text.
// Goal: closer to an R34 cluster: outer lamp larger than inner, with even baselines,
// and a premium dotted LED ring feel.

function LedRing({ size, dots = 14, dotSize = 2.4 }) {
  const pts = useMemo(() => {
    const r = size * 0.36;
    const cx = size / 2;
    const cy = size / 2;
    const out = [];
    for (let i = 0; i < dots; i += 1) {
      const a = (Math.PI * 2 * i) / dots;
      out.push({
        key: i,
        left: cx + Math.cos(a) * r - dotSize / 2,
        top: cy + Math.sin(a) * r - dotSize / 2,
      });
    }
    return out;
  }, [size, dots, dotSize]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pts.map((p) => (
        <View
          key={p.key}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: dotSize,
            height: dotSize,
            borderRadius: 999,
            backgroundColor: 'rgba(255,35,35,1.0)',
            shadowColor: 'rgba(255,35,35,1.0)',
            shadowOpacity: 0.78,
            shadowRadius: 7,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}

function Lamp({ size, variant }) {
  const isOuter = variant === 'outer';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: isOuter ? 'rgba(255,45,45,0.40)' : 'rgba(255,45,45,0.28)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: 'rgba(255,45,45,0.55)',
        shadowOpacity: isOuter ? 0.40 : 0.28,
        shadowRadius: isOuter ? 14 : 10,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View
        style={{
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(255,45,45,0.22)',
          backgroundColor: isOuter ? 'rgba(255,45,45,0.05)' : 'rgba(255,45,45,0.035)',
          overflow: 'hidden',
        }}
      />

      {/* dotted LED ring */}
      <LedRing size={size} dots={isOuter ? 16 : 14} dotSize={isOuter ? 2.6 : 2.2} />

      {/* subtle center lens */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: 999,
          backgroundColor: 'rgba(255,80,80,0.20)',
          borderWidth: 1,
          borderColor: 'rgba(255,80,80,0.24)',
        }}
      />
    </View>
  );
}

function Cluster({ flip = false }) {
  // Outer larger, inner smaller, aligned bottoms (like R34).
  const outer = 26;
  const inner = 18;

  const left = flip ? <Lamp size={inner} variant="inner" /> : <Lamp size={outer} variant="outer" />;
  const right = flip ? <Lamp size={outer} variant="outer" /> : <Lamp size={inner} variant="inner" />;

  return (
    <View style={styles.housing}>
      <View style={styles.cluster}>
        {left}
        {right}
      </View>
    </View>
  );
}

export function BrandTaillights({ compact = false }) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 6 }]}>
      <Cluster />

      <View style={styles.centerText}>
        <Text style={styles.brand}>SUPERCHARG'D</Text>
      </View>

      <Cluster flip />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  housing: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.16)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluster: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  centerText: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  brand: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.6,
  },
});
