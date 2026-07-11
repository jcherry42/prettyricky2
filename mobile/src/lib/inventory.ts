import { loadJson, saveJson } from './storage';

const INVENTORY_KEY = 'sc_v1_local_inventory';

/** Loose decoded-vehicle shape from the VIN backend (NHTSA returns 100+ fields). */
export interface VinDecodedPayload {
  vehicle?: Record<string, unknown> & {
    year?: number | string;
    make?: string;
    model?: string;
    trim?: string;
    fuel_type?: string;
    engine_display?: string;
    plant_country?: string;
    assembly_location?: string;
  };
  confidence?: number;
  source?: string;
  [key: string]: unknown;
}

/** Local inventory record — a decoded vehicle enriched with dealership fields. */
export interface InventoryVehicle {
  id: string;
  vin: string;
  year: number | string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  fuelType: string | null;
  engineDisplay: string | null;
  plantCountry: string | null;
  assemblyLocation: string | null;
  stockNumber: string;
  price: number | null;
  mileage: number | null;
  status: string;
  notes: string;
  confidence: number | null;
  source: string;
  addedAt: string;
  updatedAt: string | null;
  decodedRaw: VinDecodedPayload | null;
}

export interface InventoryData { vehicles: InventoryVehicle[] }

export async function loadInventory(): Promise<InventoryData> {
  const data = await loadJson(INVENTORY_KEY, { vehicles: [] }) as InventoryData | null;
  if (!data || typeof data !== 'object') return { vehicles: [] };
  if (!Array.isArray(data.vehicles)) return { vehicles: [] };
  return data;
}

export async function saveInventory(next: InventoryData) {
  return saveJson(INVENTORY_KEY, next);
}

export function buildVehicleFromDecode({ vin, decoded }: { vin: string; decoded: VinDecodedPayload | null }): InventoryVehicle {
  const v = decoded?.vehicle || {};
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    vin,
    year: (v.year as number | string) ?? null,
    make: (v.make as string) ?? null,
    model: (v.model as string) ?? null,
    trim: (v.trim as string) ?? null,
    fuelType: (v.fuel_type as string) ?? null,
    engineDisplay: (v.engine_display as string) ?? null,
    plantCountry: (v.plant_country as string) ?? null,
    assemblyLocation: (v.assembly_location as string) ?? null,

    // editable fields
    stockNumber: '',
    price: null,
    mileage: null,
    status: 'active',
    notes: '',

    confidence: decoded?.confidence ?? null,
    source: decoded?.source || 'backend',
    addedAt: new Date().toISOString(),
    updatedAt: null,
    decodedRaw: decoded || null,
  };
}

export function countryFlagForVehicle(v: Pick<InventoryVehicle, 'assemblyLocation' | 'plantCountry'>): string {
  const country = (v.assemblyLocation || v.plantCountry || '').toUpperCase();
  if (!country) return '🏁';
  if (country.includes('USA') || country.includes('UNITED STATES')) return '🇺🇸';
  if (country.includes('CANADA')) return '🇨🇦';
  if (country.includes('MEXICO')) return '🇲🇽';
  if (country.includes('JAPAN')) return '🇯🇵';
  if (country.includes('KOREA')) return '🇰🇷';
  if (country.includes('GERMANY')) return '🇩🇪';
  if (country.includes('UK') || country.includes('UNITED KINGDOM') || country.includes('ENGLAND')) return '🇬🇧';
  if (country.includes('ITALY')) return '🇮🇹';
  if (country.includes('FRANCE')) return '🇫🇷';
  if (country.includes('CHINA')) return '🇨🇳';
  if (country.includes('SWEDEN')) return '🇸🇪';
  if (country.includes('FINLAND')) return '🇫🇮';
  if (country.includes('BRAZIL')) return '🇧🇷';
  return '🌍';
}

export async function addToInventory({ vin, decoded }: { vin: string; decoded: VinDecodedPayload | null }) {
  const inv = await loadInventory();
  const exists = inv.vehicles.find((x) => x.vin === vin);
  if (exists) {
    // Update existing with latest decode
    const updated = inv.vehicles.map((x) => (x.vin === vin ? { ...x, decodedRaw: decoded || x.decodedRaw } : x));
    const next = { ...inv, vehicles: updated };
    await saveInventory(next);
    return next;
  }

  const item = buildVehicleFromDecode({ vin, decoded });
  const trimmed = inv.vehicles.slice(0, 74); // keep at most 74 existing so new makes 75
  const next = { ...inv, vehicles: [item, ...trimmed] };
  await saveInventory(next);
  return next;
}

export async function updateVehicle(vehicleId: string, patch: Partial<InventoryVehicle>) {
  const inv = await loadInventory();
  const nextVehicles = inv.vehicles.map((v) => (v.id === vehicleId ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v));
  const next = { ...inv, vehicles: nextVehicles };
  await saveInventory(next);
  return next;
}

export async function removeFromInventory(vehicleId: string) {
  const inv = await loadInventory();
  const next: InventoryData = { ...inv, vehicles: inv.vehicles.filter((v) => v.id !== vehicleId) };
  await saveInventory(next);
  return next;
}
