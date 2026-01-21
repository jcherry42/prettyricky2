"""Input validation and sanitization"""
import re
import html
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

def sanitize_input(value: Any, max_length: int = 1000) -> str:
    """Sanitize user input to prevent injection attacks"""
    if value is None:
        return ''
    
    # Convert to string
    text = str(value)
    
    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length]
    
    # Remove control characters
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')
    
    # HTML escape
    text = html.escape(text)
    
    return text.strip()

def validate_vin(vin: str) -> bool:
    """Validate VIN format (17 characters, no I, O, Q)"""
    if not vin or not isinstance(vin, str):
        return False
    
    # VIN must be exactly 17 characters
    if len(vin) != 17:
        return False
    
    # VIN cannot contain I, O, or Q
    if any(char in vin.upper() for char in ['I', 'O', 'Q']):
        return False
    
    # VIN must be alphanumeric
    if not vin.isalnum():
        return False
    
    return True

def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email or not isinstance(email, str):
        return False
    
    # Simple email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Validate phone format"""
    if not phone or not isinstance(phone, str):
        return False
    
    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)\.\+]', '', phone)
    
    # Must be 10-15 digits
    return cleaned.isdigit() and 10 <= len(cleaned) <= 15

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal"""
    if not filename:
        return 'unnamed'
    
    # Remove path components
    filename = filename.split('/')[-1].split('\\')[-1]
    
    # Remove dangerous characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    # Limit length
    if len(filename) > 255:
        filename = filename[:255]
    
    return filename or 'unnamed'