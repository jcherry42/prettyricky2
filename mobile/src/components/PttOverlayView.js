import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { usePtt } from '../context/PttContext';
import { impactLight, impactMedium, impactHeavy } from '../lib/haptics';
import { flagFor } from '../utils/language';

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

// Animated pulsing red dot for recording state
function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
      ])
    ).start();
    return () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    };
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.pulsingDot, { transform: [{ scale }], opacity }]} />
  );
}

// Large central microphone button shown while recording
function RecordingButton({ onStop }) {
  const ringAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    return () => ringAnim.stopAnimation();
  }, [ringAnim]);

  return (
    <View style={styles.recordingBtnWrap}>
      {/* Pulsing outer ring */}
      <Animated.View style={[styles.recordingRing, { transform: [{ scale: ringAnim }] }]} />
      <Pressable
        onPress={() => { impactHeavy(); onStop(); }}
        style={({ pressed }) => [styles.recordingBtn, pressed && { transform: [{ scale: 0.94 }] }]}
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

  const fromLang = ptt.direction === 'en_to_target' ? 'English' : langName(ptt.targetLang);
  const toLang = ptt.direction === 'en_to_target' ? langName(ptt.targetLang) : 'English';
  const fromFlag = ptt.direction === 'en_to_target' ? '\ud83c\uddfa\ud83c\uddf8' : flagFor(ptt.targetLang);
  const toFlag = ptt.direction === 'en_to_target' ? flagFor(ptt.targetLang) : '\ud83c\uddfa\ud83c\uddf8';

  const isRecording = ptt.status === 'recording';
  const isRequesting = ptt.status === 'requesting';
  const isBusy = ptt.status === 'uploading' || ptt.status === 'translating' || ptt.status === 'speaking';
  const canSpeak = Boolean(ptt.result?.translated_text) && (ptt.status === 'done' || ptt.status === 'speaking');

  const handleClose = () => {
    // If recording, stop first before closing
    if (isRecording || isRequesting) {
      ptt.stopRecording?.();
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.center}>
          <View style={styles.card}>

            {/* ---- Header ---- */}
            <View style={styles.headRow}>
              <View style={styles.titleRow}>
                <Ionicons name="mic" size={16} color="#9333EA" />
                <Text style={styles.title}>VOICE TRANSLATOR</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeIcon}>
                <Ionicons name="close" size={16} color={colors.textMute} />
              </Pressable>
            </View>

            {/* ---- Direction Toggle ---- */}
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

            {/* ---- REQUESTING state ---- */}
            {isRequesting && (
              <View style={styles.busySection}>
                <ActivityIndicator color="#9333EA" size="large" />
                <Text style={styles.busyLabel}>Requesting microphone\u2026</Text>
                <Pressable
                  onPress={() => { impactLight(); ptt.stopRecording?.(); }}
                  style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </Pressable>
              </View>
            )}

            {/* ---- RECORDING state: large stop button + timer ---- */}
            {isRecording && (
              <View style={styles.recordingSection}>
                <View style={styles.timerRow}>
                  <PulsingDot />
                  <Text style={styles.timerText}>{formatElapsed(ptt.elapsedMs)}</Text>
                  <Text style={styles.timerMax}>/ 0:15</Text>
                </View>
                <RecordingButton onStop={() => ptt.stopRecording?.()} />
              </View>
            )}

            {/* ---- BUSY state: uploading / translating / speaking ---- */}
            {isBusy && (
              <View style={styles.busySection}>
                <ActivityIndicator color={colors.gold} size="large" />
                <Text style={styles.busyLabel}>
                  {ptt.status === 'uploading' && 'Uploading audio\u2026'}
                  {ptt.status === 'translating' && 'Translating\u2026'}
                  {ptt.status === 'speaking' && 'Speaking\u2026'}
                </Text>
              </View>
            )}

            {/* ---- ERROR state ---- */}
            {ptt.error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={styles.errorText}>{ptt.error}</Text>
              </View>
            )}

            {/* ---- DONE: Results ---- */}
            {ptt.result?.translated_text ? (
              <View style={styles.resultSection}>
                <View style={styles.resultBlock}>
                  <Text style={styles.resultLabel}>TRANSCRIPT</Text>
                  <Text style={styles.resultText}>{ptt.result.transcript}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.resultBlock}>
                  <Text style={styles.resultLabel}>TRANSLATION</Text>
                  <Text style={[styles.resultText, { color: colors.gold }]}>{ptt.result.translated_text}</Text>
                </View>

                <View style={{ height: 14 }} />

                <View style={styles.resultActions}>
                  <Pressable
                    onPress={() => { impactLight(); ptt.speakTranslated(); }}
                    disabled={!canSpeak}
                    style={({ pressed }) => [styles.btn, (!canSpeak || pressed) && { opacity: 0.65 }]}
                  >
                    <Ionicons name="volume-high" size={16} color={colors.gold} />
                    <Text style={styles.btnText}>
                      {ptt.status === 'speaking' ? 'Speaking\u2026' : 'Speak'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { impactLight(); ptt.reset(); }}
                    style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="refresh" size={14} color={colors.textMute} />
                    <Text style={styles.btnGhostText}>New</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* ---- IDLE / DONE (no result): Tap instruction ---- */}
            {(ptt.status === 'idle' || (ptt.status === 'done' && !ptt.result?.translated_text)) && (
              <View style={styles.idleHint}>
                <Text style={styles.idleHintText}>
                  Press the purple mic button to start recording.
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
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '92%',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.30)',
    backgroundColor: 'rgba(10,12,16,0.97)',
    padding: 18,
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
  title: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.0,
  },
  closeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.28)',
    marginBottom: 16,
  },
  dirLang: {
    flex: 1,
    gap: 4,
  },
  dirFlag: {
    fontSize: 22,
  },
  dirName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  dirArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Requesting / Busy ---
  busySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 14,
  },
  busyLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  cancelBtnText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  // --- Recording ---
  recordingSection: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.red,
  },
  timerText: {
    color: colors.red,
    fontSize: 28,
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
  },
  recordingRing: {
    position: 'absolute',
    top: -12,
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2,
    borderColor: 'rgba(255,45,45,0.30)',
    backgroundColor: 'rgba(255,45,45,0.05)',
  },
  recordingBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,45,45,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,45,45,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,45,45,0.8)',
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  stopIcon: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  tapToStop: {
    color: colors.red,
    ...type.label,
    fontSize: 11,
    letterSpacing: 2.4,
    marginTop: 4,
  },
  // --- Error ---
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.08)',
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  // --- Results ---
  resultSection: {
    marginTop: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  resultBlock: {
    gap: 4,
  },
  resultLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  resultText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.stroke,
    marginVertical: 10,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 11,
  },
  btnGhost: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnGhostText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  // --- Idle hint ---
  idleHint: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  idleHintText: {
    color: colors.textMute,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
