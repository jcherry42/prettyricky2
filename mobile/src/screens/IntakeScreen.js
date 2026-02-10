import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { loadInventory, removeFromInventory } from '../lib/inventory';

function VehicleRow({ item, onRemove }) {
  const title = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ');
  const subtitle = [
    item.stockNumber ? `Stock: ${item.stockNumber}` : null,
    typeof item.price === 'number' ? `Price: $${item.price.toLocaleString()}` : null,
    typeof item.mileage === 'number' ? `Mi: ${item.mileage.toLocaleString()}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <GlassCard style={styles.rowCard}>
      <Text style={styles.rowTitle}>{title || 'Vehicle'}</Text>
      <Text style={styles.rowVin}>{item.vin}</Text>
      {subtitle ? <Text style={styles.rowMeta}>{subtitle}</Text> : null}
      <Text style={styles.rowMeta}>Status: {item.status}</Text>

      <View style={{ height: 10 }} />
      <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.removeBtnText}>Remove</Text>
      </Pressable>
    </GlassCard>
  );
}

export function IntakeScreen() {
  const [inv, setInv] = useState({ vehicles: [] });

  const refresh = useCallback(async () => {
    const data = await loadInventory();
    setInv(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Screen>
      <ScreenHeader title="Intake" subtitle="Local inventory" />

      <View style={{ height: 14 }} />

      <GlassCard style={styles.summary}>
        <Text style={styles.summaryLabel}>Vehicles</Text>
        <Text style={styles.summaryValue}>{inv.vehicles.length}</Text>
      </GlassCard>

      <View style={{ height: 14 }} />

      <FlatList
        data={inv.vehicles}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <VehicleRow
            item={item}
            onRemove={async (id) => {
              const next = await removeFromInventory(id);
              setInv(next);
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        contentContainerStyle={{ paddingBottom: 14 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: 26,
  },
  summaryLabel: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  summaryValue: {
    marginTop: 10,
    color: colors.text,
    ...type.h1,
    fontSize: 28,
  },
  // summary body removed
  rowCard: {
    borderRadius: 26,
  },
  rowTitle: {
    color: colors.text,
    ...type.h2,
  },
  rowVin: {
    marginTop: 8,
    color: colors.text,
    fontFamily: type.body.fontFamily,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  rowMeta: {
    marginTop: 8,
    color: colors.textMute,
    ...type.bodyDim,
  },
  removeBtn: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.35)',
    backgroundColor: 'rgba(255,45,45,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.red,
    ...type.label,
    fontSize: 11,
  },
});
