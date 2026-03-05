/**
 * Emergency Inquiry Modal
 * 8 inquiry types with 3 pre-written responses each.
 * Responses aligned with Tower Talk's confident, assertive sales temperament.
 */

import React, { useState, useCallback } from 'react';
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
import * as Clipboard from 'expo-clipboard';

const INQUIRY_TYPES = [
  {
    id: 'price_objection',
    icon: 'cash-outline',
    label: 'PRICE OBJECTION',
    color: '#FF4444',
    responses: [
      "I hear you, and I respect that. But let me be real — this isn't just a car, it's an investment in your lifestyle. Let me show you the numbers that make this make sense.",
      "I understand price is important. Here's what I can do — let's look at what you're spending now and compare it to what ownership of this vehicle actually costs per day. You'll be surprised.",
      "You're not just buying a vehicle — you're buying peace of mind, safety, and three years of worry-free driving. Let me break down the total value package for you.",
    ],
  },
  {
    id: 'trade_in',
    icon: 'swap-horizontal-outline',
    label: 'TRADE-IN',
    color: '#FFD700',
    responses: [
      "Let's get your current vehicle appraised right now. I've got the tools right here to give you a fair, transparent number in under 5 minutes.",
      "Your trade-in is money in your pocket today. Let me pull up the market value and we'll use that as a down payment to get you into something you actually love driving.",
      "I want to make sure you get every dollar your vehicle is worth. Let's scan your VIN and I'll show you exactly where the market is on your trade.",
    ],
  },
  {
    id: 'financing',
    icon: 'calculator-outline',
    label: 'FINANCING',
    color: '#00CCFF',
    responses: [
      "We work with over 30 lenders to find the best rate for your situation. Let me run a quick soft pull — no impact to your credit — and see what programs you qualify for.",
      "Don't let financing be the thing that stops you from driving the right car. We specialize in putting together deals that fit real budgets. Let's talk numbers.",
      "I can structure payments in a way that works for you — whether that's low monthly, zero down, or extended terms. Tell me your comfort zone and I'll make it happen.",
    ],
  },
  {
    id: 'test_drive',
    icon: 'speedometer-outline',
    label: 'TEST DRIVE',
    color: '#34C759',
    responses: [
      "Nothing sells a car like the car itself. Let me grab the keys — I've got the perfect route that shows you exactly what this vehicle can do.",
      "I insist — you have to feel this behind the wheel. The ride quality, the tech, the way it handles — it's something you experience, not something I can describe.",
      "Let's get you in the driver's seat. I'll set up the mirrors, pair your phone, and let you experience this vehicle the way it was designed to be driven.",
    ],
  },
  {
    id: 'competitor',
    icon: 'flag-outline',
    label: 'COMPETITOR',
    color: '#FF9500',
    responses: [
      "I respect that you're doing your homework — that tells me you're a smart buyer. Let me show you the three things our vehicle does that theirs simply can't.",
      "I'm glad you brought that up. Here's what most people don't realize until they're six months into ownership with the other brand. Let me walk you through the comparison.",
      "Competition is great — it keeps us sharp. But when you line up total cost of ownership, warranty, and resale value, there's a clear winner here. Let me show you.",
    ],
  },
  {
    id: 'urgency',
    icon: 'time-outline',
    label: 'CREATING URGENCY',
    color: '#FF2D55',
    responses: [
      "I want to be upfront — this exact configuration at this price won't last. I've got two other clients looking at this same vehicle. Let's lock this in for you today.",
      "Market conditions are shifting and prices are going up next month. If you've been thinking about it, now is genuinely the best time to move.",
      "I can hold this deal for you through end of business today with a refundable deposit. That way you don't lose this opportunity while you think it over.",
    ],
  },
  {
    id: 'follow_up',
    icon: 'refresh-outline',
    label: 'FOLLOW-UP',
    color: '#AF52DE',
    responses: [
      "Hey, I've been thinking about our conversation and I wanted to check in. I found something new that I think perfectly matches what you described. When can we connect?",
      "Just a quick note — that vehicle you were interested in is still available, but I wanted you to know before I present it to my next appointment this afternoon.",
      "I hope you've had some time to think things over. I put together a custom comparison sheet just for you — I think it'll make the decision a lot clearer. Can I send it over?",
    ],
  },
  {
    id: 'closing',
    icon: 'checkmark-done-outline',
    label: 'CLOSING',
    color: '#D6B25E',
    responses: [
      "You've done the research, you've driven the car, and the numbers work. The only thing left is the paperwork — let's make this official and get you on the road.",
      "I can see this is the one. Let me get the final numbers drawn up — I'll make sure you're getting the absolute best deal I can put together. Deal?",
      "Everything you wanted is right here — the color, the features, the price. Let's not let this one get away. I'll start the paperwork while you grab a coffee.",
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

  const handleSelectType = (inquiry) => {
    impactLight();
    setSelectedType(selectedType?.id === inquiry.id ? null : inquiry);
    setTranslatedResponses({});
  };

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
                    active && { borderColor: `${inq.color}80`, backgroundColor: `${inq.color}12` },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name={inq.icon as any} size={20} color={active ? inq.color : colors.textMute} />
                  <Text style={[styles.typeLabel, active && { color: inq.color }]}>{inq.label}</Text>
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
    borderWidth: 1.5,
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
    gap: 8,
  },
  typeCard: {
    width: '47%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    gap: 6,
  },
  typeLabel: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
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
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 3,
    backgroundColor: 'rgba(8,10,14,0.80)',
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
});
