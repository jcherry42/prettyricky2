import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { apiFetch } from '../lib/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { ttsSpeak } from '../lib/tts';

function flagFor(lang) {
  if (lang === 'es') return '🇲🇽';
  if (lang === 'fr') return '🇫🇷';
  if (lang === 'ko') return '🇰🇷';
  return '🏁';
}

export function TowerTalkOverlay({ visible, onClose }) {
  const { settings } = useAppSettings();
  const lang = settings.defaultTargetLanguage || 'es';

  const [situation, setSituation] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [vehicle, setVehicle] = useState('');

  const [state, setState] = useState({ status: 'idle', error: null });
  const [reply, setReply] = useState('');
  const [translated, setTranslated] = useState('');

  const sportOn = Boolean(settings.sportMode);
  const flag = useMemo(() => flagFor(lang), [lang]);

  async function runTowerTalk() {
    try {
      setState({ status: 'loading', error: null });
      setReply('');
      setTranslated('');

      const res = await apiFetch('/api/tower-talk', {
        method: 'POST',
        body: JSON.stringify({
          situation: situation.trim(),
          context: {
            customerName: customerName.trim() || undefined,
            vehicle: vehicle.trim() || undefined,
          },
        }),
      });

      setReply(res?.response || '');
      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }

  async function translateReply() {
    try {
      if (!reply.trim()) return;
      setState({ status: 'translating', error: null });
      const res = await apiFetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text: reply, source_lang: 'auto', target_lang: lang }),
      });
      setTranslated(res?.translated_text || '');
      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }

  async function speak(text, language) {
    try {
      if (!text?.trim()) return;
      setState({ status: 'speaking', error: null });
      await ttsSpeak({ text, language, voice: 'auto' });
      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.center}>
          <GlassCard style={{ width: '92%' }}>
            <View style={styles.headRow}>
              <Text style={styles.title}>TOWER TALK</Text>
              <Text style={styles.langBadge}>{sportOn ? `SPORT · ${flag}` : 'SPORT OFF'}</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.body}>High-performance sales authority. Short. Calm. Closing-focused.</Text>

              <View style={{ height: 12 }} />

              <TextInput
                value={situation}
                onChangeText={setSituation}
                placeholder="Situation (e.g., customer asking about price, wants to think, payment concern…)"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { height: 96, textAlignVertical: 'top', paddingTop: 12 }]}
                multiline
              />

              <View style={{ height: 10 }} />

              <TextInput
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Customer name (optional)"
                placeholderTextColor={colors.textMute}
                style={styles.input}
              />

              <View style={{ height: 10 }} />

              <TextInput
                value={vehicle}
                onChangeText={setVehicle}
                placeholder="Vehicle (optional)"
                placeholderTextColor={colors.textMute}
                style={styles.input}
              />

              <View style={{ height: 12 }} />

              <Pressable onPress={runTowerTalk} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.btnText}>Generate</Text>
                {state.status === 'loading' ? (
                  <View style={{ marginLeft: 10 }}>
                    <ActivityIndicator color={colors.gold} />
                  </View>
                ) : null}
              </Pressable>

              {state.error ? <Text style={[styles.body, { marginTop: 12, color: colors.red }]}>{state.error}</Text> : null}

              {reply ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.section}>Reply</Text>
                  <Text style={styles.cardText}>{reply}</Text>

                  <View style={{ height: 12 }} />

                  <Pressable onPress={() => speak(reply, 'en')} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}>
                    <Text style={styles.btnGhostText}>Speak (EN)</Text>
                  </Pressable>

                  {sportOn ? (
                    <>
                      <View style={{ height: 10 }} />
                      <Pressable onPress={translateReply} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.btnText}>Translate {flag}</Text>
                        {state.status === 'translating' ? (
                          <View style={{ marginLeft: 10 }}>
                            <ActivityIndicator color={colors.gold} />
                          </View>
                        ) : null}
                      </Pressable>

                      {translated ? (
                        <>
                          <View style={{ height: 12 }} />
                          <Text style={styles.section}>Translation</Text>
                          <Text style={styles.cardText}>{translated}</Text>
                          <View style={{ height: 12 }} />
                          <Pressable onPress={() => speak(translated, lang)} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.85 }]}>
                            <Text style={styles.btnGhostText}>Speak ({lang.toUpperCase()})</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}

              <View style={{ height: 12 }} />

              <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: 0.85 }]}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </ScrollView>
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
    color: colors.red,
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
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
