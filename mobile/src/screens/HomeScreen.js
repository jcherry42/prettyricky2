import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { SportModeButton } from '../components/SportModeButton';
import { impactLight } from '../lib/haptics';

const ELECTRIC_BLUE = '#00D4FF';

/* ---------- Ambient gauge ring ---------- */
function GaugeRing({ label, value, color, icon }) {
  return (
    <View style={styles.gauge}>
      <View style={[styles.gaugeRing, { borderColor: color }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.gaugeValue}>{value}</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

/* ---------- Ambient light strip ---------- */
function AmbientStrip({ active, color }) {
  const anim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.5, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0.08);
    }
  }, [active, anim]);

  return (
    <Animated.View style={[styles.ambientStrip, { backgroundColor: color, opacity: anim }]} />
  );
}

export function HomeScreen({ navigation }) {
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();
  const sportActive = Boolean(settings.sportMode);
  const ambientColor = sportActive ? 'rgba(255,80,0,0.60)' : 'rgba(0,212,255,0.40)';

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Top spacer for header */}
          <View style={{ height: 52 }} />

          {/* Ambient light strip */}
          <AmbientStrip active color={ambientColor} />

          {/* CENTER CONSOLE: Sport button */}
          <View style={styles.sportRow}>
            <SportModeButton />
          </View>

          {/* Status Gauges */}
          <View style={styles.gaugeRow}>
            <GaugeRing
              label="MODE"
              value={sportActive ? 'SPORT' : 'ECO'}
              color={sportActive ? '#FF4500' : colors.green}
              icon={sportActive ? 'flame' : 'leaf'}
            />
            <GaugeRing
              label="LANG"
              value={(settings.defaultTargetLanguage || 'ES').toUpperCase()}
              color={ELECTRIC_BLUE}
              icon="language"
            />
            <GaugeRing
              label="PRINTER"
              value={settings.printers?.length > 0 ? 'READY' : '\u2014'}
              color={settings.printers?.length > 0 ? colors.green : colors.textMute}
              icon={settings.printers?.length > 0 ? 'print' : 'print-outline'}
            />
          </View>

          {/* Ambient light strip */}
          <AmbientStrip active color={ambientColor} />

          <View style={{ height: 20 }} />

          {/* Feature modules */}
          <View style={styles.moduleGrid}>
            <Pressable
              onPress={() => { impactLight(); navigation.navigate('Intake'); }}
              style={({ pressed }) => [styles.moduleCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
            >
              <LinearGradient
                colors={['rgba(214,178,94,0.12)', 'rgba(214,178,94,0.03)', 'rgba(0,0,0,0.10)']}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="scan-outline" size={24} color={colors.gold} />
              <Text style={styles.moduleLabel}>INTAKE</Text>
              <Text style={styles.moduleSub}>VIN + License</Text>
            </Pressable>

            <Pressable
              onPress={() => { impactLight(); navigation.navigate('Intake'); }}
              style={({ pressed }) => [styles.moduleCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
            >
              <LinearGradient
                colors={['rgba(0,212,255,0.10)', 'rgba(0,212,255,0.02)', 'rgba(0,0,0,0.10)']}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="car-sport-outline" size={24} color={ELECTRIC_BLUE} />
              <Text style={styles.moduleLabel}>INVENTORY</Text>
              <Text style={styles.moduleSub}>Local stock</Text>
            </Pressable>
          </View>

          <View style={{ height: 14 }} />

          {/* Info cards */}
          <GlassCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoDot, { backgroundColor: '#FF2D2D' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Tower Talk</Text>
                <Text style={styles.infoDesc}>AI sales authority. Tap the red button in the control bar.</Text>
              </View>
            </View>
          </GlassCard>

          <View style={{ height: 10 }} />

          <GlassCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoDot, { backgroundColor: '#FF8C00' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Print Center</Text>
                <Text style={styles.infoDesc}>Eject customer profiles + licenses. Orange button or Command Center.</Text>
              </View>
            </View>
          </GlassCard>

          {sportActive && (
            <>
              <View style={{ height: 10 }} />
              <GlassCard style={[styles.infoCard, { borderColor: 'rgba(255,80,0,0.25)' }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="mic" size={16} color="#9333EA" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.infoTitle, { color: '#FF8C00' }]}>SPORT Mode Active</Text>
                    <Text style={styles.infoDesc}>Hold the floating mic to translate. PTT translation is live.</Text>
                  </View>
                </View>
              </GlassCard>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 24,
  },
  sportRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  ambientStrip: {
    width: '100%',
    height: 1,
    borderRadius: 1,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  gauge: {
    alignItems: 'center',
    gap: 6,
  },
  gaugeRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gaugeLabel: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  moduleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  moduleCard: {
    flex: 1,
    height: 100,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,14,18,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  moduleLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  moduleSub: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  infoDesc: {
    marginTop: 3,
    color: colors.textMute,
    fontSize: 11,
    lineHeight: 15,
  },
});
