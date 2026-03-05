/**
 * DL Scan Screen — Driver's License Scanner
 *
 * Scan Modes:
 *  1. PDF417 Barcode (back of license) — CameraView with full-screen guide frame
 *  2. OCR Photo Capture (front of license) — Custom in-app CameraView (credit-card frame)
 *  3. Gallery Pick — From the device photo library
 *
 * The key change vs. previous build: OCR capture no longer uses the system
 * ImagePicker camera (which takes the user OUT of the app). Instead, it opens
 * a full-screen CameraView with a credit-card-shaped frame guide so the user
 * never leaves the app.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadJson, saveJson } from '../lib/storage';
import { uploadFileAuto } from '../utils/chunkedUpload';
import { useCustomers } from '../context/CustomerContext';
import { apiFetch } from '../lib/api';
import { buildApiUrlAsync } from '../config/backend';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import {
  impactHeavy,
  impactLight,
  impactMedium,
  notificationError,
  notificationSuccess,
} from '../lib/haptics';
import { parseAamvaPdf417, isLikelyAamva } from '../utils/aamvaParser';
import { useCameraLifecycle } from '../hooks/useCameraLifecycle';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sc_v1_driver_license_scans';
const MAX_HISTORY = 50;
const PDF417_COOLDOWN_MS = 700; // Reduced from 2000ms – retry faster after first attempt

// Credit-card aspect ratio: ISO 7810 ID-1 = 85.6 mm × 54 mm
const CARD_ASPECT = 85.6 / 54; // ≈ 1.586

// Extraction fields shown in the detail modal
const EXTRACTION_FIELDS = [
  { key: 'first_name',   label: 'First Name',   icon: 'person',           required: true },
  { key: 'middle_name',  label: 'Middle Name',  icon: 'person-outline',   required: false },
  { key: 'last_name',    label: 'Last Name',    icon: 'person',           required: true },
  { key: 'license_number', label: 'License #',  icon: 'card',             required: true },
  { key: 'expiration',   label: 'Expiration',   icon: 'calendar',         required: true },
  { key: 'date_of_birth',label: 'Date of Birth',icon: 'gift',             required: true },
  { key: 'address',      label: 'Address',      icon: 'location',         required: true },
  { key: 'city',         label: 'City',         icon: 'business',         required: true },
  { key: 'state',        label: 'State',        icon: 'map',              required: true },
  { key: 'zip_code',     label: 'ZIP Code',     icon: 'pin',              required: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function HistoryCard({ item, onPress, onSaveToCustomer }) {
  const isPdf417 = item.scanMethod === 'pdf417';
  const confidence = item.confidence || 0;
  const isSaved = Boolean(item.savedToCustomerAt);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.historyGradient}
      >
        <View style={styles.quiltedPattern} />

        {/* Badges */}
        <View style={styles.historyTop}>
          <View style={[styles.methodBadge, isPdf417 && styles.methodBadgePdf]}>
            <Ionicons name={isPdf417 ? 'barcode' : 'camera'} size={12} color="#000" />
            <Text style={styles.methodBadgeText}>
              {isPdf417 ? 'PDF417' : item.scanMethod === 'ocr' ? 'OCR' : 'MANUAL'}
            </Text>
          </View>
          {confidence > 0 && (
            <View style={styles.confBadge}>
              <Text style={styles.confText}>{confidence}%</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <Text style={styles.historyName}>
          {[item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ') || 'Unknown'}
        </Text>
        <View style={styles.historyRow}>
          <Ionicons name="card" size={12} color={colors.textDim} />
          <Text style={styles.historyMeta}>{item.license_number || '—'}</Text>
        </View>
        <View style={styles.historyRow}>
          <Ionicons name="location" size={12} color={colors.textDim} />
          <Text style={styles.historyMeta}>
            {[item.city, item.state].filter(Boolean).join(', ') || '—'}
          </Text>
        </View>
        <Text style={[styles.historyMeta, { marginTop: 4 }]}>
          {new Date(item.savedAt).toLocaleDateString()}
        </Text>

        {/* Action */}
        <View style={styles.historyAction}>
          {isSaved ? (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.savedText}>SAVED</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => onSaveToCustomer(item)}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <Ionicons name="person-add" size={16} color={colors.gold} />
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.gold} style={{ marginLeft: 8 }} />
        </View>

        <View style={styles.stitchTop} />
        <View style={styles.stitchBottom} />
      </LinearGradient>
    </Pressable>
  );
}

function ExtractionPanel({ data, onEdit, onSaveToCustomer, isSaved }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(data);

  useEffect(() => { setEdited(data); }, [data]);

  const save = () => { onEdit(edited); setEditing(false); impactMedium(); };

  return (
    <View style={styles.extractPanel}>
      <View style={styles.extractHeader}>
        <Text style={styles.extractTitle}>EXTRACTED DATA</Text>
        {!editing ? (
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color={colors.gold} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <Pressable onPress={save} style={styles.editBtn}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
            <Text style={[styles.editBtnText, { color: colors.green }]}>Save</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.fieldsScroll} showsVerticalScrollIndicator={false}>
        {EXTRACTION_FIELDS.map((f) => (
          <View key={f.key} style={styles.fieldBox}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name={f.icon as any} size={14} color={f.required ? colors.gold : colors.textMute} />
              <Text style={styles.fieldLabel}>
                {f.label}
                {f.required && <Text style={{ color: colors.red }}> *</Text>}
              </Text>
            </View>
            {editing ? (
              <TextInput
                value={edited[f.key] || ''}
                onChangeText={(t) => setEdited({ ...edited, [f.key]: t })}
                placeholder={`Enter ${f.label.toLowerCase()}`}
                placeholderTextColor={colors.textMute}
                style={styles.fieldInput}
              />
            ) : (
              <Text style={styles.fieldValue}>{edited[f.key] || '—'}</Text>
            )}
          </View>
        ))}

        {!isSaved ? (
          <Pressable
            onPress={onSaveToCustomer}
            style={({ pressed }) => [styles.saveCustomerBtn, pressed && styles.pressed]}
          >
            <Ionicons name="person-add" size={20} color={colors.bg0} />
            <Text style={styles.saveCustomerText}>Save to Customer Profile</Text>
          </Pressable>
        ) : (
          <View style={styles.savedCustomerBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={styles.savedCustomerText}>Saved to Customer Profile</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DlScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { createCustomer } = useCustomers();
  const insets = useSafeAreaInsets();

  // Upload / scan state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // History
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // ── PDF417 barcode scanner modal ──
  const [pdf417Open, setPdf417Open] = useState(false);
  const [pdf417Scanning, setPdf417Scanning] = useState(false);
  const [pdf417Status, setPdf417Status] = useState('');
  const lastScanTime = useRef(0);
  const lastScannedData = useRef('');

  // ── Custom OCR camera modal (replaces system ImagePicker camera) ──
  const [ocrCamOpen, setOcrCamOpen] = useState(false);
  const [ocrCamReady, setOcrCamReady] = useState(false);
  const [ocrTorch, setOcrTorch] = useState(false);
  const [ocrCapturing, setOcrCapturing] = useState(false);
  const ocrCamRef = useRef(null);

  // Ref pattern (PTT-style) — prevent stale closure in barcode callback
  const historyRef = useRef(history);
  historyRef.current = history;

  // World-class camera lifecycle: AppState-aware, AbortController, Settings link
  const pdf417Lifecycle = useCameraLifecycle(pdf417Open);
  const ocrLifecycle = useCameraLifecycle(ocrCamOpen);

  // Animations
  const pdf417ScanLine = useRef(new Animated.Value(0)).current;
  const ocrScanLine = useRef(new Animated.Value(0)).current;
  const captureFlash = useRef(new Animated.Value(0)).current;

  const canScan = permission?.granted === true;

  // Animate scan lines
  useEffect(() => {
    if (pdf417Open) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pdf417ScanLine, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(pdf417ScanLine, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pdf417Open, pdf417ScanLine]);

  useEffect(() => {
    if (ocrCamOpen) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ocrScanLine, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(ocrScanLine, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [ocrCamOpen, ocrScanLine]);

  // ── History persistence ──────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const saveToHistory = useCallback(async (entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      saveJson(STORAGE_KEY, next);
      return next;
    });
    return entry;
  }, []);

  const updateHistoryItem = useCallback(async (id, updates) => {
    setHistory((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      saveJson(STORAGE_KEY, next);
      return next;
    });
  }, []);

  // ── Upload + AI OCR core ─────────────────────────────────────────────────
  const uploadAndScan = useCallback(async (uri, scanMethod = 'ocr') => {
    // AbortController with 30s timeout (PTT pattern)
    const { signal, cleanup: abortCleanup } = ocrLifecycle.abortableTimeout(30000);

    try {
      setUploading(true);
      setUploadProgress(0);

      const imageUrl = await uploadFileAuto({
        uri,
        filename: `license_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
        onProgress: (cur, tot) => setUploadProgress(Math.round((cur / tot) * 50)),
      });

      setUploadProgress(60);

      const response = await apiFetch('/api/license/scan-from-url', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl, retry_count: 0 }),
        timeout: 30000, // AI Vision OCR can take 10-15 seconds
      });

      abortCleanup();
      setUploadProgress(100);

      const extracted = response.success ? (response.extracted_data || {}) : {};
      const confidence = response.success ? (response.confidence || 0) : 0;

      const entry = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        scanMethod,
        savedAt: new Date().toISOString(),
        imageUrl,
        confidence,
        first_name: extracted.first_name || '',
        middle_name: extracted.middle_name || '',
        last_name: extracted.last_name || '',
        license_number: extracted.license_number || '',
        expiration: extracted.expiration || '',
        date_of_birth: extracted.date_of_birth || '',
        address: extracted.address || '',
        city: extracted.city || '',
        state: extracted.state || '',
        zip_code: extracted.zip_code || '',
      };

      await saveToHistory(entry);
      setSelectedItem(entry);
      setShowDetail(true);

      if (!response.success) {
        notificationError();
        Alert.alert(
          'OCR Incomplete',
          response.error || 'Could not fully read the license. Please verify the fields manually.',
          [{ text: 'OK' }]
        );
      } else {
        notificationSuccess();
      }
    } catch (err) {
      abortCleanup();
      notificationError();
      if (err.name === 'AbortError') {
        Alert.alert('Timeout', 'License scan timed out (30s). Try with better lighting.');
      } else {
        Alert.alert('Scan Failed', err.message || 'Unable to scan license');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [saveToHistory, ocrLifecycle]);

  // ── OCR Custom Camera Capture (replaces system ImagePicker camera) ────────
  const openOcrCamera = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        if (result.canAskAgain === false) {
          ocrLifecycle.showSettingsAlert();
        }
        return;
      }
    }
    impactMedium();
    setOcrCamReady(false);
    setOcrTorch(false);
    setOcrCapturing(false);
    setOcrCamOpen(true);
  }, [permission, requestPermission, ocrLifecycle]);

  const handleOcrCapture = useCallback(async () => {
    if (!ocrCamRef.current || ocrCapturing || !ocrCamReady) return;
    setOcrCapturing(true);
    impactMedium();

    // White flash
    Animated.sequence([
      Animated.timing(captureFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(captureFlash, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await ocrCamRef.current.takePictureAsync({
        quality: 0.88,
        base64: false,
        skipProcessing: false,
      });

      setOcrCamOpen(false);
      setOcrTorch(false);

      if (photo?.uri) {
        await uploadAndScan(photo.uri, 'ocr');
      }
    } catch (e) {
      notificationError();
      Alert.alert('Capture Failed', e.message || 'Could not capture photo');
    } finally {
      setOcrCapturing(false);
    }
  }, [ocrCapturing, ocrCamReady, captureFlash, uploadAndScan]);

  // ── Gallery picker ────────────────────────────────────────────────────────
  const handleGallery = useCallback(async () => {
    impactMedium();
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets?.[0]) {
      await uploadAndScan(result.assets[0].uri, 'ocr');
    }
  }, [uploadAndScan]);

  // ── PDF417 Barcode handler ────────────────────────────────────────────────
  const onBarcodeScanned = useCallback(async ({ data }) => {
    if (!pdf417Scanning) return;

    const now = Date.now();
    if (now - lastScanTime.current < PDF417_COOLDOWN_MS) return;
    // Accept if meaningfully different data (handles slight scan variations)
    if (data === lastScannedData.current) return;
    // PDF417 barcodes start with control chars — minimum 20 chars
    if (!data || data.length < 20) return;

    lastScanTime.current = now;
    lastScannedData.current = data;

    impactHeavy();
    setPdf417Scanning(false);
    setPdf417Status('Reading barcode…');

    try {
      let parsed = null;

      // Client-side parser first (instant, no network)
      if (isLikelyAamva(data)) {
        parsed = parseAamvaPdf417(data);
      }

      // Server fallback — handles edge cases the client misses
      if (!parsed || !parsed.success) {
        setPdf417Status('Verifying with server…');
        try {
          const serverResp = await apiFetch('/api/license/parse-pdf417', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode_data: data, scan_source: 'camera' }),
          });
          if (serverResp.success) {
            parsed = {
              success: true,
              ...serverResp.extracted_data,
              confidence: serverResp.confidence,
              aamva_version: serverResp.aamva_version,
              scan_method: 'pdf417',
              errors: serverResp.errors || [],
            };
          }
        } catch (sErr) {
          console.warn('Server PDF417 fallback failed:', sErr.message);
        }
      }

      if (parsed && parsed.success) {
        const entry = {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          scanMethod: 'pdf417',
          savedAt: new Date().toISOString(),
          imageUrl: null,
          confidence: parsed.confidence || 0,
          aamvaVersion: parsed.aamva_version,
          first_name: parsed.first_name || '',
          middle_name: parsed.middle_name || '',
          last_name: parsed.last_name || '',
          license_number: parsed.license_number || '',
          expiration: parsed.expiration || '',
          date_of_birth: parsed.date_of_birth || '',
          address: parsed.address || '',
          city: parsed.city || '',
          state: parsed.state || '',
          zip_code: parsed.zip_code || '',
        };
        await saveToHistory(entry);
        setPdf417Open(false);
        setPdf417Scanning(false);
        setSelectedItem(entry);
        setShowDetail(true);
        notificationSuccess();
        setPdf417Status('');
      } else {
        // Keep scanner open — let user try from a better angle
        notificationError();
        setPdf417Status('');
        lastScannedData.current = '';
        lastScanTime.current = 0;
        setPdf417Scanning(true);
        Alert.alert(
          'Barcode Detected — Could Not Parse',
          'Move the license a bit closer, make sure the BACK is fully in frame, and hold steady.',
          [
            { text: 'Keep Trying', onPress: () => {} },
            { text: 'Close', style: 'cancel', onPress: () => { setPdf417Open(false); setPdf417Scanning(false); } },
          ]
        );
      }
    } catch (err) {
      setPdf417Status('');
      setPdf417Open(false);
      setPdf417Scanning(false);
      notificationError();
      Alert.alert('Parse Error', err.message || 'Unable to process barcode');
    }
  }, [pdf417Scanning, saveToHistory]);

  const openPdf417 = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        if (result.canAskAgain === false) {
          pdf417Lifecycle.showSettingsAlert();
        }
        return;
      }
    }
    impactMedium();
    setPdf417Scanning(true);
    setPdf417Status('');
    // Reset both refs so a new session starts clean
    lastScannedData.current = '';
    lastScanTime.current = 0;
    setPdf417Open(true);
  }, [permission, requestPermission, pdf417Lifecycle]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleItemPress = (item) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  const handleEdit = (editedData) => {
    if (selectedItem) {
      updateHistoryItem(selectedItem.id, editedData);
      setSelectedItem({ ...selectedItem, ...editedData });
    }
  };

  const handleSaveToCustomer = async (item) => {
    try {
      impactMedium();
      if (!item.first_name || !item.last_name) {
        Alert.alert('Incomplete Data', 'First name and last name are required');
        return;
      }
      const customerData = {
        first_name: item.first_name,
        last_name: item.last_name,
        phone: '',
        email: '',
        address: [item.address, item.city, item.state, item.zip_code].filter(Boolean).join(', '),
        lead_status: 'new',
        notes: `License #: ${item.license_number || 'N/A'}\nDOB: ${item.date_of_birth || 'N/A'}\nExpiration: ${item.expiration || 'N/A'}`,
      };
      await createCustomer(customerData);
      await updateHistoryItem(item.id, { savedToCustomerAt: new Date().toISOString() });
      if (selectedItem?.id === item.id) {
        setSelectedItem({ ...item, savedToCustomerAt: new Date().toISOString() });
      }
      notificationSuccess();
      Alert.alert('Success', 'Customer profile created successfully');
    } catch (err) {
      notificationError();
      Alert.alert('Save Failed', err.message || 'Unable to save customer');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>

        {/* ── Scan Action Cards ── */}
        <LinearGradient
          colors={['rgba(40,25,12,0.85)', 'rgba(30,18,8,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionBezel}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="scan" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>LICENSE SCANNER</Text>
            </View>

            {/* Upload progress */}
            {uploading && (
              <View style={styles.uploadCard}>
                <ActivityIndicator size="small" color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadText}>
                    {uploadProgress < 55 ? `Uploading… ${uploadProgress}%` : 'Reading with AI Vision…'}
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                </View>
              </View>
            )}

            {/* Three scan mode buttons */}
            <View style={styles.scanModes}>
              {/* OCR Camera (custom in-app camera) */}
              <Pressable
                onPress={openOcrCamera}
                disabled={uploading}
                style={({ pressed }) => [styles.scanModeBtn, uploading && styles.disabled, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={['rgba(214,178,94,0.10)', 'rgba(214,178,94,0.03)']}
                  style={styles.scanModeGrad}
                >
                  <Ionicons name="camera" size={28} color={uploading ? colors.textMute : colors.gold} />
                  <Text style={[styles.scanModeLabel, uploading && { color: colors.textMute }]}>FRONT SCAN</Text>
                  <Text style={styles.scanModeHint}>Capture front of license</Text>
                </LinearGradient>
              </Pressable>

              {/* PDF417 barcode scanner */}
              <Pressable
                onPress={openPdf417}
                disabled={uploading}
                style={({ pressed }) => [styles.scanModeBtn, uploading && styles.disabled, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={['rgba(64,210,255,0.10)', 'rgba(64,210,255,0.03)']}
                  style={styles.scanModeGrad}
                >
                  <Ionicons name="barcode" size={28} color={uploading ? colors.textMute : '#40D2FF'} />
                  <Text style={[styles.scanModeLabel, { color: uploading ? colors.textMute : '#40D2FF' }]}>PDF417</Text>
                  <Text style={styles.scanModeHint}>Scan back barcode</Text>
                </LinearGradient>
              </Pressable>

              {/* Gallery */}
              <Pressable
                onPress={handleGallery}
                disabled={uploading}
                style={({ pressed }) => [styles.scanModeBtn, uploading && styles.disabled, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={['rgba(100,155,255,0.10)', 'rgba(100,155,255,0.03)']}
                  style={styles.scanModeGrad}
                >
                  <Ionicons name="images" size={28} color={uploading ? colors.textMute : '#649BFF'} />
                  <Text style={[styles.scanModeLabel, { color: uploading ? colors.textMute : '#649BFF' }]}>GALLERY</Text>
                  <Text style={styles.scanModeHint}>Pick from photos</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <Text style={styles.tipText}>
              💡 PDF417 (back barcode) is the fastest and most accurate method.
            </Text>
          </View>
        </LinearGradient>

        <View style={{ height: 12 }} />

        {/* ── Recent Scans ── */}
        <View style={styles.historyContainer}>
          <View style={styles.historyHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color={colors.textMute} />
              <Text style={styles.sectionTitle}>RECENT SCANS</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{history.length}</Text>
            </View>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="scan" size={48} color={colors.textMute} />
              <Text style={styles.emptyTitle}>No license scans yet</Text>
              <Text style={styles.emptySubtext}>Scan a driver's license to get started</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <HistoryCard item={item} onPress={handleItemPress} onSaveToCustomer={() => handleSaveToCustomer(item)} />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* ════════════════════════════════════════════════════════════════
            OCR CAMERA MODAL — Custom in-app camera for license front photo
            Replaces the old system ImagePicker.launchCameraAsync call.
            Shows a credit-card-ratio frame guide for perfect framing.
          ════════════════════════════════════════════════════════════════ */}
        <Modal visible={ocrCamOpen && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={['#000', '#0a0f1a']} style={{ flex: 1 }}>

              {/* Header */}
              <View style={[styles.modalHeader, { paddingTop: insets.top + 10, height: 60 + insets.top }]}>
                <Pressable
                  onPress={() => { setOcrCamOpen(false); setOcrTorch(false); }}
                  style={[styles.modalCloseBtn, { top: insets.top + 8 }]}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="camera" size={16} color={colors.gold} />
                  <Text style={styles.modalTitle}>FRONT OF LICENSE</Text>
                </View>
                <Pressable
                  onPress={() => setOcrTorch((t) => !t)}
                  style={[styles.torchBtn, { top: insets.top + 8 }, ocrTorch && styles.torchBtnOn]}
                >
                  <Ionicons
                    name={ocrTorch ? 'flashlight' : 'flashlight-outline'}
                    size={20}
                    color={ocrTorch ? '#000' : colors.text}
                  />
                </Pressable>
              </View>

              {/* Camera + frame guide — paused when app backgrounds */}
              <View style={styles.ocrCamBody}>
                <View style={styles.ocrCamWrap}>
                  {ocrLifecycle.isActive ? (
                  <CameraView
                    ref={ocrCamRef}
                    style={StyleSheet.absoluteFill}
                    enableTorch={ocrTorch && ocrCamReady}
                    onCameraReady={() => setOcrCamReady(true)}
                    autofocus="on"
                    facing="back"
                  />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0E14', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="pause-circle-outline" size={48} color={colors.textDim} />
                      <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 12 }}>Camera paused</Text>
                    </View>
                  )}

                  {/* White flash overlay */}
                  <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: captureFlash }]}
                  />

                  {/* Dark mask — top and bottom */}
                  <View style={styles.ocrMaskTop} />
                  <View style={styles.ocrMaskBottom} />

                  {/* Credit-card guide frame */}
                  <View style={styles.ocrFrame}>
                    {/* Corner markers */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />

                    {/* Animated scan line */}
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [{
                            translateY: ocrScanLine.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 500],
                            }),
                          }],
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Instruction */}
                <View style={styles.ocrInstruction}>
                  <Ionicons name="information-circle" size={18} color={colors.gold} />
                  <Text style={styles.ocrInstructionText}>
                    Place the FRONT of the license flat inside the frame.{'\n'}
                    Avoid shadows, glare, and obstructions.
                  </Text>
                </View>

                {/* Large shutter button */}
                <Pressable
                  onPress={handleOcrCapture}
                  disabled={ocrCapturing || !ocrCamReady}
                  style={({ pressed }) => [
                    styles.shutterOuter,
                    (ocrCapturing || !ocrCamReady) && styles.disabled,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={styles.shutterInner}>
                    {ocrCapturing ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Ionicons name="camera" size={32} color={colors.bg0} />
                    )}
                  </View>
                  <Text style={styles.shutterLabel}>
                    {ocrCapturing ? 'CAPTURING…' : 'CAPTURE LICENSE'}
                  </Text>
                </Pressable>

                <View style={{ height: Math.max(insets.bottom, 16) + 8 }} />
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════════
            PDF417 BARCODE SCANNER MODAL
          ════════════════════════════════════════════════════════════════ */}
        <Modal visible={pdf417Open && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>

              <View style={[styles.modalHeader, { paddingTop: insets.top + 10, height: 60 + insets.top }]}>
                <Pressable
                  onPress={() => { setPdf417Open(false); setPdf417Scanning(false); setPdf417Status(''); }}
                  style={[styles.modalCloseBtn, { top: insets.top + 8 }]}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="barcode" size={16} color="#40D2FF" />
                  <Text style={[styles.modalTitle, { color: '#40D2FF' }]}>PDF417 SCANNER</Text>
                </View>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.scannerWrap}>
                  {pdf417Lifecycle.isActive ? (
                  <CameraView
                    onBarcodeScanned={pdf417Scanning ? onBarcodeScanned : undefined}
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }}
                    facing="back"
                    autofocus="on"
                  />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0E14', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="pause-circle-outline" size={48} color={colors.textDim} />
                      <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 12 }}>Camera paused</Text>
                    </View>
                  )}

                  <View style={styles.pdf417MaskTop} />
                  <View style={styles.pdf417Frame}>
                    <View style={[styles.corner, { borderColor: '#40D2FF' }, styles.cornerTL]} />
                    <View style={[styles.corner, { borderColor: '#40D2FF' }, styles.cornerTR]} />
                    <View style={[styles.corner, { borderColor: '#40D2FF' }, styles.cornerBL]} />
                    <View style={[styles.corner, { borderColor: '#40D2FF' }, styles.cornerBR]} />
                    <Animated.View
                      style={[
                        styles.scanLine,
                        { borderColor: '#40D2FF', backgroundColor: '#40D2FF' },
                        {
                          transform: [{
                            translateY: pdf417ScanLine.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 500],
                            }),
                          }],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.pdf417MaskBottom} />
                </View>

                {pdf417Status ? (
                  <View style={styles.statusCard}>
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text style={styles.statusText}>{pdf417Status}</Text>
                  </View>
                ) : (
                  <View style={styles.hintCard}>
                    <Ionicons name="information-circle" size={20} color="#40D2FF" />
                    <Text style={[styles.hintText, { color: '#40D2FF' }]}>
                      Point at the PDF417 barcode on the{' '}
                      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>BACK</Text>
                      {' '}of the license. Scanning automatically.
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════════
            DETAIL / EXTRACTION MODAL
          ════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={showDetail}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDetail(false)}
        >
          <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
            <LinearGradient
              colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHeader}
            >
              <Pressable onPress={() => setShowDetail(false)} style={styles.detailClose}>
                <Ionicons name="close" size={28} color={colors.text} />
              </Pressable>
              <Text style={styles.detailTitle}>License Details</Text>
              <View style={{ width: 28 }} />
            </LinearGradient>

            {selectedItem && (
              <ExtractionPanel
                data={selectedItem}
                onEdit={handleEdit}
                onSaveToCustomer={() => handleSaveToCustomer(selectedItem)}
                isSaved={Boolean(selectedItem.savedToCustomerAt)}
              />
            )}
          </LinearGradient>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // Section
  sectionBezel: { padding: 3, borderRadius: 12 },
  sectionCard: {
    backgroundColor: colors.panel,
    borderRadius: 9,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { ...type.label, fontSize: 11, color: colors.gold },

  // Upload progress
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadText: { ...type.body, color: colors.gold, marginBottom: 6 },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(214,178,94,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },

  // Scan mode buttons row
  scanModes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scanModeBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(6,8,12,0.90)',
  },
  scanModeGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 5,
    minHeight: 90,
  },
  scanModeLabel: { ...type.label, fontSize: 10, color: colors.gold, letterSpacing: 0.8 },
  scanModeHint: { ...type.bodyDim, fontSize: 9, color: colors.textMute, textAlign: 'center' },
  tipText: { ...type.bodyDim, fontSize: 11, color: colors.textMute, textAlign: 'center' },

  // History
  historyContainer: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countText: { ...type.label, fontSize: 10, color: colors.bg0 },

  // History card
  historyCard: { borderRadius: 10, overflow: 'hidden' },
  historyGradient: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
  },
  quiltedPattern: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.gold,
  },
  methodBadgePdf: { backgroundColor: colors.green },
  methodBadgeText: { ...type.label, fontSize: 9, color: '#000' },
  confBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(64,255,155,0.2)',
  },
  confText: { ...type.label, fontSize: 10, color: colors.green },
  historyName: { ...type.h2, fontSize: 16, color: colors.text, marginBottom: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  historyMeta: { ...type.bodyDim, fontSize: 12, color: colors.textDim },
  historyAction: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(64,255,155,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savedText: { ...type.label, fontSize: 9, color: colors.green },
  saveBtn: {
    width: 34, height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(214,178,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchTop: {
    position: 'absolute', top: 4, left: 8, right: 8,
    height: 1, backgroundColor: colors.contrastStitching, opacity: 0.15,
  },
  stitchBottom: {
    position: 'absolute', bottom: 4, left: 8, right: 8,
    height: 1, backgroundColor: colors.contrastStitching, opacity: 0.15,
  },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { ...type.h2, color: colors.textDim, marginTop: 12 },
  emptySubtext: {
    ...type.bodyDim, color: colors.textMute, marginTop: 6,
    textAlign: 'center', paddingHorizontal: 20,
  },

  // Modal root
  modalRoot: { flex: 1 },
  modalHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    left: 16,
    width: 42, height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  torchBtn: {
    position: 'absolute',
    right: 16,
    width: 42, height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  torchBtnOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { ...type.label, fontSize: 13, color: colors.gold, letterSpacing: 1.5 },
  modalBody: { flex: 1, padding: 16 },

  // ── OCR Camera ──
  ocrCamBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  ocrCamWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  ocrMaskTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '22%',
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  ocrMaskBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '22%',
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  ocrFrame: {
    // Credit-card frame: fits within the middle 56% vertical space
    position: 'absolute',
    top: '22%',
    bottom: '22%',
    left: 16,
    right: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 10,
    overflow: 'hidden', // Clips scan line to card frame
  },
  ocrInstruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.25)',
  },
  ocrInstructionText: {
    ...type.body,
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },

  // Large shutter button
  shutterOuter: {
    alignItems: 'center',
    gap: 10,
  },
  shutterInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  shutterLabel: { ...type.label, fontSize: 11, color: colors.textDim, letterSpacing: 1 },

  // PDF417 scanner
  scannerWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  pdf417MaskTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '25%',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  pdf417MaskBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '25%',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  pdf417Frame: {
    position: 'absolute',
    top: '25%',
    left: 20,
    right: 20,
    height: '50%',
    borderWidth: 2,
    borderColor: '#40D2FF',
    borderRadius: 8,
    overflow: 'hidden', // Clips scan line to frame
  },

  // Shared scan line
  scanLine: {
    position: 'absolute',
    left: 6, right: 6,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  // Corner markers
  corner: {
    position: 'absolute',
    width: 22, height: 22,
    borderColor: colors.gold,
    borderWidth: 3,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },

  // Status / hint cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.18)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  statusText: { ...type.body, color: colors.gold },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(64,210,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(64,210,255,0.3)',
  },
  hintText: { ...type.body, flex: 1, color: colors.text, lineHeight: 18 },

  // Detail modal
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  detailClose: { padding: 4 },
  detailTitle: { ...type.h1, color: colors.text },

  // Extraction panel
  extractPanel: { flex: 1, padding: 20 },
  extractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  extractTitle: { ...type.label, fontSize: 13, color: colors.gold },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(214,178,94,0.15)',
    borderRadius: 8,
  },
  editBtnText: { ...type.label, fontSize: 11, color: colors.gold },
  fieldsScroll: { flex: 1 },
  fieldBox: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  fieldLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  fieldLabel: { ...type.label, fontSize: 11, color: colors.textDim },
  fieldValue: { ...type.body, color: colors.text, fontSize: 14 },
  fieldInput: {
    ...type.body,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.3)',
    fontSize: 14,
  },
  saveCustomerBtn: {
    marginTop: 8, height: 52,
    borderRadius: 10,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveCustomerText: { ...type.body, fontFamily: 'SpaceGrotesk_700Bold', color: colors.bg0, fontSize: 15 },
  savedCustomerBadge: {
    marginTop: 8, height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(64,255,155,0.15)',
    borderWidth: 1.5,
    borderColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savedCustomerText: { ...type.body, fontFamily: 'SpaceGrotesk_700Bold', color: colors.green, fontSize: 15 },

  // Shared
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
});
