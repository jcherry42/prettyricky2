// Minimal AAMVA PDF417 parser for US Driver's Licenses.
// Goal: offline extraction (no image upload) of required fields:
// - first/last name
// - address (single string)
// - license number
// - expiration date
//
// Notes:
// - AAMVA payloads vary by state and version.
// - Common element IDs:
//   DCS = Last Name
//   DAC = First Name
//   DAG = Address Street 1
//   DAH = Address Street 2 (optional)
//   DAI = City
//   DAJ = State
//   DAK = ZIP
//   DAQ = Customer ID / License Number
//   DBA = Expiration Date (often YYYYMMDD)

function sanitize(raw) {
  return String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '\n')
    .trim();
}

function extractElement(lines, code) {
  // Find the first line that starts with the code.
  const prefix = String(code);
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return '';
}

function formatDate(value) {
  const v = String(value || '').replace(/[^0-9]/g, '');
  // AAMVA commonly uses YYYYMMDD.
  if (v.length === 8) {
    const yyyy = v.slice(0, 4);
    const mm = v.slice(4, 6);
    const dd = v.slice(6, 8);
    if (Number(mm) >= 1 && Number(mm) <= 12) {
      return `${mm}/${dd}/${yyyy}`;
    }
    // Some edge cases might be MMDDYYYY.
    const mm2 = v.slice(0, 2);
    const dd2 = v.slice(2, 4);
    const yyyy2 = v.slice(4, 8);
    if (Number(mm2) >= 1 && Number(mm2) <= 12) {
      return `${mm2}/${dd2}/${yyyy2}`;
    }
  }
  return value || '';
}

export function parseAamvaPdf417(payload) {
  const raw = sanitize(payload);
  if (!raw) {
    return {
      raw: '',
      firstName: '',
      lastName: '',
      address: '',
      dlNumber: '',
      expiration: '',
      ok: false,
    };
  }

  // Split by common separators: CR/LF, record separators, etc.
  const lines = raw
    .split(/\r\n|\n|\r|\u001e|\u001d/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const lastName = extractElement(lines, 'DCS');
  const firstName = extractElement(lines, 'DAC');

  const street1 = extractElement(lines, 'DAG');
  const street2 = extractElement(lines, 'DAH');
  const city = extractElement(lines, 'DAI');
  const state = extractElement(lines, 'DAJ');
  const zip = extractElement(lines, 'DAK');

  const dlNumber = extractElement(lines, 'DAQ');
  const expiration = formatDate(extractElement(lines, 'DBA'));

  const addressParts = [street1, street2, city && state ? `${city}, ${state}` : city || state, zip]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  const address = addressParts.join(' ');

  const ok = Boolean((firstName || lastName) && (dlNumber || expiration || address));

  return {
    raw,
    firstName,
    lastName,
    address,
    dlNumber,
    expiration,
    ok,
  };
}
