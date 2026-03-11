/**
 * Emergency Inquiry Modal
 * 10 inquiry types with 3 pre-written responses each.
 * Responses aligned with Tower Talk's confident, assertive sales temperament.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { sendSms } from '../lib/sms';
import { useAppSettings } from '../context/AppSettingsContext';
import { flagFor, langName } from '../utils/language';
import { apiFetch } from '../lib/api';
import { ttsSpeak } from '../lib/tts';
import { playBase64Audio } from '../lib/audioPlayback';
import * as Clipboard from 'expo-clipboard';

const INQUIRY_TYPES = [
  {
    id: 'price_objection',
    icon: 'cash-outline',
    label: 'PRICE OBJECTION',
    color: '#FF4444',
    responses: [
      "I hear you on price. But let me ask you this — if the price were right, is this the vehicle you'd want to drive home today? Because I've got 4 or 5 ways to structure this that most people don't know about. Let me show you.",
      "I respect that. Here's what I want you to see — break this down to a daily cost and it's less than what most people spend on lunch. Let me show you the full value picture, because sticker price is only one piece of the puzzle.",
      "That's a fair concern. But you're not just buying a vehicle — you're buying 5 years of safety, technology, and a resale value that beats everything else in this segment. Give me 10 minutes to walk you through the total cost of ownership. You'll see it differently.",
    ],
  },
  {
    id: 'trade_in',
    icon: 'swap-horizontal-outline',
    label: 'TRADE-IN',
    color: '#FFD700',
    responses: [
      "Your trade is the key to making this deal work. I'll have a real, data-backed number for you in under 10 minutes — no guessing, no games. Once you know your trade value, the rest of the math gets easy. When can you bring it by?",
      "Trade-in values on your model are holding strong right now, but they won't forever. Let me pull up the exact market data and show you where yours sits compared to the last 10 that sold in your area. Come by and I'll give you every dollar it's worth.",
      "Let me scan your VIN right now and show you exactly what the market says. I'd rather give you a transparent number you can take anywhere than a vague promise. I've got time at 2 — bring it by.",
    ],
  },
  {
    id: 'financing',
    icon: 'calculator-outline',
    label: 'FINANCING',
    color: '#00CCFF',
    responses: [
      "I work with over 30 lenders and I've put together deals for every credit situation you can imagine. Let me run a soft pull — zero impact on your score — and I'll tell you exactly what we're working with. It takes 5 minutes.",
      "Don't let payments be the thing that stops you. I can structure this 4 or 5 different ways — low monthly, extended term, money down options. Tell me your comfort zone and I'll build a deal around it. Let's sit down today.",
      "Here's what I tell everyone: the rate on the sticker isn't always the rate you get. I negotiate with lenders the same way I negotiate on price — aggressively in your favor. Come in and let me show you what I can do.",
    ],
  },
  {
    id: 'test_drive',
    icon: 'speedometer-outline',
    label: 'TEST DRIVE',
    color: '#34C759',
    responses: [
      "You're asking for a test drive — that tells me you're 80% there. Let me grab the keys, set up your phone, and take you on the route that shows you exactly what this vehicle can do. 15 minutes and you'll know.",
      "Nothing I say over text will sell this vehicle like the vehicle itself. I'll have it detailed, fueled, and pulled up front when you arrive. Let me put you on real roads, not a parking lot loop. When works?",
      "This is the best decision you can make right now. Sit in it, drive it, feel the tech — and if it's not the one, you'll know fast and I'll respect that. Give me a time and it's yours.",
    ],
  },
  {
    id: 'competitor',
    icon: 'flag-outline',
    label: 'COMPETITOR',
    color: '#FF9500',
    responses: [
      "I respect that you're shopping around — that's what smart buyers do. But let me show you three things that most people don't discover until they've owned both. After that, the decision will be crystal clear. Can you come by today?",
      "Great vehicle, and I can see why you'd consider it. But pull up the 5-year cost comparison — insurance, maintenance, fuel, depreciation, and resale. When you see the full picture, the real value becomes obvious. Let me walk you through it.",
      "Competition keeps us sharp. But here's what the other dealer won't tell you — our warranty, our service commitment, and our resale value stack up to thousands in savings over ownership. Let me show you the data.",
    ],
  },
  {
    id: 'urgency',
    icon: 'time-outline',
    label: 'CREATING URGENCY',
    color: '#FF2D55',
    responses: [
      "I'm not trying to create pressure, but I'd be doing you a disservice if I didn't tell you — I've had three inquiries on this exact vehicle in the last 48 hours and this manufacturer incentive ends Friday. Let's lock in a time today.",
      "The market has shifted and I'm seeing prices go up across the board next month. If you've been weighing this, right now is genuinely the best window. I can hold the current numbers with a refundable deposit through end of business today.",
      "If I could get you the exact payment you're comfortable with, on this exact vehicle, today — would there be any reason we couldn't make this happen? Because I think I can. Let me show you at 3.",
    ],
  },
  {
    id: 'follow_up',
    icon: 'refresh-outline',
    label: 'FOLLOW-UP',
    color: '#AF52DE',
    responses: [
      "Quick update — I found a couple more options that match exactly what you described, and one just hit the lot this morning. Worth a quick look before someone else grabs it. When can you swing by?",
      "I just got word on a new manufacturer incentive that drops the payment by about $40 a month on the vehicle you liked. I wanted you to know before I open it up to the floor. Can we connect this week?",
      "Market conditions have shifted since we last spoke — I'm seeing better trade-in values and lower rates than a few weeks ago. If the timing wasn't right before, it might be now. Want me to run fresh numbers for you?",
    ],
  },
  {
    id: 'appointment_setting',
    icon: 'location-outline',
    label: 'APPOINTMENT',
    color: '#32ADE6',
    responses: [
      "I've got the vehicle pulled aside and staged just for you. I have a 2:00 and a 4:30 open today — which one works better? I'll also have a complimentary trade appraisal ready when you arrive.",
      "No commitment, no pressure — give me 20 minutes and you'll know if this is the one. I'll have everything ready: the vehicle, your trade numbers, and payment options. I've got a slot at 10 AM tomorrow — sound good?",
      "I'm carving out VIP time specifically for you. Zero wait, zero pressure, and I'll have the vehicle detailed and ready for a proper test drive. Can you make it today between 3 and 5?",
    ],
  },
  {
    id: 'closing',
    icon: 'checkmark-done-outline',
    label: 'CLOSING',
    color: '#D6B25E',
    responses: [
      "You've done the research, you've driven the car, and the numbers work. So here's the deal — the only thing standing between you and driving this home tonight is your signature. Let me get the paperwork started.",
      "Let me make sure I have everything right — you love the way it drives, the color is perfect, and the payment fits your budget. The only thing left is making it official. Shall we?",
      "Everything you wanted is right here — the features, the price, the trade value. I don't want you looking back next week wishing you'd pulled the trigger. Let's wrap this up and get you behind the wheel.",
    ],
  },
  {
    id: 'adding_value',
    icon: 'trending-up-outline',
    label: 'ADDING VALUE',
    color: '#30D158',
    responses: [
      "Let me show you what you're actually getting here. This isn't just a vehicle — it's the advanced safety suite, the connected tech package, a certified warranty covering every mile, and a resale value that outperforms the entire segment. Buyers who focus only on the sticker miss the full picture. You're not purchasing a car — you're locking in years of certainty, protection, and performance. That's what the number reflects.",
      "Let me put two scenarios side by side for you. The cheaper alternative means higher insurance premiums, heavier maintenance costs, a warranty that expires in 12 months, and a trade-in value that craters in year three. When you run the real 5-year math, this vehicle costs less — not more. I can pull that comparison up right now and show you the difference in black and white.",
      "Here's what ownership with us actually looks like: you get my direct line, priority service scheduling, a complimentary annual inspection, and when you're ready to upgrade — I'll give you the same insider trade pricing I reserve for my best clients. You're not just buying the vehicle. You're buying a relationship that continues paying for itself long after you drive off the lot. That's value no sticker price captures.",
    ],
  },
];

export function EmergencyInquiryModal({ visible, onClose }) {
  const { settings } = useAppSettings();
  const lang = settings.defaultTargetLanguage;
  const flag = flagFor(lang);
  const sportOn = Boolean(settings.sportMode);
  const insets = useSafeAreaInsets();

  const [selectedType, setSelectedType] = useState(null);
  const [translatingIdx, setTranslatingIdx] = useState(-1);
  const [translatedResponses, setTranslatedResponses] = useState({});
  const [speakingIdx, setSpeakingIdx] = useState(-1);
  const playerRef = useRef(null);

  const handleSelectType = (inquiry) => {
    impactLight();
    stopPlayback();
    setSelectedType(selectedType?.id === inquiry.id ? null : inquiry);
    setTranslatedResponses({});
  };

  const stopPlayback = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
    setSpeakingIdx(-1);
  }, []);

  const handleSpeak = useCallback(async (text: string, idx: number) => {
    // Toggle off if already speaking this response
    if (speakingIdx === idx) {
      stopPlayback();
      return;
    }

    // Stop any current playback first
    stopPlayback();

    try {
      impactLight();
      setSpeakingIdx(idx);

      // Determine language: if translated text, use target lang; otherwise English
      const isTranslated = translatedResponses[idx] && text === translatedResponses[idx];
      const ttsLang = isTranslated ? lang : 'en';

      const res = await ttsSpeak({ text, language: ttsLang, voice: 'auto' });
      const b64 = res?.audio_base64;
      const format = res?.format || 'mp3';

      if (!b64) throw new Error('No audio returned');

      const player = await playBase64Audio({ base64: b64, format });
      playerRef.current = player;

      // Auto-reset when playback finishes
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          playerRef.current = null;
          setSpeakingIdx(-1);
        }
      });
    } catch (e: any) {
      setSpeakingIdx(-1);
      Alert.alert('TTS Failed', e?.message || 'Could not play audio.');
    }
  }, [speakingIdx, translatedResponses, lang, stopPlayback]);

  const handleCopy = async (text) => {
    impactLight();
    await Clipboard.setStringAsync(text);
    notificationSuccess();
  };

  const handleSms = async (text) => {
    impactMedium();
    await sendSms({ recipients: [], message: text });
  };

  const handleTranslate = useCallback(async (text, idx) => {
    try {
      impactLight();
      setTranslatingIdx(idx);
      const res = await apiFetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text, source_lang: 'en', target_lang: lang }),
      });
      if (res?.translated_text) {
        setTranslatedResponses(prev => ({ ...prev, [idx]: res.translated_text }));
        notificationSuccess();
      }
    } catch (e) {
      Alert.alert('Translation Failed', e.message || 'Could not translate.');
    } finally {
      setTranslatingIdx(-1);
    }
  }, [lang]);

  const handleClose = () => {
    stopPlayback();
    setSelectedType(null);
    setTranslatedResponses({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <LinearGradient colors={[colors.bg0, '#0A0205', '#050708']} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="alert-circle" size={24} color="#FF2D2D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>EMERGENCY RESPONSES</Text>
            <Text style={styles.headerSub}>Select an inquiry type</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 16 }}>
          {/* Inquiry type grid */}
          <View style={styles.typeGrid}>
            {INQUIRY_TYPES.map((inq) => {
              const active = selectedType?.id === inq.id;
              return (
                <Pressable
                  key={inq.id}
                  onPress={() => handleSelectType(inq)}
                  style={({ pressed }) => [
                    styles.typeCard,
                    {
                      borderColor: active ? `${inq.color}70` : `${inq.color}18`,
                      shadowColor: active ? inq.color : '#000',
                      shadowOpacity: active ? 0.85 : 0.45,
                      shadowRadius: active ? 20 : 10,
                    },
                    pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] },
                  ]}
                >
                  {/* Glass base — warm tint even when inactive */}
                  <View style={[StyleSheet.absoluteFill, {
                    borderRadius: 16,
                    backgroundColor: active ? `${inq.color}14` : 'rgba(20,24,32,0.88)',
                  }]} />

                  {/* Primary color gradient — visible even when inactive */}
                  <LinearGradient
                    colors={active
                      ? [`${inq.color}80`, `${inq.color}28`, `${inq.color}08`]
                      : [`${inq.color}14`, `${inq.color}06`, 'rgba(0,0,0,0.18)']
                    }
                    locations={[0, 0.5, 1]}
                    style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                  />

                  {/* Second color wash for depth */}
                  {active && (
                    <LinearGradient
                      colors={[`${inq.color}18`, 'transparent', `${inq.color}10`]}
                      locations={[0, 0.5, 1]}
                      style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                    />
                  )}

                  {/* Inner rim */}
                  <View style={[StyleSheet.absoluteFill, {
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: active ? `${inq.color}22` : 'rgba(255,255,255,0.04)',
                  }]} />

                  {/* Specular highlight — top edge shine */}
                  <View style={{
                    position: 'absolute', top: 3,
                    left: '15%', right: '15%',
                    height: 6, borderRadius: 3,
                    backgroundColor: active ? `${inq.color}45` : `${inq.color}15`,
                  }} />

                  {/* Bottom reflection */}
                  {active && (
                    <View style={{
                      position: 'absolute', bottom: 4,
                      left: '22%', right: '22%',
                      height: 3, borderRadius: 2,
                      backgroundColor: `${inq.color}1A`,
                    }} />
                  )}

                  {/* Icon with glow */}
                  <View style={styles.typeIconWrap}>
                    <Ionicons
                      name={inq.icon as any}
                      size={22}
                      color={active ? inq.color : `${inq.color}88`}
                      style={active ? {
                        textShadowColor: inq.color,
                        textShadowRadius: 18,
                        textShadowOffset: { width: 0, height: 0 },
                      } : {
                        textShadowColor: `${inq.color}40`,
                        textShadowRadius: 8,
                        textShadowOffset: { width: 0, height: 0 },
                      }}
                    />
                  </View>

                  {/* Label */}
                  <Text style={[
                    styles.typeLabel,
                    {
                      color: active ? inq.color : `${inq.color}99`,
                      textShadowColor: active ? `${inq.color}60` : 'transparent',
                      textShadowRadius: active ? 10 : 0,
                    },
                  ]}>
                    {inq.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Responses for selected type */}
          {selectedType && (
            <View style={styles.responsesSection}>
              <View style={styles.responsesSectionHeader}>
                <Ionicons name={selectedType.icon} size={16} color={selectedType.color} />
                <Text style={[styles.responsesSectionTitle, { color: selectedType.color }]}>
                  {selectedType.label}
                </Text>
              </View>

              {selectedType.responses.map((response, idx) => {
                const translated = translatedResponses[idx];
                const isTranslating = translatingIdx === idx;
                return (
                  <View key={idx} style={[styles.responseCard, { borderLeftColor: selectedType.color }]}>
                    <Text style={styles.responseNumber}>#{idx + 1}</Text>
                    <Text style={styles.responseText}>{response}</Text>

                    {/* Translated version */}
                    {translated && (
                      <View style={styles.translatedBlock}>
                        <Text style={styles.translatedLabel}>{langName(lang).toUpperCase()} {flag}</Text>
                        <Text style={styles.translatedText}>{translated}</Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.responseActions}>
                      {/* TTS Speaker — reads the response (or translation) aloud */}
                      <Pressable
                        onPress={() => handleSpeak(translated || response, idx)}
                        style={[
                          styles.responseActionBtn,
                          speakingIdx === idx && styles.responseActionBtnSpeaking,
                        ]}
                        accessibilityLabel={speakingIdx === idx ? 'Stop speaking' : 'Read aloud'}
                      >
                        <Ionicons
                          name={speakingIdx === idx ? 'stop-circle' : 'volume-high-outline'}
                          size={14}
                          color={speakingIdx === idx ? '#FF4444' : colors.electricBlue}
                        />
                      </Pressable>

                      <Pressable onPress={() => handleCopy(translated || response)} style={styles.responseActionBtn} accessibilityLabel="Copy">
                        <Ionicons name="copy-outline" size={14} color={colors.textDim} />
                      </Pressable>
                      <Pressable onPress={() => handleSms(translated || response)} style={styles.responseActionBtn} accessibilityLabel="Send SMS">
                        <Ionicons name="chatbubble-outline" size={14} color={colors.blue} />
                      </Pressable>
                      {sportOn && (
                        <Pressable
                          onPress={() => handleTranslate(response, idx)}
                          disabled={isTranslating}
                          style={[styles.responseActionBtn, translated && styles.responseActionBtnActive]}
                          accessibilityLabel={`Translate to ${langName(lang)}`}
                        >
                          {isTranslating ? (
                            <View style={{ width: 14, height: 14 }}>
                              <Text style={{ fontSize: 10, color: colors.gold }}>...</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 12 }}>{flag}</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,45,45,0.20)',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.50)',
    backgroundColor: 'rgba(255,45,45,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FF2D2D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSub: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: { padding: 4 },
  content: { flex: 1, padding: 16 },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '47%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,14,20,0.70)',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  typeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  responsesSection: {
    marginTop: 20,
  },
  responsesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  responsesSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  responseCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
    borderLeftWidth: 3,
    backgroundColor: 'rgba(6,8,12,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  responseNumber: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  responseText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  translatedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(214,178,94,0.20)',
  },
  translatedLabel: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  translatedText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  responseActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  responseActionBtn: {
    width: 32,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseActionBtnActive: {
    borderColor: 'rgba(214,178,94,0.40)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  responseActionBtnSpeaking: {
    borderColor: 'rgba(0,204,255,0.50)',
    backgroundColor: 'rgba(0,204,255,0.12)',
  },
});
