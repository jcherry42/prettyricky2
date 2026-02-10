import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { loadJson, saveJson } from '../lib/storage';
import { buildApiUrl } from '../config/backend';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';

const STORAGE_KEY = 'sc_v1_driver_license_scans';

function cleanDlNumber(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
}

// OCR-first scan (front image upload) + manual fallback.
export function DlScanScreen() {
  const [cameraPerm, setCameraPerm] = useState(null);
  const [mediaPerm, setMediaPerm] = useState(null);

  const [scanState, setScanState] = useState({ state: 'idle', error: null });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [expiration, setExpiration] = useState('');

  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    (async () => {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setCameraPerm(cam);
      setMediaPerm(media);
    })();
  }, []);

  const saveEntry = useCallback(async (entry) => {
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    await saveJson(STORAGE_KEY, next);
  }, [history]);

  const uploadAndExtract = useCallback(
    async (asset) => {
      try {
        setScanState({ state: 'uploading', error: null });

        const uri = asset?.uri;
        if (!uri) throw new Error('No image selected');

        const url = buildApiUrl('/api/license/scan');
        if (!url) throw new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');

        const form = new FormData();
        form.append('image', {
          uri,
          name: 'license.jpg',
          type: asset?.mimeType || 'image/jpeg',
        });

        const res = await fetch(url, {
          method: 'POST',
          body: form,
          // DO NOT set Content-Type manually for FormData
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.detail || json?.error || `Upload failed: ${res.status}`);
        }

        const d = json?.extracted_data || {};

        // Flatten to the 4 required outputs
        const fullName = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ').trim();
        const addressLine = [d.address, d.city, d.state, d.zip_code].filter(Boolean).join(', ').trim();

        const entry = {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          source: 'ocr',
          savedAt: new Date().toISOString(),
          imageUrl: json?.image_url || null,
          confidence: json?.confidence ?? null,
          extractionNotes: json?.extraction_notes || null,

          fullName,
          address: addressLine,
          dlNumber: d.license_number ? String(d.license_number).trim() : '',
          expiration: d.expiration ? String(d.expiration).trim() : '',

          raw: d,
          ok: Boolean(fullName) && Boolean(addressLine) && Boolean(d.license_number) && Boolean(d.expiration),
        };

        await saveEntry(entry);
        setScanState({ state: 'done', error: null });
      } catch (e) {
        setScanState({ state: 'error', error: String(e?.message || e) });
      }
    },
    [saveEntry]
  );

  const takePhoto = useCallback(async () => {
    if (cameraPerm?.granted !== true) {
      setScanState({ state: 'error', error: 'Camera permission not granted' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
      allowsEditing: false,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    await uploadAndExtract(asset);
  }, [cameraPerm, uploadAndExtract]);

  const pickFromLibrary = useCallback(async () => {
    if (mediaPerm?.granted !== true) {
      setScanState({ state: 'error', error: 'Photo library permission not granted' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    await uploadAndExtract(asset);
  }, [mediaPerm, uploadAndExtract]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver’s License</Text>
      <Text style={styles.subtitle}>OCR front scan · PII upload enabled</Text>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.section}>OCR scan (front image)</Text>
        <Text style={styles.body}>
          Take a photo of the FRONT of a US driver’s license. The image is uploaded to the backend and
          processed with OpenAI Vision to extract Name, Address, DL # and Expiration.
        </Text>

        <View style={{ height: 12 }} />

        <Pressable
          onPress={takePhoto}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Take photo</Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={pickFromLibrary}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Choose from library</Text>
        </Pressable>

        {scanState.state === 'uploading' ? (
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.body, { marginLeft: 10 }]}>Scanning…</Text>
          </View>
        ) : null}

        {scanState.state === 'error' ? (
          <Text style={[styles.body, { marginTop: 12, color: colors.red }]}>{scanState.error}</Text>
        ) : null}
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
                <>
                  <Text style={styles.rowLine}>
                    {item.firstName || item.lastName ? `${item.firstName} ${item.lastName}` : 'Name: —'}
                  </Text>
                  <Text style={styles.rowLine}>{item.address ? item.address : 'Address: —'}</Text>
                  <Text style={styles.rowLine}>
                    DL: {item.dlNumber || '—'} · EXP: {item.expiration || '—'}
                  </Text>
                  {!item.ok ? (
                    <Text style={[styles.rowLine, { color: colors.red }]}>
                      Barcode read, but fields incomplete — use Manual capture.
                    </Text>
                  ) : null}
                </>
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
  // (removed legacy barcode scanner styles)
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
