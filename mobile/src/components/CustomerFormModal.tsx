import React, { useState, useEffect, useRef } from 'react';
import { useLingo } from '../context/ModeContext';
import { errorMessage } from '../lib/errors';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, notificationSuccess, notificationError } from '../lib/haptics';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: colors.blue },
  { value: 'contacted', label: 'Contacted', color: colors.gold },
  { value: 'appointment', label: 'Appointment', color: colors.green },
  { value: 'negotiating', label: 'Negotiating', color: '#FF9500' },
  { value: 'sold', label: 'Sold', color: colors.green },
  { value: 'service', label: 'Service', color: '#FFA500' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CustomerFormModal({ visible, customer, onClose, onSave }: { visible: boolean; customer: any; onClose: () => void; onSave: (data: any, existingCustomer?: any) => Promise<any> }) {
  const lingo = useLingo();
  const isEditing = Boolean(customer);
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleInterest, setVehicleInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [leadStatus, setLeadStatus] = useState('new');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'es' | 'fr' | 'ko'>('en');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Refs for keyboard focus chaining
  const lastNameRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const addressRef = useRef<TextInput | null>(null);
  const vehicleRef = useRef<TextInput | null>(null);

  // Load customer data when editing
  useEffect(() => {
    if (customer) {
      setFirstName(customer.first_name || '');
      setLastName(customer.last_name || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setVehicleInterest(customer.vehicle_interest || '');
      setNotes(customer.notes || '');
      setLeadStatus(customer.lead_status || 'new');
      setPreferredLanguage((customer.preferred_language as 'en' | 'es' | 'fr' | 'ko') || 'en');
    } else {
      // Reset form for new customer
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setVehicleInterest('');
      setNotes('');
      setLeadStatus('new');
      setPreferredLanguage('en');
    }
  }, [customer]);

  const handleSave = async () => {
    setValidationError(null);

    if (!firstName.trim() || !lastName.trim()) {
      impactMedium();
      notificationError();
      setValidationError('Please enter first and last name');
      return;
    }

    if (!phone.trim()) {
      impactMedium();
      notificationError();
      setValidationError('Please enter a phone number');
      return;
    }

    setSaving(true);
    impactMedium();

    try {
      const customerData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        vehicle_interest: vehicleInterest.trim(),
        notes: notes.trim(),
        lead_status: leadStatus,
        preferred_language: preferredLanguage,
      };

      await onSave(customerData, customer);
      notificationSuccess();
      onClose();
    } catch (error: unknown) {
      notificationError();
      setValidationError(`Save failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient colors={[colors.bg0, colors.bg1]} style={styles.container}>
          {/* Header with wood bezel */}
          <LinearGradient
            colors={['rgba(20,14,8,0.95)', 'rgba(12,8,4,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={onClose} style={styles.closeButton} disabled={saving}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{isEditing ? `Edit ${lingo.customerSingular}` : `New ${lingo.customerSingular}`}</Text>
            <View style={{ width: 28 }} />
          </LinearGradient>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
          >
            {/* Validation error banner */}
            {validationError && (
              <View style={styles.validationBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={styles.validationText}>{validationError}</Text>
                <Pressable onPress={() => setValidationError(null)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={colors.textMute} />
                </Pressable>
              </View>
            )}

            {/* Basic Info */}
            <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={colors.textMute}
                  editable={!saving}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  ref={lastNameRef}
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={colors.textMute}
                  editable={!saving}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            <Text style={styles.label}>Phone *</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textMute}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="next"
              editable={!saving}
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.textMute}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!saving}
              onSubmitEditing={() => addressRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              ref={addressRef}
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Street address"
              placeholderTextColor={colors.textMute}
              autoCapitalize="words"
              textContentType="fullStreetAddress"
              returnKeyType="next"
              editable={!saving}
              onSubmitEditing={() => vehicleRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Vehicle Interest — becomes "Repair Order #" when the customer
                is flagged as Service (advisor workflow, not sales). */}
            <Text style={styles.sectionTitle}>
              {leadStatus === 'service' ? 'REPAIR ORDER #' : 'VEHICLE INTEREST'}
            </Text>
            <TextInput
              ref={vehicleRef}
              style={styles.input}
              value={vehicleInterest}
              onChangeText={setVehicleInterest}
              placeholder={leadStatus === 'service' ? 'e.g. RO-12345' : 'Vehicle of interest'}
              placeholderTextColor={colors.textMute}
              autoCapitalize={leadStatus === 'service' ? 'characters' : 'words'}
              returnKeyType="done"
              editable={!saving}
              data-testid={leadStatus === 'service' ? 'repair-order-input' : 'vehicle-interest-input'}
            />

            {/* Status */}
            <Text style={styles.sectionTitle}>LEAD STATUS</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    impactMedium();
                    setLeadStatus(option.value);
                  }}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.statusButton,
                    leadStatus === option.value && styles.statusButtonActive,
                    { borderColor: option.color },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      leadStatus === option.value && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Preferred Language — pre-warm target for Tower Talk auto-translation */}
            <Text style={styles.sectionTitle}>PREFERRED LANGUAGE</Text>
            <View style={styles.statusGrid}>
              {([
                { value: 'en', label: '🇺🇸 English' },
                { value: 'es', label: '🇲🇽 Español' },
                { value: 'fr', label: '🇫🇷 Français' },
                { value: 'ko', label: '🇰🇷 한국어' },
              ] as const).map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    impactMedium();
                    setPreferredLanguage(option.value);
                  }}
                  disabled={saving}
                  data-testid={`preferred-language-${option.value}`}
                  style={({ pressed }) => [
                    styles.statusButton,
                    preferredLanguage === option.value && styles.statusButtonActive,
                    { borderColor: preferredLanguage === option.value ? '#00E5FF' : 'rgba(255,255,255,0.10)' },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      preferredLanguage === option.value && { color: '#00E5FF' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.sectionTitle}>NOTES</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes"
              placeholderTextColor={colors.textMute}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!saving}
            />

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || saving) && styles.saveButtonPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg0} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.bg0} />
                  <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Customer'}</Text>
                </>
              )}
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.30)',
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  validationText: {
    flex: 1,
    color: colors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(214,178,94,0.25)',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    ...type.h1,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
    marginTop: 24,
    marginBottom: 12,
  },
  label: {
    ...type.body,
    color: colors.textDim,
    marginBottom: 8,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(214,178,94,0.12)',
    borderRadius: 0,
    padding: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    // 6 buttons fill exactly 2 rows of 3 with no blank space.
    // (100% - 2*gap) / 3 = ~31.5% each. Using flexBasis lets flexbox handle
    // the residual pixel perfectly.
    flexBasis: '31.5%',
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.10)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    backgroundColor: 'rgba(214,178,94,0.16)',
    borderColor: colors.gold,
    // Subtle gold glow when selected
    shadowColor: colors.gold,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  statusButtonText: {
    ...type.label,
    fontSize: 11,
    color: colors.textDim,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.gold,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: 'rgba(214,178,94,0.70)',
    shadowOpacity: 0.50,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  saveButtonPressed: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...type.body,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.bg0,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
