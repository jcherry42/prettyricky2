/**
 * Sentry crash reporting bootstrap — mobile side.
 *
 * Enabled only when EXPO_PUBLIC_SENTRY_DSN is set (in .env or EAS secret).
 * When unset (dev default), all Sentry calls become no-ops — nothing is sent.
 *
 * PII scrubbing:
 *   - Strips email + IP from user context before every event
 *   - Filters breadcrumbs containing "PII" markers or auth headers
 *
 * Import ONCE at the very top of App.tsx BEFORE any other imports.
 */

import * as Sentry from '@sentry/react-native';

let _called = false;
let _initialized = false;

export function initSentry(): void {
  if (_called) return;
  _called = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // Silent no-op in dev / when DSN not configured.
    // _initialized stays false so wrap()/capture* remain pure no-ops.
    return;
  }
  _initialized = true;

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    release: process.env.EXPO_PUBLIC_APP_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    enableAutoSessionTracking: true,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h.authorization;
        delete h.cookie;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Drop noisy breadcrumbs that could carry PII
      if (breadcrumb.category === 'console' && (breadcrumb.message || '').includes('PII')) {
        return null;
      }
      return breadcrumb;
    },
  });
}

// Re-export the safe API surface for the rest of the app.
export const captureException = (e: unknown): void => {
  if (_initialized) Sentry.captureException(e);
};

export const captureMessage = (msg: string): void => {
  if (_initialized) Sentry.captureMessage(msg);
};

export const setUser = (id: string | null): void => {
  if (!_initialized) return;
  Sentry.setUser(id ? { id } : null);
};

/**
 * Safe wrapper around Sentry.wrap.
 *
 * When Sentry is NOT initialized (dev / DSN not configured), calling the
 * real `Sentry.wrap` throws `NativeSharedObjectNotFoundException` on
 * boot because it tries to `.get()` the App Start Span shared object
 * that only exists after `Sentry.init`. So when we're not initialized,
 * return the component untouched — no wrapping needed.
 */
export function wrap<T>(RootComponent: T): T {
  if (!_initialized) return RootComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Sentry.wrap as any)(RootComponent);
}
