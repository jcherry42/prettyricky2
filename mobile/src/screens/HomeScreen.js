import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';

export function HomeScreen({ navigation }) {
  return (
    <Screen>
      <ScreenHeader title="Supercharg'd" subtitle="Sales Weapon" />

      <View style={{ height: 14 }} />

      <Pressable onPress={() => navigation.navigate('Scan')} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.primaryBtnText}>Open Scan</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // hero removed
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.70)',
    backgroundColor: 'rgba(214,178,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.gold,
    ...type.label,
  },
  // tiles removed
});
