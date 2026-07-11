/**
 * Supercharg'd — Shared TypeScript Type Definitions.
 *
 * Central type registry for the entire mobile application.
 * Import from '@/types' once path aliases are configured in Metro.
 */

// ============== CUSTOMER ==============

export interface Customer {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  lead_source?: string;
  lead_status?: 'new' | 'contacted' | 'qualified' | 'sold' | 'lost';
  notes?: string;
  interactions: Interaction[];
  vehicle_interests: VehicleInterest[];
  license_data?: LicenseData;
  created_at: string;
  updated_at: string;
  _queued?: boolean;
}

export interface Interaction {
  id: string;
  interaction_type: 'call' | 'email' | 'text' | 'visit' | 'note';
  content: string;
  created_at: string;
}

export interface VehicleInterest {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  category?: string;
}

// ============== VEHICLE ==============

export interface Vehicle {
  id: string;
  vin?: string;
  year?: number;
  make: string;
  model: string;
  trim?: string;
  price?: number;
  mileage?: number;
  color?: string;
  stock_number?: string;
  category: 'active_inventory' | 'trade_in';
  status: 'available' | 'sold' | 'hold';
  customer_id?: string;
  trade_in_value?: number;
  condition?: string;
  created_at: string;
  updated_at: string;
}

// ============== LICENSE / DL SCAN ==============

export interface LicenseData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  license_number?: string;
  expiration?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface LicenseScanResult {
  success: boolean;
  confidence: number;
  extracted_data?: LicenseData;
  scan_method: 'ocr' | 'pdf417' | 'gallery';
  error?: string;
}

// ============== VIN ==============

export interface VinDecodeResult {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  body_type?: string;
  engine?: string;
  transmission?: string;
  drive_type?: string;
  fuel_type?: string;
  msrp?: number;
  [key: string]: unknown;
}

export interface VinHistoryEntry {
  id: string;
  vin: string;
  source: 'barcode' | 'manual' | 'ai_ocr';
  category: 'dealer_inventory' | 'trade_in';
  savedAt: string;
  checksumValid: boolean;
  decoded?: VinDecodeResult;
}

// ============== AUTH ==============

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
}

// ============== VOICE / TTS ==============

export interface VoiceTranslateResult {
  transcript: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  success: boolean;
  error?: string;
}

export interface TtsResult {
  audio_base64: string;
  format: string;
  voice_used: string;
  cached: boolean;
}

// ============== CONVERSATION ==============

export interface Conversation {
  id: string;
  session_id: string;
  situation: string;
  response: string;
  translated_response?: string;
  customer_id?: string;
  customer_name?: string;
  vehicle_info?: string;
  category?: string;
  language: string;
  shortcut_used?: string;
  created_at: string;
}

// ============== TOWER TALK ==============

export interface TowerTalkRequest {
  situation: string;
  customer_name?: string;
  vehicle_info?: string;
  language?: string;
}

export interface TowerTalkResponse {
  response: string;
  session_id: string;
  suggestions?: string[];
}

// ============== SETTINGS ==============

export interface AppSettings {
  serviceMode: boolean;
  haptics: boolean;
  soundProfile: string;
  language: string;
  sportMode: boolean;
  ambientColor: string;
  taillightFlash: boolean;
  backendUrl?: string;
}

// ============== NAVIGATION ==============

export type RootTabParamList = {
  Home: undefined;
  VinScan: undefined;
  DlScan: undefined;
  Vehicles: undefined;
};

// ============== API ==============

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  customers: T[];
  total: number;
  has_more: boolean;
  next_cursor: string | null;
}

// ============== EVENTS ==============

export type AppEventMap = {
  openNewCustomer: () => void;
  vinScanned: (vin: string) => void;
  licenseScanned: (data: LicenseData) => void;
  customerCreated: (customer: Customer) => void;
};

// ============== ANOMALY DETECTION ==============

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Anomaly {
  anomaly_id: string;
  check: string;
  severity: AnomalySeverity;
  vin: string;
  message: string;
  details: Record<string, unknown>;
  detected_at: string;
  resolved: boolean;
  resolution?: string;
  resolved_at?: string;
}

export interface AnomalySummary {
  total_anomalies: number;
  unresolved: number;
  by_severity: Partial<Record<AnomalySeverity, number>>;
  last_24h: number;
  health: 'clean' | 'warning' | 'alert';
}

export interface AnomalyScanResult {
  scan_time: string;
  checks_run: number;
  anomalies_found: number;
  by_severity: Record<AnomalySeverity, number>;
  details: Anomaly[];
}

// ============== WEBSOCKET ==============

export interface WsMessage {
  event: string;
  data: Record<string, unknown>;
  ts: string;
}

export type WsAction = 'ping' | 'subscribe' | 'unsubscribe';

// ============== SESSION PERSISTENCE ==============

export type FormDraft = Record<string, unknown>;
export type FormDraftMap = Record<string, FormDraft>;

/** Well-known form draft shapes. Consumers can cast `formDrafts.towerTalk as TowerTalkFormDraft`. */
export interface TowerTalkFormDraft {
  situation?: string;
  customerName?: string;
  vehicle?: string;
  reply?: string;
  translated?: string;
  selectedInquiry?: string;
  targetLanguage?: string;
  historyIndex?: number;
}

/** A single Tower Talk / Quick Compose exchange the user has already generated. */
export interface TowerTalkHistoryEntry {
  id?: string;
  situation: string;
  reply: string;
  translated?: string;
  targetLanguage?: string;
  customerName?: string;
  vehicle?: string;
  createdAt: string;
  mode?: 'sales' | 'service';
}

export interface PttLastResult {
  transcript: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  translated_speech_audio?: string;
  detected_language?: string;
}

/** Loose navigation state — the React Navigation shape is deeply generic, we just persist/restore it opaquely. */
export type NavigationState = { routes?: unknown[]; index?: number } & Record<string, unknown>;

/** Intake screen resumable state. */
export interface IntakeState {
  step?: number;
  scanned_license?: LicenseData | null;
  scanned_vin?: string | null;
  customer_notes?: string;
  [key: string]: unknown;
}

export interface SessionSnapshot {
  navigation_state?: NavigationState | null;
  active_customer_id?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active_customer?: any | null;  // Loose — same shape as CustomerRecord (avoids circular type import)
  form_drafts?: FormDraftMap;
  tower_talk_history?: TowerTalkHistoryEntry[];
  ptt_last_result?: PttLastResult | null;
  modal_states?: Record<string, boolean>;
  search_query?: string;
  scroll_positions?: Record<string, number>;
  intake_state?: IntakeState | null;
  version: number;
  saved_at?: number;
}
