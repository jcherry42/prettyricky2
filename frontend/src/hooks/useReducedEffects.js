import { useMemo } from 'react';

// Native-feel strategy:
// - Prefer smoothness on older devices.
// - Use a lightweight heuristic (not a benchmark) to decide whether to reduce expensive effects.
//
// Signals used:
// - prefers-reduced-motion
// - deviceMemory (Chrome/Android)
// - hardwareConcurrency
// - iOS detection (no deviceMemory) + small cores
export default function useReducedEffects() {
  return useMemo(() => {
    try {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (ua.includes('Mac') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

      const deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;

      // Heuristic thresholds:
      // - low memory devices (<= 4GB) => reduce
      // - low core devices (<= 4 cores) => reduce
      // - iOS + <= 4 cores => reduce
      const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;
      const lowCores = typeof cores === 'number' && cores <= 4;
      const iosLowCores = isIOS && typeof cores === 'number' && cores <= 4;

      return Boolean(prefersReducedMotion || lowMemory || lowCores || iosLowCores);
    } catch {
      return false;
    }
  }, []);
}
