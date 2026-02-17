import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { loadJson, saveJson } from '../lib/storage';
import { decodeVinWithBackend } from '../lib/nhtsa';
import { useInventory } from '../context/InventoryContext';
import { validateVin, validateVinChecksum } from '../utils/vinChecksum';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, notificationSuccess, notificationError, impactLight } from '../lib/haptics';

const STORAGE_KEY = 'sc_v1_vins';
const MAX_HISTORY = 75;

function cleanVin(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

function HistoryItem({ item, onPress, onSaveToInventory, isAtLimit }) {
  const decoded = item.decoded?.vehicle;
  const label = decoded ? `${decoded.year || ''} ${decoded.make || ''} ${decoded.model || ''}`.trim() : null;
  const isInInventory = Boolean(item.savedToInventoryAt);

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
        {/* Quilted pattern overlay */}
        <View style={styles.quiltedPattern} />
        
        <View style={styles.historyContent}>
          <View style={styles.historyLeft}>
            <Text style={styles.vinText}>{item.vin}</Text>
            {label && <Text style={styles.vinLabel}>{label}</Text>}
            <View style={styles.historyMeta}>
              <Ionicons name={item.source === 'barcode' ? 'scan' : 'keypad'} size={12} color={colors.textMute} />
              <Text style={styles.metaText}>{new Date(item.savedAt).toLocaleDateString()}</Text>
            </View>
            {item.decodeError && (
              <Text style={[styles.metaText, { color: colors.red }]} numberOfLines={1}>
                {item.decodeError}
              </Text>
            )}
          </View>

          <View style={styles.historyRight}>
            {isInInventory ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                <Text style={styles.savedText}>SAVED</Text>
              </View>
            ) : decoded && !isAtLimit ? (
              <Pressable
                onPress={() => onSaveToInventory(item)}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Ionicons name="save" size={16} color={colors.gold} />
              </Pressable>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.gold} style={{ marginLeft: 8 }} />
          </View>
        </View>

        {/* Contrast stitching */}
        <View style={styles.stitchingTop} />
        <View style={styles.stitchingBottom} />
      </LinearGradient>
    </Pressable>
  );
}

export function VinScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { addVehicle, isAtLimit, maxInventory, vehicles } = useInventory();

  const [scanning, setScanning] = useState(false);
  const [manualVin, setManualVin] = useState('');
  const [history, setHistory] = useState([]);
  const [decoding, setDecoding] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [vinValidation, setVinValidation] = useState(null);

  const canScan = useMemo(() => permission?.granted === true, [permission]);

  const loadHistory = useCallback(async () => {
    const parsed = await loadJson(STORAGE_KEY, []);
    setHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  const saveVin = useCallback(async (vin, source) => {
    const v = cleanVin(vin);
    if (v.length !== 17) return null;

    // Validate VIN checksum
    const validation = validateVin(v);
    if (!validation.valid) {
      setVinValidation(validation);
      notificationError();
      Alert.alert('Invalid VIN', validation.error || 'VIN validation failed');
      return null;
    }

    const without = history.filter((h) => h.vin !== v);
    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      vin: v,
      source,
      savedAt: new Date().toISOString(),
      checksumValid: validateVinChecksum(v),
    };
    const next = [entry, ...without].slice(0, MAX_HISTORY);
    setHistory(next);
    await saveJson(STORAGE_KEY, next);
    impactMedium();
    return entry;
  }, [history]);

  const decodeAndSave = useCallback(async (item) => {
    try {
      setDecoding(item.id);
      const decoded = await decodeVinWithBackend(item.vin);
      
      const entry = {
        ...item,
        decoded,
        decodedAt: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY);
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
      const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY);
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
      setLastScan({ vin: item.vin, error: String(e?.message || e) });
      notificationError();
    } finally {
      setDecoding(null);
    }
  }, [history]);

  const saveToInventory = useCallback(async (item) => {
    if (isAtLimit) {
      Alert.alert('Inventory Full', `Maximum ${maxInventory} vehicles reached. Please delete some vehicles first.`);
      return;
    }

    if (!item.decoded) {
      Alert.alert('Decode First', 'Please decode this VIN before adding to inventory');
      return;
    }

    try {
      impactMedium();
      await addVehicle({
        vin: item.vin,
        ...item.decoded.vehicle,
      });

      const entry = {
        ...item,
        savedToInventoryAt: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY);
      setHistory(next);
      await saveJson(STORAGE_KEY, next);
      notificationSuccess();
      Alert.alert('Success', 'Vehicle added to inventory');
    } catch (e) {
      notificationError();
      Alert.alert('Save Failed', String(e?.message || e));
    }
  }, [history, addVehicle, isAtLimit, maxInventory]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onBarcodeScanned = useCallback(
    async ({ data }) => {
      if (!scanning) return;
      const v = cleanVin(data);
      if (!v || v.length !== 17) return;

      // Validate VIN format
      const validation = validateVin(v);
      if (!validation.valid) {
        impactLight();
        return; // Silent fail on invalid VINs during scanning
      }

      setScanning(false);
      setScannerOpen(false);
      const entry = await saveVin(v, 'barcode');
      if (entry) {
        await decodeAndSave(entry);
      }
    },
    [scanning, saveVin, decodeAndSave]
  );

  const handleManualEntry = async () => {
    if (manualVin.length !== 17) return;
    const entry = await saveVin(manualVin, 'manual');
    if (entry) {
      await decodeAndSave(entry);
    }
    setManualVin('');
    setVinValidation(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Camera Scanner Card */}
        <LinearGradient
          colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionBezel}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>CAMERA SCAN</Text>
            </View>

            {!canScan && (
              <Text style={[styles.body, { color: colors.red }]}>Camera permission required</Text>
            )}

            {lastScan?.vin && (
              <View style={styles.lastScanCard}>
                <Text style={styles.lastScanLabel}>Last Scanned VIN</Text>
                <Text style={styles.lastScanVin}>{lastScan.vin}</Text>
                {lastScan.decoded?.vehicle && (
                  <Text style={styles.lastScanDetail}>
                    {[lastScan.decoded.vehicle.year, lastScan.decoded.vehicle.make, lastScan.decoded.vehicle.model]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                )}
                {lastScan.error && (
                  <Text style={[styles.lastScanDetail, { color: colors.red }]}>{lastScan.error}</Text>
                )}
              </View>
            )}

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
              style={({ pressed }) => [styles.scanButton, scanning && styles.scanButtonActive, pressed && styles.pressed]}
            >
              <Ionicons name="scan" size={20} color={scanning ? colors.text : colors.gold} />
              <Text style={[styles.scanButtonText, scanning && { color: colors.text }]}>
                {scanning ? 'Scanning...' : 'Scan VIN from Windshield'}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* Camera Modal */}
        <Modal visible={scannerOpen && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => {
                    setScannerOpen(false);
                    setScanning(false);
                  }}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.modalTitle}>VIN WINDSHIELD SCANNER</Text>
              </View>

              {/* Camera View */}
              <View style={styles.modalBody}>
                <View style={styles.scannerWrap}>
                  <CameraView
                    onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{
                      barcodeTypes: [
                        'code39',
                        'code128',
                        'code93',
                        'datamatrix',
                        'qr',
                        'ean13',
                        'ean8',
                        'pdf417',
                        'upc_e',
                        'aztec',
                        'interleaved2of5',
                        'itf14',
                      ],
                    }}
                  />
                  {/* Mask overlay */}
                  <View style={styles.scanMaskTop} />
                  
                  {/* Windshield guide frame */}
                  <View style={styles.scanFrame}>
                    {/* Corner guides */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    
                    {/* Center crosshair */}
                    <View style={styles.crosshair}>
                      <View style={styles.crosshairH} />
                      <View style={styles.crosshairV} />
                    </View>
                  </View>
                  
                  <View style={styles.scanMaskBottom} />
                </View>

                <View style={styles.scanHintCard}>
                  <Ionicons name="information-circle" size={20} color={colors.gold} />
                  <Text style={styles.scanHint}>
                    Position the VIN plate in the frame. Look for the small sticker on the windshield near the dashboard. All 17 characters will be captured automatically.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        <View style={{ height: 12 }} />

        {/* Manual Entry Card */}
        <LinearGradient
          colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionBezel}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="keypad" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>MANUAL ENTRY</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={manualVin}
                onChangeText={(t) => {
                  setManualVin(cleanVin(t));
                  setVinValidation(null);
                }}
                placeholder="Enter 17-digit VIN"
                placeholderTextColor={colors.textMute}
                autoCapitalize="characters"
                style={styles.vinInput}
                maxLength={17}
              />
              <Pressable
                onPress={handleManualEntry}
                disabled={manualVin.length !== 17 || Boolean(decoding)}
                style={({ pressed }) => [
                  styles.addButton,
                  (manualVin.length !== 17 || decoding) && styles.addButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {decoding ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Ionicons name="arrow-forward-circle" size={24} color={colors.gold} />
                )}
              </Pressable>
            </View>

            {manualVin.length > 0 && manualVin.length < 17 && (
              <Text style={styles.charCount}>{manualVin.length}/17 characters</Text>
            )}

            {vinValidation && !vinValidation.valid && (
              <View style={styles.validationError}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={styles.validationText}>{vinValidation.error}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={{ height: 12 }} />

        {/* Inventory Status */}
        <View style={styles.inventoryStatus}>
          <Ionicons name="car-sport" size={16} color={isAtLimit ? colors.red : colors.gold} />
          <Text style={[styles.inventoryText, isAtLimit && { color: colors.red }]}>
            Inventory: {vehicles.length}/{maxInventory}
          </Text>
          {isAtLimit && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>FULL</Text>
            </View>
          )}
        </View>

        <View style={{ height: 8 }} />

        {/* History */}
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
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
              <Text style={styles.emptyText}>No VIN scans yet</Text>
              <Text style={styles.emptySubtext}>Scan or enter a VIN to get started</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <HistoryItem
                  item={item}
                  onPress={decodeAndSave}
                  onSaveToInventory={saveToInventory}
                  isAtLimit={isAtLimit}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
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
  body: {
    ...type.bodyDim,
    color: colors.textMute,
    marginTop: 6,
  },
  lastScanCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  lastScanLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.textMute,
    marginBottom: 6,
  },
  lastScanVin: {
    ...type.h2,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 4,
  },
  lastScanDetail: {
    ...type.body,
    color: colors.textDim,
    marginTop: 2,
  },
  scanButton: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  scanButtonActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.15)',
  },
  scanButtonText: {
    ...type.label,
    fontSize: 12,
    color: colors.gold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vinInput: {
    ...type.body,
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.3)',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.3,
  },
  charCount: {
    ...type.bodyDim,
    fontSize: 11,
    color: colors.textMute,
    marginTop: 6,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255,45,45,0.1)',
    borderRadius: 6,
  },
  validationText: {
    ...type.bodyDim,
    fontSize: 11,
    color: colors.red,
    flex: 1,
  },
  inventoryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  inventoryText: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
  fullBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.red,
    borderRadius: 4,
  },
  fullBadgeText: {
    ...type.label,
    fontSize: 9,
    color: '#000',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
  },
  historyHeader: {
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
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: {
    flex: 1,
    paddingRight: 12,
  },
  vinText: {
    ...type.h2,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  vinLabel: {
    ...type.body,
    color: colors.textDim,
    marginBottom: 4,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...type.bodyDim,
    fontSize: 11,
    color: colors.textMute,
  },
  historyRight: {
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
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanMaskBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanFrame: {
    position: 'absolute',
    top: '35%',
    left: 20,
    right: 20,
    height: '30%',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 8,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
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
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
  },
  crosshairH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.8,
  },
  crosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: colors.gold,
    opacity: 0.8,
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
  pressed: {
    opacity: 0.7,
  },
});
