import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { width: SW } = Dimensions.get('window');
const PIN_LENGTH = 5;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

/**
 * PinScreen — 5-digit numeric PIN entry.
 * Two modes: 'setup' (create new PIN) and 'login' (verify existing PIN).
 * Mercedes-Benz designo aesthetic: dark carbon fiber, ambient lighting.
 */
export function PinScreen() {
  const insets = useSafeAreaInsets();
  const { needsSetup, login, setupPin, error: authError } = useAuth();

  const [digits, setDigits] = useState([]);
  const [confirmDigits, setConfirmDigits] = useState(null); // null = first entry, [] = confirming
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))).current;

  const isSetup = needsSetup;
  const isConfirming = confirmDigits !== null;

  // Reset on mode change
  useEffect(() => {
    setDigits([]);
    setConfirmDigits(null);
    setStatus(isSetup ? 'Create your 5-digit PIN' : 'Enter your PIN');
  }, [isSetup]);

  // Animate dots when digits change
  useEffect(() => {
    digits.forEach((_, i) => {
      Animated.spring(dotAnims[i], {
        toValue: 1,
        friction: 4,
        tension: 300,
        useNativeDriver: true,
      }).start();
    });
    for (let i = digits.length; i < PIN_LENGTH; i++) {
      dotAnims[i].setValue(0);
    }
  }, [digits, dotAnims]);

  // Shake animation on error
  const triggerShake = useCallback(() => {
    setShaking(true);
    Vibration.vibrate(80);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setShaking(false);
      setDigits([]);
    });
  }, [shakeAnim]);

  // Handle PIN submission
  const submitPin = useCallback(async (pin) => {
    setProcessing(true);
    if (isSetup) {
      if (!isConfirming) {
        // First entry — store and ask for confirmation
        setConfirmDigits(pin);
        setDigits([]);
        setStatus('Confirm your PIN');
        setProcessing(false);
        return;
      }
      // Confirming — check match
      const firstPin = confirmDigits.join('');
      const secondPin = pin.join('');
      if (firstPin !== secondPin) {
        setStatus('PINs don\'t match. Try again.');
        setConfirmDigits(null);
        triggerShake();
        setProcessing(false);
        return;
      }
      const ok = await setupPin(secondPin);
      if (!ok) {
        triggerShake();
        setConfirmDigits(null);
        setStatus('Setup failed. Try again.');
      }
    } else {
      const ok = await login(pin.join(''));
      if (!ok) {
        triggerShake();
        setStatus('Invalid PIN');
      }
    }
    setProcessing(false);
  }, [isSetup, isConfirming, confirmDigits, login, setupPin, triggerShake]);

  const handleKey = useCallback((key) => {
    if (processing) return;
    if (key === '⌫') {
      setDigits(prev => prev.slice(0, -1));
      return;
    }
    if (key === '') return;

    setDigits(prev => {
      const next = [...prev, key];
      if (next.length === PIN_LENGTH) {
        // Small delay to show the last dot fill in
        setTimeout(() => submitPin(next), 200);
      }
      return next.length <= PIN_LENGTH ? next : prev;
    });
  }, [processing, submitPin]);

  return (
    <LinearGradient
      colors={['#040608', '#0A0E14', '#0D1117']}
      style={[styles.container, { paddingTop: insets.top + 40 }]}
    >
      {/* Branding */}
      <View style={styles.header}>
        <Text style={styles.brandName}>SUPERCHARG'D</Text>
        <View style={styles.brandLine} />
      </View>

      {/* Status */}
      <Text style={styles.statusText}>{status}</Text>
      {authError && !shaking ? <Text style={styles.errorText}>{authError}</Text> : null}

      {/* PIN Dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          const scale = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 1],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                { transform: [{ scale }] },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((key, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              styles.key,
              key === '' && styles.keyInvisible,
              pressed && key !== '' && styles.keyPressed,
            ]}
            onPress={() => handleKey(key)}
            disabled={key === '' || processing}
          >
            {key === '⌫' ? (
              <Ionicons name="backspace-outline" size={26} color={colors.text} />
            ) : (
              <Text style={styles.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* Setup / login hint */}
      <Text style={styles.hintText}>
        {isSetup
          ? isConfirming ? 'Re-enter the same PIN to confirm' : 'Choose a memorable 5-digit PIN'
          : 'Enter your dealership PIN'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 6,
    color: colors.chrome || '#C0C0C0',
  },
  brandLine: {
    width: 80,
    height: 0.5,
    backgroundColor: colors.gold,
    marginTop: 8,
    opacity: 0.5,
  },
  statusText: {
    fontSize: 16,
    color: colors.text || '#E4E4E4',
    marginBottom: 30,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#FF4B4B',
    marginTop: -20,
    marginBottom: 15,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 50,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(214,178,94,0.50)',
    backgroundColor: 'transparent',
    shadowColor: 'rgba(214,178,94,0.30)',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  dotFilled: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: Math.min(SW * 0.75, 300),
    justifyContent: 'center',
  },
  key: {
    width: Math.min(SW * 0.75, 300) / 3 - 12,
    height: 64,
    margin: 6,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  keyInvisible: {
    backgroundColor: 'transparent',
  },
  keyPressed: {
    backgroundColor: 'rgba(214,178,94,0.12)',
    borderColor: 'rgba(214,178,94,0.25)',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '400',
    color: colors.text || '#E4E4E4',
  },
  hintText: {
    fontSize: 12,
    color: colors.textDim || '#6B7280',
    marginTop: 30,
    textAlign: 'center',
  },
});
