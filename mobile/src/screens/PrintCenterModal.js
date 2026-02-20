import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View, ActivityIndicator,
  TextInput, FlatList, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiFetch } from '../lib/api';
import { loadJson } from '../lib/storage';
import { impactLight, notificationSuccess, notificationError } from '../lib/haptics';

function normalizeCustomer(c) {
  if (!c || typeof c !== 'object') return c;
  const id = c.customer_id || c.id || '';
  return { ...c, id, customer_id: id };
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionButton({ label, icon, onPress, disabled, loading }) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, (disabled || loading || pressed) && { opacity: 0.65 }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.gold} size="small" />
      ) : (
        icon && <Ionicons name={icon} size={16} color={colors.gold} />
      )}
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function CustomerRow({ item, onSelect, selected }) {
  const name = [item.first_name, item.last_name].filter(Boolean).join(' ').trim()
    || item.name || 'Customer';
  const sub = item.phone || item.email || item.id || '';
  return (
    <Pressable
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listRow,
        selected && styles.listRowSelected,
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listRowTitle}>{name}</Text>
        {sub ? (
          <Text style={styles.listRowMeta} numberOfLines={1}>{sub}</Text>
        ) : null}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
}

function DlRow({ item, onSelect, selected }) {
  const name = item.fullName || 'DL Scan';
  const meta = `DL: ${item.dlNumber || '\u2014'} \u00b7 EXP: ${item.expiration || '\u2014'}`;
  const date = item.savedAt ? new Date(item.savedAt).toLocaleString() : '';
  return (
    <Pressable
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listRow,
        selected && styles.listRowSelected,
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listRowTitle}>{name}</Text>
        <Text style={styles.listRowMeta} numberOfLines={1}>{meta}</Text>
        {date ? <Text style={[styles.listRowMeta, { fontSize: 10 }]}>{date}</Text> : null}
        {!item.licenseImageBase64 && (
          <Text style={[styles.listRowMeta, { color: colors.red, fontSize: 10 }]}>
            \u26a0\ufe0f No image
          </Text>
        )}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
}

export function PrintCenterModal({ visible, onClose }) {
  const { activePrinter } = useAppSettings();
  const [tab, setTab] = useState('customer');

  // Customer tab state
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // DL tab state
  const [dlSearch, setDlSearch] = useState('');
  const [dlScans, setDlScans] = useState([]);
  const [dlLoaded, setDlLoaded] = useState(false);
  const [selectedDl, setSelectedDl] = useState(null);

  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [printStatus, setPrintStatus] = useState({ status: 'idle', msg: '' });

  const printerIp = activePrinter?.ip || '';
  const canPrint = Boolean(printerIp);

  // Auto-load on mount and when tab changes
  useEffect(() => {
    if (!visible) return;
    if (tab === 'customer' && !customersLoaded) {
      loadCustomers();
    } else if (tab === 'license' && !dlLoaded) {
      loadDlScans();
    }
  }, [visible, tab]);

  // Re-search customers when search changes (debounced via just re-calling)
  useEffect(() => {
    if (!visible || !customersLoaded) return;
    const t = setTimeout(() => loadCustomers(), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoadingStatus('loading');
      const res = await apiFetch(
        `/api/customers/list?limit=50&skip=0&search=${encodeURIComponent(search.trim())}`
      );
      const raw = res?.customers || [];
      setCustomers(raw.map(normalizeCustomer));
      setCustomersLoaded(true);
      setLoadingStatus('idle');
    } catch (e) {
      setLoadingStatus('error');
      setPrintStatus({ status: 'error', msg: `Failed to load customers: ${e?.message || e}` });
    }
  }, [search]);

  const loadDlScans = useCallback(async () => {
    try {
      setLoadingStatus('loading');
      const scans = await loadJson('sc_v1_driver_license_scans', []);
      const list = Array.isArray(scans) ? scans : [];
      const q = (dlSearch || '').toLowerCase();
      const filtered = q
        ? list.filter((s) =>
            String(s.fullName || '').toLowerCase().includes(q) ||
            String(s.dlNumber || '').toLowerCase().includes(q)
          )
        : list;
      setDlScans(filtered);
      setDlLoaded(true);
      setLoadingStatus('idle');
    } catch (e) {
      setLoadingStatus('error');
      setPrintStatus({ status: 'error', msg: `Failed to load DL scans: ${e?.message || e}` });
    }
  }, [dlSearch]);

  const printCustomer = useCallback(async () => {
    const id = selectedCustomer?.customer_id || selectedCustomer?.id;
    if (!id) {
      setPrintStatus({ status: 'error', msg: 'No customer selected or customer has no ID.' });
      return;
    }
    if (!canPrint) {
      setPrintStatus({ status: 'error', msg: 'No printer configured. Add a printer in Command Center \u2192 Settings.' });
      return;
    }
    try {
      setPrintStatus({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/customer', {
        method: 'POST',
        body: JSON.stringify({ customer_id: id, printer_ip: printerIp }),
      });
      setPrintStatus({ status: 'done', msg: res?.message || 'Print job sent successfully' });
      notificationSuccess();
    } catch (e) {
      setPrintStatus({ status: 'error', msg: `Print failed: ${e?.message || e}` });
      notificationError();
    }
  }, [selectedCustomer, printerIp, canPrint]);

  const printLicense = useCallback(async () => {
    if (!selectedDl) {
      setPrintStatus({ status: 'error', msg: 'No DL scan selected.' });
      return;
    }
    if (!selectedDl.licenseImageBase64) {
      setPrintStatus({ status: 'error', msg: 'Selected scan has no captured image. Re-scan the license.' });
      return;
    }
    if (!canPrint) {
      setPrintStatus({ status: 'error', msg: 'No printer configured. Add a printer in Command Center \u2192 Settings.' });
      return;
    }
    try {
      setPrintStatus({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/license', {
        method: 'POST',
        body: JSON.stringify({ image_data: selectedDl.licenseImageBase64, printer_ip: printerIp }),
      });
      setPrintStatus({ status: 'done', msg: res?.message || 'Print job sent successfully' });
      notificationSuccess();
    } catch (e) {
      setPrintStatus({ status: 'error', msg: `Print failed: ${e?.message || e}` });
      notificationError();
    }
  }, [selectedDl, printerIp, canPrint]);

  const isPrinting = printStatus.status === 'printing';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="print" size={16} color={colors.gold} />
              <Text style={styles.headerTitle}>PRINT CENTER</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* Printer Status Bar */}
          <View style={[styles.printerBar, printerIp ? styles.printerBarOnline : styles.printerBarOffline]}>
            <Ionicons
              name={printerIp ? 'print' : 'warning'}
              size={14}
              color={printerIp ? colors.green : colors.red}
            />
            <Text style={[styles.printerBarText, { color: printerIp ? colors.green : colors.red }]}>
              {printerIp
                ? `${activePrinter?.name || 'Printer'} \u00b7 ${printerIp}`
                : 'No printer configured \u2014 go to Command Center \u2192 Settings \u2192 Printers'
              }
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {[['customer', 'person', 'CUSTOMER'], ['license', 'card', 'LICENSE']].map(([key, icon, label]) => (
              <Pressable
                key={key}
                onPress={() => { setTab(key); setPrintStatus({ status: 'idle', msg: '' }); }}
                style={({ pressed }) => [
                  styles.tabBtn,
                  tab === key && styles.tabBtnActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons name={icon} size={14} color={tab === key ? colors.gold : colors.textMute} />
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'customer' ? (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={14} color={colors.textMute} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name, phone, or email..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                  {loadingStatus === 'loading' && (
                    <ActivityIndicator color={colors.gold} size="small" />
                  )}
                </View>
                <View style={{ height: 8 }} />

                {!customersLoaded && loadingStatus !== 'loading' && (
                  <ActionButton
                    label="Load Customers"
                    icon="download-outline"
                    onPress={loadCustomers}
                    loading={loadingStatus === 'loading'}
                  />
                )}

                {customersLoaded && customers.length === 0 && (
                  <Text style={styles.emptyText}>
                    {search ? 'No customers matched your search.' : 'No customers found.'}
                  </Text>
                )}

                {customers.length > 0 && (
                  <FlatList
                    data={customers}
                    keyExtractor={(i) => i.customer_id || i.id || Math.random().toString()}
                    renderItem={({ item }) => (
                      <CustomerRow
                        item={item}
                        selected={(selectedCustomer?.customer_id || selectedCustomer?.id) === (item.customer_id || item.id)}
                        onSelect={setSelectedCustomer}
                      />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    style={{ maxHeight: 220 }}
                    nestedScrollEnabled
                  />
                )}

                <View style={{ height: 14 }} />

                {selectedCustomer && (
                  <View style={styles.selectedBanner}>
                    <Ionicons name="person" size={13} color={colors.gold} />
                    <Text style={styles.selectedBannerText} numberOfLines={1}>
                      {[selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') || 'Customer selected'}
                    </Text>
                  </View>
                )}

                <View style={{ height: 8 }} />

                <ActionButton
                  label={isPrinting ? 'Printing...' : 'Print Customer Profile'}
                  icon="print"
                  onPress={printCustomer}
                  disabled={!canPrint || !selectedCustomer || isPrinting}
                  loading={isPrinting}
                />
              </>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={14} color={colors.textMute} />
                  <TextInput
                    value={dlSearch}
                    onChangeText={(t) => { setDlSearch(t); setDlLoaded(false); }}
                    placeholder="Search by name or DL#..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onSubmitEditing={loadDlScans}
                  />
                  {loadingStatus === 'loading' && (
                    <ActivityIndicator color={colors.gold} size="small" />
                  )}
                </View>
                <View style={{ height: 8 }} />

                {!dlLoaded && loadingStatus !== 'loading' && (
                  <ActionButton
                    label="Load DL Scans"
                    icon="download-outline"
                    onPress={loadDlScans}
                    loading={loadingStatus === 'loading'}
                  />
                )}

                {dlLoaded && dlScans.length === 0 && (
                  <Text style={styles.emptyText}>
                    {dlSearch ? 'No scans matched.' : 'No DL scans saved yet. Use the DL Scanner to capture a license.'}
                  </Text>
                )}

                {dlScans.length > 0 && (
                  <FlatList
                    data={dlScans}
                    keyExtractor={(i, idx) => String(i.id || i.dlNumber || idx)}
                    renderItem={({ item }) => (
                      <DlRow
                        item={item}
                        selected={selectedDl?.id === item.id}
                        onSelect={setSelectedDl}
                      />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    style={{ maxHeight: 220 }}
                    nestedScrollEnabled
                  />
                )}

                <View style={{ height: 14 }} />

                {selectedDl && (
                  <View style={styles.selectedBanner}>
                    <Ionicons name="card" size={13} color={colors.gold} />
                    <Text style={styles.selectedBannerText} numberOfLines={1}>
                      {selectedDl.fullName || 'DL scan selected'}
                      {!selectedDl.licenseImageBase64 && ' \u2014 no image'}
                    </Text>
                  </View>
                )}

                <View style={{ height: 8 }} />

                <ActionButton
                  label={isPrinting ? 'Printing...' : "Print Driver's License"}
                  icon="print"
                  onPress={printLicense}
                  disabled={!canPrint || !selectedDl || !selectedDl.licenseImageBase64 || isPrinting}
                  loading={isPrinting}
                />
              </>
            )}

            {/* Status feedback */}
            {printStatus.status === 'done' && (
              <View style={[styles.statusRow, styles.statusDone]}>
                <Ionicons name="checkmark-circle" size={15} color={colors.green} />
                <Text style={[styles.statusText, { color: colors.green }]}>{printStatus.msg}</Text>
              </View>
            )}
            {printStatus.status === 'error' && (
              <View style={[styles.statusRow, styles.statusError]}>
                <Ionicons name="alert-circle" size={15} color={colors.red} />
                <Text style={[styles.statusText, { color: colors.red }]}>{printStatus.msg}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,12,16,0.97)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 13,
    letterSpacing: 2.0,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  printerBarOnline: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.25)',
  },
  printerBarOffline: {
    backgroundColor: 'rgba(255,45,45,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.25)',
  },
  printerBarText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.50)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  tabText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
  },
  tabTextActive: {
    color: colors.gold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    height: '100%',
  },
  btn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.40)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.textDim,
    ...type.label,
    fontSize: 11,
    marginBottom: 10,
    letterSpacing: 1.4,
  },
  listRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  listRowSelected: {
    borderColor: 'rgba(214,178,94,0.55)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  listRowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  listRowMeta: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMute,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 18,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(214,178,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
  },
  selectedBannerText: {
    flex: 1,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
  },
  statusDone: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderColor: 'rgba(52,199,89,0.25)',
  },
  statusError: {
    backgroundColor: 'rgba(255,45,45,0.08)',
    borderColor: 'rgba(255,45,45,0.25)',
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
