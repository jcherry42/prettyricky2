import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Ionicons } from '@expo/vector-icons';
import { loadJson, saveJson } from '../lib/storage';
import { decodeVinWithBackend } from '../lib/nhtsa';
import { addToInventory, countryFlagForVehicle } from '../lib/inventory';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { impactMedium, notificationSuccess, notificationError } from '../lib/haptics';

const STORAGE_KEY = 'sc_v1_vins';

function cleanVin(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

function HistoryItem({ item, onDecode }) {
  const decoded = item.decoded?.vehicle;
  const label = decoded ? `${decoded.year || ''} ${decoded.make || ''} ${decoded.model || ''}`.trim() : null;

  return (
    <Pressable
      onPress={() => onDecode(item)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.vin}>{item.vin}</Text>
        <Text style={styles.meta}>{item.source} · {new Date(item.savedAt).toLocaleDateString()}</Text>
        {label ? <Text style={styles.decodedLine}>{label}</Text> : null}
        {item.savedToInventoryAt ? (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.green} />
            <Text style={[styles.meta, { color: colors.green, marginTop: 0, marginLeft: 4 }]}>Saved to Inventory</Text>
          </View>
        ) : null}
        {item.decodeError ? (
          <Text style={[styles.meta, { color: colors.red }]} numberOfLines={1}>{item.decodeError}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMute} />
    </Pressable>
  );
}

export function VinScanScreen() {
  const [perm, setPerm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualVin, setManualVin] = useState('');
  const [history, setHistory] = useState([]);
  const [decoding, setDecoding] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);


  const [lastScan, setLastScan] = useState(null);

  const canScan = useMemo(() => perm?.granted === true, [perm]);

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  const saveVin = useCallback(async (vin, source) => {
    const v = cleanVin(vin);
    if (v.length !== 17) return null;
    const without = history.filter((h) => h.vin !== v);
    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      vin: v,
      source,
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...without].slice(0, 50);
    setHistory(next);
    await saveJson(STORAGE_KEY, next);
    impactMedium();
    return entry;
  }, [history]);

  const decodeAndSave = useCallback(async (item) => {
    try {
      setDecoding(item.id);
      const decoded = await decodeVinWithBackend(item.vin);
      await addToInventory({ vin: item.vin, decoded });
      const entry = {
        ...item,
        decoded,
        decodedAt: new Date().toISOString(),
        savedToInventoryAt: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, 50);
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
      setLastScan({ vin: item.vin, decoded });
      notificationSuccess();
    } catch (e) {
      const entry = {
        ...item,
        decodeError: String(e?.message || e),
        decodedAt: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, 50);
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
      setLastScan({ vin: item.vin, error: String(e?.message || e) });
      notificationError();
      Alert.alert('Decode Failed', String(e?.message || e));
    } finally {
      setDecoding(null);
    }
  }, [history]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    (async () => {
      const p = await BarCodeScanner.requestPermissionsAsync();
      setPerm(p);
    })();
  }, []);

  const onBarCodeScanned = useCallback(
    async ({ data }) => {
      if (!scanning) return;
      const v = cleanVin(data);
      if (!v || v.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return;
      setScanning(false);
      setScannerOpen(false);
      const entry = await saveVin(v, 'barcode');
      if (entry) {
        await decodeAndSave(entry);
      }
    },
    [scanning, saveVin, decodeAndSave]
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Camera Scanner */}
        <GlassCard>
          <View style={styles.sectionRow}>
            <Ionicons name="camera-outline" size={16} color={colors.gold} />
            <Text style={styles.section}>Camera Scan</Text>
          </View>

          {!canScan && (
            <Text style={[styles.body, { color: colors.red }]}>Camera permission not granted.</Text>
          )}

          <Modal
            visible={scannerOpen && canScan}
            animationType="slide"
            presentationStyle="fullScreen"
            transparent={false}
          >
            <View style={styles.modalRoot}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => { setScannerOpen(false); setScanning(false); }} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.modalTitle}>VIN SCAN</Text>
              </View>
              <View style={styles.modalBody}>
                <View style={styles.scannerWrap}>
                  <BarCodeScanner
                    onBarCodeScanned={onBarCodeScanned}
                    style={StyleSheet.absoluteFill}
                    barCodeTypes={[BarCodeScanner.Constants.BarCodeType.code39, BarCodeScanner.Constants.BarCodeType.code128]}
                  />
                  <View style={styles.scanFrame} />
                </View>
                <Text style={styles.modalHint}>Align the VIN window stamp in the frame. The scanner will capture all 17 characters.</Text>
              </View>
            </View>
          </Modal>

          {!scanning && lastScan?.vin && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.lastScanLabel}>Last VIN</Text>
              <Text style={styles.lastScanVin}>{lastScan.vin}</Text>
              {lastScan.decoded?.vehicle ? (
                <Text style={styles.lastScanDetail}>
                  {[lastScan.decoded.vehicle.year, lastScan.decoded.vehicle.make, lastScan.decoded.vehicle.model].filter(Boolean).join(' ')}
                </Text>
              ) : null}
              {lastScan.error ? (
                <Text style={[styles.lastScanDetail, { color: colors.red }]} numberOfLines={1}>{lastScan.error}</Text>
              ) : null}
            </View>
          )}

          <View style={{ height: 10 }} />

          <Pressable
            onPress={() => {
              if (!canScan) return;
              impactMedium();
              setScanning(true);
              setScannerOpen(true);
            }}
            disabled={!canScan}
            style={({ pressed }) => [styles.btn, scanning && styles.btnActive, (!canScan || pressed) && { opacity: 0.85 }]}
          >
            <Ionicons name="scan" size={16} color={colors.gold} />
            <Text style={styles.btnText}>Scan VIN</Text>
          </Pressable>
        </GlassCard>

        <View style={{ height: 12 }} />

        {/* Manual Entry */}
        <GlassCard>
          <View style={styles.sectionRow}>
            <Ionicons name="keypad-outline" size={16} color={colors.gold} />
            <Text style={styles.section}>Manual Entry</Text>
          </View>
          <View style={{ height: 8 }} />
          <View style={styles.inputRow}>
            <TextInput
              value={manualVin}
              onChangeText={(t) => setManualVin(cleanVin(t))}
              placeholder="Enter 17-digit VIN"
              placeholderTextColor={colors.textMute}
              autoCapitalize="characters"
              style={[styles.input, { flex: 1 }]}
              maxLength={17}
            />
            <Pressable
              onPress={async () => {
                if (manualVin.length >= 8) {
                  await saveVin(manualVin, 'manual');
                  setManualVin('');
                }
              }}
              disabled={manualVin.length < 8}
              style={({ pressed }) => [styles.iconBtn, (manualVin.length < 8 || pressed) && { opacity: 0.6 }]}
            >
              <Ionicons name="add-circle" size={22} color={colors.gold} />
            </Pressable>
          </View>
          {manualVin.length > 0 && manualVin.length < 17 && (
            <Text style={styles.charCount}>{manualVin.length}/17</Text>
          )}
        </GlassCard>

        <View style={{ height: 12 }} />

        {/* History */}
        <GlassCard style={{ flex: 1 }}>
          <View style={styles.sectionRow}>
            <Ionicons name="time-outline" size={16} color={colors.textMute} />
            <Text style={styles.section}>Recent</Text>
            <Text style={[styles.body, { marginTop: 0, marginLeft: 'auto' }]}>{history.length}</Text>
          </View>
          <View style={{ height: 8 }} />

          <FlatList
            data={history}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <HistoryItem item={item} onDecode={decodeAndSave} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingBottom: 14 }}
            showsVerticalScrollIndicator={false}
          />
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  section: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
  },
  body: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 12,
    lineHeight: 16,
  },
  btn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  modalHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  modalTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 13,
    letterSpacing: 2.0,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHint: {
    marginTop: 12,
    color: colors.textMute,
    fontSize: 12,
    lineHeight: 16,
  },
  btnActive: {
    borderColor: 'rgba(255,45,45,0.45)',
    backgroundColor: 'rgba(255,45,45,0.08)',
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
  },
  input: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  scannerWrap: {
    marginTop: 8,
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scanFrame: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 44,
    bottom: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(214,178,94,0.70)',
  },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLeft: {
    flex: 1,
  },
  vin: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  meta: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
  },
  decodedLine: {
    marginTop: 6,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  lastScanLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lastScanVin: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  lastScanDetail: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
});
