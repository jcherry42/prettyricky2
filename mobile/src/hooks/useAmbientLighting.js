/**
 * Ambient Lighting Hook
 * Manages 64-color ambient lighting system
 */

import { useEffect, useState, useCallback } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { designoColors, ambientIntensity } from '../theme/designo';

const CYCLE_DURATION = 30000; // 30 seconds for full spectrum
const COLOR_COUNT = 64;
const INTERVAL = CYCLE_DURATION / COLOR_COUNT; // ~468ms per color

export function useAmbientLighting() {
  const { settings } = useAppSettings();
  const [colorIndex, setColorIndex] = useState(0);

  const isEnabled = settings?.ambientLightingEnabled ?? true;
  const intensity = settings?.ambientLightingIntensity || 'medium';

  const currentColor = designoColors.ambient[colorIndex];
  const opacity = ambientIntensity[intensity] || ambientIntensity.medium;

  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % COLOR_COUNT);
    }, INTERVAL);

    return () => clearInterval(interval);
  }, [isEnabled]);

  return {
    isEnabled,
    currentColor,
    opacity,
    intensity,
  };
}
