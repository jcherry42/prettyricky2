import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { impactLight } from '../lib/haptics';

const TaillightFlashContext = createContext(null);

export function TaillightFlashProvider({ children }: { children: React.ReactNode }) {
  const [flash, setFlash] = useState(false);
  const timerRef = useRef(null);

  const triggerFlash = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    impactLight();
    setFlash(true);
    timerRef.current = setTimeout(() => {
      setFlash(false);
      timerRef.current = null;
    }, 180);
  }, []);

  const value = useMemo(() => ({ flash, triggerFlash }), [flash, triggerFlash]);

  return <TaillightFlashContext.Provider value={value}>{children}</TaillightFlashContext.Provider>;
}

export function useTaillightFlash() {
  const ctx = useContext(TaillightFlashContext);
  if (!ctx) throw new Error('useTaillightFlash must be used within TaillightFlashProvider');
  return ctx;
}
