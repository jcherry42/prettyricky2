import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal } from 'react-native';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { loadJson, saveJson } from '../lib/storage';
import { uploadImageToLicenseScan } from '../lib/upload';
import { uriToBase64 } from '../lib/image';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { GlassCard } from '../components/GlassCard';
import { impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { createCustomerFromLocalEntry } from '../lib/customers';

const STORAGE_KEY = 'sc_v1_driver_license_scans';

function cleanDlNumber(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function HistoryCard({ item }) {
  const isOcr = item.source === 'ocr';
  return (
    <GlassCard style={styles.histCard}>
      <View style={styles.histHeader}>
        <View style={[styles.sourceBadge, isOcr ? styles.sourceBadgeOcr : styles.sourceBadgeManual]}>
          <Text style={styles.sourceBadgeText}>{isOcr ? 'OCR' : 'MANUAL'}</Text>
        </View>
        {item.ok ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.green} />
        ) : (
          <Ionicons name="alert-circle" size={16} color={colors.red} />
        )}
      </View>
      <Text style={styles.histName}>{item.fullName || 'Name: \u2014'}</Text>
      <Text style={styles.histDetail}>{item.address || 'Address: \u2014'}</Text>
      <Text style={styles.histDetail}>DL: {item.dlNumber || '\u2014'} \u00b7 EXP: {item.expiration || '\u2014'}</Text>
      {typeof item.confidence === 'number' && (
        <Text style={[styles.histDetail, { color: colors.textMute }]}>Confidence: {item.confidence}%</Text>
      )}
      {!item.ok && isOcr && (
        <Text style={[styles.histDetail, { color: colors.red }]}>Fields incomplete \u2014 use manual capture</Text>
      )}
      <Text style={[styles.histDetail, { fontSize: 10, marginTop: 8 }]}>{new Date(item.savedAt).toLocaleString()}</Text>
    </GlassCard>
  );
}

export function DlScanScreen() {
  const [cameraPerm, setCameraPerm] = useState(null);
  const [mediaPerm, setMediaPerm] = useState(null);
  const [scanState, setScanState] = useState({ state: 'idle', error: null });
  const [tab, setTab] = useState('ocr');

  // Manual fields
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

  useEffect(() => { loadHistory(); }, [loadHistory]);

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

  const uploadAndExtract = useCallback(async (asset) => {
    try {
      setScanState({ state: 'uploading', error: null });
      const uri = asset?.uri;
      if (!uri) throw new Error('No image selected');

      const json = await uploadImageToLicenseScan({ uri, mimeType: asset?.mimeType || 'image/jpeg' });
      const d = json?.extracted_data || {};
      const fullName = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ').trim();
      const addressLine = [d.address, d.city, d.state, d.zip_code].filter(Boolean).join(', ').trim();

      const base64 = await uriToBase64(uri);
      const entry = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        source: 'ocr',
        savedAt: new Date().toISOString(),
        imageUrl: json?.image_url || null,
        confidence: json?.confidence ?? null,
        extractionNotes: json?.extraction_notes || null,
        licenseImageBase64: base64,
        fullName,
        address: addressLine,
        dlNumber: d.license_number ? String(d.license_number).trim() : '',
        expiration: d.expiration ? String(d.expiration).trim() : '',
        raw: d,
        ok: Boolean(fullName) && Boolean(addressLine) && Boolean(d.license_number) && Boolean(d.expiration),
      };

      await saveEntry(entry);
      setScanState({ state: 'done', error: null });
      notificationSuccess();
    } catch (e) {
      setScanState({ state: 'error', error: String(e?.message || e) });
      notificationError();
    }
  }, [saveEntry]);

  const takePhoto = useCallback(async () => {
    if (cameraPerm?.granted !== true) {
      Alert.alert('Permission Required', 'Camera permission not granted.');
      return;
    }
    impactMedium();
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false, allowsEditing: false });
    if (result.canceled) return;
    await uploadAndExtract(result.assets?.[0]);
  }, [cameraPerm, uploadAndExtract]);

  const pickFromLibrary = useCallback(async () => {
    if (mediaPerm?.granted !== true) {
      Alert.alert('Permission Required', 'Photo library permission not granted.');
      return;
    }
    impactMedium();
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, base64: false, mediaTypes: ['images'] });
    if (result.canceled) return;
    await uploadAndExtract(result.assets?.[0]);
  }, [mediaPerm, uploadAndExtract]);

  const saveManual = useCallback(async () => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      source: 'manual',
      savedAt: new Date().toISOString(),
      imageUrl: null,
      confidence: null,
      extractionNotes: null,
      fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      address: address.trim(),
      dlNumber: dlNumber.trim(),
      expiration: expiration.trim(),
      raw: null,
      ok: Boolean(firstName.trim() || lastName.trim()) && Boolean(address.trim()) && Boolean(dlNumber.trim()) && Boolean(expiration.trim()),
    };
    await saveEntry(entry);
    notificationSuccess();
    setFirstName('');
    setLastName('');
    setAddress('');
    setDlNumber('');
    setExpiration('');
  }, [firstName, lastName, address, dlNumber, expiration, saveEntry]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Tab Selector */}
        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('ocr')} style={({ pressed }) => [styles.tabBtn, tab === 'ocr' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
            <Ionicons name="camera" size={14} color={tab === 'ocr' ? colors.gold : colors.textMute} />
            <Text style={[styles.tabText, tab === 'ocr' && styles.tabTextActive]}>OCR SCAN</Text>
          </Pressable>
          <Pressable onPress={() => setTab('manual')} style={({ pressed }) => [styles.tabBtn, tab === 'manual' && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
            <Ionicons name="keypad" size={14} color={tab === 'manual' ? colors.gold : colors.textMute} />
            <Text style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>MANUAL</Text>
          </Pressable>
        </View>

        <View style={{ height: 12 }} />

        {tab === 'ocr' ? (
          <GlassCard>
            <View style={{ height: 12 }} />

            <View style={styles.actionRow}>
              <Pressable onPress={takePhoto} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="camera" size={20} color={colors.gold} />
                <Text style={styles.actionBtnText}>Camera</Text>
              </Pressable>

              <Pressable onPress={pickFromLibrary} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="images" size={20} color={colors.gold} />
                <Text style={styles.actionBtnText}>Library</Text>
              </Pressable>
            </View>

            {scanState.state === 'uploading' && (
              <View style={styles.statusRow}>
                <ActivityIndicator color={colors.gold} />
                <Text style={[styles.body, { marginLeft: 10, marginTop: 0 }]}>Scanning with AI Vision\u2026</Text>
              </View>
            )}
            {scanState.state === 'done' && (
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                <Text style={[styles.body, { marginLeft: 8, marginTop: 0, color: colors.green }]}>Scan complete</Text>
              </View>
            )}
            {scanState.state === 'error' && (
              <Text style={[styles.body, { color: colors.red }]}>{scanState.error}</Text>
            )}
          </GlassCard>
        ) : (
          <GlassCard>
            <View style={{ height: 10 }} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldRow}>
                <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.textMute} style={[styles.input, { flex: 1 }]} />
                <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.textMute} style={[styles.input, { flex: 1 }]} />
              </View>
              <View style={{ height: 8 }} />
              <TextInput value={address} onChangeText={setAddress} placeholder="Full address" placeholderTextColor={colors.textMute} style={styles.input} />
              <View style={{ height: 8 }} />
              <View style={styles.fieldRow}>
                <TextInput value={dlNumber} onChangeText={(t) => setDlNumber(cleanDlNumber(t))} placeholder="DL #" placeholderTextColor={colors.textMute} style={[styles.input, { flex: 1 }]} />
                <TextInput value={expiration} onChangeText={setExpiration} placeholder="MM/DD/YYYY" placeholderTextColor={colors.textMute} style={[styles.input, { flex: 1 }]} keyboardType="numeric" />
              </View>
              <View style={{ height: 12 }} />
              <Pressable onPress={saveManual} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="save" size={16} color={colors.gold} />
                <Text style={styles.btnText}>Save Entry</Text>
              </Pressable>
            </ScrollView>
          </GlassCard>
        )}

        <View style={{ height: 12 }} />

        {/* History */}
        <GlassCard style={{ flex: 1 }}>
          <View style={styles.sectionRow}>
            <Ionicons name="time-outline" size={16} color={colors.textMute} />
            <Text style={styles.sectionLabel}>Recent Scans</Text>
            <Text style={[styles.body, { marginTop: 0, marginLeft: 'auto', fontSize: 11 }]}>{history.length}</Text>
          </View>
          <View style={{ height: 8 }} />

          <FlatList
            data={history}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <HistoryCard item={item} />}
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
  tabs: {
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
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
    fontSize: 11,
  },
  tabTextActive: {
    color: colors.gold,
  },
  body: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 10,
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
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
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
  },
  histCard: {
    borderRadius: 18,
  },
  histHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sourceBadgeOcr: {
    backgroundColor: 'rgba(214,178,94,0.15)',
  },
  sourceBadgeManual: {
    backgroundColor: 'rgba(94,167,255,0.15)',
  },
  sourceBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  histName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  histDetail: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
  },
});
