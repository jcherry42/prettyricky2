import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { usePtt } from '../context/PttContext';
import { impactLight, impactMedium } from '../lib/haptics';
import { flagFor } from '../utils/language';

function langName(lang) {
  if (lang === 'es') return 'Spanish';
  if (lang === 'fr') return 'French';
  if (lang === 'ko') return 'Korean';
  if (lang === 'en') return 'English';
  return lang;
}

export function PttOverlayView({ visible, onClose }) {
  const ptt = usePtt();

  const fromLang = ptt.direction === 'en_to_target' ? 'English' : langName(ptt.targetLang);
  const toLang = ptt.direction === 'en_to_target' ? langName(ptt.targetLang) : 'English';
  const fromFlag = ptt.direction === 'en_to_target' ? '\ud83c\uddfa\ud83c\uddf8' : flagFor(ptt.targetLang);
  const toFlag = ptt.direction === 'en_to_target' ? flagFor(ptt.targetLang) : '\ud83c\uddfa\ud83c\uddf8';

  const canSpeak = Boolean(ptt.result?.translated_text) && (ptt.status === 'done' || ptt.status === 'speaking');

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.center}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headRow}>
              <View style={styles.titleRow}>
                <Ionicons name="mic" size={16} color="#9333EA" />
                <Text style={styles.title}>VOICE TRANSLATOR</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeIcon}>
                <Ionicons name="close" size={16} color={colors.textMute} />
              </Pressable>
            </View>

            {/* Direction Toggle */}
            <Pressable
              onPress={() => {
                impactMedium();
                ptt.toggleDirection();
              }}
              style={({ pressed }) => [styles.directionRow, pressed && { opacity: 0.88 }]}
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

            {/* Status */}
            {ptt.status === 'recording' && (
              <View style={styles.statusRow}>
                <View style={styles.recordingDot} />
                <Text style={[styles.statusText, { color: colors.red }]}>Recording\u2026</Text>
              </View>
            )}
            {ptt.status === 'uploading' && (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.gold} size="small" />
                <Text style={styles.statusText}>Uploading\u2026</Text>
              </View>
            )}
            {ptt.status === 'translating' && (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.gold} size="small" />
                <Text style={styles.statusText}>Translating\u2026</Text>
              </View>
            )}
            {ptt.status === 'speaking' && (
              <View style={styles.statusRow}>
                <Ionicons name="volume-high" size={16} color={colors.blue} />
                <Text style={[styles.statusText, { color: colors.blue }]}>Speaking\u2026</Text>
              </View>
            )}

            {ptt.error && (
              <View style={[styles.statusRow, { marginTop: 8 }]}>
                <Ionicons name="alert-circle" size={14} color={colors.red} />
                <Text style={[styles.statusText, { color: colors.red }]}>{ptt.error}</Text>
              </View>
            )}

            {/* Results */}
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

                <View style={{ height: 12 }} />

                <View style={styles.resultActions}>
                  <Pressable
                    onPress={() => {
                      impactLight();
                      ptt.speakTranslated();
                    }}
                    disabled={!canSpeak}
                    style={({ pressed }) => [styles.btn, (!canSpeak || pressed) && { opacity: 0.7 }]}
                  >
                    <Ionicons name="volume-high" size={16} color={colors.gold} />
                    <Text style={styles.btnText}>{ptt.status === 'speaking' ? 'Speaking\u2026' : 'Speak'}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      impactLight();
                      ptt.reset();
                    }}
                    style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="refresh" size={14} color={colors.textMute} />
                    <Text style={styles.btnGhostText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '92%',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.25)',
    backgroundColor: 'rgba(10,12,16,0.96)',
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
    width: 32,
    height: 32,
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginBottom: 12,
  },
  dirLang: {
    flex: 1,
    gap: 4,
  },
  dirFlag: {
    fontSize: 20,
  },
  dirName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  dirArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  resultSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  resultBlock: {
    gap: 4,
  },
  resultLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 9,
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
    height: 44,
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
    height: 44,
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
});
