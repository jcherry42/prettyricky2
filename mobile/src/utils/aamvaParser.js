/**
 * AAMVA PDF417 Barcode Parser — Client-Side
 *
 * Parses driver's license barcodes from all 50 US states + DC.
 * Runs entirely on-device for instant, zero-latency results.
 *
 * AAMVA = American Association of Motor Vehicle Administrators
 * PDF417 = the 2D barcode on the back of every US license.
 *
 * Supports AAMVA standard versions 1–11 (2000–2025+).
 */

// ── All known AAMVA 3-character field codes ──
const KNOWN_CODES = new Set([
  'DAA','DAB','DAC','DAD','DAE','DAF','DAG','DAH','DAI','DAJ','DAK',
  'DAL','DAM','DAN','DAO','DAP','DAQ','DAR','DAS','DAT','DAU','DAV',
  'DAW','DAX','DAY','DAZ',
  'DBA','DBB','DBC','DBD','DBE','DBF','DBG','DBH','DBI',
  'DCA','DCB','DCC','DCD','DCE','DCF','DCG','DCH','DCI','DCJ','DCK',
  'DCL','DCM','DCN','DCO','DCP','DCQ','DCR','DCS','DCT','DCU',
  'DDA','DDB','DDC','DDD','DDE','DDF','DDG','DDH','DDI','DDJ','DDK',
  'DDL','DDM','DDN',
]);

// ── IIN → State mapping (Issuer Identification Number) ──
const IIN_STATE = {
  '636000': 'VA', '636001': 'NY', '636002': 'MA', '636003': 'MD',
  '636004': 'NC', '636005': 'SC', '636006': 'CT', '636007': 'AZ',
  '636008': 'TN', '636009': 'PA', '636010': 'FL', '636011': 'ID',
  '636012': 'IA', '636013': 'KS', '636014': 'KY', '636015': 'LA',
  '636016': 'MN', '636017': 'MS', '636018': 'MO', '636019': 'MT',
  '636020': 'NE', '636021': 'NV', '636022': 'NH', '636023': 'NJ',
  '636024': 'NM', '636025': 'OH', '636026': 'OK', '636027': 'OR',
  '636028': 'RI', '636029': 'SD', '636030': 'UT', '636031': 'VT',
  '636032': 'WA', '636033': 'WV', '636034': 'WI', '636035': 'WY',
  '636036': 'ND', '636037': 'HI', '636038': 'CO', '636039': 'AK',
  '636040': 'AL', '636041': 'TX', '636042': 'GA', '636043': 'AR',
  '636044': 'DE', '636045': 'IL', '636046': 'IN', '636047': 'ME',
  '636048': 'MI', '636049': 'NM', '636050': 'CA', '636051': 'DC',
};

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID',
  'IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
  'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);

// ── Helpers ──

function parseAamvaDate(raw) {
  if (!raw) return '';
  let s = raw.trim();

  // Strip country prefix (e.g. "USA01152025")
  if (/^(USA|CAN)/i.test(s)) s = s.substring(3);

  const digits = s.replace(/[^0-9]/g, '');

  // 8 digits → MMDDYYYY or YYYYMMDD
  if (digits.length === 8) {
    const mm = digits.substring(0, 2);
    const dd = digits.substring(2, 4);
    const yyyy = digits.substring(4, 8);
    const mi = parseInt(mm, 10);
    const di = parseInt(dd, 10);
    const yi = parseInt(yyyy, 10);
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31 && yi >= 1900 && yi <= 2099) {
      return `${mm}/${dd}/${yyyy}`;
    }
    // Try YYYYMMDD
    const yyyy2 = digits.substring(0, 4);
    const mm2 = digits.substring(4, 6);
    const dd2 = digits.substring(6, 8);
    const mi2 = parseInt(mm2, 10);
    const di2 = parseInt(dd2, 10);
    const yi2 = parseInt(yyyy2, 10);
    if (mi2 >= 1 && mi2 <= 12 && di2 >= 1 && di2 <= 31 && yi2 >= 1900 && yi2 <= 2099) {
      return `${mm2}/${dd2}/${yyyy2}`;
    }
  }

  // Already formatted MM/DD/YYYY
  const m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  }

  return raw;
}

function titleCase(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function cleanZip(z) {
  if (!z) return '';
  const digits = z.replace(/[^0-9]/g, '');
  if (digits.length >= 9) return `${digits.substring(0, 5)}-${digits.substring(5, 9)}`;
  if (digits.length >= 5) return digits.substring(0, 5);
  return z.trim();
}

function parseSex(val) {
  if (!val) return '';
  const v = val.trim();
  if (v === '1') return 'Male';
  if (v === '2') return 'Female';
  return v;
}

function splitFullName(fullName) {
  const result = { first_name: '', middle_name: '', last_name: '' };
  if (!fullName) return result;
  const name = fullName.trim();

  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      result.last_name = parts[0];
      result.first_name = parts[1];
      result.middle_name = parts[2];
    } else if (parts.length === 2) {
      result.last_name = parts[0];
      const rest = parts[1].split(/\s+/);
      result.first_name = rest[0] || '';
      result.middle_name = rest.slice(1).join(' ');
    }
  } else {
    const parts = name.split(/\s+/);
    if (parts.length >= 3) {
      result.first_name = parts[0];
      result.middle_name = parts.slice(1, -1).join(' ');
      result.last_name = parts[parts.length - 1];
    } else if (parts.length === 2) {
      result.first_name = parts[0];
      result.last_name = parts[1];
    } else {
      result.last_name = parts[0] || '';
    }
  }
  return result;
}

// ── Core field extraction ──

function extractFields(data) {
  const fields = {};
  const normalized = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // Strategy 1: Line-by-line (safest — codes always start a line)
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length >= 3) {
      const code = line.substring(0, 3).toUpperCase();
      if (KNOWN_CODES.has(code)) {
        const value = line.substring(3).trim();
        if (!(code in fields)) {
          fields[code] = value;
        }
      }
    }
  }

  // Strategy 2: Header-embedded fields (e.g. "ANSI...DLDAQK12345678")
  for (const rawLine of lines) {
    const stripped = rawLine.trim();
    if (stripped.includes('ANSI') || stripped.substring(0, 50).includes('DL')) {
      for (const code of KNOWN_CODES) {
        const idx = stripped.indexOf(code);
        if (idx > 0 && !(code in fields)) {
          const pre = stripped.substring(Math.max(0, idx - 2), idx);
          if (/[\dL]/.test(pre)) {
            let value = stripped.substring(idx + 3);
            // Value runs until the next known code on the same segment
            for (const otherCode of KNOWN_CODES) {
              if (otherCode === code) continue;
              const ocIdx = value.indexOf(otherCode);
              if (ocIdx >= 0) {
                value = value.substring(0, ocIdx);
                break;
              }
            }
            value = value.trim();
            if (value) fields[code] = value;
          }
        }
      }
    }
  }

  // Strategy 3: Fallback for fully concatenated data (< 4 fields found)
  if (Object.keys(fields).length < 4) {
    const positions = [];
    for (const code of KNOWN_CODES) {
      let idx = normalized.indexOf(code);
      while (idx >= 0) {
        positions.push({ pos: idx, code });
        idx = normalized.indexOf(code, idx + 3);
      }
    }
    positions.sort((a, b) => a.pos - b.pos);

    for (let i = 0; i < positions.length; i++) {
      const { pos, code } = positions[i];
      const valStart = pos + 3;
      const valEnd = i + 1 < positions.length ? positions[i + 1].pos : normalized.length;
      const value = normalized.substring(valStart, valEnd).replace(/\n/g, '').trim();
      if (!(code in fields)) fields[code] = value;
    }
  }

  return fields;
}

// ── Header extraction ──

function extractHeader(data) {
  const header = { aamvaVersion: null, iin: null, issuingState: null };
  const ansiIdx = data.indexOf('ANSI ');
  const altIdx = ansiIdx === -1 ? data.indexOf('ANSI') : ansiIdx;
  if (altIdx === -1) return header;

  const offset = data.charAt(altIdx + 4) === ' ' ? 5 : 4;
  const after = data.substring(altIdx + offset).trimStart();

  if (after.length >= 10) {
    const iin = after.substring(0, 6);
    const ver = after.substring(6, 8);
    header.iin = iin;
    header.issuingState = IIN_STATE[iin] || null;
    const v = parseInt(ver, 10);
    if (!isNaN(v)) header.aamvaVersion = v;
  }
  return header;
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Check if data looks like an AAMVA PDF417 barcode.
 * Handles raw binary chars (\x1c, \x1d, \x1e), different encodings.
 */
export function isLikelyAamva(data) {
  if (!data || data.length < 20) return false;
  // Standard AAMVA header check: starts with file separator or @ or ANSI
  const head50 = data.substring(0, 50);
  if (head50.includes('@') || head50.includes('ANSI')) return true;
  // Control characters: FS (\x1c), GS (\x1d), RS (\x1e) are standard AAMVA delimiters
  if (data.charCodeAt(0) === 0x1c || data.charCodeAt(0) === 0x1e) return true;
  // Common field codes that appear in nearly every AAMVA barcode
  if (['DAQ', 'DCS', 'DAC', 'DAG', 'DAA', 'DBB', 'DBA'].some(c => data.includes(c))) return true;
  // Subfile designator — "DL" is present in every US license
  if (data.includes('\nDL') || data.includes('\rDL') || data.includes('\x1eDL')) return true;
  return false;
}

/**
 * Parse AAMVA PDF417 barcode data into structured license fields.
 *
 * @param {string} rawData - Raw barcode string from scanner
 * @returns {object} Parsed result with all fields + metadata
 */
export function parseAamvaPdf417(rawData) {
  const result = {
    success: false,
    first_name: '',
    middle_name: '',
    last_name: '',
    license_number: '',
    expiration: '',
    date_of_birth: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    sex: '',
    issue_date: '',
    country: '',
    aamva_version: null,
    issuing_state: null,
    confidence: 0,
    scan_method: 'pdf417',
    errors: [],
    warnings: [],
  };

  if (!rawData || rawData.length < 20) {
    result.errors.push('Barcode data too short or empty');
    return result;
  }

  try {
    // Header
    const header = extractHeader(rawData);
    result.aamva_version = header.aamvaVersion;
    result.issuing_state = header.issuingState;

    // Fields
    const fields = extractFields(rawData);

    if (Object.keys(fields).length < 2) {
      result.errors.push('Could not parse fields from barcode');
      return result;
    }

    // ── Name ──
    let lastName = (fields.DCS || '').trim();
    let firstName = (fields.DAC || fields.DCT || '').trim();
    let middleName = (fields.DAD || '').trim();

    if (['NONE', 'NMN', 'N/A', 'NA', ''].includes(middleName.toUpperCase())) {
      middleName = '';
    }

    if (!lastName && !firstName) {
      const fullName = (fields.DAA || '').trim();
      if (fullName) {
        const parts = splitFullName(fullName);
        lastName = parts.last_name;
        firstName = firstName || parts.first_name;
        middleName = middleName || parts.middle_name;
      }
    }

    if (!lastName) lastName = (fields.DAB || '').trim();

    result.first_name = titleCase(firstName);
    result.middle_name = titleCase(middleName);
    result.last_name = titleCase(lastName);

    // ── Address ──
    let address = (fields.DAG || fields.DAL || '').trim();
    const address2 = (fields.DAH || '').trim();
    if (address2) address = `${address}, ${address2}`;
    result.address = titleCase(address);

    result.city = titleCase((fields.DAI || fields.DAM || '').trim());

    let state = (fields.DAJ || fields.DAN || '').trim().toUpperCase();
    if (state.length > 2) state = state.substring(0, 2);
    result.state = state;

    result.zip_code = cleanZip((fields.DAK || fields.DAO || '').trim());

    // ── License ──
    result.license_number = (fields.DAQ || '').trim();

    // ── Dates ──
    result.date_of_birth = parseAamvaDate(fields.DBB || '');
    result.expiration = parseAamvaDate(fields.DBA || '');
    result.issue_date = parseAamvaDate(fields.DBD || '');

    // ── Physical ──
    result.sex = parseSex(fields.DBC || '');
    result.country = (fields.DCG || 'USA').trim();

    // ── Confidence ──
    const criticalFields = [
      result.first_name, result.last_name, result.license_number,
      result.date_of_birth, result.expiration, result.address,
      result.city, result.state, result.zip_code,
    ];
    const filled = criticalFields.filter(Boolean).length;
    let confidence = Math.round((filled / criticalFields.length) * 100);
    if (VALID_US_STATES.has(result.state)) confidence = Math.min(100, confidence + 3);
    if (result.aamva_version) confidence = Math.min(100, confidence + 2);
    result.confidence = confidence;

    // ── Warnings ──
    if (result.state && !VALID_US_STATES.has(result.state)) {
      result.warnings.push(`Unrecognized state: ${result.state}`);
    }
    if (!result.license_number) {
      result.warnings.push('License number not found — may need manual entry');
    }

    // ── Success ──
    result.success = Boolean(result.first_name || result.last_name || result.license_number);

  } catch (e) {
    result.errors.push(`Parser error: ${e.message}`);
  }

  return result;
}
