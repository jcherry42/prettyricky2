import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TextInput, View,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Animated, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // 404 most commonly means a stale or missing backend URL.
  // Guide the user to the settings panel instead of showing a raw error.
  if (e?.status === 404) {
    return 'Endpoint not found (404). Your backend URL may be stale. Open Command Center → Settings → Backend, tap Reset, then try again. If the issue persists, run npx expo start --clear.';
  }
  return msg;
}

const INQUIRY_TYPES = [
  { id: 'new_lead',           label: 'New Lead',  icon: 'star' },
  { id: 'price_question',     label: 'Price',     icon: 'pricetag' },
  { id: 'availability',       label: 'In Stock',    icon: 'calendar' },
  { id: 'trade_in',           label: 'Trade',     icon: 'repeat' },
  { id: 'financing',          label: 'Finance',   icon: 'card' },
  { id: 'test_drive',         label: 'Drive',       icon: 'car' },
  { id: 'follow_up',          label: 'Follow Up',  icon: 'time' },
  { id: 'objection',          label: 'Objections', icon: 'chatbubble' },
  { id: 'appointment_setting', label: 'Appt',     icon: 'location' },
];

const PRESET_RESPONSES = {
  new_lead: [
    "I pulled this one aside for you because it checks every box you mentioned. I've got a 2:00 and a 4:30 open today — which one works better for your schedule?",
    "This is the one people keep asking about, and I can see why you reached out. Let me get it detailed and staged for you — can you swing by this afternoon or would tomorrow morning be better?",
    "I want you to see this vehicle in person because the photos don't capture it. Give me 20 minutes of your time and you'll know if it's the one. I'm here until 7 tonight.",
  ],
  price_question: [
    "I'll give you the straight numbers, no games. But price is only one piece — when you come in, I'll show you the total value picture including what you're getting that the other guys leave out. I've got time at 3 today.",
    "Great question on price. I've structured deals on this exact model that surprised people in the best way. Let me show you what I can do when we sit down — are you free this afternoon or tomorrow?",
    "Numbers make more sense face to face where I can break down every line. I'll have the full cost sheet printed and ready for you — what time can you stop by?",
  ],
  availability: [
    "It's on the lot right now, detailed and ready. I've had two other inquiries on this exact one this week, so if you're serious, let's lock in a time. I can hold it until tomorrow at noon — morning or afternoon?",
    "Yes, it's here and it's not going to last. I'll have it pulled up front with the keys in it when you arrive. Can you make it today between 2 and 5?",
    "It's available and I want you to be the one who drives it home. I'm carving out time specifically for you — does today or tomorrow work better?",
  ],
  trade_in: [
    "Bring it by and I'll have a real number for you in under 10 minutes — no guessing, no games. Once you know your trade value, the rest of the math gets easy. When can you come in?",
    "Your trade is the key to unlocking this deal. I've been watching the market on your model and values are holding strong right now. Let me put eyes on it — I've got time today at 2 or 4.",
    "I'll give you a transparent, data-backed appraisal that you can take to any dealer and compare. No pressure, just the real number. Can you swing by this week?",
  ],
  financing: [
    "I work with over 30 lenders and I've put deals together for every credit situation imaginable. Let me run a quick soft pull — zero impact on your score — and I'll tell you exactly what we're working with. Can you come by today?",
    "Payments are the easiest part once we find the right structure. I've got 4 or 5 different ways to build this that most people don't know about. Let's sit down and I'll lay them all out — are you free this afternoon?",
    "Don't let the numbers scare you over text. When we sit down, I'll show you options that actually work for your budget. I'm here until 7 — pick a time and I'll have everything prepped.",
  ],
  test_drive: [
    "This is the best sign — you're ready to feel it. I'll have it detailed, fueled, and staged just for you when you get here. Give me a time and it's yours for a real drive, not a parking lot loop.",
    "Let me put you behind the wheel on real roads so you can feel the difference. I've got the keys and I'll ride along to show you features most people miss. What time works — I've got slots at 2 and 4:30?",
    "Nothing replaces seat time. Come take it for 20 minutes and you'll know everything you need to know. I'm blocking out time for you — today or tomorrow?",
  ],
  follow_up: [
    "Quick update — I found a couple more options that match exactly what you described, and one just came in this morning. Worth a quick look before someone else grabs it. When can you swing by?",
    "I just got word on a new incentive from the manufacturer that drops the payment by about $40 a month on the vehicle you liked. I wanted you to know before I open it up to the floor. Can we connect this week?",
    "Market conditions have shifted since we last spoke — I'm seeing better trade values and lower rates than a few weeks ago. If the timing wasn't right before, it might be now. Want me to run fresh numbers for you?",
  ],
  objection: [
    "I hear you, and that's a fair concern. Let me ask you this — if we could solve that one thing, would you be ready to move forward? Because I've got a couple ways to make it work. Let's sit down at 3 or 4:30.",
    "You're not the first smart buyer to raise that point, and every one of them was glad they came in to hear the full picture. Give me 15 minutes and I'll show you exactly how we handle this. When works?",
    "I respect the honesty. The best decisions come from having all the information, and I don't think you have it all yet. Let me fill in the gaps — I've got time today. What works for you?",
  ],
  appointment_setting: [
    "I've got the vehicle pulled aside and staged just for you. I have a 2:00 and a 4:30 open today — which one works better? I'll also have a complimentary trade appraisal ready when you arrive.",
    "No commitment, no pressure — I just want you to experience this vehicle in person because photos can't capture it. Give me 20 minutes and you'll know if it's right. I've got a slot at 10 AM tomorrow — sound good?",
    "I'm carving out time specifically for you so there's zero wait and zero pressure. I'll have everything prepped — the vehicle, your trade numbers, payment options. Can you make it today between 3 and 5?",
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
  const insets = useSafeAreaInsets();

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
        Platform.OS === 'web'
          ? Audio.RecordingOptionsPresets.HIGH_QUALITY
          : {
              isMeteringEnabled: true,
              android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
              ios: { extension: '.m4a', outputFormat: 'aac', audioQuality: 127, sampleRate: 44100, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
              web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
            }
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

      const ext = Platform.OS === 'web' ? 'webm' : 'm4a';
      const mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      const out = await voiceTranslateUpload({ uri, sourceLang: 'en', targetLang: 'en', mimeType: mime, fileExtension: ext });
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
      autoTranslateRef.current = null;
      translateReply();
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
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
                            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                          ]}
                        >
                          {/* Glass base */}
                          <View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: 'rgba(20,24,32,0.80)' }]} />
                          <LinearGradient
                            colors={active
                              ? ['rgba(214,178,94,0.28)', 'rgba(214,178,94,0.06)', 'rgba(0,0,0,0.18)']
                              : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.12)']
                            }
                            locations={[0, 0.45, 1]}
                            style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                            start={{ x: 0.1, y: 0 }}
                            end={{ x: 0.9, y: 1 }}
                          />
                          {/* Specular */}
                          <View style={{ position: 'absolute', top: 3, left: '22%', right: '22%', height: 4, borderRadius: 2, backgroundColor: active ? 'rgba(214,178,94,0.16)' : 'rgba(255,255,255,0.12)' }} />
                          <View style={styles.inquiryInner}>
                            <Ionicons
                              name={it.icon as any}
                              size={15}
                              color={active ? colors.gold : colors.textMute}
                              style={active ? { textShadowColor: 'rgba(214,178,94,0.60)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } } : undefined}
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
    columnGap: 0,
    marginTop: 8,
  },
  inquiryPill: {
    width: '31.5%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,14,20,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  inquiryPillActive: {
    borderColor: 'rgba(214,178,94,0.70)',
    shadowColor: 'rgba(214,178,94,0.50)',
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
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
    borderColor: 'rgba(214,178,94,0.04)',
    backgroundColor: 'rgba(6,8,12,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  presetChipActive: {
    borderColor: 'rgba(214,178,94,0.50)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    shadowColor: 'rgba(214,178,94,0.30)',
    shadowOpacity: 0.5,
    shadowRadius: 10,
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
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.65)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
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
    borderColor: 'rgba(214,178,94,0.05)',
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    shadowColor: 'rgba(214,178,94,0.70)',
    shadowOpacity: 0.65,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
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
    borderColor: 'rgba(214,178,94,0.08)',
    backgroundColor: 'rgba(6,8,12,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
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
