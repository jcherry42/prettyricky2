/**
 * Enterprise Logger - Production-ready logging utility
 * Rolls Royce level: Silent in production, verbose in development
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  
  // Performance logging
  perf: (label, duration) => {
    if (isDev && duration > 100) {
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
  },
  
  // Network request logging
  network: (method, url, status) => {
    if (isDev) {
      const color = status >= 400 ? '#ff6b6b' : '#22c55e';
      console.log(`%c[NET] ${method} ${url} → ${status}`, `color: ${color}`);
    }
  }
};

export default logger;
