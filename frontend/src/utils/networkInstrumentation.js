import logger from './logger';

// Surgical network instrumentation for native/PWA debugging.
// Goal: capture WHAT is failing (url/method/timing) with minimal overhead.

let installed = false;

function safeUrl(url) {
  try {
    if (typeof url === 'string') return url;
    if (url && typeof url.url === 'string') return url.url;
    return String(url);
  } catch {
    return '[unprintable-url]';
  }
}

export function installNetworkInstrumentation() {
  if (installed) return;
  installed = true;

  const origFetch = window.fetch?.bind(window);
  if (!origFetch) return;

  window.fetch = async (input, init = {}) => {
    const method = (init?.method || 'GET').toUpperCase();
    const url = safeUrl(input);
    const start = performance.now();

    try {
      const res = await origFetch(input, init);
      const ms = performance.now() - start;

      // Log only API + failures to keep overhead tiny
      if (url.includes('/api/') || res.status >= 400 || ms > 2000) {
        logger.network(method, url, res.status);
        if (ms > 2000) logger.warn('[NET:SLOW]', method, url, `${ms.toFixed(0)}ms`);
      }

      // Debug hook: expose last successful response meta
      window.__netlast = { ok: true, method, url, status: res.status, ms };
      return res;
    } catch (err) {
      const ms = performance.now() - start;
      const msg = String(err?.message || err || 'fetch failed');

      logger.error('[NET:FAIL]', method, url, msg, `${ms.toFixed(0)}ms`);
      window.__netlast = { ok: false, method, url, error: msg, ms };

      // Preserve original behavior
      throw err;
    }
  };

  // Capture unhandled promise rejections (often fetch-related in iOS WebViews)
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    logger.error('[UNHANDLED_REJECTION]', String(reason?.message || reason || 'unknown'));
  });
}
