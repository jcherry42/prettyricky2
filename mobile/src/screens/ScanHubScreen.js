import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { impactLight } from '../lib/haptics';

function ScanCard({ icon, title, description, accent, onPress }) {
  return (
    <Pressable
      onPress={() => {
        impactLight();
        onPress();
      }}
      style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
    >
      <GlassCard style={[styles.card, { borderColor: accent }]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconWrap, { borderColor: accent }]}>
            <Ionicons name={icon} size={24} color={accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDesc}>{description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function ScanHubScreen({ navigation }) {
  const { triggerFlash } = useTaillightFlash();

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScreenHeader title="Scan" subtitle="VIN + Driver's License" />

        <View style={{ height: 20 }} />

        <ScanCard
          icon="barcode-outline"
          title="VIN Scanner"
          description="Barcode scan or manual entry. Decode & save to local inventory."
          accent={colors.gold}
          onPress={() => navigation.navigate('VinScan')}
        />

        <View style={{ height: 14 }} />

        <ScanCard
          icon="card-outline"
          title="Driver's License"
          description="OCR front-image scan with AI Vision. Manual entry fallback."
          accent={colors.red}
          onPress={() => navigation.navigate('DlScan')}
        />

        <View style={{ height: 14 }} />

        <GlassCard>
          <View style={styles.tipRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMute} />
            <Text style={styles.tipText}>Scanned data is stored locally on-device. Offline-first by design.</Text>
          </View>
        </GlassCard>
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPress: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text,
    ...type.h2,
  },
  cardDesc: {
    marginTop: 4,
    color: colors.textMute,
    ...type.bodyDim,
    fontSize: 11,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    flex: 1,
    color: colors.textMute,
    ...type.bodyDim,
    fontSize: 11,
  },
});
