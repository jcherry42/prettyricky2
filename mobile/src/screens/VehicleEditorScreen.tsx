import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { impactLight } from '../lib/haptics';

export function VehicleEditorScreen({ vehicle, onSave, onCancel }) {
  const title = useMemo(() => [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '), [vehicle]);
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState(vehicle.status || 'active');
  const [stockNumber, setStockNumber] = useState(vehicle.stockNumber || '');
  const [price, setPrice] = useState(vehicle.price ? String(vehicle.price) : '');
  const [mileage, setMileage] = useState(vehicle.mileage ? String(vehicle.mileage) : '');
  const [notes, setNotes] = useState(vehicle.notes || '');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Header with close */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Edit Vehicle</Text>
            <Text style={styles.subtitle}>{title || vehicle.vin}</Text>
          </View>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 32 }}>
          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={{ height: 10 }} />
            <View style={styles.pills}>
              {['active', 'trade', 'pending', 'sold'].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    impactLight();
                    setStatus(s);
                  }}
                  style={({ pressed }) => [styles.pill, status === s && styles.pillActive, pressed && { opacity: 0.9 }]}
                >
                  <Text style={[styles.pillText, status === s && styles.pillTextActive]}>{s.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>

          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <View style={{ height: 10 }} />

            <Text style={styles.fieldLabel}>Stock Number</Text>
            <TextInput value={stockNumber} onChangeText={setStockNumber} placeholder="e.g., STK-2024-001" placeholderTextColor={colors.textMute} style={styles.input} />

            <View style={{ height: 10 }} />
            <Text style={styles.fieldLabel}>Price</Text>
            <TextInput value={price} onChangeText={setPrice} placeholder="28500" placeholderTextColor={colors.textMute} keyboardType="numeric" style={styles.input} />

            <View style={{ height: 10 }} />
            <Text style={styles.fieldLabel}>Mileage</Text>
            <TextInput value={mileage} onChangeText={setMileage} placeholder="45000" placeholderTextColor={colors.textMute} keyboardType="numeric" style={styles.input} />

            <View style={{ height: 10 }} />
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Internal notes..." placeholderTextColor={colors.textMute} style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} multiline />
          </GlassCard>

          <View style={{ height: 16 }} />

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                impactLight();
                onSave({
                  ...vehicle,
                  status,
                  stockNumber: stockNumber.trim(),
                  price: price.trim() ? Number(price) : null,
                  mileage: mileage.trim() ? Number(mileage) : null,
                  notes,
                  updatedAt: new Date().toISOString(),
                });
              }}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={16} color="#0E0E0E" />
              <Text style={[styles.btnText, { color: '#0E0E0E' }]}>Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    backgroundColor: '#040608',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    ...type.h1,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  fieldLabel: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: 'rgba(214,178,94,0.65)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  pillText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  pillTextActive: {
    color: colors.gold,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.40)',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderColor: 'rgba(214,178,94,0.90)',
  },
  btnText: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
  },
});
