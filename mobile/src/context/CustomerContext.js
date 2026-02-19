import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';
import { queueOperation } from '../utils/offlineQueue';

const CACHE_KEY = 'sc_v1_customers_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const CustomerContext = createContext(null);

export function CustomerProvider({ children }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Load cached customers on mount
  useEffect(() => {
    (async () => {
      const cached = await loadJson(CACHE_KEY, null);
      if (cached?.customers && cached?.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
          setCustomers(cached.customers);
          setLastFetch(cached.timestamp);
        }
      }
    })();
  }, []);

  function normalizeCustomer(c) {
    if (!c || typeof c !== 'object') return c;
    // Backend uses `id` (UUID). Some UI code historically used `customer_id`.
    const id = c.customer_id || c.id;
    return { ...c, id, customer_id: id };
  }

  const fetchCustomers = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { limit = 200, search = '' } = options;
      let path = `/api/customers/list?limit=${limit}`;
      if (search) path += `&search=${encodeURIComponent(search)}`;

      const data = await apiFetch(path);
      const list = (data?.customers || []).map(normalizeCustomer);

      setCustomers(list);
      setLastFetch(Date.now());

      // Cache for offline access
      await saveJson(CACHE_KEY, {
        customers: list,
        timestamp: Date.now(),
      });

      return list;
    } catch (e) {
      // If network error, serve from cache
      const cached = await loadJson(CACHE_KEY, null);
      if (cached?.customers) {
        const normalized = cached.customers.map(normalizeCustomer);
        setCustomers(normalized);
        setError('Serving cached data (offline)');
        return normalized;
      }
      setError(e.message || 'Failed to fetch customers');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomer = useCallback(async (id) => {
    try {
      const data = await apiFetch(`/api/customers/${id}`);
      // Backend returns the customer object directly (not wrapped).
      return normalizeCustomer(data) || null;
    } catch (e) {
      // Try to find in cached list
      const found = customers.find((c) => (c.customer_id || c.id) === id);
      if (found) return found;
      setError(e.message || 'Failed to fetch customer');
      throw e;
    }
  }, [customers]);

  const createCustomer = useCallback(async (customerData) => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/customers/create', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      const newCustomer = normalizeCustomer(data?.customer);
      if (newCustomer) {
        setCustomers((prev) => [newCustomer, ...prev]);
        // Update cache
        await saveJson(CACHE_KEY, {
          customers: [newCustomer, ...customers.map(normalizeCustomer)],
          timestamp: Date.now(),
        });
      }

      return newCustomer;
    } catch (e) {
      // Queue for offline if network error
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        await queueOperation('/api/customers/create', {
          method: 'POST',
          body: JSON.stringify(customerData),
        });
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const tempCustomer = normalizeCustomer({ ...customerData, id: tempId, customer_id: tempId, _queued: true });
        setCustomers((prev) => [tempCustomer, ...prev]);
        return tempCustomer;
      }
      setError(e.message || 'Failed to create customer');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [customers]);

  const updateCustomer = useCallback(async (id, updates) => {
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
    } catch (e) {
      // Queue for offline
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        await queueOperation(`/api/customers/${cid}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        // Optimistic update
        setCustomers((prev) => prev.map((c) => ((c.customer_id || c.id) === cid ? { ...c, ...updates, _queued: true } : c)));
        return { ...updates, customer_id: cid, id: cid, _queued: true };
      }
      setError(e.message || 'Failed to update customer');
      throw e;
    }
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    try {
      await apiFetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });

      setCustomers(prev => prev.filter(c => c.customer_id !== id));
    } catch (e) {
      // Queue for offline
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        await queueOperation(`/api/customers/${id}`, { method: 'DELETE' });
        // Optimistic delete
        setCustomers(prev => prev.filter(c => c.customer_id !== id));
        return;
      }
      setError(e.message || 'Failed to delete customer');
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
