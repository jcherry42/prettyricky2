/**
 * QuickCompose Component
 * Editable text box (500 chars) on HomeScreen.
 * Send via SMS or Email. Translate button synced with selected language in SPORT mode.
 * Link with stored customers and inventory.
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers } from '../context/CustomerContext';
import { useInventory } from '../context/InventoryContext';
import { flagFor, langName } from '../utils/language';
import { apiFetch } from '../lib/api';
import { textCustomer, sendSms } from '../lib/sms';

const MAX_CHARS = 500;

export function QuickCompose() {
  const { settings } = useAppSettings();
  const { customers } = useCustomers();
  const { vehicles } = useInventory();
  const lang = settings.defaultTargetLanguage;
  const flag = flagFor(lang);
  const sportOn = Boolean(settings.sportMode);

  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const inputRef = useRef(null);

  const charCount = text.length;
  const hasText = text.trim().length > 0;

  // Translate
  const handleTranslate = useCallback(async () => {
    if (!hasText) return;
    try {
      impactLight();
      setTranslating(true);
      const res = await apiFetch('/api/translate', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim(), source_lang: 'en', target_lang: lang }),
      });
      if (res?.translated_text) {
        setTranslatedText(res.translated_text);
        notificationSuccess();
      }
    } catch (e) {
      notificationError();
      Alert.alert('Translation Failed', e.message || 'Could not translate.');
    } finally {
      setTranslating(false);
    }
  }, [text, lang, hasText]);

  // Send SMS
  const handleSendSms = useCallback(async (useTranslation = false) => {
    const message = useTranslation && translatedText ? translatedText : text.trim();
    if (!message) return;
    impactMedium();
    if (selectedCustomer?.phone) {
      const result = await textCustomer(selectedCustomer.phone, message);
      if (result.success) notificationSuccess();
    } else {
      const result = await sendSms({ recipients: [], message });
      if (result.success) notificationSuccess();
    }
  }, [text, translatedText, selectedCustomer]);

  // Send Email
  const handleSendEmail = useCallback((useTranslation = false) => {
    const message = useTranslation && translatedText ? translatedText : text.trim();
    if (!message) return;
    impactMedium();
    const to = selectedCustomer?.email || '';
    const subject = encodeURIComponent('From Supercharg\'d');
    const body = encodeURIComponent(message);
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Email Failed', 'Unable to open email app.');
    });
  }, [text, translatedText, selectedCustomer]);

  // Link customer
  const linkCustomer = (c) => {
    impactLight();
    setSelectedCustomer(c);
    setShowCustomerPicker(false);
  };

  // Link vehicle
  const linkVehicle = (v) => {
    impactLight();
    setSelectedVehicle(v);
    setShowInventoryPicker(false);
    // Auto-insert vehicle info
    const info = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
    if (info && text.length + info.length + 2 <= MAX_CHARS) {
      setText(prev => prev ? `${prev} — ${info}` : info);
    }
  };

  // Clear translation when text changes
  const onChangeText = (val) => {
    if (val.length <= MAX_CHARS) {
      setText(val);
      if (translatedText) setTranslatedText('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Ionicons name="create-outline" size={14} color={colors.gold} />
        <Text style={styles.headerLabel}>QUICK COMPOSE</Text>
        <Text style={[styles.charCount, charCount > 450 && { color: colors.red }]}>
          {charCount}/{MAX_CHARS}
        </Text>
      </View>

      {/* Linked tags */}
      {(selectedCustomer || selectedVehicle) && (
        <View style={styles.tagsRow}>
          {selectedCustomer && (
            <Pressable onPress={() => setSelectedCustomer(null)} style={styles.tag}>
              <Ionicons name="person" size={10} color={colors.blue} />
              <Text style={styles.tagText}>{selectedCustomer.first_name} {selectedCustomer.last_name}</Text>
              <Ionicons name="close" size={10} color={colors.textMute} />
            </Pressable>
          )}
          {selectedVehicle && (
            <Pressable onPress={() => setSelectedVehicle(null)} style={styles.tag}>
              <Ionicons name="car" size={10} color={colors.green} />
              <Text style={styles.tagText}>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</Text>
              <Ionicons name="close" size={10} color={colors.textMute} />
            </Pressable>
          )}
        </View>
      )}

      {/* Text input */}
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={onChangeText}
        placeholder="Compose a message..."
        placeholderTextColor={colors.textMute}
        multiline
        maxLength={MAX_CHARS}
        textAlignVertical="top"
      />

      {/* Translation preview */}
      {translatedText ? (
        <View style={styles.translationPreview}>
          <View style={styles.translationHeader}>
            <Text style={styles.translationLabel}>{langName(lang).toUpperCase()} {flag}</Text>
            <Pressable onPress={() => setTranslatedText('')}>
              <Ionicons name="close-circle" size={14} color={colors.textMute} />
            </Pressable>
          </View>
          <Text style={styles.translationText}>{translatedText}</Text>
        </View>
      ) : null}

      {/* Action bar */}
      <View style={styles.actionBar}>
        {/* Link buttons */}
        <View style={styles.linkButtons}>
          <Pressable
            onPress={() => setShowCustomerPicker(!showCustomerPicker)}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Link customer"
          >
            <Ionicons name="person-add" size={14} color={selectedCustomer ? colors.blue : colors.textMute} />
          </Pressable>
          <Pressable
            onPress={() => setShowInventoryPicker(!showInventoryPicker)}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Link vehicle"
          >
            <Ionicons name="car" size={14} color={selectedVehicle ? colors.green : colors.textMute} />
          </Pressable>
        </View>

        {/* Send buttons */}
        <View style={styles.sendButtons}>
          {/* Translate flag - visible in SPORT mode */}
          {sportOn && hasText && (
            <Pressable
              onPress={handleTranslate}
              disabled={translating}
              style={({ pressed }) => [
                styles.translateFlag,
                translatedText && styles.translateFlagActive,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel={`Translate to ${langName(lang)}`}
            >
              {translating ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Text style={styles.flagText}>{flag}</Text>
              )}
            </Pressable>
          )}

          {/* SMS send */}
          <Pressable
            onPress={() => handleSendSms(!!translatedText)}
            disabled={!hasText}
            style={({ pressed }) => [
              styles.sendBtn,
              !hasText && { opacity: 0.4 },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Send as text message"
          >
            <Ionicons name="chatbubble" size={14} color={hasText ? colors.blue : colors.textMute} />
          </Pressable>

          {/* Email send */}
          <Pressable
            onPress={() => handleSendEmail(!!translatedText)}
            disabled={!hasText}
            style={({ pressed }) => [
              styles.sendBtn,
              !hasText && { opacity: 0.4 },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Send as email"
          >
            <Ionicons name="mail" size={14} color={hasText ? colors.gold : colors.textMute} />
          </Pressable>
        </View>
      </View>

      {/* Customer picker dropdown */}
      {showCustomerPicker && (
        <View style={styles.pickerDropdown}>
          <Text style={styles.pickerTitle}>LINK CUSTOMER</Text>
          <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
            {(customers || []).slice(0, 20).map((c) => (
              <Pressable
                key={c.customer_id || c.id}
                onPress={() => linkCustomer(c)}
                style={({ pressed }) => [styles.pickerItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              >
                <Text style={styles.pickerItemText}>{c.first_name} {c.last_name}</Text>
                <Text style={styles.pickerItemSub}>{c.phone || 'No phone'}</Text>
              </Pressable>
            ))}
            {(!customers || customers.length === 0) && (
              <Text style={styles.pickerEmpty}>No customers found</Text>
            )}
          </ScrollView>
        </View>
      )}

      {/* Inventory picker dropdown */}
      {showInventoryPicker && (
        <View style={styles.pickerDropdown}>
          <Text style={styles.pickerTitle}>LINK VEHICLE</Text>
          <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
            {(vehicles || []).slice(0, 20).map((v, i) => (
              <Pressable
                key={v.vehicle_id || v.id || `v-${i}`}
                onPress={() => linkVehicle(v)}
                style={({ pressed }) => [styles.pickerItem, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              >
                <Text style={styles.pickerItemText}>{v.year} {v.make} {v.model}</Text>
                <Text style={styles.pickerItemSub}>{v.vin || 'No VIN'}</Text>
              </Pressable>
            ))}
            {(!vehicles || vehicles.length === 0) && (
              <Text style={styles.pickerEmpty}>No vehicles in inventory</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.80)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerLabel: {
    flex: 1,
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  charCount: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tagText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 60,
    maxHeight: 100,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  translationPreview: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.25)',
    backgroundColor: 'rgba(214,178,94,0.05)',
  },
  translationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  translationLabel: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  translationText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 2,
  },
  linkButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  linkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  translateFlag: {
    width: 36,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.40)',
    backgroundColor: 'rgba(255,80,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateFlagActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.15)',
  },
  flagText: {
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerDropdown: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(15,18,22,0.95)',
    padding: 10,
  },
  pickerTitle: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pickerItemText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pickerItemSub: {
    color: colors.textMute,
    fontSize: 11,
  },
  pickerEmpty: {
    color: colors.textMute,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
