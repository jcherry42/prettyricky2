import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {/* Precision separator line — gold micro-tint */}
      <LinearGradient
        colors={['rgba(214,178,94,0)', 'rgba(214,178,94,0.15)', 'rgba(214,178,94,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.separator}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
  },
  title: {
    color: colors.text,
    ...type.h1,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});
