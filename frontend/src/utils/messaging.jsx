/**
 * Messaging Utilities
 * Enhanced iMessage/SMS integration with Web Share API fallback
 */

// Detect iOS device
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

// Detect if Web Share API is available
export const canShare = () => {
  return navigator.share !== undefined;
};

// Detect if running as PWA (standalone)
export const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
};

/**
 * Share message via best available method
 * Priority: Web Share API > iMessage/SMS > Clipboard
 */
export const shareMessage = async (message, customerPhone = null, customerName = null) => {
  // Prepare share data
  const shareData = {
    title: customerName ? `Message for ${customerName}` : 'Sales Response',
    text: message,
  };

  // Try Web Share API first (works great on iOS Safari)
  if (canShare()) {
    try {
      await navigator.share(shareData);
      return { success: true, method: 'share' };
    } catch (err) {
      // User cancelled or share failed - fall through to other methods
      if (err.name === 'AbortError') {
        // User cancelled - silent
      }
    }
  }

  // Try SMS/iMessage URI scheme
  if (customerPhone) {
    return openMessages(message, customerPhone);
  }

  // Final fallback: copy to clipboard
  return copyToClipboard(message);
};

/**
 * Open Messages app with pre-filled text
 * Uses proper URI scheme for iOS iMessage
 */
export const openMessages = (message, phone = null) => {
  try {
    // Clean phone number
    const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : '';
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Build URI - iOS uses different separators
    let uri;
    if (isIOS()) {
      // iOS uses & for body parameter in some versions
      // sms:// with body works on iOS 8+
      uri = cleanPhone 
        ? `sms:${cleanPhone}&body=${encodedMessage}`
        : `sms:&body=${encodedMessage}`;
    } else {
      // Android and others use ? for parameters
      uri = cleanPhone
        ? `sms:${cleanPhone}?body=${encodedMessage}`
        : `sms:?body=${encodedMessage}`;
    }
    
    // Open the URI
    window.location.href = uri;
    
    return { success: true, method: 'sms' };
  } catch {
    return { success: false, method: 'sms', error: 'Failed to open messages' };
  }
};

/**
 * Copy text to clipboard with visual feedback
 */
export const copyToClipboard = async (text) => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard' };
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (result) {
      return { success: true, method: 'clipboard' };
    }
    
    return { success: false, method: 'clipboard', error: 'Copy failed' };
  } catch (err) {
    console.error('[Clipboard] Failed to copy:', err);
    return { success: false, method: 'clipboard', error: err.message };
  }
};

/**
 * Quick action: Copy and prepare to send
 * Copies message and shows prompt to send via Messages
 */
export const quickSend = async (message, customerPhone = null, customerName = null) => {
  // First copy to clipboard as backup
  await copyToClipboard(message);
  
  // Then try to open Messages
  if (customerPhone || isIOS()) {
    return openMessages(message, customerPhone);
  }
  
  // If no phone and not iOS, just confirm copy
  return { success: true, method: 'clipboard' };
};

/**
 * Format phone number for display
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^\d]/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * Pre-cache data for offline use
 */
export const cacheForOffline = (url) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_DATA',
      url: url
    });
  }
};

/**
 * Check online status
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Listen for online/offline status changes
 */
export const onConnectivityChange = (callback) => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
};
