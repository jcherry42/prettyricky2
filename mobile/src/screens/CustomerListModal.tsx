import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

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
    setManualTradeVin('');
    setManualTradeMiles('');
    setManualVoiVin('');
  }, [entries, manualFirst, manualLast, manualAddress, manualDl, manualExp, manualTradeVin, manualTradeMiles, manualVoiVin]);

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
      {/* Backdrop tap-to-dismiss */}
      <Pressable style={styles.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />

      {/* Sheet — sits above the backdrop, scrolls internally so keyboard never buries inputs */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="people" size={16} color={colors.blue} />
            <Text style={styles.headerTitle}>CUSTOMERS</Text>
          </View>
          <Pressable onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={colors.text} />
          </Pressable>
        </View>

        {/*
          ScrollView with automaticallyAdjustKeyboardInsets:
          - iOS 15+: native keyboard avoidance that works correctly inside Modals
          - Android: falls back to scrolling manually after focus
          keyboardShouldPersistTaps="handled" lets taps on buttons work while keyboard is up
        */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardDismissMode="interactive"
        >
          {/* Search */}
          <GlassCard>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={14} color={colors.textMute} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, address, DL #"
                placeholderTextColor={colors.textMute}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMute} />
                </Pressable>
              )}
            </View>
          </GlassCard>

          <View style={{ height: 12 }} />

          {/* License scan history — fixed height box, scrolls internally */}
          <GlassCard>
            <View style={styles.sectionRow}>
              <Ionicons name="time-outline" size={16} color={colors.textMute} />
              <Text style={styles.sectionLabel}>From License Scans</Text>
              <Text style={[styles.meta, { marginLeft: 'auto' }]}>{filtered.length}</Text>
            </View>
            <View style={{ height: 8 }} />
            <View style={styles.scanListBox}>
              <FlatList
                data={filtered}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => <CustomerRow item={item} />}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No scans yet</Text>
                }
                nestedScrollEnabled
              />
            </View>
          </GlassCard>

          <View style={{ height: 12 }} />

          {/* Manual entry form */}
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
                returnKeyType="next"
                autoCorrect={false}
              />
              <TextInput
                value={manualLast}
                onChangeText={setManualLast}
                placeholder="Last name"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                returnKeyType="next"
                autoCorrect={false}
              />
            </View>
            <View style={{ height: 8 }} />
            <TextInput
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Full address"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              returnKeyType="next"
              autoCorrect={false}
            />
            <View style={{ height: 8 }} />
            <View style={styles.manualRow}>
              <TextInput
                value={manualDl}
                onChangeText={setManualDl}
                placeholder="DL #"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                returnKeyType="next"
                autoCapitalize="characters"
              />
              <TextInput
                value={manualExp}
                onChangeText={setManualExp}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>
            <View style={{ height: 8 }} />
            <View style={styles.manualRow}>
              <TextInput
                value={manualTradeVin}
                onChangeText={(t) => setManualTradeVin(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))}
                placeholder="Trade In VIN"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="characters"
                maxLength={17}
                returnKeyType="next"
              />
              <TextInput
                value={manualTradeMiles}
                onChangeText={(t) => setManualTradeMiles(t.replace(/[^0-9,]/g, ''))}
                placeholder="Trade Mileage"
                placeholderTextColor={colors.textMute}
                style={[styles.input, { flex: 1 }]}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>
            <View style={{ height: 8 }} />
            <TextInput
              value={manualVoiVin}
              onChangeText={(t) => setManualVoiVin(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))}
              placeholder="VOI VIN [17 characters]"
              placeholderTextColor={colors.textMute}
              style={styles.input}
              autoCapitalize="characters"
              maxLength={17}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <View style={{ height: 10 }} />
            <Pressable
              onPress={saveManual}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="save" size={14} color={colors.gold} />
              <Text style={styles.saveBtnText}>Save Customer</Text>
            </Pressable>
          </GlassCard>

          {/* Bottom padding so last field clears the save button when keyboard is up */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,12,16,0.98)',
    paddingHorizontal: 16,
    paddingTop: 10,
    // No paddingBottom — ScrollView handles it
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 24,
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
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
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
  // Fixed-height box for the FlatList — prevents it taking all vertical space
  scanListBox: {
    maxHeight: 160,
  },
  emptyText: {
    color: colors.textMute,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  saveBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.15)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: 'rgba(214,178,94,0.30)',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    borderColor: 'rgba(214,178,94,0.04)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
