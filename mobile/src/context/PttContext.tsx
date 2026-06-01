import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  RecordingPresets,
} from 'expo-audio';
import { Platform } from 'react-native';
import { voiceTranslateUpload } from '../lib/voiceTranslate';
import { ttsSpeak } from '../lib/tts';
import { useAppSettings } from './AppSettingsContext';

interface PttResult {
  transcript: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
}

interface PttContextValue {
  direction: string;
  targetLang: string;
  status: string;
  error: string | null;
  result: PttResult;
  elapsedMs: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleDirection: () => Promise<void>;
  speakTranslated: () => Promise<void>;
  reset: () => void;
}

const PttContext = createContext<PttContextValue | null>(null);

const MAX_RECORDING_MS = 15000; // 15-second hard cap

// Recording options for Whisper-compatible m4a output (mono, 44.1kHz).
// Uses expo-audio RecordingPresets.HIGH_QUALITY as base, overriding to mono
// for optimal speech recognition file sizes.
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
  sampleRate: 44100,
  bitRate: 128000,
};

// Determine the correct MIME type and file extension per platform
function getAudioMeta() {
  if (Platform.OS === 'web') {
    return { ext: 'webm', mime: 'audio/webm' };
  }
  return { ext: 'm4a', mime: 'audio/mp4' };
}

export function PttProvider({ children }: { children: React.ReactNode }) {
  const { settings, setPttDirection } = useAppSettings();

  const targetLang = settings.defaultTargetLanguage;
  const direction = settings.pttDirection || 'en_to_target';

  // States: 'idle' | 'requesting' | 'recording' | 'uploading' | 'translating' | 'speaking' | 'done' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PttResult>({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });
  const [elapsedMs, setElapsedMs] = useState(0);

  // expo-audio recorder hook — reusable across multiple recordings
  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const playbackRef = useRef<any | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);

  // stopRecording is defined after startRecording; we use this ref so the
  // auto-stop timeout and the startRecording body can always call the
  // latest version without creating a circular useCallback dependency.
  const stopFnRef = useRef<(() => Promise<void>) | null>(null);

  // --- Elapsed timer ---
  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - (timerStartRef.current || Date.now()));
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
      if (playbackRef.current) {
        try { playbackRef.current.remove(); } catch {}
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    // Only start from a clean state
    if (status !== 'idle' && status !== 'done' && status !== 'error') return;

    setError(null);
    setResult({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });
    pendingStopRef.current = false;
    setStatus('requesting');

    try {
      // --- Request microphone permission ---
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setStatus('error');
        setError('Microphone permission denied. Go to Settings \u2192 Supercharg\'d \u2192 Microphone to enable it.');
        return;
      }

      // Set audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare and start recording
      await recorder.prepareToRecordAsync();

      // --- RACE CONDITION FIX ---
      // If the user tapped "stop" while we were requesting permission or
      // initializing the recorder, abort cleanly instead of starting.
      if (pendingStopRef.current) {
        await recorder.stop().catch(() => {});
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        setStatus('idle');
        return;
      }

      // Start recording
      recorder.record();

      // Recording is live — update state and start elapsed timer
      setStatus('recording');
      startTimer();

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopFnRef.current?.();
      }, MAX_RECORDING_MS);

    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('[PTT] startRecording error:', msg);
      setStatus('error');
      if (msg.includes('already recording') || msg.includes('prepare')) {
        setError('Microphone is busy. Please wait a moment and try again.');
      } else if (msg.includes('not found') || msg.includes('no audio input')) {
        setError('No microphone found. Please check your device audio settings.');
      } else {
        setError(`Could not start recording: ${msg}`);
      }
    }
  }, [status, targetLang, startTimer, recorder]);

  const stopRecording = useCallback(async () => {
    pendingStopRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopTimer();

    if (!recorder.isRecording) {
      // Recording not yet started (still in 'requesting' state).
      // pendingStopRef is set; startRecording will detect it and abort.
      return;
    }

    try {
      setStatus('uploading');
      await recorder.stop();
      const uri = recorder.uri;

      // Release microphone immediately
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => {});

      if (!uri) throw new Error('Recording produced no audio file');

      // Determine the correct audio metadata for the upload
      const { ext, mime } = getAudioMeta();
      const sourceLang = direction === 'en_to_target' ? 'en' : targetLang;
      const outTarget = direction === 'en_to_target' ? targetLang : 'en';

      setStatus('translating');
      const out = await voiceTranslateUpload({
        uri,
        sourceLang,
        targetLang: outTarget,
        mimeType: mime,
        fileExtension: ext,
      });

      setResult(out);
      setStatus('done');
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('[PTT] stopRecording error:', msg);
      setStatus('error');
      if (msg.includes('Backend URL')) {
        setError('Backend not connected. Check your server URL in Command Center \u2192 Settings.');
      } else if (msg.includes('timed out') || msg.includes('Timeout') || msg.includes('TIMEOUT')) {
        setError('Translation timed out. Please try again with a shorter phrase.');
      } else if (msg.includes('Network request failed') || msg.includes('fetch')) {
        setError('Network error. Check your internet connection and try again.');
      } else {
        setError(msg);
      }
    }
  }, [direction, targetLang, stopTimer, recorder]);

  // Keep stopFnRef current on every render (no deps needed for this)
  stopFnRef.current = stopRecording;

  const speakTranslated = useCallback(async () => {
    try {
      if (!result?.translated_text) return;
      setError(null);
      setStatus('speaking');

      const res = await ttsSpeak({
        text: result.translated_text,
        language: result.target_lang || 'en',
        voice: 'auto',
      });

      const format = res?.format || 'mp3';
      const b64 = res?.audio_base64 || '';
      const mime = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
      if (!b64) throw new Error('TTS returned no audio');

      const uri = `data:${mime};base64,${b64}`;

      if (playbackRef.current) {
        try { playbackRef.current.remove(); } catch {}
        playbackRef.current = null;
      }

      const player = createAudioPlayer({ uri });
      playbackRef.current = player;
      player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) {
          setStatus('done');
        }
      });
      player.play();
    } catch (e: any) {
      setStatus('error');
      setError(String(e?.message || e));
    }
  }, [result]);

  const toggleDirection = useCallback(async () => {
    const next = direction === 'en_to_target' ? 'target_to_en' : 'en_to_target';
    await setPttDirection(next);
  }, [direction, setPttDirection]);

  const reset = useCallback(() => {
    stopTimer();
    setStatus('idle');
    setError(null);
    setElapsedMs(0);
    setResult({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });
  }, [targetLang, stopTimer]);

  const value = useMemo(
    () => ({
      direction,
      targetLang,
      status,
      error,
      result,
      elapsedMs,
      startRecording,
      stopRecording,
      toggleDirection,
      speakTranslated,
      reset,
    }),
    [direction, targetLang, status, error, result, elapsedMs, startRecording, stopRecording, toggleDirection, speakTranslated, reset]
  );

  return <PttContext.Provider value={value}>{children}</PttContext.Provider>;
}

export function usePtt() {
  const ctx = useContext(PttContext);
  if (!ctx) throw new Error('usePtt must be used within PttProvider');
  return ctx;
}
