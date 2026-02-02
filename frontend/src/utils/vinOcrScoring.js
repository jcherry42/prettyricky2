import { isValidVinChecksum } from './vinChecksum';

// Extremely fast scoring to rank OCR candidates.
// Goal: pick the best VIN without wasting time.

export function scoreVinCandidate(vin) {
  const v = String(vin || '').toUpperCase().trim();
  if (v.length !== 17) return 0;
  if (/[IOQ]/.test(v)) return 0;

  let score = 50; // base

  // VINs are alphanumeric with restricted set
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) score += 20;

  // ISO checksum
  if (isValidVinChecksum(v)) score += 30;

  return score;
}

export function pickBestVin(vins) {
  const candidates = Array.isArray(vins) ? vins : [];
  const scored = candidates
    .map((vin) => ({ vin, score: scoreVinCandidate(vin) }))
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}
