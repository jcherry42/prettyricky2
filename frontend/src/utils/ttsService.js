/**
 * Enterprise-Grade Text-to-Speech Service
 * Uses OpenAI TTS for smooth, lifelike voices
 * With intelligent caching and fallback support
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                    import.meta.env.REACT_APP_BACKEND_URL || 
                    '';

// Language to optimal voice mapping
const VOICE_BY_LANGUAGE = {
  en: 'nova',      // Energetic, clear American English
  es: 'coral',     // Warm, friendly - perfect for Spanish
  fr: 'shimmer',   // Bright, expressive - suits French
  ja: 'alloy',     // Neutral, balanced - clean for Japanese
  ko: 'echo',      // Smooth, calm - works well for Korean
};

// In-memory audio cache for instant playback
const audioCache = new Map();
const MAX_CACHE_SIZE = 50;

// Audio context for smooth playback
let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Generate and play speech using OpenAI TTS
 * @param {string} text - Text to speak
 * @param {string} language - Language code (en, es, fr, ja, ko)
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, duration?: number, error?: string}>}
 */
export const speakText = async (text, language = 'en', options = {}) => {
  const {
    voice = VOICE_BY_LANGUAGE[language] || 'nova',
    speed = 1.0,
    useHD = true,
    onStart = () => {},
    onEnd = () => {},
    onError = () => {},
  } = options;

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'No text provided' };
  }

  // Limit text length
  const trimmedText = text.slice(0, 4096);
  
  // Create cache key
  const cacheKey = `${voice}:${speed}:${trimmedText.slice(0, 200)}`;
  
  try {
    onStart();
    
    let audioData;
    
    // Check local cache first
    if (audioCache.has(cacheKey)) {
      console.log('[TTS] Cache hit - instant playback');
      audioData = audioCache.get(cacheKey);
    } else {
      console.log(`[TTS] Generating speech: ${language}, voice=${voice}, ${trimmedText.length} chars`);
      
      const response = await fetch(`${BACKEND_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmedText,
          voice,
          model: useHD ? 'tts-1-hd' : 'tts-1',
          speed,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `TTS failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.audio_base64) {
        throw new Error('No audio data received');
      }
      
      // Convert base64 to audio buffer
      const binaryString = atob(data.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioData = bytes.buffer;
      
      // Cache for future use
      if (audioCache.size >= MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, audioData);
      
      console.log(`[TTS] Generated successfully, cached=${data.cached}`);
    }
    
    // Play the audio using Web Audio API for smooth playback
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (required on some browsers)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const audioBuffer = await ctx.decodeAudioData(audioData.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    return new Promise((resolve) => {
      source.onended = () => {
        onEnd();
        resolve({ success: true, duration: audioBuffer.duration });
      };
      
      source.start(0);
    });
    
  } catch (error) {
    console.error('[TTS] Error:', error);
    onError(error);
    
    // Fallback to browser speech synthesis
    console.log('[TTS] Falling back to browser speech synthesis');
    return fallbackSpeak(text, language, { onStart, onEnd, onError });
  }
};

/**
 * Fallback browser speech synthesis (if OpenAI TTS fails)
 */
const fallbackSpeak = (text, language, { onStart, onEnd, onError }) => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      onError(new Error('Speech synthesis not supported'));
      resolve({ success: false, error: 'Not supported' });
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Language mapping
    const langMap = {
      en: 'en-US',
      es: 'es-US',
      fr: 'fr-FR',
      ja: 'ja-JP',
      ko: 'ko-KR',
    };
    
    utterance.lang = langMap[language] || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    // Find best available voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(language) && 
      (v.name.includes('Natural') || v.name.includes('Premium') || v.localService)
    ) || voices.find(v => v.lang.startsWith(language));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = onStart;
    utterance.onend = () => {
      onEnd();
      resolve({ success: true, fallback: true });
    };
    utterance.onerror = (e) => {
      onError(e);
      resolve({ success: false, error: e.message, fallback: true });
    };

    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Stop any currently playing speech
 */
export const stopSpeech = () => {
  // Stop Web Audio
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  // Stop browser speech synthesis
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Preload audio for a phrase (for instant playback later)
 */
export const preloadSpeech = async (text, language = 'en') => {
  const voice = VOICE_BY_LANGUAGE[language] || 'nova';
  const cacheKey = `${voice}:1.0:${text.slice(0, 200)}`;
  
  if (audioCache.has(cacheKey)) {
    return; // Already cached
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 4096),
        voice,
        model: 'tts-1-hd',
        speed: 1.0,
        language,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audio_base64) {
        const binaryString = atob(data.audio_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        if (audioCache.size >= MAX_CACHE_SIZE) {
          const firstKey = audioCache.keys().next().value;
          audioCache.delete(firstKey);
        }
        audioCache.set(cacheKey, bytes.buffer);
        console.log('[TTS] Preloaded:', text.slice(0, 30) + '...');
      }
    }
  } catch (error) {
    console.warn('[TTS] Preload failed:', error);
  }
};

/**
 * Clear the audio cache
 */
export const clearCache = () => {
  audioCache.clear();
};

export default {
  speakText,
  stopSpeech,
  preloadSpeech,
  clearCache,
  VOICE_BY_LANGUAGE,
};
