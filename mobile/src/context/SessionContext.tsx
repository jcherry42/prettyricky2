/**
 * SessionPersistenceProvider — Wraps the app to provide auto-save/restore.
 *
 * Captures state from all contexts:
 * - CustomerContext: active customer, search query
 * - InventoryContext: (already cached separately)
 * - PttContext: last translation result
 * - AppSettingsContext: (already persisted separately)
 * - Navigation state: current tab, modal states
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * - Form drafts: any in-progress data entry
 *
 * Restores silently on app launch — zero user interaction required.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useSessionPersistence, SessionState } from '../lib/sessionPersistence';
import type { CustomerRecord } from './CustomerContext';
import type {
  FormDraft,
  FormDraftMap,
  IntakeState,
  NavigationState,
  PttLastResult,
  TowerTalkHistoryEntry,
} from '../types';

interface SessionContextValue {
  /** Current active customer being worked with */
  activeCustomerId: string | null;
  activeCustomer: CustomerRecord | null;
  setActiveCustomer: (customer: CustomerRecord | null) => void;
  clearActiveCustomer: () => void;

  /** Form drafts (keyed by form name) */
  formDrafts: FormDraftMap;
  setFormDraft: (formName: string, data: FormDraft) => void;
  clearFormDraft: (formName: string) => void;

  /** Tower Talk conversation history */
  towerTalkHistory: TowerTalkHistoryEntry[];
  setTowerTalkHistory: (history: TowerTalkHistoryEntry[]) => void;

  /** PTT last result */
  pttLastResult: PttLastResult | null;
  setPttLastResult: (result: PttLastResult | null) => void;

  /** Navigation state for persistence */
  navigationState: NavigationState | null;
  setNavigationState: (state: NavigationState | null) => void;

  /** Modal states */
  modalStates: Record<string, boolean>;
  setModalState: (modal: string, open: boolean) => void;

  /** Search state */
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** Intake screen state */
  intakeState: IntakeState | null;
  setIntakeState: (state: IntakeState | null) => void;

  /** Manual save trigger */
  forceSave: () => Promise<void>;

  /** Whether session was restored from previous state */
  wasRestored: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionPersistenceProvider({ children }: { children: React.ReactNode }) {
  // ── Persisted state fields ─────────────────────────────────────
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeCustomer, setActiveCustomerState] = useState<CustomerRecord | null>(null);
  const [formDrafts, setFormDrafts] = useState<FormDraftMap>({});
  const [towerTalkHistory, setTowerTalkHistory] = useState<TowerTalkHistoryEntry[]>([]);
  const [pttLastResult, setPttLastResult] = useState<PttLastResult | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [modalStates, setModalStates] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [intakeState, setIntakeState] = useState<IntakeState | null>(null);
  const [wasRestored, setWasRestored] = useState(false);

  // Refs for the gather function (avoids stale closures)
  const stateRef = useRef({
    activeCustomerId, activeCustomer, formDrafts, towerTalkHistory,
    pttLastResult, navigationState, modalStates, searchQuery, intakeState,
  });
  stateRef.current = {
    activeCustomerId, activeCustomer, formDrafts, towerTalkHistory,
    pttLastResult, navigationState, modalStates, searchQuery, intakeState,
  };

  // ── Gather current state for save ──────────────────────────────
  const gatherSession = useCallback((): SessionState => {
    const s = stateRef.current;
    return {
      active_customer_id: s.activeCustomerId,
      active_customer: s.activeCustomer,
      form_drafts: Object.keys(s.formDrafts).length > 0 ? s.formDrafts : undefined,
      tower_talk_history: s.towerTalkHistory.length > 0 ? s.towerTalkHistory : undefined,
      ptt_last_result: s.pttLastResult,
      navigation_state: s.navigationState,
      modal_states: s.modalStates,
      search_query: s.searchQuery || undefined,
      intake_state: s.intakeState,
      version: 1,
    };
  }, []);

  // ── Restore callback ───────────────────────────────────────────
  const onRestore = useCallback((session: SessionState) => {
    if (session.active_customer_id) setActiveCustomerId(session.active_customer_id);
    if (session.active_customer) setActiveCustomerState(session.active_customer);
    if (session.form_drafts) setFormDrafts(session.form_drafts);
    if (session.tower_talk_history) setTowerTalkHistory(session.tower_talk_history);
    if (session.ptt_last_result) setPttLastResult(session.ptt_last_result);
    if (session.navigation_state) setNavigationState(session.navigation_state);
    if (session.modal_states) setModalStates(session.modal_states);
    if (session.search_query) setSearchQuery(session.search_query);
    if (session.intake_state) setIntakeState(session.intake_state);
    setWasRestored(true);
  }, []);

  // ── Hook handles AppState, timer, and restore ──────────────────
  const { saveSession } = useSessionPersistence(gatherSession, onRestore);

  // ── Public API ─────────────────────────────────────────────────
  const setActiveCustomer = useCallback((customer: CustomerRecord | null) => {
    setActiveCustomerState(customer);
    setActiveCustomerId(customer?.id || customer?.customer_id || null);
  }, []);

  const clearActiveCustomer = useCallback(() => {
    setActiveCustomerState(null);
    setActiveCustomerId(null);
  }, []);

  const setFormDraft = useCallback((formName: string, data: FormDraft) => {
    setFormDrafts((prev) => ({ ...prev, [formName]: data }));
  }, []);

  const clearFormDraft = useCallback((formName: string) => {
    setFormDrafts((prev) => {
      const next = { ...prev };
      delete next[formName];
      return next;
    });
  }, []);

  const setModalState = useCallback((modal: string, open: boolean) => {
    setModalStates((prev) => ({ ...prev, [modal]: open }));
  }, []);

  const forceSave = useCallback(async () => {
    await saveSession(true);
  }, [saveSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      activeCustomerId, activeCustomer, setActiveCustomer, clearActiveCustomer,
      formDrafts, setFormDraft, clearFormDraft,
      towerTalkHistory, setTowerTalkHistory,
      pttLastResult, setPttLastResult,
      navigationState, setNavigationState,
      modalStates, setModalState,
      searchQuery, setSearchQuery,
      intakeState, setIntakeState,
      forceSave, wasRestored,
    }),
    [
      activeCustomerId, activeCustomer, setActiveCustomer, clearActiveCustomer,
      formDrafts, setFormDraft, clearFormDraft,
      towerTalkHistory, setTowerTalkHistory,
      pttLastResult, setPttLastResult,
      navigationState, setNavigationState,
      modalStates, setModalState,
      searchQuery, setSearchQuery,
      intakeState, setIntakeState,
      forceSave, wasRestored,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionPersistenceProvider');
  return ctx;
}
