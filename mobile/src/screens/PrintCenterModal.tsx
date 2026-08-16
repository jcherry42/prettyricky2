/**
 * PrintCenterModal — Professional Print Hub
 *
 * Three tabs: Customer Profile | Driver's License | Vehicle Spec Sheet
 * Each tab generates a branded PDF and either sends it to an IPP printer
 * or offers a share/download fallback via Linking.
 *
 * Strategies emulated:
 *   - HP Smart: Tab-based print type selection, preview thumbnail
 *   - Canon PRINT: Status indicators per printer, progress feedback
 *   - Apple AirPrint: Minimal UI, instant action affordance
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/errors';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers, type CustomerRecord } from '../context/CustomerContext';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleRecord = Record<string, any> & { id?: string; vin?: string; vehicle_id?: string };
import { useInventory } from '../context/InventoryContext';
import { apiFetch } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'customer' | 'license' | 'vehicle';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'customer', label: 'Customer', icon: 'person' },
  { key: 'license',  label: 'License',  icon: 'card' },
  { key: 'vehicle',  label: 'Vehicle',  icon: 'car-sport' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  preSelectedCustomerId?: string;
  preSelectedVin?: string;
  preSelectedVehicle?: VehicleRecord;
  preSelectedLicenseImage?: string;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ActionButton({ label, icon, onPress, disabled, loading, testID }: {
  label: string; icon: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, (disabled || loading || pressed) && styles.btnDim]}
    >
      <LinearGradient
        colors={['rgba(214,178,94,0.15)', 'rgba(214,178,94,0.05)']}
        style={styles.btnGrad}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.gold} />
          : <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.gold} />
        }
        <Text style={styles.btnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const CustomerItem = memo(function CustomerItem({ item, selected, onPress }: { item: CustomerRecord; selected: boolean; onPress: (id: string) => void }) {
  const first = (item.first_name || '').trim();
  const last = (item.last_name || '').trim();
  const name = `${first} ${last}`.trim() || item.name || 'Unknown';
  return (
    <Pressable
      testID={`print-customer-item-${(item.id || item.customer_id) as string}`}
      onPress={() => onPress((item.id || item.customer_id) as string)}
      style={[styles.listItem, selected && styles.listItemSelected]}
    >
      <View style={[styles.listDot, selected && styles.listDotActive]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.listName, selected && styles.listNameActive]} numberOfLines={1}>{name}</Text>
        {item.email ? <Text style={styles.listSub} numberOfLines={1}>{item.email}</Text> : null}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
});

const VehicleItem = memo(function VehicleItem({ item, selected, onPress }: { item: VehicleRecord; selected: boolean; onPress: (v: VehicleRecord) => void }) {
  const label = [item.year, item.make, item.model, item.trim].filter(Boolean).join(' ') || item.vin;
  return (
    <Pressable
      testID={`print-vehicle-item-${item.vin || item.id}`}
      onPress={() => onPress(item)}
      style={[styles.listItem, selected && styles.listItemSelected]}
    >
      <View style={[styles.listDot, selected && styles.listDotActive]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.listName, selected && styles.listNameActive]} numberOfLines={1}>{label}</Text>
        <Text style={styles.listSub} numberOfLines={1}>{item.vin}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

export const PrintCenterModal = memo(function PrintCenterModal({
  visible,
  onClose,
  preSelectedCustomerId,
  preSelectedVin,
  preSelectedVehicle,
  preSelectedLicenseImage,
}: Props) {
  const insets = useSafeAreaInsets();
  const { settings: _settings, activePrinter } = useAppSettings();
  const { customers } = useCustomers();
  const { vehicles } = useInventory();

  const [tab, setTab] = useState<TabKey>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);
  const [printing, setPrinting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Reset all local state whenever the modal opens (or preSelected props change).
  // This prevents stale selections carrying over from a previous session.
  useEffect(() => {
    if (!visible) return;
    setLastResult(null);
    setPrinting(false);
    setSelectedCustomerId(preSelectedCustomerId || '');
    setSelectedVehicle(preSelectedVehicle || null);
    // Derive the correct starting tab from whatever was pre-selected
    if (preSelectedVin || preSelectedVehicle) {
      setTab('vehicle');
    } else if (preSelectedLicenseImage) {
      setTab('license');
    } else {
      setTab('customer');
    }
  }, [visible, preSelectedCustomerId, preSelectedVehicle, preSelectedVin, preSelectedLicenseImage]);

  const printerIp = activePrinter?.ip || '';
  const hasPrinter = !!printerIp;

  // ── Handlers ──

  const handlePrintCustomer = useCallback(async () => {
    if (!selectedCustomerId) {
      Alert.alert('Select a Customer', 'Choose a customer profile to print.');
      return;
    }
    setPrinting(true);
    setLastResult(null);
    try {
      const res = await apiFetch('/api/print/customer', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedCustomerId, printer_ip: printerIp }),
        timeout: 20000,
      });
      const msg = res.printer?.sent
        ? 'Sent to printer successfully'
        : `PDF generated (${Math.round(res.bytes / 1024)} KB)`;
      setLastResult(msg);
    } catch (e: unknown) {
      setLastResult(`Error: ${errorMessage(e)}`);
    } finally {
      setPrinting(false);
    }
  }, [selectedCustomerId, printerIp]);

  const handlePrintLicense = useCallback(async () => {
    if (!preSelectedLicenseImage) {
      Alert.alert('No License', 'Scan a driver\'s license first, then print.');
      return;
    }
    setPrinting(true);
    setLastResult(null);
    try {
      const res = await apiFetch('/api/print/license', {
        method: 'POST',
        body: JSON.stringify({ image_data: preSelectedLicenseImage, printer_ip: printerIp }),
        timeout: 20000,
      });
      const msg = res.printer?.sent
        ? 'Sent to printer successfully'
        : `PDF generated (${Math.round(res.bytes / 1024)} KB)`;
      setLastResult(msg);
    } catch (e: unknown) {
      setLastResult(`Error: ${errorMessage(e)}`);
    } finally {
      setPrinting(false);
    }
  }, [preSelectedLicenseImage, printerIp]);

  const handlePrintVehicle = useCallback(async () => {
    const v = selectedVehicle;
    if (!v) {
      Alert.alert('Select a Vehicle', 'Choose a vehicle from inventory to print.');
      return;
    }
    setPrinting(true);
    setLastResult(null);
    try {
      const { vin, category, customer_id: _cid, vehicle_id: _vid, status: _st, _queued, ...vehicleData } = v;
      const res = await apiFetch('/api/print/vehicle', {
        method: 'POST',
        body: JSON.stringify({
          vin: vin || 'UNKNOWN',
          vehicle_data: vehicleData,
          category: category || '',
          printer_ip: printerIp,
        }),
        timeout: 20000,
      });
      const msg = res.printer?.sent
        ? 'Sent to printer successfully'
        : `PDF generated (${Math.round(res.bytes / 1024)} KB)`;
      setLastResult(msg);
    } catch (e: unknown) {
      setLastResult(`Error: ${errorMessage(e)}`);
    } finally {
      setPrinting(false);
    }
  }, [selectedVehicle, printerIp]);

  // ── Render ──

  // ── Tab renders — proper components, not useMemo JSX (avoids stale FlatList data) ──

  const CustomerTab = () => (
    <View style={{ flex: 1 }}>
      <Text style={styles.tabDesc}>Select a customer to generate a branded profile PDF.</Text>
      <FlatList
        data={customers}
        keyExtractor={(c: CustomerRecord) => (c.id || c.customer_id || c.email || c.phone || 'unknown') as string}
        renderItem={({ item }) => (
          <CustomerItem
            item={item}
            selected={selectedCustomerId === (item.id || item.customer_id)}
            onPress={setSelectedCustomerId}
          />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people" size={40} color={colors.textMute} />
            <Text style={styles.emptyText}>No customers yet</Text>
          </View>
        }
      />
      <ActionButton
        testID="print-customer-btn"
        label={hasPrinter ? 'Print Customer Profile' : 'Generate PDF'}
        icon="print"
        onPress={handlePrintCustomer}
        disabled={!selectedCustomerId}
        loading={printing && tab === 'customer'}
      />
    </View>
  );

  const LicenseTab = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
      {preSelectedLicenseImage ? (
        <>
          <View style={styles.licensePreview}>
            <Ionicons name="card" size={48} color={colors.gold} />
            <Text style={styles.licensePreviewText}>License scan ready to print</Text>
          </View>
          <ActionButton
            testID="print-license-btn"
            label={hasPrinter ? 'Print License Scan' : 'Generate PDF'}
            icon="print"
            onPress={handlePrintLicense}
            loading={printing && tab === 'license'}
          />
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Ionicons name="scan" size={48} color={colors.textMute} />
          <Text style={styles.emptyText}>No license scanned</Text>
          <Text style={styles.emptyHint}>Use the DL Scanner first, then come back to print.</Text>
        </View>
      )}
    </View>
  );

  const VehicleTab = () => (
    <View style={{ flex: 1 }}>
      <Text style={styles.tabDesc}>Select a vehicle to generate a branded spec sheet PDF.</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(v: VehicleRecord) => (v.vehicle_id || v.id || v.vin || String(v.year) + String(v.make)) as string}
        renderItem={({ item }) => (
          <VehicleItem
            item={item}
            selected={selectedVehicle?.vin === item.vin}
            onPress={setSelectedVehicle}
          />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="car" size={40} color={colors.textMute} />
            <Text style={styles.emptyText}>No vehicles in inventory</Text>
            <Text style={styles.emptyHint}>Decode a VIN first to add vehicles.</Text>
          </View>
        }
      />
      <ActionButton
        testID="print-vehicle-btn"
        label={hasPrinter ? 'Print Spec Sheet' : 'Generate PDF'}
        icon="print"
        onPress={handlePrintVehicle}
        disabled={!selectedVehicle}
        loading={printing && tab === 'vehicle'}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
        {/* ── Header ── */}
        <LinearGradient
          colors={['rgba(20,14,8,0.95)', 'rgba(12,8,4,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View>
            <Text style={styles.headerTitle}>PRINT CENTER</Text>
            <View style={styles.printerStatus}>
              <View style={[styles.statusDot, hasPrinter ? styles.statusDotOn : styles.statusDotOff]} />
              <Text style={styles.statusText}>
                {hasPrinter ? activePrinter?.name || activePrinter?.ip : 'No printer configured'}
              </Text>
            </View>
          </View>
          <Pressable testID="print-center-close-btn" accessibilityRole="button" accessibilityLabel="Close print center" onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </LinearGradient>

        {/* ── Tabs ── */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              testID={`print-tab-${t.key}`}
              onPress={() => { setTab(t.key); setLastResult(null); }}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={16} color={tab === t.key ? colors.gold : colors.textMute} />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>
          {tab === 'customer' && <CustomerTab />}
          {tab === 'license' && <LicenseTab />}
          {tab === 'vehicle' && <VehicleTab />}
        </View>

        {/* ── Status bar ── */}
        {lastResult && (
          <View style={[styles.statusBar, lastResult.startsWith('Error') && styles.statusBarError]}>
            <Ionicons
              name={lastResult.startsWith('Error') ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={lastResult.startsWith('Error') ? '#FF4444' : colors.gold}
            />
            <Text style={[styles.statusBarText, lastResult.startsWith('Error') && { color: '#FF6666' }]}>
              {lastResult}
            </Text>
          </View>
        )}

        <View style={{ height: insets.bottom + 8 }} />
      </LinearGradient>
    </Modal>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(214,178,94,0.25)',
  },
  headerTitle: {
    ...type.label,
    fontSize: 16,
    color: colors.gold,
    letterSpacing: 2,
  },
  printerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  statusDotOff: {
    backgroundColor: colors.textMute,
  },
  statusText: {
    ...type.caption,
    fontSize: 11,
    color: colors.textDim,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
  },
  tabActive: {
    borderColor: 'rgba(214,178,94,0.35)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    shadowColor: 'rgba(214,178,94,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  tabLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.textMute,
  },
  tabLabelActive: {
    color: colors.gold,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tabDesc: {
    ...type.bodyDim,
    fontSize: 12,
    color: colors.textMute,
    marginBottom: 10,
  },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  listItemSelected: {
    borderColor: 'rgba(214,178,94,0.35)',
    backgroundColor: 'rgba(214,178,94,0.06)',
    shadowColor: 'rgba(214,178,94,0.25)',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  listDotActive: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  listName: {
    ...type.body,
    color: colors.text,
    fontWeight: '600',
  },
  listNameActive: {
    color: colors.gold,
  },
  listSub: {
    ...type.caption,
    color: colors.textMute,
    marginTop: 2,
  },

  // Action button
  btn: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.18)',
    shadowColor: 'rgba(214,178,94,0.50)',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  btnDim: {
    opacity: 0.5,
  },
  btnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  btnText: {
    ...type.label,
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 1,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    ...type.subtitle,
    color: colors.textDim,
    fontSize: 14,
  },
  emptyHint: {
    ...type.caption,
    color: colors.textMute,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // License preview
  licensePreview: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: 30,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.15)',
    backgroundColor: 'rgba(214,178,94,0.04)',
    marginBottom: 20,
    width: '100%',
  },
  licensePreviewText: {
    ...type.subtitle,
    color: colors.textDim,
  },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(214,178,94,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.15)',
  },
  statusBarError: {
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderColor: 'rgba(255,68,68,0.15)',
  },
  statusBarText: {
    ...type.body,
    fontSize: 12,
    color: colors.gold,
    flex: 1,
  },
});
