import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';
import { queueOperation } from '../utils/offlineQueue';
import { errorMessage, isNetworkError } from '../lib/errors';
import { track } from '../lib/telemetry';

const CACHE_KEY = 'sc_v1_customers_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/** Loose runtime shape — customers arrive from backend, local storage, offline queue,
 *  and each source may include extra fields. Kept permissive on purpose so consumers
 *  don't need to cast at every access; discipline is enforced at the backend layer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomerRecord = Record<string, any> & { id?: string; customer_id?: string };

interface CustomerContextValue {
  customers: CustomerRecord[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  fetchCustomers: (options?: { limit?: number; search?: string; append?: boolean; skip?: number }) => Promise<{ customers: CustomerRecord[]; hasMore: boolean }>;
  getCustomer: (id: string) => Promise<CustomerRecord | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createCustomer: (customerData: Record<string, any>) => Promise<CustomerRecord | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateCustomer: (id: string, updates: Record<string, any>) => Promise<CustomerRecord | null>;
  deleteCustomer: (id: string) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  // Ref always pointing to latest customers — prevents stale closures in callbacks
  const customersRef = useRef(customers);
  customersRef.current = customers;

  // Load cached customers on mount
  useEffect(() => {
    (async () => {
      const cached = await loadJson<{ customers: CustomerRecord[]; timestamp: number } | null>(CACHE_KEY, null);
      if (cached?.customers && cached?.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
          setCustomers(cached.customers);
          setLastFetch(cached.timestamp);
        }
      }
    })();
  }, []);

  // Auto-persist to cache whenever customers change (fixes stale closure in rapid creates)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (customers.length > 0) {
      saveJson(CACHE_KEY, { customers, timestamp: Date.now() });
    }
  }, [customers]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalizeCustomer(c: any) {
    if (!c || typeof c !== 'object') return c;
    // Backend uses `id` (UUID). Some UI code historically used `customer_id`.
    const id = c.customer_id || c.id;
    return { ...c, id, customer_id: id };
  }

  const fetchCustomers = useCallback(async (options: { limit?: number; search?: string; append?: boolean; skip?: number } = {}) => {
    const { limit = 50, search = '', append = false, skip = 0 } = options;

    if (!append) setLoading(true);
    setError(null);

    try {
      let path = `/api/customers/list?limit=${limit}&skip=${skip}`;
      if (search) path += `&search=${encodeURIComponent(search)}`;

      const data = await apiFetch(path);
      const list = (data?.customers || []).map(normalizeCustomer);
      const hasMore = data?.has_more ?? (list.length >= limit);

      if (append) {
        setCustomers(prev => {
          // Deduplicate by id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = new Set(prev.map((c: any) => c.customer_id || c.id));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fresh = list.filter((c: any) => !existing.has(c.customer_id || c.id));
          return [...prev, ...fresh];
        });
      } else {
        setCustomers(list);
      }

      setLastFetch(Date.now());

      // Cache is auto-saved via useEffect when customers state changes

      return { customers: list, hasMore };
    } catch (e: unknown) {
      // If network error, serve from cache
      const cached = await loadJson<{ customers: CustomerRecord[]; timestamp: number } | null>(CACHE_KEY, null);
      if (cached?.customers) {
        const normalized = cached.customers.map(normalizeCustomer);
        setCustomers(normalized);
        setError('Serving cached data (offline)');
        return { customers: normalized, hasMore: false };
      }
      setError(errorMessage(e) || 'Failed to fetch customers');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomer = useCallback(async (id: string) => {
    try {
      const data = await apiFetch(`/api/customers/${id}`);
      // Backend returns the customer object directly (not wrapped).
      return normalizeCustomer(data) || null;
    } catch (e: unknown) {
      // Try to find in cached list (use ref for latest data)
      const found = customersRef.current.find((c) => (c.customer_id || c.id) === id);
      if (found) return found;
      setError(errorMessage(e) || 'Failed to fetch customer');
      throw e;
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createCustomer = useCallback(async (customerData: Record<string, any>) => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/customers/create', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      const newCustomer = normalizeCustomer(data?.customer);
      if (newCustomer) {
        // Functional update — always uses latest state, no stale closure risk
        setCustomers((prev) => [newCustomer, ...prev]);
        // Cache is auto-saved via useEffect on customers change
        track('customer', 'created', { source: customerData?._source || 'manual' });
      }

      return newCustomer;
    } catch (e: unknown) {
      // Queue for offline if network error
      if (isNetworkError(e)) {
        await queueOperation('/api/customers/create', {
          method: 'POST',
          body: JSON.stringify(customerData),
        });
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const tempCustomer = normalizeCustomer({ ...customerData, id: tempId, customer_id: tempId, _queued: true });
        setCustomers((prev) => [tempCustomer, ...prev]);
        track('customer', 'created_offline', { source: customerData?._source || 'manual' });
        return tempCustomer;
      }
      setError(errorMessage(e) || 'Failed to create customer');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateCustomer = useCallback(async (id: string, updates: Record<string, any>) => {
    const cid = id;
    try {
      const data = await apiFetch(`/api/customers/${cid}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      // Backend returns {success, updated}. We then refetch the updated record to keep UI consistent.
      if (data?.success) {
        const refreshed = await apiFetch(`/api/customers/${cid}`);
        const updatedCustomer = normalizeCustomer(refreshed);
        if (updatedCustomer) {
          setCustomers((prev) => prev.map((c) => ((c.customer_id || c.id) === cid ? updatedCustomer : c)));
        }
        return updatedCustomer;
      }

      // Fallback: try to merge locally
      setCustomers((prev) => prev.map((c) => ((c.customer_id || c.id) === cid ? normalizeCustomer({ ...c, ...updates }) : c)));
      return null;
    } catch (e: unknown) {
      // Queue for offline
      if (isNetworkError(e)) {
        await queueOperation(`/api/customers/${cid}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        // Optimistic update
        setCustomers((prev) => prev.map((c) => ((c.customer_id || c.id) === cid ? { ...c, ...updates, _queued: true } : c)));
        return { ...updates, customer_id: cid, id: cid, _queued: true };
      }
      setError(errorMessage(e) || 'Failed to update customer');
      throw e;
    }
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    const cid = id;
    try {
      await apiFetch(`/api/customers/${cid}`, {
        method: 'DELETE',
      });

      setCustomers((prev) => prev.filter((c) => (c.customer_id || c.id) !== cid));
    } catch (e: unknown) {
      // Queue for offline
      if (isNetworkError(e)) {
        await queueOperation(`/api/customers/${cid}`, { method: 'DELETE' });
        // Optimistic delete
        setCustomers((prev) => prev.filter((c) => (c.customer_id || c.id) !== cid));
        return;
      }
      setError(errorMessage(e) || 'Failed to delete customer');
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      customers,
      loading,
      error,
      lastFetch,
      fetchCustomers,
      getCustomer,
      createCustomer,
      updateCustomer,
      deleteCustomer,
    }),
    [customers, loading, error, lastFetch, fetchCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomers must be used within CustomerProvider');
  return ctx;
}
