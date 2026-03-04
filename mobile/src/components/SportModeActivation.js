/**
 * Sport Mode Activation Overlay — dramatic fire ignition screen.
 *
 * Produces:
 *  - Full-screen ember gradient background
 *  - 20+ individual spark / ember particles flying upward (translated + faded)
 *  - 5 large flame tongues rising from the bottom edge
 *  - A pulsing "SPORT MODE ENGAGED" text with a brief appear/disappear cycle
 *  - Screen edge heat-distortion vignette (red/orange border glow)
 *
 * All animation via React Native's Animated API — no extra libraries needed.
 */

import React, { useEffect, useRef, useCallback } from 'react';
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
const OVERLAY_DURATION = 1600; // auto-dismiss after this many ms

// ─── Particle / Spark config ──────────────────────────────────────────────────
// Creates randomised-feeling sparks without Math.random() at render time
// (pre-computed seeds for determinism between React renders).
const SPARKS = [
  { x: 0.10, size: 3,  dur: 780,  delay: 0   },
  { x: 0.18, size: 5,  dur: 900,  delay: 60  },
  { x: 0.25, size: 4,  dur: 840,  delay: 120 },
  { x: 0.33, size: 3,  dur: 760,  delay: 40  },
  { x: 0.40, size: 6,  dur: 1000, delay: 200 },
  { x: 0.48, size: 4,  dur: 860,  delay: 90  },
  { x: 0.55, size: 5,  dur: 920,  delay: 30  },
  { x: 0.62, size: 3,  dur: 800,  delay: 150 },
  { x: 0.70, size: 7,  dur: 1100, delay: 70  },
  { x: 0.78, size: 4,  dur: 870,  delay: 180 },
  { x: 0.85, size: 5,  dur: 950,  delay: 110 },
  { x: 0.92, size: 3,  dur: 780,  delay: 50  },
  { x: 0.07, size: 6,  dur: 1050, delay: 240 },
  { x: 0.44, size: 8,  dur: 1200, delay: 160 },
  { x: 0.68, size: 4,  dur: 830,  delay: 280 },
  { x: 0.15, size: 5,  dur: 890,  delay: 320 },
  { x: 0.82, size: 3,  dur: 720,  delay: 380 },
  { x: 0.36, size: 6,  dur: 980,  delay: 440 },
  { x: 0.56, size: 4,  dur: 860,  delay: 500 },
  { x: 0.72, size: 5,  dur: 940,  delay: 200 },
];

// Large flame tongues at the bottom of the screen
const BIG_FLAMES = [
  { cx: 0.12, w: 55, h: 180, delay: 0   },
  { cx: 0.30, w: 70, h: 230, delay: 50  },
  { cx: 0.50, w: 85, h: 280, delay: 20  },
  { cx: 0.70, w: 65, h: 215, delay: 70  },
  { cx: 0.88, w: 50, h: 160, delay: 40  },
];

// ─── Spark Component ──────────────────────────────────────────────────────────

function Spark({ cfg, run }) {
  const y   = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;
  const sc  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!run) { y.setValue(0); op.setValue(0); sc.setValue(0.4); return; }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay % 400),
        Animated.parallel([
          Animated.timing(y,  { toValue: -H * 0.55, duration: cfg.dur * 1.5, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 1,   duration: cfg.dur * 0.15, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,   duration: cfg.dur * 1.3,  useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(sc, { toValue: 1.4, duration: cfg.dur * 0.2, useNativeDriver: true }),
            Animated.timing(sc, { toValue: 0.3, duration: cfg.dur * 1.2, useNativeDriver: true }),
          ]),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [run, cfg, y, op, sc]);

  const sparkColor = cfg.size > 5 ? '#FFDD44' : '#FF8C00';

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          left: cfg.x * W - cfg.size / 2,
          bottom: 10,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
          backgroundColor: sparkColor,
          opacity: op,
          transform: [{ translateY: y }, { scale: sc }],
          shadowColor: sparkColor,
          shadowOpacity: 0.9,
          shadowRadius: cfg.size * 2,
          elevation: 4,
        },
      ]}
    />
  );
}

// ─── Big Flame Tongue at screen bottom ───────────────────────────────────────

function BigFlame({ cfg, run }) {
  const y  = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.6)).current;
  const sx = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!run) { y.setValue(0); sc.setValue(0.6); sx.setValue(0.8); return; }

    Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.parallel([
          Animated.loop(Animated.sequence([
            Animated.timing(y,  { toValue: -14, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y,  { toValue: 0,   duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])),
          Animated.loop(Animated.sequence([
            Animated.timing(sx, { toValue: 1.15, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(sx, { toValue: 0.85, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])),
          Animated.loop(Animated.sequence([
            Animated.timing(sc, { toValue: 1.08, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(sc, { toValue: 0.92, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])),
        ]),
      ])
    ).start();
    return () => { y.stopAnimation(); sc.stopAnimation(); sx.stopAnimation(); };
  }, [run, cfg, y, sc, sx]);

  const x = cfg.cx * W - cfg.w / 2;

  return (
    <Animated.View
      style={[
        styles.bigFlameWrap,
        {
          left: x,
          bottom: -cfg.h * 0.28, // anchor below screen edge
          width: cfg.w,
          height: cfg.h,
          transform: [{ translateY: y }, { scaleX: sx }, { scale: sc }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFF176', '#FFAB40', '#FF6600', '#CC2200', 'rgba(80,0,0,0)']}
        locations={[0, 0.05, 0.22, 0.52, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          {
            borderTopLeftRadius: cfg.w * 0.5,
            borderTopRightRadius: cfg.w * 0.5,
            borderBottomLeftRadius: cfg.w * 0.44,
            borderBottomRightRadius: cfg.w * 0.44,
          },
        ]}
      />
    </Animated.View>
  );
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────

export function SportModeActivation({ visible, profileId = 'merica', onComplete }) {
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;

  // Master animation state — controls all children
  const [run, setRun] = React.useState(false);

  const screenOpacity = useRef(new Animated.Value(0)).current;
  const textScale     = useRef(new Animated.Value(0.4)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const borderGlow    = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
      setRun(false);
      onComplete?.();
    });
  }, [screenOpacity, onComplete]);

  useEffect(() => {
    if (!visible) return;

    setRun(true);

    // 1. Fade-in screen
    Animated.timing(screenOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    // 2. Text burst-in
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(textScale, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();

    // 3. Border glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(borderGlow, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(borderGlow, { toValue: 0, duration: 400, useNativeDriver: false }),
      ])
    ).start();

    // 4. Auto-dismiss after OVERLAY_DURATION
    const timer = setTimeout(dismiss, OVERLAY_DURATION);
    return () => {
      clearTimeout(timer);
      screenOpacity.stopAnimation();
      textScale.stopAnimation();
      textOpacity.stopAnimation();
      borderGlow.stopAnimation();
      // Reset for next show
      textScale.setValue(0.4);
      textOpacity.setValue(0);
      borderGlow.setValue(0);
    };
  }, [visible, dismiss, screenOpacity, textScale, textOpacity, borderGlow]);

  const borderColor = borderGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,80,0,0.35)', 'rgba(255,200,0,0.85)'],
  });

  if (!visible && !run) return null;

  return (
    <Modal transparent animationType="none" visible={visible || run}>
      <Animated.View style={[styles.overlay, { opacity: screenOpacity }]}>
        {/* Dark ember background */}
        <LinearGradient
          colors={['rgba(0,0,0,0.92)', 'rgba(80,15,0,0.88)', 'rgba(0,0,0,0.95)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Screen edge heat glow */}
        <Animated.View style={[styles.edgeBorderTop,    { borderColor }]} />
        <Animated.View style={[styles.edgeBorderLeft,   { borderColor }]} />
        <Animated.View style={[styles.edgeBorderRight,  { borderColor }]} />
        <Animated.View style={[styles.edgeBorderBottom, { borderColor }]} />

        {/* Rising sparks */}
        {SPARKS.map((s, i) => <Spark key={i} cfg={s} run={run} />)}

        {/* Large flames at bottom */}
        {BIG_FLAMES.map((f, i) => <BigFlame key={i} cfg={f} run={run} />)}

        {/* Bottom gradient — blends flames into screen */}
        <LinearGradient
          colors={['rgba(180,30,0,0.0)', 'rgba(180,30,0,0.55)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomHeat}
        />

        {/* Centre content */}
        <View style={styles.centre}>
          <Animated.View style={[styles.textWrap, { transform: [{ scale: textScale }], opacity: textOpacity }]}>
            <Ionicons name="flame" size={56} color={profile.color || '#FF6600'} style={{ marginBottom: 6 }} />
            <Text style={[styles.modeTitle, { color: profile.color || '#FF8800' }]}>
              SPORT MODE
            </Text>
            <Text style={styles.modeSubtitle}>ENGAGED</Text>
            {profile.label && (
              <Text style={[styles.profileLabel, { color: profile.color || '#FF6600' }]}>
                {profile.icon}  {profile.label.toUpperCase()}
              </Text>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spark: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
  },
  bigFlameWrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
  bottomHeat: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: H * 0.35,
  },
  // Edge border glow — 4 thin Animated.Views forming an inner frame
  edgeBorderTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 4,
    borderTopWidth: 4,
    borderColor: 'rgba(255,80,0,0.5)',
    shadowColor: '#FF6600',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 0,
  },
  edgeBorderBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 4,
    borderBottomWidth: 4,
    borderColor: 'rgba(255,80,0,0.5)',
    shadowColor: '#FF6600',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  edgeBorderLeft: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: 4,
    borderLeftWidth: 4,
    borderColor: 'rgba(255,80,0,0.5)',
  },
  edgeBorderRight: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: 4,
    borderRightWidth: 4,
    borderColor: 'rgba(255,80,0,0.5)',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: H * 0.18, // keep text above the rising flames
  },
  textWrap: { alignItems: 'center' },
  modeTitle: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(255,100,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  modeSubtitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 10,
    marginTop: -4,
    textShadowColor: 'rgba(255,200,100,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 14,
    textShadowColor: 'rgba(255,100,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
