import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { impactLight } from '../lib/haptics';

export function VehicleEditorScreen({ vehicle, onSave, onCancel }: { vehicle: any; onSave: (data: any) => void; onCancel: () => void }) {
  const title = useMemo(
    () => [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '),
    [vehicle],
  );
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState(vehicle.status || 'active');
  const [stockNumber, setStockNumber] = useState(vehicle.stockNumber || vehicle.stock_number || '');
  const [price, setPrice] = useState(vehicle.price ? String(vehicle.price) : '');
  const [mileage, setMileage] = useState(vehicle.mileage ? String(vehicle.mileage) : '');
  const [notes, setNotes] = useState(vehicle.notes || '');

  // Safe top padding: accounts for notch / Dynamic Island in fullScreen modal
  const topPad = Math.max(insets.top + 12, 24);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: topPad }]}>

        {/* ── Drag indicator (hint that the sheet can be swiped) ── */}
        <View style={styles.dragHandle} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Edit Vehicle</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {title || vehicle.vin}
            </Text>
            {/* VIN always shown below name */}
            {title ? (
              <Text style={styles.vinLine} numberOfLines={1}>
                {vehicle.vin}
              </Text>
            ) : null}
          </View>

          {/* Close button — large touch target, always in safe area */}
          <Pressable
            onPress={onCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.93 }] }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40 }}
        >
          {/* ── Status ── */}
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={{ height: 10 }} />
            <View style={styles.pills}>
              {(['active', 'trade', 'pending', 'sold'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { impactLight(); setStatus(s); }}
                  style={({ pressed }) => [
                    styles.pill,
                    status === s && styles.pillActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.pillText, status === s && styles.pillTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>

          {/* ── Details ── */}
          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <View style={{ height: 10 }} />

            <Text style={styles.fieldLabel}>Stock Number</Text>
            <TextInput
              value={stockNumber}
              onChangeText={setStockNumber}
              placeholder="e.g., STK-2024-001"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Asking Price ($)</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              keyboardType="numeric"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mileage</Text>
            <TextInput
              value={mileage}
              onChangeText={setMileage}
              placeholder="0"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              keyboardType="numeric"
            />
          </GlassCard>

          {/* ── Notes ── */}
          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <View style={{ height: 10 }} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Internal notes..."
              placeholderTextColor={colors.textMute}
              style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
              multiline
              scrollEnabled={false}
            />
          </GlassCard>

          {/* ── Action Buttons ── */}
          <View style={styles.btnRow}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="close" size={15} color={colors.textMute} />
              <Text style={styles.btnSecondaryText}>CANCEL</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                onSave({
                  status,
                  stockNumber: stockNumber.trim() || undefined,
                  price: price ? Number(price) : undefined,
                  mileage: mileage ? Number(mileage) : undefined,
                  notes: notes.trim() || undefined,
                })
              }
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={15} color={colors.bg0} />
              <Text style={styles.btnPrimaryText}>SAVE</Text>
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
    backgroundColor: '#040608',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 4,
  },
  title: {
    color: colors.text,
    ...type.h1,
  },
  subtitle: {
    marginTop: 4,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vinLine: {
    marginTop: 3,
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.0,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.15)',
  },
  pillText: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pillTextActive: {
    color: colors.gold,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSecondary: {
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnSecondaryText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  btnPrimary: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.18)',
  },
  btnPrimaryText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
