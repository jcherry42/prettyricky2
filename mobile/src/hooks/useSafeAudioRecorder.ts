/**
 * useSafeAudioRecorder — drop-in replacement for expo-audio's useAudioRecorder.
 *
 * Why: the upstream hook evaluates `recorder.id` (a SYNC NATIVE GETTER on an
 * Expo SharedObject) in a useEffect dependency array on EVERY render, and its
 * internal useReleasingSharedObject can release the native object early
 * (known race — expo/expo#39427, still reproducible on SDK 54). When that
 * happens the next render throws:
 *   FunctionCallException: Calling the 'get' function has failed
 *   → NativeSharedObjectNotFoundException
 *
 * This hook creates the recorder ONCE in a ref (no native getter ever runs
 * during render) and releases it only on true unmount, guarded.
 */
import { useEffect, useRef } from 'react';
import type { AudioRecorder, RecordingOptions } from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import { createRecordingOptions } from 'expo-audio/build/utils/options';

export function useSafeAudioRecorder(options: RecordingOptions): AudioRecorder {
  const recorderRef = useRef<AudioRecorder | null>(null);

  if (recorderRef.current == null) {
    recorderRef.current = new AudioModule.AudioRecorder(createRecordingOptions(options));
  }

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) return;
      try {
        if (recorder.isRecording) recorder.stop().catch(() => {});
      } catch {
        // Native object already gone — nothing to stop.
      }
      try {
        recorder.release();
      } catch {
        // Already released.
      }
    };
  }, []);

  return recorderRef.current;
}
