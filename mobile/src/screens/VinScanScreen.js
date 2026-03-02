import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
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

// ── Storage keys: separate bins for each VIN category ──────────────────
const STORAGE_KEY_INVENTORY = 'sc_v2_vins_dealer_inventory';
const STORAGE_KEY_TRADEIN   = 'sc_v2_vins_trade_in';
const LEGACY_STORAGE_KEY    = 'sc_v1_vins'; // for migration

const MAX_DEALER_HISTORY = 150;
const MAX_TRADEIN        = 50;
const SCAN_COOLDOWN_MS   = 1500; // debounce between scans

// ── Categories ──────────────────────────────────────────────────────────
const CATEGORY = {
  DEALER: 'active_inventory',
  TRADEIN: 'trade_in',
};

function cleanVin(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

// ── Badge colours per category ──────────────────────────────────────────
const categoryMeta = {
  [CATEGORY.DEALER]: {
    label: 'DEALER INVENTORY',
    short: 'INVENTORY',
    bg: 'rgba(214,178,94,0.18)',
    color: colors.gold,
    icon: 'car-sport',
  },
  [CATEGORY.TRADEIN]: {
    label: 'TRADE-IN',
    short: 'TRADE-IN',
    bg: 'rgba(64,210,255,0.18)',
    color: '#40D2FF',
    icon: 'swap-horizontal',
  },
};

// ── History Item ─────────────────────────────────────────────────────────
function HistoryItem({ item, onPress, onSaveToInventory, isAtLimit, category }) {
  const decoded = item.decoded?.vehicle || item.decoded;
  const label = decoded
    ? `${decoded.year || ''} ${decoded.make || ''} ${decoded.model || ''}`.trim()
    : null;
  const isInInventory = Boolean(item.savedToInventoryAt);
  const meta = categoryMeta[category] || categoryMeta[CATEGORY.DEALER];

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

        <View style={styles.historyContent}>
          <View style={styles.historyLeft}>
            {/* Category badge */}
            <View style={[styles.categoryBadge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={10} color={meta.color} />
              <Text style={[styles.categoryBadgeText, { color: meta.color }]}>{meta.short}</Text>
            </View>

            <Text style={styles.vinText}>{item.vin}</Text>
            {label && <Text style={styles.vinLabel}>{label}</Text>}

            {/* Checksum warning */}
            {item.checksumValid === false && (
              <View style={styles.checksumWarn}>
                <Ionicons name="warning" size={10} color="#FFB347" />
                <Text style={styles.checksumWarnText}>Check-digit advisory</Text>
              </View>
            )}

            <View style={styles.historyMeta}>
              <Ionicons
                name={item.source === 'barcode' ? 'scan' : 'keypad'}
                size={12}
                color={colors.textMute}
              />
              <Text style={styles.metaText}>
                {new Date(item.savedAt).toLocaleDateString()}
              </Text>
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
                <Ionicons name="save" size={16} color={meta.color} />
              </Pressable>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.gold} style={{ marginLeft: 8 }} />
          </View>
        </View>

        <View style={styles.stitchingTop} />
        <View style={styles.stitchingBottom} />
      </LinearGradient>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Main VIN Scan Screen ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export function VinScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { addVehicle, isAtLimit, maxInventory, vehicles } = useInventory();

  // ── State ──
  const [scanning, setScanning] = useState(false);
  const [manualVin, setManualVin] = useState('');
  const [dealerHistory, setDealerHistory] = useState([]);
  const [tradeInHistory, setTradeInHistory] = useState([]);
  const [decoding, setDecoding] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [vinValidation, setVinValidation] = useState(null);
  const [activeTab, setActiveTab] = useState(CATEGORY.DEALER);
  const [saveCategoryPicker, setSaveCategoryPicker] = useState(null); // item pending category choice

  // ── Camera state ──
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  // ── Debounce ref ──
  const lastScanTime = useRef(0);
  const lastScannedVin = useRef('');

  // ── Animated scan line ──
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scannerOpen && scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scannerOpen, scanning, scanLineAnim]);

  const canScan = useMemo(() => permission?.granted === true, [permission]);

  const activeHistory = activeTab === CATEGORY.DEALER ? dealerHistory : tradeInHistory;
  const activeMax = activeTab === CATEGORY.DEALER ? MAX_DEALER_HISTORY : MAX_TRADEIN;

  // ── Load / save helpers ──────────────────────────────────────────────

  const loadAllHistory = useCallback(async () => {
    const [dealer, tradeIn] = await Promise.all([
      loadJson(STORAGE_KEY_INVENTORY, []),
      loadJson(STORAGE_KEY_TRADEIN, []),
    ]);
    setDealerHistory(Array.isArray(dealer) ? dealer : []);
    setTradeInHistory(Array.isArray(tradeIn) ? tradeIn : []);

    // One-time migration from legacy key
    if ((!dealer || dealer.length === 0) && (!tradeIn || tradeIn.length === 0)) {
      const legacy = await loadJson(LEGACY_STORAGE_KEY, []);
      if (Array.isArray(legacy) && legacy.length > 0) {
        setDealerHistory(legacy);
        await saveJson(STORAGE_KEY_INVENTORY, legacy);
      }
    }
  }, []);

  const persistHistory = useCallback(async (category, list) => {
    const key = category === CATEGORY.TRADEIN ? STORAGE_KEY_TRADEIN : STORAGE_KEY_INVENTORY;
    await saveJson(key, list);
  }, []);

  // ── Core VIN save (local) ────────────────────────────────────────────

  const saveVinLocal = useCallback(async (vin, source, category) => {
    const v = cleanVin(vin);
    if (v.length !== 17) return null;

    // Format validation (hard gate) — checksum is advisory only
    const validation = validateVin(v);
    if (!validation.valid) {
      setVinValidation(validation);
      notificationError();
      Alert.alert('Invalid VIN', validation.error || 'VIN format validation failed');
      return null;
    }

    const isTrade = category === CATEGORY.TRADEIN;
    const currentList = isTrade ? tradeInHistory : dealerHistory;
    const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;

    // Enforce cap for trade-in
    if (isTrade && currentList.length >= MAX_TRADEIN) {
      Alert.alert(
        'Trade-In Limit Reached',
        `Maximum ${MAX_TRADEIN} trade-in VINs. Remove existing entries before adding new ones.`
      );
      return null;
    }

    const without = currentList.filter((h) => h.vin !== v);
    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      vin: v,
      source,
      category,
      savedAt: new Date().toISOString(),
      checksumValid: validation.checksumValid,
    };
    const next = [entry, ...without].slice(0, maxItems);

    if (isTrade) {
      setTradeInHistory(next);
    } else {
      setDealerHistory(next);
    }
    await persistHistory(category, next);
    impactMedium();

    // Show advisory if checksum fails
    if (validation.checksumWarning) {
      // Don't block, just let user know
      setTimeout(() => {
        Alert.alert('Checksum Advisory', validation.checksumWarning);
      }, 300);
    }

    return entry;
  }, [dealerHistory, tradeInHistory, persistHistory]);

  // ── Decode ───────────────────────────────────────────────────────────

  const decodeAndSave = useCallback(async (item) => {
    try {
      setDecoding(item.id);
      const decoded = await decodeVinWithBackend(item.vin);

      const entry = {
        ...item,
        decoded,
        decodedAt: new Date().toISOString(),
      };

      const isTrade = item.category === CATEGORY.TRADEIN;
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);

      if (isTrade) {
        setTradeInHistory(next);
      } else {
        setDealerHistory(next);
      }
      await persistHistory(item.category, next);
      setLastScan({ vin: item.vin, decoded });
      notificationSuccess();
    } catch (e) {
      const entry = {
        ...item,
        decodeError: String(e?.message || e),
        decodedAt: new Date().toISOString(),
      };
      const isTrade = item.category === CATEGORY.TRADEIN;
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);

      if (isTrade) {
        setTradeInHistory(next);
      } else {
        setDealerHistory(next);
      }
      await persistHistory(item.category, next);
      setLastScan({ vin: item.vin, error: String(e?.message || e) });
      notificationError();
    } finally {
      setDecoding(null);
    }
  }, [dealerHistory, tradeInHistory, persistHistory]);

  // ── Save to backend inventory ────────────────────────────────────────

  const saveToInventory = useCallback(async (item) => {
    if (!item.decoded) {
      Alert.alert('Decode First', 'Please decode this VIN before adding to inventory');
      return;
    }

    const isTrade = item.category === CATEGORY.TRADEIN;

    if (!isTrade && isAtLimit) {
      Alert.alert('Inventory Full', `Maximum ${maxInventory} vehicles reached.`);
      return;
    }

    try {
      impactMedium();
      await addVehicle({
        vin: item.vin,
        ...item.decoded.vehicle,
        category: item.category,
      });

      const entry = { ...item, savedToInventoryAt: new Date().toISOString() };
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);

      if (isTrade) {
        setTradeInHistory(next);
      } else {
        setDealerHistory(next);
      }
      await persistHistory(item.category, next);
      notificationSuccess();

      const catLabel = isTrade ? 'Trade-In' : 'Dealer Inventory';
      Alert.alert('Success', `Vehicle added to ${catLabel}`);
    } catch (e) {
      notificationError();
      Alert.alert('Save Failed', String(e?.message || e));
    }
  }, [dealerHistory, tradeInHistory, addVehicle, isAtLimit, maxInventory, persistHistory]);

  // ── Lifecycle ────────────────────────────────────────────────────────

  useEffect(() => { loadAllHistory(); }, [loadAllHistory]);

  // ── Barcode handler with debounce ────────────────────────────────────

  const onBarcodeScanned = useCallback(
    async ({ data }) => {
      if (!scanning) return;

      const now = Date.now();
      const v = cleanVin(data);
      if (!v || v.length !== 17) return;

      // Debounce: ignore rapid re-scans of same VIN or within cooldown
      if (
        now - lastScanTime.current < SCAN_COOLDOWN_MS ||
        v === lastScannedVin.current
      ) {
        return;
      }

      // Format validation only (checksum is advisory)
      const validation = validateVin(v);
      if (!validation.valid) {
        impactLight();
        return;
      }

      lastScanTime.current = now;
      lastScannedVin.current = v;

      // Pause scanning, show category picker
      setScanning(false);
      setScannerOpen(false);
      impactMedium();

      // Ask which category to save under
      setSaveCategoryPicker({ vin: v, source: 'barcode' });
    },
    [scanning]
  );

  // ── Category picker handler ──────────────────────────────────────────

  const handleCategorySave = useCallback(async (category) => {
    if (!saveCategoryPicker) return;
    setSaveCategoryPicker(null);

    const entry = await saveVinLocal(saveCategoryPicker.vin, saveCategoryPicker.source, category);
    if (entry) {
      setActiveTab(category);
      await decodeAndSave(entry);
    }
  }, [saveCategoryPicker, saveVinLocal, decodeAndSave]);

  // ── Manual entry ─────────────────────────────────────────────────────

  const handleManualEntry = async () => {
    if (manualVin.length !== 17) return;
    // Show category picker for manual entry too
    setSaveCategoryPicker({ vin: manualVin, source: 'manual' });
    setManualVin('');
    setVinValidation(null);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>

        {/* ── Camera Scanner Card ── */}
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
                {lastScan.decoded?.year && !lastScan.decoded?.vehicle && (
                  <Text style={styles.lastScanDetail}>
                    {[lastScan.decoded.year, lastScan.decoded.make, lastScan.decoded.model]
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
                setCameraReady(false);
                setTorchOn(false);
                setZoom(0);
                setScanning(true);
                setScannerOpen(true);
                lastScannedVin.current = '';
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

        {/* ── Camera Modal ── */}
        <Modal visible={scannerOpen && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => { setScannerOpen(false); setScanning(false); setTorchOn(false); }}
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
                    onCameraReady={() => setCameraReady(true)}
                    enableTorch={torchOn && cameraReady}
                    zoom={zoom}
                    autofocus="off"
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{
                      barcodeTypes: [
                        'code39',   // Most common VIN barcode format (OEM windshield stickers)
                        'code128',  // Second most common (dealer/aftermarket labels)
                        'datamatrix', // Newer vehicles, stamped metal plates
                        'qr',        // Some dealers add QR to window stickers
                      ],
                    }}
                  />
                  {/* Mask overlay - top */}
                  <View style={styles.scanMaskTop} />

                  {/* Windshield guide frame — wide aspect for VIN plate */}
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
                          transform: [
                            {
                              translateY: scanLineAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 80],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>

                  {/* Mask overlay - bottom */}
                  <View style={styles.scanMaskBottom} />
                </View>

                {/* Camera controls overlay */}
                <View style={styles.cameraControls}>
                  {/* Torch toggle */}
                  <Pressable
                    onPress={() => setTorchOn((t) => !t)}
                    style={[styles.cameraControlBtn, torchOn && styles.cameraControlBtnActive]}
                  >
                    <Ionicons
                      name={torchOn ? 'flashlight' : 'flashlight-outline'}
                      size={22}
                      color={torchOn ? '#000' : colors.text}
                    />
                    <Text style={[styles.cameraControlLabel, torchOn && { color: '#000' }]}>
                      {torchOn ? 'LIGHT ON' : 'LIGHT'}
                    </Text>
                  </Pressable>

                  {/* Zoom controls */}
                  <View style={styles.zoomControls}>
                    <Pressable
                      onPress={() => setZoom((z) => Math.max(0, z - 0.1))}
                      style={styles.zoomBtn}
                    >
                      <Ionicons name="remove" size={20} color={colors.text} />
                    </Pressable>
                    <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
                    <Pressable
                      onPress={() => setZoom((z) => Math.min(1, z + 0.1))}
                      style={styles.zoomBtn}
                    >
                      <Ionicons name="add" size={20} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.scanHintCard}>
                  <Ionicons name="information-circle" size={20} color={colors.gold} />
                  <Text style={styles.scanHint}>
                    Point at the VIN plate on the lower-left windshield. Use the flashlight for low-light. Zoom in if the plate is small. All 17 characters are captured automatically.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* ── Category Picker Modal ── */}
        <Modal visible={Boolean(saveCategoryPicker)} transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>SAVE VIN AS</Text>
              <Text style={styles.pickerVin}>{saveCategoryPicker?.vin}</Text>

              <Pressable
                onPress={() => handleCategorySave(CATEGORY.DEALER)}
                style={({ pressed }) => [styles.pickerOption, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={['rgba(214,178,94,0.18)', 'rgba(214,178,94,0.08)']}
                  style={styles.pickerOptionGradient}
                >
                  <Ionicons name="car-sport" size={24} color={colors.gold} />
                  <View style={styles.pickerOptionText}>
                    <Text style={[styles.pickerOptionTitle, { color: colors.gold }]}>Dealer Inventory</Text>
                    <Text style={styles.pickerOptionDesc}>
                      Vehicles on your lot ({dealerHistory.length}/{MAX_DEALER_HISTORY})
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => handleCategorySave(CATEGORY.TRADEIN)}
                disabled={tradeInHistory.length >= MAX_TRADEIN}
                style={({ pressed }) => [
                  styles.pickerOption,
                  tradeInHistory.length >= MAX_TRADEIN && styles.pickerOptionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={['rgba(64,210,255,0.18)', 'rgba(64,210,255,0.08)']}
                  style={styles.pickerOptionGradient}
                >
                  <Ionicons name="swap-horizontal" size={24} color="#40D2FF" />
                  <View style={styles.pickerOptionText}>
                    <Text style={[styles.pickerOptionTitle, { color: '#40D2FF' }]}>Trade-In</Text>
                    <Text style={styles.pickerOptionDesc}>
                      Customer trade-in vehicles ({tradeInHistory.length}/{MAX_TRADEIN})
                      {tradeInHistory.length >= MAX_TRADEIN ? ' — LIMIT REACHED' : ''}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => setSaveCategoryPicker(null)}
                style={styles.pickerCancel}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={{ height: 12 }} />

        {/* ── Manual Entry Card ── */}
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

        {/* ── Category Tabs ── */}
        <View style={styles.categoryTabs}>
          <Pressable
            onPress={() => setActiveTab(CATEGORY.DEALER)}
            style={[
              styles.categoryTab,
              activeTab === CATEGORY.DEALER && styles.categoryTabActive,
            ]}
          >
            <Ionicons name="car-sport" size={14} color={activeTab === CATEGORY.DEALER ? colors.gold : colors.textMute} />
            <Text style={[styles.categoryTabText, activeTab === CATEGORY.DEALER && styles.categoryTabTextActive]}>
              INVENTORY
            </Text>
            <View style={[styles.tabCount, activeTab === CATEGORY.DEALER && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === CATEGORY.DEALER && styles.tabCountTextActive]}>
                {dealerHistory.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab(CATEGORY.TRADEIN)}
            style={[
              styles.categoryTab,
              activeTab === CATEGORY.TRADEIN && styles.categoryTabActiveTrade,
            ]}
          >
            <Ionicons name="swap-horizontal" size={14} color={activeTab === CATEGORY.TRADEIN ? '#40D2FF' : colors.textMute} />
            <Text style={[styles.categoryTabText, activeTab === CATEGORY.TRADEIN && { color: '#40D2FF' }]}>
              TRADE-IN
            </Text>
            <View style={[styles.tabCount, activeTab === CATEGORY.TRADEIN && { backgroundColor: 'rgba(64,210,255,0.3)' }]}>
              <Text style={[styles.tabCountText, activeTab === CATEGORY.TRADEIN && { color: '#40D2FF' }]}>
                {tradeInHistory.length}/{MAX_TRADEIN}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 8 }} />

        {/* ── History List ── */}
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color={colors.textMute} />
              <Text style={styles.sectionTitle}>
                {activeTab === CATEGORY.DEALER ? 'DEALER INVENTORY SCANS' : 'TRADE-IN SCANS'}
              </Text>
            </View>
          </View>

          {activeHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === CATEGORY.DEALER ? 'car-sport' : 'swap-horizontal'}
                size={48}
                color={colors.textMute}
              />
              <Text style={styles.emptyText}>
                No {activeTab === CATEGORY.DEALER ? 'inventory' : 'trade-in'} VINs yet
              </Text>
              <Text style={styles.emptySubtext}>Scan or enter a VIN to get started</Text>
            </View>
          ) : (
            <FlatList
              data={activeHistory}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <HistoryItem
                  item={item}
                  onPress={decodeAndSave}
                  onSaveToInventory={saveToInventory}
                  isAtLimit={activeTab === CATEGORY.DEALER ? isAtLimit : false}
                  category={activeTab}
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

// ═══════════════════════════════════════════════════════════════════════
// ── Styles ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

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

  // ── Last scan ──
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

  // ── Scan button ──
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

  // ── Manual entry ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vinInput: {
    ...type.body,
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.40)',
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

  // ── Category tabs ──
  categoryTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  categoryTabActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  categoryTabActiveTrade: {
    borderColor: '#40D2FF',
    backgroundColor: 'rgba(64,210,255,0.10)',
  },
  categoryTabText: {
    ...type.label,
    fontSize: 10,
    color: colors.textMute,
  },
  categoryTabTextActive: {
    color: colors.gold,
  },
  tabCount: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tabCountActive: {
    backgroundColor: 'rgba(214,178,94,0.3)',
  },
  tabCountText: {
    ...type.label,
    fontSize: 9,
    color: colors.textMute,
  },
  tabCountTextActive: {
    color: colors.gold,
  },

  // ── History ──
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
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  categoryBadgeText: {
    ...type.label,
    fontSize: 8,
    letterSpacing: 0.8,
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
  checksumWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  checksumWarnText: {
    ...type.bodyDim,
    fontSize: 9,
    color: '#FFB347',
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

  // ── Camera modal ──
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
    left: 12,
    right: 12,
    height: '40%',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.9,
    borderRadius: 1,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
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

  // ── Camera controls ──
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  cameraControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cameraControlBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  cameraControlLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.text,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  zoomLabel: {
    ...type.label,
    fontSize: 11,
    color: colors.text,
    minWidth: 36,
    textAlign: 'center',
  },

  // ── Scan hint ──
  scanHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
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

  // ── Category picker modal ──
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  pickerTitle: {
    ...type.label,
    fontSize: 13,
    color: colors.gold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerVin: {
    ...type.h2,
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerOption: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  pickerOptionDisabled: {
    opacity: 0.4,
  },
  pickerOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerOptionText: {
    flex: 1,
  },
  pickerOptionTitle: {
    ...type.label,
    fontSize: 13,
    marginBottom: 4,
  },
  pickerOptionDesc: {
    ...type.bodyDim,
    fontSize: 11,
    color: colors.textMute,
  },
  pickerCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  pickerCancelText: {
    ...type.label,
    fontSize: 12,
    color: colors.textMute,
  },

  pressed: {
    opacity: 0.7,
  },
});
