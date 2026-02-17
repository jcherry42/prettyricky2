import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';

const CACHE_KEY = 'sc_v1_inventory_cache';
const MAX_INVENTORY = 150;

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load cached inventory on mount
  useEffect(() => {
    (async () => {
      const cached = await loadJson(CACHE_KEY, null);
      if (cached?.vehicles) {
        setVehicles(cached.vehicles);
      }
    })();
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch('/api/vehicles/inventory');
      const list = data?.vehicles || [];
      
      setVehicles(list);

      // Cache for offline access
      await saveJson(CACHE_KEY, {
        vehicles: list,
        timestamp: Date.now(),
      });

      return list;
    } catch (e) {
      setError(e.message || 'Failed to fetch inventory');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const addVehicle = useCallback(async (vehicleData) => {
    try {
      // Check 150 limit
      if (vehicles.length >= MAX_INVENTORY) {
        throw new Error(`Inventory limit reached (${MAX_INVENTORY} vehicles max)`);
      }

      const data = await apiFetch('/api/vin/save-to-inventory', {
        method: 'POST',
        body: JSON.stringify(vehicleData),
      });

      const newVehicle = data?.vehicle;
      if (newVehicle) {
        setVehicles(prev => [newVehicle, ...prev]);
      }

      return newVehicle;
    } catch (e) {
      setError(e.message || 'Failed to add vehicle');
      throw e;
    }
  }, [vehicles.length]);

  const updateVehicle = useCallback(async (id, updates) => {
    try {
      const data = await apiFetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      const updatedVehicle = data?.vehicle;
      if (updatedVehicle) {
        setVehicles(prev => prev.map(v => v.vehicle_id === id ? updatedVehicle : v));
      }

      return updatedVehicle;
    } catch (e) {
      setError(e.message || 'Failed to update vehicle');
      throw e;
    }
  }, []);

  const deleteVehicle = useCallback(async (id) => {
    try {
      await apiFetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
      });

      setVehicles(prev => prev.filter(v => v.vehicle_id !== id));
    } catch (e) {
      setError(e.message || 'Failed to delete vehicle');
      throw e;
    }
  }, []);

  const isAtLimit = vehicles.length >= MAX_INVENTORY;

  const value = useMemo(
    () => ({
      vehicles,
      loading,
      error,
      isAtLimit,
      maxInventory: MAX_INVENTORY,
      fetchInventory,
      addVehicle,
      updateVehicle,
      deleteVehicle,
    }),
    [vehicles, loading, error, isAtLimit, fetchInventory, addVehicle, updateVehicle, deleteVehicle]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
