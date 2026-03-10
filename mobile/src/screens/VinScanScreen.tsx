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
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadJson, saveJson } from '../lib/storage';
import { decodeVinWithBackend } from '../lib/nhtsa';
import { useInventory } from '../context/InventoryContext';
import { validateVin } from '../utils/vinChecksum';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, notificationSuccess, notificationError, impactLight, impactHeavy } from '../lib/haptics';
import { buildApiUrlAsync } from '../config/backend';
import { useCameraLifecycle } from '../hooks/useCameraLifecycle';

// ── Safe ML Kit import — gracefully unavailable in Expo Go ─────────────
let TextRecognition: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch {
  // ML Kit not available in this environment (Expo Go, simulator, etc.)
  console.warn('[VinScan] @react-native-ml-kit/text-recognition not available — cloud fallback will be used.');
}

// ── Storage keys: separate bins for each VIN category ──────────────────
const STORAGE_KEY_INVENTORY = 'sc_v2_vins_dealer_inventory';
const STORAGE_KEY_TRADEIN   = 'sc_v2_vins_trade_in';
const LEGACY_STORAGE_KEY    = 'sc_v1_vins';

const MAX_DEALER_HISTORY = 150;
const MAX_TRADEIN        = 50;
const SCAN_COOLDOWN_MS   = 1500;

// ── Scan modes ──────────────────────────────────────────────────────────
const SCAN_MODE = {
  BARCODE: 'barcode',  // Real-time barcode detection (labels/stickers)
  CAPTURE: 'capture',  // Tap-to-capture photo → AI Vision OCR (windshield text)
};

// ── Categories ──────────────────────────────────────────────────────────
const CATEGORY = {
  DEALER: 'active_inventory',
  TRADEIN: 'trade_in',
};

function cleanVin(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

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
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.historyGradient}
      >
        <View style={styles.quiltedPattern} />
        <View style={styles.historyContent}>
          <View style={styles.historyLeft}>
            <View style={[styles.categoryBadge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon as any} size={10} color={meta.color} />
              <Text style={[styles.categoryBadgeText, { color: meta.color }]}>{meta.short}</Text>
            </View>
            <Text style={styles.vinText}>{item.vin}</Text>
            {label && <Text style={styles.vinLabel}>{label}</Text>}
            {item.checksumValid === false && (
              <View style={styles.checksumWarn}>
                <Ionicons name="warning" size={10} color="#FFB347" />
                <Text style={styles.checksumWarnText}>Check-digit advisory</Text>
              </View>
            )}
            <View style={styles.historyMeta}>
              <Ionicons
                name={
                  item.source === 'barcode' ? 'scan' :
                  item.source === 'ai_vision' ? 'sparkles' : 'keypad'
                }
                size={12}
                color={colors.textMute}
              />
              <Text style={styles.metaText}>
                {item.source === 'ai_vision' ? 'AI Vision' :
                 item.source === 'barcode' ? 'Barcode' : 'Manual'}
                {' · '}
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
// ── Vehicle Detail Modal — shows full NHTSA decoded data ──────────────
// ═══════════════════════════════════════════════════════════════════════

function VehicleDetailModal({ item, onClose, onSaveToInventory, insets }) {
  const d = item.decoded?.vehicle || item.decoded || {};
  const validation = item.decoded?.validation || {};
  const isSaved = Boolean(item.savedToInventoryAt);

  const year = d.year || item.decoded?.year || '';
  const make = d.make || item.decoded?.make || '';
  const model = d.model || item.decoded?.model || '';
  const trim = d.trim || item.decoded?.trim || '';
  const bodyClass = d.body_class || item.decoded?.body_class || '';
  const driveType = d.drive_type || item.decoded?.drive_type || '';
  const fuelType = d.fuel_type || item.decoded?.fuel_type || '';
  const electrification = d.electrification || item.decoded?.electrification || '';
  const engineDisplay = d.engine_display || item.decoded?.engine_display || '';
  const horsepower = d.horsepower || item.decoded?.horsepower || '';
  const transmission = d.transmission || item.decoded?.transmission || '';
  const cylinders = d.cylinders || item.decoded?.cylinders || '';
  const displacement = d.displacement || item.decoded?.displacement || '';
  const manufacturer = d.manufacturer || item.decoded?.manufacturer || '';
  const assemblyLocation = d.assembly_location || item.decoded?.assembly_location || '';
  const vehicleType = d.vehicle_type || item.decoded?.vehicle_type || '';
  const gvwr = d.gvwr || item.decoded?.gvwr || '';
  const safetyFeatures = d.safety_features || item.decoded?.safety_features || [];
  const abs = d.abs || item.decoded?.abs || '';
  const seatBelts = d.seat_belts || item.decoded?.seat_belts || '';

  const categoryMeta_item = categoryMeta[item.category] || categoryMeta[CATEGORY.DEALER];

  return (
    <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>
      {/* ── Header ── */}
      <LinearGradient
        colors={['rgba(20,14,8,0.95)', 'rgba(12,8,4,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[vdStyles.header, { paddingTop: insets.top + 14 }]}
      >
        <Pressable onPress={onClose} style={vdStyles.closeBtn}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <View style={vdStyles.headerCenter}>
          <View style={[vdStyles.catBadge, { backgroundColor: categoryMeta_item.bg }]}>
            <Ionicons name={categoryMeta_item.icon as any} size={11} color={categoryMeta_item.color} />
            <Text style={[vdStyles.catBadgeText, { color: categoryMeta_item.color }]}>{categoryMeta_item.short}</Text>
          </View>
          <Text style={vdStyles.vehicleYear}>{year}</Text>
          <Text style={vdStyles.vehicleMakeModel}>{[make, model].filter(Boolean).join(' ')}</Text>
          {trim ? <Text style={vdStyles.vehicleTrim}>{trim}</Text> : null}
          <Text style={vdStyles.vinText}>{item.vin}</Text>
        </View>

        {/* Confidence badge */}
        {validation.confidence_score != null && (
          <View style={vdStyles.confBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.green} />
            <Text style={vdStyles.confText}>{validation.confidence_score}%</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Powertrain ── */}
        <VDSection title="POWERTRAIN" icon="speedometer">
          <VDRow label="Engine" value={engineDisplay || (cylinders ? `${cylinders}-Cylinder ${displacement ? `${displacement}L` : ''}` : null)} />
          <VDRow label="Horsepower" value={horsepower ? `${horsepower} HP` : null} />
          <VDRow label="Transmission" value={transmission} />
          <VDRow label="Drive Type" value={driveType} />
          <VDRow label="Fuel Type" value={fuelType} />
          {electrification ? <VDRow label="Electrification" value={electrification} highlight /> : null}
        </VDSection>

        {/* ── Body & Class ── */}
        <VDSection title="BODY & VEHICLE" icon="car-sport">
          <VDRow label="Body Style" value={bodyClass} />
          <VDRow label="Vehicle Type" value={vehicleType} />
          <VDRow label="GVWR" value={gvwr} />
        </VDSection>

        {/* ── Safety ── */}
        {(safetyFeatures.length > 0 || abs || seatBelts) && (
          <VDSection title="SAFETY SYSTEMS" icon="shield-checkmark">
            {safetyFeatures.length > 0 && (
              <View style={vdStyles.tagCloud}>
                {safetyFeatures.map((f) => (
                  <View key={f} style={vdStyles.safetyTag}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.green} />
                    <Text style={vdStyles.safetyTagText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
            <VDRow label="ABS" value={abs} />
            <VDRow label="Seat Belts" value={seatBelts} />
          </VDSection>
        )}

        {/* ── Manufacturing ── */}
        <VDSection title="MANUFACTURING" icon="business">
          <VDRow label="Manufacturer" value={manufacturer} />
          <VDRow label="Assembly" value={assemblyLocation} />
          {validation.checksum_valid != null && (
            <VDRow
              label="VIN Checksum"
              value={validation.checksum_valid ? 'Valid ✓' : 'Invalid ✗'}
              highlight={!validation.checksum_valid}
            />
          )}
        </VDSection>

        {/* ── Validation ── */}
        {validation.sources_checked?.length > 0 && (
          <VDSection title="DATA SOURCES" icon="library">
            {validation.sources_checked.map((s) => (
              <View key={s} style={vdStyles.sourceRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                <Text style={vdStyles.sourceText}>{s}</Text>
              </View>
            ))}
          </VDSection>
        )}

        {/* ── Save to Inventory Button ── */}
        {!isSaved ? (
          <Pressable
            onPress={onSaveToInventory}
            style={({ pressed }) => [vdStyles.saveBtn, pressed && { opacity: 0.82 }]}
          >
            <LinearGradient
              colors={['rgba(214,178,94,0.18)', 'rgba(214,178,94,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={vdStyles.saveBtnGrad}
            >
              <Ionicons name="save" size={22} color={colors.gold} />
              <Text style={vdStyles.saveBtnText}>
                {item.category === CATEGORY.TRADEIN ? 'SAVE TO TRADE-IN' : 'SAVE TO INVENTORY'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={vdStyles.savedBadge}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={vdStyles.savedBadgeText}>SAVED TO INVENTORY</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ── Vehicle Detail sub-components ──
function VDSection({ title, icon, children }) {
  return (
    <View style={vdStyles.section}>
      <View style={vdStyles.sectionHdr}>
        <Ionicons name={icon} size={14} color={colors.gold} />
        <Text style={vdStyles.sectionHdrText}>{title}</Text>
      </View>
      <View style={vdStyles.sectionBody}>{children}</View>
    </View>
  );
}

function VDRow({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  if (!value) return null;
  return (
    <View style={vdStyles.row}>
      <Text style={vdStyles.rowLabel}>{label}</Text>
      <Text style={[vdStyles.rowValue, highlight && { color: '#FF9B40' }]}>{value}</Text>
    </View>
  );
}

const vdStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,178,94,0.20)',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    left: 16,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerCenter: { alignItems: 'center', gap: 4, paddingTop: 4 },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 4,
  },
  catBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  vehicleYear: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.gold,
    letterSpacing: -1,
    lineHeight: 46,
  },
  vehicleMakeModel: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
    textAlign: 'center',
  },
  vehicleTrim: {
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  vinText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: colors.textMute,
    letterSpacing: 2,
    marginTop: 6,
  },
  confBadge: {
    position: 'absolute',
    top: 18,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(64,255,155,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(64,255,155,0.3)',
  },
  confText: { fontSize: 11, fontWeight: '800', color: colors.green },

  section: { marginBottom: 12 },
  sectionHdr: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
    paddingBottom: 6,
  },
  sectionHdrText: { fontSize: 11, fontWeight: '800', color: colors.gold, letterSpacing: 1.5 },
  sectionBody: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke,
  },
  rowLabel: { fontSize: 12, color: colors.textMute, flex: 1, fontWeight: '600' },
  rowValue: { fontSize: 13, color: colors.text, flex: 2, textAlign: 'right', fontWeight: '500' },

  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  safetyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(64,255,155,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(64,255,155,0.25)',
  },
  safetyTagText: { fontSize: 11, color: colors.text, fontWeight: '600' },

  sourceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke,
  },
  sourceText: { fontSize: 13, color: colors.textDim },

  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: colors.gold, letterSpacing: 1.5 },
  savedBadge: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
    backgroundColor: 'rgba(64,255,155,0.12)',
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.green,
  },
  savedBadgeText: { fontSize: 15, fontWeight: '900', color: colors.green, letterSpacing: 1.5 },
});

// ═══════════════════════════════════════════════════════════════════════
// ── Main VIN Scan Screen ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export function VinScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { addVehicle, isAtLimit, maxInventory } = useInventory();
  const insets = useSafeAreaInsets();

  const [dealerHistory, setDealerHistory] = useState([]);
  const [tradeInHistory, setTradeInHistory] = useState([]);
  const [decoding, setDecoding] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState(SCAN_MODE.BARCODE);
  const [scanning, setScanning] = useState(false);
  const [manualVin, setManualVin] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [vinValidation, setVinValidation] = useState(null);
  const [activeTab, setActiveTab] = useState(CATEGORY.DEALER);
  const [saveCategoryPicker, setSaveCategoryPicker] = useState(null);

  // Vehicle detail modal
  const [vehicleDetailItem, setVehicleDetailItem] = useState(null); // item with .decoded

  // Camera state
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  // "VIN Found" flash banner
  const [vinFoundBanner, setVinFoundBanner] = useState(''); // The VIN string shown when barcode hits

  // AI OCR state
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrResults, setOcrResults] = useState(null); // {vins, confidence, notes}

  const cameraRef = useRef(null);
  const lastScanTime = useRef(0);
  const lastScannedVin = useRef('');
  // Ref pattern (PTT-style) — prevent stale closures in async callbacks
  const dealerHistoryRef = useRef(dealerHistory);
  dealerHistoryRef.current = dealerHistory;
  const tradeInHistoryRef = useRef(tradeInHistory);
  tradeInHistoryRef.current = tradeInHistory;

  // World-class camera lifecycle: AppState-aware, AbortController factory, permissions
  const {
    isActive: cameraIsActive,
    abortableTimeout,
    showSettingsAlert,
  } = useCameraLifecycle(scannerOpen);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const captureFlash = useRef(new Animated.Value(0)).current;
  const ocrPulse = useRef(new Animated.Value(0)).current;
  const vinFoundAnim = useRef(new Animated.Value(0)).current;

  // Zoom slider pan responder
  // Slider track width = SCREEN_W - 32 (horizontal padding)
  const SLIDER_TRACK_W = SCREEN_W - 80;
  const zoomPanRef = useRef(null);
  const zoomOffset = useRef(0); // tracks position during drag

  const zoomSliderAnim = useRef(new Animated.Value(0)).current; // 0..1 maps to 0..SLIDER_TRACK_W

  // Keep zoomSliderAnim in sync with zoom state (for external updates)
  useEffect(() => {
    zoomSliderAnim.setValue(zoom * SLIDER_TRACK_W);
  }, [zoom, SLIDER_TRACK_W, zoomSliderAnim]);

  const zoomPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, gs) => {
          zoomOffset.current = zoom * SLIDER_TRACK_W;
        },
        onPanResponderMove: (_, gs) => {
          const raw = zoomOffset.current + gs.dx;
          const clamped = Math.max(0, Math.min(SLIDER_TRACK_W, raw));
          const newZoom = parseFloat((clamped / SLIDER_TRACK_W).toFixed(2));
          setZoom(newZoom);
        },
      }),
    [zoom, SLIDER_TRACK_W]
  );

  // Animate scan line for barcode mode
  useEffect(() => {
    if (scannerOpen && scanMode === SCAN_MODE.BARCODE && scanning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scannerOpen, scanMode, scanning, scanLineAnim]);

  // Pulse animation for OCR processing — properly stoppable (PTT pattern)
  const ocrLoopRef = useRef(null);
  useEffect(() => {
    if (ocrProcessing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ocrPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ocrPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      ocrLoopRef.current = loop;
      loop.start();
      return () => {
        loop.stop();
        ocrLoopRef.current = null;
      };
    } else {
      if (ocrLoopRef.current) {
        ocrLoopRef.current.stop();
        ocrLoopRef.current = null;
      }
      ocrPulse.setValue(0);
    }
  }, [ocrProcessing, ocrPulse]);

  const canScan = useMemo(() => permission?.granted === true, [permission]);
  const activeHistory = activeTab === CATEGORY.DEALER ? dealerHistory : tradeInHistory;

  // ── Load / save helpers ──────────────────────────────────────────────

  const loadAllHistory = useCallback(async () => {
    const [dealer, tradeIn] = await Promise.all([
      loadJson(STORAGE_KEY_INVENTORY, []),
      loadJson(STORAGE_KEY_TRADEIN, []),
    ]);
    setDealerHistory(Array.isArray(dealer) ? dealer : []);
    setTradeInHistory(Array.isArray(tradeIn) ? tradeIn : []);

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

    const validation = validateVin(v);
    if (!validation.valid) {
      setVinValidation(validation);
      notificationError();
      Alert.alert('Invalid VIN', (validation as any).error || 'VIN format validation failed');
      return null;
    }

    // Use refs for latest data — prevents stale closure (PTT pattern)
    const isTrade = category === CATEGORY.TRADEIN;
    const currentList = isTrade ? tradeInHistoryRef.current : dealerHistoryRef.current;
    const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;

    if (isTrade && currentList.length >= MAX_TRADEIN) {
      Alert.alert('Trade-In Limit Reached', `Maximum ${MAX_TRADEIN} trade-in VINs.`);
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

    if (validation.checksumWarning) {
      setTimeout(() => Alert.alert('Checksum Advisory', validation.checksumWarning), 300);
    }
    return entry;
  }, [persistHistory]);

  // ── Decode ───────────────────────────────────────────────────────────

  const decodeAndSave = useCallback(async (item) => {
    try {
      setDecoding(item.id);
      const decoded = await decodeVinWithBackend(item.vin);
      const entry = { ...item, decoded, decodedAt: new Date().toISOString() };

      const isTrade = item.category === CATEGORY.TRADEIN;
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);

      if (isTrade) setTradeInHistory(next);
      else setDealerHistory(next);
      await persistHistory(item.category, next);
      setLastScan({ vin: item.vin, decoded });
      notificationSuccess();
    } catch (e) {
      const entry = { ...item, decodeError: String(e?.message || e), decodedAt: new Date().toISOString() };
      const isTrade = item.category === CATEGORY.TRADEIN;
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);
      if (isTrade) setTradeInHistory(next);
      else setDealerHistory(next);
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
      const vehicleData = item.decoded?.vehicle || item.decoded;
      // Preserve source tag so the Intake Hub badge shows SCAN vs MANUAL
      const sourceTag = item.source === 'manual' ? 'manual' : 'scan';
      await addVehicle({ vin: item.vin, ...vehicleData, category: item.category, _source: sourceTag });
      const entry = { ...item, savedToInventoryAt: new Date().toISOString() };
      const currentList = isTrade ? tradeInHistory : dealerHistory;
      const maxItems = isTrade ? MAX_TRADEIN : MAX_DEALER_HISTORY;
      const next = [entry, ...currentList.filter((h) => h.id !== item.id)].slice(0, maxItems);
      if (isTrade) setTradeInHistory(next);
      else setDealerHistory(next);
      await persistHistory(item.category, next);
      notificationSuccess();
      Alert.alert('Success', `Vehicle added to ${isTrade ? 'Trade-In' : 'Dealer Inventory'}`);
    } catch (e) {
      notificationError();
      Alert.alert('Save Failed', String(e?.message || e));
    }
  }, [dealerHistory, tradeInHistory, addVehicle, isAtLimit, maxInventory, persistHistory]);

  useEffect(() => { loadAllHistory(); }, [loadAllHistory]);

  // ── Open scanner helper ──────────────────────────────────────────────

  const openScanner = useCallback(async (mode) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        // Detect permanent denial — user must go to Settings
        if (result.canAskAgain === false) {
          showSettingsAlert();
        }
        return;
      }
    }
    impactMedium();
    setCameraReady(false);
    setTorchOn(false);
    setZoom(0);
    setScanMode(mode);
    setScanning(mode === SCAN_MODE.BARCODE);
    setOcrResults(null);
    setOcrStatus('');
    lastScannedVin.current = '';
    setScannerOpen(true);
  }, [permission, requestPermission, showSettingsAlert]);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
    setScanning(false);
    setTorchOn(false);
    setOcrProcessing(false);
    setOcrResults(null);
    setOcrStatus('');
  }, []);

  // ── Barcode handler ──────────────────────────────────────────────────

  const onBarcodeScanned = useCallback(async ({ data }) => {
    if (!scanning) return;

    const now = Date.now();
    const v = cleanVin(data);
    if (!v || v.length !== 17) return;

    if (
      now - lastScanTime.current < SCAN_COOLDOWN_MS ||
      v === lastScannedVin.current
    ) return;

    const validation = validateVin(v);
    if (!validation.valid) { impactLight(); return; }

    lastScanTime.current = now;
    lastScannedVin.current = v;

    setScanning(false);
    impactHeavy();

    // Show "VIN FOUND" banner for 800ms, then close scanner
    setVinFoundBanner(v);
    vinFoundAnim.setValue(0);
    Animated.sequence([
      Animated.timing(vinFoundAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(vinFoundAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVinFoundBanner('');
      setScannerOpen(false);
      setSaveCategoryPicker({ vin: v, source: 'barcode' });
    });
  }, [scanning, vinFoundAnim]);

  // ── AI Vision OCR capture — ML Kit on-device first, cloud fallback ──

  const handleAiCapture = useCallback(async () => {
    if (!cameraRef.current || ocrProcessing || !cameraReady) return;

    impactMedium();

    // Flash effect
    Animated.sequence([
      Animated.timing(captureFlash, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(captureFlash, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    setOcrProcessing(true);
    setOcrResults(null);

    // AbortController with 30s hard timeout (PTT pattern)
    const { signal, cleanup: abortCleanup } = abortableTimeout(30000);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.65,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        setOcrStatus('Capture failed. Try again.');
        setOcrProcessing(false);
        abortCleanup();
        return;
      }

      // ── PHASE 1: ML Kit on-device text recognition (~100ms) ──
      if (TextRecognition) {
        setOcrStatus('Reading with ML Kit...');
        try {
          const mlResult = await TextRecognition.recognize(photo.uri);
          if (mlResult?.text) {
            // Extract VINs from recognized text — 17 alphanumeric, no I/O/Q
            const vinRegex = /[A-HJ-NPR-Z0-9]{17}/g;
            const rawText = mlResult.text.toUpperCase().replace(/\s/g, '');
            const candidates = rawText.match(vinRegex) || [];

            // Validate each candidate with checksum
            const validVins = candidates.filter((v: string) => {
              const check = validateVin(v);
              return check.valid;
            });

            // Also keep unvalidated candidates as secondary (checksum may fail for some legit VINs)
            const allUnique = [...new Set([...validVins, ...candidates])];

            if (allUnique.length > 0) {
              const result = {
                vins: allUnique,
                confidence: validVins.length > 0 ? 'high' : 'medium',
                notes: `ML Kit on-device (${validVins.length} checksum-verified)`,
              };
              setOcrResults(result);
              setOcrStatus(`Found ${allUnique.length} VIN${allUnique.length > 1 ? 's' : ''} — on-device`);
              notificationSuccess();
              abortCleanup();
              setOcrProcessing(false);
              return;
            }
          }
        } catch (mlErr: any) {
          // ML Kit failed — continue to cloud fallback silently
          console.warn('[ML Kit]', mlErr?.message);
        }
      } else {
        setOcrStatus('AI Vision scanning...');
      }

      // ── PHASE 2: Cloud fallback (GPT-4o Vision via AI Gateway) ──
      if (!photo.base64) {
        setOcrStatus('No VIN detected. Reposition and try again.');
        setOcrProcessing(false);
        abortCleanup();
        notificationError();
        return;
      }

      setOcrStatus('AI Vision scanning...');

      const apiUrl = await buildApiUrlAsync('/api/vin/extract-from-image');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: photo.base64 }),
        signal,
      });

      abortCleanup();

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (result.vins && result.vins.length > 0) {
        setOcrResults(result);
        setOcrStatus(`Found ${result.vins.length} VIN${result.vins.length > 1 ? 's' : ''}!`);
        notificationSuccess();
      } else {
        setOcrResults({ vins: [], confidence: 'low', notes: result.notes || 'No VIN found' });
        setOcrStatus('No VIN detected. Reposition and try again.');
        notificationError();
      }
    } catch (e: any) {
      abortCleanup();
      if (e.name === 'AbortError') {
        setOcrStatus('Request timed out (30s). Try again with better lighting.');
      } else {
        console.warn('[VIN OCR]', e?.message);
        setOcrStatus('Error. Check connection and try again.');
      }
      notificationError();
    } finally {
      setOcrProcessing(false);
    }
  }, [ocrProcessing, cameraReady, captureFlash, abortableTimeout]);

  // When user taps a detected VIN from OCR results
  const handleOcrVinSelect = useCallback((vin) => {
    closeScanner();
    setSaveCategoryPicker({ vin, source: 'ai_vision' });
  }, [closeScanner]);

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

        {/* ── Scan Mode Cards ── */}
        <View style={styles.scanModeRow}>
          {/* BARCODE SCAN */}
          <LinearGradient
            colors={['rgba(10,12,18,0.92)', 'rgba(6,8,14,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.scanModeBezel, { flex: 1, marginRight: 6 }]}
          >
            <Pressable
              onPress={() => openScanner(SCAN_MODE.BARCODE)}
              style={({ pressed }) => [styles.scanModeCard, pressed && styles.pressed]}
            >
              <View style={styles.scanModeIconWrap}>
                <LinearGradient colors={['rgba(214,178,94,0.08)', 'rgba(214,178,94,0.02)']} style={styles.scanModeIconBg}>
                  <Ionicons name="barcode" size={28} color={colors.gold} />
                </LinearGradient>
              </View>
              <Text style={styles.scanModeTitle}>BARCODE</Text>
              <Text style={styles.scanModeDesc}>Labels & Stickers</Text>
            </Pressable>
          </LinearGradient>

          {/* AI VISION CAPTURE */}
          <LinearGradient
            colors={['rgba(8,10,18,0.92)', 'rgba(4,6,14,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.scanModeBezel, { flex: 1, marginLeft: 6 }]}
          >
            <Pressable
              onPress={() => openScanner(SCAN_MODE.CAPTURE)}
              style={({ pressed }) => [styles.scanModeCard, styles.scanModeCardAi, pressed && styles.pressed]}
            >
              <View style={styles.scanModeIconWrap}>
                <LinearGradient colors={['rgba(100,200,255,0.08)', 'rgba(100,200,255,0.02)']} style={styles.scanModeIconBg}>
                  <Ionicons name="sparkles" size={28} color="#64C8FF" />
                </LinearGradient>
              </View>
              <Text style={[styles.scanModeTitle, { color: '#64C8FF' }]}>AI VISION</Text>
              <Text style={styles.scanModeDesc}>Windshield / Plate</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Last scan result */}
        {lastScan?.vin && (
          <View style={styles.lastScanCard}>
            <View style={styles.lastScanHeader}>
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={styles.lastScanLabel}>Last Scanned VIN</Text>
            </View>
            <Text style={styles.lastScanVin}>{lastScan.vin}</Text>
            {(lastScan.decoded?.vehicle || lastScan.decoded?.make) && (
              <Text style={styles.lastScanDetail}>
                {[
                  lastScan.decoded?.vehicle?.year || lastScan.decoded?.year,
                  lastScan.decoded?.vehicle?.make || lastScan.decoded?.make,
                  lastScan.decoded?.vehicle?.model || lastScan.decoded?.model,
                ].filter(Boolean).join(' ')}
              </Text>
            )}
            {lastScan.error && (
              <Text style={[styles.lastScanDetail, { color: colors.red }]}>{lastScan.error}</Text>
            )}
          </View>
        )}

        {/* ── Camera Modal ── */}
        <Modal visible={scannerOpen && canScan} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.modalRoot}>
            <LinearGradient colors={[colors.bg0, colors.bg1]} style={{ flex: 1 }}>

              {/* Header — dynamically padded for status bar / Dynamic Island */}
              <View style={[styles.modalHeader, { paddingTop: insets.top + 12, height: 68 + insets.top }]}>
                <Pressable onPress={closeScanner} style={[styles.modalClose, { top: insets.top + 10 }]}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.modalTitleRow}>
                  <Ionicons
                    name={scanMode === SCAN_MODE.BARCODE ? 'barcode-outline' : 'sparkles'}
                    size={16}
                    color={scanMode === SCAN_MODE.BARCODE ? colors.gold : '#64C8FF'}
                  />
                  <Text style={[
                    styles.modalTitle,
                    { color: scanMode === SCAN_MODE.BARCODE ? colors.gold : '#64C8FF' }
                  ]}>
                    {scanMode === SCAN_MODE.BARCODE ? 'BARCODE VIN SCAN' : 'AI VISION VIN SCAN'}
                  </Text>
                </View>
                {/* Mode switcher */}
                <Pressable
                  onPress={() => {
                    const next = scanMode === SCAN_MODE.BARCODE ? SCAN_MODE.CAPTURE : SCAN_MODE.BARCODE;
                    setScanMode(next);
                    setScanning(next === SCAN_MODE.BARCODE);
                    setOcrResults(null);
                    setOcrStatus('');
                  }}
                  style={[styles.modeSwitchBtn, { top: insets.top + 10 }]}
                >
                  <Ionicons
                    name={scanMode === SCAN_MODE.BARCODE ? 'sparkles' : 'barcode-outline'}
                    size={18}
                    color={colors.textDim}
                  />
                </Pressable>
              </View>

              {/* Camera View — paused when app backgrounds (saves battery) */}
              <View style={styles.modalBody}>
                <View style={styles.scannerWrap}>
                  {cameraIsActive ? (
                  <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    autofocus="on"
                    // ── Barcode scanner — explicitly enabled with minimal reliable types ──
                    // @ts-ignore - barcodeScannerEnabled exists at runtime in expo-camera 17+
                    barcodeScannerEnabled={scanMode === SCAN_MODE.BARCODE}
                    barcodeScannerSettings={
                      scanMode === SCAN_MODE.BARCODE
                        ? {
                            barcodeTypes: [
                              'code39',     // Most common VIN barcode (OEM window stickers)
                              'code128',    // Second most common (dealer/aftermarket labels)
                              'datamatrix', // Newer vehicles — 2D stamped metal plates
                              'qr',         // Some dealers add QR to window stickers
                            ],
                          }
                        : { barcodeTypes: ['qr'] }
                    }
                    // Only attach scanner callback when actively scanning to prevent double-fire
                    onBarcodeScanned={
                      scanMode === SCAN_MODE.BARCODE && scanning ? onBarcodeScanned : undefined
                    }
                    onCameraReady={() => setCameraReady(true)}
                    enableTorch={torchOn && cameraReady}
                    zoom={zoom}
                  />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0E14', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="pause-circle-outline" size={48} color={colors.textDim} />
                      <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 12 }}>Camera paused</Text>
                    </View>
                  )}

                  {/* Capture flash overlay */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: 'white', opacity: captureFlash },
                    ]}
                  />

                  {/* ── BARCODE MODE: Wide landscape scan frame for VIN barcodes ── */}
                  {scanMode === SCAN_MODE.BARCODE && (
                    <>
                      <View style={styles.scanMaskTop} />
                      <View style={styles.barcodeScanFrame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                        <Animated.View
                          style={[
                            styles.scanLine,
                            {
                              transform: [{
                                translateY: scanLineAnim.interpolate({
                                  inputRange: [0, 1],
                                  // Use large range; frame overflow:hidden clips it automatically
                                  outputRange: [0, 500],
                                }),
                              }],
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.scanMaskBottom} />
                    </>
                  )}

                  {/* ── AI VISION MODE: square frame ── */}
                  {scanMode === SCAN_MODE.CAPTURE && (
                    <>
                      <View style={styles.scanMaskTop} />
                      <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                        <Animated.View
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: '#64C8FF',
                              opacity: ocrProcessing
                                ? ocrPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.0] })
                                : 0.7,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.scanMaskBottom} />
                    </>
                  )}

                  {/* ── VIN FOUND banner overlay ── */}
                  {vinFoundBanner ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.vinFoundBanner,
                        { opacity: vinFoundAnim },
                      ]}
                    >
                      <View style={styles.vinFoundInner}>
                        <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                        <View>
                          <Text style={styles.vinFoundLabel}>VIN FOUND</Text>
                          <Text style={styles.vinFoundVin}>{vinFoundBanner}</Text>
                        </View>
                      </View>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Camera controls */}
                <View style={styles.cameraControls}>
                  {/* Torch button */}
                  <Pressable
                    onPress={() => setTorchOn((t) => !t)}
                    style={[styles.cameraControlBtn, torchOn && styles.cameraControlBtnActive]}
                  >
                    <Ionicons
                      name={torchOn ? 'flashlight' : 'flashlight-outline'}
                      size={20}
                      color={torchOn ? '#000' : colors.text}
                    />
                    <Text style={[styles.cameraControlLabel, torchOn && { color: '#000' }]}>
                      {torchOn ? 'ON' : 'LIGHT'}
                    </Text>
                  </Pressable>

                  {/* Zoom slider */}
                  <View style={styles.zoomSliderWrap}>
                    <Ionicons name="remove" size={16} color={colors.textMute} />
                    <View style={styles.zoomSliderTrack} {...zoomPanResponder.panHandlers}>
                      <View style={[styles.zoomSliderFill, { width: `${zoom * 100}%` }]} />
                      <View style={[styles.zoomThumb, { left: zoom * SLIDER_TRACK_W - 10 }]} />
                    </View>
                    <Ionicons name="add" size={16} color={colors.textMute} />
                    <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
                  </View>
                </View>

                {/* ── BARCODE MODE: hint + re-scan button ── */}
                {scanMode === SCAN_MODE.BARCODE && (
                  <View style={styles.hintCard}>
                    <View style={styles.hintCardInner}>
                      <Ionicons name="scan" size={18} color={colors.gold} />
                      <Text style={styles.hintText}>
                        {scanning
                          ? 'Point at the barcode on the door jamb label or window sticker. Hold steady — scanning automatically.'
                          : 'Scanning paused. Tap below to scan again.'}
                      </Text>
                    </View>
                    {!scanning && (
                      <Pressable
                        onPress={() => {
                          lastScannedVin.current = '';
                          lastScanTime.current = 0;
                          setScanning(true);
                          impactLight();
                        }}
                        style={({ pressed }) => [styles.rescanBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons name="refresh" size={16} color={colors.gold} />
                        <Text style={styles.rescanBtnText}>TAP TO SCAN AGAIN</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* ── AI VISION MODE: capture button + results ── */}
                {scanMode === SCAN_MODE.CAPTURE && (
                  <View style={styles.aiPanel}>
                    {/* Status text */}
                    {ocrStatus ? (
                      <View style={styles.ocrStatusRow}>
                        {ocrProcessing && <ActivityIndicator size="small" color="#64C8FF" style={{ marginRight: 8 }} />}
                        <Text style={[styles.ocrStatusText, { color: ocrProcessing ? '#64C8FF' : colors.textDim }]}>
                          {ocrStatus}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.hintCard}>
                        <View style={styles.hintCardInner}>
                          <Ionicons name="sparkles" size={18} color="#64C8FF" />
                          <Text style={[styles.hintText, { color: colors.textDim }]}>
                            Frame the VIN plate in the guide box. Works on windshield engravings, dashboard stamps, and door jamb text.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* OCR Results — tappable VINs */}
                    {ocrResults && ocrResults.vins.length > 0 && (
                      <View style={styles.ocrResults}>
                        <Text style={styles.ocrResultsTitle}>TAP TO USE:</Text>
                        {ocrResults.vins.map((vin) => (
                          <Pressable
                            key={vin}
                            onPress={() => handleOcrVinSelect(vin)}
                            style={({ pressed }) => [styles.ocrVinBtn, pressed && styles.pressed]}
                          >
                            <LinearGradient
                              colors={['rgba(100,200,255,0.2)', 'rgba(100,200,255,0.08)']}
                              style={styles.ocrVinGradient}
                            >
                              <Ionicons name="sparkles" size={14} color="#64C8FF" />
                              <Text style={styles.ocrVinText}>{vin}</Text>
                              <Ionicons name="chevron-forward" size={16} color="#64C8FF" />
                            </LinearGradient>
                          </Pressable>
                        ))}
                        <Text style={styles.ocrConfidence}>
                          Confidence: {ocrResults.confidence?.toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {ocrResults && ocrResults.vins.length === 0 && !ocrProcessing && (
                      <View style={styles.ocrNoResult}>
                        <Ionicons name="alert-circle" size={20} color="#FFB347" />
                        <Text style={styles.ocrNoResultText}>
                          No VIN found. Ensure the VIN plate is fully visible and well-lit.
                        </Text>
                      </View>
                    )}

                    {/* Capture button */}
                    <Pressable
                      onPress={handleAiCapture}
                      disabled={ocrProcessing || !cameraReady}
                      style={({ pressed }) => [
                        styles.captureBtn,
                        (ocrProcessing || !cameraReady) && styles.captureBtnDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          ocrProcessing
                            ? ['rgba(100,200,255,0.3)', 'rgba(100,200,255,0.1)']
                            : ['rgba(100,200,255,0.5)', 'rgba(100,200,255,0.25)']
                        }
                        style={styles.captureBtnInner}
                      >
                        {ocrProcessing ? (
                          <ActivityIndicator color="#64C8FF" size="small" />
                        ) : (
                          <Ionicons name="camera" size={28} color="#64C8FF" />
                        )}
                        <Text style={styles.captureBtnText}>
                          {ocrProcessing ? 'READING...' : 'CAPTURE & READ'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
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
              {saveCategoryPicker?.source === 'ai_vision' && (
                <View style={styles.pickerSourceBadge}>
                  <Ionicons name="sparkles" size={12} color="#64C8FF" />
                  <Text style={[styles.pickerSourceText, { color: '#64C8FF' }]}>Detected by AI Vision</Text>
                </View>
              )}
              {saveCategoryPicker?.source === 'barcode' && (
                <View style={styles.pickerSourceBadge}>
                  <Ionicons name="scan" size={12} color={colors.green} />
                  <Text style={[styles.pickerSourceText, { color: colors.green }]}>Barcode Scanned</Text>
                </View>
              )}

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
                      Customer trade-ins ({tradeInHistory.length}/{MAX_TRADEIN})
                      {tradeInHistory.length >= MAX_TRADEIN ? ' — LIMIT REACHED' : ''}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => setSaveCategoryPicker(null)} style={styles.pickerCancel}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════════
            VEHICLE DETAIL MODAL — Full decoded NHTSA data
          ════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={Boolean(vehicleDetailItem)}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setVehicleDetailItem(null)}
        >
          {vehicleDetailItem ? (
            <VehicleDetailModal
              item={vehicleDetailItem}
              onClose={() => setVehicleDetailItem(null)}
              onSaveToInventory={async () => {
                await saveToInventory(vehicleDetailItem);
                // Refresh from history so the save badge updates
                setVehicleDetailItem((prev) => ({
                  ...prev,
                  savedToInventoryAt: new Date().toISOString(),
                }));
              }}
              insets={insets}
            />
          ) : null}
        </Modal>

        <View style={{ height: 12 }} />

        {/* ── Manual Entry Card ── */}
        <LinearGradient
          colors={['rgba(10,12,18,0.92)', 'rgba(6,8,14,0.92)']}
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
                onChangeText={(t) => { setManualVin(cleanVin(t)); setVinValidation(null); }}
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
            style={[styles.categoryTab, activeTab === CATEGORY.DEALER && styles.categoryTabActive]}
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
            style={[styles.categoryTab, activeTab === CATEGORY.TRADEIN && styles.categoryTabActiveTrade]}
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
                  onPress={(it) => {
                    if (it.decoded) {
                      // Already decoded — show full vehicle detail
                      setVehicleDetailItem(it);
                    } else {
                      // Not decoded yet — decode now
                      decodeAndSave(it);
                    }
                  }}
                  onSaveToInventory={saveToInventory}
                  isAtLimit={activeTab === CATEGORY.DEALER ? isAtLimit : false}
                  category={activeTab}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 20 }}
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
    backgroundColor: '#040608',
  },

  // ── Scan mode row ──
  scanModeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  scanModeBezel: {
    padding: 1.5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanModeCard: {
    backgroundColor: 'rgba(8,10,14,0.95)',
    borderRadius: 13,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
  },
  scanModeCardAi: {
    backgroundColor: 'rgba(6,10,20,0.95)',
    borderColor: 'rgba(100,200,255,0.08)',
  },
  scanModeIconWrap: {
    marginBottom: 4,
  },
  scanModeIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(214,178,94,0.2)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
  scanModeTitle: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1.2,
  },
  scanModeDesc: {
    ...type.bodyDim,
    fontSize: 10,
    color: colors.textMute,
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Section layout ──
  sectionBezel: {
    padding: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionCard: {
    backgroundColor: 'rgba(10,12,18,0.92)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
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

  // ── Last scan ──
  lastScanCard: {
    backgroundColor: 'rgba(64,255,155,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(64,255,155,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  lastScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  lastScanLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.green,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.35)',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.3 },
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
  categoryTabs: { flexDirection: 'row', gap: 6 },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
  },
  categoryTabActive: {
    borderColor: 'rgba(214,178,94,0.35)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    shadowColor: 'rgba(214,178,94,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryTabActiveTrade: {
    borderColor: 'rgba(64,210,255,0.35)',
    backgroundColor: 'rgba(64,210,255,0.08)',
    shadowColor: 'rgba(64,210,255,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  categoryTabText: { ...type.label, fontSize: 10, color: colors.textMute },
  categoryTabTextActive: { color: colors.gold },
  tabCount: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tabCountActive: { backgroundColor: 'rgba(214,178,94,0.20)' },
  tabCountText: { ...type.label, fontSize: 9, color: colors.textMute },
  tabCountTextActive: { color: colors.gold },

  // ── History ──
  historyContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.04)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 6,
  },
  historyGradient: {
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.05)',
    borderRadius: 10,
    position: 'relative',
  },
  quiltedPattern: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: { flex: 1, paddingRight: 12 },
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
  categoryBadgeText: { ...type.label, fontSize: 8, letterSpacing: 0.8 },
  vinText: { ...type.h2, fontSize: 16, color: colors.text, letterSpacing: 1.5, marginBottom: 4 },
  vinLabel: { ...type.body, color: colors.textDim, marginBottom: 4 },
  checksumWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4,
  },
  checksumWarnText: { ...type.bodyDim, fontSize: 9, color: '#FFB347' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...type.bodyDim, fontSize: 11, color: colors.textMute },
  historyRight: { flexDirection: 'row', alignItems: 'center' },
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
  saveButton: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(214,178,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stitchingTop: {
    position: 'absolute', top: 4, left: 8, right: 8,
    height: 1, backgroundColor: colors.contrastStitching, opacity: 0.15,
  },
  stitchingBottom: {
    position: 'absolute', bottom: 4, left: 8, right: 8,
    height: 1, backgroundColor: colors.contrastStitching, opacity: 0.15,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { ...type.h2, color: colors.textDim, marginTop: 12 },
  emptySubtext: { ...type.bodyDim, color: colors.textMute, marginTop: 6 },

  // ── Camera modal ──
  modalRoot: { flex: 1 },
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
    left: 16, top: 40,
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    ...type.label,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  modeSwitchBtn: {
    position: 'absolute',
    right: 16, top: 40,
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBody: { flex: 1, padding: 16 },
  scannerWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanMaskTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '28%',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // Barcode-optimized wide frame (landscape VIN barcodes need a wider/shorter target)
  barcodeScanFrame: {
    position: 'absolute',
    top: '28%',
    left: 8, right: 8,
    height: '44%',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 8,
    overflow: 'hidden', // Clips scan line to frame boundaries
  },

  scanFrame: {
    position: 'absolute',
    top: '28%',
    left: 12, right: 12,
    height: '44%',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 8,
    overflow: 'hidden', // Clips pulse effect to frame
  },
  scanLine: {
    position: 'absolute',
    left: 4, right: 4,
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
    width: 24, height: 24,
    borderColor: colors.gold,
    borderWidth: 3,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },

  // VIN found banner (shows over camera when barcode is detected)
  vinFoundBanner: {
    position: 'absolute',
    bottom: 8,
    left: 12, right: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  vinFoundInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(64,255,155,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green,
  },
  vinFoundLabel: {
    ...type.label,
    fontSize: 9,
    color: '#000',
    letterSpacing: 2,
    marginBottom: 2,
  },
  vinFoundVin: {
    ...type.h2,
    fontSize: 16,
    color: '#000',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // ── Camera controls ──
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
    gap: 10,
  },
  cameraControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cameraControlBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  cameraControlLabel: { ...type.label, fontSize: 10, color: colors.text },

  // Zoom slider (replaces +/- buttons)
  zoomSliderWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  zoomSliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  zoomSliderFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  zoomThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomLabel: {
    ...type.label,
    fontSize: 10,
    color: colors.textDim,
    minWidth: 28,
    textAlign: 'right',
  },

  scanMaskBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '28%',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // ── Hint card ──
  hintCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(214,178,94,0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.25)',
  },
  hintCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  hintText: { ...type.body, flex: 1, color: colors.text, lineHeight: 18, fontSize: 13 },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(214,178,94,0.18)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.4)',
  },
  rescanBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1.2,
  },

  // ── AI Panel ──
  aiPanel: {
    marginTop: 10,
    gap: 10,
  },
  ocrStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(100,200,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.2)',
  },
  ocrStatusText: { ...type.label, fontSize: 12, flex: 1 },
  ocrResults: {
    backgroundColor: 'rgba(100,200,255,0.06)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.2)',
    gap: 8,
  },
  ocrResultsTitle: {
    ...type.label,
    fontSize: 9,
    color: '#64C8FF',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  ocrVinBtn: { borderRadius: 8, overflow: 'hidden' },
  ocrVinGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.25)',
  },
  ocrVinText: {
    ...type.h2,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 1.5,
    flex: 1,
  },
  ocrConfidence: {
    ...type.label,
    fontSize: 9,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  ocrNoResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(255,179,71,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,179,71,0.2)',
  },
  ocrNoResultText: {
    ...type.bodyDim,
    fontSize: 12,
    color: '#FFB347',
    flex: 1,
    lineHeight: 17,
  },
  captureBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.4)',
  },
  captureBtnText: {
    ...type.label,
    fontSize: 14,
    color: '#64C8FF',
    letterSpacing: 1.5,
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
    backgroundColor: 'rgba(12,14,20,0.97)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
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
    marginBottom: 8,
  },
  pickerSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  pickerSourceText: { ...type.label, fontSize: 10, letterSpacing: 0.5 },
  pickerOption: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  pickerOptionDisabled: { opacity: 0.4 },
  pickerOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
  },
  pickerOptionText: { flex: 1 },
  pickerOptionTitle: { ...type.label, fontSize: 13, marginBottom: 4 },
  pickerOptionDesc: { ...type.bodyDim, fontSize: 11, color: colors.textMute },
  pickerCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pickerCancelText: { ...type.label, fontSize: 12, color: colors.textMute },

  pressed: { opacity: 0.7 },
});
