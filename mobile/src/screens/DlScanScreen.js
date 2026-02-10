import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { loadJson, saveJson } from '../lib/storage';
import { parseAamvaPdf417 } from '../lib/aamva';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';

const STORAGE_KEY = 'sc_v1_driver_license_scans';

function cleanDlNumber(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
}

// NOTE: v1 is barcode-only + manual fallback (per user privacy requirement: NO OCR image upload).
export function DlScanScreen() {
  const [perm, setPerm] = useState(null);
  const [scanning, setScanning] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [expiration, setExpiration] = useState('');

  const [history, setHistory] = useState([]);

  const canScan = useMemo(() => perm?.granted === true, [perm]);

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    (async () => {
      const p = await BarCodeScanner.requestPermissionsAsync();
      setPerm(p);
    })();
  }, []);

  const saveEntry = useCallback(async (entry) => {
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    await saveJson(STORAGE_KEY, next);
  }, [history]);

  const onBarCodeScanned = useCallback(
    async ({ data, type }) => {
      if (!scanning) return;
      setScanning(false);

      // Many US DLs include AAMVA PDF417 on the back. Parsing varies by state.
      // For v1, we store the raw payload and allow manual extraction if needed.
      const entry = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        source: `barcode:${type}`,
        savedAt: new Date().toISOString(),
        raw: String(data || '').slice(0, 6000),
        // extracted (optional for future parser):
        firstName: '',
        lastName: '',
        address: '',
        dlNumber: '',
        expiration: '',
      };

      await saveEntry(entry);
    },
    [scanning, saveEntry]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver’s License</Text>
      <Text style={styles.subtitle}>Barcode-first · No photo upload</Text>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>Scan (PDF417)</Text>
        <Text style={styles.body}>
          Scan the barcode on the back of a US driver’s license when available. This mode does not
          send images anywhere.
        </Text>

        {!canScan && (
          <Text style={[styles.body, { marginTop: 10, color: colors.red }]}>Camera permission not granted.</Text>
        )}

        {scanning && canScan && (
          <View style={styles.scannerWrap}>
            <BarCodeScanner onBarCodeScanned={onBarCodeScanned} style={StyleSheet.absoluteFill} />
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
        <Text style={styles.section}>Manual capture (fallback)</Text>
        <Text style={styles.body}>If barcode is missing/unreadable, enter the required fields.</Text>

        <View style={{ height: 10 }} />

        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />
        <View style={{ height: 10 }} />
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />
        <View style={{ height: 10 }} />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />
        <View style={{ height: 10 }} />
        <TextInput
          value={dlNumber}
          onChangeText={(t) => setDlNumber(cleanDlNumber(t))}
          placeholder="DL #"
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />
        <View style={{ height: 10 }} />
        <TextInput
          value={expiration}
          onChangeText={setExpiration}
          placeholder="Expiration (MM/DD/YYYY)"
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />

        <View style={{ height: 12 }} />

        <Pressable
          onPress={async () => {
            const entry = {
              id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
              source: 'manual',
              savedAt: new Date().toISOString(),
              raw: null,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              address: address.trim(),
              dlNumber: dlNumber.trim(),
              expiration: expiration.trim(),
            };
            await saveEntry(entry);
            setFirstName('');
            setLastName('');
            setAddress('');
            setDlNumber('');
            setExpiration('');
          }}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Save</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={{ marginTop: 14, flex: 1 }}>
        <Text style={styles.section}>Recent</Text>
        <Text style={styles.body}>Stored locally on-device (offline-first).</Text>
        <View style={{ height: 10 }} />

        <FlatList
          data={history}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.source.toUpperCase()}</Text>
              {item.source === 'manual' ? (
                <>
                  <Text style={styles.rowLine}>{item.firstName} {item.lastName}</Text>
                  <Text style={styles.rowLine}>{item.address}</Text>
                  <Text style={styles.rowLine}>DL: {item.dlNumber} · EXP: {item.expiration}</Text>
                </>
              ) : (
                <Text style={styles.rowLine} numberOfLines={2}>RAW: {String(item.raw || '')}</Text>
              )}
            </View>
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
    fontWeight: '700',
  },
  scannerWrap: {
    marginTop: 12,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke2,
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
  rowTitle: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  rowLine: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
  },
});
