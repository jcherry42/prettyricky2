import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, FlatList, ScrollView, Alert, Platform, Keyboard, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { EmptyState } from './EmptyState';
import { SkeletonLine } from './LoadingSkeleton';
import { BackendUrlSection } from './BackendUrlSection';
import { useAppSettings, type Printer } from '../context/AppSettingsContext';
// Vehicle row shape used inside CommandCenterModal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleRow = Record<string, any> & { id?: string; vin?: string; year?: number | string; make?: string; model?: string };
import { useCustomers, type CustomerRecord } from '../context/CustomerContext';
import { useInventory } from '../context/InventoryContext';
import { useLingo, useMode } from '../context/ModeContext';
import { apiFetch } from '../lib/api';
import { designoColors } from '../theme/designo';

const TABS = [
  { key: 'dashboard', label: 'DASHBOARD', icon: 'stats-chart' },
  { key: 'customers', label: 'CUSTOMERS', icon: 'people' },
  { key: 'inventory', label: 'INVENTORY', icon: 'car-sport' },
  { key: 'printers', label: 'PRINTERS', icon: 'print' },
  { key: 'settings', label: 'SETTINGS', icon: 'settings' },
];

function TabButton({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}>
      {/* Glass base */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: active ? 'rgba(18,14,6,0.88)' : 'rgba(20,24,32,0.80)' }]} />
      {/* Gradient tint — richer gold when active */}
      <LinearGradient
        colors={active
          ? ['rgba(214,178,94,0.52)', 'rgba(214,178,94,0.18)', 'rgba(120,90,30,0.10)']
          : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.12)']
        }
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      {/* Second gold wash layer for depth */}
      {active && (
        <LinearGradient
          colors={['rgba(214,178,94,0.12)', 'transparent', 'rgba(214,178,94,0.08)']}
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      )}
      {/* Bright specular highlight */}
      <View style={{ position: 'absolute', top: 3, left: '18%', right: '18%', height: 7, borderRadius: 4, backgroundColor: active ? 'rgba(255,220,140,0.32)' : 'rgba(255,255,255,0.14)' }} />
      {/* Secondary bottom reflection */}
      {active && <View style={{ position: 'absolute', bottom: 4, left: '25%', right: '25%', height: 4, borderRadius: 2, backgroundColor: 'rgba(214,178,94,0.12)' }} />}
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color={active ? '#F0D87A' : colors.textMute} style={active ? { textShadowColor: 'rgba(214,178,94,0.90)', textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } } : undefined} />
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/* --- Liquid Glass Language Button --- */
function LangGlass({ flag, name, active, onPress }: { flag: string; name: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      style={({ pressed }) => [styles.langPressable, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${name} language`}
      accessibilityState={{ selected: active }}
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
          <Text style={[styles.langName, active && styles.langNameActive]}>{name}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const LANGS = [
  { code: 'es', flag: '\ud83c\uddf2\ud83c\uddfd', name: 'ESPAÑOL' },
  { code: 'fr', flag: '\ud83c\uddeb\ud83c\uddf7', name: 'FRANÇAIS' },
  { code: 'ko', flag: '\ud83c\uddf0\ud83c\uddf7', name: '한국어' },
];

function PrinterRow({ item, active, onSetActive, onRemove }: { item: Printer; active: boolean; onSetActive: (id: string) => void; onRemove: (id: string) => void }) {
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

export function CommandCenterModal({ visible, onClose, initialTab = null, initialSection = null }: { visible: boolean; onClose: () => void; initialTab?: string | null; initialSection?: string | null }) {
  const { settings, setDefaultTargetLanguage, setServiceMode, setPerformanceMode, upsertPrinter, removePrinter, setActivePrinter, activePrinter, toggleAmbientLighting, setAmbientLightingIntensity, setSoundProfile, setSalesRepName, setDealershipName, setDealershipAddress } = useAppSettings();
  const { customers, loading: customersLoading, fetchCustomers } = useCustomers();
  const { vehicles, loading: vehiclesLoading, isAtLimit, maxInventory, deleteVehicle, fetchInventory } = useInventory();
  const lingo = useLingo();
  const { isService } = useMode();
  const [activeTab, setActiveTab] = useState('dashboard');
  const insets = useSafeAreaInsets();

  // Allow external deep-linking to a specific tab (e.g., Tower Talk → Settings).
  React.useEffect(() => {
    if (!visible) return;
    if (initialTab && typeof initialTab === 'string') {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);


  const scrollRef = useRef<ScrollView | null>(null);
  const backendSectionRef = useRef<View | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    if (initialTab === 'settings' && initialSection === 'backend') {
      // Let layout settle first
      const t = setTimeout(() => {
        try {
          if (backendSectionRef.current?.measureLayout && scrollRef.current) {
            backendSectionRef.current.measureLayout(
              scrollRef.current.getInnerViewNode(),
              (_x: number, y: number) => {
                scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
              },
              () => {}
            );
          }
        } catch {}
      }, 350);
      return () => clearTimeout(t);
    }
  }, [visible, initialTab, initialSection]);


  const [printerName, setPrinterName] = useState('');
  const [ipParts, setIpParts] = useState(['', '', '', '']);
  const [printerTest, setPrinterTest] = useState({ state: 'idle', message: '' });

  // Dashboard stats
  const [stats, setStats] = useState<{
    customers?: { total?: number; new?: number; contacted?: number; appointment?: number };
    vehicles?: { total?: number };
    intelligence_24h?: { sales_analyses?: number; service_analyses?: number; open_objections?: number; hot_escalations?: number };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');

  // Inventory search
  const [inventorySearch, setInventorySearch] = useState('');

  const ipInputRefs = useRef<(TextInput | null)[]>([]);
  const printerNameRef = useRef<TextInput | null>(null);

  const fullIp = useMemo(() => ipParts.join('.'), [ipParts]);

  const selectedLang = settings.defaultTargetLanguage;
  const canTestPrinter = useMemo(() => Boolean(activePrinter?.ip), [activePrinter]);

  const canSavePrinter = useMemo(() => {
    if (!fullIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(fullIp)) return false;
    const octets = fullIp.split('.');
    return octets.every((part) => {
      const n = Number(part);
      return Number.isFinite(n) && n >= 0 && n <= 255;
    });
  }, [fullIp]);

  const updateIpPart = useCallback((index: number, value: string) => {
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
    } catch (e: unknown) {
      setPrinterTest({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [activePrinter]);

  // Load dashboard stats
  const loadDashboardStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiFetch('/api/dashboard/stats');
      setStats(data);
    } catch {
      Alert.alert('Error', 'Failed to load dashboard stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const query = customerSearch.toLowerCase();
    return customers.filter((c: CustomerRecord) => {
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
    return vehicles.filter((v: VehicleRow) => {
      const vin = (v.vin || '').toLowerCase();
      const year = (v.year || '').toString().toLowerCase();
      const make = (v.make || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const label = `${year} ${make} ${model}`.toLowerCase();
      return vin.includes(query) || label.includes(query);
    });
  }, [vehicles, inventorySearch]);

  // Prefetch stats as soon as the modal becomes visible — regardless of active
  // tab. This makes tapping the Dashboard tab feel instant (data already there).
  React.useEffect(() => {
    if (visible && !stats && !loadingStats) {
      loadDashboardStats();
    }
  }, [visible, stats, loadingStats, loadDashboardStats]);

  // Load inventory when inventory tab is selected
  React.useEffect(() => {
    if (visible && activeTab === 'inventory') {
      fetchInventory();
    }
  }, [visible, activeTab, fetchInventory]);

  const handleDeleteVehicle = useCallback(async (vehicle: VehicleRow) => {
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
            } catch {
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

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {/* Brushed aluminum top specular edge */}
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.00)']}
            style={styles.sheetTopHighlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              refreshControl={
                <RefreshControl
                  refreshing={loadingStats}
                  onRefresh={loadDashboardStats}
                  tintColor={colors.gold}
                  colors={[colors.gold]}
                />
              }
            >
              {loadingStats ? (
                <>
                  <GlassCard style={{ marginTop: 14 }}>
                    <SkeletonLine width="35%" height={12} style={{ marginBottom: 14 }} />
                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <SkeletonLine width={24} height={24} style={{ borderRadius: 12, marginBottom: 8 }} />
                        <SkeletonLine width="60%" height={22} style={{ marginBottom: 6 }} />
                        <SkeletonLine width="45%" height={10} />
                      </View>
                      <View style={styles.statCard}>
                        <SkeletonLine width={24} height={24} style={{ borderRadius: 12, marginBottom: 8 }} />
                        <SkeletonLine width="60%" height={22} style={{ marginBottom: 6 }} />
                        <SkeletonLine width="45%" height={10} />
                      </View>
                    </View>
                  </GlassCard>
                  <GlassCard style={{ marginTop: 14 }}>
                    <SkeletonLine width="30%" height={12} style={{ marginBottom: 14 }} />
                    <SkeletonLine width="65%" height={13} style={{ marginBottom: 10 }} />
                    <SkeletonLine width="55%" height={13} style={{ marginBottom: 10 }} />
                    <SkeletonLine width="70%" height={13} />
                  </GlassCard>
                </>
              ) : stats ? (
                <>
                  {/* Persona indicator badge */}
                  <View style={styles.personaBadge} data-testid="dashboard-persona-badge">
                    <Ionicons
                      name={isService ? 'construct' : 'trending-up'}
                      size={13}
                      color={isService ? '#00FFCC' : colors.gold}
                    />
                    <Text style={[styles.personaBadgeText, { color: isService ? '#00FFCC' : colors.gold }]}>
                      {lingo.dashboardTitle}
                    </Text>
                  </View>

                  <GlassCard style={{ marginTop: 14 }}>
                    <SectionTitle>Overview</SectionTitle>
                    <View style={{ height: 12 }} />
                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Ionicons name={isService ? 'people-circle' : 'people'} size={24} color={colors.blue} />
                        <Text style={styles.statValue}>{stats.customers?.total || 0}</Text>
                        <Text style={styles.statLabel}>{lingo.customerPlural}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Ionicons name={isService ? 'construct' : 'car'} size={24} color={colors.green} />
                        <Text style={styles.statValue}>{stats.vehicles?.total || 0}</Text>
                        <Text style={styles.statLabel}>{lingo.vehiclePlural}</Text>
                      </View>
                    </View>
                  </GlassCard>

                  <GlassCard style={{ marginTop: 14 }}>
                    <SectionTitle>{isService ? 'RO Pipeline' : 'Lead Status'}</SectionTitle>
                    <View style={{ height: 12 }} />
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.blue }]} />
                      <Text style={[styles.statusText, styles.leadStatusText]}>
                        {isService ? 'Just Written' : 'New'}: {stats.customers?.new || 0}
                      </Text>
                    </View>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.gold }]} />
                      <Text style={[styles.statusText, styles.leadStatusText]}>
                        {isService ? 'In Shop' : 'Contacted'}: {stats.customers?.contacted || 0}
                      </Text>
                    </View>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
                      <Text style={[styles.statusText, styles.leadStatusText]}>
                        {isService ? 'Ready for Pickup' : 'Appointment'}: {stats.customers?.appointment || 0}
                      </Text>
                    </View>
                  </GlassCard>

                  {/* Apex Intelligence 24-hour insights */}
                  {stats.intelligence_24h ? (
                    <GlassCard style={{ marginTop: 14 }} data-testid="dashboard-intelligence-card">
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="analytics" size={16} color="#00E5FF" />
                        <SectionTitle>AI Insights · Last 24h</SectionTitle>
                      </View>
                      <View style={{ height: 12 }} />
                      <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                          <Ionicons name="chatbubbles" size={20} color="#00E5FF" />
                          <Text style={styles.statValue}>
                            {isService
                              ? (stats.intelligence_24h.service_analyses || 0)
                              : (stats.intelligence_24h.sales_analyses || 0)}
                          </Text>
                          <Text style={styles.statLabel}>
                            {isService ? 'Service Analyses' : 'Sales Analyses'}
                          </Text>
                        </View>
                        <View style={styles.statCard}>
                          <Ionicons name="warning" size={20} color="#FF7043" />
                          <Text style={styles.statValue}>{stats.intelligence_24h.hot_escalations || 0}</Text>
                          <Text style={styles.statLabel}>{lingo.kpiHotEscalations}</Text>
                        </View>
                      </View>
                      <View style={{ height: 10 }} />
                      <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: '#FFB74D' }]} />
                        <Text style={[styles.statusText, styles.leadStatusText]}>
                          {lingo.kpiOpenObjections}: {stats.intelligence_24h.open_objections || 0}
                        </Text>
                      </View>
                    </GlassCard>
                  ) : null}
                </>
              ) : (
                <GlassCard style={{ marginTop: 14 }}>
                  <EmptyState
                    icon="cloud-offline-outline"
                    title="Dashboard offline"
                    description="Couldn't load stats. Pull down to retry, or check your connection."
                    actionLabel="RETRY"
                    onAction={loadDashboardStats}
                    testID="dashboard-empty-state"
                  />
                </GlassCard>
              )}
            </ScrollView>
          ) : null}

          {/* CUSTOMERS */}
          {activeTab === 'customers' ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              refreshControl={
                <RefreshControl
                  refreshing={customersLoading}
                  onRefresh={() => fetchCustomers()}
                  tintColor={colors.gold}
                  colors={[colors.gold]}
                />
              }
            >
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.searchHeader}>
                  <Ionicons name="search" size={16} color={colors.gold} />
                  <TextInput
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder="Search customers..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onSubmitEditing={Keyboard.dismiss}
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
                  <EmptyState
                    icon="people-outline"
                    title={customerSearch ? 'No matching customers' : `No ${lingo.customerPlural.toLowerCase()} yet`}
                    description={
                      customerSearch
                        ? 'Try a different name, phone, or email.'
                        : `Scan a driver${'\u2019'}s license or add a ${lingo.customerSingular.toLowerCase()} manually to get started.`
                    }
                    compact
                    testID="customers-empty-state"
                  />
                ) : (
                  <FlatList
                    data={filteredCustomers.slice(0, 10)}
                    keyExtractor={(item) => item.customer_id || item.id || ''}
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              refreshControl={
                <RefreshControl
                  refreshing={vehiclesLoading}
                  onRefresh={() => fetchInventory()}
                  tintColor={colors.gold}
                  colors={[colors.gold]}
                />
              }
            >
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.searchHeader}>
                  <Ionicons name="search" size={16} color={colors.gold} />
                  <TextInput
                    value={inventorySearch}
                    onChangeText={setInventorySearch}
                    placeholder="Search VIN, year, make, model..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onSubmitEditing={Keyboard.dismiss}
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
                  <EmptyState
                    icon="car-sport-outline"
                    title={inventorySearch ? 'No matching vehicles' : `No ${lingo.vehiclePlural.toLowerCase()} yet`}
                    description={
                      inventorySearch
                        ? 'Try VIN, year, make, or model.'
                        : 'Scan a VIN barcode or windshield to add your first vehicle.'
                    }
                    compact
                    testID="inventory-empty-state"
                  />
                ) : (
                  <FlatList
                    data={filteredVehicles}
                    keyExtractor={(item) => item.vehicle_id || item.vin || ''}
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

          {/* SETTINGS */}
          {activeTab === 'settings' ? (
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* ── Personalize ── */}
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.personalizeHeader}>
                  <View style={styles.personalizeIconWrap}>
                    <Ionicons name="person-circle" size={20} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SectionTitle>Personalize</SectionTitle>
                    <Text style={styles.personalizeDesc}>Your identity across all customer communications</Text>
                  </View>
                </View>

                <View style={styles.personalizeFieldGroup}>
                  <View style={styles.personalizeFieldRow}>
                    <Ionicons name="person" size={15} color={colors.textDim} style={{ marginTop: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personalizeLabel}>Sales Rep</Text>
                      <TextInput
                        value={settings.salesRepName || ''}
                        onChangeText={(val: string) => setSalesRepName(val)}
                        placeholder="Your full name"
                        placeholderTextColor={colors.textMute}
                        style={styles.personalizeInput}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.personalizeFieldSep} />

                  <View style={styles.personalizeFieldRow}>
                    <Ionicons name="business" size={15} color={colors.textDim} style={{ marginTop: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personalizeLabel}>Dealership</Text>
                      <TextInput
                        value={settings.dealershipName || ''}
                        onChangeText={(val: string) => setDealershipName(val)}
                        placeholder="Dealership name"
                        placeholderTextColor={colors.textMute}
                        style={styles.personalizeInput}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.personalizeFieldSep} />

                  <View style={styles.personalizeFieldRow}>
                    <Ionicons name="location" size={15} color={colors.textDim} style={{ marginTop: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personalizeLabel}>Address</Text>
                      <TextInput
                        value={settings.dealershipAddress || ''}
                        onChangeText={(val: string) => setDealershipAddress(val)}
                        placeholder="123 Main St, City, ST 00000"
                        placeholderTextColor={colors.textMute}
                        style={styles.personalizeInput}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                </View>

                {/* Email Preview Card */}
                <View style={styles.emailPreviewCard}>
                  <View style={styles.emailPreviewRow}>
                    <Ionicons name="mail" size={13} color={colors.gold} />
                    <Text style={styles.emailPreviewLabel}>Email Preview</Text>
                  </View>
                  <View style={styles.emailPreviewBody}>
                    <Text style={styles.emailPreviewFrom}>
                      From: <Text style={styles.emailPreviewValue}>{settings.salesRepName?.trim() || 'Your Name'}</Text>
                    </Text>
                    <Text style={styles.emailPreviewSubject}>
                      Subject: <Text style={styles.emailPreviewValue}>Follow-up from {settings.salesRepName?.trim() || settings.dealershipName?.trim() || 'your dealership'}</Text>
                    </Text>
                  </View>
                </View>
              </GlassCard>

              <View style={{ height: 14 }} />
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Language</SectionTitle>
                <View style={{ height: 14 }} />
                <View style={styles.langRow}>
                  {LANGS.map((l) => (
                    <LangGlass
                      key={l.code}
                      flag={l.flag}
                      name={l.name}
                      active={selectedLang === l.code}
                      onPress={() => setDefaultTargetLanguage(l.code)}
                    />
                  ))}
                </View>
              </GlassCard>

              <View style={{ height: 14 }} />
              <View ref={backendSectionRef} collapsable={false}>
                <BackendUrlSection />
              </View>


              <GlassCard style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="construct" size={18} color={settings.serviceMode ? '#FFA500' : colors.textMute} />
                  <SectionTitle>Service Mode</SectionTitle>
                </View>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={() => { impactLight(); setServiceMode(!settings.serviceMode); }}
                  style={({ pressed }) => [styles.toggle, settings.serviceMode && styles.toggleOn, pressed && { opacity: 0.9 }]}
                  data-testid="service-mode-toggle"
                >
                  <View style={[styles.toggleDot, settings.serviceMode && styles.toggleDotOn]} />
                  <Text style={[styles.toggleText, settings.serviceMode && { color: colors.gold }]}>{settings.serviceMode ? 'SERVICE' : 'SALES'}</Text>
                </Pressable>
              </GlassCard>

              {/* Performance Mode Section */}
              <GlassCard style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="flash" size={18} color={settings.performanceMode ? '#00E5FF' : colors.textMute} />
                  <SectionTitle>Performance Mode</SectionTitle>
                </View>
                <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 6, marginBottom: 12, lineHeight: 16 }}>
                  {settings.performanceMode
                    ? 'GPT-4o locked in everywhere. Top-tier reasoning, slightly slower.'
                    : 'Balanced. Toggle ON to force GPT-4o for every AI response.'}
                </Text>
                <Pressable
                  onPress={() => { impactLight(); setPerformanceMode(!settings.performanceMode); }}
                  style={({ pressed }) => [styles.toggle, settings.performanceMode && styles.togglePerformanceOn, pressed && { opacity: 0.9 }]}
                  data-testid="performance-mode-toggle"
                >
                  <View style={[styles.toggleDot, settings.performanceMode && styles.toggleDotPerformanceOn]} />
                  <Text style={[styles.toggleText, settings.performanceMode && { color: '#00E5FF' }]}>{settings.performanceMode ? 'MAX QUALITY' : 'BALANCED'}</Text>
                </Pressable>
              </GlassCard>

              {/* Ambient Lighting Section */}
              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.ambientHeader}>
                  <SectionTitle>Ambient Lighting</SectionTitle>
                  <View style={[styles.ambientPreview, { backgroundColor: settings.ambientLightingEnabled ? (designoColors.ambient[0] || '#FF0000') : 'rgba(255,255,255,0.10)' }]} />
                </View>
                <View style={{ height: 12 }} />

                {/* Enable/Disable Toggle */}
                <Pressable
                  onPress={() => { impactLight(); toggleAmbientLighting(); }}
                  style={({ pressed }) => [styles.toggle, settings.ambientLightingEnabled && styles.toggleAmbientOn, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.toggleDot, settings.ambientLightingEnabled && styles.toggleDotAmbientOn]} />
                  <Text style={[styles.toggleText, settings.ambientLightingEnabled && { color: '#00FFCC' }]}>
                    {settings.ambientLightingEnabled ? '64-COLOR ACTIVE' : 'OFF'}
                  </Text>
                </Pressable>

                {/* Intensity Selector (only shown when enabled) */}
                {settings.ambientLightingEnabled && (
                  <>
                    <View style={{ height: 14 }} />
                    <Text style={styles.ambientLabel}>INTENSITY</Text>
                    <View style={{ height: 8 }} />
                    <View style={styles.intensityRow}>
                      {[
                        { key: 'subtle', label: 'SUBTLE', pct: '4%' },
                        { key: 'medium', label: 'MEDIUM', pct: '8%' },
                        { key: 'vivid', label: 'VIVID', pct: '12%' },
                      ].map((level) => {
                        const active = settings.ambientLightingIntensity === level.key;
                        return (
                          <Pressable
                            key={level.key}
                            onPress={() => { impactLight(); setAmbientLightingIntensity(level.key); }}
                            style={({ pressed }) => [
                              styles.intensityBtn,
                              active && styles.intensityBtnActive,
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Text style={[styles.intensityLabel, active && styles.intensityLabelActive]}>{level.label}</Text>
                            <Text style={[styles.intensityPct, active && styles.intensityPctActive]}>{level.pct}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Color spectrum preview */}
                    <View style={{ height: 14 }} />
                    <Text style={styles.ambientLabel}>SPECTRUM PREVIEW</Text>
                    <View style={{ height: 8 }} />
                    <View style={styles.spectrumRow}>
                      {designoColors.ambient.filter((_, i) => i % 4 === 0).map((color, i) => (
                        <View key={i} style={[styles.spectrumDot, { backgroundColor: color }]} />
                      ))}
                    </View>
                    <Text style={styles.ambientSubtext}>30-second full spectrum cycle</Text>
                  </>
                )}
              </GlassCard>

              {/* Sound Profile Section */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>SPORT Sound Profile</SectionTitle>
                <View style={{ height: 12 }} />
                <View style={styles.intensityRow}>
                  {[
                    { key: 'merica', name: 'V8', emoji: '\uD83C\uDDFA\uD83C\uDDF8', color: '#FF4444' },
                    { key: 'euro', name: 'EURO', emoji: '\uD83C\uDDE9\uD83C\uDDEA', color: '#FFD700' },
                    { key: 'jdm', name: 'JDM', emoji: '\uD83C\uDDEF\uD83C\uDDF5', color: '#00CCFF' },
                  ].map((p) => {
                    const active = settings.soundProfile === p.key;
                    return (
                      <Pressable
                        key={p.key}
                        onPress={() => { impactLight(); setSoundProfile(p.key); }}
                        style={({ pressed }) => [
                          styles.soundProfileBtn,
                          active && { borderColor: `${p.color}80`, backgroundColor: `${p.color}12` },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.soundEmoji}>{p.emoji}</Text>
                        <Text style={[styles.soundName, active && { color: p.color }]}>{p.name}</Text>
                        {active && <View style={[styles.soundActiveDot, { backgroundColor: p.color }]} />}
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            </ScrollView>
          ) : null}

          {/* PRINTERS */}
          {activeTab === 'printers' ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
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
                  ref={printerNameRef}
                  value={printerName}
                  onChangeText={setPrinterName}
                  placeholder="Name"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => ipInputRefs.current[0]?.focus()}
                  blurOnSubmit={false}
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
                        returnKeyType={idx === 3 ? 'done' : 'next'}
                        onSubmitEditing={idx === 3 ? Keyboard.dismiss : undefined}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.08)',
    backgroundColor: 'rgba(8,10,14,0.98)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18, // overridden inline with safe area
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.75,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: -14 },
    elevation: 24,
  },
  sheetTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
    gap: 8,
    flexWrap: 'wrap',
  },
  tabBtn: {
    flex: 1,
    minWidth: 74,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,14,20,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.50,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.70)',
    shadowColor: 'rgba(214,178,94,0.55)',
    shadowOpacity: 0.90,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  tabText: {
    color: colors.textMute,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  tabTextActive: {
    color: colors.gold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  personalizeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  personalizeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(214,178,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalizeDesc: {
    fontSize: 11,
    color: colors.textMute,
    marginTop: 3,
    lineHeight: 15,
  },
  personalizeFieldGroup: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
    overflow: 'hidden',
  },
  personalizeFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  personalizeFieldSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 12,
  },
  personalizeLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  personalizeInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  emailPreviewCard: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.12)',
    backgroundColor: 'rgba(214,178,94,0.04)',
    overflow: 'hidden',
  },
  emailPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  emailPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  emailPreviewBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 3,
  },
  emailPreviewFrom: {
    fontSize: 12,
    color: colors.textMute,
  },
  emailPreviewSubject: {
    fontSize: 12,
    color: colors.textMute,
  },
  emailPreviewValue: {
    color: colors.text,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  langPressable: {
    flex: 1,
  },
  langGlassOuter: {
    flex: 1,
    marginHorizontal: 0,
    height: 110,
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
    height: '88%',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(25,28,35,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 6,
  },
  langGlassInnerActive: {
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(214,178,94,0.06)',
  },
  langFlag: {
    fontSize: 42,
  },
  langName: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  langNameActive: {
    color: colors.gold,
  },
  toggle: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
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
    borderColor: 'rgba(214,178,94,0.06)',
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
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.40)',
    fontSize: 13,
    fontWeight: '700',
  },
  activePrinterBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  printerRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
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
  leadStatusText: {
    color: '#FF8C00',
    textShadowColor: 'rgba(255,140,0,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
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
    borderColor: 'rgba(214,178,94,0.06)',
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
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
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
  // Ambient Lighting styles
  ambientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ambientPreview: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  toggleAmbientOn: {
    borderColor: 'rgba(0,255,204,0.50)',
    backgroundColor: 'rgba(0,255,204,0.08)',
  },
  toggleDotAmbientOn: {
    backgroundColor: '#00FFCC',
  },
  togglePerformanceOn: {
    borderColor: 'rgba(0,229,255,0.55)',
    backgroundColor: 'rgba(0,229,255,0.10)',
  },
  toggleDotPerformanceOn: {
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  personaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  personaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ambientLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  ambientSubtext: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  intensityBtnActive: {
    borderColor: 'rgba(0,255,204,0.50)',
    backgroundColor: 'rgba(0,255,204,0.08)',
  },
  intensityLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  intensityLabelActive: {
    color: '#00FFCC',
  },
  intensityPct: {
    color: colors.textMute,
    fontSize: 9,
    fontWeight: '700',
  },
  intensityPctActive: {
    color: 'rgba(0,255,204,0.70)',
  },
  spectrumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  spectrumDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Sound Profile styles
  soundProfileBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  soundEmoji: {
    fontSize: 20,
  },
  soundName: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  soundDesc: {
    color: colors.textMute,
    fontSize: 8,
    fontWeight: '600',
    opacity: 0.7,
  },
  soundActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  quiltedPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  stitchingTop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(214,178,94,0.15)',
  },
  stitchingBottom: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
});
