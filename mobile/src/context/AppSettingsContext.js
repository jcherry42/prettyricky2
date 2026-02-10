import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

const STORAGE_KEY = 'sc_v1_settings';

const DEFAULT_SETTINGS = {
  defaultTargetLanguage: 'es',
  sportMode: false,
  ecoMode: false,
  pttDirection: 'en_to_target', // 'en_to_target' | 'target_to_en'
  printers: [], // {id,name,ip}
  activePrinterId: null,
};

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadJson(STORAGE_KEY, null);
      if (stored && typeof stored === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setSettings(next);
    await saveJson(STORAGE_KEY, next);
  }, []);

  const setDefaultTargetLanguage = useCallback(
    async (lang) => {
      const next = { ...settings, defaultTargetLanguage: lang };
      await persist(next);
    },
    [settings, persist]
  );

  const setSportMode = useCallback(
    async (sportMode) => {
      const next = { ...settings, sportMode: !!sportMode };
      await persist(next);
    },
    [settings, persist]
  );

  const setEcoMode = useCallback(
    async (ecoMode) => {
      const next = { ...settings, ecoMode: !!ecoMode };
      await persist(next);
    },
    [settings, persist]
  );

  const setPttDirection = useCallback(
    async (pttDirection) => {
      const next = { ...settings, pttDirection };
      await persist(next);
    },
    [settings, persist]
  );

  const upsertPrinter = useCallback(
    async ({ id, name, ip }) => {
      const clean = {
        id: id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: String(name || '').trim() || 'Printer',
        ip: String(ip || '').trim(),
      };

      const printers = settings.printers || [];
      const exists = printers.some((p) => p.id === clean.id);
      const nextPrinters = exists
        ? printers.map((p) => (p.id === clean.id ? { ...p, ...clean } : p))
        : [clean, ...printers];

      const next = {
        ...settings,
        printers: nextPrinters,
        activePrinterId: settings.activePrinterId || clean.id,
      };

      await persist(next);
      return clean.id;
    },
    [settings, persist]
  );

  const removePrinter = useCallback(
    async (id) => {
      const nextPrinters = (settings.printers || []).filter((p) => p.id !== id);
      const nextActive = settings.activePrinterId === id ? (nextPrinters[0]?.id || null) : settings.activePrinterId;
      const next = { ...settings, printers: nextPrinters, activePrinterId: nextActive };
      await persist(next);
    },
    [settings, persist]
  );

  const setActivePrinter = useCallback(
    async (id) => {
      const next = { ...settings, activePrinterId: id };
      await persist(next);
    },
    [settings, persist]
  );

  const activePrinter = useMemo(() => {
    const printers = settings.printers || [];
    if (!settings.activePrinterId) return printers[0] || null;
    return printers.find((p) => p.id === settings.activePrinterId) || printers[0] || null;
  }, [settings]);

  const toggleSportMode = useCallback(
    async () => {
      const next = { ...settings, sportMode: !settings.sportMode };
      await persist(next);
    },
    [settings, persist]
  );

  const value = useMemo(
    () => ({
      loaded,
      settings,
      setDefaultTargetLanguage,
      setSportMode,
      toggleSportMode,
      setEcoMode,
      setPttDirection,
      upsertPrinter,
      removePrinter,
      setActivePrinter,
      activePrinter,
    }),
    [
      loaded,
      settings,
      setDefaultTargetLanguage,
      setSportMode,
      setEcoMode,
      setPttDirection,
      upsertPrinter,
      removePrinter,
      setActivePrinter,
      activePrinter,
    ]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
