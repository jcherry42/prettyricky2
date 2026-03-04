/**
 * SportModeActivation — cinematic fire ignition overlay.
 *
 * Same flame physics as SportModeButton:
 *  - Gradients run transparent(tip) → yellow → orange → deep-red(base)
 *  - Thin whisp shapes, tight top border-radius, wider base
 *  - Independent rise/sway/flicker animations per tongue
 *
 * Scene composition (back to front):
 *  1. Black bg with ember gradient
 *  2. 30 flame tongues filling bottom 50% of screen
 *  3. 18 flying sparks/embers rising upward
 *  4. Pulsing screen-edge heat border
 *  5. "SPORT MODE ENGAGED" text with glow
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SOUND_PROFILES } from '../lib/soundProfiles';

const { width: W, height: H } = Dimensions.get('window');
const DURATION = 1800; // total overlay visibility ms

// ─── Full-screen flame tongues — fill the bottom half of the screen ───────────
// Same physics: transparent tip, opaque base, pinched-top shape, lean variety.
const SCREEN_TONGUES = [
  // Back layer — taller, slower, mostly behind
  { cx: 0.05, w: 38, h: 320, rise: 22, sway:  8, fm: 280, rm: 1100, lean: -5, d:   0, op: 0.70 },
  { cx: 0.16, w: 50, h: 380, rise: 28, sway: -9, fm: 260, rm: 1200, lean:  4, d:  60, op: 0.75 },
  { cx: 0.28, w: 60, h: 420, rise: 30, sway:  7, fm: 270, rm: 1150, lean: -3, d: 120, op: 0.80 },
  { cx: 0.40, w: 55, h: 440, rise: 32, sway: -8, fm: 255, rm: 1180, lean:  6, d:  40, op: 0.78 },
  { cx: 0.52, w: 65, h: 460, rise: 35, sway:  9, fm: 245, rm: 1250, lean: -4, d:  90, op: 0.82 },
  { cx: 0.64, w: 52, h: 400, rise: 28, sway: -7, fm: 265, rm: 1130, lean:  5, d: 150, op: 0.76 },
  { cx: 0.76, w: 48, h: 370, rise: 25, sway:  8, fm: 275, rm: 1100, lean: -6, d:  30, op: 0.72 },
  { cx: 0.88, w: 42, h: 340, rise: 24, sway: -8, fm: 280, rm: 1080, lean:  4, d:  80, op: 0.70 },
  { cx: 0.96, w: 34, h: 300, rise: 20, sway:  6, fm: 290, rm: 1050, lean: -3, d: 160, op: 0.68 },

  // Mid layer — medium height, denser
  { cx: 0.10, w: 28, h: 260, rise: 18, sway:  7, fm: 220, rm:  920, lean: -8, d:  20, op: 0.88 },
  { cx: 0.22, w: 32, h: 290, rise: 22, sway: -6, fm: 215, rm:  950, lean:  7, d: 100, op: 0.90 },
  { cx: 0.34, w: 36, h: 310, rise: 24, sway:  8, fm: 210, rm:  980, lean: -4, d: 180, op: 0.92 },
  { cx: 0.46, w: 40, h: 340, rise: 26, sway: -7, fm: 205, rm: 1000, lean:  5, d:  50, op: 0.93 },
  { cx: 0.58, w: 36, h: 320, rise: 23, sway:  6, fm: 215, rm:  970, lean: -6, d: 140, op: 0.91 },
  { cx: 0.70, w: 30, h: 280, rise: 20, sway: -8, fm: 225, rm:  930, lean:  8, d:  70, op: 0.89 },
  { cx: 0.82, w: 26, h: 255, rise: 17, sway:  7, fm: 230, rm:  910, lean: -7, d: 200, op: 0.86 },

  // Front whisps — tallest, thinnest, most chaotic
  { cx: 0.08, w: 14, h: 380, rise: 38, sway: 11, fm: 190, rm:  860, lean:-11, d:  35, op: 0.72 },
  { cx: 0.20, w: 18, h: 420, rise: 42, sway:-10, fm: 185, rm:  890, lean:  9, d: 115, op: 0.76 },
  { cx: 0.33, w: 20, h: 450, rise: 44, sway: 12, fm: 180, rm:  920, lean: -8, d: 215, op: 0.78 },
  { cx: 0.44, w: 22, h: 470, rise: 46, sway:-11, fm: 175, rm:  940, lean:  7, d:  55, op: 0.80 },
  { cx: 0.56, w: 20, h: 460, rise: 44, sway: 10, fm: 180, rm:  930, lean:-10, d: 175, op: 0.79 },
  { cx: 0.68, w: 18, h: 430, rise: 41, sway:-12, fm: 188, rm:  900, lean:  9, d:  85, op: 0.75 },
  { cx: 0.80, w: 16, h: 400, rise: 38, sway: 11, fm: 192, rm:  870, lean: -9, d: 245, op: 0.73 },
  { cx: 0.92, w: 14, h: 370, rise: 35, sway:-10, fm: 195, rm:  855, lean:  8, d: 130, op: 0.70 },
];

// ─── Flying sparks / embers ───────────────────────────────────────────────────
const SPARKS = [
  { x: 0.08, size: 4,  dur: 900,  delay:   0 },
  { x: 0.17, size: 6,  dur: 1050, delay:  70 },
  { x: 0.26, size: 3,  dur: 820,  delay: 140 },
  { x: 0.35, size: 5,  dur: 980,  delay:  30 },
  { x: 0.44, size: 7,  dur: 1100, delay: 190 },
  { x: 0.53, size: 4,  dur: 870,  delay:  90 },
  { x: 0.62, size: 6,  dur: 1020, delay: 220 },
  { x: 0.71, size: 3,  dur: 800,  delay:  50 },
  { x: 0.80, size: 5,  dur: 950,  delay: 160 },
  { x: 0.89, size: 4,  dur: 890,  delay: 100 },
  { x: 0.13, size: 8,  dur: 1200, delay: 280 },
  { x: 0.42, size: 5,  dur: 940,  delay: 340 },
  { x: 0.67, size: 4,  dur: 870,  delay: 410 },
  { x: 0.23, size: 6,  dur: 1010, delay: 480 },
  { x: 0.76, size: 3,  dur: 810,  delay: 540 },
  { x: 0.49, size: 9,  dur: 1300, delay: 130 },
  { x: 0.92, size: 5,  dur: 960,  delay: 350 },
  { x: 0.04, size: 4,  dur: 850,  delay: 600 },
];

// ─── Screen-filling flame tongue ─────────────────────────────────────────────

function ScreenTongue({ cfg, run }) {
  const riseAnim    = useRef(new Animated.Value(0)).current;
  const swayAnim    = useRef(new Animated.Value(0)).current;
  const flickerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!run) {
      riseAnim.setValue(0); swayAnim.setValue(0); flickerAnim.setValue(1);
      return;
    }

    const riseLoop = Animated.loop(Animated.sequence([
      Animated.delay(cfg.d),
      Animated.timing(riseAnim, { toValue: 1, duration: cfg.rm,              easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: cfg.rm + cfg.d * 0.4, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));

    const swayLoop = Animated.loop(Animated.sequence([
      Animated.delay(cfg.d * 0.5),
      Animated.timing(swayAnim, { toValue:  1, duration: cfg.rm * 0.65, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swayAnim, { toValue: -1, duration: cfg.rm * 0.65, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));

    const flickerLoop = Animated.loop(Animated.sequence([
      Animated.timing(flickerAnim, { toValue: 1.20, duration: cfg.fm,       easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(flickerAnim, { toValue: 0.80, duration: cfg.fm * 0.8, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(flickerAnim, { toValue: 1.05, duration: cfg.fm * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));

    riseLoop.start(); swayLoop.start(); flickerLoop.start();
    return () => { riseLoop.stop(); swayLoop.stop(); flickerLoop.stop(); };
  }, [run, cfg, riseAnim, swayAnim, flickerAnim]);

  const x = cfg.cx * W - cfg.w / 2;
  const translateY = riseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.rise] });
  const translateX = swayAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-cfg.sway, 0, cfg.sway] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        bottom: -cfg.h * 0.20, // anchor slightly below screen edge
        width: cfg.w,
        height: cfg.h,
        borderTopLeftRadius: cfg.w * 0.5,
        borderTopRightRadius: cfg.w * 0.5,
        borderBottomLeftRadius: cfg.w * 0.30,
        borderBottomRightRadius: cfg.w * 0.30,
        overflow: 'hidden',
        transform: [{ translateY }, { translateX }, { scaleX: flickerAnim }, { rotate: `${cfg.lean}deg` }],
      }}
    >
      <LinearGradient
        colors={[
          `rgba(255,255,180,0)`,
          `rgba(255,220,60,${cfg.op * 0.22})`,
          `rgba(255,140,15,${cfg.op * 0.58})`,
          `rgba(255,60,0,${cfg.op * 0.88})`,
          `rgba(180,20,0,${cfg.op})`,
        ]}
        locations={[0, 0.16, 0.44, 0.74, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Rising spark/ember ───────────────────────────────────────────────────────

function Spark({ cfg, run }) {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!run) { y.setValue(0); op.setValue(0); sc.setValue(0.5); return; }

    Animated.loop(Animated.sequence([
      Animated.delay(cfg.delay % 500),
      Animated.parallel([
        Animated.timing(y,  { toValue: -(H * 0.60 + cfg.size * 10), duration: cfg.dur * 1.8, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(op, { toValue: 1,   duration: cfg.dur * 0.12, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0,   duration: cfg.dur * 1.5,  useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(sc, { toValue: 1.5, duration: cfg.dur * 0.15, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 0.2, duration: cfg.dur * 1.4,  useNativeDriver: true }),
        ]),
      ]),
    ])).start();
    return () => { y.stopAnimation(); op.stopAnimation(); sc.stopAnimation(); };
  }, [run, cfg, y, op, sc]);

  const color = cfg.size > 5 ? '#FFE040' : '#FF8C00';
  return (
    <Animated.View style={{
      position: 'absolute',
      left: cfg.x * W,
      bottom: 12,
      width: cfg.size, height: cfg.size,
      borderRadius: cfg.size / 2,
      backgroundColor: color,
      opacity: op,
      transform: [{ translateY: y }, { scale: sc }],
      shadowColor: color, shadowOpacity: 0.9, shadowRadius: cfg.size * 2.5, elevation: 6,
    }} />
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function SportModeActivation({ visible, profileId = 'merica', onComplete }) {
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;
  const [run, setRun] = useState(false);

  const screenOp  = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.3)).current;
  const textOp    = useRef(new Animated.Value(0)).current;
  const borderOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setRun(true);

    Animated.timing(screenOp, { toValue: 1, duration: 160, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.spring(textScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
        Animated.timing(textOp, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(borderOp, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(borderOp, { toValue: 0.2, duration: 350, useNativeDriver: true }),
    ])).start();

    const timer = setTimeout(() => {
      Animated.timing(screenOp, { toValue: 0, duration: 300, useNativeDriver: true })
        .start(() => { setRun(false); onComplete?.(); });
    }, DURATION);

    return () => {
      clearTimeout(timer);
      screenOp.stopAnimation(); textScale.stopAnimation();
      textOp.stopAnimation(); borderOp.stopAnimation();
      textScale.setValue(0.3); textOp.setValue(0); borderOp.setValue(0);
    };
  }, [visible, onComplete, screenOp, textScale, textOp, borderOp]);

  if (!visible && !run) return null;

  return (
    <Modal transparent animationType="none" visible={visible || run}>
      <Animated.View style={[styles.overlay, { opacity: screenOp }]}>
        {/* Dark ember bg */}
        <LinearGradient
          colors={['rgba(0,0,0,0.94)', 'rgba(60,10,0,0.90)', 'rgba(0,0,0,0.97)']}
          style={StyleSheet.absoluteFill}
        />

        {/* 30 screen-filling flame tongues */}
        {SCREEN_TONGUES.map((cfg, i) => <ScreenTongue key={i} cfg={cfg} run={run} />)}

        {/* Bottom heat gradient — blends base of flames into the bg */}
        <LinearGradient
          colors={['rgba(160,25,0,0.0)', 'rgba(180,35,0,0.65)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomHeat}
        />

        {/* 18 flying sparks */}
        {SPARKS.map((s, i) => <Spark key={i} cfg={s} run={run} />)}

        {/* Edge glow border */}
        <Animated.View style={[styles.edgeTop,    { opacity: borderOp }]} />
        <Animated.View style={[styles.edgeBottom, { opacity: borderOp }]} />
        <Animated.View style={[styles.edgeLeft,   { opacity: borderOp }]} />
        <Animated.View style={[styles.edgeRight,  { opacity: borderOp }]} />

        {/* Centre text */}
        <View style={styles.centre}>
          <Animated.View style={[styles.textWrap, { transform: [{ scale: textScale }], opacity: textOp }]}>
            <Ionicons name="flame" size={60} color={profile.color || '#FF6600'} style={{ marginBottom: 4 }} />
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
  bottomHeat: { position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.42 },
  edgeTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,90,0,0.85)', shadowColor: '#FF5500', shadowOpacity: 0.9, shadowRadius: 16, elevation: 0 },
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,90,0,0.85)' },
  edgeLeft:   { position: 'absolute', top: 0, bottom: 0, left: 0, width: 5, backgroundColor: 'rgba(255,90,0,0.60)' },
  edgeRight:  { position: 'absolute', top: 0, bottom: 0, right: 0, width: 5, backgroundColor: 'rgba(255,90,0,0.60)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: H * 0.22 },
  textWrap: { alignItems: 'center' },
  title: {
    fontSize: 44, fontWeight: '900', letterSpacing: 5,
    textShadowColor: 'rgba(255,90,0,0.95)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 28,
  },
  sub: {
    fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 10, marginTop: -2,
    textShadowColor: 'rgba(255,200,80,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  profileLbl: {
    fontSize: 13, fontWeight: '700', letterSpacing: 3, marginTop: 14,
    textShadowColor: 'rgba(255,100,0,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
});
