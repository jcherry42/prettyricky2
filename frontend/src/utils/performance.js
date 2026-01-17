/**
 * World-Class Performance Utilities
 * Debouncing, throttling, lazy loading, and optimization helpers
 */

/**
 * Debounce function - delays execution until after wait time
 * Perfect for search inputs, resize handlers
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function - limits execution rate
 * Perfect for scroll handlers, mouse move
 */
export const throttle = (func, limit = 100) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Intersection Observer for lazy loading
 */
export const createLazyLoader = (callback, options = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
  };

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry.target);
      }
    });
  }, { ...defaultOptions, ...options });
};

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  start(label) {
    this.metrics.set(label, performance.now());
  }

  end(label) {
    const start = this.metrics.get(label);
    if (start) {
      const duration = performance.now() - start;
      console.log(`⚡ [Performance] ${label}: ${duration.toFixed(2)}ms`);
      this.metrics.delete(label);
      return duration;
    }
    return null;
  }

  measure(label, fn) {
    this.start(label);
    const result = fn();
    this.end(label);
    return result;
  }

  async measureAsync(label, fn) {
    this.start(label);
    const result = await fn();
    this.end(label);
    return result;
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * Request Idle Callback fallback
 */
export const requestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  };

/**
 * Batch updates for better performance
 */
export class BatchQueue {
  constructor(processor, batchSize = 10, delay = 100) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.delay = delay;
    this.queue = [];
    this.timer = null;
  }

  add(item) {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.delay);
    }
  }

  flush() {
    if (this.queue.length === 0) return;
    
    clearTimeout(this.timer);
    this.timer = null;
    
    const batch = this.queue.splice(0, this.queue.length);
    this.processor(batch);
  }
}

/**
 * Image preloading
 */
export const preloadImages = (urls) => {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(url);
          img.onerror = reject;
          img.src = url;
        })
    )
  );
};

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  baseDelay = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Memory-efficient pagination
 */
export class VirtualList {
  constructor(items, itemHeight, containerHeight) {
    this.items = items;
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
  }

  getVisibleRange(scrollTop) {
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(
      startIndex + visibleCount + 1,
      this.items.length
    );

    return {
      startIndex: Math.max(0, startIndex - 1),
      endIndex,
      visibleItems: this.items.slice(
        Math.max(0, startIndex - 1),
        endIndex
      ),
      offsetY: Math.max(0, startIndex - 1) * this.itemHeight,
      totalHeight: this.items.length * this.itemHeight,
    };
  }
}

export default {
  debounce,
  throttle,
  createLazyLoader,
  perfMonitor,
  requestIdleCallback,
  BatchQueue,
  preloadImages,
  retryWithBackoff,
  VirtualList,
};
