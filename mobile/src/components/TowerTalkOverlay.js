import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { apiFetch } from '../lib/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { ttsSpeak } from '../lib/tts';
import { playBase64Audio } from '../lib/audioPlayback';
import { impactMedium, notificationSuccess, notificationError, selectionTap } from '../lib/haptics';

function flagFor(lang) {
  if (lang === 'es') return '\ud83c\uddf2\ud83c\uddfd';
  if (lang === 'fr') return '\ud83c\uddeb\ud83c\uddf7';
  if (lang === 'ko') return '\ud83c\uddf0\ud83c\uddf7';
  return '\ud83c\udff3\ufe0f';
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
  const [copied, setCopied] = useState(false);

  const sportOn = Boolean(settings.sportMode);
  const flag = useMemo(() => flagFor(lang), [lang]);

  const runTowerTalk = useCallback(async () => {
    try {
      impactMedium();
      setState({ status: 'loading', error: null });
      setReply('');
      setTranslated('');
      setCopied(false);

      const res = await apiFetch('/api/tower-talk', {
        method: 'POST',
        timeout: 20000,
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
      notificationSuccess();
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
      notificationError();
    }
  }, [situation, customerName, vehicle]);

  const translateReply = useCallback(async () => {
    try {
      if (!reply.trim()) return;
      impactMedium();
      setState({ status: 'translating', error: null });
      const res = await apiFetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text: reply, source_lang: 'auto', target_lang: lang }),
      });
      setTranslated(res?.translated_text || '');
      setState({ status: 'done', error: null });
      notificationSuccess();
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
      notificationError();
    }
  }, [reply, lang]);

  const speak = useCallback(async (text, language) => {
    try {
      if (!text?.trim()) return;
      impactMedium();
      setState({ status: 'speaking', error: null });
      const res = await ttsSpeak({ text, language, voice: 'auto' });
      if (res?.audio_base64) {
        await playBase64Audio({ base64: res.audio_base64, format: res.format || 'mp3' });
      }
      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: String(e?.message || e) });
    }
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      selectionTap();
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // silently fail
    }
  }, []);

  const isLoading = state.status === 'loading' || state.status === 'translating' || state.status === 'speaking';

  // Pulsing glow for Generate button
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [glowAnim]);
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View style={styles.center}>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.headRow}>
                <View style={styles.titleRow}>
                  <View style={styles.titleDot} />
                  <Text style={styles.title}>TOWER TALK</Text>
                </View>
                <View style={styles.badgeRow}>
                  {sportOn && <Text style={styles.langBadge}>{flag}</Text>}
                  <Pressable onPress={onClose} style={styles.closeIcon}>
                    <Ionicons name="close" size={16} color={colors.textMute} />
                  </Pressable>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                <View style={{ height: 6 }} />

                <TextInput
                  value={situation}
                  onChangeText={setSituation}
                  placeholder="What's the situation? (e.g., customer asking about price, wants to think it over...)"
                  placeholderTextColor={colors.textMute}
                  style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.charCount}>{situation.length}/500</Text>

                <View style={{ height: 8 }} />

                <View style={styles.fieldRow}>
                  <TextInput
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="Customer name"
                    placeholderTextColor={colors.textMute}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    value={vehicle}
                    onChangeText={setVehicle}
                    placeholder="Vehicle"
                    placeholderTextColor={colors.textMute}
                    style={[styles.input, { flex: 1 }]}
                  />
                </View>

                <View style={{ height: 14 }} />

                <View style={styles.generateWrap}>
                  {/* Ambient gold glow behind button */}
                  <Animated.View style={[styles.generateGlow, { opacity: glowOpacity }]} />

                  <Pressable
                    onPress={runTowerTalk}
                    disabled={isLoading || !situation.trim()}
                    style={({ pressed }) => [(isLoading || !situation.trim() || pressed) && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                  >
                    <View style={styles.generateBtn}>
                      <LinearGradient
                        colors={['#F0D060', '#D6B25E', '#C49B30', '#A8841A']}
                        locations={[0, 0.3, 0.7, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                      />
                      {/* Glass highlight */}
                      <LinearGradient
                        colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'transparent']}
                        locations={[0, 0.4, 1]}
                        style={[StyleSheet.absoluteFill, { borderRadius: 16, height: '50%' }]}
                      />
                      {state.status === 'loading' ? (
                        <ActivityIndicator color="#0E0E0E" />
                      ) : (
                        <>
                          <Ionicons name="flash" size={17} color="#0E0E0E" />
                          <Text style={styles.generateBtnText}>GENERATE</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                </View>

                {state.error && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.red} />
                    <Text style={[styles.body, { color: colors.red, marginTop: 0, marginLeft: 6, flex: 1 }]}>{state.error}</Text>
                  </View>
                )}

                {reply ? (
                  <View style={styles.replySection}>
                    <View style={styles.replySectionHeader}>
                      <Text style={styles.sectionLabel}>RESPONSE</Text>
                      <View style={styles.replyActions}>
                        <Pressable onPress={() => copyToClipboard(reply)} style={styles.actionIcon}>
                          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.green : colors.textMute} />
                        </Pressable>
                        <Pressable onPress={() => speak(reply, 'en')} style={styles.actionIcon}>
                          <Ionicons name="volume-high-outline" size={16} color={colors.textMute} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.replyText}>{reply}</Text>

                    {sportOn && (
                      <>
                        <View style={{ height: 12 }} />
                        <Pressable
                          onPress={translateReply}
                          disabled={state.status === 'translating'}
                          style={({ pressed }) => [styles.translateBtn, (state.status === 'translating' || pressed) && { opacity: 0.8 }]}
                        >
                          {state.status === 'translating' ? (
                            <ActivityIndicator color={colors.gold} size="small" />
                          ) : (
                            <>
                              <Ionicons name="language" size={14} color={colors.gold} />
                              <Text style={styles.translateBtnText}>Translate {flag}</Text>
                            </>
                          )}
                        </Pressable>

                        {translated ? (
                          <View style={{ marginTop: 12 }}>
                            <View style={styles.replySectionHeader}>
                              <Text style={styles.sectionLabel}>TRANSLATION</Text>
                              <View style={styles.replyActions}>
                                <Pressable onPress={() => copyToClipboard(translated)} style={styles.actionIcon}>
                                  <Ionicons name="copy-outline" size={16} color={colors.textMute} />
                                </Pressable>
                                <Pressable onPress={() => speak(translated, lang)} style={styles.actionIcon}>
                                  <Ionicons name="volume-high-outline" size={16} color={colors.textMute} />
                                </Pressable>
                              </View>
                            </View>
                            <Text style={styles.replyText}>{translated}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '85%',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(10,12,16,0.96)',
    padding: 18,
    maxHeight: '100%',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    backgroundColor: colors.red,
  },
  title: {
    color: colors.text,
    ...type.label,
    fontSize: 13,
    letterSpacing: 2.0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBadge: {
    fontSize: 16,
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
  body: {
    marginTop: 6,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.30)',
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    marginTop: 4,
    color: colors.textMute,
    fontSize: 10,
    textAlign: 'right',
  },
  generateBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  generateBtnText: {
    color: '#0E0E0E',
    ...type.label,
    fontSize: 13,
  },
  errorRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replySection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  replySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 10,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  translateBtn: {
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.40)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  translateBtnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 11,
  },
});
