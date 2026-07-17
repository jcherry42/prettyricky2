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

/** 6 service quick-action chips shown in Tower Talk when in Service Mode.
 *  Each chip templates a starter `situation` string that seeds analysis. */
export interface ServiceQuickAction {
  id:
    | 'waiter_update'
    | 'parts_eta'
    | 'estimate_approval'
    | 'loaner_request'
    | 'comeback_ticket'
    | 'pickup_notice';
  label: string;
  icon: string;
  template: string;
  suggestedStage: RepairStage;
}

export const SERVICE_QUICK_ACTIONS: ServiceQuickAction[] = [
  {
    id: 'waiter_update',
    label: 'Waiter Update',
    icon: 'time',
    template: 'Guest is waiting in the lounge and asked for a status update.',
    suggestedStage: 'in_repair',
  },
  {
    id: 'parts_eta',
    label: 'Parts ETA',
    icon: 'cube',
    template: 'Guest is asking when the parts will arrive for their repair.',
    suggestedStage: 'in_repair',
  },
  {
    id: 'estimate_approval',
    label: 'Estimate Approval',
    icon: 'checkmark-done',
    template: 'Guest needs to approve the recommended repair estimate.',
    suggestedStage: 'estimate_approval',
  },
  {
    id: 'loaner_request',
    label: 'Loaner Request',
    icon: 'car-sport',
    template: 'Guest is asking about loaner availability while their vehicle is here.',
    suggestedStage: 'diagnosis',
  },
  {
    id: 'comeback_ticket',
    label: 'Comeback Ticket',
    icon: 'refresh-circle',
    template: 'Guest returned with the same concern from a previous visit.',
    suggestedStage: 'diagnosis',
  },
  {
    id: 'pickup_notice',
    label: 'Pickup Notice',
    icon: 'flag',
    template: 'Vehicle is ready — need to notify the guest for pickup and payment.',
    suggestedStage: 'ready_for_pickup',
  },
];

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
