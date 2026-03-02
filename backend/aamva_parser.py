"""
AAMVA PDF417 Barcode Parser — Enterprise Grade
Parses driver's license barcodes from all 50 US states + DC.

Supports AAMVA versions 1 through 10+ (2000–2025+).

Reference: AAMVA DL/ID Card Design Standard (CDS)
  - Version 1  (2000)
  - Version 2  (2003)
  - Version 3  (2005)
  - Version 4  (2009)
  - Version 5  (2010)
  - Version 6  (2011)
  - Version 7  (2012)
  - Version 8  (2013)
  - Version 9  (2016)
  - Version 10 (2020)
  - Version 11 (2024)
"""

import re
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# AAMVA field code → human-readable key mapping
# Covers ALL versions.  We parse every code we encounter,
# but the final output normalizes to the 10 fields the app needs.
# ──────────────────────────────────────────────────────────────

AAMVA_FIELD_MAP: Dict[str, str] = {
    # ── Name ──
    "DCS": "last_name",
    "DCT": "first_name",         # "first name" in some versions
    "DAC": "first_name",
    "DAD": "middle_name",
    "DAA": "full_name",          # older combined field
    "DAB": "last_name_v1",       # version 1 last name sometimes

    # ── Address ──
    "DAG": "address",            # Street Address Line 1
    "DAH": "address_2",          # Street Address Line 2
    "DAI": "city",
    "DAJ": "state",              # Jurisdiction / State
    "DAK": "zip_code",           # Postal Code
    "DAL": "address_alt",        # Residence Address Line 1 (v1-3)
    "DAM": "city_alt",           # Residence City (v1-3)
    "DAN": "state_alt",          # Residence State (v1-3)
    "DAO": "zip_alt",            # Residence ZIP (v1-3)

    # ── License Info ──
    "DAQ": "license_number",     # Customer ID / License number
    "DBA": "expiration",         # Expiration Date
    "DBB": "date_of_birth",      # Date of Birth
    "DBC": "sex",                # Sex (1=M, 2=F, 9=unspecified)
    "DBD": "issue_date",         # Document Issue Date

    # ── Physical ──
    "DAU": "height",             # Height
    "DAW": "weight_lbs",         # Weight (lbs)
    "DAX": "weight_kg",          # Weight (kg)
    "DAY": "eye_color",          # Eye Color
    "DAZ": "hair_color",         # Hair Color

    # ── Document ──
    "DCA": "vehicle_class",
    "DCB": "restrictions",
    "DCD": "endorsements",
    "DCF": "document_discriminator",
    "DCG": "country",            # Country (USA, CAN)
    "DCH": "federal_commercial", # Federal Commercial Vehicle Codes
    "DCI": "place_of_birth",
    "DCJ": "audit_information",
    "DCK": "inventory_control",
    "DCL": "race_ethnicity",
    "DCM": "standard_vehicle_class",
    "DCN": "standard_endorsements",
    "DCO": "standard_restrictions",
    "DCP": "dl_class_description",
    "DCQ": "dl_endorsement_desc",
    "DCR": "dl_restriction_desc",
    "DCS": "last_name",
    "DCU": "name_suffix",        # JR, SR, III etc.
    "DDA": "compliance_type",
    "DDB": "card_revision_date",
    "DDC": "hazmat_expiration",
    "DDD": "limited_duration",
    "DDE": "last_name_truncation",
    "DDF": "first_name_truncation",
    "DDG": "middle_name_truncation",
    "DDH": "under_18_until",
    "DDI": "under_19_until",
    "DDJ": "under_21_until",
    "DDK": "organ_donor",
    "DDL": "veteran",
}

# ── IIN → State Mapping (for metadata & fallback) ──
IIN_STATE_MAP: Dict[str, str] = {
    "636000": "VA", "636001": "NY", "636002": "MA", "636003": "MD",
    "636004": "NC", "636005": "SC", "636006": "CT", "636007": "AZ",
    "636008": "TN", "636009": "PA", "636010": "FL", "636011": "ID",
    "636012": "IA", "636013": "KS", "636014": "KY", "636015": "LA",
    "636016": "MN", "636017": "MS", "636018": "MO", "636019": "MT",
    "636020": "NE", "636021": "NV", "636022": "NH", "636023": "NJ",
    "636024": "NM", "636025": "OH", "636026": "OK", "636027": "OR",
    "636028": "RI", "636029": "SD", "636030": "UT", "636031": "VT",
    "636032": "WA", "636033": "WV", "636034": "WI", "636035": "WY",
    "636036": "ND", "636037": "HI", "636038": "CO", "636039": "AK",
    "636040": "AL", "636041": "TX", "636042": "GA", "636043": "AR",
    "636044": "DE", "636045": "IL", "636046": "IN", "636047": "ME",
    "636048": "MI", "636049": "NM", "636050": "CA", "636051": "DC",
    "636052": "PR",
    # Canada
    "636028": "RI", "604426": "AB", "604432": "BC", "604433": "MB",
    "604434": "NB", "604435": "NL", "604436": "NS", "604437": "ON",
    "604438": "PE", "604439": "QC", "604440": "SK",
}

# All 50 US states + DC
VALID_US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
    "WY",
}


# ──────────────────────────────────────────────────────────────
# Date helpers
# ──────────────────────────────────────────────────────────────

def _parse_aamva_date(raw: str) -> Optional[str]:
    """
    Parse date from AAMVA barcode into MM/DD/YYYY.
    Handles: MMDDYYYY, MM-DD-YYYY, MM/DD/YYYY, YYYYMMDD, YYYY-MM-DD
    and the country-code-prefixed variant (e.g. "USA01152025").
    """
    if not raw:
        return None
    s = raw.strip()

    # Remove "USA" or "CAN" prefix some states add (e.g. Georgia)
    if s.upper().startswith(("USA", "CAN")):
        s = s[3:]

    digits = re.sub(r"[^0-9]", "", s)

    # 8 digits: could be MMDDYYYY or YYYYMMDD
    if len(digits) == 8:
        mm, dd, yyyy = digits[0:2], digits[2:4], digits[4:8]
        try:
            mi, di, yi = int(mm), int(dd), int(yyyy)
            if 1 <= mi <= 12 and 1 <= di <= 31 and 1900 <= yi <= 2099:
                return f"{mm}/{dd}/{yyyy}"
        except ValueError:
            pass

        # Try YYYYMMDD
        yyyy2, mm2, dd2 = digits[0:4], digits[4:6], digits[6:8]
        try:
            mi, di, yi = int(mm2), int(dd2), int(yyyy2)
            if 1 <= mi <= 12 and 1 <= di <= 31 and 1900 <= yi <= 2099:
                return f"{mm2}/{dd2}/{yyyy2}"
        except ValueError:
            pass

    # Already formatted MM/DD/YYYY
    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", s)
    if m:
        return f"{m.group(1).zfill(2)}/{m.group(2).zfill(2)}/{m.group(3)}"

    return raw  # return as-is if unparseable


def _normalize_name(name: str) -> str:
    """Convert ALL-CAPS or lowercase name to Title Case."""
    if not name:
        return name
    # Remove trailing whitespace/control chars
    name = name.strip()
    # Title case each word
    return " ".join(w.capitalize() for w in name.split())


def _clean_zip(z: str) -> str:
    """Normalize ZIP code: keep 5 or 9 digits."""
    if not z:
        return z
    digits = re.sub(r"[^0-9]", "", z.strip())
    if len(digits) >= 9:
        return f"{digits[:5]}-{digits[5:9]}"
    if len(digits) >= 5:
        return digits[:5]
    return z.strip()


def _parse_sex(val: str) -> str:
    """Convert sex code to human-readable."""
    v = val.strip()
    if v == "1":
        return "Male"
    if v == "2":
        return "Female"
    return v


# ──────────────────────────────────────────────────────────────
# Core Parser
# ──────────────────────────────────────────────────────────────

def _extract_header(data: str) -> Dict[str, Any]:
    """
    Extract header metadata: AAMVA version, IIN, jurisdiction.
    """
    header: Dict[str, Any] = {
        "aamva_version": None,
        "iin": None,
        "jurisdiction_version": None,
        "issuing_state_iin": None,
    }

    # Find ANSI marker
    ansi_idx = data.find("ANSI ")
    if ansi_idx == -1:
        ansi_idx = data.find("ANSI")
    if ansi_idx == -1:
        return header

    # After "ANSI " we have: IIN(6) + AAMVA_version(2) + JurisdictionVersion(2) + ...
    after_ansi = data[ansi_idx + 5:].lstrip()

    # Some cards have "ANSI " followed immediately, others "ANSI" with no space
    if not after_ansi and ansi_idx >= 0:
        after_ansi = data[ansi_idx + 4:].lstrip()

    if len(after_ansi) >= 10:
        iin = after_ansi[0:6]
        aamva_ver = after_ansi[6:8]
        juris_ver = after_ansi[8:10]

        header["iin"] = iin
        header["issuing_state_iin"] = IIN_STATE_MAP.get(iin)

        try:
            header["aamva_version"] = int(aamva_ver)
        except ValueError:
            pass
        try:
            header["jurisdiction_version"] = int(juris_ver)
        except ValueError:
            pass

    return header


def _extract_fields(data: str) -> Dict[str, str]:
    """
    Extract all 3-character-coded fields from AAMVA barcode data.

    Handles ALL known formats:
    - Fields on separate lines  (DCS SMITH\\nDAC JOHN)
    - Fields concatenated       (DCSSMITHDACJOHN)
    - Fields embedded in header (ANSI...DLDAQK12345678\\nDCSJOHNSON)

    Uses a line-by-line strategy first (safest), then scans the header
    line for embedded fields that appear after the subfile designator.
    """
    fields: Dict[str, str] = {}

    # Normalize line endings
    normalized = data.replace("\r\n", "\n").replace("\r", "\n")

    # Build a set of ALL known 3-char AAMVA codes
    known_codes = set(AAMVA_FIELD_MAP.keys())
    known_codes.update({
        "DAA", "DAB", "DAC", "DAD", "DAE", "DAF", "DAG", "DAH", "DAI",
        "DAJ", "DAK", "DAL", "DAM", "DAN", "DAO", "DAP", "DAQ", "DAR",
        "DAS", "DAT", "DAU", "DAV", "DAW", "DAX", "DAY", "DAZ",
        "DBA", "DBB", "DBC", "DBD", "DBE", "DBF", "DBG", "DBH", "DBI",
        "DCA", "DCB", "DCC", "DCD", "DCE", "DCF", "DCG", "DCH", "DCI",
        "DCJ", "DCK", "DCL", "DCM", "DCN", "DCO", "DCP", "DCQ", "DCR",
        "DCS", "DCT", "DCU",
        "DDA", "DDB", "DDC", "DDD", "DDE", "DDF", "DDG", "DDH", "DDI",
        "DDJ", "DDK", "DDL", "DDM", "DDN",
    })

    lines = normalized.split("\n")

    # ── Strategy 1: Line-by-line (safe — codes always start a line) ──
    for line in lines:
        line = line.strip()
        if len(line) >= 3:
            code = line[0:3].upper()
            if code in known_codes:
                value = line[3:].strip()
                if code not in fields:
                    fields[code] = value

    # ── Strategy 2: Header-embedded fields ──
    # The first field (typically DAQ) often follows the subfile designator
    # on the same line as the header, e.g.  "ANSI...DLDAQK12345678"
    # Look for this case in lines containing "ANSI"
    for line in lines:
        stripped = line.strip()
        if "ANSI" in stripped or "DL" in stripped[:50]:
            # Find the last occurrence of "DL" (subfile designator)
            # followed by digits (offset+length), then the first code
            for code in known_codes:
                idx = stripped.find(code)
                if idx > 0 and code not in fields:
                    # Make sure this code is NOT just a substring of the header text
                    # by checking it's preceded by digits or the subfile designator
                    pre = stripped[max(0, idx-2):idx]
                    if any(c.isdigit() or c == 'L' for c in pre):
                        value = stripped[idx+3:]
                        # Value runs until the next known code on the same segment
                        for other_code in known_codes:
                            oc_idx = value.find(other_code)
                            if oc_idx >= 0 and other_code != code:
                                value = value[:oc_idx]
                                break
                        value = value.strip()
                        if value:
                            fields[code] = value

    # ── Strategy 3: Fallback regex for fully concatenated data (no newlines) ──
    # Only used when line-by-line found very few fields
    if len(fields) < 4:
        # Build a robust pattern that splits on known codes
        # Sort codes longest-first to avoid partial matches
        sorted_codes = sorted(known_codes, key=len, reverse=True)

        # Find positions of all code occurrences
        positions = []
        for code in sorted_codes:
            for m in re.finditer(re.escape(code), normalized):
                positions.append((m.start(), code))

        # Sort by position
        positions.sort(key=lambda x: x[0])

        # Extract values between consecutive code positions
        for i, (pos, code) in enumerate(positions):
            val_start = pos + 3
            if i + 1 < len(positions):
                val_end = positions[i + 1][0]
            else:
                val_end = len(normalized)
            value = normalized[val_start:val_end].replace("\n", "").strip()
            if code not in fields:
                fields[code] = value

    return fields


def _split_full_name(full_name: str) -> Dict[str, str]:
    """
    Split DAA (full name) field into first/middle/last.

    Common formats across states:
      "SMITH,JOHN,MICHAEL"           — comma-separated: LAST,FIRST,MIDDLE
      "SMITH,JOHN MICHAEL"           — comma-separated: LAST,REST
      "LAST,FIRST"                   — no middle
      "SMITH, JOHN MICHAEL"          — with spaces after comma
      "JOHN MICHAEL SMITH"           — space-separated (rare, some old v1)
    """
    result: Dict[str, str] = {"first_name": "", "middle_name": "", "last_name": ""}
    if not full_name:
        return result

    name = full_name.strip()

    if "," in name:
        parts = [p.strip() for p in name.split(",")]
        if len(parts) >= 3:
            result["last_name"] = parts[0]
            result["first_name"] = parts[1]
            result["middle_name"] = parts[2]
        elif len(parts) == 2:
            result["last_name"] = parts[0]
            # The second part might be "FIRST MIDDLE"
            rest = parts[1].split()
            result["first_name"] = rest[0] if rest else ""
            result["middle_name"] = " ".join(rest[1:]) if len(rest) > 1 else ""
    else:
        # Space-separated: assume "FIRST MIDDLE LAST" or "FIRST LAST"
        parts = name.split()
        if len(parts) >= 3:
            result["first_name"] = parts[0]
            result["middle_name"] = " ".join(parts[1:-1])
            result["last_name"] = parts[-1]
        elif len(parts) == 2:
            result["first_name"] = parts[0]
            result["last_name"] = parts[1]
        elif len(parts) == 1:
            result["last_name"] = parts[0]

    return result


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

class ParseResult:
    """Structured result of AAMVA PDF417 parsing."""

    def __init__(self):
        self.success: bool = False
        self.first_name: str = ""
        self.middle_name: str = ""
        self.last_name: str = ""
        self.license_number: str = ""
        self.expiration: str = ""
        self.date_of_birth: str = ""
        self.address: str = ""
        self.city: str = ""
        self.state: str = ""
        self.zip_code: str = ""
        self.sex: str = ""
        self.height: str = ""
        self.eye_color: str = ""
        self.issue_date: str = ""
        self.country: str = ""
        self.aamva_version: Optional[int] = None
        self.issuing_state_iin: Optional[str] = None
        self.confidence: float = 0.0
        self.scan_method: str = "pdf417"
        self.raw_fields: Dict[str, str] = {}
        self.errors: list = []
        self.warnings: list = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "first_name": self.first_name,
            "middle_name": self.middle_name,
            "last_name": self.last_name,
            "license_number": self.license_number,
            "expiration": self.expiration,
            "date_of_birth": self.date_of_birth,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zip_code": self.zip_code,
            "sex": self.sex,
            "height": self.height,
            "eye_color": self.eye_color,
            "issue_date": self.issue_date,
            "country": self.country,
            "aamva_version": self.aamva_version,
            "issuing_state_iin": self.issuing_state_iin,
            "confidence": self.confidence,
            "scan_method": self.scan_method,
            "errors": self.errors,
            "warnings": self.warnings,
        }


def parse_pdf417(raw_data: str) -> ParseResult:
    """
    Parse AAMVA-standard PDF417 barcode data from a US driver's license.

    Args:
        raw_data: The raw string data from a PDF417 barcode scan.

    Returns:
        ParseResult with extracted and normalized fields.
    """
    result = ParseResult()

    if not raw_data or len(raw_data) < 20:
        result.errors.append("Barcode data too short or empty")
        return result

    try:
        # ── Step 1: Header ──
        header = _extract_header(raw_data)
        result.aamva_version = header.get("aamva_version")
        result.issuing_state_iin = header.get("issuing_state_iin")

        # ── Step 2: Extract all fields ──
        fields = _extract_fields(raw_data)
        result.raw_fields = fields

        if len(fields) < 2:
            result.errors.append("Could not parse fields from barcode data")
            return result

        # ── Step 3: Map fields ──

        # -- Name --
        # Prefer DCS/DAC/DAD (modern versions)
        # Fall back to DAA (combined full name, older versions)
        last_name = fields.get("DCS", "").strip()
        first_name = fields.get("DAC", "") or fields.get("DCT", "")
        first_name = first_name.strip()
        middle_name = fields.get("DAD", "").strip()

        # Handle "NONE" or "NMN" (No Middle Name) placeholder
        if middle_name.upper() in ("NONE", "NMN", "N/A", "NA", ""):
            middle_name = ""

        # If DCS is empty, try DAA (full name field)
        if not last_name and not first_name:
            full_name = fields.get("DAA", "").strip()
            if full_name:
                name_parts = _split_full_name(full_name)
                last_name = name_parts["last_name"]
                first_name = first_name or name_parts["first_name"]
                middle_name = middle_name or name_parts["middle_name"]

        # Old v1 fallback: DAB = last name
        if not last_name:
            last_name = fields.get("DAB", "").strip()

        result.first_name = _normalize_name(first_name)
        result.middle_name = _normalize_name(middle_name)
        result.last_name = _normalize_name(last_name)

        # -- Address --
        address = fields.get("DAG", "").strip()
        address_2 = fields.get("DAH", "").strip()
        if not address:
            address = fields.get("DAL", "").strip()  # v1-3 residence alt
        if address_2:
            address = f"{address}, {address_2}"
        result.address = _normalize_name(address) if address else ""

        city = fields.get("DAI", "").strip()
        if not city:
            city = fields.get("DAM", "").strip()  # v1-3 residence alt
        result.city = _normalize_name(city)

        state = fields.get("DAJ", "").strip().upper()
        if not state:
            state = fields.get("DAN", "").strip().upper()  # v1-3 alt
        # Validate state
        if len(state) > 2:
            state = state[:2]
        result.state = state

        zip_code = fields.get("DAK", "").strip()
        if not zip_code:
            zip_code = fields.get("DAO", "").strip()  # v1-3 alt
        result.zip_code = _clean_zip(zip_code)

        # -- License Number --
        result.license_number = fields.get("DAQ", "").strip()

        # -- Dates --
        result.date_of_birth = _parse_aamva_date(fields.get("DBB", "")) or ""
        result.expiration = _parse_aamva_date(fields.get("DBA", "")) or ""
        result.issue_date = _parse_aamva_date(fields.get("DBD", "")) or ""

        # -- Physical --
        sex_raw = fields.get("DBC", "").strip()
        result.sex = _parse_sex(sex_raw) if sex_raw else ""

        result.height = fields.get("DAU", "").strip()
        result.eye_color = fields.get("DAY", "").strip()

        # -- Country --
        result.country = fields.get("DCG", "").strip() or "USA"

        # ── Step 4: Confidence scoring ──
        confidence = 0
        total_critical = 0
        filled_critical = 0

        critical_fields = [
            ("first_name", result.first_name),
            ("last_name", result.last_name),
            ("license_number", result.license_number),
            ("date_of_birth", result.date_of_birth),
            ("expiration", result.expiration),
            ("address", result.address),
            ("city", result.city),
            ("state", result.state),
            ("zip_code", result.zip_code),
        ]

        for name, value in critical_fields:
            total_critical += 1
            if value:
                filled_critical += 1

        if total_critical > 0:
            confidence = round((filled_critical / total_critical) * 100)

        # Boost confidence for valid state
        if result.state in VALID_US_STATES:
            confidence = min(100, confidence + 3)

        # Boost for having AAMVA version detected
        if result.aamva_version:
            confidence = min(100, confidence + 2)

        result.confidence = confidence

        # ── Step 5: Validation warnings ──
        if result.state and result.state not in VALID_US_STATES:
            result.warnings.append(f"Unrecognized state code: {result.state}")

        if result.zip_code:
            zip_digits = re.sub(r"[^0-9]", "", result.zip_code)
            if len(zip_digits) < 5:
                result.warnings.append(f"Incomplete ZIP code: {result.zip_code}")

        if not result.license_number:
            result.warnings.append("License number not found in barcode")

        if not result.date_of_birth:
            result.warnings.append("Date of birth not found in barcode")

        # ── Step 6: Success determination ──
        has_name = bool(result.first_name or result.last_name)
        has_license = bool(result.license_number)

        result.success = has_name or has_license

        if not has_name:
            result.errors.append("Could not extract name from barcode")
        if not has_license:
            result.warnings.append("License number not detected — may need manual entry")

        logger.info(
            f"PDF417 parsed: {result.first_name} {result.last_name} "
            f"| DL#{result.license_number} | {result.state} "
            f"| v{result.aamva_version} | conf={result.confidence}%"
        )

    except Exception as e:
        logger.error(f"AAMVA parse error: {e}", exc_info=True)
        result.errors.append(f"Parser error: {str(e)}")

    return result


# ──────────────────────────────────────────────────────────────
# Quick validation helper
# ──────────────────────────────────────────────────────────────

def is_likely_aamva(data: str) -> bool:
    """
    Quick check if a string looks like AAMVA PDF417 data.
    """
    if not data or len(data) < 30:
        return False
    # AAMVA barcodes typically start with @ or contain ANSI header
    if "@" in data[:5] or "ANSI" in data[:50]:
        return True
    # Also check for characteristic field codes
    if any(code in data for code in ["DAQ", "DCS", "DAC", "DAG", "DAA"]):
        return True
    return False
