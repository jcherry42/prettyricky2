import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';

function ActionCard({ title, body, accent, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.9 }]}
    >
      <GlassCard style={[styles.card, { borderColor: accent }]}
      >
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </GlassCard>
    </Pressable>
  );
}

export function ScanHubScreen({ navigation }) {
  return (
    <Screen>
      <ScreenHeader title="Scan" subtitle="VIN + Driver’s License" />

      <View style={{ height: 14 }} />

      <ActionCard
        title="VIN Scan"
        body="Capture VIN fast. Decode. Save to Local Inventory."
        accent="rgba(214,178,94,0.55)"
        onPress={() => navigation.navigate('VinScan')}
      />

      <View style={{ height: 14 }} />

      <ActionCard
        title="Driver’s License"
        body="Front-image OCR to extract name, address, DL#, expiration."
        accent="rgba(255,45,45,0.45)"
        onPress={() => navigation.navigate('DlScan')}
      />

      <View style={{ height: 14 }} />

      <GlassCard style={styles.hint}>
        <Text style={styles.hintTitle}>Print</Text>
        <Text style={styles.hintBody}>Long-press CHECK to open Print Center.</Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardPress: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
  },
  cardTitle: {
    color: colors.text,
    ...type.h2,
  },
  cardBody: {
    marginTop: 8,
    color: colors.textDim,
    ...type.bodyDim,
    lineHeight: 18,
  },
  hint: {
    borderRadius: 24,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  hintTitle: {
    color: colors.text,
    ...type.label,
  },
  hintBody: {
    marginTop: 8,
    color: colors.textDim,
    ...type.bodyDim,
  },
});
