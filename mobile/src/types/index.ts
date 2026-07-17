/**
 * Supercharg'd — Shared TypeScript Type Definitions.
 *
 * Central type registry for the mobile application.
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
