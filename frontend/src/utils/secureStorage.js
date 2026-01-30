/**
 * FEDERAL-GRADE: Encrypted localStorage utility
 * Uses Web Crypto API for AES-GCM encryption
 */

const ENCRYPTION_KEY_NAME = 'app_encryption_key';
const ALGORITHM = 'AES-GCM';

// Generate or retrieve encryption key
async function getEncryptionKey() {
  try {
    // Check if key exists in sessionStorage (per-session key)
    const storedKey = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
    
    if (storedKey) {
      const keyData = JSON.parse(storedKey);
      return await crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: ALGORITHM, length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: ALGORITHM, length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Store key in sessionStorage (cleared on browser close)
    const exportedKey = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
    
    return key;
  } catch {
    throw new Error('Failed to initialize encryption');
  }
}

// Encrypt data
async function encryptData(data) {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM IV
    
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encodedData
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch {
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data
async function decryptData(encryptedData) {
  try {
    const key = await getEncryptionKey();
    
    // Convert from base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    
    const decodedData = new TextDecoder().decode(decrypted);
    return JSON.parse(decodedData);
  } catch {
    // Return null if decryption fails (corrupted data)
    return null;
  }
}

// Secure localStorage wrapper
export const secureStorage = {
  async setItem(key, value) {
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(`secure_${key}`, encrypted);
      return true;
    } catch {
      return false;
    }
  },
  
  async getItem(key) {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`);
      if (!encrypted) return null;
      
      return await decryptData(encrypted);
    } catch {
      return null;
    }
  },
  
  removeItem(key) {
    localStorage.removeItem(`secure_${key}`);
  },
  
  clear() {
    // Only clear secure items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// For non-sensitive data, use regular localStorage
export const unsecureStorage = {
  setItem: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  getItem: (key) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  removeItem: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear()
};