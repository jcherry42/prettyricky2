/**
 * Intake Hub — vehicle inventory list + VIN/DL scan entry points.
 *
 * Fixes in this version:
 *  - Editor opens as a pageSheet (swipe-down to close, never touches top of screen)
 *  - VehicleEditorScreen respects safe area insets (notch / Dynamic Island)
 *  - Vehicle cards show source badge (SCAN / MANUAL) so the origin is always clear
 *  - All VINs — scanned OR manually entered — appear here via the shared InventoryContext
 *  - Inventory list reloads automatically when screen comes into focus
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  Keyboard,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/constants';

// ──────────── Helpers ────────────
const STATUS_COLORS = {
  active:  colors.green,
  trade:   colors.gold,
  pending: colors.blue,
  sold:    colors.textMute,
};

function deriveDisplayStatus(v: any): string {
  if (v.status && v.status !== 'available') return v.status;
  if (v.category === 'trade_in') return 'trade';
  return 'active';
}

// ──────────── Vehicle Card ────────────
function VehicleCard({ item, onEdit, onRemove }) {
  const title      = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ');
  const displayStatus = deriveDisplayStatus(item);
  const statusColor   = STATUS_COLORS[displayStatus] || colors.textMute;
  const stockNum   = item.stockNumber || item.stock_number;
  const dateStr    = item.addedAt || item.created_at;
  const source     = item._source === 'manual' ? 'MANUAL'
                   : item._source === 'scan'   ? 'SCAN'
                   : item.source === 'manual'  ? 'MANUAL'
                   : null;

  return (
    <Pressable
      onPress={() => { impactLight(); onEdit(item); }}
      style={({ pressed }) => [styles.vehicleCard, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
    >
      {/* — Header row — */}
      <View style={styles.vehicleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle} numberOfLines={1}>
            {title || 'Unknown Vehicle'}
          </Text>
          <Text style={styles.vehicleVin} numberOfLines={1}>{item.vin}</Text>
        </View>

        <View style={styles.badgeCol}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { borderColor: `${statusColor}55` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {displayStatus.toUpperCase()}
            </Text>
          </View>
          {/* Source badge */}
          {source ? (
            <View style={styles.sourceBadge}>
              <Ionicons
                name={source === 'SCAN' ? 'scan-outline' : 'keypad-outline'}
                size={9}
                color={colors.textMute}
              />
              <Text style={styles.sourceText}>{source}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* — Meta chips — */}
      {(stockNum || item.price || item.mileage) ? (
        <View style={styles.vehicleMeta}>
          {stockNum ? (
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={10} color={colors.textMute} />
              <Text style={styles.metaChipText}>{stockNum}</Text>
            </View>
          ) : null}
          {typeof item.price === 'number' ? (
            <View style={styles.metaChip}>
              <Ionicons name="cash-outline" size={10} color={colors.textMute} />
              <Text style={styles.metaChipText}>${item.price.toLocaleString()}</Text>
            </View>
          ) : null}
          {typeof item.mileage === 'number' ? (
            <View style={styles.metaChip}>
              <Ionicons name="speedometer-outline" size={10} color={colors.textMute} />
              <Text style={styles.metaChipText}>{item.mileage.toLocaleString()} mi</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* — Footer row — */}
      <View style={styles.vehicleFooter}>
        <View style={styles.footerLeft}>
          <Ionicons name="time-outline" size={11} color={colors.textMute} />
          <Text style={styles.dateText}>
            {dateStr ? new Date(dateStr).toLocaleDateString() : '\u2014'}
          </Text>
        </View>

        <View style={styles.footerActions}>
          {/* Edit button */}
          <Pressable
            onPress={() => { impactLight(); onEdit(item); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="create-outline" size={14} color={colors.gold} />
          </Pressable>

          {/* Remove button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              const vid = item.id || item.vehicle_id;
              Alert.alert(
                'Remove Vehicle',
                `Remove ${title || item.vin} from inventory?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => onRemove(vid) },
                ],
              );
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.actionBtn, styles.removeBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="trash-outline" size={14} color={colors.red} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────── Intake Hub (main screen) ────────────
function IntakeHub({ navigation }) {
  const { vehicles, fetchInventory, deleteVehicle: ctxDeleteVehicle, updateVehicle: ctxUpdateVehicle } = useInventory();
  const [search, setSearch]       = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const { triggerFlash }           = useTaillightFlash();
  const insets                    = useSafeAreaInsets();
  const isFocused                 = useIsFocused();
  const listPaddingBottom         = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 20;

  // Fetch on mount
  useEffect(() => { fetchInventory().catch(() => {}); }, [fetchInventory]);

  // Re-fetch every time this screen comes into focus (catches VINs added from scanner)
  useEffect(() => {
    if (isFocused) { fetchInventory().catch(() => {}); }
  }, [isFocused, fetchInventory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchInventory(); } catch (_) {}
    setRefreshing(false);
  }, [fetchInventory]);

  const filtered = search.trim()
    ? vehicles.filter((v) => {
        const q    = search.toLowerCase();
        const text = [v.vin, v.year, v.make, v.model, v.trim, v.stockNumber, v.stock_number, deriveDisplayStatus(v)]
          .filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      })
    : vehicles;

  const stats = {
    total:   vehicles.length,
    active:  vehicles.filter((v) => deriveDisplayStatus(v) === 'active').length,
    trade:   vehicles.filter((v) => deriveDisplayStatus(v) === 'trade').length,
    sold:    vehicles.filter((v) => deriveDisplayStatus(v) === 'sold').length,
  };

  const handleSave = useCallback(async (nextVehicle: any) => {
    try {
      const vid = editing.id || editing.vehicle_id;
      await ctxUpdateVehicle(vid, {
        status:       nextVehicle.status,
        stock_number: nextVehicle.stockNumber?.trim() || undefined,
        price:        nextVehicle.price,
        mileage:      nextVehicle.mileage,
        notes:        nextVehicle.notes,
      });
      setEditing(null);
      notificationSuccess();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save changes');
    }
  }, [editing, ctxUpdateVehicle]);

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <ScreenHeader
          title="Intake"
          right={<Text style={styles.countBadge}>{stats.total}</Text>}
        />

        <View style={{ height: 14 }} />

        {/* ── Scan Action Cards ── */}
        <View style={styles.scanRow}>
          <Pressable
            onPress={() => { impactLight(); navigation.navigate('VinScan'); }}
            style={({ pressed }) => [styles.scanCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['rgba(214,178,94,0.10)', 'rgba(214,178,94,0.03)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="barcode-outline" size={24} color={colors.gold} />
            <Text style={styles.scanLabel}>VIN</Text>
            <Text style={styles.scanSub}>SCAN OR MANUAL</Text>
          </Pressable>

          <Pressable
            onPress={() => { impactLight(); navigation.navigate('DlScan'); }}
            style={({ pressed }) => [styles.scanCard, styles.scanCardDl, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['rgba(255,45,45,0.10)', 'rgba(255,45,45,0.03)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="card-outline" size={24} color="#FF2D2D" />
            <Text style={[styles.scanLabel, { color: '#FF2D2D' }]}>DL</Text>
            <Text style={styles.scanSub}>LICENSE SCAN</Text>
          </Pressable>
        </View>

        <View style={{ height: 14 }} />

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { value: stats.active, label: 'ACTIVE',  color: colors.green },
            { value: stats.trade,  label: 'TRADE',   color: colors.gold },
            { value: stats.sold,   label: 'SOLD',    color: colors.textMute },
          ].map(({ value, label, color }) => (
            <View key={label} style={styles.stat}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 14 }} />

        {/* ── Search ── */}
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
            <Pressable onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMute} />
            </Pressable>
          )}
        </View>

        <View style={{ height: 14 }} />

        {/* ── Vehicle List ── */}
        {filtered.length === 0 ? (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons name="car-outline" size={36} color={colors.textMute} />
            <Text style={[styles.emptyText, { marginTop: 10 }]}>
              {search ? 'No matches' : 'No vehicles yet'}
            </Text>
            <Text style={styles.emptyHint}>
              {search
                ? 'Try a different VIN, make, or model'
                : 'Tap VIN above to scan a barcode or enter manually'}
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
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                title="Refreshing inventory..."
                titleColor={colors.textMute}
              />
            }
          />
        )}

        {/* ── Vehicle Editor — pageSheet so iOS never covers top of screen ── */}
        <Modal
          visible={!!editing}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditing(null)}
        >
          {editing ? (
            <VehicleEditorScreen
              vehicle={editing}
              onCancel={() => setEditing(null)}
              onSave={handleSave}
            />
          ) : null}
        </Modal>
      </Screen>
    </Pressable>
  );
}

// ──────────── Stack Navigator ────────────
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
      <Stack.Screen name="IntakeHub"  component={IntakeHub}  options={{ headerShown: false }} />
      <Stack.Screen name="VinScan"   component={VinScanScreen} options={{ title: 'VIN SCANNER' }} />
      <Stack.Screen name="DlScan"    component={DlScanScreen}  options={{ title: "DRIVER'S LICENSE" }} />
    </Stack.Navigator>
  );
}

// ──────────── Styles ────────────
const styles = StyleSheet.create({
  countBadge: { color: colors.gold, ...type.h1, fontSize: 22 },

  // — Scan cards —
  scanRow: { flexDirection: 'row', gap: 12 },
  scanCard: {
    flex: 1,
    height: 90,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.14)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  scanCardDl: { borderColor: 'rgba(255,45,45,0.14)' },
  scanLabel:  { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 2.0 },
  scanSub:    { color: colors.textMute, fontSize: 9, fontWeight: '700', letterSpacing: 1.0 },

  // — Stats —
  statsRow: { flexDirection: 'row', gap: 10 },
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
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { marginTop: 2, color: colors.textMute, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  // — Search —
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
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },

  // — Vehicle card —
  vehicleCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.82)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  vehicleTitle: { color: colors.text, ...type.h2, fontSize: 15 },
  vehicleVin:   {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  badgeCol: { alignItems: 'flex-end', gap: 5 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.0 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sourceText: { color: colors.textMute, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },

  // — Meta chips —
  vehicleMeta: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  metaChipText: { color: colors.textMute, fontSize: 11, fontWeight: '700' },

  // — Footer —
  vehicleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateText:      { color: colors.textMute, fontSize: 10, fontWeight: '600' },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.06)',
  },

  // — Empty state —
  emptyText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  emptyHint: { marginTop: 6, color: colors.textMute, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
