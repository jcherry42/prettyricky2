import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

const STORAGE_KEY = 'sc_v1_settings';

const DEFAULT_SETTINGS = {
  defaultTargetLanguage: 'es',
  sportMode: false,
  ecoMode: false,
  pttDirection: 'en_to_target',
  printers: [] as any[],
  activePrinterId: null as string | null,
  ambientLightingEnabled: true,
  ambientLightingIntensity: 'medium',
  soundProfile: 'merica',
  salesRepName: '',
  dealershipName: '',
  dealershipAddress: '',
};

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Keep a ref that always points to the latest settings.
  // All callbacks read from this ref so they don't need to list
  // `settings` as a dependency — eliminating cascading re-renders
  // whenever any setting changes.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      const stored = await loadJson(STORAGE_KEY, null);
      if (stored && typeof stored === 'object') {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        setSettings(merged);
        settingsRef.current = merged;
      }
      setLoaded(true);
    })();
  }, []);

  // persist is stable: setSettings from useState never changes
  const persist = useCallback(async (next) => {
    setSettings(next);
    settingsRef.current = next;
    await saveJson(STORAGE_KEY, next);
  }, []);

  const setDefaultTargetLanguage = useCallback(async (lang) => {
    await persist({ ...settingsRef.current, defaultTargetLanguage: lang });
  }, [persist]);

  const setSportMode = useCallback(async (sportMode) => {
    await persist({ ...settingsRef.current, sportMode: !!sportMode });
  }, [persist]);

  const setEcoMode = useCallback(async (ecoMode) => {
    await persist({ ...settingsRef.current, ecoMode: !!ecoMode });
  }, [persist]);

  const setPttDirection = useCallback(async (pttDirection) => {
    await persist({ ...settingsRef.current, pttDirection });
  }, [persist]);

  const toggleSportMode = useCallback(async () => {
    await persist({ ...settingsRef.current, sportMode: !settingsRef.current.sportMode });
  }, [persist]);

  const upsertPrinter = useCallback(async ({ id, name, ip }) => {
    const s = settingsRef.current;
    const clean = {
      id: id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: String(name || '').trim() || 'Printer',
      ip: String(ip || '').trim(),
    };
    const printers = s.printers || [];
    const exists = printers.some((p) => p.id === clean.id);
    const nextPrinters = exists
      ? printers.map((p) => (p.id === clean.id ? { ...p, ...clean } : p))
      : [clean, ...printers];
    await persist({
      ...s,
      printers: nextPrinters,
      activePrinterId: s.activePrinterId || clean.id,
    });
    return clean.id;
  }, [persist]);

  const removePrinter = useCallback(async (id) => {
    const s = settingsRef.current;
    const nextPrinters = (s.printers || []).filter((p) => p.id !== id);
    const nextActive = s.activePrinterId === id ? (nextPrinters[0]?.id || null) : s.activePrinterId;
    await persist({ ...s, printers: nextPrinters, activePrinterId: nextActive });
  }, [persist]);

  const setActivePrinter = useCallback(async (id) => {
    await persist({ ...settingsRef.current, activePrinterId: id });
  }, [persist]);

  const setAmbientLightingEnabled = useCallback(async (enabled) => {
    await persist({ ...settingsRef.current, ambientLightingEnabled: !!enabled });
  }, [persist]);

  const setAmbientLightingIntensity = useCallback(async (intensity) => {
    const valid = ['subtle', 'medium', 'vivid'];
    await persist({ ...settingsRef.current, ambientLightingIntensity: valid.includes(intensity) ? intensity : 'medium' });
  }, [persist]);

  const toggleAmbientLighting = useCallback(async () => {
    await persist({ ...settingsRef.current, ambientLightingEnabled: !settingsRef.current.ambientLightingEnabled });
  }, [persist]);

  const setSoundProfile = useCallback(async (profile: string) => {
    const valid = ['merica', 'euro', 'jdm'];
    await persist({ ...settingsRef.current, soundProfile: valid.includes(profile) ? profile : 'merica' });
  }, [persist]);

  const setSalesRepName = useCallback(async (name: string) => {
    await persist({ ...settingsRef.current, salesRepName: name });
  }, [persist]);

  const setDealershipName = useCallback(async (name: string) => {
    await persist({ ...settingsRef.current, dealershipName: name });
  }, [persist]);

  const setDealershipAddress = useCallback(async (address: string) => {
    await persist({ ...settingsRef.current, dealershipAddress: address });
  }, [persist]);

  const activePrinter = useMemo(() => {
    const printers = settings.printers || [];
    if (!settings.activePrinterId) return printers[0] || null;
    return printers.find((p) => p.id === settings.activePrinterId) || printers[0] || null;
  }, [settings.printers, settings.activePrinterId]);

  // All action callbacks are now stable (only `persist` in deps, which never changes).
  // `value` will still change when `settings` changes — correct — but callback
  // reference churn no longer triggers spurious consumer re-renders.
  const value = useMemo(
    () => ({
      loaded,
      settings,
      activePrinter,
      setDefaultTargetLanguage,
      setSportMode,
      toggleSportMode,
      setEcoMode,
      setPttDirection,
      upsertPrinter,
      removePrinter,
      setActivePrinter,
      setAmbientLightingEnabled,
      setAmbientLightingIntensity,
      toggleAmbientLighting,
      setSoundProfile,
      setSalesRepName,
      setDealershipName,
      setDealershipAddress,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, settings, activePrinter]
    // Action callbacks are stable via settingsRef pattern; omitting them
    // from deps is intentional and safe.
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
