import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiFetch } from '../lib/api';

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionButton({ label, onPress, disabled, loading }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, (disabled || pressed) && { opacity: 0.85 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
      {loading ? (
        <View style={{ marginLeft: 10 }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}
    </Pressable>
  );
}

function CustomerRow({ item, onSelect }) {
  const name = [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || item.name || 'Customer';
  return (
    <Pressable onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}>
      <Text style={styles.rowTitle}>{name}</Text>
      <Text style={styles.rowMeta} numberOfLines={1}>{item.phone || item.email || item.id}</Text>
    </Pressable>
  );
}

export function PrintCenterModal({ visible, onClose, licenseImageBase64 }) {
  const { activePrinter } = useAppSettings();
  const [tab, setTab] = useState('customer');

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

  const printCustomer = useCallback(async () => {
    if (!selectedCustomer?.id) return;
    try {
      setState({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/customer', {
        method: 'POST',
        body: JSON.stringify({ customer_id: selectedCustomer.id, printer_ip: printerIp }),
      });
      setState({ status: 'done', msg: res?.message || 'Print sent' });
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
    }
  }, [selectedCustomer, printerIp]);

  const printLicense = useCallback(async () => {
    if (!licenseImageBase64) {
      setState({ status: 'error', msg: 'No license image available. Scan a DL first.' });
      return;
    }

    try {
      setState({ status: 'printing', msg: '' });
      const res = await apiFetch('/api/print/license', {
        method: 'POST',
        body: JSON.stringify({ image_data: licenseImageBase64, printer_ip: printerIp }),
      });
      setState({ status: 'done', msg: res?.message || 'Print sent' });
    } catch (e) {
      setState({ status: 'error', msg: String(e?.message || e) });
    }
  }, [licenseImageBase64, printerIp]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>PRINT</Text>
              <Text style={styles.headerSub}>Confirm before sending to printer</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <GlassCard style={{ marginTop: 14 }}>
            <SectionTitle>Active printer</SectionTitle>
            <Text style={styles.body}>{printerIp ? `${activePrinter?.name || 'Printer'} · ${printerIp}` : 'No active printer set (Command Center → Printers)'}</Text>
          </GlassCard>

          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('customer')} style={({ pressed }) => [styles.tabBtn, tab === 'customer' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.tabText, tab === 'customer' && styles.tabTextActive]}>CUSTOMER</Text>
            </Pressable>
            <Pressable onPress={() => setTab('license')} style={({ pressed }) => [styles.tabBtn, tab === 'license' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.tabText, tab === 'license' && styles.tabTextActive]}>LICENSE</Text>
            </Pressable>
          </View>

          {tab === 'customer' ? (
            <>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Select customer</SectionTitle>
                <View style={{ height: 10 }} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name/phone/email"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                />
                <View style={{ height: 12 }} />
                <ActionButton label="Load customers" onPress={loadCustomers} loading={state.status === 'loading'} />
              </GlassCard>

              <GlassCard style={{ marginTop: 14, flex: 1 }}>
                <SectionTitle>Results</SectionTitle>
                <Text style={styles.body}>{selectedCustomer ? `Selected: ${selectedCustomer.id}` : 'Tap a customer to select'}</Text>
                <View style={{ height: 12 }} />

                <FlatList
                  data={customers}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => <CustomerRow item={item} onSelect={setSelectedCustomer} />}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  contentContainerStyle={{ paddingBottom: 14 }}
                />
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Confirm</SectionTitle>
                <Text style={styles.body}>This will generate a PDF customer snapshot and send to the active printer.</Text>
                <View style={{ height: 12 }} />
                <ActionButton
                  label="Print customer profile"
                  onPress={printCustomer}
                  disabled={!canPrint || !selectedCustomer || state.status === 'printing'}
                  loading={state.status === 'printing'}
                />
              </GlassCard>
            </>
          ) : null}

          {tab === 'license' ? (
            <>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Confirm</SectionTitle>
                <Text style={styles.body}>This will print the last scanned license image.</Text>
                <View style={{ height: 12 }} />
                <ActionButton
                  label="Print driver’s license"
                  onPress={printLicense}
                  disabled={!canPrint || state.status === 'printing'}
                  loading={state.status === 'printing'}
                />
              </GlassCard>
            </>
          ) : null}

          {state.status === 'done' ? <Text style={[styles.body, { color: colors.green, marginTop: 10 }]}>{state.msg}</Text> : null}
          {state.status === 'error' ? <Text style={[styles.body, { color: colors.red, marginTop: 10 }]}>{state.msg}</Text> : null}
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '92%',
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
  headerSub: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  tabs: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  tabText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  tabTextActive: {
    color: colors.gold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  body: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  rowMeta: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
  },
});
