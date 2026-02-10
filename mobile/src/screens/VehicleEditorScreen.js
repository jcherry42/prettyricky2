import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';

export function VehicleEditorScreen({ vehicle, onSave, onCancel }) {
  const title = useMemo(() => [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '), [vehicle]);

  const [status, setStatus] = useState(vehicle.status || 'active');
  const [stockNumber, setStockNumber] = useState(vehicle.stockNumber || '');
  const [price, setPrice] = useState(vehicle.price ? String(vehicle.price) : '');
  const [mileage, setMileage] = useState(vehicle.mileage ? String(vehicle.mileage) : '');
  const [notes, setNotes] = useState(vehicle.notes || '');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vehicle</Text>
      <Text style={styles.subtitle}>{title || vehicle.vin}</Text>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>Status</Text>
        <View style={{ height: 10 }} />
        <View style={styles.pills}>
          {['active', 'trade', 'pending', 'sold'].map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={({ pressed }) => [styles.pill, status === s && styles.pillActive, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.pillText, status === s && styles.pillTextActive]}>{s.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>Details</Text>
        <View style={{ height: 10 }} />

        <ScrollView contentContainerStyle={{ gap: 10 }}>
          <TextInput value={stockNumber} onChangeText={setStockNumber} placeholder="Stock #" placeholderTextColor={colors.textMute} style={styles.input} />
          <TextInput value={price} onChangeText={setPrice} placeholder="Price (e.g., 28500)" placeholderTextColor={colors.textMute} keyboardType="numeric" style={styles.input} />
          <TextInput value={mileage} onChangeText={setMileage} placeholder="Mileage (e.g., 45000)" placeholderTextColor={colors.textMute} keyboardType="numeric" style={styles.input} />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={colors.textMute} style={[styles.input, { height: 96, textAlignVertical: 'top', paddingTop: 12 }]} multiline />
        </ScrollView>

        <View style={{ height: 12 }} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const next = {
                ...vehicle,
                status,
                stockNumber: stockNumber.trim(),
                price: price.trim() ? Number(price) : null,
                mileage: mileage.trim() ? Number(mileage) : null,
                notes: notes,
                updatedAt: new Date().toISOString(),
              };
              onSave(next);
            }}
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Text style={[styles.btnText, { color: '#0E0E0E' }]}>Save</Text>
          </Pressable>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  section: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    height: 34,
    paddingHorizontal: 12,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pillTextActive: {
    color: colors.gold,
  },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderColor: 'rgba(214,178,94,0.90)',
  },
  btnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
