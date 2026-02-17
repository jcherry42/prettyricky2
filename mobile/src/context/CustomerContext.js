import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';

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

  const fetchCustomers = useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { limit = 200, search = '' } = options;
      let path = `/api/customers/list?limit=${limit}`;
      if (search) path += `&search=${encodeURIComponent(search)}`;

      const data = await apiFetch(path);
      const list = data?.customers || [];
      
      setCustomers(list);
      setLastFetch(Date.now());

      // Cache for offline access
      await saveJson(CACHE_KEY, {
        customers: list,
        timestamp: Date.now(),
      });

      return list;
    } catch (e) {
      setError(e.message || 'Failed to fetch customers');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomer = useCallback(async (id) => {
    try {
      const data = await apiFetch(`/api/customers/${id}`);
      return data?.customer || null;
    } catch (e) {
      setError(e.message || 'Failed to fetch customer');
      throw e;
    }
  }, []);

  const createCustomer = useCallback(async (customerData) => {
    try {
      const data = await apiFetch('/api/customers/create', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      const newCustomer = data?.customer;
      if (newCustomer) {
        setCustomers(prev => [newCustomer, ...prev]);
      }

      return newCustomer;
    } catch (e) {
      setError(e.message || 'Failed to create customer');
      throw e;
    }
  }, []);

  const updateCustomer = useCallback(async (id, updates) => {
    try {
      const data = await apiFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      const updatedCustomer = data?.customer;
      if (updatedCustomer) {
        setCustomers(prev => prev.map(c => c.customer_id === id ? updatedCustomer : c));
      }

      return updatedCustomer;
    } catch (e) {
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
