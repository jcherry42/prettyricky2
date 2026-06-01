/**
 * Telemetry — fire-and-forget event tracking
 *
 * Events flow: mobile → backend `/api/telemetry/track` → MongoDB + (optional) PostHog
 *
 * Usage:
 *   import { track } from '../lib/telemetry';
 *   track('vin_scan', 'completed', { vin: '...', durationMs: 1240 });
 *
 * Design notes:
 *   - Non-blocking (`void` return, errors swallowed)
 *   - No retry/queue — telemetry must never disrupt UX
 *   - PostHog forwarding happens server-side when POSTHOG_API_KEY is set
 */

import { apiFetch } from './api';

interface TrackProps {
  [key: string]: unknown;
}

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

export function track(category: string, action: string, properties?: TrackProps): void {
  // Fire-and-forget — telemetry must never block UX
  apiFetch('/api/telemetry/track', {
    method: 'POST',
    body: JSON.stringify({
      category,
      action,
      properties: properties || {},
      session_id: getSessionId(),
    }),
  }).catch(() => {
    // Silently swallow — telemetry failures should never propagate
  });
}

/**
 * Track an event with automatic timing.
 *
 *   const finish = startTimer('vin_scan', 'ocr');
 *   await runOcr();
 *   finish({ vin: result.vin });   // properties.duration_ms is added automatically
 */
export function startTimer(category: string, action: string) {
  const start = Date.now();
  return (properties?: TrackProps) => {
    track(category, action, { ...properties, duration_ms: Date.now() - start });
  };
}
