import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';
import { queueOperation } from '../utils/offlineQueue';

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
      // If network error, serve from cache
      const cached = await loadJson(CACHE_KEY, null);
      if (cached?.vehicles) {
        setVehicles(cached.vehicles);
        setError('Serving cached data (offline)');
        return cached.vehicles;
      }
      setError(e.message || 'Failed to fetch inventory');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const addVehicle = useCallback(async (vehicleData: any) => {
    try {
      // Check 150 limit
      if (vehicles.length >= MAX_INVENTORY) {
        throw new Error(`Inventory limit reached (${MAX_INVENTORY} vehicles max)`);
      }

      // The backend expects { vin, vehicle_data: {...}, category, customer_id, ... }
      // but the caller sends a flat object. Restructure to match the API contract.
      const { vin, category, customer_id, trade_in_value, condition, ...rest } = vehicleData;
      const payload = {
        vin,
        vehicle_data: rest,
        category: category || 'active_inventory',
        ...(customer_id ? { customer_id } : {}),
        ...(trade_in_value != null ? { trade_in_value } : {}),
        ...(condition ? { condition } : {}),
      };

      const data = await apiFetch('/api/vin/save-to-inventory', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Backend returns { success, message, id, category }
      // Build a vehicle object for the local list
      const newVehicle = {
        vehicle_id: data?.id,
        vin,
        ...rest,
        category: data?.category || category || 'active_inventory',
        status: 'available',
      };

      setVehicles(prev => [newVehicle, ...prev]);
      // Update cache
      await saveJson(CACHE_KEY, {
        vehicles: [newVehicle, ...vehicles],
        timestamp: Date.now(),
      });

      return newVehicle;
    } catch (e: any) {
      // Queue for offline
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        const { vin, category, ...rest } = vehicleData;
        await queueOperation('/api/vin/save-to-inventory', {
          method: 'POST',
          body: JSON.stringify({ vin, vehicle_data: rest, category: category || 'active_inventory' }),
        });
        const tempVehicle = { ...vehicleData, vehicle_id: `temp_${Date.now()}`, _queued: true };
        setVehicles(prev => [tempVehicle, ...prev]);
        return tempVehicle;
      }
      setError(e.message || 'Failed to add vehicle');
      throw e;
    }
  }, [vehicles]);

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
      // Queue for offline
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        await queueOperation(`/api/vehicles/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        setVehicles(prev => prev.map(v => v.vehicle_id === id ? { ...v, ...updates, _queued: true } : v));
        return { ...updates, vehicle_id: id, _queued: true };
      }
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
      // Queue for offline
      if (e.code === 'TIMEOUT' || e.message?.includes('Network')) {
        await queueOperation(`/api/vehicles/${id}`, { method: 'DELETE' });
        setVehicles(prev => prev.filter(v => v.vehicle_id !== id));
        return;
      }
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
