/**
 * useCameraLifecycle — World-class camera lifecycle management.
 *
 * Mirrors the PTT pipeline's robustness patterns:
 *  1. AppState-aware — auto-pauses camera when app backgrounds (saves battery, prevents ANR)
 *  2. Cleanup on unmount — no leaked refs, timers, or subscriptions
 *  3. Permission denial handling — detects permanent denial and provides Settings guidance
 *  4. AbortController factory — every API call gets a timeout-aware abort signal
 *
 * Usage:
 *   const { isActive, abortableTimeout, showSettingsAlert } = useCameraLifecycle(cameraOpen);
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

const DEFAULT_TIMEOUT_MS = 30000;

export function useCameraLifecycle(cameraOpen = false) {
  const [isActive, setIsActive] = useState(true);
  const appState = useRef(AppState.currentState);
  const abortControllers = useRef(new Set());

  // ── Track AppState — pause camera when backgrounded ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasActive = appState.current === 'active';
      const isNowActive = nextState === 'active';
      appState.current = nextState;

      if (cameraOpen) {
        if (wasActive && !isNowActive) {
          // Backgrounding — pause camera to save battery
          setIsActive(false);
        } else if (!wasActive && isNowActive) {
          // Foregrounding — resume camera
          setIsActive(true);
        }
      }
    });

    return () => sub.remove();
  }, [cameraOpen]);

  // ── Abort all pending requests on unmount ──
  useEffect(() => {
    return () => {
      for (const ac of abortControllers.current) {
        ac.abort();
      }
      abortControllers.current.clear();
    };
  }, []);

  /**
   * Create an AbortController with a hard timeout.
   * Automatically cleaned up on unmount or when complete.
   *
   * @param {number} timeoutMs - Hard timeout in milliseconds (default 30s)
   * @returns {{ signal: AbortSignal, cleanup: () => void }}
   */
  const abortableTimeout = useCallback((timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    abortControllers.current.add(controller);

    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      abortControllers.current.delete(controller);
    };

    // Auto-cleanup if aborted externally
    controller.signal.addEventListener('abort', cleanup, { once: true });

    return { signal: controller.signal, cleanup };
  }, []);

  /**
   * Shows "Go to Settings" alert when camera permission is permanently denied.
   */
  const showSettingsAlert = useCallback(() => {
    Alert.alert(
      'Camera Access Required',
      Platform.OS === 'ios'
        ? 'Camera access was denied. Go to Settings > Privacy > Camera to enable it for Supercharg\'d.'
        : 'Camera permission is required. Please enable it in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }, []);

  return {
    /** Whether the camera should be rendering (false when backgrounded) */
    isActive: isActive && cameraOpen,
    /** Create an AbortController with timeout — auto-cleaned on unmount */
    abortableTimeout,
    /** Show "Go to Settings" for permanent permission denial */
    showSettingsAlert,
  };
}
