/**
 * QuickCompose Component
 * Editable text box (500 chars) on HomeScreen.
 * Send via SMS or Email. Translate button synced with selected language in SPORT mode.
 * Glowing link buttons for stored customers and inventory vehicles.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, Alert, Linking, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers } from '../context/CustomerContext';
import { useInventory } from '../context/InventoryContext';
import { flagFor, langName } from '../utils/language';
import { apiFetch } from '../lib/api';
import { textCustomer, sendSms } from '../lib/sms';
import { useToast } from '../context/ToastContext';

const MAX_CHARS = 500;

/* ---------- Glowing icon button ---------- */
function GlowIconButton({ icon, glowColor, active, selected, onPress, label }) {
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glowAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
      accessibilityLabel={label}
    >
      {/* Glow backdrop */}
      <Animated.View
        style={[
          styles.iconGlow,
          { backgroundColor: glowColor, opacity: selected ? Animated.multiply(glowAnim, 0.8) : glowAnim },
        ]}
      />
      <Ionicons name={icon} size={16} color={selected ? glowColor : glowColor} />
    </Pressable>
  );
}

export function QuickCompose() {
  const { settings } = useAppSettings();
  const { customers } = useCustomers();
  const { vehicles } = useInventory();
  const toast = useToast();
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

  // Close the other picker when one opens
  const toggleCustomerPicker = () => {
    impactLight();
    setShowInventoryPicker(false);
    setShowCustomerPicker((prev) => !prev);
  };

  const toggleInventoryPicker = () => {
    impactLight();
    setShowCustomerPicker(false);
    setShowInventoryPicker((prev) => !prev);
  };

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
        toast.showSuccess('Translation complete');
      }
    } catch (e) {
      notificationError();
      toast.showError(e.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }, [text, lang, hasText, toast]);

  // Send SMS
  const handleSendSms = useCallback(async (useTranslation = false) => {
    const message = useTranslation && translatedText ? translatedText : text.trim();
    if (!message) return;
    impactMedium();
    if (selectedCustomer?.phone) {
      const result = await textCustomer(selectedCustomer.phone, message);
      if (result.success) {
        notificationSuccess();
        toast.showSuccess('SMS composer opened');
      }
    } else {
      const result = await sendSms({ recipients: [], message });
      if (result.success) {
        notificationSuccess();
        toast.showSuccess('SMS composer opened');
      }
    }
  }, [text, translatedText, selectedCustomer, toast]);

  // Send Email
  const handleSendEmail = useCallback((useTranslation = false) => {
    const message = useTranslation && translatedText ? translatedText : text.trim();
    if (!message) return;
    impactMedium();
    const to = selectedCustomer?.email || '';
    const subject = encodeURIComponent('From Supercharg\'d');
    const body = encodeURIComponent(message);
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`).catch(() => {
      toast.showError('Unable to open email app');
    });
  }, [text, translatedText, selectedCustomer, toast]);

  // Link customer
  const linkCustomer = (c) => {
    impactLight();
    setSelectedCustomer(c);
    setShowCustomerPicker(false);
    toast.showSuccess(`Linked to ${c.first_name || ''} ${c.last_name || ''}`);
  };

  // Link vehicle
  const linkVehicle = (v) => {
    impactLight();
    setSelectedVehicle(v);
    setShowInventoryPicker(false);
    const info = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
    if (info && text.length + info.length + 4 <= MAX_CHARS) {
      setText((prev) => (prev ? `${prev} — ${info}` : info));
    }
    toast.showSuccess(`Linked ${info || 'vehicle'}`);
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
            <Pressable onPress={() => { setSelectedCustomer(null); impactLight(); }} style={styles.tag}>
              <Ionicons name="person" size={10} color={colors.blue} />
              <Text style={styles.tagText}>{selectedCustomer.first_name} {selectedCustomer.last_name}</Text>
              <Ionicons name="close" size={10} color={colors.textMute} />
            </Pressable>
          )}
          {selectedVehicle && (
            <Pressable onPress={() => { setSelectedVehicle(null); impactLight(); }} style={styles.tag}>
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
        {/* Glowing link buttons */}
        <View style={styles.linkButtons}>
          <GlowIconButton
            icon="person"
            glowColor={colors.blue}
            active={customers && customers.length > 0}
            selected={!!selectedCustomer}
            onPress={toggleCustomerPicker}
            label="Link customer"
          />
          <GlowIconButton
            icon="car-sport"
            glowColor={colors.green}
            active={vehicles && vehicles.length > 0}
            selected={!!selectedVehicle}
            onPress={toggleInventoryPicker}
            label="Link vehicle"
          />
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
        <View style={[styles.pickerDropdown, { borderColor: 'rgba(94,167,255,0.25)' }]}>
          <View style={styles.pickerTitleRow}>
            <Ionicons name="people" size={12} color={colors.blue} />
            <Text style={[styles.pickerTitle, { color: colors.blue }]}>STORED CUSTOMERS</Text>
            <Text style={styles.pickerCount}>{(customers || []).length}</Text>
          </View>
          <ScrollView
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {(customers || []).map((c) => (
              <Pressable
                key={c.customer_id || c.id}
                onPress={() => linkCustomer(c)}
                style={({ pressed }) => [
                  styles.pickerItem,
                  pressed && { backgroundColor: 'rgba(94,167,255,0.10)' },
                ]}
              >
                <View style={styles.pickerItemLeft}>
                  <Ionicons name="person-circle" size={24} color={colors.blue} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.pickerItemText} numberOfLines={1}>
                      {c.first_name || ''} {c.last_name || ''}
                    </Text>
                    <Text style={styles.pickerItemSub} numberOfLines={1}>
                      {c.phone || c.email || 'No contact info'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusDot, { backgroundColor: statusColor(c.status) }]} />
              </Pressable>
            ))}
            {(!customers || customers.length === 0) && (
              <View style={styles.pickerEmptyContainer}>
                <Ionicons name="people-outline" size={28} color={colors.textMute} />
                <Text style={styles.pickerEmpty}>No customers stored yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Inventory picker dropdown */}
      {showInventoryPicker && (
        <View style={[styles.pickerDropdown, { borderColor: 'rgba(64,255,155,0.25)' }]}>
          <View style={styles.pickerTitleRow}>
            <Ionicons name="car-sport" size={12} color={colors.green} />
            <Text style={[styles.pickerTitle, { color: colors.green }]}>STORED VEHICLES</Text>
            <Text style={styles.pickerCount}>{(vehicles || []).length}</Text>
          </View>
          <ScrollView
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {(vehicles || []).map((v, i) => (
              <Pressable
                key={v.vehicle_id || v.id || `v-${i}`}
                onPress={() => linkVehicle(v)}
                style={({ pressed }) => [
                  styles.pickerItem,
                  pressed && { backgroundColor: 'rgba(64,255,155,0.10)' },
                ]}
              >
                <View style={styles.pickerItemLeft}>
                  <Ionicons name="car" size={22} color={colors.green} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.pickerItemText} numberOfLines={1}>
                      {v.year || ''} {v.make || ''} {v.model || ''}
                    </Text>
                    <Text style={[styles.pickerItemSub, { fontFamily: 'SpaceGrotesk_500Medium', letterSpacing: 0.5 }]} numberOfLines={1}>
                      {v.vin || 'No VIN'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
            {(!vehicles || vehicles.length === 0) && (
              <View style={styles.pickerEmptyContainer}>
                <Ionicons name="car-outline" size={28} color={colors.textMute} />
                <Text style={styles.pickerEmpty}>No vehicles in inventory</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function statusColor(status) {
  switch (status) {
    case 'new': return '#5EA7FF';
    case 'contacted': return '#FFD700';
    case 'appointment': return '#AF52DE';
    case 'qualified': return '#00CCFF';
    case 'negotiating': return '#FF9500';
    case 'sold': return '#40FF9B';
    case 'lost': return '#FF2D2D';
    default: return 'rgba(255,255,255,0.3)';
  }
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.85)',
    overflow: 'visible',
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
    fontStyle: 'italic',
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
    gap: 6,
  },
  linkBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 10,
    opacity: 0.15,
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
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(10,12,16,0.96)',
    padding: 12,
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pickerTitle: {
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pickerCount: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerItemText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pickerItemSub: {
    color: colors.textMute,
    fontSize: 11,
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  pickerEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  pickerEmpty: {
    color: colors.textMute,
    fontSize: 11,
    textAlign: 'center',
  },
});
