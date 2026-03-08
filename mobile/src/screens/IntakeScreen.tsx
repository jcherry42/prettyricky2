import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl, Alert, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useInventory } from '../context/InventoryContext';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { impactLight, notificationSuccess } from '../lib/haptics';
import { VehicleEditorScreen } from './VehicleEditorScreen';
import { VinScanScreen } from './VinScanScreen';
import { DlScanScreen } from './DlScanScreen';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

const STATUS_COLORS = {
  active: colors.green,
  trade: colors.gold,
  pending: colors.blue,
  sold: colors.textMute,
};

/* ---------- Helpers ---------- */
function deriveDisplayStatus(v: any): string {
  if (v.status && v.status !== 'available') return v.status;
  if (v.category === 'trade_in') return 'trade';
  return 'active';
}

/* ---------- Vehicle Card ---------- */
function VehicleCard({ item, onEdit, onRemove }) {
  const title = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ');
  const displayStatus = deriveDisplayStatus(item);
  const statusColor = STATUS_COLORS[displayStatus] || colors.textMute;
  const stockNum = item.stockNumber || item.stock_number;
  const dateStr = item.addedAt || item.created_at;

  return (
    <Pressable
      onPress={() => { impactLight(); onEdit(item); }}
      style={({ pressed }) => [styles.vehicleCard, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.vehicleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>{title || 'Vehicle'}</Text>
          <Text style={styles.vehicleVin}>{item.vin}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{displayStatus.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.vehicleMeta}>
        {stockNum ? <Text style={styles.metaChip}>Stock: {stockNum}</Text> : null}
        {typeof item.price === 'number' ? <Text style={styles.metaChip}>${item.price.toLocaleString()}</Text> : null}
        {typeof item.mileage === 'number' ? <Text style={styles.metaChip}>{item.mileage.toLocaleString()} mi</Text> : null}
      </View>

      <View style={styles.vehicleFooter}>
        <Text style={styles.dateText}>{dateStr ? new Date(dateStr).toLocaleDateString() : '—'}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            const vid = item.id || item.vehicle_id;
            Alert.alert('Remove Vehicle', `Remove ${title || item.vin} from inventory?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemove(vid) },
            ]);
          }}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.red} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/* ---------- Intake Hub (main screen) ---------- */
function IntakeHub({ navigation }) {
  const { vehicles, fetchInventory, deleteVehicle: ctxDeleteVehicle, updateVehicle: ctxUpdateVehicle } = useInventory();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const { triggerFlash } = useTaillightFlash();
  const insets = useSafeAreaInsets();
  const listPaddingBottom = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 20;

  // Fetch from backend on mount
  useEffect(() => { fetchInventory().catch(() => {}); }, [fetchInventory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchInventory(); } catch (_) {}
    setRefreshing(false);
  }, [fetchInventory]);

  const filtered = search.trim()
    ? vehicles.filter((v) => {
        const q = search.toLowerCase();
        const text = [v.vin, v.year, v.make, v.model, v.trim, v.stockNumber, v.stock_number, deriveDisplayStatus(v)].filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      })
    : vehicles;

  const stats = {
    total: vehicles.length,
    active: vehicles.filter((v) => deriveDisplayStatus(v) === 'active').length,
    trade: vehicles.filter((v) => deriveDisplayStatus(v) === 'trade').length,
    sold: vehicles.filter((v) => deriveDisplayStatus(v) === 'sold').length,
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScreenHeader
          title="Intake"
          right={<Text style={styles.countBadge}>{stats.total}</Text>}
        />

        <View style={{ height: 14 }} />

        {/* Scan Action Cards */}
        <View style={styles.scanRow}>
          <Pressable
            onPress={() => { impactLight(); navigation.navigate('VinScan'); }}
            style={({ pressed }) => [styles.scanCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <Ionicons name="barcode-outline" size={22} color={colors.gold} />
            <Text style={styles.scanLabel}>VIN</Text>
          </Pressable>

          <Pressable
            onPress={() => { impactLight(); navigation.navigate('DlScan'); }}
            style={({ pressed }) => [styles.scanCard, styles.scanCardDl, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <Ionicons name="card-outline" size={22} color="#FF2D2D" />
            <Text style={styles.scanLabel}>DL</Text>
          </Pressable>
        </View>

        <View style={{ height: 14 }} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.green }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{stats.trade}</Text>
            <Text style={styles.statLabel}>TRADE</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.textMute }]}>{stats.sold}</Text>
            <Text style={styles.statLabel}>SOLD</Text>
          </View>
        </View>

        <View style={{ height: 14 }} />

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMute} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search VIN, make, model, stock#..."
            placeholderTextColor={colors.textMute}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onSubmitEditing={Keyboard.dismiss}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMute} />
            </Pressable>
          )}
        </View>

        <View style={{ height: 14 }} />

        {/* Vehicle List */}
        {filtered.length === 0 ? (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Ionicons name="car-outline" size={32} color={colors.textMute} />
            <Text style={[styles.emptyText, { marginTop: 10 }]}>
              {search ? 'No matches' : 'No vehicles'}
            </Text>
          </GlassCard>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id || i.vehicle_id || i.vin}
            renderItem={({ item }) => (
              <VehicleCard
                item={item}
                onEdit={setEditing}
                onRemove={async (vid) => {
                  try {
                    await ctxDeleteVehicle(vid);
                    notificationSuccess();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to remove vehicle');
                  }
                }}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: listPaddingBottom }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
            }
          />
        )}

        {/* Editor Modal */}
        <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen">
          {editing ? (
            <View style={{ flex: 1, backgroundColor: colors.bg0 }}>
              <VehicleEditorScreen
                vehicle={editing}
                onCancel={() => setEditing(null)}
                onSave={async (nextVehicle) => {
                  try {
                    const vid = editing.id || editing.vehicle_id;
                    await ctxUpdateVehicle(vid, {
                      status: nextVehicle.status,
                      stock_number: (nextVehicle.stockNumber || '').trim() || undefined,
                      price: nextVehicle.price,
                      mileage: nextVehicle.mileage,
                      notes: nextVehicle.notes,
                    });
                    setEditing(null);
                    notificationSuccess();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to save changes');
                  }
                }}
              />
            </View>
          ) : null}
        </Modal>
      </Screen>
    </Pressable>
  );
}

/* ---------- Stack Navigator ---------- */
const Stack = createNativeStackNavigator();

export function IntakeScreen() {
  return (
    <Stack.Navigator
      id="IntakeStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: 'rgba(4,6,8,0.95)' },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '800',
          fontSize: 14,
        } as any,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg0 },
      } as any}
    >
      <Stack.Screen name="IntakeHub" component={IntakeHub} options={{ headerShown: false }} />
      <Stack.Screen name="VinScan" component={VinScanScreen} options={{ title: 'VIN SCANNER' }} />
      <Stack.Screen name="DlScan" component={DlScanScreen} options={{ title: "DRIVER'S LICENSE" }} />
    </Stack.Navigator>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  countBadge: {
    color: colors.gold,
    ...type.h1,
    fontSize: 22,
  },
  scanRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanCard: {
    flex: 1,
    height: 85,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.10)',
    backgroundColor: 'rgba(214,178,94,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  scanCardDl: {
    borderColor: 'rgba(255,45,45,0.10)',
    backgroundColor: 'rgba(255,45,45,0.03)',
  },
  scanLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.78)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  vehicleCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.78)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  vehicleTitle: {
    color: colors.text,
    ...type.h2,
    fontSize: 15,
  },
  vehicleVin: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  vehicleMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  vehicleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  dateText: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '600',
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHint: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 12,
    textAlign: 'center',
  },
});
