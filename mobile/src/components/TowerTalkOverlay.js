import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TextInput, View,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Animated, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { scaleSize, scaleFont } from '../theme/layout';
import { apiFetch } from '../lib/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { ttsSpeak } from '../lib/tts';
import { playBase64Audio } from '../lib/audioPlayback';
import { impactMedium, notificationSuccess, notificationError, selectionTap, impactLight, impactHeavy } from '../lib/haptics';
import { flagFor } from '../utils/language';
import { sendTowerTalkSms } from '../lib/sms';
import { voiceTranslateUpload } from '../lib/voiceTranslate';

function friendlyBackendError(e) {
  if (e?.code === 'BACKEND_URL_MISSING') {
    return 'Backend not configured. Open Command Center → Settings → Backend and set your backend URL.';
  }
  const msg = e?.message || String(e) || 'Request failed';
  if (typeof msg === 'string' && msg.includes('EXPO_PUBLIC_BACKEND_URL')) {
    return 'Backend not configured. Open Command Center → Settings → Backend and set your backend URL.';
  }
  return msg;
}

const INQUIRY_TYPES = [
  { id: 'new_lead',       label: 'New Lead',  icon: 'star' },
  { id: 'price_question', label: 'Price',     icon: 'pricetag' },
  { id: 'availability',   label: 'Avail',     icon: 'calendar' },
  { id: 'trade_in',       label: 'Trade',     icon: 'repeat' },
  { id: 'financing',      label: 'Finance',   icon: 'card' },
  { id: 'test_drive',     label: 'Test',      icon: 'car' },
  { id: 'follow_up',      label: 'Follow',    icon: 'time' },
  { id: 'objection',      label: 'Obj',       icon: 'chatbubble' },
];

const PRESET_RESPONSES = {
  new_lead: [
    "I've got this vehicle here and it's a strong choice. When can you swing by so we can walk it in person?",
    "The vehicle you asked about is available and worth a look in person. When does it make sense for you to come in?",
    "Let's get you eyes on it. It's easier to make a call when you're here with the vehicle. What time works?",
  ],
  price_question: [
    "I'll be straight with you on price and what you're getting for it. When can you stop in so we can go over it line by line?",
    "Price is one part of the deal. When you're here I can show you exactly where the value is and how we can structure it.",
    "If numbers are the concern, let's sit down and make them make sense. When can you come by?",
  ],
  availability: [
    "Yes, it's here and available. If you're serious, I'd lock in a time to see it so you're not chasing it after it's gone.",
    "I've got it on the lot and ready. Photos don't do it justice — worth a quick drive in.",
    "It's here now. The only question is whether it fits you — and that happens when you're behind the wheel.",
  ],
  trade_in: [
    "Bring your current vehicle in and I'll put a real number on it, not a guess. That way you know exactly where you stand.",
    "Your trade has value. Let's get eyes on it and make sure you're not leaving money on the table.",
    "I've seen a lot of trades in this segment. I'll be direct and fair when you bring it by.",
  ],
  financing: [
    "We work with strong lenders and I've seen approvals in all kinds of situations. Let's sit down and find the right lane for you.",
    "Financing is usually the easiest part once we pick the right structure. Come in and we'll lay it out in plain English.",
    "If you're unsure about payments, let's build a payment that fits you instead of guessing over text.",
  ],
  test_drive: [
    "The only way to know if it's your car is to drive it. I'll have it pulled up and ready when you get here.",
    "Let's put you behind the wheel and see how it feels in real traffic, not just on paper.",
    "Give me a time that works and I'll have the vehicle staged for you when you roll in.",
  ],
  follow_up: [
    "Just keeping this on your radar — the vehicle is still here and it's a good one. Let me know what you're thinking.",
    "I don't like chasing people, but I also don't like seeing good matches slip away. Where are you leaning?",
    "If you're still on the fence, a quick look in person might give you the clarity you're looking for.",
  ],
  objection: [
    "I hear the concern. Let's walk through it together when you're here — there's usually a clean way forward.",
    "You're not the first person to have that hesitation. I've helped a lot of people through the same thing.",
    "I'm not here to pressure you, I'm here to give you the full picture so you can decide with confidence.",
  ],
};

// Animated waveform bars during voice recording
function VoiceWaveform() {
  // MUST NOT use useRef inside Array.from — create refs individually
  const barsRef = useRef(null);
  if (!barsRef.current) {
    barsRef.current = Array.from({ length: 5 }, () => new Animated.Value(0.3));
  }
  const bars = barsRef.current;

  useEffect(() => {
    const animations = bars.map((anim, i) => {
      const delay = i * 80;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.6, duration: 200, useNativeDriver: true }),
        ])
      );
    });
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.waveformWrap}>
      {bars.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            { transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
}

export function TowerTalkOverlay({ visible, onClose, onOpenSettings }) {
  const { settings } = useAppSettings();
  const lang = settings.defaultTargetLanguage;
  const sportOn = Boolean(settings.sportMode);
  const flag = flagFor(lang);

  const [situation, setSituation] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [tradeVin, setTradeVin] = useState('');
  const [tradeMileage, setTradeMileage] = useState('');

  const [state, setState] = useState({ status: 'idle', error: null });
  const [reply, setReply] = useState('');
  const [displayedReply, setDisplayedReply] = useState('');
  const autoTranslateRef = useRef(null);
  const [translated, setTranslated] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);

  const [selectedInquiry, setSelectedInquiry] = useState('new_lead');
  const [presetIndex, setPresetIndex] = useState(null);

  // Voice dictation state
  const [isDictating, setIsDictating] = useState(false);
  const [dictationStatus, setDictationStatus] = useState('idle'); // idle | requesting | recording | processing
  const recordingRef = useRef(null);
  const dictationTimeoutRef = useRef(null);

  // Refs for keyboard focus chaining
  const vehicleRef = useRef(null);
  const tradeVinRef = useRef(null);
  const tradeMileageRef = useRef(null);

  // Typewriter effect for AI response
  useEffect(() => {
    if (!reply) {
      setDisplayedReply('');
      return;
    }
    let index = 0;
    setDisplayedReply('');
    const interval = setInterval(() => {
      index++;
      if (index >= reply.length) {
        setDisplayedReply(reply);
        clearInterval(interval);
      } else {
        setDisplayedReply(reply.slice(0, index));
      }
    }, 12);
    return () => clearInterval(interval);
  }, [reply]);

  // === Voice Dictation for Situation Field ===
  const startDictation = useCallback(async () => {
    try {
      impactMedium();
      setDictationStatus('requesting');
      setIsDictating(true);

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setDictationStatus('idle');
        setIsDictating(false);
        Alert.alert('Microphone Required', "Enable microphone access in Settings → Supercharg'd → Microphone");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setDictationStatus('recording');

      // Auto-stop after 12 seconds
      dictationTimeoutRef.current = setTimeout(() => stopDictation(), 12000);
    } catch (e) {
      setDictationStatus('idle');
      setIsDictating(false);
    }
  }, []);

  const stopDictation = useCallback(async () => {
    if (dictationTimeoutRef.current) {
      clearTimeout(dictationTimeoutRef.current);
      dictationTimeoutRef.current = null;
    }
    const rec = recordingRef.current;
    if (!rec) {
      setDictationStatus('idle');
      setIsDictating(false);
      return;
    }
    recordingRef.current = null;

    try {
      setDictationStatus('processing');
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});

      if (!uri) throw new Error('No audio recorded');

      const out = await voiceTranslateUpload({ uri, sourceLang: 'en', targetLang: 'en', mimeType: 'audio/m4a' });
      const transcript = out?.transcript || out?.translated_text || '';
      if (transcript && transcript.trim()) {
        setSituation(prev => {
          const base = prev.trim();
          return base ? `${base} ${transcript.trim()}` : transcript.trim();
        });
        impactLight();
      }
    } catch (e) {
      // silently fail — don't disrupt UX
    } finally {
      setDictationStatus('idle');
      setIsDictating(false);
    }
  }, []);

  const runTowerTalk = useCallback(async () => {
    try {
      impactMedium();
      setState({ status: 'loading', error: null });
      setReply('');
      setDisplayedReply('');
      setTranslated('');
      setCopied(false);
      setCopiedTranslation(false);

      const res = await apiFetch('/api/tower-talk', {
        method: 'POST',
        timeout: 25000,
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

      // Auto-translate when SPORT mode is active
      if (sportOn && lang) {
        autoTranslateRef.current = responseText;
      }
    } catch (e) {
      const errorMsg = friendlyBackendError(e);
      setState({ status: 'error', error: errorMsg });
      notificationError();
    }
  }, [situation, customerName, vehicle, tradeVin, tradeMileage, selectedInquiry, sportOn, lang]);

  // Auto-translate when SPORT mode triggers
  useEffect(() => {
    if (autoTranslateRef.current && sportOn) {
      const text = autoTranslateRef.current;
      autoTranslateRef.current = null;
      const timer = setTimeout(() => translateReply(), 600);
      return () => clearTimeout(timer);
    }
  }, [reply, sportOn]);

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
        timeout: 20000,
        body: JSON.stringify({ text: reply.trim(), source_lang: 'en', target_lang: lang }),
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
      const errorMsg = friendlyBackendError(e);
      setState({ status: 'error', error: `Translation error: ${errorMsg}` });
      notificationError();
    }
  }, [reply, lang]);

  const translateAndSpeak = useCallback(async () => {
    try {
      if (!reply || !reply.trim()) return;
      if (!lang || typeof lang !== 'string') return;

      impactMedium();
      setState({ status: 'translating', error: null });

      const res = await apiFetch('/api/translate', {
        method: 'POST',
        timeout: 20000,
        body: JSON.stringify({ text: reply.trim(), source_lang: 'en', target_lang: lang }),
      });

      const translatedText = res?.translated_text || '';
      if (!translatedText?.trim()) throw new Error('Translation returned empty');

      setTranslated(translatedText);
      setState({ status: 'speaking', error: null });

      const ttsRes = await ttsSpeak({ text: translatedText.trim(), language: lang, voice: 'auto' });
      if (ttsRes?.audio_base64) {
        await playBase64Audio({ base64: ttsRes.audio_base64, format: ttsRes.format || 'mp3' });
      }

      setState({ status: 'done', error: null });
    } catch (e) {
      setState({ status: 'error', error: `Translate & Speak error: ${friendlyBackendError(e)}` });
    }
  }, [reply, lang]);

  const speak = useCallback(async (text, language) => {
    try {
      if (!text || !text.trim()) return;
      if (!language || typeof language !== 'string') return;

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
      const errorMsg = friendlyBackendError(e);
      setState({ status: 'error', error: `TTS error: ${errorMsg}` });
    }
  }, []);

  const copyToClipboard = useCallback(async (text, type = 'reply') => {
    try {
      await Clipboard.setStringAsync(text);
      selectionTap();
      if (type === 'reply') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedTranslation(true);
        setTimeout(() => setCopiedTranslation(false), 2000);
      }
    } catch (e) {
      // silently fail
    }
  }, []);

  const sendAsSms = useCallback(async (text) => {
    try {
      impactMedium();
      const result = await sendTowerTalkSms(text);
      if (result.success) {
        notificationSuccess();
      } else if (!result.cancelled && result.error) {
        notificationError();
        Alert.alert('SMS Error', result.error);
      }
    } catch (e) {
      notificationError();
      Alert.alert('SMS Error', 'Failed to open SMS composer');
    }
  }, []);

  const isLoading = state.status === 'loading' || state.status === 'translating' || state.status === 'speaking';
  const showBackendError = state.error && (
    state.error.includes('Backend not configured') || state.error.includes('EXPO_PUBLIC_BACKEND_URL')
  );

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View style={styles.center}>
            <View style={styles.card}>
              {/* Brushed aluminum top highlight */}
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.00)']}
                style={styles.cardTopHighlight}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
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

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                <View style={{ height: 6 }} />

                {/* Inquiry Type Selector */}
                <View style={styles.inquiryBlock}>
                  <Text style={styles.sectionLabel}>INQUIRY TYPE</Text>
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
                            setReply('');
                            setDisplayedReply('');
                            setTranslated('');
                          }}
                          style={({ pressed }) => [
                            styles.inquiryPill,
                            active && styles.inquiryPillActive,
                            pressed && { opacity: 0.9 },
                          ]}
                        >
                          {active && (
                            <LinearGradient
                              colors={['rgba(214,178,94,0.22)', 'rgba(17,24,39,0.98)']}
                              locations={[0, 1]}
                              style={StyleSheet.absoluteFill}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            />
                          )}
                          <View style={styles.inquiryInner}>
                            <Ionicons
                              name={it.icon}
                              size={15}
                              color={active ? colors.gold : colors.textMute}
                            />
                            <Text style={[styles.inquiryText, active && { color: colors.gold }]}>
                              {it.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ height: 14 }} />

                {/* Preset Chips */}
                <View>
                  <Text style={styles.sectionLabel}>QUICK RESPONSES</Text>
                  <View style={{ height: 8 }} />
                  {(PRESET_RESPONSES[selectedInquiry] || []).map((text, idx) => {
                    const active = presetIndex === idx;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => {
                          selectionTap();
                          setPresetIndex(idx);
                          setReply(text);
                          setDisplayedReply(text);
                          setTranslated('');
                          setCopied(false);
                        }}
                        style={({ pressed }) => [
                          styles.presetChip,
                          active && styles.presetChipActive,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        <View style={styles.presetLeft}>
                          <View style={[styles.presetNum, active && styles.presetNumActive]}>
                            <Text style={[styles.presetNumText, active && { color: colors.gold }]}>{idx + 1}</Text>
                          </View>
                        </View>
                        <Text style={[styles.presetText, active && { color: colors.text }]} numberOfLines={3}>
                          {text}
                        </Text>
                        {active && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.gold} style={{ marginLeft: 8 }} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ height: 18 }} />

                {/* Situation input with voice dictation */}
                <Text style={styles.sectionLabel}>SITUATION</Text>
                <View style={{ height: 8 }} />
                <View style={styles.situationWrap}>
                  <TextInput
                    value={situation}
                    onChangeText={setSituation}
                    placeholder={isDictating ? 'Listening...' : "What's the situation? Describe it or tap the mic..."}
                    placeholderTextColor={isDictating ? '#9333EA' : colors.textMute}
                    style={[styles.situationInput, isDictating && styles.situationInputDictating]}
                    multiline
                    maxLength={600}
                    autoCorrect
                    spellCheck
                    keyboardType="default"
                    textAlignVertical="top"
                    editable={!isDictating}
                  />
                  <View style={styles.situationBottom}>
                    <Text style={styles.charCount}>{situation.length}/600</Text>
                    <Pressable
                      onPress={isDictating && dictationStatus === 'recording' ? stopDictation : startDictation}
                      disabled={dictationStatus === 'processing'}
                      style={({ pressed }) => [
                        styles.micBtn,
                        isDictating && styles.micBtnActive,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                        dictationStatus === 'processing' && { opacity: 0.6 },
                      ]}
                    >
                      {dictationStatus === 'processing' ? (
                        <ActivityIndicator color="#9333EA" size="small" />
                      ) : dictationStatus === 'recording' ? (
                        <VoiceWaveform />
                      ) : (
                        <Ionicons
                          name={isDictating ? 'stop-circle' : 'mic'}
                          size={18}
                          color={isDictating ? '#EF4444' : '#9333EA'}
                        />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View style={{ height: 12 }} />

                {/* Context fields — minimal, no box-within-box */}
                <Text style={styles.sectionLabel}>CONTEXT (OPTIONAL)</Text>
                <View style={{ height: 8 }} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>CUSTOMER</Text>
                    <TextInput
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="Name"
                      placeholderTextColor={colors.textMute}
                      style={styles.fieldInput}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      textContentType="name"
                      onSubmitEditing={() => vehicleRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>VEHICLE</Text>
                    <TextInput
                      ref={vehicleRef}
                      value={vehicle}
                      onChangeText={setVehicle}
                      placeholder="Year / Make / Model"
                      placeholderTextColor={colors.textMute}
                      style={styles.fieldInput}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => tradeVinRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                <View style={{ height: 10 }} />

                <View style={styles.fieldRow}>
                  <View style={[styles.fieldWrap, { flex: 1.4 }]}>
                    <Text style={styles.fieldLabel}>TRADE-IN VIN</Text>
                    <TextInput
                      ref={tradeVinRef}
                      value={tradeVin}
                      onChangeText={(t) => setTradeVin(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))}
                      placeholder="17 characters"
                      placeholderTextColor={colors.textMute}
                      style={styles.fieldInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={17}
                      returnKeyType="next"
                      keyboardType="default"
                      onSubmitEditing={() => tradeMileageRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>MILEAGE</Text>
                    <TextInput
                      ref={tradeMileageRef}
                      value={tradeMileage}
                      onChangeText={(t) => setTradeMileage(t.replace(/[^0-9,]/g, ''))}
                      placeholder="Miles"
                      placeholderTextColor={colors.textMute}
                      style={styles.fieldInput}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <View style={{ height: 18 }} />

                {/* Generate button */}
                <Pressable
                  onPress={() => { selectionTap(); runTowerTalk(); }}
                  disabled={isLoading || !situation.trim()}
                  style={({ pressed }) => [
                    styles.generateBtn,
                    pressed && !(isLoading || !situation.trim()) && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                    (isLoading || !situation.trim()) && { opacity: 0.48 },
                  ]}
                >
                  <LinearGradient
                    colors={['#FFF5C7', '#FCD76D', '#F5AA1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {state.status === 'loading' ? (
                    <>
                      <ActivityIndicator color="#0E0E0E" />
                      <Text style={styles.generateBtnText}>GENERATING...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#0E0E0E" />
                      <Text style={styles.generateBtnText}>GENERATE AI RESPONSE</Text>
                    </>
                  )}
                </Pressable>

                {/* Error display */}
                {state.error ? (
                  <View style={styles.errorBlock}>
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color={colors.red} />
                      <Text style={styles.errorText}>{state.error}</Text>
                    </View>
                    {showBackendError && (
                      <Pressable
                        onPress={() => { selectionTap(); onOpenSettings?.(); }}
                        style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
                        accessibilityRole="button"
                        accessibilityLabel="Open backend settings"
                      >
                        <LinearGradient
                          colors={['#B75CFF', '#7C3AED', '#3B1AA6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <Ionicons name="settings" size={16} color="#F0E8FF" />
                        <Text style={styles.settingsBtnText}>OPEN SETTINGS</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {/* Translating / Speaking state indicator */}
                {(state.status === 'translating' || state.status === 'speaking') && (
                  <View style={styles.statusRow}>
                    <ActivityIndicator color={colors.gold} size="small" />
                    <Text style={styles.statusText}>
                      {state.status === 'translating' ? `Translating to ${flag}...` : `Speaking ${flag}...`}
                    </Text>
                  </View>
                )}

                {/* Reply section */}
                {displayedReply ? (
                  <View style={styles.replySection}>
                    {/* Reply header */}
                    <View style={styles.replySectionHeader}>
                      <Text style={styles.sectionLabel}>AI RESPONSE</Text>
                      <View style={styles.replyActions}>
                        <Pressable
                          onPress={() => copyToClipboard(reply, 'reply')}
                          style={styles.actionIcon}
                          accessibilityLabel="Copy response"
                        >
                          <Ionicons
                            name={copied ? 'checkmark' : 'copy-outline'}
                            size={16}
                            color={copied ? colors.green : colors.textDim}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => speak(reply, 'en')}
                          disabled={state.status === 'speaking'}
                          style={styles.actionIcon}
                          accessibilityLabel="Speak in English"
                        >
                          <Ionicons name="volume-high-outline" size={16} color={colors.textDim} />
                        </Pressable>
                        <Pressable
                          onPress={() => sendAsSms(reply)}
                          style={styles.actionIconGold}
                          accessibilityLabel="Send as SMS"
                        >
                          <Ionicons name="send" size={15} color={colors.gold} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.replyText}>{displayedReply}</Text>

                    {/* Translation area */}
                    <View style={{ height: 12 }} />
                    <View style={styles.translateActions}>
                      <Pressable
                        onPress={translateReply}
                        disabled={state.status === 'translating' || state.status === 'speaking'}
                        style={({ pressed }) => [
                          styles.translateBtn,
                          sportOn && styles.translateBtnSport,
                          (state.status === 'translating' || pressed) && { opacity: 0.8 },
                        ]}
                      >
                        <Ionicons name="language" size={14} color={colors.gold} />
                        <Text style={styles.translateBtnText}>
                          {`Translate ${flag}`}
                        </Text>
                      </Pressable>

                      {sportOn && lang && (
                        <Pressable
                          onPress={translateAndSpeak}
                          disabled={state.status === 'translating' || state.status === 'speaking'}
                          style={({ pressed }) => [
                            styles.translateSpeakBtn,
                            (state.status === 'translating' || state.status === 'speaking' || pressed) && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="flame" size={13} color="#FF5000" />
                          <Ionicons name="volume-high-outline" size={14} color={colors.gold} />
                          <Text style={styles.translateBtnText}>Translate & Speak</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Translation result */}
                    {translated ? (
                      <View style={styles.translationResult}>
                        <View style={styles.replySectionHeader}>
                          <Text style={styles.sectionLabel}>
                            {`${lang.toUpperCase()} ${flag}`}
                          </Text>
                          <View style={styles.replyActions}>
                            <Pressable
                              onPress={() => copyToClipboard(translated, 'translation')}
                              style={styles.actionIcon}
                              accessibilityLabel="Copy translation"
                            >
                              <Ionicons
                                name={copiedTranslation ? 'checkmark' : 'copy-outline'}
                                size={16}
                                color={copiedTranslation ? colors.green : colors.textDim}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => speak(translated, lang)}
                              disabled={state.status === 'speaking'}
                              style={styles.actionIcon}
                              accessibilityLabel="Speak translation"
                            >
                              <Ionicons name="volume-high-outline" size={16} color={colors.textDim} />
                            </Pressable>
                            <Pressable
                              onPress={() => sendAsSms(translated)}
                              style={styles.actionIconGold}
                              accessibilityLabel="Send translation as SMS"
                            >
                              <Ionicons name="send" size={15} color={colors.gold} />
                            </Pressable>
                          </View>
                        </View>
                        <Text style={[styles.replyText, { color: colors.gold }]}>{translated}</Text>
                      </View>
                    ) : null}
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

// ============================================================
// STYLES — brushed aluminum premium finish, no box-within-box
// ============================================================
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '92%',
    maxHeight: '90%',
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(9,11,15,0.98)',
    padding: 18,
    maxHeight: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.70,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
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
    marginBottom: 10,
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
    shadowColor: colors.red,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: colors.text,
    ...type.label,
    fontSize: 13,
    letterSpacing: 2.4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBadge: {
    fontSize: 18,
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

  // Section label
  sectionLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },

  // Inquiry pills
  inquiryBlock: {},
  inquiryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 7,
    marginTop: 8,
  },
  inquiryPill: {
    width: '23.5%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12,14,18,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inquiryPillActive: {
    borderColor: colors.gold,
    shadowColor: 'rgba(214,178,94,0.70)',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  inquiryInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  inquiryText: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Preset chips — full-width rows
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(10,12,16,0.90)',
  },
  presetChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
  presetLeft: {
    marginRight: 10,
  },
  presetNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetNumActive: {
    backgroundColor: 'rgba(214,178,94,0.20)',
  },
  presetNumText: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '900',
  },
  presetText: {
    flex: 1,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Situation input — NO box-within-box
  situationWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  situationInput: {
    height: 88,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    textAlignVertical: 'top',
  },
  situationInputDictating: {
    color: '#C084FC',
  },
  situationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  charCount: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '600',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.35)',
    backgroundColor: 'rgba(147,51,234,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    borderColor: 'rgba(239,68,68,0.60)',
    backgroundColor: 'rgba(239,68,68,0.12)',
    shadowColor: '#EF4444',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  // Voice waveform
  waveformWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  waveformBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },

  // Context fields — minimal, elegant, no nested borders
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  fieldInput: {
    height: 32,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 0,
  },

  // Generate button
  generateBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    shadowColor: 'rgba(246,178,46,0.70)',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  generateBtnText: {
    color: '#0E0E0E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },

  // Error
  errorBlock: {
    marginTop: 12,
    gap: 10,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  settingsBtn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(183,92,255,0.55)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#B75CFF',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  settingsBtnText: {
    color: '#F0E8FF',
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.0,
  },

  // Status row (translating / speaking)
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  statusText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Reply section
  replySection: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(8,10,14,0.80)',
  },
  replySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  actionIconGold: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
  replyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },

  // Translation buttons
  translateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  translateBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.35)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  translateBtnSport: {
    borderColor: 'rgba(255,80,0,0.40)',
    backgroundColor: 'rgba(255,80,0,0.08)',
  },
  translateSpeakBtn: {
    flex: 1.2,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.40)',
    backgroundColor: 'rgba(255,80,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  translateBtnText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Translation result block
  translationResult: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
});
