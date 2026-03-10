/**
 * useOfflineQueue — React hook for the offline queue.
 *
 * Provides:
 *   - pendingCount: number of queued requests
 *   - isOnline: current connectivity status
 *   - flush(): manually retry queued requests
 *   - clear(): discard all queued requests
 *
 * Usage:
 *   const { pendingCount, isOnline, flush } = useOfflineQueue();
 */

import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue, QueuedRequest } from './offlineQueue';

export function useOfflineQueue() {
  const [pending, setPending] = useState<QueuedRequest[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubQueue = offlineQueue.subscribe(setPending);

    // Subscribe to network state
    const unsubNet = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    // Init with current state
    setPending(offlineQueue.getPending());
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => {
      unsubQueue();
      unsubNet();
    };
  }, []);

  const flush = useCallback(() => offlineQueue.flush(), []);
  const clear = useCallback(() => offlineQueue.clear(), []);

  return {
    pending,
    pendingCount: pending.length,
    isOnline,
    flush,
    clear,
  };
}
