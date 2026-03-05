/**
 * useCameraLifecycle — World-class camera lifecycle management (TypeScript).
 *
 * TypeScript migration template — demonstrates typing patterns for hooks.
 *
 * Patterns applied (matching PTT pipeline quality):
 *  1. AppState-aware — auto-pauses camera when app backgrounds
 *  2. Cleanup on unmount — no leaked refs, timers, or subscriptions
 *  3. Permission denial handling — detects permanent denial
 *  4. AbortController factory — every API call gets a timeout-aware abort signal
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';

const DEFAULT_TIMEOUT_MS = 30_000;

interface AbortableResult {
  signal: AbortSignal;
  cleanup: () => void;
}

interface CameraLifecycleReturn {
  /** Whether the camera should be rendering (false when backgrounded) */
  isActive: boolean;
  /** Create an AbortController with timeout — auto-cleaned on unmount */
  abortableTimeout: (timeoutMs?: number) => AbortableResult;
  /** Show "Go to Settings" for permanent permission denial */
  showSettingsAlert: () => void;
}

export function useCameraLifecycle(cameraOpen = false): CameraLifecycleReturn {
  const [isActive, setIsActive] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const abortControllers = useRef<Set<AbortController>>(new Set());

  // Track AppState — pause camera when backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const isNowActive = nextState === 'active';
      appState.current = nextState;

      if (cameraOpen) {
        if (wasActive && !isNowActive) setIsActive(false);
        else if (!wasActive && isNowActive) setIsActive(true);
      }
    });
    return () => sub.remove();
  }, [cameraOpen]);

  // Abort all pending requests on unmount
  useEffect(() => {
    return () => {
      for (const ac of abortControllers.current) ac.abort();
      abortControllers.current.clear();
    };
  }, []);

  const abortableTimeout = useCallback((timeoutMs = DEFAULT_TIMEOUT_MS): AbortableResult => {
    const controller = new AbortController();
    abortControllers.current.add(controller);

    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      abortControllers.current.delete(controller);
    };
    controller.signal.addEventListener('abort', cleanup, { once: true });

    return { signal: controller.signal, cleanup };
  }, []);

  const showSettingsAlert = useCallback(() => {
    Alert.alert(
      'Camera Access Required',
      Platform.OS === 'ios'
        ? "Camera access was denied. Go to Settings > Privacy > Camera to enable it for Supercharg'd."
        : 'Camera permission is required. Please enable it in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings();
          },
        },
      ]
    );
  }, []);

  return {
    isActive: isActive && cameraOpen,
    abortableTimeout,
    showSettingsAlert,
  };
}
