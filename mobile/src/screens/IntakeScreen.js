import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl, Alert, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { loadInventory, removeFromInventory, updateVehicle } from '../lib/inventory';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { VehicleEditorScreen } from './VehicleEditorScreen';
import { VinScanScreen } from './VinScanScreen';
import { DlScanScreen } from './DlScanScreen';

const STATUS_COLORS = {
  active: colors.green,
  trade: colors.gold,
  pending: colors.blue,
  sold: colors.textMute,
};

/* ---------- Vehicle Card ---------- */
function VehicleCard({ item, onEdit, onRemove }) {
  const title = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ');
  const statusColor = STATUS_COLORS[item.status] || colors.textMute;

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
          <Text style={[styles.statusText, { color: statusColor }]}>{(item.status || 'active').toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.vehicleMeta}>
        {item.stockNumber ? <Text style={styles.metaChip}>Stock: {item.stockNumber}</Text> : null}
        {typeof item.price === 'number' ? <Text style={styles.metaChip}>${item.price.toLocaleString()}</Text> : null}
        {typeof item.mileage === 'number' ? <Text style={styles.metaChip}>{item.mileage.toLocaleString()} mi</Text> : null}
      </View>

      <View style={styles.vehicleFooter}>
        <Text style={styles.dateText}>{new Date(item.addedAt).toLocaleDateString()}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            Alert.alert('Remove Vehicle', `Remove ${title || item.vin} from inventory?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemove(item.id) },
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
  const [inv, setInv] = useState({ vehicles: [] });
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const { triggerFlash } = useTaillightFlash();

  const refresh = useCallback(async () => {
    const data = await loadInventory();
    setInv(data);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = search.trim()
    ? inv.vehicles.filter((v) => {
        const q = search.toLowerCase();
        const text = [v.vin, v.year, v.make, v.model, v.trim, v.stockNumber, v.status].filter(Boolean).join(' ').toLowerCase();
        return text.includes(q);
      })
    : inv.vehicles;

  const stats = {
    total: inv.vehicles.length,
    active: inv.vehicles.filter((v) => v.status === 'active').length,
    trade: inv.vehicles.filter((v) => v.status === 'trade').length,
    sold: inv.vehicles.filter((v) => v.status === 'sold').length,
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
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <VehicleCard
                item={item}
                onEdit={setEditing}
                onRemove={async (id) => {
                  const next = await removeFromInventory(id);
                  setInv(next);
                  notificationSuccess();
                }}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
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
                  const next = await updateVehicle(editing.id, nextVehicle);
                  setInv(next);
                  setEditing(null);
                  notificationSuccess();
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
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: 'rgba(4,6,8,0.95)' },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '800',
          fontSize: 14,
          letterSpacing: 1.2,
        },
        headerBackTitleVisible: false,
        headerShadowVisible: false,
      }}
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
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.25)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scanCardDl: {
    borderColor: 'rgba(255,45,45,0.25)',
    backgroundColor: 'rgba(255,45,45,0.06)',
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
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.74)',
    alignItems: 'center',
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
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.30)',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  vehicleCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(8,10,12,0.74)',
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
