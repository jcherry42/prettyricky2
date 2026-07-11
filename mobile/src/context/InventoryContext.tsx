import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { loadJson, saveJson } from '../lib/storage';
import { queueOperation } from '../utils/offlineQueue';
import { errorMessage, isNetworkError } from '../lib/errors';

const CACHE_KEY = 'sc_v1_inventory_cache';
const MAX_INVENTORY = 150;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleRecord = Record<string, any> & { id?: string; vehicle_id?: string; vin?: string };

interface InventoryContextValue {
  vehicles: VehicleRecord[];
  loading: boolean;
  error: string | null;
  isAtLimit: boolean;
  maxInventory: number;
  fetchInventory: () => Promise<VehicleRecord[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addVehicle: (vehicleData: any) => Promise<VehicleRecord>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateVehicle: (id: string, updates: Record<string, any>) => Promise<Record<string, any>>;
  deleteVehicle: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached inventory on mount
  useEffect(() => {
    (async () => {
      const cached = await loadJson<{ vehicles: VehicleRecord[]; timestamp: number } | null>(CACHE_KEY, null);
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
    } catch (e: unknown) {
      // If network error, serve from cache
      const cached = await loadJson<{ vehicles: VehicleRecord[]; timestamp: number } | null>(CACHE_KEY, null);
      if (cached?.vehicles) {
        setVehicles(cached.vehicles);
        setError('Serving cached data (offline)');
        return cached.vehicles;
      }
      setError(errorMessage(e) || 'Failed to fetch inventory');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // Build a vehicle object for the local list — preserve _source for UI badge
      const newVehicle = {
        vehicle_id: data?.id,
        vin,
        ...rest,
        category: data?.category || category || 'active_inventory',
        status: 'available',
        _source: rest._source || vehicleData._source || 'scan',
      };

      setVehicles(prev => [newVehicle, ...prev]);
      // Update cache
      await saveJson(CACHE_KEY, {
        vehicles: [newVehicle, ...vehicles],
        timestamp: Date.now(),
      });

      return newVehicle;
    } catch (e: unknown) {
      // Queue for offline
      if (isNetworkError(e)) {
        const { vin, category, ...rest } = vehicleData;
        await queueOperation('/api/vin/save-to-inventory', {
          method: 'POST',
          body: JSON.stringify({ vin, vehicle_data: rest, category: category || 'active_inventory' }),
        });
        const tempVehicle = { ...vehicleData, vehicle_id: `temp_${Date.now()}`, _queued: true };
        setVehicles(prev => [tempVehicle, ...prev]);
        return tempVehicle;
      }
      setError(errorMessage(e) || 'Failed to add vehicle');
      throw e;
    }
  }, [vehicles]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateVehicle = useCallback(async (id: string, updates: Record<string, any>) => {
    try {
      await apiFetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      // Merge updates into local state (backend returns {success, updated} not full vehicle)
      setVehicles(prev => prev.map(v =>
        (v.vehicle_id === id || v.id === id) ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
      ));

      return { ...updates, id };
    } catch (e: unknown) {
      // Queue for offline
      if (isNetworkError(e)) {
        await queueOperation(`/api/vehicles/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        setVehicles(prev => prev.map(v =>
          (v.vehicle_id === id || v.id === id) ? { ...v, ...updates, _queued: true } : v
        ));
        return { ...updates, vehicle_id: id, _queued: true };
      }
      setError(errorMessage(e) || 'Failed to update vehicle');
      throw e;
    }
  }, []);

  const deleteVehicle = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
      });

      setVehicles(prev => prev.filter(v => v.vehicle_id !== id && v.id !== id));
    } catch (e: unknown) {
      // Queue for offline
      if (isNetworkError(e)) {
        await queueOperation(`/api/vehicles/${id}`, { method: 'DELETE' });
        setVehicles(prev => prev.filter(v => v.vehicle_id !== id && v.id !== id));
        return;
      }
      setError(errorMessage(e) || 'Failed to delete vehicle');
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
