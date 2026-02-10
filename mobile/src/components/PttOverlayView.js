import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { usePtt } from '../context/PttContext';

function flagFor(lang) {
  if (lang === 'es') return '🇲🇽';
  if (lang === 'fr') return '🇫🇷';
  if (lang === 'ko') return '🇰🇷';
  return '🏁';
}

function langName(lang) {
  if (lang === 'es') return 'Spanish';
  if (lang === 'fr') return 'French';
  if (lang === 'ko') return 'Korean';
  if (lang === 'en') return 'English';
  return lang;
}

export function PttOverlayView({ visible, onClose }) {
  const ptt = usePtt();

  const label = useMemo(() => {
    const left = ptt.direction === 'en_to_target' ? `EN` : `${flagFor(ptt.targetLang)} ${ptt.targetLang.toUpperCase()}`;
    const right = ptt.direction === 'en_to_target' ? `${flagFor(ptt.targetLang)} ${langName(ptt.targetLang)}` : 'EN';
    return `${left} → ${right}`;
  }, [ptt.direction, ptt.targetLang]);

  const canSpeak = Boolean(ptt.result?.translated_text) && (ptt.status === 'done' || ptt.status === 'speaking');

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.center}>
          <GlassCard style={{ width: '92%' }}>
            <View style={styles.headRow}>
              <Text style={styles.title}>VOICE TRANSLATOR</Text>
              <Text style={styles.langBadge}>{label}</Text>
            </View>

            <Text style={styles.body}>Hold the floating mic button to talk. Release to translate.</Text>

            <View style={{ height: 12 }} />

            <Pressable onPress={ptt.toggleDirection} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnText}>Toggle direction</Text>
            </Pressable>

            {ptt.status === 'recording' ? (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={colors.red} />
                <Text style={[styles.body, { marginLeft: 10, color: colors.red }]}>Recording…</Text>
              </View>
            ) : null}

            {ptt.status === 'processing' ? (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={colors.gold} />
                <Text style={[styles.body, { marginLeft: 10 }]}>Processing…</Text>
              </View>
            ) : null}

            {ptt.error ? <Text style={[styles.body, { marginTop: 12, color: colors.red }]}>{ptt.error}</Text> : null}

            {ptt.result?.translated_text ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.section}>Transcript</Text>
                <Text style={styles.cardText}>{ptt.result.transcript}</Text>

                <View style={{ height: 10 }} />

                <Text style={styles.section}>Translation</Text>
                <Text style={styles.cardText}>{ptt.result.translated_text}</Text>

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={ptt.speakTranslated}
                  disabled={!canSpeak}
                  style={({ pressed }) => [styles.btn, (!canSpeak || pressed) && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnText}>{ptt.status === 'speaking' ? 'Speaking…' : 'Speak'}</Text>
                </Pressable>

                <View style={{ height: 10 }} />

                <Pressable onPress={ptt.reset} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.btnGhostText}>Clear</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ height: 12 }} />

            <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  langBadge: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  btnGhost: {
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  close: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
