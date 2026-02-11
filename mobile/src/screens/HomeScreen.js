import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { Screen } from '../components/Screen';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { SportModeButton } from '../components/SportModeButton';

/* ---------- Ambient light strip ---------- */
function AmbientStrip({ active, color }) {
  const anim = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.45, duration: 2200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.12, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0.06);
    }
  }, [active, anim]);

  return (
    <Animated.View style={[styles.ambientStrip, { backgroundColor: color, opacity: anim }]} />
  );
}

export function HomeScreen() {
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();
  const sportActive = Boolean(settings.sportMode);
  const ambientColor = sportActive ? 'rgba(255,80,0,0.60)' : 'rgba(0,212,255,0.40)';

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Header clearance */}
          <View style={{ height: 56 }} />

          <AmbientStrip active color={ambientColor} />

          {/* CENTER CONSOLE */}
          <View style={styles.sportRow}>
            <SportModeButton />
          </View>

          <AmbientStrip active color={ambientColor} />

          <View style={{ height: 120 }} />
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
    paddingVertical: 28,
  },
  ambientStrip: {
    width: '100%',
    height: 1,
    borderRadius: 1,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 18,
  },
  gauge: {
    alignItems: 'center',
    gap: 8,
  },
  gaugeRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
});
