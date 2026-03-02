import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { loadJson, saveJson } from '../lib/storage';
import { uploadFileAuto } from '../utils/chunkedUpload';
import { useCustomers } from '../context/CustomerContext';
import { apiFetch } from '../lib/api';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, notificationSuccess, notificationError, impactLight, impactHeavy } from '../lib/haptics';
import { parseAamvaPdf417, isLikelyAamva } from '../utils/aamvaParser';

const STORAGE_KEY = 'sc_v1_driver_license_scans';
const MAX_HISTORY = 50;

// 10 extraction fields
const EXTRACTION_FIELDS = [
  { key: 'first_name', label: 'First Name', icon: 'person', required: true },
  { key: 'middle_name', label: 'Middle Name', icon: 'person-outline', required: false },
  { key: 'last_name', label: 'Last Name', icon: 'person', required: true },
  { key: 'license_number', label: 'License #', icon: 'card', required: true },
  { key: 'expiration', label: 'Expiration', icon: 'calendar', required: true },
  { key: 'date_of_birth', label: 'Date of Birth', icon: 'gift', required: true },
  { key: 'address', label: 'Address', icon: 'location', required: true },
  { key: 'city', label: 'City', icon: 'business', required: true },
  { key: 'state', label: 'State', icon: 'map', required: true },
  { key: 'zip_code', label: 'ZIP Code', icon: 'pin', required: true },
];

function HistoryCard({ item, onPress, onSaveToCustomer }) {
  const isPdf417 = item.scanMethod === 'pdf417';
  const isOcr = item.scanMethod === 'ocr';
  const confidence = item.confidence || 0;
  const isSavedToCustomer = Boolean(item.savedToCustomerAt);

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

        {/* Header with badges */}
        <View style={styles.historyHeader}>
          <View style={[styles.methodBadge, isPdf417 && styles.methodBadgePdf417]}>
            <Ionicons name={isPdf417 ? 'barcode' : 'scan'} size={12} color="#000" />
            <Text style={styles.methodBadgeText}>{isPdf417 ? 'PDF417' : isOcr ? 'OCR' : 'MANUAL'}</Text>
          </View>
          {confidence > 0 && (
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{confidence}%</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.historyContent}>
          <Text style={styles.historyName}>
            {[item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ') || 'Unknown Name'}
          </Text>
          <View style={styles.historyDetail}>
            <Ionicons name="card" size={12} color={colors.textDim} />
            <Text style={styles.historyDetailText}>
              {item.license_number || '—'}
            </Text>
          </View>
          <View style={styles.historyDetail}>
            <Ionicons name="location" size={12} color={colors.textDim} />
            <Text style={styles.historyDetailText}>
              {[item.city, item.state].filter(Boolean).join(', ') || '—'}
            </Text>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.metaText}>{new Date(item.savedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.historyActions}>
          {isSavedToCustomer ? (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.savedText}>SAVED</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => onSaveToCustomer(item)}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            >
              <Ionicons name="person-add" size={16} color={colors.gold} />
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.gold} style={{ marginLeft: 8 }} />
        </View>

        {/* Stitching */}
        <View style={styles.stitchingTop} />
        <View style={styles.stitchingBottom} />
      </LinearGradient>
    </Pressable>
  );
}

function ExtractionPanel({ data, onEdit, onSaveToCustomer, isSavedToCustomer }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  useEffect(() => {
    setEditedData(data);
  }, [data]);

  const handleSave = () => {
    onEdit(editedData);
    setIsEditing(false);
    impactMedium();
  };

  return (
    <View style={styles.extractionPanel}>
      <View style={styles.extractionHeader}>
        <Text style={styles.extractionTitle}>EXTRACTED DATA</Text>
        {!isEditing ? (
          <Pressable onPress={() => setIsEditing(true)} style={styles.editButton}>
            <Ionicons name="pencil" size={16} color={colors.gold} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
            <Text style={[styles.editButtonText, { color: colors.green }]}>Save</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.fieldsScroll} showsVerticalScrollIndicator={false}>
        {EXTRACTION_FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldContainer}>
            <View style={styles.fieldLabel}>
              <Ionicons name={field.icon} size={14} color={field.required ? colors.gold : colors.textMute} />
              <Text style={styles.fieldLabelText}>
                {field.label}
                {field.required && <Text style={{ color: colors.red }}> *</Text>}
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                value={editedData[field.key] || ''}
                onChangeText={(text) => setEditedData({ ...editedData, [field.key]: text })}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                placeholderTextColor={colors.textMute}
                style={styles.fieldInput}
              />
            ) : (
              <Text style={styles.fieldValue}>{editedData[field.key] || '—'}</Text>
            )}
          </View>
        ))}

        {!isSavedToCustomer && (
          <Pressable
            onPress={onSaveToCustomer}
            style={({ pressed }) => [styles.saveToCustomerButton, pressed && styles.pressed]}
          >
            <Ionicons name="person-add" size={20} color={colors.bg0} />
            <Text style={styles.saveToCustomerText}>Save to Customer Profile</Text>
          </Pressable>
        )}

        {isSavedToCustomer && (
          <View style={styles.savedToCustomerBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={styles.savedToCustomerText}>Saved to Customer Profile</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

export function DlScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { createCustomer } = useCustomers();

  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState(''); // status message for PDF417

  // Debounce refs for PDF417 scanning
  const lastScanTime = useRef(0);
  const lastScannedData = useRef('');
  const SCAN_COOLDOWN_MS = 2000;

  // Animated scan line for PDF417 scanner
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scannerOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [scannerOpen, scanLineAnim]);

  const canScan = permission?.granted === true;

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const saveToHistory = useCallback(
    async (entry) => {
      const next = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
      return entry;
    },
    [history]
  );

  const updateHistoryItem = useCallback(
    async (id, updates) => {
      const next = history.map((item) => (item.id === id ? { ...item, ...updates } : item));
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
    },
    [history]
  );

  const uploadAndScan = useCallback(
    async (uri, scanMethod = 'ocr') => {
      try {
        setUploading(true);
        setUploadProgress(0);

        // Step 1: Upload the image to the server
        const imageUrl = await uploadFileAuto({
          uri,
          filename: `license_${Date.now()}.jpg`,
          contentType: 'image/jpeg',
          onProgress: (current, total) => {
            setUploadProgress(Math.round((current / total) * 50)); // 0-50% for upload
          },
        });

        setUploadProgress(60); // Upload done, starting OCR

        // Step 2: Run OCR on the uploaded image via scan-from-url
        // (This fixes the format mismatch — we send the URL, not a re-upload)
        const response = await apiFetch('/api/license/scan-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl, retry_count: 0 }),
        });

        setUploadProgress(100);

        if (!response.success) {
          // OCR failed but image is saved — let user enter manually
          notificationError();
          Alert.alert(
            'OCR Could Not Read License',
            response.error || 'Please enter the information manually.',
            [{ text: 'OK' }]
          );
          // Still create an entry so user can edit manually
          const entry = {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            scanMethod: 'manual',
            savedAt: new Date().toISOString(),
            imageUrl,
            confidence: 0,
            first_name: '',
            middle_name: '',
            last_name: '',
            license_number: '',
            expiration: '',
            date_of_birth: '',
            address: '',
            city: '',
            state: '',
            zip_code: '',
          };
          await saveToHistory(entry);
          setSelectedItem(entry);
          setShowDetailModal(true);
          return;
        }

        const extracted = response.extracted_data || {};
        const confidence = response.confidence || 0;

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
        setShowDetailModal(true);
        notificationSuccess();
      } catch (error) {
        notificationError();
        Alert.alert('Scan Failed', error.message || 'Unable to scan license');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [saveToHistory]
  );

  const onBarcodeScanned = useCallback(
    async ({ data, type: barcodeType }) => {
      if (!scanning) return;

      // Debounce: prevent duplicate scans
      const now = Date.now();
      if (now - lastScanTime.current < SCAN_COOLDOWN_MS) return;
      if (data === lastScannedData.current) return;

      lastScanTime.current = now;
      lastScannedData.current = data;

      // Check if this looks like AAMVA PDF417 data
      if (!data || data.length < 30) return;

      // Heavy haptic feedback for successful barcode detection
      impactHeavy();
      setScanning(false);
      setScanStatus('Parsing license data...');

      try {
        // ── Step 1: Try client-side AAMVA parsing (instant, no network) ──
        let parsed = null;

        if (isLikelyAamva(data)) {
          parsed = parseAamvaPdf417(data);
        }

        // ── Step 2: If client-side fails, try server-side parsing ──
        if (!parsed || !parsed.success) {
          setScanStatus('Verifying with server...');
          try {
            const serverResponse = await apiFetch('/api/license/parse-pdf417', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ barcode_data: data, scan_source: 'camera' }),
            });

            if (serverResponse.success) {
              parsed = {
                success: true,
                ...serverResponse.extracted_data,
                confidence: serverResponse.confidence,
                aamva_version: serverResponse.aamva_version,
                scan_method: 'pdf417',
                errors: serverResponse.errors || [],
                warnings: serverResponse.warnings || [],
              };
            }
          } catch (serverErr) {
            // Server fallback failed — use client result if partial
            console.warn('Server PDF417 parse failed:', serverErr.message);
          }
        }

        // ── Step 3: Create history entry ──
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
          setScannerOpen(false);
          setSelectedItem(entry);
          setShowDetailModal(true);
          notificationSuccess();
          setScanStatus('');
        } else {
          // Could not parse — let user know
          setScanStatus('');
          setScannerOpen(false);
          notificationError();
          Alert.alert(
            'Could Not Read Barcode',
            'The barcode was detected but could not be parsed. Try scanning the PDF417 barcode on the BACK of the license, or use the camera/gallery option.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        setScanStatus('');
        setScannerOpen(false);
        notificationError();
        Alert.alert('Parse Error', error.message || 'Unable to process barcode data');
      }
    },
    [scanning, saveToHistory]
  );

  const handleCameraScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }

    impactMedium();
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
      base64: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      await uploadAndScan(result.assets[0].uri, 'ocr');
    }
  };

  const handleGalleryScan = async () => {
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
  };

  const handleItemPress = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
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
        phone: '', // License doesn't have phone
        email: '', // License doesn't have email
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
    } catch (error) {
      notificationError();
      Alert.alert('Save Failed', error.message || 'Unable to save customer');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Scan Actions */}
        <LinearGradient
          colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionBezel}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="scan" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>LICENSE SCANNER</Text>
            </View>

            {uploading && (
              <View style={styles.uploadingCard}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.uploadingText}>
                  {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Scanning with AI...'}
                </Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <Pressable
                onPress={handleCameraScan}
                disabled={uploading}
                style={({ pressed }) => [
                  styles.scanButton,
                  uploading && styles.scanButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="camera" size={22} color={uploading ? colors.textMute : colors.gold} />
                <Text style={[styles.scanButtonText, uploading && { color: colors.textMute }]}>Take Photo</Text>
              </Pressable>

              <Pressable
                onPress={handleGalleryScan}
                disabled={uploading}
                style={({ pressed }) => [
                  styles.scanButton,
                  uploading && styles.scanButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="images" size={22} color={uploading ? colors.textMute : colors.gold} />
                <Text style={[styles.scanButtonText, uploading && { color: colors.textMute }]}>From Gallery</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={async () => {
                if (!permission?.granted) {
                  const result = await requestPermission();
                  if (!result.granted) return;
                }
                impactMedium();
                setScanning(true);
                setScannerOpen(true);
              }}
              disabled={uploading}
              style={({ pressed }) => [
                styles.barcodeButton,
                uploading && styles.scanButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="barcode" size={22} color={uploading ? colors.textMute : colors.gold} />
              <Text style={[styles.barcodeButtonText, uploading && { color: colors.textMute }]}>
                Scan PDF417 Barcode
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* PDF417 Scanner Modal */}
        <Modal visible={scannerOpen && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => {
                    setScannerOpen(false);
                    setScanning(false);
                    setScanStatus('');
                  }}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.modalTitle}>PDF417 BARCODE SCANNER</Text>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.scannerWrap}>
                  <CameraView
                    onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{
                      barcodeTypes: ['pdf417'],
                    }}
                  />
                  <View style={styles.scanMaskTop} />
                  <View style={styles.scanFrame}>
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
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 150],
                            }),
                          }],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.scanMaskBottom} />
                </View>

                {scanStatus ? (
                  <View style={styles.scanStatusCard}>
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text style={styles.scanStatusText}>{scanStatus}</Text>
                  </View>
                ) : (
                  <View style={styles.scanHintCard}>
                    <Ionicons name="information-circle" size={20} color={colors.gold} />
                    <Text style={styles.scanHint}>
                      Position the PDF417 barcode on the BACK of the driver's license within the frame. Works with all 50 US states.
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </Modal>

        <View style={{ height: 12 }} />

        {/* History */}
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
              <Text style={styles.emptyText}>No license scans yet</Text>
              <Text style={styles.emptySubtext}>Take a photo or upload from gallery to get started</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <HistoryCard item={item} onPress={handleItemPress} onSaveToCustomer={() => handleSaveToCustomer(item)} />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Detail Modal */}
        <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDetailModal(false)}>
          <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
            <LinearGradient
              colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHeader}
            >
              <Pressable onPress={() => setShowDetailModal(false)} style={styles.closeButton}>
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
                isSavedToCustomer={Boolean(selectedItem.savedToCustomerAt)}
              />
            )}
          </LinearGradient>
        </Modal>
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
  sectionBezel: {
    padding: 3,
    borderRadius: 12,
  },
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
  sectionTitle: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
  uploadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(214,178,94,0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadingText: {
    ...type.body,
    color: colors.gold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  scanButton: {
    flex: 1,
    height: 70,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scanButtonDisabled: {
    opacity: 0.4,
  },
  scanButtonText: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
  barcodeButton: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  barcodeButtonText: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
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
  countText: {
    ...type.label,
    fontSize: 10,
    color: colors.bg0,
  },
  historyCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  historyGradient: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    position: 'relative',
  },
  quiltedPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  historyHeader: {
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
  methodBadgePdf417: {
    backgroundColor: colors.green,
  },
  methodBadgeText: {
    ...type.label,
    fontSize: 9,
    color: '#000',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(64,255,155,0.2)',
  },
  confidenceText: {
    ...type.label,
    fontSize: 10,
    color: colors.green,
  },
  historyContent: {
    marginBottom: 8,
  },
  historyName: {
    ...type.h2,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
  },
  historyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  historyDetailText: {
    ...type.bodyDim,
    fontSize: 12,
    color: colors.textDim,
  },
  historyMeta: {
    marginTop: 6,
  },
  metaText: {
    ...type.bodyDim,
    fontSize: 11,
    color: colors.textMute,
  },
  historyActions: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -15,
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
  savedText: {
    ...type.label,
    fontSize: 9,
    color: colors.green,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(214,178,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchingTop: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: colors.contrastStitching,
    opacity: 0.15,
  },
  stitchingBottom: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: colors.contrastStitching,
    opacity: 0.15,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    ...type.h2,
    color: colors.textDim,
    marginTop: 12,
  },
  emptySubtext: {
    ...type.bodyDim,
    color: colors.textMute,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    height: 80,
    paddingTop: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    left: 16,
    top: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalTitle: {
    ...type.label,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  scannerWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanMaskTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanMaskBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanFrame: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    height: '40%',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 8,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.gold,
    borderWidth: 3,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  scanHint: {
    ...type.body,
    flex: 1,
    color: colors.text,
    lineHeight: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scanStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  scanStatusText: {
    ...type.body,
    color: colors.gold,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
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
  closeButton: {
    padding: 4,
  },
  detailTitle: {
    ...type.h1,
    color: colors.text,
  },
  extractionPanel: {
    flex: 1,
    padding: 20,
  },
  extractionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  extractionTitle: {
    ...type.label,
    fontSize: 13,
    color: colors.gold,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(214,178,94,0.15)',
    borderRadius: 8,
  },
  editButtonText: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
  fieldsScroll: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fieldLabelText: {
    ...type.label,
    fontSize: 11,
    color: colors.textDim,
  },
  fieldValue: {
    ...type.body,
    color: colors.text,
    fontSize: 14,
  },
  fieldInput: {
    ...type.body,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.3)',
    fontSize: 14,
  },
  saveToCustomerButton: {
    marginTop: 8,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveToCustomerText: {
    ...type.body,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.bg0,
    fontSize: 14,
  },
  savedToCustomerBadge: {
    marginTop: 8,
    height: 50,
    borderRadius: 10,
    backgroundColor: 'rgba(64,255,155,0.2)',
    borderWidth: 1.5,
    borderColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savedToCustomerText: {
    ...type.body,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.green,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
