/**
 * On-Device Speech Recognition — Supercharg'd
 * Provides on-device STT using @jamsch/expo-speech-recognition (wraps
 * iOS SFSpeechRecognizer / Android SpeechRecognizer).
 *
 * Falls back to Web Speech API when running on web.
 *
 * Usage:
 *   import { onDeviceTranscribe, isOnDeviceSttAvailable } from './onDeviceStt';
 *
 *   if (await isOnDeviceSttAvailable()) {
 *     const result = await onDeviceTranscribe('en');
 *     // result = { transcript: '...', confidence: 0.95, onDevice: true }
 *   }
 */

import { Platform } from 'react-native';

// Automotive vocabulary hints for recognition engines
const AUTOMOTIVE_HINTS = [
  'VIN', 'MSRP', 'APR', 'OTD', 'trade-in', 'test drive',
  'financing', 'lease', 'down payment', 'monthly payment',
  'credit score', 'pre-approval', 'certified pre-owned', 'CPO',
  'warranty', 'GAP insurance', 'sticker price', 'invoice',
  'rebate', 'incentive', 'dealer fee',
  'SUV', 'sedan', 'truck', 'hybrid', 'EV', 'electric vehicle',
  'all-wheel drive', 'AWD', 'horsepower', 'torque',
  'Mercedes', 'BMW', 'Audi', 'Lexus', 'Tesla', 'Toyota',
  'Honda', 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan',
  'Cadillac', 'Lincoln', 'Genesis', 'Acura', 'Volvo',
];

// BCP-47 language mapping
const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ko: 'ko-KR',
  ja: 'ja-JP',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  zh: 'zh-CN',
  ru: 'ru-RU',
};

export interface OnDeviceResult {
  transcript: string;
  confidence: number;
  onDevice: true;
  language: string;
}

// Lazy-loaded reference to the native module (avoids crash if not installed)
let _nativeModule: typeof import('@jamsch/expo-speech-recognition') | null = null;
let _nativeModuleChecked = false;

async function getNativeModule() {
  if (_nativeModuleChecked) return _nativeModule;
  _nativeModuleChecked = true;
  try {
    _nativeModule = await import('@jamsch/expo-speech-recognition');
  } catch {
    _nativeModule = null;
  }
  return _nativeModule;
}

/**
 * Check if on-device speech recognition is available.
 */
export async function isOnDeviceSttAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
      );
    }

    const mod = await getNativeModule();
    if (!mod) return false;

    // Check native permissions status (doesn't prompt)
    const status = await mod.ExpoSpeechRecognitionModule.getPermissionsAsync();
    // Available even if not yet granted — we'll request when needed
    return status !== null;
  } catch {
    return false;
  }
}

/**
 * Perform on-device speech-to-text transcription.
 *
 * @param language - Short code ('en') or BCP-47 ('en-US')
 * @param timeoutMs - Maximum listening time (default 10 000 ms)
 */
export async function onDeviceTranscribe(
  language: string = 'en',
  timeoutMs: number = 10000,
): Promise<OnDeviceResult | null> {
  const fullLang = LANG_MAP[language] || language;

  if (Platform.OS === 'web') {
    return _webSpeechRecognition(fullLang, timeoutMs);
  }

  return _nativeSpeechRecognition(fullLang, timeoutMs);
}

// ─── Web Speech API ─────────────────────────────────────────────────

function _webSpeechRecognition(
  lang: string,
  timeoutMs: number,
): Promise<OnDeviceResult | null> {
  return new Promise((resolve) => {
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        resolve(null);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      let resolved = false;
      const done = (val: OnDeviceResult | null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(val);
      };

      const timer = setTimeout(() => {
        recognition.stop();
      }, timeoutMs);

      recognition.onresult = (event: any) => {
        const r = event.results?.[0]?.[0];
        done(
          r
            ? { transcript: r.transcript, confidence: r.confidence || 0.8, onDevice: true, language: lang }
            : null,
        );
      };
      recognition.onerror = () => done(null);
      recognition.onend = () => done(null);

      recognition.start();
    } catch {
      resolve(null);
    }
  });
}

// ─── Native Speech Recognition (@jamsch/expo-speech-recognition) ─────

async function _nativeSpeechRecognition(
  lang: string,
  timeoutMs: number,
): Promise<OnDeviceResult | null> {
  const mod = await getNativeModule();
  if (!mod) return null;

  const { ExpoSpeechRecognitionModule, addSpeechRecognitionListener } = mod;

  // Request microphone + speech recognition permissions
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) return null;

  return new Promise<OnDeviceResult | null>((resolve) => {
    let resolved = false;
    let bestTranscript = '';
    let bestConfidence = 0;
    const subs: { remove(): void }[] = [];

    const done = (val: OnDeviceResult | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      subs.forEach((s) => s.remove());
      resolve(val);
    };

    // Safety timeout — always resolve
    const timer = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
      // Give a short grace period for the final 'result' event
      setTimeout(() => {
        if (bestTranscript) {
          done({ transcript: bestTranscript, confidence: bestConfidence, onDevice: true, language: lang });
        } else {
          done(null);
        }
      }, 300);
    }, timeoutMs);

    // Accumulate results
    subs.push(
      addSpeechRecognitionListener('result', (event: any) => {
        const first = event.results?.[0];
        if (first) {
          bestTranscript = first.transcript || bestTranscript;
          bestConfidence = first.confidence ?? bestConfidence;
          if (first.isFinal) {
            done({
              transcript: bestTranscript,
              confidence: bestConfidence || 0.85,
              onDevice: true,
              language: lang,
            });
          }
        }
      }),
    );

    subs.push(
      addSpeechRecognitionListener('error', () => {
        done(bestTranscript ? { transcript: bestTranscript, confidence: bestConfidence, onDevice: true, language: lang } : null);
      }),
    );

    subs.push(
      addSpeechRecognitionListener('end', () => {
        // Recognition ended (could be natural end or after stop())
        done(
          bestTranscript
            ? { transcript: bestTranscript, confidence: bestConfidence || 0.85, onDevice: true, language: lang }
            : null,
        );
      }),
    );

    // Start recognition
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      addsPunctuation: true,
      contextualStrings: AUTOMOTIVE_HINTS,
      ...(Platform.OS === 'ios'
        ? {
            iosCategory: {
              category: 'playAndRecord',
              categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
              mode: 'default',
            },
          }
        : {}),
    });
  });
}

/**
 * Get automotive-optimized hints for speech recognition.
 */
export function getAutomotiveHints(): string[] {
  return [...AUTOMOTIVE_HINTS];
}

/**
 * Noise suppression configuration for native audio sessions.
 */
export const NOISE_SUPPRESSION_CONFIG = {
  ios: {
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  android: {
    allowsRecordingIOS: false,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
};
