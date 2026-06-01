/**
 * useSessionPersistence — Auto-saves and restores full app state.
 *
 * Dealership resilience: survives app kills, phone calls, battery deaths,
 * and the 100 daily distractions that happen on a sales floor.
 *
 * Behavior:
 * - Silently restores last session on app launch (no prompt)
 * - Auto-saves every 30s while app is active
 * - Full snapshot on app background/close
 * - Server-side backup via /api/sessions/*
 * - Local AsyncStorage fallback for offline scenarios
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { loadJson, saveJson } from './storage';
import { apiFetch } from './api';

const LOCAL_SESSION_KEY = 'sc_v1_session';
const AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds

export interface SessionState {
  navigation_state?: any;
  active_customer_id?: string | null;
  active_customer?: any;
  form_drafts?: Record<string, any>;
  tower_talk_history?: any[];
  ptt_last_result?: any;
  modal_states?: Record<string, boolean>;
  search_query?: string;
  scroll_positions?: Record<string, number>;
  intake_state?: any;
  version: number;
  saved_at?: number;
}

type SessionGatherer = () => SessionState;

/**
 * Hook that manages session lifecycle.
 *
 * @param gatherSession - Function that collects current app state from all contexts.
 *                         Called on save triggers (background, timer, unmount).
 * @param onRestore     - Callback invoked with restored session data on launch.
 *                         Contexts should use this to hydrate their state.
 */
export function useSessionPersistence(
  gatherSession: SessionGatherer,
  onRestore: (session: SessionState) => void,
) {
  const gatherRef = useRef(gatherSession);
  gatherRef.current = gatherSession;

  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const restoredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Save (local + remote) ──────────────────────────────────────
  const saveSession = useCallback(async (full = false) => {
    try {
      const state = gatherRef.current();
      if (!state) return;

      state.saved_at = Date.now();

      // Always save locally (instant, works offline)
      await saveJson(LOCAL_SESSION_KEY, state);

      // Remote save (fire-and-forget for auto-save, await for full save)
      if (full) {
        await apiFetch('/api/sessions/save', {
          method: 'POST',
          body: JSON.stringify(state),
        }).catch((e: any) => console.debug('[Session] Remote save failed:', e.message));
      } else {
        // Lightweight delta — just the changeable fields
        apiFetch('/api/sessions/auto-save', {
          method: 'POST',
          body: JSON.stringify({
            delta: {
              active_customer_id: state.active_customer_id,
              active_customer: state.active_customer,
              navigation_state: state.navigation_state,
              search_query: state.search_query,
              modal_states: state.modal_states,
              form_drafts: state.form_drafts,
              tower_talk_history: state.tower_talk_history,
            },
          }),
        }).catch(() => {}); // Silent — don't disrupt UX
      }
    } catch (e: any) {
      console.debug('[Session] Save error:', e);
    }
  }, []);

  // ── Restore (local first, remote fallback) ─────────────────────
  const restoreSession = useCallback(async () => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      // Try local first (fastest)
      let session = await loadJson<SessionState | null>(LOCAL_SESSION_KEY, null);

      // If no local session or it's stale (>7 days), try remote
      if (!session || (session.saved_at && Date.now() - session.saved_at > 7 * 24 * 3600 * 1000)) {
        try {
          const remote = await apiFetch('/api/sessions/restore');
          if (remote?.session) {
            session = remote.session;
            // Update local cache with remote data
            await saveJson(LOCAL_SESSION_KEY, session);
          }
        } catch {
          // Offline — use local even if stale
        }
      }

      if (session) {
        console.log('[Session] Restored session (age:', session.saved_at ? `${Math.round((Date.now() - session.saved_at) / 1000)}s` : 'unknown', ')');
        onRestoreRef.current(session);
      }
    } catch (e: any) {
      console.debug('[Session] Restore error:', e);
    }
  }, []);

  // ── AppState listener (background/foreground) ──────────────────
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // App going to background — full save
        saveSession(true);
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [saveSession]);

  // ── Auto-save timer ────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        saveSession(false);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [saveSession]);

  // ── Restore on mount ───────────────────────────────────────────
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return { saveSession, restoreSession };
}
