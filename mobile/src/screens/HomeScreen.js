import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { impactLight } from '../lib/haptics';

function QuickAction({ icon, label, accent, onPress }) {
  return (
    <Pressable
      onPress={() => {
        impactLight();
        onPress();
      }}
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.quickIconWrap, { borderColor: accent }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label, value, color }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, { color: color || colors.text }]}>{value}</Text>
    </View>
  );
}

export function HomeScreen({ navigation }) {
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <ScreenHeader
            title="Supercharg'd"
            subtitle="Sales Weapon"
            right={
              <View style={styles.sportBadge}>
                <View style={[styles.sportDot, settings.sportMode && styles.sportDotOn]} />
                <Text style={[styles.sportText, settings.sportMode && { color: colors.red }]}>
                  {settings.sportMode ? 'SPORT' : 'ECO'}
                </Text>
              </View>
            }
          />

          <View style={{ height: 20 }} />

          {/* Quick Actions Grid */}
          <View style={styles.grid}>
            <QuickAction
              icon="scan-outline"
              label="VIN SCAN"
              accent={colors.gold}
              onPress={() => navigation.navigate('Scan', { screen: 'VinScan' })}
            />
            <QuickAction
              icon="card-outline"
              label="LICENSE"
              accent={colors.red}
              onPress={() => navigation.navigate('Scan', { screen: 'DlScan' })}
            />
            <QuickAction
              icon="language-outline"
              label="TRANSLATE"
              accent="#9333EA"
              onPress={() => navigation.navigate('Scan')}
            />
            <QuickAction
              icon="car-outline"
              label="INVENTORY"
              accent={colors.blue}
              onPress={() => navigation.navigate('Intake')}
            />
          </View>

          <View style={{ height: 20 }} />

          {/* Status Overview */}
          <GlassCard>
            <Text style={styles.sectionTitle}>STATUS</Text>
            <View style={{ height: 12 }} />
            <View style={styles.pillRow}>
              <StatusPill label="MODE" value={settings.sportMode ? 'SPORT' : 'ECO'} color={settings.sportMode ? colors.red : colors.green} />
              <StatusPill label="LANG" value={(settings.defaultTargetLanguage || 'ES').toUpperCase()} color={colors.gold} />
              <StatusPill label="PRINTER" value={settings.printers?.length > 0 ? 'READY' : 'NONE'} color={settings.printers?.length > 0 ? colors.green : colors.textMute} />
            </View>
          </GlassCard>

          <View style={{ height: 16 }} />

          {/* Feature Cards */}
          <GlassCard>
            <View style={styles.featureRow}>
              <Ionicons name="flash" size={18} color={colors.gold} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.featureTitle}>Tower Talk AI</Text>
                <Text style={styles.featureDesc}>Sales objection handler & closer. Tap the red ✶ button.</Text>
              </View>
            </View>
          </GlassCard>

          <View style={{ height: 12 }} />

          <GlassCard>
            <View style={styles.featureRow}>
              <Ionicons name="mic" size={18} color="#9333EA" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.featureTitle}>Voice Translator</Text>
                <Text style={styles.featureDesc}>Enable SPORT mode, then hold the mic to translate in real-time.</Text>
              </View>
            </View>
          </GlassCard>

          <View style={{ height: 12 }} />

          <GlassCard>
            <View style={styles.featureRow}>
              <Ionicons name="print" size={18} color={colors.textDim} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.featureTitle}>Print Center</Text>
                <Text style={styles.featureDesc}>Long-press the ⚠ button to print customer profiles & licenses.</Text>
              </View>
            </View>
          </GlassCard>
        </ScrollView>
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '47%',
    flexGrow: 1,
    height: 88,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    color: colors.textDim,
    ...type.label,
    fontSize: 10,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  sportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMute,
  },
  sportDotOn: {
    backgroundColor: colors.red,
  },
  sportText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 10,
  },
  sectionTitle: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  pillLabel: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pillValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTitle: {
    color: colors.text,
    ...type.h2,
    fontSize: 14,
  },
  featureDesc: {
    marginTop: 4,
    color: colors.textMute,
    ...type.bodyDim,
    fontSize: 11,
  },
});
