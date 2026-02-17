const titleCase = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

export const normalizeDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const digits = raw.replace(/[^0-9]/g, '');

  if (digits.length === 8) {
    const yyyy = digits.slice(0, 4);
    const mm = digits.slice(4, 6);
    const dd = digits.slice(6, 8);
    const yyyyAlt = digits.slice(4, 8);
    const mmAlt = digits.slice(0, 2);
    const ddAlt = digits.slice(2, 4);

    const mmInt = parseInt(mm, 10);
    const ddInt = parseInt(dd, 10);
    if (mmInt >= 1 && mmInt <= 12 && ddInt >= 1 && ddInt <= 31) {
      return `${mm}/${dd}/${yyyy}`;
    }

    const mmAltInt = parseInt(mmAlt, 10);
    const ddAltInt = parseInt(ddAlt, 10);
    if (mmAltInt >= 1 && mmAltInt <= 12 && ddAltInt >= 1 && ddAltInt <= 31) {
      return `${mmAlt}/${ddAlt}/${yyyyAlt}`;
    }
  }

  const match = raw.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (match) {
    const mm = match[1].padStart(2, '0');
    const dd = match[2].padStart(2, '0');
    const yyyy = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${mm}/${dd}/${yyyy}`;
  }

  return raw;
};

export const parseAamvaBarcode = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\r/g, '\n');
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);

  const data = {};
  const fieldMap = {
    DCS: 'last_name',
    DAC: 'first_name',
    DAD: 'middle_name',
    DAG: 'address',
    DAI: 'city',
    DAJ: 'state',
    DAK: 'zip_code',
    DAQ: 'license_number',
    DBB: 'dob',
    DBA: 'expiration',
  };

  for (const line of lines) {
    if (line.length < 3) continue;
    const code = line.slice(0, 3);
    const value = line.slice(3).trim();
    if (fieldMap[code] && value) {
      data[fieldMap[code]] = value;
    }
  }

  if (data.first_name) data.first_name = titleCase(data.first_name);
  if (data.last_name) data.last_name = titleCase(data.last_name);
  if (data.middle_name) data.middle_name = titleCase(data.middle_name);
  if (data.address) data.address = titleCase(data.address);
  if (data.city) data.city = titleCase(data.city);
  if (data.state) data.state = String(data.state).toUpperCase().slice(0, 2);
  if (data.zip_code) data.zip_code = String(data.zip_code).replace(/[^0-9-]/g, '');
  if (data.dob) data.dob = normalizeDate(data.dob);
  if (data.expiration) data.expiration = normalizeDate(data.expiration);

  const hasAny = Object.values(data).some((value) => value);
  return hasAny ? data : null;
};

const extractDates = (lines) => {
  const dates = [];
  lines.forEach((line) => {
    const matches = line.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{8})/g);
    if (matches) {
      matches.forEach((match) => dates.push({ raw: match, line }));
    }
  });
  return dates;
};

export const parseLicenseOcrText = (text) => {
  if (!text) return null;

  const rawLines = String(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rawLines.length) return null;

  const upperLines = rawLines.map((line) => line.toUpperCase());
  const data = {};

  const nameLine = upperLines.find((line) => /,/.test(line) && /[A-Z]/.test(line));
  if (nameLine) {
    const [last, rest] = nameLine.split(',');
    const nameParts = rest ? rest.trim().split(/\s+/) : [];
    data.last_name = titleCase(last);
    data.first_name = titleCase(nameParts[0] || '');
    data.middle_name = titleCase(nameParts.slice(1).join(' '));
  } else {
    const nameIdx = upperLines.findIndex((line) => /NAME/.test(line));
    const candidate = nameIdx >= 0 && rawLines[nameIdx + 1] ? rawLines[nameIdx + 1] : rawLines.find((line) => /^[A-Z\s'.-]+$/i.test(line) && line.length > 4);
    if (candidate) {
      const parts = candidate.split(/\s+/).filter(Boolean);
      data.first_name = titleCase(parts[0] || '');
      data.last_name = titleCase(parts[parts.length - 1] || '');
      data.middle_name = titleCase(parts.slice(1, -1).join(' '));
    }
  }

  const addressLine = upperLines.find((line) => /\d{1,6}\s+[A-Z0-9]/.test(line));
  if (addressLine) {
    data.address = titleCase(addressLine);
  }

  const cityStateZip = upperLines.find((line) => /[A-Z]{2}\s+\d{5}/.test(line));
  if (cityStateZip) {
    const match = cityStateZip.match(/([A-Z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (match) {
      data.city = titleCase(match[1].trim());
      data.state = match[2];
      data.zip_code = match[3];
    }
  }

  const licenseLine = upperLines.find((line) => /(LIC|LICENSE|DL|ID|LIC#|DLN)/.test(line));
  if (licenseLine) {
    const tokens = licenseLine.replace(/[^A-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    const candidate = tokens.find((token) => token.length >= 5 && /[0-9]/.test(token));
    if (candidate) data.license_number = candidate;
  }

  const dates = extractDates(upperLines);
  dates.forEach(({ raw, line }) => {
    if (/DOB|BIRTH/.test(line) && !data.dob) data.dob = normalizeDate(raw);
    if (/EXP|EXPIRES/.test(line) && !data.expiration) data.expiration = normalizeDate(raw);
  });

  if (!data.dob || !data.expiration) {
    const normalized = dates.map((d) => normalizeDate(d.raw)).filter(Boolean);
    if (normalized.length >= 2) {
      const sorted = [...normalized].sort();
      if (!data.dob) data.dob = sorted[0];
      if (!data.expiration) data.expiration = sorted[sorted.length - 1];
    } else if (normalized.length === 1 && !data.dob) {
      data.dob = normalized[0];
    }
  }

  const hasAny = Object.values(data).some((value) => value);
  return hasAny ? data : null;
};

export const scoreLicenseData = (data) => {
  if (!data) return 0;
  let score = 0;
  if (data.first_name && data.last_name) score += 40;
  else if (data.first_name || data.last_name) score += 20;

  if (data.address) score += 20;
  if (data.city) score += 5;
  if (data.state) score += 5;
  if (data.zip_code) score += 5;
  if (data.license_number) score += 15;
  if (data.expiration) score += 5;
  if (data.dob) score += 5;
  return Math.min(score, 100);
};
