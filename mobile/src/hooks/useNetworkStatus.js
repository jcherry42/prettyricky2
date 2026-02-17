/**
 * Network Status Hook
 * Monitors network connectivity and triggers sync
 */

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncQueue } from '../utils/offlineQueue';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable ?? true);

      // Auto-sync when connection restored
      if (state.isConnected && state.isInternetReachable) {
        syncQueue().catch(() => {
          // Silent fail - will retry on next connection
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
  };
}
