import { useEffect, useRef, useCallback } from 'react';

/**
 * usePerformanceCleanup Hook
 * Allows components to register cleanup callbacks and respond to cleanup events
 * 
 * Usage:
 * usePerformanceCleanup(() => {
 *   // Clear component-specific caches
 *   setLocalCache({});
 * });
 */
export const usePerformanceCleanup = (cleanupCallback, deps = []) => {
  const callbackRef = useRef(cleanupCallback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = cleanupCallback;
  }, [cleanupCallback]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleDeepCleanup = () => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    };
    
    const handleEmergencyCleanup = () => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    };
    
    window.addEventListener('deepCleanup', handleDeepCleanup);
    window.addEventListener('emergencyCleanup', handleEmergencyCleanup);
    
    return () => {
      window.removeEventListener('deepCleanup', handleDeepCleanup);
      window.removeEventListener('emergencyCleanup', handleEmergencyCleanup);
    };
  }, Array.isArray(deps) ? deps : []);
};

/**
 * useStaleDataCleanup Hook
 * Automatically clears data that hasn't been accessed in a while
 * 
 * Usage:
 * const [data, setData, clearStale] = useStaleDataCleanup(initialData, 60000);
 */
export const useStaleDataCleanup = (initialValue, staleThreshold = 60 * 60 * 1000) => {
  const dataRef = useRef({
    value: initialValue,
    lastAccess: Date.now(),
  });
  
  const getValue = useCallback(() => {
    dataRef.current.lastAccess = Date.now();
    return dataRef.current.value;
  }, []);
  
  const setValue = useCallback((newValue) => {
    dataRef.current.value = typeof newValue === 'function' 
      ? newValue(dataRef.current.value) 
      : newValue;
    dataRef.current.lastAccess = Date.now();
  }, []);
  
  const clearIfStale = useCallback(() => {
    const now = Date.now();
    if (now - dataRef.current.lastAccess > staleThreshold) {
      dataRef.current.value = initialValue;
      return true;
    }
    return false;
  }, [initialValue, staleThreshold]);
  
  // Listen for cleanup events
  useEffect(() => {
    const handleCleanup = () => {
      clearIfStale();
    };
    
    window.addEventListener('deepCleanup', handleCleanup);
    return () => window.removeEventListener('deepCleanup', handleCleanup);
  }, [clearIfStale]);
  
  return [getValue, setValue, clearIfStale];
};

/**
 * useBlobURLCleanup Hook
 * Automatically revokes blob URLs when component unmounts or on cleanup events
 * 
 * Usage:
 * const createBlobURL = useBlobURLCleanup();
 * const url = createBlobURL(blob);
 */
export const useBlobURLCleanup = () => {
  const urlsRef = useRef(new Set());
  
  const createURL = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);
  
  const revokeURL = useCallback((url) => {
    if (urlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  }, []);
  
  const revokeAll = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeAll();
    };
  }, [revokeAll]);
  
  // Listen for cleanup events
  useEffect(() => {
    const handleCleanup = () => {
      revokeAll();
    };
    
    window.addEventListener('cleanupBlobURLs', handleCleanup);
    window.addEventListener('emergencyCleanup', handleCleanup);
    
    return () => {
      window.removeEventListener('cleanupBlobURLs', handleCleanup);
      window.removeEventListener('emergencyCleanup', handleCleanup);
    };
  }, [revokeAll]);
  
  return { createURL, revokeURL, revokeAll };
};

/**
 * useCachedData Hook
 * Caches data with automatic expiration and cleanup
 * 
 * Usage:
 * const { data, setData, refresh, isStale } = useCachedData('customers', fetchCustomers, 5 * 60 * 1000);
 */
export const useCachedData = (key, fetcher, maxAge = 5 * 60 * 1000) => {
  const cacheRef = useRef({
    data: null,
    timestamp: 0,
    loading: false,
  });
  
  const isStale = useCallback(() => {
    return Date.now() - cacheRef.current.timestamp > maxAge;
  }, [maxAge]);
  
  const getData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cacheRef.current.data && !isStale()) {
      return cacheRef.current.data;
    }
    
    if (cacheRef.current.loading) {
      // Wait for existing request
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!cacheRef.current.loading) {
            clearInterval(check);
            resolve(cacheRef.current.data);
          }
        }, 100);
      });
    }
    
    cacheRef.current.loading = true;
    
    try {
      const data = await fetcher();
      cacheRef.current.data = data;
      cacheRef.current.timestamp = Date.now();
      return data;
    } finally {
      cacheRef.current.loading = false;
    }
  }, [fetcher, isStale]);
  
  const setData = useCallback((data) => {
    cacheRef.current.data = data;
    cacheRef.current.timestamp = Date.now();
  }, []);
  
  const clear = useCallback(() => {
    cacheRef.current.data = null;
    cacheRef.current.timestamp = 0;
  }, []);
  
  // Listen for cleanup events
  useEffect(() => {
    const handleCleanup = () => {
      if (isStale()) {
        clear();
      }
    };
    
    window.addEventListener('deepCleanup', handleCleanup);
    return () => window.removeEventListener('deepCleanup', handleCleanup);
  }, [clear, isStale]);
  
  return {
    getData,
    setData,
    clear,
    isStale,
    refresh: () => getData(true),
  };
};

/**
 * useLimitedHistory Hook
 * Maintains a limited history array that auto-trims
 * 
 * Usage:
 * const { history, push, clear } = useLimitedHistory(10);
 */
export const useLimitedHistory = (maxItems = 10) => {
  const historyRef = useRef([]);
  
  const push = useCallback((item) => {
    historyRef.current.push(item);
    if (historyRef.current.length > maxItems) {
      historyRef.current = historyRef.current.slice(-maxItems);
    }
    return historyRef.current;
  }, [maxItems]);
  
  const clear = useCallback(() => {
    historyRef.current = [];
  }, []);
  
  const getHistory = useCallback(() => {
    return [...historyRef.current];
  }, []);
  
  // Listen for cleanup events
  useEffect(() => {
    const handleCleanup = () => {
      // Keep only half on cleanup
      if (historyRef.current.length > maxItems / 2) {
        historyRef.current = historyRef.current.slice(-Math.floor(maxItems / 2));
      }
    };
    
    window.addEventListener('deepCleanup', handleCleanup);
    return () => window.removeEventListener('deepCleanup', handleCleanup);
  }, [maxItems]);
  
  return { history: getHistory, push, clear };
};

export default {
  usePerformanceCleanup,
  useStaleDataCleanup,
  useBlobURLCleanup,
  useCachedData,
  useLimitedHistory,
};
