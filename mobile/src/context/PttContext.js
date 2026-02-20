import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { voiceTranslateUpload } from '../lib/voiceTranslate';
import { ttsSpeak } from '../lib/tts';
import { useAppSettings } from './AppSettingsContext';

const PttContext = createContext(null);

const MAX_RECORDING_MS = 15000; // 15-second hard cap

export function PttProvider({ children }) {
  const { settings, setPttDirection } = useAppSettings();

  const targetLang = settings.defaultTargetLanguage;
  const direction = settings.pttDirection || 'en_to_target';

  // States: 'idle' | 'requesting' | 'recording' | 'uploading' | 'translating' | 'speaking' | 'done' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [result, setResult] = useState({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });
  const [elapsedMs, setElapsedMs] = useState(0);

  const recordingRef = useRef(null);
  const playbackRef = useRef(null);
  const timeoutRef = useRef(null);
  const timerRef = useRef(null);
  const timerStartRef = useRef(null);
  const pendingStopRef = useRef(false);

  // stopRecording is defined after startRecording; we use this ref so the
  // auto-stop timeout and the startRecording body can always call the
  // latest version without creating a circular useCallback dependency.
  const stopFnRef = useRef(null);

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
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (playbackRef.current) {
        playbackRef.current.unloadAsync().catch(() => {});
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
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setStatus('error');
        setError('Microphone permission denied. Go to Settings → Supercharg\'d → Microphone to enable it.');
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording object
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // --- RACE CONDITION FIX ---
      // If the user tapped "stop" while we were requesting permission or
      // initializing the recorder, abort cleanly instead of starting.
      if (pendingStopRef.current) {
        await recording.stopAndUnloadAsync().catch(() => {});
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        setStatus('idle');
        return;
      }

      // Recording is live — update state and start elapsed timer
      recordingRef.current = recording;
      setStatus('recording');
      startTimer();

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopFnRef.current?.();
      }, MAX_RECORDING_MS);

    } catch (e) {
      const msg = e?.message || String(e);
      setStatus('error');
      setError(`Could not start recording: ${msg}`);
    }
  }, [status, targetLang, startTimer]);

  const stopRecording = useCallback(async () => {
    pendingStopRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopTimer();

    const rec = recordingRef.current;
    if (!rec) {
      // Recording object not yet created (still in 'requesting' state).
      // pendingStopRef is set; startRecording will detect it and abort.
      return;
    }
    recordingRef.current = null;

    try {
      setStatus('uploading');
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      // Release microphone immediately
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});

      if (!uri) throw new Error('Recording produced no audio file');

      const sourceLang = direction === 'en_to_target' ? 'en' : targetLang;
      const outTarget = direction === 'en_to_target' ? targetLang : 'en';

      setStatus('translating');
      const out = await voiceTranslateUpload({
        uri,
        sourceLang,
        targetLang: outTarget,
        mimeType: 'audio/m4a',
      });

      setResult(out);
      setStatus('done');
    } catch (e) {
      const msg = e?.message || String(e);
      setStatus('error');
      setError(msg);
    }
  }, [direction, targetLang, stopTimer]);

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
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      playbackRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          setStatus('done');
        }
      });
    } catch (e) {
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
