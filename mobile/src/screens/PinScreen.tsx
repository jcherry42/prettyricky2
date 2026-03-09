import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Vibration,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const { width: SW } = Dimensions.get('window');
const PIN_LENGTH = 5;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

/**
 * PinScreen — 5-digit numeric PIN entry.
 *
 * Modes:
 *   'setup'  — create a new PIN (first launch or after reset)
 *   'login'  — verify the existing PIN
 *
 * Recovery protocol:
 *   1. After 5 wrong guesses → 30-second lockout (countdown shown in UI)
 *   2. "Forgot PIN?" link → modal to enter Master Reset Code
 *   3. Valid reset code wipes the PIN → returns to setup mode
 *   4. After setup, the reset code is shown once with a "Save this" prompt
 */
export function PinScreen() {
  const insets = useSafeAreaInsets();
  const {
    needsSetup, login, setupPin, resetPin, dismissResetCode,
    error: authError, lockoutUntil, pendingResetCode,
  } = useAuth();

  const [digits, setDigits]             = useState([]);
  const [confirmDigits, setConfirmDigits] = useState(null);
  const [shaking, setShaking]           = useState(false);
  const [status, setStatus]             = useState('');
  const [processing, setProcessing]     = useState(false);

  // Lockout countdown
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);

  // Forgot PIN modal state
  const [showForgot, setShowForgot]         = useState(false);
  const [resetCode, setResetCode]           = useState('');
  const [resetBusy, setResetBusy]           = useState(false);
  const [resetError, setResetError]         = useState('');
  const [showEmergency, setShowEmergency]   = useState(false);
  const [overrideCode, setOverrideCode]     = useState('');
  const [overrideBusy, setOverrideBusy]     = useState(false);
  const [overrideError, setOverrideError]   = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims  = useRef(Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))).current;

  const isSetup      = needsSetup;
  const isConfirming = confirmDigits !== null;
  const isLocked     = lockSecondsLeft > 0;

  // ── Lockout countdown ──────────────────────────────────
  useEffect(() => {
    if (!lockoutUntil) { setLockSecondsLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000));
      setLockSecondsLeft(left);
      if (left <= 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockoutUntil]);

  // ── Status text ────────────────────────────────────────
  useEffect(() => {
    setDigits([]);
    setConfirmDigits(null);
    if (isSetup) {
      setStatus('Create your 5-digit PIN');
    } else {
      setStatus('Enter your PIN');
    }
  }, [isSetup]);

  // ── Dot fill animation ─────────────────────────────────
  useEffect(() => {
    digits.forEach((_, i) => {
      Animated.spring(dotAnims[i], {
        toValue: 1, friction: 4, tension: 300, useNativeDriver: true,
      }).start();
    });
    for (let i = digits.length; i < PIN_LENGTH; i++) dotAnims[i].setValue(0);
  }, [digits, dotAnims]);

  // ── Shake on error ─────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShaking(true);
    Vibration.vibrate(80);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start(() => {
      setShaking(false);
      setDigits([]);
    });
  }, [shakeAnim]);

  // ── PIN submit ─────────────────────────────────────────
  const submitPin = useCallback(async (pin) => {
    setProcessing(true);
    if (isSetup) {
      if (!isConfirming) {
        setConfirmDigits(pin);
        setDigits([]);
        setStatus('Confirm your PIN');
        setProcessing(false);
        return;
      }
      if (confirmDigits.join('') !== pin.join('')) {
        setStatus("PINs don't match. Try again.");
        setConfirmDigits(null);
        triggerShake();
        setProcessing(false);
        return;
      }
      const ok = await setupPin(pin.join(''));
      if (!ok) {
        triggerShake();
        setConfirmDigits(null);
        setStatus('Setup failed. Try again.');
      }
    } else {
      const ok = await login(pin.join(''));
      if (!ok) {
        triggerShake();
      }
    }
    setProcessing(false);
  }, [isSetup, isConfirming, confirmDigits, login, setupPin, triggerShake]);

  const handleKey = useCallback((key) => {
    if (processing || isLocked) return;
    if (key === '⌫') { setDigits(prev => prev.slice(0, -1)); return; }
    if (key === '') return;
    setDigits(prev => {
      const next = [...prev, key];
      if (next.length === PIN_LENGTH) setTimeout(() => submitPin(next), 200);
      return next.length <= PIN_LENGTH ? next : prev;
    });
  }, [processing, isLocked, submitPin]);

  // ── Reset flow ─────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!resetCode.trim()) {
      setResetError('Please enter your reset code.');
      return;
    }
    setResetBusy(true);
    setResetError('');
    const ok = await resetPin(resetCode);
    setResetBusy(false);
    if (ok) {
      setShowForgot(false);
      setResetCode('');
    } else {
      setResetError('Invalid reset code. Check the code you saved and try again.');
    }
  }, [resetCode, resetPin]);


  // Emergency override (lost both PIN and reset code)
  const handleEmergencyReset = useCallback(async () => {
    if (!overrideCode.trim()) { setOverrideError('Enter the emergency override code.'); return; }
    setOverrideBusy(true);
    setOverrideError('');
    try {
      const data = await apiFetch('/api/auth/emergency-reset', {
        method: 'POST',
        body: JSON.stringify({ override_code: overrideCode.toUpperCase().trim() }),
        _skipAuth: true,
      });
      if (data?.success) {
        setShowEmergency(false);
        setShowForgot(false);
        setOverrideCode('');
      }
    } catch (e: any) {
      const msg = (e?.message || '').replace(/^.*?:\s*/, '');
      setOverrideError(msg || 'Invalid override code.');
    }
    setOverrideBusy(false);
  }, [overrideCode]);


  // ── Derive status / error display ─────────────────────
  const displayError = isLocked
    ? `Locked — try again in ${lockSecondsLeft}s`
    : (authError && !shaking ? authError : null);

  return (
    <LinearGradient
      colors={['#040608', '#0A0E14', '#0D1117']}
      style={[styles.container, { paddingTop: insets.top + 40 }]}
    >
      {/* ── Branding ── */}
      <View style={styles.header}>
        <Text style={styles.brandName}>SUPERCHARG'D</Text>
        <View style={styles.brandLine} />
      </View>

      {/* ── Status ── */}
      <Text style={styles.statusText}>{status}</Text>
      {displayError ? (
        <Text style={[styles.errorText, isLocked && styles.lockedText]}>
          {displayError}
        </Text>
      ) : null}

      {/* ── PIN Dots ── */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          const scale  = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
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

      {/* ── Keypad ── */}
      <View style={[styles.keypad, isLocked && styles.keypadLocked]}>
        {KEYS.map((key, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              styles.key,
              key === '' && styles.keyInvisible,
              pressed && key !== '' && !isLocked && styles.keyPressed,
              isLocked && key !== '' && styles.keyDisabled,
            ]}
            onPress={() => handleKey(key)}
            disabled={key === '' || processing || isLocked}
          >
            {key === '⌫' ? (
              <Ionicons name="backspace-outline" size={26} color={isLocked ? colors.textMute : colors.text} />
            ) : (
              <Text style={[styles.keyText, isLocked && { color: colors.textMute }]}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Hint / Forgot PIN ── */}
      {isSetup ? (
        <Text style={styles.hintText}>
          {isConfirming ? 'Re-enter the same PIN to confirm' : 'Choose a memorable 5-digit PIN'}
        </Text>
      ) : (
        <Pressable
          onPress={() => { setShowForgot(true); setResetError(''); setResetCode(''); }}
          style={({ pressed }) => [styles.forgotBtn, pressed && { opacity: 0.7 }]}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
        >
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </Pressable>
      )}

      {/* ── Forgot PIN modal ── */}
      <Modal
        visible={showForgot}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgot(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowForgot(false)}
        >
          <Pressable style={styles.forgotCard} onPress={() => {}}>
            <View style={styles.forgotHeader}>
              <Ionicons name="key-outline" size={28} color={colors.gold} />
              <Text style={styles.forgotTitle}>Reset PIN</Text>
            </View>

            <Text style={styles.forgotDesc}>
              Enter the 8-character Master Reset Code that was displayed when you first set up your PIN.
              This will wipe the current PIN and return you to setup.
            </Text>

            <TextInput
              value={resetCode}
              onChangeText={(t) => { setResetCode(t.toUpperCase()); setResetError(''); }}
              placeholder="e.g. AB3K9XPQ"
              placeholderTextColor={colors.textMute}
              style={styles.resetInput}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />

            {resetError ? <Text style={styles.resetError}>{resetError}</Text> : null}

            <View style={styles.resetBtnRow}>
              <Pressable
                onPress={() => setShowForgot(false)}
                style={({ pressed }) => [styles.resetBtn, styles.resetBtnCancel, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.resetBtnCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={handleReset}
                disabled={resetBusy || !resetCode.trim()}
                style={({ pressed }) => [
                  styles.resetBtn, styles.resetBtnConfirm,
                  (resetBusy || !resetCode.trim()) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.resetBtnConfirmText}>
                  {resetBusy ? 'VERIFYING...' : 'RESET PIN'}
                </Text>
              </Pressable>
            </View>

            {/* Lost reset code — tertiary escape hatch */}
            <Pressable
              onPress={() => { setShowEmergency(true); setOverrideError(''); setOverrideCode(''); }}
              style={({ pressed }) => [styles.lostCodeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.lostCodeText}>Lost your reset code?</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Emergency Override modal (last resort) ── */}
      <Modal
        visible={showEmergency}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmergency(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowEmergency(false)}>
          <Pressable style={[styles.forgotCard, { borderColor: 'rgba(255,75,75,0.25)' }]} onPress={() => {}}>
            <View style={styles.forgotHeader}>
              <Ionicons name="nuclear-outline" size={26} color="#FF4B4B" />
              <Text style={[styles.forgotTitle, { color: '#FF4B4B' }]}>Emergency Override</Text>
            </View>

            <Text style={styles.forgotDesc}>
              This is the last resort. The Emergency Override Code is stored in your server&apos;s{' '}
              <Text style={{ color: colors.gold, fontWeight: '800' }}>.env</Text> file as{' '}
              <Text style={{ color: colors.gold, fontWeight: '800' }}>EMERGENCY_OVERRIDE_CODE</Text>.
              {'\n\n'}
              Retrieve it by logging into your server, or contact{' '}
              <Text style={{ color: colors.gold }}>Supercharg&apos;d support</Text> if you need help accessing it.
            </Text>

            <TextInput
              value={overrideCode}
              onChangeText={(t) => { setOverrideCode(t.toUpperCase()); setOverrideError(''); }}
              placeholder="16-char override code"
              placeholderTextColor={colors.textMute}
              style={[styles.resetInput, { borderColor: 'rgba(255,75,75,0.30)', letterSpacing: 3 }]}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleEmergencyReset}
            />

            {overrideError ? <Text style={styles.resetError}>{overrideError}</Text> : null}

            <View style={styles.resetBtnRow}>
              <Pressable
                onPress={() => setShowEmergency(false)}
                style={({ pressed }) => [styles.resetBtn, styles.resetBtnCancel, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.resetBtnCancelText}>BACK</Text>
              </Pressable>
              <Pressable
                onPress={handleEmergencyReset}
                disabled={overrideBusy || !overrideCode.trim()}
                style={({ pressed }) => [
                  styles.resetBtn,
                  { borderColor: '#FF4B4B', backgroundColor: 'rgba(255,75,75,0.12)' },
                  (overrideBusy || !overrideCode.trim()) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.resetBtnConfirmText}>
                  {overrideBusy ? 'VERIFYING...' : 'OVERRIDE & RESET'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── One-time Reset Code display (shown after PIN setup) ── */}
      <Modal
        visible={!!pendingResetCode}
        transparent
        animationType="fade"
      >
        <View style={styles.overlay}>
          <View style={styles.resetCodeCard}>
            <View style={[styles.resetCodeWarningBadge]}>
              <Ionicons name="warning" size={18} color="#FF8C00" />
              <Text style={styles.resetCodeWarningText}>SAVE THIS CODE</Text>
            </View>

            <Text style={styles.resetCodeTitle}>Your Master Reset Code</Text>
            <Text style={styles.resetCodeDesc}>
              If you ever forget your PIN, this code is the only way to regain access.
              {`\n\n`}Store it somewhere safe — it{"'"}s shown exactly once and{' '}
              cannot be recovered.
            </Text>

            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(pendingResetCode);
                Alert.alert('Copied', 'Reset code copied to clipboard.');
              }}
              style={styles.resetCodeBox}
            >
              <Text style={styles.resetCodeValue}>
                {pendingResetCode?.match(/.{1,4}/g)?.join(' ')}
              </Text>
              <View style={styles.resetCodeCopyHint}>
                <Ionicons name="copy-outline" size={12} color={colors.textMute} />
                <Text style={styles.resetCodeCopyText}>TAP TO COPY</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={dismissResetCode}
              style={({ pressed }) => [styles.resetCodeDoneBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.bg0} />
              <Text style={styles.resetCodeDoneBtnText}>I'VE SAVED MY RESET CODE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { alignItems: 'center', marginBottom: 40 },
  brandName: { fontSize: 18, fontWeight: '700', letterSpacing: 6, color: '#C0C0C0' },
  brandLine: { width: 80, height: 0.5, backgroundColor: colors.gold, marginTop: 8, opacity: 0.5 },

  statusText: { fontSize: 16, color: colors.text, marginBottom: 30, fontWeight: '500' },
  errorText:  { fontSize: 13, color: '#FF4B4B', marginTop: -20, marginBottom: 15, textAlign: 'center', paddingHorizontal: 30 },
  lockedText: { color: '#FF8C00' },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 50 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: 'rgba(214,178,94,0.50)',
    backgroundColor: 'transparent',
    shadowColor: 'rgba(214,178,94,0.30)', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  dotFilled: {
    backgroundColor: colors.gold, borderColor: colors.gold,
    shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 8,
  },

  keypad:       { flexDirection: 'row', flexWrap: 'wrap', width: Math.min(SW * 0.75, 300), justifyContent: 'center' },
  keypadLocked: { opacity: 0.45 },
  key: {
    width: Math.min(SW * 0.75, 300) / 3 - 12, height: 64, margin: 6,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(214,178,94,0.06)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  keyInvisible: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyPressed:   { backgroundColor: 'rgba(214,178,94,0.12)', borderColor: 'rgba(214,178,94,0.25)' },
  keyDisabled:  { borderColor: 'transparent' },
  keyText:      { fontSize: 28, fontWeight: '400', color: colors.text },

  forgotBtn:  { marginTop: 32 },
  forgotText: { fontSize: 13, color: 'rgba(214,178,94,0.6)', textDecorationLine: 'underline', textDecorationColor: 'rgba(214,178,94,0.3)' },

  // ── Modals ──
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },

  forgotCard: {
    width: '100%', maxWidth: 370,
    backgroundColor: '#0C0F14',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(214,178,94,0.18)',
    padding: 28,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 10 },
  },
  forgotHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  forgotTitle:  { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  forgotDesc:   { fontSize: 13, color: colors.textDim, lineHeight: 20, marginBottom: 22 },
  resetInput: {
    height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(214,178,94,0.25)',
    paddingHorizontal: 18, color: colors.text,
    fontSize: 20, fontWeight: '800', letterSpacing: 4, textAlign: 'center',
    marginBottom: 12,
  },
  resetError: { fontSize: 12, color: '#FF4B4B', textAlign: 'center', marginBottom: 14 },
  resetBtnRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  resetBtn: {
    flex: 1, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  resetBtnCancel:      { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' },
  resetBtnCancelText:  { color: colors.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  resetBtnConfirm:     { borderColor: '#FF4B4B', backgroundColor: 'rgba(255,75,75,0.12)' },
  resetBtnConfirmText: { color: '#FF4B4B', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  lostCodeBtn: { alignSelf: 'center', marginTop: 18 },
  lostCodeText: {
    fontSize: 12,
    color: 'rgba(255,75,75,0.55)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,75,75,0.3)',
  },

  // ── Reset code reveal card ──
  resetCodeCard: {
    width: '100%', maxWidth: 370,
    backgroundColor: '#0C0F14',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,140,0,0.30)',
    padding: 28,
    shadowColor: '#FF8C00', shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: 0 },
  },
  resetCodeWarningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'center', marginBottom: 18,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)',
    backgroundColor: 'rgba(255,140,0,0.10)',
  },
  resetCodeWarningText: { color: '#FF8C00', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  resetCodeTitle:       { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  resetCodeDesc:        { fontSize: 13, color: colors.textDim, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  resetCodeBox: {
    backgroundColor: 'rgba(255,140,0,0.07)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,140,0,0.30)',
    paddingVertical: 20, paddingHorizontal: 24,
    alignItems: 'center', marginBottom: 24,
  },
  resetCodeValue:    { fontSize: 30, fontWeight: '900', color: '#FF8C00', letterSpacing: 8 },
  resetCodeCopyHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  resetCodeCopyText: { fontSize: 10, color: colors.textMute, fontWeight: '700', letterSpacing: 1.2 },
  resetCodeDoneBtn: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.gold,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  resetCodeDoneBtnText: { color: colors.bg0, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
