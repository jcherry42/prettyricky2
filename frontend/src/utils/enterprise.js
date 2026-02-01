/**
 * Enterprise-Grade Utilities for Supercharg'd
 * Shared functions for validation, formatting, and UX enhancements
 */

// ==================== HAPTIC FEEDBACK ====================
export const haptic = (type = 'light') => {
  try {
    if (window.navigator?.vibrate) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 50, 10],
        error: [50, 30, 50],
        warning: [20, 30, 20],
        selection: [5],
        impact: [15, 10, 15]
      };
      window.navigator.vibrate(patterns[type] || [10]);
    }
    
    // iOS AudioContext fallback for haptic-like feedback
    if (window.AudioContext || window.webkitAudioContext) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = type === 'success' ? 800 : type === 'error' ? 200 : 400;
      gainNode.gain.value = 0.01; // Very quiet
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.01);
    }
  } catch (e) {
    // Silently fail - haptics are optional
  }
};

// ==================== PHONE FORMATTING ====================
export const formatPhoneNumber = (value) => {
  if (!value) return '';
  
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Format as (000) 000-0000
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
};

export const validatePhoneNumber = (phone) => {
  const digits = phone?.replace(/\D/g, '') || '';
  return digits.length === 10;
};

// ==================== EMAIL VALIDATION ====================
export const validateEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// ==================== NAME FORMATTING ====================
export const formatName = (name) => {
  if (!name) return '';
  return name.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// ==================== VIN VALIDATION ====================
export const validateVIN = (vin) => {
  if (!vin) return { valid: false, message: '' };
  
  const clean = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  
  if (/[IOQ]/.test(vin.toUpperCase())) {
    return { valid: false, message: 'VINs cannot contain I, O, or Q' };
  }
  
  if (clean.length < 17) {
    return { valid: false, message: `${clean.length}/17 characters` };
  }
  
  if (clean.length === 17) {
    return { valid: true, message: '✓ Valid VIN format' };
  }
  
  return { valid: false, message: 'VIN must be exactly 17 characters' };
};

// ==================== CURRENCY FORMATTING ====================
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

export const parseCurrency = (value) => {
  if (!value) return 0;
  return parseFloat(value.toString().replace(/[^0-9.-]/g, '')) || 0;
};

// ==================== DATE FORMATTING ====================
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) return formatDate(date);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

// ==================== DEBOUNCE ====================
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
};

// ==================== THROTTLE ====================
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// ==================== RETRY WITH BACKOFF ====================
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// ==================== FETCH WITH TIMEOUT ====================
export const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
};

// ==================== LOCAL STORAGE WITH EXPIRY ====================
export const storageWithExpiry = {
  set: (key, value, ttlMinutes = 60) => {
    const item = {
      value,
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };
    localStorage.setItem(key, JSON.stringify(item));
  },
  
  get: (key) => {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    try {
      const parsed = JSON.parse(item);
      if (Date.now() > parsed.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.value;
    } catch {
      return null;
    }
  },
  
  remove: (key) => localStorage.removeItem(key)
};

// ==================== CLIPBOARD ====================
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      haptic('success');
      return true;
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    haptic('success');
    return true;
  } catch {
    haptic('error');
    return false;
  }
};

// ==================== STATUS COLORS ====================
export const getStatusColor = (status) => {
  const colors = {
    new: { bg: 'rgba(34, 211, 238, 0.15)', border: 'rgba(34, 211, 238, 0.3)', text: '#22d3ee' },
    hot: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171' },
    warm: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24' },
    cold: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8' },
    sold: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' },
    lost: { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280' },
    contacted: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa' },
    negotiating: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' }
  };
  return colors[status?.toLowerCase()] || colors.new;
};

// ==================== PRIORITY BADGES ====================
export const getPriorityConfig = (priority) => {
  const configs = {
    hot: { emoji: '🔥', label: 'HOT', color: '#ef4444', pulse: true },
    warm: { emoji: '⚡', label: 'WARM', color: '#f59e0b', pulse: false },
    new: { emoji: '✨', label: 'NEW', color: '#22d3ee', pulse: true },
    cold: { emoji: '❄️', label: 'COLD', color: '#94a3b8', pulse: false }
  };
  return configs[priority?.toLowerCase()] || configs.new;
};

// ==================== ACCESSIBILITY ====================
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
};

export const trapFocus = (element) => {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleTab = (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };
  
  element.addEventListener('keydown', handleTab);
  firstElement?.focus();
  
  return () => element.removeEventListener('keydown', handleTab);
};

// ==================== NETWORK STATUS ====================
export const isOnline = () => navigator.onLine;

export const onNetworkChange = (callback) => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
};

export default {
  haptic,
  formatPhoneNumber,
  validatePhoneNumber,
  validateEmail,
  formatName,
  validateVIN,
  formatCurrency,
  parseCurrency,
  formatDate,
  formatRelativeTime,
  debounce,
  throttle,
  retryWithBackoff,
  fetchWithTimeout,
  storageWithExpiry,
  copyToClipboard,
  getStatusColor,
  getPriorityConfig,
  announceToScreenReader,
  trapFocus,
  isOnline,
  onNetworkChange
};
