import { loadJson, saveJson } from './storage';

const INVENTORY_KEY = 'sc_v1_local_inventory';

export async function loadInventory() {
  const data = await loadJson(INVENTORY_KEY, { vehicles: [] });
  if (!data || typeof data !== 'object') return { vehicles: [] };
  if (!Array.isArray(data.vehicles)) return { vehicles: [] };
  return data;
}

export async function saveInventory(next) {
  return saveJson(INVENTORY_KEY, next);
}

export function buildVehicleFromDecode({ vin, decoded }) {
  const v = decoded?.vehicle || {};
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    vin,
    year: v.year || null,
    make: v.make || null,
    model: v.model || null,
    trim: v.trim || null,
    fuelType: v.fuel_type || null,
    engineDisplay: v.engine_display || null,
    plantCountry: v.plant_country || null,
    assemblyLocation: v.assembly_location || null,

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
export function countryFlagForVehicle(v) {
  const country = (v.assemblyLocation || v.plantCountry || '').toUpperCase();
  if (!country) return '🏁';
  if (country.includes('USA') || country.includes('UNITED STATES')) return '🇺🇸';
  if (country.includes('CANADA')) return '🇨🇦';
  if (country.includes('MEXICO')) return '🇲🇽';
  if (country.includes('JAPAN')) return '🇯🇵';
  if (country.includes('KOREA')) return '🇰🇷';
  if (country.includes('GERMANY')) return '🇩🇪';
  if (country.includes('UK') or country.includes('UNITED KINGDOM') or country.includes('ENGLAND')) return '🇬🇧';
  if (country.includes('ITALY')) return '🇮🇹';
  if (country.includes('FRANCE')) return '🇫🇷';
  if (country.includes('CHINA')) return '🇨🇳';
  if (country.includes('SWEDEN')) return '🇸🇪';
  if (country.includes('FINLAND')) return '🇫🇮';
  if (country.includes('BRAZIL')) return '🇧🇷';
  return '🌍';
}



    decodedRaw: decoded || null,
  };
}

export async function addToInventory({ vin, decoded }) {
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

export async function updateVehicle(vehicleId, patch) {
  const inv = await loadInventory();
  const nextVehicles = inv.vehicles.map((v) => (v.id === vehicleId ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v));
  const next = { ...inv, vehicles: nextVehicles };
  await saveInventory(next);
  return next;
}

export async function removeFromInventory(vehicleId) {
  const inv = await loadInventory();
  const next = { ...inv, vehicles: inv.vehicles.filter((v) => v.id !== vehicleId) };
  await saveInventory(next);
  return next;
}
