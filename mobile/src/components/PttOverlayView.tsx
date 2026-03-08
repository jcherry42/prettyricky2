import React, { useEffect, useRef, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { usePtt } from '../context/PttContext';
import { impactLight, impactMedium, impactHeavy, notificationSuccess, selectionTap } from '../lib/haptics';
import { flagFor } from '../utils/language';
import { sendTowerTalkSms } from '../lib/sms';

function langName(lang) {
  if (lang === 'es') return 'Spanish';
  if (lang === 'fr') return 'French';
  if (lang === 'ko') return 'Korean';
  if (lang === 'en') return 'English';
  return lang;
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Animated audio waveform — 7 bars with staggered pulse
function AudioWaveform({ color = colors.red }) {
  // MUST NOT use useRef inside Array.from — create a single ref holding the array
  const barsRef = useRef(null);
  if (!barsRef.current) {
    barsRef.current = Array.from({ length: 7 }, () => new Animated.Value(0.2));
  }
  const bars = barsRef.current;

  useEffect(() => {
    const animations = bars.map((anim, i) => {
      const delay = i * 60;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.0, duration: 280, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 220, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.70, duration: 180, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.20, duration: 240, useNativeDriver: true }),
        ])
      );
    });
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={waveStyles.wrap}>
      {bars.map((anim, i) => (
        <Animated.View
          key={i}
          style={[waveStyles.bar, { backgroundColor: color, transform: [{ scaleY: anim }] }]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
  },
  bar: {
    width: 4,
    height: 36,
    borderRadius: 3,
  },
});

// Large central stop button shown while recording
// NOTE: Animated.multiply() is broken in RN 0.81 new-arch (JSI boundary
// type mismatch). We use a separate Animated.Value driven by the outer
// ring animation instead.
function RecordingButton({ onStop }) {
  const ringAnim = useRef(new Animated.Value(1)).current;
  const innerAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const outerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.18, duration: 800, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    const innerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(innerAnim, { toValue: 1.062, duration: 800, useNativeDriver: true }), // 1.18 * 0.9
        Animated.timing(innerAnim, { toValue: 0.9, duration: 800, useNativeDriver: true }),    // 1.0  * 0.9
      ])
    );
    outerLoop.start();
    innerLoop.start();
    return () => { outerLoop.stop(); innerLoop.stop(); };
  }, [ringAnim, innerAnim]);

  return (
    <View style={styles.recordingBtnWrap}>
      <Animated.View pointerEvents="none" style={[styles.recordingRingOuter, { transform: [{ scale: ringAnim }] }]} />
      <Animated.View pointerEvents="none" style={[styles.recordingRingInner, { transform: [{ scale: innerAnim }] }]} />
      <Pressable
        onPress={() => { impactHeavy(); onStop(); }}
        style={({ pressed }) => [styles.recordingBtn, pressed && { transform: [{ scale: 0.92 }] }]}
        accessibilityLabel="Stop recording"
        accessibilityRole="button"
      >
        <View style={styles.stopIcon} />
      </Pressable>
      <Text style={styles.tapToStop}>TAP TO STOP</Text>
    </View>
  );
}

export function PttOverlayView({ visible, onClose }) {
  const ptt = usePtt();
  const insets = useSafeAreaInsets();

  const fromLang = ptt.direction === 'en_to_target' ? 'English' : langName(ptt.targetLang);
  const toLang = ptt.direction === 'en_to_target' ? langName(ptt.targetLang) : 'English';
  const fromFlag = ptt.direction === 'en_to_target' ? '\ud83c\uddfa\ud83c\uddf8' : flagFor(ptt.targetLang);
  const toFlag = ptt.direction === 'en_to_target' ? flagFor(ptt.targetLang) : '\ud83c\uddfa\ud83c\uddf8';

  const isRecording = ptt.status === 'recording';
  const isRequesting = ptt.status === 'requesting';
  const isBusy = ptt.status === 'uploading' || ptt.status === 'translating' || ptt.status === 'speaking';
  const isDone = ptt.status === 'done' || (ptt.status === 'speaking' && Boolean(ptt.result?.translated_text));
  const canSpeak = Boolean(ptt.result?.translated_text) && (ptt.status === 'done' || ptt.status === 'speaking');

  const copyTranscript = useCallback(async () => {
    if (!ptt.result?.transcript) return;
    selectionTap();
    await Clipboard.setStringAsync(ptt.result.transcript).catch(() => {});
  }, [ptt.result?.transcript]);

  const copyTranslation = useCallback(async () => {
    if (!ptt.result?.translated_text) return;
    selectionTap();
    await Clipboard.setStringAsync(ptt.result.translated_text).catch(() => {});
    notificationSuccess();
  }, [ptt.result?.translated_text]);

  const sendTranslationSms = useCallback(async () => {
    if (!ptt.result?.translated_text) return;
    impactMedium();
    await sendTowerTalkSms(ptt.result.translated_text).catch(() => {});
  }, [ptt.result?.translated_text]);

  const handleClose = () => {
    if (isRecording || isRequesting) {
      ptt.stopRecording?.();
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.center}>
          <View style={styles.card}>
            {/* Brushed aluminum top specular edge */}
            <LinearGradient
              colors={['rgba(147,51,234,0.20)', 'rgba(147,51,234,0.00)']}
              style={styles.cardTopHighlight}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            {/* Header */}
            <View style={styles.headRow}>
              <View style={styles.titleRow}>
                <View style={styles.titleDot} />
                <Text style={styles.title}>VOICE TRANSLATOR</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeIcon}>
                <Ionicons name="close" size={16} color={colors.textMute} />
              </Pressable>
            </View>

            {/* Direction Toggle */}
            <Pressable
              onPress={() => {
                if (isRecording || isRequesting || isBusy) return;
                impactMedium();
                ptt.toggleDirection();
              }}
              style={({ pressed }) => [
                styles.directionRow,
                (isRecording || isRequesting || isBusy) && { opacity: 0.5 },
                pressed && !(isRecording || isRequesting || isBusy) && { opacity: 0.88 },
              ]}
            >
              <View style={styles.dirLang}>
                <Text style={styles.dirFlag}>{fromFlag}</Text>
                <Text style={styles.dirName}>{fromLang}</Text>
              </View>
              <View style={styles.dirArrow}>
                <Ionicons name="swap-horizontal" size={20} color={colors.gold} />
              </View>
              <View style={[styles.dirLang, { alignItems: 'flex-end' }]}>
                <Text style={styles.dirFlag}>{toFlag}</Text>
                <Text style={styles.dirName}>{toLang}</Text>
              </View>
            </Pressable>

            {/* REQUESTING state */}
            {isRequesting && (
              <View style={styles.busySection}>
                <ActivityIndicator color="#9333EA" size="large" />
                <Text style={styles.busyLabel}>Requesting microphone…</Text>
                <Pressable
                  onPress={() => { impactLight(); ptt.stopRecording?.(); }}
                  style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </Pressable>
              </View>
            )}

            {/* RECORDING state */}
            {isRecording && (
              <View style={styles.recordingSection}>
                <View style={styles.timerRow}>
                  <View style={styles.recDot} />
                  <Text style={styles.timerText}>{formatElapsed(ptt.elapsedMs)}</Text>
                  <Text style={styles.timerMax}>/ 0:15</Text>
                </View>
                <AudioWaveform color={colors.red} />
                <View style={{ height: 18 }} />
                <RecordingButton onStop={() => ptt.stopRecording?.()} />
              </View>
            )}

            {/* BUSY state */}
            {isBusy && (
              <View style={styles.busySection}>
                <ActivityIndicator color={colors.gold} size="large" />
                <Text style={styles.busyLabel}>
                  {ptt.status === 'uploading' && 'Processing audio…'}
                  {ptt.status === 'translating' && 'Translating…'}
                  {ptt.status === 'speaking' && 'Speaking…'}
                </Text>
              </View>
            )}

            {/* ERROR state */}
            {ptt.error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={styles.errorText}>{ptt.error}</Text>
              </View>
            )}

            {/* RESULTS */}
            {ptt.result?.translated_text ? (
              <View style={styles.resultSection}>
                {/* Transcript */}
                {ptt.result.transcript ? (
                  <View style={styles.resultBlock}>
                    <View style={styles.resultBlockHeader}>
                      <Text style={styles.resultLabel}>{fromFlag} TRANSCRIPT</Text>
                      <Pressable onPress={copyTranscript} style={styles.smallAction}>
                        <Ionicons name="copy-outline" size={14} color={colors.textMute} />
                      </Pressable>
                    </View>
                    <Text style={styles.resultText}>{ptt.result.transcript}</Text>
                  </View>
                ) : null}

                <View style={styles.divider} />

                {/* Translation */}
                <View style={styles.resultBlock}>
                  <View style={styles.resultBlockHeader}>
                    <Text style={[styles.resultLabel, { color: colors.gold }]}>
                      {toFlag} TRANSLATION
                    </Text>
                    <View style={styles.resultActionsRow}>
                      <Pressable onPress={copyTranslation} style={styles.smallAction}>
                        <Ionicons name="copy-outline" size={14} color={colors.gold} />
                      </Pressable>
                      <Pressable onPress={sendTranslationSms} style={styles.smallActionGold}>
                        <Ionicons name="send" size={13} color={colors.gold} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={[styles.resultText, { color: colors.gold }]}>
                    {ptt.result.translated_text}
                  </Text>
                </View>

                <View style={{ height: 14 }} />

                {/* Actions */}
                <View style={styles.resultActions}>
                  <Pressable
                    onPress={() => { impactLight(); ptt.speakTranslated(); }}
                    disabled={!canSpeak}
                    style={({ pressed }) => [styles.btn, (!canSpeak || pressed) && { opacity: 0.65 }]}
                  >
                    <Ionicons name="volume-high" size={16} color={colors.gold} />
                    <Text style={styles.btnText}>
                      {ptt.status === 'speaking' ? 'Speaking…' : `Speak ${toFlag}`}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { impactLight(); ptt.reset(); }}
                    style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="mic" size={14} color={colors.textMute} />
                    <Text style={styles.btnGhostText}>New</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* IDLE hint */}
            {(ptt.status === 'idle' || (ptt.status === 'done' && !ptt.result?.translated_text)) && (
              <View style={styles.idleSection}>
                <View style={styles.idleIconWrap}>
                  <Ionicons name="mic" size={28} color="rgba(147,51,234,0.60)" />
                </View>
                <Text style={styles.idleTitle}>Ready to Translate</Text>
                <Text style={styles.idleHintText}>
                  Press the purple mic button below to start speaking. Translation happens automatically.
                </Text>
              </View>
            )}

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '92%',
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.20)',
    backgroundColor: 'rgba(6,8,12,0.98)',
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#9333EA',
    shadowOpacity: 0.30,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9333EA',
    shadowColor: '#9333EA',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  closeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  dirLang: {
    flex: 1,
    gap: 4,
  },
  dirFlag: {
    fontSize: 24,
  },
  dirName: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  dirArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busySection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 14,
  },
  busyLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  cancelBtnText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  recordingSection: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
    shadowColor: colors.red,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  timerText: {
    color: colors.red,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timerMax: {
    color: colors.textMute,
    fontSize: 14,
    fontWeight: '700',
  },
  recordingBtnWrap: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  recordingRingOuter: {
    position: 'absolute',
    top: -14,
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.20)',
    backgroundColor: 'transparent',
  },
  recordingRingInner: {
    position: 'absolute',
    top: -6,
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.35)',
    backgroundColor: 'transparent',
  },
  recordingBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,45,45,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,45,45,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,45,45,0.8)',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  tapToStop: {
    color: colors.red,
    ...type.label,
    fontSize: 11,
    letterSpacing: 2.4,
    marginTop: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.07)',
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  resultSection: {
    marginTop: 4,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(8,10,14,0.80)',
  },
  resultBlock: {
    gap: 6,
  },
  resultBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resultLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  resultText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  smallActionGold: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 12,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnGhost: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnGhostText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '700',
  },
  idleSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  idleIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.30)',
    backgroundColor: 'rgba(147,51,234,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  idleTitle: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  idleHintText: {
    color: colors.textMute,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
