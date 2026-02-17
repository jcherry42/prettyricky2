import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Animated, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { scaleSize, scaleFont } from '../theme/layout';
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
  const [tradeVin, setTradeVin] = useState('');
  const [tradeMileage, setTradeMileage] = useState('');

  const [state, setState] = useState({ status: 'idle', error: null });
  const [reply, setReply] = useState('');
  const [translated, setTranslated] = useState('');
  const [copied, setCopied] = useState(false);

  const [selectedInquiry, setSelectedInquiry] = useState('new_lead');
  const [presetIndex, setPresetIndex] = useState(null);

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
          inquiryType: selectedInquiry,
          context: {
            customerName: customerName.trim() || undefined,
            vehicle: vehicle.trim() || undefined,
            tradeVin: tradeVin.trim() || undefined,
            tradeMileage: tradeMileage.trim() || undefined,
          },
        }),
      });

      if (!res || typeof res !== 'object') {
        throw new Error('Invalid response from Tower Talk API');
      }

      const responseText = res?.response || '';
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response received from Tower Talk');
      }

      setReply(responseText);
      setState({ status: 'done', error: null });
      notificationSuccess();
    } catch (e) {
      const errorMsg = e?.message || String(e) || 'Tower Talk request failed';
      setState({ status: 'error', error: errorMsg });
      notificationError();
      console.error('[TowerTalk] Error:', errorMsg);
    }
  }, [situation, customerName, vehicle, tradeVin, tradeMileage, selectedInquiry]);

  const translateReply = useCallback(async () => {
    try {
      if (!reply || !reply.trim()) {
        setState({ status: 'error', error: 'No text to translate' });
        return;
      }
      if (!lang || typeof lang !== 'string') {
        setState({ status: 'error', error: 'Invalid target language' });
        return;
      }
      
      impactMedium();
      setState({ status: 'translating', error: null });
      
      const res = await apiFetch('/api/translate', {
        method: 'POST',
        timeout: 15000,
        body: JSON.stringify({ 
          text: reply.trim(), 
          source_lang: 'auto', 
          target_lang: lang 
        }),
      });

      if (!res || typeof res !== 'object') {
        throw new Error('Invalid response from translation API');
      }

      const translatedText = res?.translated_text || '';
      if (!translatedText || translatedText.trim().length === 0) {
        throw new Error(`Translation to ${lang.toUpperCase()} returned empty result`);
      }

      setTranslated(translatedText);
      setState({ status: 'done', error: null });
      notificationSuccess();
    } catch (e) {
      const errorMsg = e?.message || String(e) || 'Translation failed';
      setState({ status: 'error', error: `Translation error: ${errorMsg}` });
      notificationError();
      console.error('[TowerTalk] Translation error:', errorMsg, 'Lang:', lang);
    }
  }, [reply, lang]);
const INQUIRY_TYPES = [
  { id: 'new_lead', label: 'New Lead', icon: 'star' },
  { id: 'price_question', label: 'Price', icon: 'dollar' },
  { id: 'availability', label: 'Avail', icon: 'calendar' },
  { id: 'trade_in', label: 'Trade', icon: 'repeat' },
  { id: 'financing', label: 'Finance', icon: 'card' },
  { id: 'test_drive', label: 'Test', icon: 'car' },
  { id: 'follow_up', label: 'Follow', icon: 'clock' },
  { id: 'objection', label: 'Obj', icon: 'chat' },
];

const PRESET_RESPONSES = {
  new_lead: [
    "I’ve got this vehicle here and it’s a strong choice. When can you swing by so we can walk it in person?",
    "The vehicle you asked about is available and worth a look in person. When does it make sense for you to come in?",
    "Let’s get you eyes on it. It’s easier to make a call when you’re here with the vehicle. What time works?",
  ],
  price_question: [
    "I’ll be straight with you on price and what you’re getting for it. When can you stop in so we can go over it line by line?",
    "Price is one part of the deal. When you’re here I can show you exactly where the value is and how we can structure it.",
    "If numbers are the concern, let’s sit down and make them make sense. When can you come by?",
  ],
  availability: [
    "Yes, it’s here and available. If you’re serious, I’d lock in a time to see it so you’re not chasing it after it’s gone.",
    "I’ve got it on the lot and ready. Photos don’t do it justice – worth a quick drive in.",
    "It’s here now. The only question is whether it fits you – and that happens when you’re behind the wheel.",
  ],
  trade_in: [
    "Bring your current vehicle in and I’ll put a real number on it, not a guess. That way you know exactly where you stand.",
    "Your trade has value. Let’s get eyes on it and make sure you’re not leaving money on the table.",
    "I’ve seen a lot of trades in this segment. I’ll be direct and fair when you bring it by.",
  ],
  financing: [
    "We work with strong lenders and I’ve seen approvals in all kinds of situations. Let’s sit down and find the right lane for you.",
    "Financing is usually the easiest part once we pick the right structure. Come in and we’ll lay it out in plain English.",
    "If you’re unsure about payments, let’s build a payment that fits you instead of guessing over text.",
  ],
  test_drive: [
    "The only way to know if it’s your car is to drive it. I’ll have it pulled up and ready when you get here.",
    "Let’s put you behind the wheel and see how it feels in real traffic, not just on paper.",
    "Give me a time that works and I’ll have the vehicle staged for you when you roll in.",
  ],
  follow_up: [
    "Just keeping this on your radar – the vehicle is still here and it’s a good one. Let me know what you’re thinking.",
    "I don’t like chasing people, but I also don’t like seeing good matches slip away. Where are you leaning?",
    "If you’re still on the fence, a quick look in person might give you the clarity you’re looking for.",
  ],
  objection: [
    "I hear the concern. Let’s walk through it together when you’re here – there’s usually a clean way forward.",
    "You’re not the first person to have that hesitation. I’ve helped a lot of people through the same thing.",
    "I’m not here to pressure you, I’m here to give you the full picture so you can decide with confidence.",
  ],
};


  const speak = useCallback(async (text, language) => {
    try {
      if (!text || !text.trim()) {
        console.warn('[TowerTalk] Speak called with empty text');
        return;
      }
      if (!language || typeof language !== 'string') {
        console.warn('[TowerTalk] Speak called with invalid language:', language);
        return;
      }
      
      impactMedium();
      setState({ status: 'speaking', error: null });
      
      const res = await ttsSpeak({ text: text.trim(), language, voice: 'auto' });
      
      if (!res || typeof res !== 'object') {
        throw new Error('Invalid TTS response');
      }
      
      if (res?.audio_base64) {
        await playBase64Audio({ base64: res.audio_base64, format: res.format || 'mp3' });
      } else {
        throw new Error('No audio data received from TTS');
      }
      
      setState({ status: 'done', error: null });
    } catch (e) {
      const errorMsg = e?.message || String(e) || 'Text-to-speech failed';
      setState({ status: 'error', error: `TTS error: ${errorMsg}` });
      console.error('[TowerTalk] TTS error:', errorMsg, 'Language:', language);
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

  const sendAsSms = useCallback(async (text) => {
    try {
      impactMedium();
      const smsUrl = `sms:?body=${encodeURIComponent(text)}`;
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        notificationSuccess();
      } else {
        Alert.alert('SMS Not Available', 'Unable to open SMS on this device');
      }
    } catch (e) {
      notificationError();
      Alert.alert('SMS Error', 'Failed to open SMS application');
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

                <View style={{ height: 8 }} />

                <View style={styles.fieldRow}>
                  <TextInput
                    value={tradeVin}
                    onChangeText={(t) => setTradeVin(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))}
                    placeholder="Trade-in VIN (17)"
                    placeholderTextColor={colors.textMute}
                    style={[styles.input, { flex: 1 }]}
                    autoCapitalize="characters"
                    maxLength={17}
                  />
                  <TextInput
                    value={tradeMileage}
                    onChangeText={(t) => setTradeMileage(t.replace(/[^0-9,]/g, ''))}
                    placeholder="Trade-in miles"
                    placeholderTextColor={colors.textMute}
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ height: 14 }} />

                <View style={styles.generateWrap}>
                  <Pressable
                    onPress={() => {
                      selectionTap();
                      runTowerTalk();
                    }}
                    disabled={isLoading || !situation.trim()}
                    style={({ pressed }) => [
                      styles.generateBtn,
                      pressed && !(isLoading || !situation.trim()) && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                      (isLoading || !situation.trim()) && { opacity: 0.55 },
                    ]}
                  >
                    <LinearGradient
                      colors={['#FFF5C7', '#FCD76D', '#F5AA1C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {state.status === 'loading' ? (
                      <ActivityIndicator color="#0E0E0E" />
                    ) : (
                      <Text style={styles.generateBtnText}>GENERATE</Text>
                    )}
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
                        <Pressable onPress={() => sendAsSms(reply)} style={styles.actionIcon}>
                          <Ionicons name="send" size={16} color={colors.gold} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.replyText}>{reply}</Text>

                    {sportOn && (
                      <>
                        <View style={{ height: 12 }} />

                        {/* Inquiry type selector */}
                        <View style={styles.inquiryBlock}>
                          <Text style={styles.inquiryLabel}>INQUIRY</Text>
                          <View style={styles.inquiryGrid}>
                            {INQUIRY_TYPES.map((it) => {
                              const active = selectedInquiry === it.id;
                              return (
                                <Pressable
                                  key={it.id}
                                  onPress={() => {
                                    selectionTap();
                                    setSelectedInquiry(it.id);
                                    setPresetIndex(null);
                                  }}
                                  style={({ pressed }) => [
                                    styles.inquiryPill,
                                    active && styles.inquiryPillActive,
                                    pressed && { opacity: 0.9 },
                                  ]}
                                >
                                  <LinearGradient
                                    colors={['rgba(251,191,36,0.35)', 'rgba(17,24,39,0.95)']}
                                    locations={[0, 1]}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                  />
                                  <View style={styles.inquiryInner}>
                                    <Ionicons
                                      name={
                                        it.icon === 'star'
                                          ? 'star'
                                          : it.icon === 'dollar'
                                          ? 'pricetag'
                                          : it.icon === 'calendar'
                                          ? 'calendar'
                                          : it.icon === 'repeat'
                                          ? 'repeat'
                                          : it.icon === 'card'
                                          ? 'card'
                                          : it.icon === 'car'
                                          ? 'car'
                                          : it.icon === 'clock'
                                          ? 'time'
                                          : 'chatbubble'
                                      }
                                      size={16}
                                      color={colors.text}
                                    />
                                    <Text style={styles.inquiryText}>{it.label}</Text>
                                  </View>
                                  <View style={styles.inquiryGlow} />
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* Preset responses */}
                          <View style={styles.presetsRow}>
                            {(PRESET_RESPONSES[selectedInquiry] || []).map((text, idx) => {
                              const active = presetIndex === idx;
                              return (
                                <Pressable
                                  key={idx}
                                  onPress={() => {
                                    selectionTap();
                                    setPresetIndex(idx);
                                    setReply(text);
                                    setTranslated('');
                                    setCopied(false);
                                  }}
                                  style={({ pressed }) => [
                                    styles.presetChip,
                                    active && styles.presetChipActive,
                                    pressed && { opacity: 0.9 },
                                  ]}
                                >
                                  <Text style={styles.presetText} numberOfLines={2}>
                                    {text}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
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
  generateWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  generateGlow: {
    position: 'absolute',
    top: -6,
    left: '10%',
    right: '10%',
    bottom: -6,
    borderRadius: 22,
    backgroundColor: 'rgba(214,178,94,0.25)',
    shadowColor: 'rgba(240,208,96,1)',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  generateBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    shadowColor: 'rgba(214,178,94,0.80)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  generateBtnText: {
    color: '#0E0E0E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
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
    color: colors.textDim,
    ...type.label,
    fontSize: 11,
  },
  inquiryBlock: {
    marginTop: 12,
  },
  inquiryLabel: {
    ...type.label,
    color: colors.textDim,
    fontSize: 11,
    marginBottom: 6,
  },
  inquiryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  inquiryPill: {
    width: '23%',
    aspectRatio: 1.8,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(15,12,8,0.96)',
  },
  inquiryPillActive: {
    borderColor: colors.gold,
    shadowColor: 'rgba(251,191,36,0.9)',
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  inquiryInner: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inquiryText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  inquiryGlow: {
    position: 'absolute',
    width: '120%',
    height: '140%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: 'rgba(251,191,36,0.55)',
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  presetsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  presetChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  presetText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
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
  presetsContainer: {
    marginTop: 0,
  },
  presetNumber: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(214,178,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  presetNumberText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '800',
  },
});
