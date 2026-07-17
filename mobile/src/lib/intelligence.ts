/**
 * Apex Intelligence Framework — client helper.
 *
 * Wraps POST /api/intelligence/analyze. Returns a typed AutomotiveInteractionOutput
 * or throws. Callers should wrap in try/catch and treat failure as non-fatal —
 * the intelligence insight is an ENHANCEMENT to the primary reply flow, not a
 * replacement for it. If it fails, the app should carry on with the reply the
 * user already has.
 */
import { apiFetch } from './api';

export type ChannelType = 'sms' | 'email' | 'chat' | 'voice' | 'in_person';
export type AppModeType = 'sales' | 'service';

export type RepairStage =
  | 'intake'
  | 'diagnosis'
  | 'estimate_approval'
  | 'in_repair'
  | 'quality_control'
  | 'ready_for_pickup'
  | 'post_service_followup';

export type ServiceUrgency =
  | 'safety_critical'
  | 'due_soon'
  | 'routine_maintenance'
  | 'optional';

export type ServiceCustomerConcern =
  | 'cost'
  | 'wait_time'
  | 'trust'
  | 'safety'
  | 'warranty'
  | 'loaner_transport'
  | 'parts_delay'
  | 'repeat_issue'
  | 'clarity'
  | 'other';

export type ServiceNextAction =
  | 'request_approval'
  | 'schedule_appointment'
  | 'confirm_pickup'
  | 'escalate_to_manager'
  | 'explain_and_reassure'
  | 'offer_loaner'
  | 'await_parts'
  | 'decline_service'
  | 'provide_status_update'
  | 'other';

/** The 6 topics that require advisor verification. Missing/empty = forced
 *  to say "being verified" in the response. */
export type VerifiedFactGateKey =
  | 'price'
  | 'warrantyCoverage'
  | 'completionTime'
  | 'partsArrival'
  | 'loanerAvailability'
  | 'diagnosis';

export type VerifiedFactGates = Partial<Record<VerifiedFactGateKey, string>>;

export interface AnalyzeInput {
  mode: AppModeType;
  channel: ChannelType;
  customerName?: string;
  customerLanguage?: string;
  customerMessage: string;
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    vin?: string;
    mileage?: number;
  };
  dealership?: { name?: string };
  employee?: {
    name?: string;
    role?: 'salesperson' | 'sales_manager' | 'service_advisor' | 'service_manager' | 'other';
  };
  conversationHistory?: { role: 'customer' | 'employee'; text: string; timestamp?: string }[];
  agentNotes?: string;
  /** Service mode only — current stage of the RO. */
  repairStage?: RepairStage;
  /** Service mode only — advisor-verified free-text (AI MAY state as fact). */
  confirmedInformation?: string;
  /** Service mode only — background context (AI must NOT state as fact). */
  advisorNotes?: string;
  /** Service mode only — advisor-selected customer concern chip. */
  customerConcern?: ServiceCustomerConcern;
  /** Service mode only — advisor-selected desired next action chip. */
  desiredNextAction?: ServiceNextAction;
  /** Service mode only — per-topic advisor verification. Empty/missing
   *  keys force the response to say "being verified". */
  verifiedFactGates?: VerifiedFactGates;
}

export interface AnalyzeOutput {
  detectedLanguage: string;
  translatedCustomerMeaning?: string | null;
  mode: AppModeType;
  primaryIntent: string;
  secondaryIntent?: string | null;
  conversationStage: string;
  objection: {
    detected: boolean;
    category?: string | null;
    confidence: number;
    underlyingConcern?: string | null;
  };
  customerSentiment: {
    label: 'positive' | 'neutral' | 'uncertain' | 'frustrated' | 'angry';
    confidence: number;
  };
  recommendedStrategy: string;
  responses: {
    recommended: string;
    direct: string;
    empathetic: string;
  };
  nextBestAction: { action: string; reason: string };
  missingInformation: string[];
  riskFlags: string[];
  /** Service-mode-only fields. Null in sales mode. */
  repairStage?: RepairStage | null;
  urgencyClassification?: ServiceUrgency | null;
  guestConcern?: string | null;
  serviceFramework?: {
    acknowledge: string;
    verifiedFactsStatement: string;
    impact: string;
    nextStep: string;
  } | null;
  /** Service mode only — three situation-style variants (Concise / Explain
   *  Clearly / De-escalate). Replaces the generic tone labels. */
  serviceResponses?: {
    concise: string;
    explainClearly: string;
    deEscalate: string;
  } | null;
  /** Service mode only — deterministic list of the 6 verified-fact-gate
   *  topics that were NOT confirmed by the advisor. UI badges these
   *  "being verified" and the AI never invented values for them. */
  unverifiedTopics?: VerifiedFactGateKey[] | null;
  prompt_version: string;
  latency_ms?: Record<string, number>;
  fallback_used?: boolean;
}

/** Human-friendly display labels — persona-agnostic. */
export const INTENT_LABELS: Record<string, string> = {
  price_inquiry: 'Asking about price',
  availability_check: 'Checking availability',
  test_drive_request: 'Wants a test drive',
  trade_in_valuation: 'Trade-in interest',
  financing_question: 'Financing question',
  appointment_request: 'Wants an appointment',
  general_question: 'General question',
  vehicle_comparison: 'Comparing vehicles',
  follow_up_response: 'Responding to follow-up',
  scheduling_service: 'Scheduling service',
  service_status_check: 'Checking service status',
  parts_inquiry: 'Parts inquiry',
  warranty_question: 'Warranty question',
  complaint_or_concern: 'Complaint / concern',
  diagnostic_symptom_report: 'Reporting a symptom',
  recall_question: 'Recall question',
  pickup_payment_completion: 'Pickup / payment',
};

export const STRATEGY_LABELS: Record<string, string> = {
  answer_directly: 'Answer directly',
  acknowledge_and_redirect: 'Acknowledge + redirect',
  clarify_before_answering: 'Clarify first',
  reframe_objection: 'Reframe objection',
  invite_to_appointment: 'Invite to appointment',
  offer_alternatives: 'Offer alternatives',
  escalate_to_human: 'ESCALATE',
  gather_diagnostic_info: 'Gather diagnostics',
  quote_estimate: 'Quote / estimate',
  schedule_service: 'Schedule service',
};

export const RISK_FLAG_LABELS: Record<string, string> = {
  legal_threat: 'Legal threat',
  request_for_manager: 'Manager requested',
  social_media_threat: 'Social media threat',
  repeat_repair: 'Repeat repair',
  vehicle_damage_claim: 'Damage claim',
  safety_concern: 'Safety concern',
};

export const OBJECTION_LABELS: Record<string, string> = {
  price_too_high: 'Price too high',
  needs_more_time: 'Needs more time',
  needs_to_talk_to_someone: 'Talk to spouse / partner',
  competitor_offer: 'Competitor offer',
  distrust_or_skepticism: 'Distrust / skepticism',
  bad_prior_experience: 'Bad prior experience',
  timing_not_right: 'Timing not right',
  financing_concern: 'Financing concern',
  trade_value_concern: 'Trade value concern',
  feature_missing: 'Feature missing',
  service_price: 'Service price',
  wait_time: 'Wait time',
  loaner_availability: 'Loaner availability',
  // Service-only objection categories (iter26)
  parts_availability_delay: 'Parts availability / delay',
  wait_time_too_long: 'Wait time too long',
  cost_transparency_concern: 'Cost transparency',
  warranty_coverage_dispute: 'Warranty coverage',
  second_opinion_wanted: 'Wants second opinion',
  tech_expertise_concern: 'Tech expertise concern',
  declined_recommended_service: 'Declined recommended service',
  loaner_unavailable: 'Loaner unavailable',
  unclear_diagnosis: 'Unclear diagnosis',
  prior_visit_dissatisfaction: 'Prior visit dissatisfaction',
};

/** Service-only human-facing repair-stage labels. */
export const REPAIR_STAGE_LABELS: Record<RepairStage, string> = {
  intake: 'Intake',
  diagnosis: 'Diagnosis',
  estimate_approval: 'Estimate Approval',
  in_repair: 'In Repair',
  quality_control: 'Quality Control',
  ready_for_pickup: 'Ready for Pickup',
  post_service_followup: 'Post-Service Follow-Up',
};

/** Repair-stage picker order (matches shop flow). */
export const REPAIR_STAGES: RepairStage[] = [
  'intake',
  'diagnosis',
  'estimate_approval',
  'in_repair',
  'quality_control',
  'ready_for_pickup',
  'post_service_followup',
];

/** Service urgency label + display color. */
export const URGENCY_LABELS: Record<ServiceUrgency, string> = {
  safety_critical: 'Safety Critical',
  due_soon: 'Due Soon',
  routine_maintenance: 'Routine Maintenance',
  optional: 'Optional',
};

export const URGENCY_COLOR: Record<ServiceUrgency, string> = {
  safety_critical: '#E53935',
  due_soon: '#FFB74D',
  routine_maintenance: '#00E5FF',
  optional: '#B0BEC5',
};

/** Chip-picker options for the customer-concern input (service mode). */
export const CUSTOMER_CONCERN_OPTIONS: Array<{ id: ServiceCustomerConcern; label: string; icon: string }> = [
  { id: 'cost',              label: 'Cost',           icon: 'cash' },
  { id: 'wait_time',         label: 'Wait Time',      icon: 'time' },
  { id: 'trust',             label: 'Trust',          icon: 'shield-half' },
  { id: 'safety',            label: 'Safety',         icon: 'warning' },
  { id: 'warranty',          label: 'Warranty',       icon: 'shield-checkmark' },
  { id: 'loaner_transport',  label: 'Loaner',         icon: 'car-sport' },
  { id: 'parts_delay',       label: 'Parts Delay',    icon: 'cube' },
  { id: 'repeat_issue',      label: 'Repeat Issue',   icon: 'refresh-circle' },
  { id: 'clarity',           label: 'Clarity',        icon: 'help-circle' },
  { id: 'other',             label: 'Other',          icon: 'ellipsis-horizontal' },
];

/** Chip-picker options for the desired-next-action input (service mode). */
export const NEXT_ACTION_OPTIONS: Array<{ id: ServiceNextAction; label: string; icon: string }> = [
  { id: 'request_approval',       label: 'Request Approval',     icon: 'checkmark-done' },
  { id: 'schedule_appointment',   label: 'Schedule Appt',        icon: 'calendar' },
  { id: 'confirm_pickup',         label: 'Confirm Pickup',       icon: 'flag' },
  { id: 'escalate_to_manager',    label: 'Escalate to Manager',  icon: 'alert-circle' },
  { id: 'explain_and_reassure',   label: 'Explain & Reassure',   icon: 'chatbubbles' },
  { id: 'offer_loaner',           label: 'Offer Loaner',         icon: 'car-sport' },
  { id: 'await_parts',            label: 'Await Parts',          icon: 'hourglass' },
  { id: 'decline_service',        label: 'Decline Service',      icon: 'close-circle' },
  { id: 'provide_status_update',  label: 'Status Update',        icon: 'megaphone' },
  { id: 'other',                  label: 'Other',                icon: 'ellipsis-horizontal' },
];

/** Ordered list of the 6 verified-fact-gate topics + display labels. */
export const VERIFIED_FACT_GATE_KEYS: VerifiedFactGateKey[] = [
  'price',
  'warrantyCoverage',
  'completionTime',
  'partsArrival',
  'loanerAvailability',
  'diagnosis',
];

export const VERIFIED_FACT_GATE_LABELS: Record<VerifiedFactGateKey, string> = {
  price: 'Price',
  warrantyCoverage: 'Warranty',
  completionTime: 'Completion Time',
  partsArrival: 'Parts Arrival',
  loanerAvailability: 'Loaner',
  diagnosis: 'Diagnosis',
};

/** Response-style options for the service-mode output card. Replaces
 *  the generic "professional / friendly / direct" tone labels — advisors
 *  think in situations, not writing styles. */
export const SERVICE_STYLE_OPTIONS: Array<{ id: 'concise' | 'explainClearly' | 'deEscalate'; label: string; icon: string; hint: string }> = [
  { id: 'concise',        label: 'Concise',        icon: 'flash',       hint: 'Shortest reply that covers the facts' },
  { id: 'explainClearly', label: 'Explain Clearly', icon: 'book',        hint: 'Teach the guest what was found and why' },
  { id: 'deEscalate',     label: 'De-escalate',    icon: 'heart',       hint: 'Ownership + empathy for upset guests' },
];

/** 6 service quick-action chips shown in Tower Talk when in Service Mode.
 *  Each chip templates a starter `situation` string that seeds analysis. */
export const SENTIMENT_COLOR: Record<AnalyzeOutput['customerSentiment']['label'], string> = {
  positive: '#00E676',
  neutral: '#B0BEC5',
  uncertain: '#FFB74D',
  frustrated: '#FF7043',
  angry: '#E53935',
};

export const SENTIMENT_LABEL: Record<AnalyzeOutput['customerSentiment']['label'], string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  uncertain: 'Uncertain',
  frustrated: 'Frustrated',
  angry: 'Angry',
};

/**
 * Fire the analyze request. Timeout at 15s — this is a supplementary call
 * so we cap it aggressively and never block the primary reply flow.
 */
export async function analyzeInteraction(
  input: AnalyzeInput,
  performanceMode = false,
): Promise<AnalyzeOutput> {
  return (await apiFetch('/api/intelligence/analyze', {
    method: 'POST',
    timeout: 15000,
    body: JSON.stringify({ input, performanceMode }),
  })) as AnalyzeOutput;
}
