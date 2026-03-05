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

// ─── Procedural flame wall generation (deterministic) ─────────────────────────
// No Math.random() — same flames every render.

const makeFlameWall = () => {
  const flames = [];
  const cols = 16;

  // Primary tongues (bright core)
  for (let i = 0; i < cols; i++) {
    const layer = i % 3;
    const x = (i / cols) * W + ((i * 11 + 5) % 13) - 10;
    const w = 24 + (i % 4) * 6;
    const h = H * 0.25 + (i % 5) * 14;
    flames.push({
      x,
      y: -10 + layer * 3,
      w,
      h,
      rise: 18 + layer * 6,
      sway: 6 + (i % 3) * 3,
      sp: 1100 + (i % 5) * 120,
      dl: (i * 73) % 500,
      op: 0.85 - layer * 0.12,
      tilt: i % 2 === 0 ? -4 : 4,
      stretch: 1.12 + layer * 0.06,
      fg: layer === 2,
    });
  }

  // Back row (larger, dimmer glow for depth)
  for (let i = 0; i < cols - 3; i++) {
    const x = (i / (cols - 3)) * W + ((i * 9 + 3) % 17) - 18;
    flames.push({
      x,
      y: -22,
      w: 34 + (i % 4) * 8,
      h: H * 0.30 + (i % 5) * 16,
      rise: 12 + (i % 4) * 4,
      sway: 4 + (i % 2) * 2,
      sp: 1400 + (i % 4) * 150,
      dl: (i * 91) % 650,
      op: 0.42,
      tilt: i % 2 === 0 ? -2 : 2,
      stretch: 1.08,
      fg: false,
    });
  }

  return flames;
};

const SCREEN_FLAMES = makeFlameWall();

// ─── Flying sparks ────────────────────────────────────────────────────────────
const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  x: (i / 20) * W + ((i * 13 + 7) % 19) - 9,
  size: 2 + (i % 3),
  color: ['#FFD54F', '#FF9800', '#FFFFFF', '#FFC107'][i % 4],
  glowColor: ['#FF6D00', '#FF3D00', '#FFD54F', '#FF9800'][i % 4],
  dur: 850 + (i % 5) * 130,
  dl: (i * 37) % 500,
}));

// ─── Screen Flame Tongue ─────────────────────────────────────────────────────

const ScreenFlame = React.memo(function ScreenFlame({ cfg, run }) {
  const riseVal    = useSharedValue(0);
  const swayVal    = useSharedValue(0);
  const stretchVal = useSharedValue(1);
  const opVal      = useSharedValue(0);

  useEffect(() => {
    if (!run) {
      cancelAnimation(riseVal);
      cancelAnimation(swayVal);
      cancelAnimation(stretchVal);
      cancelAnimation(opVal);
      riseVal.value = 0;
      swayVal.value = 0;
      stretchVal.value = 1;
      opVal.value = 0;
      return;
    }

    opVal.value = withTiming(1, { duration: 200 });
    const eio = Easing.inOut(Easing.sin);

    riseVal.value = withDelay(cfg.dl,
      withRepeat(withSequence(
        withTiming(-cfg.rise, { duration: cfg.sp, easing: eio }),
        withTiming(0,         { duration: Math.floor(cfg.sp * 1.12), easing: eio })
      ), -1)
    );

    swayVal.value = withDelay(Math.floor(cfg.dl * 0.6),
      withRepeat(withSequence(
        withTiming( cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio }),
        withTiming(-cfg.sway, { duration: Math.floor(cfg.sp * 0.6), easing: eio })
      ), -1)
    );

    stretchVal.value = withDelay(Math.floor(cfg.dl * 0.45),
      withRepeat(withSequence(
        withTiming(cfg.stretch, { duration: Math.floor(cfg.sp * 0.45), easing: Easing.inOut(Easing.ease) }),
        withTiming(1,           { duration: Math.floor(cfg.sp * 0.45), easing: Easing.inOut(Easing.ease) })
      ), -1)
    );
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    opacity: opVal.value * cfg.op,
    transform: [
      { translateY: riseVal.value },
      { translateX: swayVal.value },
      { scaleY: stretchVal.value },
      { rotateZ: `${cfg.tilt}deg` },
    ],
  }));

  const topRadius = cfg.w * 0.6;
  const bottomRadius = cfg.w * 0.28;

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: cfg.x,
      bottom: cfg.y,
      width: cfg.w,
      height: cfg.h,
      borderTopLeftRadius: topRadius,
      borderTopRightRadius: topRadius,
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
      overflow: 'hidden',
      shadowColor: '#FF6D00',
      shadowOpacity: 0.9,
      shadowRadius: cfg.w * 1.4,
      shadowOffset: { width: 0, height: -2 },
      elevation: Platform.OS === 'android' ? Math.ceil(cfg.w * 0.6) : 0,
      zIndex: cfg.fg ? 12 : 2,
    }, style]}>
      <LinearGradient
        colors={['rgba(255,255,230,0.98)', '#FFD36A', '#FF8A00', '#FF3D00']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(255,214,120,0.85)', 'rgba(255,120,0,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{
          position: 'absolute',
          bottom: 0,
          alignSelf: 'center',
          width: cfg.w * 0.45,
          height: cfg.h * 0.6,
          borderRadius: cfg.w * 0.4,
        }}
      />
    </Animated.View>
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
            'rgba(0,0,0,0)',
            'rgba(80,20,0,0.35)',
            'rgba(255,90,10,0.70)',
            'rgba(255,160,50,0.85)',
          ]}
          locations={[0, 0.4, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomHeat}
        />

        {/* Flame tongues — layered wildfire wall */}
        {SCREEN_FLAMES.map((cfg, i) => <ScreenFlame key={`fl${i}`} cfg={cfg} run={run} />)}

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
