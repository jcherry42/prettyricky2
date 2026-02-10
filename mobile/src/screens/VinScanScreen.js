import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { loadJson, saveJson } from '../lib/storage';
import { decodeVinWithBackend } from '../lib/nhtsa';
import { addToInventory } from '../lib/inventory';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';

const STORAGE_KEY = 'sc_v1_vins';

function cleanVin(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 17);
}

export function VinScanScreen() {
  const [perm, setPerm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualVin, setManualVin] = useState('');
  const [history, setHistory] = useState([]);

  const canScan = useMemo(() => perm?.granted === true, [perm]);

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  const saveVin = useCallback(async (vin, source) => {
    const v = cleanVin(vin);
    if (v.length < 8) return;

    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      vin: v,
      source,
      savedAt: new Date().toISOString(),
    };

    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    await saveJson(STORAGE_KEY, next);
  }, [history]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    (async () => {
      const p = await BarCodeScanner.requestPermissionsAsync();
      setPerm(p);
    })();
  }, []);

  const onBarCodeScanned = useCallback(
    async ({ data, type }) => {
      if (!scanning) return;
      const v = cleanVin(data);
      if (!v) return;
      setScanning(false);
      await saveVin(v, `barcode:${type}`);
    },
    [scanning, saveVin]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VIN</Text>
      <Text style={styles.subtitle}>Scan fast. Save locally. Decode next.</Text>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>Camera VIN Scan</Text>
        <Text style={styles.body}>
          Barcode scan only for now. (No OCR yet.)
        </Text>

        {!canScan && (
          <Text style={[styles.body, { marginTop: 10, color: colors.red }]}>Camera permission not granted.</Text>
        )}

        {scanning && canScan && (
          <View style={styles.scannerWrap}>
            <BarCodeScanner
              onBarCodeScanned={onBarCodeScanned}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.scanFrame} />
          </View>
        )}

        <View style={{ height: 12 }} />

        <Pressable
          onPress={() => setScanning((s) => !s)}
          disabled={!canScan}
          style={({ pressed }) => [styles.btn, (!canScan || pressed) && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>{scanning ? 'Stop scan' : 'Start scan'}</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>Manual entry</Text>
        <View style={{ height: 10 }} />
        <TextInput
          value={manualVin}
          onChangeText={(t) => setManualVin(cleanVin(t))}
          placeholder="Enter VIN"
          placeholderTextColor={colors.textMute}
          autoCapitalize="characters"
          style={styles.input}
          maxLength={17}
        />

        <View style={{ height: 12 }} />

        <Pressable
          onPress={async () => {
            await saveVin(manualVin, 'manual');
            setManualVin('');
          }}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Save VIN</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={{ marginTop: 14, flex: 1 }}>
        <Text style={styles.section}>Recent</Text>
        <Text style={styles.body}>Stored locally on-device (offline-first). Tap to decode.</Text>
        <View style={{ height: 10 }} />

        <FlatList
          data={history}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={async () => {
                // Decode VIN and add to Local Inventory.
                try {
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
                } catch (e) {
                  const entry = {
                    ...item,
                    decodeError: String(e?.message || e),
                    decodedAt: new Date().toISOString(),
                  };
                  const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, 50);
                  setHistory(next);
                  await saveJson(STORAGE_KEY, next);
                }
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
            >
              <Text style={styles.vin}>{item.vin}</Text>
              <Text style={styles.meta}>{item.source}</Text>
              {item.decoded?.vehicle?.year ? (
                <Text style={styles.decodedLine}>
                  {item.decoded.vehicle.year} {item.decoded.vehicle.make} {item.decoded.vehicle.model}
                </Text>
              ) : null}
              {item.decodeError ? (
                <Text style={[styles.decodedLine, { color: colors.red }]} numberOfLines={1}>
                  {item.decodeError}
                </Text>
              ) : null}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingBottom: 14 }}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  section: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
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
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  scannerWrap: {
    marginTop: 12,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke2,
  decodedLine: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
  },

    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scanFrame: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 54,
    bottom: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(214,178,94,0.70)',
  },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
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
});
