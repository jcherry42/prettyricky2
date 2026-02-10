import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { voiceTranslateUpload } from '../lib/voiceTranslate';
import { ttsSpeak } from '../lib/tts';
import { useAppSettings } from './AppSettingsContext';

const PttContext = createContext(null);

export function PttProvider({ children }) {
  const { settings, setPttDirection } = useAppSettings();

  const targetLang = settings.defaultTargetLanguage || 'es';
  const direction = settings.pttDirection || 'en_to_target'; // 'en_to_target' | 'target_to_en'

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [result, setResult] = useState({ transcript: '', translated_text: '', source_lang: 'en', target_lang: targetLang });

  const recordingRef = useRef(null);
  const playbackRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
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
    } catch (e) {
      setStatus('error');
      setError(String(e?.message || e));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;

    try {
      setStatus('processing');
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');

      const sourceLang = direction === 'en_to_target' ? 'en' : targetLang;
      const outTarget = direction === 'en_to_target' ? targetLang : 'en';

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

      const mime = res?.mime_type || 'audio/mpeg';
      const b64 = res?.audio_data || '';
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
