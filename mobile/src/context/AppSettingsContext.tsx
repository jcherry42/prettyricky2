import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

const STORAGE_KEY = 'sc_v1_settings';

export interface Printer {
  id: string;
  name: string;
  ip: string;
}

interface AppSettings {
  defaultTargetLanguage: string;
  sportMode: boolean;
  serviceMode: boolean;
  performanceMode: boolean;
  pttDirection: string;
  printers: Printer[];
  activePrinterId: string | null;
  soundProfile: string;
  salesRepName: string;
  dealershipName: string;
  dealershipAddress: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultTargetLanguage: 'es',
  sportMode: false,
  serviceMode: false,
  performanceMode: false,
  pttDirection: 'en_to_target',
  printers: [],
  activePrinterId: null,
  soundProfile: 'merica',
  salesRepName: '',
  dealershipName: '',
  dealershipAddress: '',
};

interface AppSettingsContextValue {
  loaded: boolean;
  settings: AppSettings;
  activePrinter: Printer | null;
  setDefaultTargetLanguage: (lang: string) => Promise<void>;
  setSportMode: (v: boolean) => Promise<void>;
  toggleSportMode: () => Promise<void>;
  setServiceMode: (v: boolean) => Promise<void>;
  toggleServiceMode: () => Promise<void>;
  setPerformanceMode: (v: boolean) => Promise<void>;
  togglePerformanceMode: () => Promise<void>;
  setPttDirection: (v: string) => Promise<void>;
  upsertPrinter: (p: { id?: string; name?: string; ip?: string }) => Promise<string>;
  removePrinter: (id: string) => Promise<void>;
  setActivePrinter: (id: string | null) => Promise<void>;
  setSoundProfile: (v: string) => Promise<void>;
  setSalesRepName: (v: string) => Promise<void>;
  setDealershipName: (v: string) => Promise<void>;
  setDealershipAddress: (v: string) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Keep a ref that always points to the latest settings.
  // All callbacks read from this ref so they don't need to list
  // `settings` as a dependency — eliminating cascading re-renders
  // whenever any setting changes.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      const stored = await loadJson<Partial<AppSettings> | null>(STORAGE_KEY, null);
      if (stored && typeof stored === 'object') {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        setSettings(merged);
        settingsRef.current = merged;
      }
      setLoaded(true);
    })();
  }, []);

  // persist is stable: setSettings from useState never changes
  const persist = useCallback(async (next: AppSettings) => {
    setSettings(next);
    settingsRef.current = next;
    await saveJson(STORAGE_KEY, next);
  }, []);

  const setDefaultTargetLanguage = useCallback(async (lang: string) => {
    await persist({ ...settingsRef.current, defaultTargetLanguage: lang });
  }, [persist]);

  const setSportMode = useCallback(async (sportMode: boolean) => {
    await persist({ ...settingsRef.current, sportMode: !!sportMode });
  }, [persist]);

  const setServiceMode = useCallback(async (serviceMode: boolean) => {
    await persist({ ...settingsRef.current, serviceMode: !!serviceMode });
  }, [persist]);
  const toggleServiceMode = useCallback(async () => {
    await persist({ ...settingsRef.current, serviceMode: !settingsRef.current.serviceMode });
  }, [persist]);

  const setPerformanceMode = useCallback(async (performanceMode: boolean) => {
    await persist({ ...settingsRef.current, performanceMode: !!performanceMode });
  }, [persist]);
  const togglePerformanceMode = useCallback(async () => {
    await persist({ ...settingsRef.current, performanceMode: !settingsRef.current.performanceMode });
  }, [persist]);

  const setPttDirection = useCallback(async (pttDirection: string) => {
    await persist({ ...settingsRef.current, pttDirection });
  }, [persist]);

  const toggleSportMode = useCallback(async () => {
    await persist({ ...settingsRef.current, sportMode: !settingsRef.current.sportMode });
  }, [persist]);

  const upsertPrinter = useCallback(async ({ id, name, ip }: { id?: string; name?: string; ip?: string }) => {
    const s = settingsRef.current;
    const clean = {
      id: id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: String(name || '').trim() || 'Printer',
      ip: String(ip || '').trim(),
    };
    const printers = s.printers || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = printers.some((p: any) => p.id === clean.id);
    const nextPrinters = exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? printers.map((p: any) => (p.id === clean.id ? { ...p, ...clean } : p))
      : [clean, ...printers];
    await persist({
      ...s,
      printers: nextPrinters,
      activePrinterId: s.activePrinterId || clean.id,
    });
    return clean.id;
  }, [persist]);

  const removePrinter = useCallback(async (id: string) => {
    const s = settingsRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextPrinters = (s.printers || []).filter((p: any) => p.id !== id);
    const nextActive = s.activePrinterId === id ? (nextPrinters[0]?.id || null) : s.activePrinterId;
    await persist({ ...s, printers: nextPrinters, activePrinterId: nextActive });
  }, [persist]);

  const setActivePrinter = useCallback(async (id: string | null) => {
    await persist({ ...settingsRef.current, activePrinterId: id });
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

  const activePrinter = useMemo<Printer | null>(() => {
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
      setServiceMode,
      toggleServiceMode,
      setPerformanceMode,
      togglePerformanceMode,
      setPttDirection,
      upsertPrinter,
      removePrinter,
      setActivePrinter,
      setSoundProfile,
      setSalesRepName,
      setDealershipName,
      setDealershipAddress,
    }),
    
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
