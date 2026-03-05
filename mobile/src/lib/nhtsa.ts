import { apiFetch } from './api';

// If we later add a backend pass-through, we can keep the same contract here.
export async function decodeVinWithBackend(vin) {
  // Existing backend has /api/vin/decode/{vin}
  return apiFetch(`/api/vin/decode/${encodeURIComponent(vin)}`);
}
