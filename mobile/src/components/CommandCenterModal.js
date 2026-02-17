import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, FlatList, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers } from '../context/CustomerContext';
import { useInventory } from '../context/InventoryContext';

const TABS = [
  { key: 'dashboard', label: 'DASHBOARD', icon: 'stats-chart' },
  { key: 'customers', label: 'CUSTOMERS', icon: 'people' },
  { key: 'inventory', label: 'INVENTORY', icon: 'car-sport' },
  { key: 'printers', label: 'PRINTERS', icon: 'print' },
  { key: 'settings', label: 'SETTINGS', icon: 'settings' },
];

function TabButton({ label, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
      <Ionicons name={icon} size={14} color={active ? colors.gold : colors.textMute} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/* --- Liquid Glass Language Button --- */
function LangGlass({ flag, active, onPress }) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <View style={[styles.langGlassOuter, active && styles.langGlassOuterActive]}>
        <LinearGradient
          colors={
            active
              ? ['rgba(214,178,94,0.18)', 'rgba(214,178,94,0.06)', 'rgba(0,0,0,0.10)']
              : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.12)']
          }
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
        />
        <View style={[styles.langGlassInner, active && styles.langGlassInnerActive]}>
          <LinearGradient
            colors={
              active
                ? ['rgba(214,178,94,0.10)', 'rgba(214,178,94,0.03)', 'rgba(0,0,0,0.08)']
                : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.10)']
            }
            locations={[0, 0.45, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
          />
          <Text style={styles.langFlag}>{flag}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const LANGS = [
  { code: 'es', flag: '\ud83c\uddf2\ud83c\uddfd' },
  { code: 'fr', flag: '\ud83c\uddeb\ud83c\uddf7' },
  { code: 'ko', flag: '\ud83c\uddf0\ud83c\uddf7' },
];

function PrinterRow({ item, active, onSetActive, onRemove }) {
  return (
    <View style={styles.printerRow}>
      <Pressable onPress={() => { impactLight(); onSetActive(item.id); }} style={({ pressed }) => [styles.radio, active && styles.radioActive, pressed && { opacity: 0.9 }]}>
        <View style={[styles.radioDot, active && { backgroundColor: colors.gold }]} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.printerName}>{item.name}</Text>
        <Text style={styles.printerIp}>{item.ip}</Text>
      </View>
      <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name="trash-outline" size={14} color={colors.red} />
      </Pressable>
    </View>
  );
}

export function CommandCenterModal({ visible, onClose }) {
  const { settings, setDefaultTargetLanguage, setEcoMode, upsertPrinter, removePrinter, setActivePrinter, activePrinter } = useAppSettings();
  const { customers, fetchCustomers, createCustomer, loading: customersLoading } = useCustomers();
  const { vehicles, loading: vehiclesLoading, isAtLimit, maxInventory, deleteVehicle, fetchInventory } = useInventory();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [printerName, setPrinterName] = useState('');
  const [ipParts, setIpParts] = useState(['', '', '', '']);
  const [printerTest, setPrinterTest] = useState({ state: 'idle', message: '' });

  // Dashboard stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');

  // Inventory search
  const [inventorySearch, setInventorySearch] = useState('');

  const ipInputRefs = useRef([]);

  const fullIp = useMemo(() => ipParts.join('.'), [ipParts]);

  const selectedLang = settings.defaultTargetLanguage || 'es';
  const canTestPrinter = useMemo(() => Boolean(activePrinter?.ip), [activePrinter]);

  const canSavePrinter = useMemo(() => {
    if (!fullIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(fullIp)) return false;
    const octets = fullIp.split('.');
    return octets.every((part) => {
      const n = Number(part);
      return Number.isFinite(n) && n >= 0 && n <= 255;
    });
  }, [fullIp]);

  const updateIpPart = useCallback((index, value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3);
    setIpParts((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });

    if (cleaned.length === 3 && index < 3) {
      const nextRef = ipInputRefs.current[index + 1];
      if (nextRef && typeof nextRef.focus === 'function') {
        nextRef.focus();
      }
    }
  }, []);

  const testActivePrinter = useCallback(async () => {
    if (!activePrinter?.ip) return;
    try {
      setPrinterTest({ state: 'loading', message: '' });
      const res = await apiFetch('/api/printer/test', {
        method: 'POST',
        body: JSON.stringify({ ip: activePrinter.ip }),
      });
      if (res?.success) {
        setPrinterTest({ state: 'ok', message: res.printer_name || 'Connected' });
      } else {
        setPrinterTest({ state: 'error', message: res?.error || 'Failed' });
      }
    } catch (e) {
      setPrinterTest({ state: 'error', message: String(e?.message || e) });
    }
  }, [activePrinter]);

  // Load dashboard stats
  const loadDashboardStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiFetch('/api/dashboard/stats');
      setStats(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load dashboard stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const query = customerSearch.toLowerCase();
    return customers.filter((c) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [customers, customerSearch]);

  // Filtered inventory for search
  const filteredVehicles = useMemo(() => {
    if (!inventorySearch.trim()) return vehicles;
    const query = inventorySearch.toLowerCase();
    return vehicles.filter((v) => {
      const vin = (v.vin || '').toLowerCase();
      const year = (v.year || '').toString().toLowerCase();
      const make = (v.make || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const label = `${year} ${make} ${model}`.toLowerCase();
      return vin.includes(query) || label.includes(query);
    });
  }, [vehicles, inventorySearch]);

  // Load stats when dashboard tab is selected
  React.useEffect(() => {
    if (visible && activeTab === 'dashboard' && !stats) {
      loadDashboardStats();
    }
  }, [visible, activeTab, stats, loadDashboardStats]);

  // Load inventory when inventory tab is selected
  React.useEffect(() => {
    if (visible && activeTab === 'inventory') {
      fetchInventory();
    }
  }, [visible, activeTab, fetchInventory]);

  const handleDeleteVehicle = useCallback(async (vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Remove ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} from inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              impactMedium();
              await deleteVehicle(vehicle.vehicle_id);
              notificationSuccess();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  }, [deleteVehicle]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="settings" size={16} color={colors.gold} />
              <Text style={styles.headerTitle}>COMMAND CENTER</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TabButton key={t.key} label={t.label} icon={t.icon} active={activeTab === t.key} onPress={() => {
                impactLight();
                setActiveTab(t.key);
              }} />
            ))}
          </View>

          {/* DASHBOARD */}
          {activeTab === 'dashboard' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {loadingStats ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator color={colors.gold} size="large" />
                  <Text style={styles.loadingText}>Loading dashboard...</Text>
                </View>
              ) : stats ? (
                <>
                  <GlassCard style={{ marginTop: 14 }}>
                    <SectionTitle>Overview</SectionTitle>
                    <View style={{ height: 12 }} />
                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Ionicons name="people" size={24} color={colors.blue} />
                        <Text style={styles.statValue}>{stats.customers?.total || 0}</Text>
                        <Text style={styles.statLabel}>Customers</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name="car" size={24} color={colors.green} />
                        <Text style={styles.statValue}>{stats.vehicles?.total || 0}</Text>
                        <Text style={styles.statLabel}>Vehicles</Text>
                      </View>
                    </View>
                  </GlassCard>

                  <GlassCard style={{ marginTop: 14 }}>
                    <SectionTitle>Lead Status</SectionTitle>
                    <View style={{ height: 12 }} />
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.blue }]} />
                      <Text style={styles.statusText}>New: {stats.customers?.new || 0}</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.gold }]} />
                      <Text style={styles.statusText}>Contacted: {stats.customers?.contacted || 0}</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
                      <Text style={styles.statusText}>Appointment: {stats.customers?.appointment || 0}</Text>
                    </View>
                  </GlassCard>
                </>
              ) : (
                <GlassCard style={{ marginTop: 14 }}>
                  <Text style={styles.emptyText}>No data available</Text>
                </GlassCard>
              )}
            </ScrollView>
          ) : null}

          {/* CUSTOMERS */}
          {activeTab === 'customers' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.searchHeader}>
                  <Ionicons name="search" size={16} color={colors.gold} />
                  <TextInput
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder="Search customers..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                  />
                  {customerSearch.length > 0 && (
                    <Pressable onPress={() => setCustomerSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMute} />
                    </Pressable>
                  )}
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.customerHeader}>
                  <SectionTitle>Customer List</SectionTitle>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{filteredCustomers.length}</Text>
                  </View>
                </View>
                <View style={{ height: 10 }} />

                {customersLoading ? (
                  <View style={styles.centerContent}>
                    <ActivityIndicator color={colors.gold} />
                  </View>
                ) : filteredCustomers.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="people-outline" size={32} color={colors.textMute} />
                    <Text style={styles.emptyText}>
                      {customerSearch ? 'No customers found' : 'No customers yet'}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredCustomers.slice(0, 10)}
                    keyExtractor={(item) => item.customer_id}
                    renderItem={({ item }) => (
                      <View style={styles.customerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.customerName}>
                            {`${item.first_name || ''} ${item.last_name || ''}`.trim()}
                          </Text>
                          <Text style={styles.customerPhone}>{item.phone || '—'}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: item.lead_status === 'new' ? colors.blue : colors.gold }]}>
                          <Text style={styles.statusPillText}>{(item.lead_status || 'new').toUpperCase()}</Text>
                        </View>
                      </View>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    scrollEnabled={false}
                  />
                )}

                {filteredCustomers.length > 10 && (
                  <Text style={styles.moreText}>Showing 10 of {filteredCustomers.length} customers</Text>
                )}
              </GlassCard>
            </ScrollView>
          ) : null}

          {/* INVENTORY */}
          {activeTab === 'inventory' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.searchHeader}>
                  <Ionicons name="search" size={16} color={colors.gold} />
                  <TextInput
                    value={inventorySearch}
                    onChangeText={setInventorySearch}
                    placeholder="Search VIN, year, make, model..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                  />
                  {inventorySearch.length > 0 && (
                    <Pressable onPress={() => setInventorySearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMute} />
                    </Pressable>
                  )}
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.inventoryHeader}>
                  <SectionTitle>Vehicle Inventory</SectionTitle>
                  <View style={[styles.countBadge, isAtLimit && { backgroundColor: colors.red }]}>
                    <Text style={styles.countText}>{vehicles.length}/{maxInventory}</Text>
                  </View>
                </View>
                {isAtLimit && (
                  <View style={styles.limitWarning}>
                    <Ionicons name="warning" size={14} color={colors.red} />
                    <Text style={styles.limitText}>Inventory limit reached</Text>
                  </View>
                )}
                <View style={{ height: 10 }} />

                {vehiclesLoading ? (
                  <View style={styles.centerContent}>
                    <ActivityIndicator color={colors.gold} />
                  </View>
                ) : filteredVehicles.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="car-sport-outline" size={32} color={colors.textMute} />
                    <Text style={styles.emptyText}>
                      {inventorySearch ? 'No vehicles found' : 'No vehicles in inventory'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {inventorySearch ? 'Try a different search' : 'Scan VINs to add vehicles'}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredVehicles}
                    keyExtractor={(item) => item.vehicle_id || item.vin}
                    renderItem={({ item }) => (
                      <View style={styles.vehicleCard}>
                        <View style={styles.quiltedPattern} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vehicleLabel}>
                            {[item.year, item.make, item.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                          </Text>
                          {item.trim && (
                            <Text style={styles.vehicleTrim}>{item.trim}</Text>
                          )}
                          <View style={styles.vinRow}>
                            <Ionicons name="barcode" size={12} color={colors.gold} />
                            <Text style={styles.vinText}>{item.vin}</Text>
                          </View>
                          {item.saved_at && (
                            <Text style={styles.vehicleDate}>
                              Added {new Date(item.saved_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => handleDeleteVehicle(item)}
                          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.6 }]}
                        >
                          <Ionicons name="trash" size={18} color={colors.red} />
                        </Pressable>
                        <View style={styles.stitchingTop} />
                        <View style={styles.stitchingBottom} />
                      </View>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    scrollEnabled={false}
                  />
                )}

                {filteredVehicles.length > 0 && !inventorySearch && (
                  <View style={styles.inventoryFooter}>
                    <Text style={styles.inventoryFooterText}>
                      {maxInventory - vehicles.length} slots remaining
                    </Text>
                  </View>
                )}
              </GlassCard>
            </ScrollView>
          ) : null}

          {/* PRINTERS */}
          {activeTab === 'settings' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Language</SectionTitle>
                <View style={{ height: 14 }} />
                <View style={styles.langRow}>
                  {LANGS.map((l) => (
                    <LangGlass
                      key={l.code}
                      flag={l.flag}
                      active={selectedLang === l.code}
                      onPress={() => setDefaultTargetLanguage(l.code)}
                    />
                  ))}
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Eco Mode</SectionTitle>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={() => { impactLight(); setEcoMode(!settings.ecoMode); }}
                  style={({ pressed }) => [styles.toggle, settings.ecoMode && styles.toggleOn, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.toggleDot, settings.ecoMode && styles.toggleDotOn]} />
                  <Text style={[styles.toggleText, settings.ecoMode && { color: colors.gold }]}>{settings.ecoMode ? 'ON' : 'OFF'}</Text>
                </Pressable>
              </GlassCard>
            </ScrollView>
          ) : null}

          {/* PRINTERS */}
          {activeTab === 'printers' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Active printer */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Active Printer</SectionTitle>
                <View style={{ height: 10 }} />
                {activePrinter ? (
                  <View style={styles.activePrinterBox}>
                    <Text style={styles.printerName}>{activePrinter.name}</Text>
                    <Text style={styles.printerIp}>{activePrinter.ip}</Text>
                  </View>
                ) : (
                  <View style={styles.activePrinterBox}>
                    <Text style={[styles.printerIp, { marginTop: 0 }]}>None configured</Text>
                  </View>
                )}

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={testActivePrinter}
                  disabled={!canTestPrinter || printerTest.state === 'loading'}
                  style={({ pressed }) => [styles.btn, (!canTestPrinter || printerTest.state === 'loading' || pressed) && { opacity: 0.7 }]}
                >
                  <Ionicons name="wifi" size={14} color={colors.gold} />
                  <Text style={styles.btnText}>Test</Text>
                  {printerTest.state === 'loading' && <ActivityIndicator color={colors.gold} style={{ marginLeft: 8 }} />}
                </Pressable>

                {printerTest.state === 'ok' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                    <Text style={[styles.statusText, { color: colors.green }]}>{printerTest.message}</Text>
                  </View>
                )}
                {printerTest.state === 'error' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.red} />
                    <Text style={[styles.statusText, { color: colors.red }]}>{printerTest.message}</Text>
                  </View>
                )}
              </GlassCard>

              {/* Saved printers */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Saved Printers</SectionTitle>
                <View style={{ height: 10 }} />

                {(settings.printers || []).length === 0 ? (
                  <View style={styles.activePrinterBox}>
                    <Text style={[styles.printerIp, { marginTop: 0 }]}>No printers saved</Text>
                  </View>
                ) : (
                  <FlatList
                    data={settings.printers || []}
                    keyExtractor={(i) => i.id}
                    renderItem={({ item }) => (
                      <PrinterRow
                        item={item}
                        active={settings.activePrinterId === item.id}
                        onSetActive={setActivePrinter}
                        onRemove={removePrinter}
                      />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    scrollEnabled={false}
                  />
                )}
              </GlassCard>

              {/* Add printer */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Add Printer</SectionTitle>
                <View style={{ height: 10 }} />
                <TextInput
                  value={printerName}
                  onChangeText={setPrinterName}
                  placeholder="Name"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                />
                <View style={{ height: 8 }} />
                <View style={styles.ipRow}>
                  {ipParts.map((segment, idx) => (
                    <React.Fragment key={idx}>
                      <TextInput
                        ref={(el) => {
                          ipInputRefs.current[idx] = el;
                        }}
                        value={segment}
                        onChangeText={(txt) => updateIpPart(idx, txt)}
                        placeholder={idx === 0 ? '192' : idx === 1 ? '168' : '0'}
                        placeholderTextColor={colors.textMute}
                        style={[styles.input, styles.ipSegment]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      {idx < 3 && (
                        <Text style={styles.ipDot}>.</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={async () => {
                    if (!canSavePrinter) return;
                    impactLight();
                    await upsertPrinter({ name: printerName.trim() || 'Printer', ip: fullIp });
                    setPrinterName('');
                    setIpParts(['', '', '', '']);
                  }}
                  disabled={!canSavePrinter}
                  style={({ pressed }) => [styles.btn, (!canSavePrinter || pressed) && { opacity: 0.7 }]}
                >
                  <Ionicons name="add-circle" size={16} color={colors.gold} />
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </GlassCard>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,12,16,0.96)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  tabText: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: colors.gold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langGlassOuter: {
    flex: 1,
    marginHorizontal: 1,
    height: 86,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(20,24,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.30)',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  langGlassOuterActive: {
    borderColor: 'rgba(214,178,94,0.50)',
    shadowColor: 'rgba(214,178,94,0.30)',
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  langGlassInner: {
    width: '94%',
    height: '82%',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(25,28,35,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  langGlassInnerActive: {
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(214,178,94,0.06)',
  },
  langFlag: {
    fontSize: 36,
  },
  toggle: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  toggleOn: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  toggleDotOn: {
    backgroundColor: colors.gold,
  },
  toggleText: {
    marginLeft: 10,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
  },
  activePrinterBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  printerRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: 'rgba(214,178,94,0.80)',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  printerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  printerIp: {
    marginTop: 4,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ipSegment: {
    flex: 1,
    textAlign: 'center',
  },
  ipDot: {
    color: colors.textMute,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 2,
  },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.20)',
    backgroundColor: 'rgba(255,45,45,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Dashboard styles
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    color: colors.textMute,
    fontSize: 13,
    textAlign: 'center',
  },
  // Customer tab styles
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: colors.bg0,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  customerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  customerPhone: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  moreText: {
    color: colors.textMute,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  // Inventory tab styles
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255,45,45,0.1)',
    borderRadius: 8,
  },
  limitText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  vehicleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  vehicleTrim: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  vinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  vinText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  vehicleDate: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,45,45,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  inventoryFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  inventoryFooterText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  emptySubtext: {
    color: colors.textMute,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
