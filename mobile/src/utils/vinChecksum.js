/**
 * VIN Checksum Validation
 * Validates VIN using the check digit algorithm
 */

const TRANSLITERATION = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calculate VIN check digit
 * @param {string} vin - 17 character VIN
 * @returns {string|null} - Expected check digit or null if invalid
 */
export function calculateCheckDigit(vin) {
  if (!vin || vin.length !== 17) return null;

  const upper = vin.toUpperCase();
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const char = upper[i];
    let value;

    if (/[0-9]/.test(char)) {
      value = parseInt(char, 10);
    } else if (TRANSLITERATION[char]) {
      value = TRANSLITERATION[char];
    } else {
      return null; // Invalid character
    }

    sum += value * WEIGHTS[i];
  }

  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/**
 * Validate VIN checksum
 * @param {string} vin - 17 character VIN
 * @returns {boolean} - True if valid
 */
export function validateVinChecksum(vin) {
  if (!vin || vin.length !== 17) return false;

  const upper = vin.toUpperCase();
  const checkDigit = upper[8];
  const expected = calculateCheckDigit(vin);

  return expected !== null && checkDigit === expected;
}

/**
 * Validate VIN format
 * @param {string} vin - VIN to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
export function validateVinFormat(vin) {
  if (!vin) {
    return { valid: false, error: 'VIN is required' };
  }

  const cleaned = vin.trim().toUpperCase();

  if (cleaned.length !== 17) {
    return { valid: false, error: 'VIN must be exactly 17 characters' };
  }

  // No I, O, Q allowed in VINs
  if (/[IOQ]/.test(cleaned)) {
    return { valid: false, error: 'VIN contains invalid characters (I, O, Q)' };
  }

  // Only alphanumeric
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return { valid: false, error: 'VIN contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Full VIN validation with checksum
 * @param {string} vin - VIN to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
export function validateVin(vin) {
  const formatCheck = validateVinFormat(vin);
  if (!formatCheck.valid) return formatCheck;

  const checksumValid = validateVinChecksum(vin);
  if (!checksumValid) {
    return { valid: false, error: 'VIN checksum invalid' };
  }

  return { valid: true };
}
