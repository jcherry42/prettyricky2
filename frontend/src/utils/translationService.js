/**
 * Enterprise Translation Service
 * Implements caching, quality indicators, fallback mechanisms, and language detection
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

// Translation cache for performance
class TranslationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getKey(text, sourceLang, targetLang) {
    return `${sourceLang}:${targetLang}:${text.substring(0, 100)}`;
  }

  get(text, sourceLang, targetLang) {
    const key = this.getKey(text, sourceLang, targetLang);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      return cached.translation;
    }
    
    return null;
  }

  set(text, sourceLang, targetLang, translation) {
    const key = this.getKey(text, sourceLang, targetLang);
    
    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      translation,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const translationCache = new TranslationCache();

// Supported languages - Spanish, French, Korean only
export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇲🇽' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
];

export const getLanguageByCode = (code) => {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code) || SUPPORTED_LANGUAGES[0];
};

// Translation with quality metrics and caching
export const translateText = async (text, sourceLang = 'auto', targetLang = 'es') => {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Empty text' };
  }

  // Check cache first
  if (sourceLang !== 'auto') {
    const cached = translationCache.get(text, sourceLang, targetLang);
    if (cached) {
      return {
        success: true,
        translatedText: cached,
        cached: true,
        confidence: 1.0
      };
    }
  }

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BACKEND_URL}/api/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        text, 
        source_lang: sourceLang, 
        target_lang: targetLang 
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Translation failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.translated_text) {
      throw new Error('Empty translation received');
    }

    // Cache the result
    const detectedLang = data.detected_lang || sourceLang;
    if (detectedLang !== 'auto') {
      translationCache.set(text, detectedLang, targetLang, data.translated_text);
    }

    return {
      success: true,
      translatedText: data.translated_text,
      detectedLanguage: data.detected_lang,
      confidence: data.confidence || 0.95,
      latency,
      cached: false
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      originalText: text
    };
  }
};

// Batch translation for multiple texts
export const translateBatch = async (texts, sourceLang = 'auto', targetLang = 'es') => {
  const results = await Promise.all(
    texts.map(text => translateText(text, sourceLang, targetLang))
  );
  
  return results;
};

// Clear translation cache
export const clearTranslationCache = () => {
  translationCache.clear();
};

// Get cache statistics
export const getCacheStats = () => {
  return {
    size: translationCache.cache.size,
    maxSize: translationCache.maxSize
  };
};

export default {
  translateText,
  translateBatch,
  clearTranslationCache,
  getCacheStats,
  SUPPORTED_LANGUAGES,
  getLanguageByCode
};
