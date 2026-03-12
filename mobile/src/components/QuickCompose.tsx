/**
 * QuickCompose Component
 * Editable text box (500 chars) on HomeScreen.
 * Send via SMS or Email. Translate button synced with selected language in SPORT mode.
 * Glowing link buttons for stored customers and inventory vehicles.
 *
 * FIX HISTORY:
 * - Removed Animated.multiply (broken in RN 0.81 new arch, caused touch absorption)
 * - Added scrollEnabled={false} to multiline TextInput to avoid FlatList scroll conflict
 * - Added Pressable shell around container to stop touch events from bubbling
 *   up to the HomeScreen's outer View, preventing accidental keyboard dismiss
 * - Added keyboardShouldPersistTaps="handled" to picker ScrollViews
 * - Improved GlowIconButton to use simpler, more reliable animation
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
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

/* ---------- Glowing icon button ----------
 * FIX: Replaced Animated.multiply(glowAnim, 0.8) with a direct opacity interpolation.
 * Animated.multiply with useNativeDriver:true can fail in RN 0.81 new architecture,
 * causing the Animated.View overlay to silently break and absorb all touch events.
 */
interface GlowIconButtonProps {
  icon: string;
  glowColor: string;
  selected?: boolean;
  onPress?: () => void;
  label?: string;
}

const GlowIconButton = memo(function GlowIconButton({ icon, glowColor, selected, onPress, label }: GlowIconButtonProps) {
  const glowAnim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: selected ? 0.55 : 0.28, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.10, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glowAnim, selected]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.65 }]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {/* Glow backdrop — opacity only (no Animated.multiply), natively driven */}
      <Animated.View
        style={[
          styles.iconGlow,
          {
            backgroundColor: glowColor,
            opacity: glowAnim,
          },
        ]}
        pointerEvents="none"
      />
      <Ionicons name={icon as any} size={16} color={glowColor} />
    </Pressable>
  );
});

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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const charCount = text.length;
  const hasText = text.trim().length > 0;
  const isNearLimit = charCount > 450;

  // Close the other picker when one opens
  const toggleCustomerPicker = useCallback(() => {
    impactLight();
    setShowInventoryPicker(false);
    setShowCustomerPicker((prev) => !prev);
  }, []);

  const toggleInventoryPicker = useCallback(() => {
    impactLight();
    setShowCustomerPicker(false);
    setShowInventoryPicker((prev) => !prev);
  }, []);

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
    } catch (e: any) {
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
    const fromName = settings.salesRepName?.trim() || 'Your Sales Rep';
    const subject = encodeURIComponent(`From ${fromName}`);
    const body = encodeURIComponent(message);
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`).catch(() => {
      toast.showError('Unable to open email app');
    });
  }, [text, translatedText, selectedCustomer, toast, settings.salesRepName]);

  // Link customer
  const linkCustomer = useCallback((c: any) => {
    impactLight();
    setSelectedCustomer(c);
    setShowCustomerPicker(false);
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    toast.showSuccess(`Linked to ${name}`);
  }, [toast]);

  // Link vehicle
  const linkVehicle = useCallback((v: any) => {
    impactLight();
    setSelectedVehicle(v);
    setShowInventoryPicker(false);
    const info = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
    if (info && text.length + info.length + 4 <= MAX_CHARS) {
      setText((prev) => (prev ? `${prev} — ${info}` : info));
    }
    toast.showSuccess(`Linked ${info || 'vehicle'}`);
  }, [text, toast]);

  // Clear translation when text changes
  const onChangeText = useCallback((val: any) => {
    if (val.length <= MAX_CHARS) {
      setText(val);
      if (translatedText) setTranslatedText('');
    }
  }, [translatedText]);

  // Tapping the container focuses the input (instead of bubbling to outer views)
  const handleContainerPress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    // Pressable shell stops touch events from bubbling to parent views.
    // Without this, tapping on any non-interactive area of the compose box
    // would propagate to outer components that might dismiss the keyboard.
    <Pressable
      onPress={handleContainerPress}
      style={styles.containerShell}
      accessible={false}
    >
      <View style={[styles.container, isFocused && styles.containerFocused]}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Ionicons name="create-outline" size={14} color={colors.gold} />
          <Text style={styles.headerLabel}>QUICK COMPOSE</Text>
          <Text style={[styles.charCount, isNearLimit && styles.charCountWarn]}>
            {charCount}/{MAX_CHARS}
          </Text>
        </View>

        {/* Linked tags */}
        {(selectedCustomer || selectedVehicle) && (
          <View style={styles.tagsRow}>
            {selectedCustomer && (
              <Pressable
                onPress={() => { setSelectedCustomer(null); impactLight(); }}
                style={styles.tag}
              >
                <Ionicons name="person" size={10} color={colors.blue} />
                <Text style={styles.tagText}>
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </Text>
                <Ionicons name="close" size={10} color={colors.textMute} />
              </Pressable>
            )}
            {selectedVehicle && (
              <Pressable
                onPress={() => { setSelectedVehicle(null); impactLight(); }}
                style={styles.tag}
              >
                <Ionicons name="car" size={10} color={colors.green} />
                <Text style={styles.tagText}>
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </Text>
                <Ionicons name="close" size={10} color={colors.textMute} />
              </Pressable>
            )}
          </View>
        )}

        {/* Text input
         * FIX: scrollEnabled={false} prevents the multiline TextInput from competing
         * with the FlatList's scroll responder, which was causing the touch to be
         * "stolen" by the list, making text editing unreliable.
         */}
        <TextInput
          ref={inputRef}
          style={[styles.input, isFocused && styles.inputFocused]}
          value={text}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Compose a message..."
          placeholderTextColor={colors.textMute}
          multiline
          scrollEnabled={false}
          maxLength={MAX_CHARS}
          textAlignVertical="top"
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Translation preview */}
        {translatedText ? (
          <View style={styles.translationPreview}>
            <View style={styles.translationHeader}>
              <Text style={styles.translationLabel}>
                {langName(lang).toUpperCase()} {flag}
              </Text>
              <Pressable onPress={() => setTranslatedText('')} hitSlop={8}>
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
              selected={!!selectedCustomer}
              onPress={toggleCustomerPicker}
              label="Link customer"
            />
            <GlowIconButton
              icon="car-sport"
              glowColor={colors.green}
              selected={!!selectedVehicle}
              onPress={toggleInventoryPicker}
              label="Link vehicle"
            />
          </View>

          {/* Send buttons */}
          <View style={styles.sendButtons}>
            {/* Translate flag — visible in SPORT mode */}
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
                !hasText && styles.sendBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Send as text message"
              hitSlop={4}
            >
              <Ionicons
                name="chatbubble"
                size={14}
                color={hasText ? colors.blue : colors.textMute}
              />
            </Pressable>

            {/* Email send */}
            <Pressable
              onPress={() => handleSendEmail(!!translatedText)}
              disabled={!hasText}
              style={({ pressed }) => [
                styles.sendBtn,
                !hasText && styles.sendBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Send as email"
              hitSlop={4}
            >
              <Ionicons
                name="mail"
                size={14}
                color={hasText ? colors.gold : colors.textMute}
              />
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
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {(customers || []).map((c: any) => (
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
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {(vehicles || []).map((v: any, i: number) => (
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
                      <Text
                        style={[
                          styles.pickerItemSub,
                          { fontFamily: 'SpaceGrotesk_500Medium', letterSpacing: 0.5 },
                        ]}
                        numberOfLines={1}
                      >
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
    </Pressable>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'new':          return '#5EA7FF';
    case 'contacted':    return '#FFD700';
    case 'appointment':  return '#AF52DE';
    case 'qualified':    return '#00CCFF';
    case 'negotiating':  return '#FF9500';
    case 'sold':         return '#40FF9B';
    case 'lost':         return '#FF2D2D';
    default:             return 'rgba(255,255,255,0.3)';
  }
}

const styles = StyleSheet.create({
  /* Outer Pressable shell — consumes taps so they don't bubble to parent views */
  containerShell: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  container: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(4,6,10,0.92)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  containerFocused: {
    borderColor: 'rgba(214,178,94,0.40)',
    shadowColor: 'rgba(214,178,94,0.40)',
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerLabel: {
    flex: 1,
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },
  charCount: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '700',
  },
  charCountWarn: {
    color: colors.red || '#FF3B30',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(214,178,94,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.08)',
  },
  tagText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 72,
    fontFamily: 'SpaceGrotesk_400Regular',
    /* scrollEnabled={false} is set as a prop — see the TextInput element above */
  },
  inputFocused: {
    color: colors.text,
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  linkButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  linkBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.08)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  sendButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  translateFlag: {
    width: 36,
    height: 30,
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
    fontSize: 15,
  },
  sendBtn: {
    width: 38,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sendBtnDisabled: {
    opacity: 0.35,
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
