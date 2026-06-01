/**
 * AmbientLightingContext
 *
 * Single source of truth for the ambient color cycle.
 * ONE setInterval for the entire app (vs. one per component that previously
 * called useAmbientLighting). Components that need the live color subscribe
 * to this context; components that just need a static glow effect (GlassCard,
 * CustomerCard) do NOT subscribe — they stay fully memoized.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { designoColors, ambientIntensity } from '../theme/designo';
import { useAppSettings } from './AppSettingsContext';

const CYCLE_DURATION = 30000;
const COLOR_COUNT = 64;
const INTERVAL = CYCLE_DURATION / COLOR_COUNT; // ~468 ms

const AmbientLightingContext = createContext({
  isEnabled: false,
  currentColor: null,
  opacity: 0.08,
  intensity: 'medium',
});

export function AmbientLightingProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const isEnabled = (settings?.ambientLightingEnabled ?? true) && !settings?.ecoMode;
  const intensity: string = settings?.ambientLightingIntensity || 'medium';
  const opacity = (ambientIntensity as Record<string, number>)[intensity] || ambientIntensity.medium;

  const [colorIndex, setColorIndex] = useState(0);

  // ONE interval for the whole app
  useEffect(() => {
    if (!isEnabled) return;
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % COLOR_COUNT);
    }, INTERVAL);
    return () => clearInterval(interval);
  }, [isEnabled]);

  const currentColor = isEnabled ? (designoColors.ambient[colorIndex] || null) : null;

  const value = useMemo(
    () => ({ isEnabled, currentColor, opacity, intensity }),
    [isEnabled, currentColor, opacity, intensity]
  );

  return (
    <AmbientLightingContext.Provider value={value}>
      {children}
    </AmbientLightingContext.Provider>
  );
}

export function useAmbientLightingContext() {
  return useContext(AmbientLightingContext);
}
