import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const TaillightFlashContext = createContext(null);

export function TaillightFlashProvider({ children }) {
  const [flash, setFlash] = useState(false);
  const timerRef = useRef(null);

  const triggerFlash = useCallback(() => {
    // Quick brake flash pulse. Re-triggerable.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setFlash(true);
    timerRef.current = setTimeout(() => {
      setFlash(false);
      timerRef.current = null;
    }, 140);
  }, []);

  const value = useMemo(() => ({ flash, triggerFlash }), [flash, triggerFlash]);

  return <TaillightFlashContext.Provider value={value}>{children}</TaillightFlashContext.Provider>;
}

export function useTaillightFlash() {
  const ctx = useContext(TaillightFlashContext);
  if (!ctx) throw new Error('useTaillightFlash must be used within TaillightFlashProvider');
  return ctx;
}
