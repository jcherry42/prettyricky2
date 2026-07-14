import React, { useState } from 'react';
import { errorMessage } from '../lib/errors';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, impactLight, notificationSuccess, notificationError } from '../lib/haptics';
import { apiFetch } from '../lib/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { flagFor, langName } from '../utils/language';
import { textCustomer } from '../lib/sms';

const STATUS_CONFIG = {
  new: { label: 'NEW', color: colors.blue },
  contacted: { label: 'CONTACTED', color: colors.gold },
  appointment: { label: 'APPOINTMENT', color: colors.green },
  negotiating: { label: 'NEGOTIATING', color: '#FF9500' },
  sold: { label: 'SOLD', color: colors.green },
  lost: { label: 'LOST', color: colors.red },
};

// ---------- Translate helper (pure async, no hook dependency) ----------
async function translateTextRequest(text: string, targetLang: string, performanceMode = false) {
  const res = await apiFetch('/api/translate', {
    method: 'POST',
    timeout: 15000,
    body: JSON.stringify({
      text: text.trim(),
      source_lang: 'en',
      target_lang: targetLang,
      performanceMode,
    }),
  });
  if (!res?.translated_text) throw new Error('Translation returned empty');
  return res.translated_text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CustomerDetailModal({ visible, customer, onClose, onEdit, onDelete }: { visible: boolean; customer: any; onClose: () => void; onEdit: (customer: any) => void; onDelete: (customer: any) => void }) {
  const { settings } = useAppSettings();
  const [translating, setTranslating] = useState(false);
  const [translatedSms, setTranslatedSms] = useState('');
  const [translatedEmail, setTranslatedEmail] = useState('');
  const insets = useSafeAreaInsets();
  const lang = settings.defaultTargetLanguage;
  const flag = flagFor(lang);
  const sportOn = Boolean(settings.sportMode);

  const name = customer
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    : '';
  const status = customer?.lead_status || 'new';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusConfig = (STATUS_CONFIG as Record<string, any>)[status] || STATUS_CONFIG.new;
  const hasPhone = customer?.phone && customer.phone !== '—';
  const hasEmail = customer?.email && customer.email !== '—';

  const salesRep = settings.salesRepName?.trim() || '';
  const dealership = settings.dealershipName?.trim() || '';
  const smsGreeting = `Hi ${customer?.first_name || 'there'}, this is ${salesRep || 'your sales consultant'}${dealership ? ` at ${dealership}` : ''}. `;
  const emailSubject = `Follow-up from ${salesRep || dealership || 'your dealership'}`;
  const emailBody = `Hi ${customer?.first_name || 'there'},\n\nThank you for visiting${dealership ? ` ${dealership}` : ' our dealership'}. I wanted to follow up regarding your vehicle interest.\n\nPlease let me know if you have any questions.\n\nBest regards${salesRep ? `,\n${salesRep}` : ''}`;

  const handleSms = async (useTranslation = false) => {
    if (!hasPhone) {
      Alert.alert('No Phone Number', 'This customer does not have a phone number on file.');
      return;
    }
    impactLight();
    const message = useTranslation && translatedSms ? translatedSms : smsGreeting;
    const result = await textCustomer(customer.phone, message);
    if (result.success) notificationSuccess();
  };

  const handleTranslateSms = async () => {
    try {
      impactLight();
      setTranslating(true);
      const result = await translateTextRequest(smsGreeting, lang, !!settings.performanceMode);
      setTranslatedSms(result);
      notificationSuccess();
    } catch (e: unknown) {
      notificationError();
      Alert.alert('Translation Failed', errorMessage(e) || 'Could not translate the message.');
    } finally {
      setTranslating(false);
    }
  };

  const handleEmail = (useTranslation = false) => {
    if (!hasEmail) {
      Alert.alert('No Email', 'This customer does not have an email on file.');
      return;
    }
    impactLight();
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(useTranslation && translatedEmail ? translatedEmail : emailBody);
    Linking.openURL(`mailto:${customer.email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Email Failed', 'Unable to open email app on this device.');
    });
  };

  const handleTranslateEmail = async () => {
    try {
      impactLight();
      setTranslating(true);
      const result = await translateTextRequest(emailBody, lang, !!settings.performanceMode);
      setTranslatedEmail(result);
      notificationSuccess();
    } catch (e: unknown) {
      notificationError();
      Alert.alert('Translation Failed', errorMessage(e) || 'Could not translate the message.');
    } finally {
      setTranslating(false);
    }
  };

  const handleCall = () => {
    if (!hasPhone) {
      Alert.alert('No Phone Number', 'This customer does not have a phone number on file.');
      return;
    }
    impactLight();
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call Failed', 'Unable to initiate a phone call on this device.');
    });
  };

  const handleDelete = () => {
    impactMedium();
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { notificationSuccess(); onDelete?.(customer); },
        },
      ]
    );
  };

  const handleEdit = () => {
    impactMedium();
    onEdit?.(customer);
  };

  const handleClose = () => {
    setTranslatedSms('');
    setTranslatedEmail('');
    onClose();
  };

  if (!customer) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <LinearGradient colors={[colors.bg0, colors.bg1]} style={styles.container}>
        <LinearGradient
          colors={['rgba(20,14,8,0.95)', 'rgba(12,8,4,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: Math.max(insets.top + 12, 20) }]}
        >
          <Pressable onPress={handleClose} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Customer Details</Text>
          {sportOn && (
            <View style={styles.sportBadge}>
              <Ionicons name="flame" size={14} color="#FF5000" />
              <Text style={styles.sportBadgeText}>{flag}</Text>
            </View>
          )}
          {!sportOn && <View style={{ width: 28 }} />}
        </LinearGradient>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 20 }}
        >
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.statusLabel}>{statusConfig.label}</Text>
          </View>

          <Text style={styles.customerName}>{name || 'Unknown Customer'}</Text>

          <View style={styles.quickActions}>
            <Pressable
              onPress={handleCall}
              style={({ pressed }) => [styles.quickActionBtn, pressed && styles.pressed]}
              accessibilityLabel="Call customer"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(52,199,89,0.15)', borderColor: 'rgba(52,199,89,0.40)' }]}>
                <Ionicons name="call" size={20} color={colors.green} />
              </View>
              <Text style={styles.quickActionLabel}>Call</Text>
            </Pressable>

            <View style={styles.quickActionGroup}>
              <Pressable
                onPress={() => handleSms(!!translatedSms)}
                style={({ pressed }) => [styles.quickActionBtn, pressed && styles.pressed]}
                accessibilityLabel="Text customer"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(0,122,255,0.15)', borderColor: 'rgba(0,122,255,0.40)' }]}>
                  <Ionicons name="chatbubble" size={20} color={colors.blue} />
                </View>
                <Text style={styles.quickActionLabel}>
                  {translatedSms ? `Text ${flag}` : 'Text'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleTranslateSms}
                disabled={translating}
                style={({ pressed }) => [
                  styles.translateFlagBtn,
                  translatedSms && styles.translateFlagBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel={`Translate text to ${langName(lang)}`}
              >
                {translating ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text style={styles.translateFlagText}>{flag}</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.quickActionGroup}>
              <Pressable
                onPress={() => handleEmail(!!translatedEmail)}
                style={({ pressed }) => [styles.quickActionBtn, pressed && styles.pressed]}
                accessibilityLabel="Email customer"
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(214,178,94,0.15)', borderColor: 'rgba(214,178,94,0.40)' }]}>
                  <Ionicons name="mail" size={20} color={colors.gold} />
                </View>
                <Text style={styles.quickActionLabel}>
                  {translatedEmail ? `Email ${flag}` : 'Email'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleTranslateEmail}
                disabled={translating}
                style={({ pressed }) => [
                  styles.translateFlagBtn,
                  translatedEmail && styles.translateFlagBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityLabel={`Translate email to ${langName(lang)}`}
              >
                {translating ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Text style={styles.translateFlagText}>{flag}</Text>
                )}
              </Pressable>
            </View>
          </View>

          {sportOn && (
            <View style={styles.sportTranslateBar}>
              <Ionicons name="flame" size={12} color="#FF5000" />
              <Text style={styles.sportTranslateText}>
                SPORT MODE — messages translate to {langName(lang)} {flag}
              </Text>
            </View>
          )}

          {translatedSms ? (
            <View style={styles.translationPreview}>
              <View style={styles.translationHeader}>
                <Ionicons name="chatbubble" size={12} color={colors.blue} />
                <Text style={styles.translationLabel}>TEXT PREVIEW ({langName(lang).toUpperCase()})</Text>
              </View>
              <Text style={styles.translationText}>{translatedSms}</Text>
              <View style={styles.translationActions}>
                <Pressable
                  onPress={() => handleSms(true)}
                  style={({ pressed }) => [styles.sendTranslatedBtn, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="send" size={12} color="#000" />
                  <Text style={styles.sendTranslatedText}>Send {flag}</Text>
                </Pressable>
                <Pressable onPress={() => setTranslatedSms('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={14} color={colors.textMute} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {translatedEmail ? (
            <View style={styles.translationPreview}>
              <View style={styles.translationHeader}>
                <Ionicons name="mail" size={12} color={colors.gold} />
                <Text style={styles.translationLabel}>EMAIL PREVIEW ({langName(lang).toUpperCase()})</Text>
              </View>
              <Text style={styles.translationText} numberOfLines={4}>{translatedEmail}</Text>
              <View style={styles.translationActions}>
                <Pressable
                  onPress={() => handleEmail(true)}
                  style={({ pressed }) => [styles.sendTranslatedBtn, { backgroundColor: colors.gold }, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="send" size={12} color="#000" />
                  <Text style={styles.sendTranslatedText}>Send {flag}</Text>
                </Pressable>
                <Pressable onPress={() => setTranslatedEmail('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={14} color={colors.textMute} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
            <InfoRow icon="call" label="Phone" value={customer.phone || '—'} />
            <InfoRow icon="mail" label="Email" value={customer.email || '—'} />
            <InfoRow icon="location" label="Address" value={customer.address || '—'} />
          </View>

          {customer.vehicle_interest ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>VEHICLE INTEREST</Text>
              <InfoRow icon="car" label="Vehicle" value={customer.vehicle_interest} />
            </View>
          ) : null}

          {customer.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>NOTES</Text>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>METADATA</Text>
            <InfoRow icon="calendar" label="Created" value={new Date(customer.created_at || Date.now()).toLocaleDateString()} />
            <InfoRow icon="pricetag" label="Customer ID" value={customer.customer_id || customer.id || '—'} />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.pressed]}
              accessibilityLabel="Edit customer"
            >
              <Ionicons name="pencil" size={20} color={colors.text} />
              <Text style={styles.actionButtonText}>Edit Customer</Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.pressed]}
              accessibilityLabel="Delete customer"
            >
              <Ionicons name="trash" size={20} color={colors.red} />
              <Text style={[styles.actionButtonText, { color: colors.red }]}>Delete Customer</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20, // overridden inline with `insets.top + 12` for notch/DynamicIsland clearance
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,178,94,0.20)',
  },
  closeButton: { padding: 4 },
  headerTitle: { ...type.h1, color: colors.text },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,80,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.40)',
  },
  sportBadgeText: { fontSize: 12 },
  content: { flex: 1, padding: 20 },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusLabel: { ...type.label, fontSize: 12, color: '#000', fontWeight: '700' },
  customerName: { ...type.h1, fontSize: 28, color: colors.text, marginBottom: 20 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  quickActionBtn: { alignItems: 'center', gap: 6, minWidth: 56 },
  quickActionGroup: { alignItems: 'center', gap: 4 },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { ...type.label, fontSize: 10, color: colors.textDim, letterSpacing: 0.5 },

  // Flag translate button
  translateFlagBtn: {
    width: 32,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateFlagBtnActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  translateFlagText: { fontSize: 12 },

  // SPORT mode translate bar
  sportTranslateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,80,0,0.30)',
    backgroundColor: 'rgba(255,80,0,0.06)',
    marginBottom: 16,
  },
  sportTranslateText: {
    color: 'rgba(255,150,80,0.90)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },

  // Translation preview cards
  translationPreview: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.25)',
    backgroundColor: 'rgba(214,178,94,0.05)',
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  translationLabel: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  translationText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  translationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sendTranslatedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.blue,
  },
  sendTranslatedText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  clearBtn: {
    padding: 6,
  },

  // Info sections
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: { ...type.label, fontSize: 11, color: colors.gold, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  infoLabel: { ...type.body, color: colors.textDim, width: 80 },
  infoValue: { ...type.body, color: colors.text, flex: 1 },
  notesText: { ...type.body, color: colors.text, lineHeight: 20 },

  // Action buttons
  actions: { gap: 12, marginTop: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  editButton: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(214,178,94,0.12)' },
  deleteButton: { backgroundColor: 'rgba(255,45,45,0.1)', borderColor: colors.red },
  actionButtonText: { ...type.body, fontFamily: 'SpaceGrotesk_600SemiBold', color: colors.text },
  pressed: { opacity: 0.6 },
});
