import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { useAppSettings } from '../context/AppSettingsContext';
import { impactHeavy, notificationSuccess, impactMedium } from '../lib/haptics';

/* ---------- Animated flame element ---------- */
function Flame({ style, delay = 0, active }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 180 + delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 200 + delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0);
    }
  }, [active, anim, delay]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  if (!active) return null;

  return (
    <Animated.View
      style={[{
        position: 'absolute',
        borderRadius: 99,
        opacity,
        transform: [{ scale }],
      }, style]}
    />
  );
}

function flagFor(lang) {
  if (lang === 'es') return '\ud83c\uddf2\ud83c\uddfd';
  if (lang === 'fr') return '\ud83c\uddeb\ud83c\uddf7';
  if (lang === 'ko') return '\ud83c\uddf0\ud83c\uddf7';
  return '\ud83c\udff3\ufe0f';
}

export function SportModeButton() {
  const { settings, toggleSportMode } = useAppSettings();
  const active = Boolean(settings.sportMode);
  const flag = flagFor(settings.defaultTargetLanguage || 'es');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [active, pulseAnim]);

  const handlePress = useCallback(() => {
    impactHeavy();
    // Punch animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start();
    toggleSportMode();
  }, [toggleSportMode, scaleAnim]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <View style={styles.sportWrap}>
      {/* Glow behind button */}
      {active && (
        <Animated.View style={[styles.sportGlow, { opacity: glowOpacity }]} />
      )}

      {/* Flames */}
      <Flame active={active} delay={0} style={{ bottom: -6, left: 4, width: 18, height: 32, backgroundColor: 'rgba(255,180,50,0.85)' }} />
      <Flame active={active} delay={40} style={{ bottom: -4, right: 6, width: 15, height: 28, backgroundColor: 'rgba(255,120,30,0.80)' }} />
      <Flame active={active} delay={80} style={{ top: -8, left: '38%', width: 20, height: 36, backgroundColor: 'rgba(255,200,60,0.75)' }} />
      <Flame active={active} delay={120} style={{ bottom: -3, left: '28%', width: 12, height: 22, backgroundColor: 'rgba(255,80,20,0.70)' }} />
      <Flame active={active} delay={60} style={{ top: -4, right: 8, width: 14, height: 26, backgroundColor: 'rgba(255,160,40,0.65)' }} />

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <View style={[styles.sportBtn, active && styles.sportBtnActive]}>
            <Ionicons name="flame" size={26} color={active ? '#FFD84A' : colors.textMute} />
            {!active && <Text style={styles.sportLabel}>SPORT</Text>}
            {active && (
              <View style={styles.flagBadge}>
                <Text style={{ fontSize: 11 }}>{flag}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sportWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 68,
    height: 68,
  },
  sportGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,100,20,0.40)',
    shadowColor: 'rgba(255,80,0,1)',
    shadowOpacity: 0.8,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
  },
  sportBtn: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15,18,22,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.60)',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sportBtnActive: {
    backgroundColor: 'rgba(80,15,5,0.95)',
    borderColor: 'rgba(255,80,0,0.75)',
    shadowColor: 'rgba(255,80,0,0.80)',
    shadowOpacity: 0.7,
    shadowRadius: 20,
  },
  sportLabel: {
    color: colors.textMute,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  flagBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
