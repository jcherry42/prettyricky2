import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAppSettings } from '../context/AppSettingsContext';
import { playActivationSound, playDeactivationSound, SOUND_PROFILES } from '../lib/soundProfiles';
import { SportModeActivation } from './SportModeActivation';
import { flagFor } from '../utils/language';

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

export function SportModeButton() {
  const { settings, toggleSportMode } = useAppSettings();
  const active = Boolean(settings.sportMode);
  const flag = flagFor(settings.defaultTargetLanguage || 'es');
  const profileId = settings.soundProfile || 'merica';
  const profile = SOUND_PROFILES[profileId] || SOUND_PROFILES.merica;

  const [showActivation, setShowActivation] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const iconSizeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;

  // Icon size animation: 26px -> 52px when active
  useEffect(() => {
    Animated.spring(iconSizeAnim, {
      toValue: active ? 1 : 0,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [active, iconSizeAnim]);

  // Pulse glow when active
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

  const handlePress = useCallback(async () => {
    // Punch animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start();

    if (!active) {
      // Activating SPORT mode
      setShowActivation(true);
      playActivationSound(profileId);
      toggleSportMode();
    } else {
      // Deactivating SPORT mode - 1.2s fade-out
      playDeactivationSound(profileId);
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        toggleSportMode();
        fadeOutAnim.setValue(1);
      });
    }
  }, [active, toggleSportMode, scaleAnim, profileId, fadeOutAnim]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  // Icon scale: interpolate from 1.0 (26px) to 2.0 (52px)
  const iconScale = iconSizeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });

  // Profile color for flames and glow
  const profileColor = profile.color || '#FF5000';

  return (
    <View style={styles.sportWrap}>
      {/* Glow behind button - colored by sound profile */}
      {active && (
        <Animated.View style={[
          styles.sportGlow,
          { opacity: glowOpacity, backgroundColor: `${profileColor}40`, shadowColor: profileColor },
        ]} />
      )}

      {/* Flames - colored by sound profile */}
      <Flame active={active} delay={0} style={{ bottom: -6, left: 4, width: 18, height: 32, backgroundColor: `${profileColor}DD` }} />
      <Flame active={active} delay={40} style={{ bottom: -4, right: 6, width: 15, height: 28, backgroundColor: `${profileColor}CC` }} />
      <Flame active={active} delay={80} style={{ top: -8, left: '38%', width: 20, height: 36, backgroundColor: `${profileColor}BB` }} />
      <Flame active={active} delay={120} style={{ bottom: -3, left: '28%', width: 12, height: 22, backgroundColor: `${profileColor}AA` }} />
      <Flame active={active} delay={60} style={{ top: -4, right: 8, width: 14, height: 26, backgroundColor: `${profileColor}99` }} />

      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeOutAnim }}>
        <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <View style={[
            styles.sportBtn,
            active && styles.sportBtnActive,
            active && { borderColor: `${profileColor}BB`, shadowColor: `${profileColor}CC` },
          ]}>
            {/* Animated icon - grows when SPORT active */}
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Ionicons name="flame" size={26} color={active ? profileColor : colors.textMute} />
            </Animated.View>

            {/* Label hidden when active */}
            {!active && <Text style={styles.sportLabel}>SPORT</Text>}

            {/* Flag badge shown when active */}
            {active && (
              <View style={styles.flagBadge}>
                <Text style={{ fontSize: 11 }}>{flag}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Profile indicator dot */}
      {active && (
        <View style={[styles.profileDot, { backgroundColor: profileColor }]} />
      )}

      {/* Full-screen activation overlay */}
      <SportModeActivation
        visible={showActivation}
        profileId={profileId}
        onComplete={() => setShowActivation(false)}
      />
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
  profileDot: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
