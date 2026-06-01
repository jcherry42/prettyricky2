/**
 * Network Context
 * Global context providing network status and offline queue management.
 * All components can check isOnline and trigger sync.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncQueue, getQueue } from '../utils/offlineQueue';

interface SyncResult {
  success: boolean;
  error?: string;
  processed?: number;
  failed?: number;
  remaining?: number;
}

interface NetworkContextValue {
  isOnline: boolean;
  isConnected: boolean;
  isInternetReachable: boolean;
  syncStatus: string;
  queueCount: number;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | done | error
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const wasOffline = useRef(false);

  const isOnline = isConnected && isInternetReachable;

  // Monitor network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      const reachable = state.isInternetReachable ?? true;
      setIsConnected(connected);
      setIsInternetReachable(reachable);

      // Track was-offline for reconnection sync
      if (!connected || !reachable) {
        wasOffline.current = true;
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-sync on reconnection
  useEffect(() => {
    if (isOnline && wasOffline.current) {
      wasOffline.current = false;
      triggerSync();
    }
  }, [isOnline]);

  // Poll queue count periodically
  useEffect(() => {
    const poll = async () => {
      try {
        const queue = await getQueue();
        setQueueCount(queue.length);
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;

  const triggerSync = useCallback(async () => {
    if (syncStatusRef.current === 'syncing') return;
    setSyncStatus('syncing');
    try {
      const result = await syncQueue((_processed, _total) => {
        // Progress callback
      });
      setLastSyncResult(result);
      setSyncStatus(result.success ? 'done' : 'error');

      // Update queue count
      const queue = await getQueue();
      setQueueCount(queue.length);

      // Reset status after 3s
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, []);

  const value = useMemo(
    () => ({
      isOnline,
      isConnected,
      isInternetReachable,
      syncStatus,
      queueCount,
      lastSyncResult,
      triggerSync,
    }),
    [isOnline, isConnected, isInternetReachable, syncStatus, queueCount, lastSyncResult, triggerSync]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}
