import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { voiceTranslateUpload } from '../lib/voiceTranslate';
import { ttsSpeak } from '../lib/tts';
import { useAppSettings } from '../context/AppSettingsContext';

function flagFor(lang) {
  // Per user: Mexican flag for Spanish.
  if (lang === 'es') return '🇲🇽';
  if (lang === 'fr') return '🇫🇷';
  if (lang === 'ko') return '🇰🇷';
  return '🏁';
}

function langName(lang) {
  if (lang === 'es') return 'Spanish';
  if (lang === 'fr') return 'French';
  if (lang === 'ko') return 'Korean';
  return lang;
}

export function PttOverlay({ visible, onClose }) {
  const { settings } = useAppSettings();
  const targetLang = settings.defaultTargetLanguage || 'es';
  const [state, setState] = useState({ status: 'idle', error: null });
  const [result, setResult] = useState({ transcript: '', translated_text: '' });

  const recordingRef = useRef(null);
  const playbackRef = useRef(null);

  const label = useMemo(() => `${flagFor(targetLang)} ${langName(targetLang)}`, [targetLang]);

  useEffect(() => {
    if (!visible) {
      setState({ status: 'idle', error: null });
      setResult({ transcript: '', translated_text: '' });
    }
  }, [visible]);

  const start = useCallback(async () => {
    try {
      setState({ status: 'recording', error: null });

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission not granted');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;

    try {
      setState({ status: 'processing', error: null });
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No recording URI');

      const out = await voiceTranslateUpload({
        uri,
        sourceLang: 'en',
        targetLang,
        mimeType: 'audio/m4a',
      });

      setResult(out);
      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }, [targetLang]);

  const speak = useCallback(async () => {
    try {
      if (!result?.translated_text) return;
      setState((s) => ({ ...s, status: 'speaking', error: null }));

      const res = await ttsSpeak({ text: result.translated_text, language: targetLang, voice: 'auto' });
      const mime = res?.mime_type || 'audio/mpeg';
      const b64 = res?.audio_data || '';
      if (!b64) throw new Error('TTS returned empty audio');

      // Play base64 audio using expo-av by writing to a data URI.
      // NOTE: This works in Expo; if platform issues arise, we can switch to file-system temp write.
      const uri = `data:${mime};base64,${b64}`;

      if (playbackRef.current) {
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      playbackRef.current = sound;

      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          setState({ status: 'done', error: null });
        }
      });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }, [result, targetLang]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.center}>
          <GlassCard style={{ width: '92%' }}>
            <View style={styles.headRow}>
              <Text style={styles.title}>VOICE TRANSLATOR</Text>
              <Text style={styles.langBadge}>EN → {label}</Text>
            </View>

            <Text style={styles.body}>Hold the button to talk. Release to translate.</Text>

            <View style={{ height: 14 }} />

            <Pressable
              onPressIn={start}
              onPressOut={stop}
              style={({ pressed }) => [styles.holdBtn, state.status === 'recording' && styles.holdBtnRec, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.holdBtnText}>{state.status === 'recording' ? 'RECORDING…' : 'HOLD TO TALK'}</Text>
            </Pressable>

            {state.status === 'processing' ? (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={colors.gold} />
                <Text style={[styles.body, { marginLeft: 10 }]}>Processing…</Text>
              </View>
            ) : null}

            {state.error ? <Text style={[styles.body, { marginTop: 12, color: colors.red }]}>{state.error}</Text> : null}

            {result?.translated_text ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.section}>Transcript</Text>
                <Text style={styles.cardText}>{result.transcript}</Text>

                <View style={{ height: 10 }} />

                <Text style={styles.section}>Translation</Text>
                <Text style={styles.cardText}>{result.translated_text}</Text>

                <View style={{ height: 12 }} />

                <Pressable onPress={speak} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnText}>Speak</Text>
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
  holdBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.40)',
    backgroundColor: 'rgba(126,34,206,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdBtnRec: {
    borderColor: 'rgba(255,45,45,0.55)',
    backgroundColor: 'rgba(255,45,45,0.12)',
  },
  holdBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
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
