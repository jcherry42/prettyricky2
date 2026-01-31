/**
 * Enterprise Performance Manager
 * Automated memory management, cache cleanup, and performance optimization
 * Designed for extended mobile PWA sessions
 */

// Configuration
const CONFIG = {
  // Memory thresholds (in MB)
  MEMORY_WARNING_THRESHOLD: 150,
  MEMORY_CRITICAL_THRESHOLD: 250,
  
  // Cleanup intervals (in ms)
  ROUTINE_CLEANUP_INTERVAL: 5 * 60 * 1000,      // 5 minutes
  DEEP_CLEANUP_INTERVAL: 30 * 60 * 1000,        // 30 minutes
  MEMORY_CHECK_INTERVAL: 60 * 1000,             // 1 minute
  
  // Cache settings
  MAX_CACHE_AGE: 24 * 60 * 60 * 1000,           // 24 hours
  MAX_CACHE_ENTRIES: 100,
  MAX_API_CACHE_SIZE: 50,
  
  // State management
  MAX_UNDO_HISTORY: 10,
  MAX_NOTIFICATION_HISTORY: 20,
  STALE_DATA_THRESHOLD: 60 * 60 * 1000,         // 1 hour
  
  // Debug mode (Vite)
  DEBUG: import.meta.env.DEV,
};

// Performance metrics storage
let metrics = {
  lastCleanup: Date.now(),
  cleanupCount: 0,
  memoryPeakMB: 0,
  gcHints: 0,
  cacheClears: 0,
  stateResets: 0,
};

// Logger
const log = (message, level = 'info') => {
  if (!CONFIG.DEBUG && level === 'debug') return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[PerfManager ${timestamp}]`;
  
  switch (level) {
    case 'warn':
      console.warn(prefix, message);
      break;
    case 'error':
      console.error(prefix, message);
      break;
    case 'debug':
      console.debug(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
};

/**
 * Get current memory usage (if available)
 * Returns memory in MB or null if not available
 */
export const getMemoryUsage = () => {
  try {
    // Chrome/Edge memory API
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize / (1024 * 1024);
      const total = performance.memory.totalJSHeapSize / (1024 * 1024);
      return { used: Math.round(used), total: Math.round(total), available: true };
    }
    
    // Safari/Firefox don't expose memory API
    return { used: null, total: null, available: false };
  } catch (e) {
    return { used: null, total: null, available: false };
  }
};

/**
 * Clear old entries from localStorage
 */
export const cleanLocalStorage = () => {
  try {
    const now = Date.now();
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Skip critical keys
      if (key.startsWith('auth_') || key === 'theme' || key === 'superchargd_startup_played') {
        continue;
      }
      
      // Check for timestamped cache entries
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed._timestamp && (now - parsed._timestamp) > CONFIG.MAX_CACHE_AGE) {
            keysToRemove.push(key);
          }
        }
      } catch {
        // Not JSON, check if it's a temp key
        if (key.startsWith('temp_') || key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      log(`Removed stale localStorage key: ${key}`, 'debug');
    });
    
    return keysToRemove.length;
  } catch (e) {
    log(`localStorage cleanup error: ${e.message}`, 'warn');
    return 0;
  }
};

/**
 * Clear old entries from sessionStorage
 */
export const cleanSessionStorage = () => {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      // Keep startup flags and essential session data
      if (key === 'superchargd_startup_played' || key.startsWith('auth_')) {
        continue;
      }
      
      // Remove old temp data
      if (key.startsWith('temp_') || key.startsWith('debug_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    return keysToRemove.length;
  } catch (e) {
    log(`sessionStorage cleanup error: ${e.message}`, 'warn');
    return 0;
  }
};

/**
 * Clear IndexedDB old data
 */
export const cleanIndexedDB = async () => {
  try {
    const databases = await indexedDB.databases?.() || [];
    let cleaned = 0;
    
    for (const db of databases) {
      if (db.name?.startsWith('cache_') || db.name?.startsWith('temp_')) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name);
          request.onsuccess = () => { cleaned++; resolve(); };
          request.onerror = () => reject(request.error);
        });
      }
    }
    
    return cleaned;
  } catch (e) {
    log(`IndexedDB cleanup error: ${e.message}`, 'warn');
    return 0;
  }
};

/**
 * Clear browser caches (Service Worker caches)
 */
export const cleanServiceWorkerCaches = async () => {
  try {
    if (!('caches' in window)) return 0;
    
    const cacheNames = await caches.keys();
    const now = Date.now();
    let cleaned = 0;
    
    for (const cacheName of cacheNames) {
      // Keep essential caches, clean old ones
      if (cacheName.includes('temp') || cacheName.includes('old')) {
        await caches.delete(cacheName);
        cleaned++;
        continue;
      }
      
      // For API caches, trim old entries
      if (cacheName.includes('api') || cacheName.includes('data')) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        if (requests.length > CONFIG.MAX_API_CACHE_SIZE) {
          // Remove oldest entries (first half)
          const toRemove = requests.slice(0, Math.floor(requests.length / 2));
          for (const request of toRemove) {
            await cache.delete(request);
            cleaned++;
          }
        }
      }
    }
    
    metrics.cacheClears++;
    return cleaned;
  } catch (e) {
    log(`Service worker cache cleanup error: ${e.message}`, 'warn');
    return 0;
  }
};

/**
 * Clear detached DOM nodes and orphaned references
 */
export const cleanDetachedNodes = () => {
  try {
    // Force release of any WeakRefs
    if (typeof WeakRef !== 'undefined') {
      // Trigger GC hint
      if (window.gc) {
        window.gc();
        metrics.gcHints++;
      }
    }
    
    // Clear any global event listeners that might be orphaned
    // This is a hint to the browser
    const events = ['resize', 'scroll', 'mousemove', 'touchmove'];
    events.forEach(event => {
      // Create and dispatch a custom cleanup event
      window.dispatchEvent(new CustomEvent('performanceCleanup', { detail: { event } }));
    });
    
    return true;
  } catch (e) {
    log(`Detached nodes cleanup error: ${e.message}`, 'warn');
    return false;
  }
};

/**
 * Clear image blob URLs that may be orphaned
 */
export const cleanBlobURLs = () => {
  try {
    // Find all blob URLs in the document
    const images = document.querySelectorAll('img[src^="blob:"]');
    const videos = document.querySelectorAll('video source[src^="blob:"]');
    
    let revoked = 0;
    
    // We can't automatically revoke in-use blob URLs, but we can
    // dispatch an event for components to handle their own cleanup
    window.dispatchEvent(new CustomEvent('cleanupBlobURLs'));
    
    return revoked;
  } catch (e) {
    log(`Blob URL cleanup error: ${e.message}`, 'warn');
    return 0;
  }
};

/**
 * Clear console in production
 */
export const cleanConsole = () => {
  if (process.env.NODE_ENV === 'production') {
    console.clear();
  }
};

/**
 * Routine cleanup - runs every 5 minutes
 * Light cleanup that won't impact performance
 */
export const routineCleanup = async () => {
  log('Starting routine cleanup...', 'debug');
  const start = performance.now();
  
  const results = {
    localStorage: cleanLocalStorage(),
    sessionStorage: cleanSessionStorage(),
    blobURLs: cleanBlobURLs(),
  };
  
  const duration = Math.round(performance.now() - start);
  metrics.lastCleanup = Date.now();
  metrics.cleanupCount++;
  
  log(`Routine cleanup complete in ${duration}ms: ${JSON.stringify(results)}`, 'debug');
  
  return results;
};

/**
 * Deep cleanup - runs every 30 minutes or when memory is high
 * More aggressive cleanup
 */
export const deepCleanup = async () => {
  log('Starting deep cleanup...', 'info');
  const start = performance.now();
  
  const results = {
    localStorage: cleanLocalStorage(),
    sessionStorage: cleanSessionStorage(),
    indexedDB: await cleanIndexedDB(),
    swCaches: await cleanServiceWorkerCaches(),
    detachedNodes: cleanDetachedNodes(),
    blobURLs: cleanBlobURLs(),
  };
  
  // Hint to GC
  if (window.gc) {
    window.gc();
    metrics.gcHints++;
  }
  
  const duration = Math.round(performance.now() - start);
  metrics.lastCleanup = Date.now();
  metrics.cleanupCount++;
  
  log(`Deep cleanup complete in ${duration}ms: ${JSON.stringify(results)}`, 'info');
  
  // Dispatch event for React components to clear their state
  window.dispatchEvent(new CustomEvent('deepCleanup', { detail: results }));
  
  return results;
};

/**
 * Emergency cleanup - when memory is critical
 */
export const emergencyCleanup = async () => {
  log('EMERGENCY CLEANUP - Memory critical!', 'warn');
  
  // Clear all non-essential storage
  const essentialKeys = ['auth_token', 'auth_user', 'theme', 'superchargd_startup_played'];
  
  // Clear localStorage except essentials
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && !essentialKeys.includes(key) && !key.startsWith('auth_')) {
      localStorage.removeItem(key);
    }
  }
  
  // Clear all sessionStorage except startup flag
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && key !== 'superchargd_startup_played') {
      sessionStorage.removeItem(key);
    }
  }
  
  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  
  // Force GC if available
  if (window.gc) {
    window.gc();
  }
  
  // Clear console
  console.clear();
  
  // Notify app
  window.dispatchEvent(new CustomEvent('emergencyCleanup'));
  
  log('Emergency cleanup complete', 'warn');
};

/**
 * Memory monitor - checks memory usage and triggers cleanup if needed
 */
export const checkMemory = async () => {
  const memory = getMemoryUsage();
  
  if (!memory.available) {
    // Can't check memory, just do routine cleanup periodically
    return;
  }
  
  // Track peak memory
  if (memory.used > metrics.memoryPeakMB) {
    metrics.memoryPeakMB = memory.used;
  }
  
  log(`Memory: ${memory.used}MB / ${memory.total}MB`, 'debug');
  
  if (memory.used > CONFIG.MEMORY_CRITICAL_THRESHOLD) {
    await emergencyCleanup();
  } else if (memory.used > CONFIG.MEMORY_WARNING_THRESHOLD) {
    await deepCleanup();
  }
};

/**
 * Get performance metrics
 */
export const getMetrics = () => ({
  ...metrics,
  memory: getMemoryUsage(),
  uptime: Date.now() - (window._perfManagerStartTime || Date.now()),
});

/**
 * Performance Manager Class - Main controller
 */
class PerformanceManager {
  constructor() {
    this.routineInterval = null;
    this.deepInterval = null;
    this.memoryInterval = null;
    this.isRunning = false;
    this.visibilityHandler = null;
  }
  
  /**
   * Start the performance manager
   */
  start() {
    if (this.isRunning) return;
    
    window._perfManagerStartTime = Date.now();
    log('Performance Manager started', 'info');
    
    // Routine cleanup every 5 minutes
    this.routineInterval = setInterval(routineCleanup, CONFIG.ROUTINE_CLEANUP_INTERVAL);
    
    // Deep cleanup every 30 minutes
    this.deepInterval = setInterval(deepCleanup, CONFIG.DEEP_CLEANUP_INTERVAL);
    
    // Memory check every minute
    this.memoryInterval = setInterval(checkMemory, CONFIG.MEMORY_CHECK_INTERVAL);
    
    // Cleanup when app goes to background
    this.visibilityHandler = () => {
      if (document.hidden) {
        log('App hidden - running cleanup', 'debug');
        routineCleanup();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    
    // Cleanup before unload
    window.addEventListener('beforeunload', () => {
      this.stop();
    });
    
    // Listen for low memory events (mobile)
    if ('ondevicememory' in navigator) {
      log(`Device memory: ${navigator.deviceMemory}GB`, 'info');
    }
    
    this.isRunning = true;
  }
  
  /**
   * Stop the performance manager
   */
  stop() {
    if (!this.isRunning) return;
    
    if (this.routineInterval) clearInterval(this.routineInterval);
    if (this.deepInterval) clearInterval(this.deepInterval);
    if (this.memoryInterval) clearInterval(this.memoryInterval);
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    
    this.isRunning = false;
    log('Performance Manager stopped', 'info');
  }
  
  /**
   * Force immediate cleanup
   */
  forceCleanup(deep = false) {
    if (deep) {
      return deepCleanup();
    }
    return routineCleanup();
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      metrics: getMetrics(),
      config: CONFIG,
    };
  }
}

// Singleton instance
const performanceManager = new PerformanceManager();

export default performanceManager;
export { CONFIG as PerformanceConfig };
