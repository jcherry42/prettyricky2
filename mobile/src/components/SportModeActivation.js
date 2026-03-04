/**
 * SportModeActivation — cinematic full-screen wildfire overlay.
 * Uses the same glow-ember particle system as SportModeButton,
 * scaled to fill the entire screen with a wall of fire.
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SOUND_PROFILES } from '../lib/soundProfiles';

const { width: W, height: H } = Dimensions.get('window');
const DURATION = 1900;

// ─── Procedural screen-wide ember generation ──────────────────────────────────
// Deterministic — no Math.random() — same particles every render.

const makeScreenEmbers = () => {
  const particles = [];
  const cols = 22;

  // Tier 0: Base ember bed (bright white-hot row along bottom)
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * W + ((i * 7 + 3) % 11) - 5;
    particles.push({
      x, y: -8 + (i % 3) * 4,
      s: 6 + (i % 3) * 2, g: 22,
      c: ['#FFFFFF', '#FFF8E1', '#FFFDE7'][i % 3],
      gc: ['#FFC107', '#FFD54F', '#FFCA28'][i % 3],
      rise: 6, sway: 3,
      sp: 480 + (i % 4) * 18,
      dl: (i * 23) % 180,
      op: 0.95,
      tier: 0,
    });
  }

  // Tier 1: Core flames (yellow → orange, rising)
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * W + ((i * 11 + 5) % 13) - 6;
    particles.push({
      x, y: 5 + (i % 4) * 5,
      s: 5 + (i % 3), g: 18,
      c: ['#FFD54F', '#FF9800', '#FF6D00', '#FFCA28'][i % 4],
      gc: ['#FF3D00', '#DD2C00', '#FF5722', '#FF6D00'][i % 4],
      rise: 22 + (i % 5) * 5,
      sway: 6 + (i % 3) * 2,
      sp: 700 + (i % 5) * 35,
      dl: (i * 31) % 280,
      op: 0.88,
      tier: 1,
    });
  }

  // Tier 2: Mid tongues (orange → red)
  for (let i = 0; i < Math.floor(cols * 0.75); i++) {
    const x = (i / (cols * 0.75)) * W + ((i * 13 + 7) % 17) - 8;
    particles.push({
      x, y: 15 + (i % 4) * 8,
      s: 4 + (i % 2), g: 14,
      c: ['#FF6D00', '#FF3D00', '#DD2C00', '#F4511E'][i % 4],
      gc: ['#B71C1C', '#D32F2F', '#C62828', '#BF360C'][i % 4],
      rise: 32 + (i % 5) * 7,
      sway: 8 + (i % 4) * 2,
      sp: 860 + (i % 5) * 45,
      dl: (i * 43) % 360,
      op: 0.78,
      tier: 2,
    });
  }

  // Tier 3: Upper wisps (red → crimson, tall)
  for (let i = 0; i < Math.floor(cols * 0.5); i++) {
    const x = (i / (cols * 0.5)) * W * 0.85 + W * 0.075 + ((i * 17 + 3) % 11) - 5;
    particles.push({
      x, y: 30 + (i % 3) * 12,
      s: 3 + (i % 2), g: 10,
      c: ['#D32F2F', '#B71C1C', '#880E4F', '#FF3D00'][i % 4],
      gc: ['#4A0000', '#880E4F', '#311B92', '#B71C1C'][i % 4],
      rise: 42 + (i % 4) * 8,
      sway: 10 + (i % 3) * 3,
      sp: 1000 + (i % 4) * 55,
      dl: (i * 57) % 450,
      op: 0.58,
      tier: 3,
    });
  }

  return particles;
};

const SCREEN_EMBERS = makeScreenEmbers();

// ─── Flying sparks ────────────────────────────────────────────────────────────
const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  x: (i / 20) * W + ((i * 13 + 7) % 19) - 9,
  size: 2 + (i % 3),
  color: ['#FFD54F', '#FF9800', '#FFFFFF', '#FFC107'][i % 4],
  glowColor: ['#FF6D00', '#FF3D00', '#FFD54F', '#FF9800'][i % 4],
  dur: 850 + (i % 5) * 130,
  dl: (i * 37) % 500,
}));

// ─── Screen Ember ─────────────────────────────────────────────────────────────

const ScreenEmber = React.memo(function ScreenEmber({ cfg, run }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const flickerSc  = useSharedValue(1);

  useEffect(() => {
    if (!run) {
      cancelAnimation(riseVal);
      cancelAnimation(swayVal);
      cancelAnimation(flickerSc);
      riseVal.value   = 0;
      swayVal.value   = 0;
      flickerSc.value = 1;
      return;
    }

    const eio = Easing.inOut(Easing.sin);

    riseVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(-cfg.rise, { duration: cfg.sp, easing: eio }),
        withTiming(0, { duration: cfg.sp * 1.15, easing: eio })
      ), -1)
    );

    swayVal.value = withDelay(Math.floor(cfg.dl * 0.6),
      withRepeat(withSequence(
        withTiming( cfg.sway, { duration: Math.floor(cfg.sp * 0.65), easing: eio }),
        withTiming(-cfg.sway, { duration: Math.floor(cfg.sp * 0.65), easing: eio })
      ), -1)
    );

    const fm = Math.max(80, Math.floor(cfg.sp * 0.16));
    flickerSc.value = withRepeat(withSequence(
      withTiming(1.35, { duration: fm,                    easing: Easing.inOut(Easing.ease) }),
      withTiming(0.60, { duration: Math.floor(fm * 0.70), easing: Easing.inOut(Easing.ease) }),
      withTiming(1.18, { duration: Math.floor(fm * 0.48), easing: Easing.inOut(Easing.ease) }),
      withTiming(0.78, { duration: Math.floor(fm * 0.55), easing: Easing.inOut(Easing.ease) })
    ), -1);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: riseVal.value },
      { translateX: swayVal.value },
      { scale: flickerSc.value },
    ],
  }));

  const half = cfg.s / 2;

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cfg.x - half,
      bottom: cfg.y - cfg.s * 0.2,
      width: cfg.s,
      height: cfg.s * 1.4,
      borderRadius: half,
      backgroundColor: cfg.c,
      opacity: cfg.op,
      shadowColor: cfg.gc,
      shadowOpacity: 0.95,
      shadowRadius: cfg.g,
      shadowOffset: { width: 0, height: -1 },
      elevation: Platform.OS === 'android' ? Math.ceil(cfg.g * 0.4) : 0,
    }, style]} />
  );
});

// ─── Flying Spark ─────────────────────────────────────────────────────────────

const ScreenSpark = React.memo(function ScreenSpark({ cfg, run }) {
  const y  = useSharedValue(0);
  const op = useSharedValue(0);
  const sc = useSharedValue(0.4);

  useEffect(() => {
    if (!run) {
      cancelAnimation(y);
      cancelAnimation(op);
      cancelAnimation(sc);
      y.value  = 0;
      op.value = 0;
      sc.value = 0.4;
      return;
    }

    y.value = withDelay(cfg.dl % 450,
      withRepeat(withSequence(
        withTiming(-(H * 0.7), { duration: cfg.dur * 2.0, easing: Easing.out(Easing.quad) }),
        withTiming(0,           { duration: 0 })
      ), -1)
    );
    op.value = withDelay(cfg.dl % 450,
      withRepeat(withSequence(
        withTiming(1,   { duration: cfg.dur * 0.1 }),
        withTiming(0,   { duration: cfg.dur * 1.8, easing: Easing.out(Easing.ease) }),
        withTiming(0,   { duration: 0 })
      ), -1)
    );
    sc.value = withDelay(cfg.dl % 450,
      withRepeat(withSequence(
        withTiming(1.8, { duration: cfg.dur * 0.12 }),
        withTiming(0.2, { duration: cfg.dur * 1.7, easing: Easing.out(Easing.ease) }),
        withTiming(0.4, { duration: 0 })
      ), -1)
    );
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y.value }, { scale: sc.value }],
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cfg.x,
      bottom: 20,
      width: cfg.size,
      height: cfg.size,
      borderRadius: cfg.size / 2,
      backgroundColor: cfg.color,
      shadowColor: cfg.glowColor,
      shadowOpacity: 0.95,
      shadowRadius: cfg.size * 4,
      shadowOffset: { width: 0, height: 0 },
      elevation: Platform.OS === 'android' ? 4 : 0,
    }, style]} />
  );
});

// ─── Overlay ──────────────────────────────────────────────────────────────────

export function SportModeActivation({ visible, profileId = 'merica', onComplete }) {
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;
  const [run, setRun] = useState(false);

  const screenOp  = useSharedValue(0);
  const textScale = useSharedValue(0.25);
  const textOp    = useSharedValue(0);
  const borderOp  = useSharedValue(0);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOp.value }));
  const textStyle   = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ scale: textScale.value }],
  }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: borderOp.value }));

  useEffect(() => {
    if (!visible) return;
    setRun(true);

    screenOp.value = withTiming(1, { duration: 160 });
    textScale.value = withDelay(260, withSpring(1, { damping: 12, stiffness: 200 }));
    textOp.value    = withDelay(260, withTiming(1, { duration: 220 }));
    borderOp.value  = withRepeat(withSequence(
      withTiming(1,    { duration: 320 }),
      withTiming(0.15, { duration: 320 })
    ), -1);

    const t = setTimeout(() => {
      screenOp.value = withTiming(0, { duration: 300 });
      setTimeout(() => { setRun(false); onComplete?.(); }, 300);
    }, DURATION);

    return () => {
      clearTimeout(t);
      cancelAnimation(screenOp);
      cancelAnimation(textScale);
      cancelAnimation(textOp);
      cancelAnimation(borderOp);
      textScale.value = 0.25;
      textOp.value = 0;
      borderOp.value = 0;
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && !run) return null;

  return (
    <Modal transparent animationType="none" visible={visible || run}>
      <Animated.View style={[styles.overlay, screenStyle]}>
        {/* Dark backdrop with warm tint */}
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(50,8,0,0.92)', 'rgba(0,0,0,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Bottom heat gradient — intense warm glow from base */}
        <LinearGradient
          colors={[
            'rgba(150,20,0,0)',
            'rgba(200,50,0,0.30)',
            'rgba(255,80,0,0.50)',
            'rgba(255,120,20,0.65)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomHeat}
        />

        {/* Glow ember particles — the fire */}
        {SCREEN_EMBERS.map((cfg, i) => <ScreenEmber key={i} cfg={cfg} run={run} />)}

        {/* Flying sparks */}
        {SPARKS.map((s, i) => <ScreenSpark key={`sp${i}`} cfg={s} run={run} />)}

        {/* Edge glow borders */}
        <Animated.View style={[styles.edgeTop, borderStyle]} />
        <Animated.View style={[styles.edgeBottom, borderStyle]} />
        <Animated.View style={[styles.edgeLeft, borderStyle]} />
        <Animated.View style={[styles.edgeRight, borderStyle]} />

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
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bottomHeat: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.55 },
  edgeTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,80,0,0.90)', shadowColor: '#FF5500', shadowOpacity: 0.9, shadowRadius: 18 },
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,80,0,0.90)' },
  edgeLeft:   { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, backgroundColor: 'rgba(255,80,0,0.65)' },
  edgeRight:  { position: 'absolute', top: 0, bottom: 0, right: 0, width: 4, backgroundColor: 'rgba(255,80,0,0.65)' },
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
