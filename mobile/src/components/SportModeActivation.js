/**
 * SportModeActivation — cinematic wildfire overlay (Reanimated 4).
 * Same particle physics as SportModeButton, scaled to fill the screen.
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
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

// ─── Screen-wide flame particles ─────────────────────────────────────────────
// More particles, scaled to fill the bottom 55% of the screen.

const makeParticles = () => {
  const cols = 28; // columns across the screen
  const particles = [];

  // Ember bed row
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * W - 8;
    particles.push({ x, y: -10, w: Math.floor(W / cols) + 14, h: 30,
      rise: 6, sway: 3, fm: 220, rm: 520, sk: (i % 3) - 1, dl: (i * 23) % 180, op: 0.92, tier: 0 });
  }
  // Core tongues
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * W - 5;
    const h = 120 + (i % 4) * 35;
    particles.push({ x, y: -5, w: 12 + (i % 3) * 4, h,
      rise: 18 + (i % 5) * 4, sway: 6 + (i % 3) * 2, fm: 155 + (i % 4) * 15, rm: 680 + (i % 5) * 60,
      sk: ((i % 7) - 3) * 2.5, dl: (i * 37) % 280, op: 0.88 + (i % 3) * 0.03, tier: 1 });
  }
  // Tall whisps
  for (let i = 0; i < Math.floor(cols * 0.7); i++) {
    const x = (i / (cols * 0.7)) * W - 4;
    const h = 200 + (i % 5) * 50;
    particles.push({ x, y: 0, w: 5 + (i % 4) * 2, h,
      rise: 28 + (i % 6) * 5, sway: 8 + (i % 4) * 2, fm: 130 + (i % 5) * 12, rm: 820 + (i % 6) * 60,
      sk: ((i % 9) - 4) * 2, dl: (i * 51) % 380, op: 0.68 + (i % 4) * 0.05, tier: 2 });
  }

  return particles;
};

const SCREEN_PARTICLES = makeParticles();

// ─── Flying sparks ────────────────────────────────────────────────────────────
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  x: (i / 22) * W,
  size: 3 + (i % 4) * 2,
  dur: 800 + (i % 5) * 140,
  dl: (i * 43) % 550,
}));

// ─── Particle Component ───────────────────────────────────────────────────────

function ScreenParticle({ cfg, run }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const flickerVal = useSharedValue(1);

  useEffect(() => {
    if (!run) {
      cancelAnimation(riseVal); cancelAnimation(swayVal); cancelAnimation(flickerVal);
      riseVal.value = 0; swayVal.value = 0; flickerVal.value = 1;
      return;
    }

    const eio = Easing.inOut(Easing.sin);
    riseVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(-cfg.rise, { duration: cfg.rm, easing: eio }),
        withTiming(0, { duration: cfg.rm * 1.2, easing: eio })
      ), -1)
    );
    swayVal.value = withDelay(Math.floor(cfg.dl * 0.6),
      withRepeat(withSequence(
        withTiming( cfg.sway, { duration: Math.floor(cfg.rm * 0.7), easing: eio }),
        withTiming(-cfg.sway, { duration: Math.floor(cfg.rm * 0.7), easing: eio })
      ), -1)
    );
    flickerVal.value = withRepeat(withSequence(
      withTiming(1.32, { duration: cfg.fm,                    easing: Easing.inOut(Easing.ease) }),
      withTiming(0.68, { duration: Math.floor(cfg.fm * 0.70), easing: Easing.inOut(Easing.ease) }),
      withTiming(1.12, { duration: Math.floor(cfg.fm * 0.48), easing: Easing.inOut(Easing.ease) }),
      withTiming(0.82, { duration: Math.floor(cfg.fm * 0.55), easing: Easing.inOut(Easing.ease) })
    ), -1);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: riseVal.value },
      { translateX: swayVal.value },
      { scaleX: flickerVal.value },
      { skewX: `${cfg.sk}deg` },
    ],
  }));

  const r = cfg.w / 2;
  // Ember bed is shorter and brighter; whisps are taller/more transparent
  const tipAlpha   = cfg.tier === 0 ? 0.30 : 0;
  const midAlpha   = cfg.op * (cfg.tier === 0 ? 0.80 : 0.55);
  const baseAlpha  = cfg.op * (cfg.tier === 0 ? 0.98 : 0.90);
  const deepAlpha  = cfg.op;

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cfg.x,
      bottom: cfg.y - cfg.h * 0.22, // anchor slightly below screen
      width: cfg.w,
      height: cfg.h,
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: Math.floor(r * 0.5),
      borderBottomRightRadius: Math.floor(r * 0.5),
      overflow: 'hidden',
    }, style]}>
      <LinearGradient
        colors={[
          `rgba(255,255,160,${tipAlpha})`,
          `rgba(255,200,40,${midAlpha * 0.3})`,
          `rgba(255,130,10,${midAlpha})`,
          `rgba(255,45,0,${baseAlpha})`,
          `rgba(160,10,0,${deepAlpha})`,
        ]}
        locations={[0, 0.12, 0.40, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Spark Component ──────────────────────────────────────────────────────────

function Spark({ cfg, run }) {
  const y  = useSharedValue(0);
  const op = useSharedValue(0);
  const sc = useSharedValue(0.4);

  useEffect(() => {
    if (!run) { y.value = 0; op.value = 0; sc.value = 0.4; return; }
    withRepeat(
      withSequence(
        withDelay(cfg.dl % 450,
          withTiming(-(H * 0.65), { duration: cfg.dur * 2.0, easing: Easing.out(Easing.quad) })
        )
      ), -1
    );
    y.value = withDelay(cfg.dl % 450,
      withRepeat(withSequence(
        withTiming(-(H * 0.65), { duration: cfg.dur * 2.0, easing: Easing.out(Easing.quad) }),
        withTiming(0,            { duration: 0 })
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
        withTiming(1.6, { duration: cfg.dur * 0.12 }),
        withTiming(0.2, { duration: cfg.dur * 1.7, easing: Easing.out(Easing.ease) }),
        withTiming(0.4, { duration: 0 })
      ), -1)
    );
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y.value }, { scale: sc.value }],
  }));

  const color = cfg.size > 5 ? '#FFE040' : '#FF8C00';
  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cfg.x,
      bottom: 14,
      width: cfg.size, height: cfg.size,
      borderRadius: cfg.size / 2,
      backgroundColor: color,
      shadowColor: color, shadowOpacity: 0.95, shadowRadius: cfg.size * 3, elevation: 6,
    }, style]} />
  );
}

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
      screenOp.value = withTiming(0, { duration: 300 }, (done) => {
        if (done) {
          // back to JS thread for setState
        }
      });
      setTimeout(() => { setRun(false); onComplete?.(); }, 300);
    }, DURATION);

    return () => {
      clearTimeout(t);
      cancelAnimation(screenOp); cancelAnimation(textScale);
      cancelAnimation(textOp); cancelAnimation(borderOp);
      textScale.value = 0.25; textOp.value = 0; borderOp.value = 0;
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible && !run) return null;

  return (
    <Modal transparent animationType="none" visible={visible || run}>
      <Animated.View style={[styles.overlay, screenStyle]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(50,8,0,0.92)', 'rgba(0,0,0,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Flame particles */}
        {SCREEN_PARTICLES.map((cfg, i) => <ScreenParticle key={i} cfg={cfg} run={run} />)}

        {/* Bottom heat gradient */}
        <LinearGradient
          colors={['rgba(150,20,0,0)', 'rgba(180,30,0,0.70)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomHeat}
        />

        {/* Sparks */}
        {SPARKS.map((s, i) => <Spark key={i} cfg={s} run={run} />)}

        {/* Edge borders */}
        <Animated.View style={[styles.edgeTop, borderStyle]} />
        <Animated.View style={[styles.edgeBottom, borderStyle]} />
        <Animated.View style={[styles.edgeLeft, borderStyle]} />
        <Animated.View style={[styles.edgeRight, borderStyle]} />

        {/* Text */}
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
  bottomHeat: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.45 },
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
