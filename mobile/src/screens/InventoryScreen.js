import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { loadInventory, removeFromInventory, updateVehicle } from '../lib/inventory';
import { VehicleEditorScreen } from './VehicleEditorScreen';

function VehicleRow({ item, onRemove }) {
  const title = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ');
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title || 'Vehicle'}</Text>
        <Text style={styles.rowVin}>{item.vin}</Text>
        <Text style={styles.rowMeta}>Status: {item.status} · Added: {new Date(item.addedAt).toLocaleString()}</Text>
      </View>
      <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.smallBtnText}>REMOVE</Text>
      </Pressable>
    </View>
  );
}

export function InventoryScreen() {
  const [inv, setInv] = useState({ vehicles: [] });

  const refresh = useCallback(async () => {
    const data = await loadInventory();
    setInv(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Local Inventory</Text>
      <Text style={styles.subtitle}>Offline-first vehicle cache</Text>

      <GlassCard style={{ marginTop: 14, flex: 1 }}>
        <Text style={styles.section}>Vehicles</Text>
        <Text style={styles.body}>{inv.vehicles.length} saved</Text>
        <View style={{ height: 12 }} />

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
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingBottom: 14 }}
        />
      </GlassCard>

      <Pressable onPress={refresh} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
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
  body: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
  },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  rowVin: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  rowMeta: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
  },
  smallBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(255,45,45,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  refreshBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
