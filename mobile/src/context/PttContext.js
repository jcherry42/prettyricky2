import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av'; // TODO: migrate to expo-audio to remove deprecation warnings
import { voiceTranslateUpload } from '../lib/voiceTranslate';
import { ttsSpeak } from '../lib/tts';
import { useAppSettings } from './AppSettingsContext';

const PttContext = createContext(null);

const MAX_RECORDING_MS = 15000; // 15 second maximum

export function PttProvider({ children }) {
  const { settings, setPttDirection } = useAppSettings();

  const targetLang = settings.defaultTargetLanguage || 'es';
  const direction = settings.pttDirection || 'en_to_target'; // 'en_to_target' | 'target_to_en'

  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'uploading' | 'translating' | 'speaking' | 'done' | 'error'
  const [error, setError] = useState(null);
  const [result, setResult] = useState({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });

  const recordingRef = useRef(null);
  const playbackRef = useRef(null);
  const timeoutRef = useRef(null);
  const pendingStopRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (playbackRef.current) {
        playbackRef.current.unloadAsync().catch(() => {});
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      pendingStopRef.current = false;
      setStatus('recording');

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission not granted');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;

      if (pendingStopRef.current) {
        // User already released the button while we were spinning up
        await recording.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        return;
      }

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        if (recordingRef.current) {
          stopRecording();
        }
      }, MAX_RECORDING_MS);
    } catch (e) {
      setStatus('error');
      setError(String(e?.message || e));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    pendingStopRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const rec = recordingRef.current;
    if (!rec) return;

    try {
      setStatus('uploading');
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      setStatus('uploading');
      if (!uri) throw new Error('No recording URI');

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
      setStatus('error');
      setError(String(e?.message || e));
    }
  }, [direction, targetLang]);

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
      if (!b64) throw new Error('TTS returned empty audio');

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
    setStatus('idle');
    setError(null);
    setResult({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });
  }, [targetLang]);

  const value = useMemo(
    () => ({
      direction,
      targetLang,
      status,
      error,
      result,
      startRecording,
      stopRecording,
      toggleDirection,
      speakTranslated,
      reset,
    }),
    [direction, targetLang, status, error, result, startRecording, stopRecording, toggleDirection, speakTranslated, reset]
  );

  return <PttContext.Provider value={value}>{children}</PttContext.Provider>;
}

export function usePtt() {
  const ctx = useContext(PttContext);
  if (!ctx) throw new Error('usePtt must be used within PttProvider');
  return ctx;
}
