import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { loadJson, saveJson } from '../lib/storage';
import { GlassCard } from '../components/GlassCard';
import { impactMedium, notificationSuccess } from '../lib/haptics';

const STORAGE_KEY = 'sc_v1_driver_license_scans';

function buildDisplayEntry(item) {
  const name = item.fullName && item.fullName.trim().length > 0 ? item.fullName : 'Name: —';
  const address = item.address && item.address.trim().length > 0 ? item.address : 'Address: —';
  const dl = item.dlNumber && item.dlNumber.trim().length > 0 ? item.dlNumber : '—';
  const exp = item.expiration && item.expiration.trim().length > 0 ? item.expiration : '—';
  return {
    ...item,
    displayName: name,
    displayAddress: address,
    displayDl: dl,
    displayExp: exp,
  };
}

function CustomerRow({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.name}>{item.displayName}</Text>
      <Text style={styles.detail}>{item.displayAddress}</Text>
      <Text style={styles.detail}>DL: {item.displayDl} · EXP: {item.displayExp}</Text>
    </View>
  );
}

export function CustomerListModal({ visible, onClose }) {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');

  const [manualFirst, setManualFirst] = useState('');
  const [manualLast, setManualLast] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualDl, setManualDl] = useState('');
  const [manualExp, setManualExp] = useState('');
  const [manualTradeVin, setManualTradeVin] = useState('');
  const [manualTradeMiles, setManualTradeMiles] = useState('');
  const [manualVoiVin, setManualVoiVin] = useState('');

  const load = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    const all = Array.isArray(parsed) ? parsed.map(buildDisplayEntry) : [];
    setEntries(all);
  }, []);

  const saveManual = useCallback(async () => {
    const fullName = `${manualFirst.trim()} ${manualLast.trim()}`.trim();
    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      source: 'manual',
      savedAt: new Date().toISOString(),
      fullName,
      address: manualAddress.trim(),
      dlNumber: manualDl.trim(),
      expiration: manualExp.trim(),
      tradeVin: manualTradeVin.trim() || undefined,
      tradeMiles: manualTradeMiles.trim() || undefined,
      voiVin: manualVoiVin.trim() || undefined,
      ok:
        Boolean(fullName) &&
        Boolean(manualAddress.trim()) &&
        Boolean(manualDl.trim()) &&
        Boolean(manualExp.trim()),
    };
    const next = [entry, ...entries].slice(0, 100);
    setEntries(next.map(buildDisplayEntry));
    await saveJson(STORAGE_KEY, next);
    setManualFirst('');
    setManualLast('');
    setManualAddress('');
    setManualDl('');
    setManualExp('');
  }, [entries, manualFirst, manualLast, manualAddress, manualDl, manualExp]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const text = [e.displayName, e.displayAddress, e.displayDl].join(' ').toLowerCase();
    return text.includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="people" size={16} color={colors.blue} />
              <Text style={styles.headerTitle}>CUSTOMERS</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ height: 10 }} />

          <GlassCard>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={14} color={colors.textMute} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, address, DL #"
                placeholderTextColor={colors.textMute}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMute} />
                </Pressable>
              )}
            </View>
          </GlassCard>

          <View style={{ height: 12 }} />

          <GlassCard style={{ flex: 1 }}>
            <View style={styles.sectionRow}>
              <Ionicons name="time-outline" size={16} color={colors.textMute} />
              <Text style={styles.sectionLabel}>From License Scans</Text>
              <Text style={[styles.meta, { marginLeft: 'auto' }]}>{filtered.length}</Text>
            </View>
            <View style={{ height: 8 }} />

            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <CustomerRow item={item} />}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            />
          </GlassCard>

          <View style={{ height: 12 }} />

          <GlassCard>
            <View style={styles.sectionRow}>
              <Ionicons name="person-add" size={16} color={colors.blue} />
              <Text style={styles.sectionLabel}>Add Customer Manually</Text>
            </View>
            <View style={{ height: 8 }} />
            <View style={styles.manualRow}>
              <TextInput
                value={manualFirst}
                onChangeText={setManualFirst}
                placeholder="First name"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={manualLast}
                onChangeText={setManualLast}
                placeholder="Last name"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={{ height: 8 }} />
            <TextInput
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Full address"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />
            <View style={{ height: 8 }} />
            <View style={styles.manualRow}>
              <TextInput
                value={manualDl}
                onChangeText={setManualDl}
                placeholder="DL #"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={manualExp}
                onChangeText={setManualExp}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                keyboardType="numeric"
              />
            </View>
            <View style={{ height: 10 }} />
            <Pressable
              onPress={saveManual}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="save" size={14} color={colors.gold} />
              <Text style={styles.saveBtnText}>Save Customer</Text>
            </Pressable>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,12,16,0.98)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
  },
  meta: {
    color: colors.textMute,
    fontSize: 11,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  saveBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
  },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  detail: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
  },
});
