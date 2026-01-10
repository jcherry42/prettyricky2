"""
Data Validators
Robust validation for phone, email, addresses with normalization
"""

import re
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of a validation operation"""
    is_valid: bool
    normalized_value: Optional[str]
    confidence: float  # 0.0 to 1.0
    error_message: Optional[str] = None


class PhoneValidator:
    """
    Validates and normalizes phone numbers
    Supports US/Canada formats with high accuracy
    """
    
    # Common phone patterns
    PATTERNS = [
        # (XXX) XXX-XXXX
        r'^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$',
        # XXX-XXX-XXXX
        r'^(\d{3})[-.\s](\d{3})[-.\s](\d{4})$',
        # XXXXXXXXXX
        r'^(\d{3})(\d{3})(\d{4})$',
        # +1 XXX XXX XXXX
        r'^\+?1?[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$',
    ]
    
    @classmethod
    def validate(cls, phone: str) -> ValidationResult:
        if not phone:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.0,
                error_message="Phone number is required"
            )
        
        # Clean the input
        cleaned = re.sub(r'[^\d+]', '', str(phone).strip())
        
        # Remove leading +1 or 1 for US numbers
        if cleaned.startswith('+1'):
            cleaned = cleaned[2:]
        elif cleaned.startswith('1') and len(cleaned) == 11:
            cleaned = cleaned[1:]
        
        # Must be exactly 10 digits for US/Canada
        if len(cleaned) != 10:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.3,
                error_message=f"Invalid phone length: {len(cleaned)} digits (expected 10)"
            )
        
        # Check for obviously fake patterns
        if cleaned in ['0000000000', '1234567890', '9999999999']:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.1,
                error_message="Phone number appears to be a placeholder"
            )
        
        # Check area code validity (basic check)
        area_code = cleaned[:3]
        if area_code[0] in ['0', '1']:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.4,
                error_message="Invalid area code"
            )
        
        # Format as (XXX) XXX-XXXX
        formatted = f"({cleaned[:3]}) {cleaned[3:6]}-{cleaned[6:]}"
        
        return ValidationResult(
            is_valid=True,
            normalized_value=formatted,
            confidence=0.95
        )


class EmailValidator:
    """
    Validates and normalizes email addresses
    """
    
    # RFC 5322 compliant pattern (simplified)
    PATTERN = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )
    
    # Common typo domains
    DOMAIN_CORRECTIONS = {
        'gmial.com': 'gmail.com',
        'gmal.com': 'gmail.com',
        'gamil.com': 'gmail.com',
        'gnail.com': 'gmail.com',
        'yaho.com': 'yahoo.com',
        'yahooo.com': 'yahoo.com',
        'hotmal.com': 'hotmail.com',
        'hotmial.com': 'hotmail.com',
        'outloo.com': 'outlook.com',
    }
    
    @classmethod
    def validate(cls, email: str) -> ValidationResult:
        if not email:
            return ValidationResult(
                is_valid=True,  # Email is optional
                normalized_value="",
                confidence=1.0
            )
        
        # Clean and lowercase
        cleaned = str(email).strip().lower()
        
        # Check basic pattern
        if not cls.PATTERN.match(cleaned):
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.2,
                error_message="Invalid email format"
            )
        
        # Check for common typos
        parts = cleaned.split('@')
        if len(parts) == 2:
            domain = parts[1]
            if domain in cls.DOMAIN_CORRECTIONS:
                corrected_domain = cls.DOMAIN_CORRECTIONS[domain]
                cleaned = f"{parts[0]}@{corrected_domain}"
                return ValidationResult(
                    is_valid=True,
                    normalized_value=cleaned,
                    confidence=0.85,
                    error_message=f"Corrected domain from {domain} to {corrected_domain}"
                )
        
        return ValidationResult(
            is_valid=True,
            normalized_value=cleaned,
            confidence=0.95
        )


class AddressValidator:
    """
    Validates and normalizes addresses
    Combines address components intelligently
    """
    
    # State abbreviations
    STATE_ABBREVIATIONS = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
        'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
    }
    
    @classmethod
    def normalize_state(cls, state: str) -> str:
        """Convert state name to abbreviation"""
        if not state:
            return ""
        
        cleaned = state.strip().lower()
        
        # Already an abbreviation
        if len(cleaned) == 2 and cleaned.upper() in cls.STATE_ABBREVIATIONS.values():
            return cleaned.upper()
        
        # Full name
        if cleaned in cls.STATE_ABBREVIATIONS:
            return cls.STATE_ABBREVIATIONS[cleaned]
        
        return state.strip()
    
    @classmethod
    def normalize_zip(cls, zip_code: str) -> str:
        """Normalize ZIP code"""
        if not zip_code:
            return ""
        
        # Extract digits
        digits = re.sub(r'[^\d]', '', str(zip_code))
        
        if len(digits) == 5:
            return digits
        elif len(digits) == 9:
            return f"{digits[:5]}-{digits[5:]}"
        elif len(digits) > 5:
            return digits[:5]
        
        return zip_code.strip()
    
    @classmethod
    def combine(
        cls,
        street: str = "",
        city: str = "",
        state: str = "",
        zip_code: str = ""
    ) -> ValidationResult:
        """Combine address components into a normalized address"""
        
        parts = []
        
        if street:
            parts.append(street.strip())
        
        city_state_zip = []
        if city:
            city_state_zip.append(city.strip())
        if state:
            normalized_state = cls.normalize_state(state)
            city_state_zip.append(normalized_state)
        if zip_code:
            normalized_zip = cls.normalize_zip(zip_code)
            city_state_zip.append(normalized_zip)
        
        if city_state_zip:
            parts.append(", ".join(city_state_zip))
        
        combined = ", ".join(parts) if parts else ""
        
        # Calculate confidence based on completeness
        filled_count = sum(1 for x in [street, city, state, zip_code] if x)
        confidence = filled_count / 4 if filled_count > 0 else 0.0
        
        return ValidationResult(
            is_valid=True,
            normalized_value=combined,
            confidence=confidence
        )


class VINValidator:
    """
    Validates Vehicle Identification Numbers
    """
    
    # VIN transliteration values
    TRANSLITERATION = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
        'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
    }
    
    # Position weights
    WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
    
    @classmethod
    def validate(cls, vin: str) -> ValidationResult:
        if not vin:
            return ValidationResult(
                is_valid=True,  # VIN is optional
                normalized_value="",
                confidence=1.0
            )
        
        # Clean and uppercase
        cleaned = re.sub(r'[^A-HJ-NPR-Z0-9]', '', str(vin).upper())
        
        # Must be exactly 17 characters
        if len(cleaned) != 17:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.3,
                error_message=f"VIN must be 17 characters (got {len(cleaned)})"
            )
        
        # Check for invalid characters (I, O, Q are not allowed)
        if any(c in cleaned for c in ['I', 'O', 'Q']):
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.4,
                error_message="VIN contains invalid characters (I, O, Q)"
            )
        
        # Validate check digit (position 9)
        try:
            total = 0
            for i, char in enumerate(cleaned):
                if char.isdigit():
                    value = int(char)
                else:
                    value = cls.TRANSLITERATION.get(char, 0)
                total += value * cls.WEIGHTS[i]
            
            remainder = total % 11
            check_digit = 'X' if remainder == 10 else str(remainder)
            
            if cleaned[8] != check_digit:
                return ValidationResult(
                    is_valid=True,  # Still usable, just suspicious
                    normalized_value=cleaned,
                    confidence=0.7,
                    error_message="VIN check digit mismatch (may be valid)"
                )
        except Exception:
            pass  # If check digit calc fails, still accept
        
        return ValidationResult(
            is_valid=True,
            normalized_value=cleaned,
            confidence=0.95
        )


class NameValidator:
    """
    Validates and parses names
    """
    
    # Common prefixes/suffixes to handle
    PREFIXES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof']
    SUFFIXES = ['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq']
    
    @classmethod
    def parse_full_name(cls, full_name: str) -> Tuple[str, str]:
        """
        Parse a full name into first and last name
        Returns: (first_name, last_name)
        """
        if not full_name:
            return ("", "")
        
        # Clean the name
        cleaned = ' '.join(full_name.strip().split())
        
        # Remove common prefixes
        words = cleaned.split()
        if words and words[0].lower().rstrip('.') in cls.PREFIXES:
            words = words[1:]
        
        # Remove common suffixes
        if words and words[-1].lower().rstrip('.') in cls.SUFFIXES:
            words = words[:-1]
        
        if not words:
            return ("", "")
        elif len(words) == 1:
            return (words[0].title(), "")
        elif len(words) == 2:
            return (words[0].title(), words[1].title())
        else:
            # First word is first name, rest is last name
            return (words[0].title(), " ".join(words[1:]).title())
    
    @classmethod
    def validate(cls, first_name: str, last_name: str = "") -> ValidationResult:
        """Validate a name"""
        if not first_name:
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.0,
                error_message="First name is required"
            )
        
        # Basic validation - must contain letters
        if not re.search(r'[a-zA-Z]', first_name):
            return ValidationResult(
                is_valid=False,
                normalized_value=None,
                confidence=0.2,
                error_message="Name must contain letters"
            )
        
        # Normalize capitalization
        normalized_first = first_name.strip().title()
        normalized_last = last_name.strip().title() if last_name else ""
        
        full_normalized = f"{normalized_first} {normalized_last}".strip()
        
        return ValidationResult(
            is_valid=True,
            normalized_value=full_normalized,
            confidence=0.9
        )
