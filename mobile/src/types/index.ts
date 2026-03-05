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
  ecoMode: boolean;
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
