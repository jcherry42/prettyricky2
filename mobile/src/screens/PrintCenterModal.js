import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator, TextInput, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiFetch } from '../lib/api';
import { loadJson } from '../lib/storage';
import { impactLight, notificationSuccess, notificationError } from '../lib/haptics';

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionButton({ label, icon, onPress, disabled, loading }) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, (disabled || pressed) && { opacity: 0.7 }]}
    >
      {icon && <Ionicons name={icon} size={16} color={colors.gold} />}
      <Text style={styles.btnText}>{label}</Text>
      {loading && <ActivityIndicator color={colors.gold} style={{ marginLeft: 8 }} />}
    </Pressable>
  );
}

function CustomerRow({ item, onSelect, selected }) {
  const name = [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || item.name || 'Customer';
  return (
    <Pressable onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.88 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.phone || item.email || item.id}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
}

function DlRow({ item, onSelect, selected }) {
  const name = item.fullName || 'DL Scan';
  const meta = `DL: ${item.dlNumber || '\u2014'} \u00b7 EXP: ${item.expiration || '\u2014'}`;
  return (
    <Pressable onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.88 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
        <Text style={[styles.rowMeta, { fontSize: 10 }]}>{new Date(item.savedAt).toLocaleString()}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}
    </Pressable>
  );
}

export function PrintCenterModal({ visible, onClose }) {
  const { activePrinter } = useAppSettings();
  const [tab, setTab] = useState('customer');

  const [dlSearch, setDlSearch] = useState('');
  const [dlScans, setDlScans] = useState([]);
  const [selectedDl, setSelectedDl] = useState(null);

  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [state, setState] = useState({ status: 'idle', msg: '' });
  const printerIp = activePrinter?.ip || '';
  const canPrint = useMemo(() => Boolean(printerIp), [printerIp]);

  const loadCustomers = useCallback(async () => {
    try {
      setState({ status: 'loading', msg: '' });
      const res = await apiFetch(`/api/customers/list?limit=50&skip=0&search=${encodeURIComponent(search || '')}`);
      setCustomers(res?.customers || []);
      setState({ status: 'idle', msg: '' });
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
    }
  }, [search]);

  const loadDlScans = useCallback(async () => {
    try {
      setState({ status: 'loading', msg: '' });
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
      setState({ status: 'idle', msg: '' });
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
    }
  }, [dlSearch]);

  const printCustomer = useCallback(async () => {
    if (!selectedCustomer?.id) return;
    try {
      setState({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/customer', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedCustomer.id, printer_ip: printerIp }),
      });
      setState({ status: 'done', msg: res?.message || 'Print job sent' });
      notificationSuccess();
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
      notificationError();
    }
  }, [selectedCustomer, printerIp]);

  const printLicense = useCallback(async () => {
    if (!selectedDl?.licenseImageBase64) {
      setState({ status: 'error', msg: 'Select a DL scan with an image first.' });
      return;
    }
    try {
      setState({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/license', {
        method: 'POST',
        body: JSON.stringify({ image_data: selectedDl.licenseImageBase64, printer_ip: printerIp }),
      });
      setState({ status: 'done', msg: res?.message || 'Print job sent' });
      notificationSuccess();
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
      notificationError();
    }
  }, [selectedDl, printerIp]);

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
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* Printer Status */}
          <View style={styles.printerStatus}>
            <Ionicons name={printerIp ? 'wifi' : 'wifi-outline'} size={14} color={printerIp ? colors.green : colors.red} />
            <Text style={[styles.printerText, { color: printerIp ? colors.text : colors.red }]}>
              {printerIp ? `${activePrinter?.name || 'Printer'} \u00b7 ${printerIp}` : 'No printer configured'}
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('customer')} style={({ pressed }) => [styles.tabBtn, tab === 'customer' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
              <Ionicons name="person" size={14} color={tab === 'customer' ? colors.gold : colors.textMute} />
              <Text style={[styles.tabText, tab === 'customer' && styles.tabTextActive]}>CUSTOMER</Text>
            </Pressable>
            <Pressable onPress={() => setTab('license')} style={({ pressed }) => [styles.tabBtn, tab === 'license' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
              <Ionicons name="card" size={14} color={tab === 'license' ? colors.gold : colors.textMute} />
              <Text style={[styles.tabText, tab === 'license' && styles.tabTextActive]}>LICENSE</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {tab === 'customer' ? (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={14} color={colors.textMute} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search customer..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                  />
                </View>
                <View style={{ height: 8 }} />
                <ActionButton label="Load" icon="download-outline" onPress={loadCustomers} loading={state.status === 'loading'} />
                <View style={{ height: 10 }} />

                {customers.length > 0 && (
                  <FlatList
                    data={customers}
                    keyExtractor={(i) => i.id}
                    renderItem={({ item }) => <CustomerRow item={item} selected={selectedCustomer?.id === item.id} onSelect={setSelectedCustomer} />}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    style={{ maxHeight: 200 }}
                    nestedScrollEnabled
                  />
                )}

                <View style={{ height: 12 }} />
                <ActionButton
                  label="Print Customer Profile"
                  icon="print"
                  onPress={printCustomer}
                  disabled={!canPrint || !selectedCustomer || state.status === 'printing'}
                  loading={state.status === 'printing'}
                />
              </>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={14} color={colors.textMute} />
                  <TextInput
                    value={dlSearch}
                    onChangeText={setDlSearch}
                    placeholder="Search name or DL#..."
                    placeholderTextColor={colors.textMute}
                    style={styles.searchInput}
                  />
                </View>
                <View style={{ height: 8 }} />
                <ActionButton label="Load" icon="download-outline" onPress={loadDlScans} loading={state.status === 'loading'} />
                <View style={{ height: 10 }} />

                {dlScans.length > 0 && (
                  <FlatList
                    data={dlScans}
                    keyExtractor={(i) => i.id}
                    renderItem={({ item }) => <DlRow item={item} selected={selectedDl?.id === item.id} onSelect={setSelectedDl} />}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    style={{ maxHeight: 200 }}
                    nestedScrollEnabled
                  />
                )}

                <View style={{ height: 12 }} />
                <ActionButton
                  label="Print Driver's License"
                  icon="print"
                  onPress={printLicense}
                  disabled={!canPrint || !selectedDl || state.status === 'printing'}
                  loading={state.status === 'printing'}
                />
              </>
            )}

            {/* Status messages */}
            {state.status === 'done' && (
              <View style={styles.resultRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                <Text style={[styles.resultText, { color: colors.green }]}>{state.msg}</Text>
              </View>
            )}
            {state.status === 'error' && (
              <View style={styles.resultRow}>
                <Ionicons name="alert-circle" size={14} color={colors.red} />
                <Text style={[styles.resultText, { color: colors.red }]}>{state.msg}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
    marginBottom: 10,
  },
  printerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  tabText: {
    color: colors.textMute,
    ...type.label,
    fontSize: 10,
  },
  tabTextActive: {
    color: colors.gold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    marginBottom: 8,
  },
  btn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
  },
  row: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowSelected: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rowMeta: {
    marginTop: 4,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  resultText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
