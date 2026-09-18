/**
 * SportModeActivation — cinematic full-screen wildfire overlay.
 * Uses the same glow-ember particle system as SportModeButton,
 * scaled to fill the entire screen with a wall of fire.
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SOUND_PROFILES } from '../lib/soundProfiles';

const { width: W, height: H } = Dimensions.get('window');
const DURATION = 1900;

// ─── Flame GIF (transparent background) ──────────────────────────────────────

const FLAME_GIF = require('../../assets/flames/flame.gif');

// ─── Overlay ──────────────────────────────────────────────────────────────────

export function SportModeActivation({ visible, profileId = 'merica', onComplete }: { visible: boolean; profileId?: string; onComplete: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (SOUND_PROFILES as Record<string, any>)[profileId] || SOUND_PROFILES.merica;
  const [run, setRun] = useState(false);

  const screenOp  = useSharedValue(0);
  const textScale = useSharedValue(0.25);
  const textOp    = useSharedValue(0);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOp.value }));
  const textStyle   = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ scale: textScale.value }],
  }));


  useEffect(() => {
    if (!visible) return;
    setRun(true);

    screenOp.value = withTiming(1, { duration: 160 });
    textScale.value = withDelay(220, withSpring(1, { damping: 12, stiffness: 200 }));
    textOp.value    = withDelay(220, withTiming(1, { duration: 220 }));

    const t = setTimeout(() => {
      screenOp.value = withTiming(0, { duration: 300 });
      setTimeout(() => { setRun(false); onComplete?.(); }, 300);
    }, DURATION);

    return () => {
      clearTimeout(t);
      cancelAnimation(screenOp);
      cancelAnimation(textScale);
      cancelAnimation(textOp);
      textScale.value = 0.25;
      textOp.value = 0;
    };
  }, [visible]);

  if (!visible && !run) return null;

  return (
    <Modal transparent animationType="none" visible={visible || run}>
      <Animated.View style={[styles.overlay, screenStyle]}>
        <View style={styles.backdrop} />
        <Image source={FLAME_GIF} style={styles.flameWall} />

        {/* Center text */}
        <View style={styles.centre} pointerEvents="none">
          <Animated.View style={[styles.textWrap, textStyle]}>
            <Ionicons name="flame" size={64} color={profile.color || '#FF6600'} style={{ marginBottom: 4 }} />
            <Text style={[styles.title, { color: profile.color || '#FF8800' }]}>SPORT MODE</Text>
            <Text style={styles.sub}>ENGAGED</Text>
            {profile.label ? (
              <Text style={[styles.profileLbl, { color: profile.color || '#FF6600' }]}>
                {profile.icon}  {profile.label.toUpperCase()}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.96)' },
  flameWall: {
    position: 'absolute',
    bottom: -H * 0.05 - 13,
    width: W,
    height: H * 0.9,
    resizeMode: 'contain',
    alignSelf: 'center',
    opacity: 0.95,
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: H * 0.25 },
  textWrap: { alignItems: 'center' },
  title: {
    fontSize: 46, fontWeight: '900', letterSpacing: 5,
    textShadowColor: 'rgba(255,90,0,0.95)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30,
  },
  sub: {
    fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 10, marginTop: -2,
    textShadowColor: 'rgba(255,220,80,0.80)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  profileLbl: {
    fontSize: 14, fontWeight: '700', letterSpacing: 3, marginTop: 14,
    textShadowColor: 'rgba(255,100,0,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
});
