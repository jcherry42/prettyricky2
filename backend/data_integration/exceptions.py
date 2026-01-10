"""
Custom exceptions for data integration
Provides granular error handling and recovery paths
"""

from typing import Optional, List, Dict, Any


class DataIntegrationError(Exception):
    """Base exception for all data integration errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "details": self.details
        }


class ParseError(DataIntegrationError):
    """Raised when file parsing fails"""
    
    def __init__(self, message: str, file_type: str, line_number: Optional[int] = None):
        details = {"file_type": file_type}
        if line_number:
            details["line_number"] = line_number
        super().__init__(message, details)


class ValidationError(DataIntegrationError):
    """Raised when data validation fails"""
    
    def __init__(self, message: str, field: str, value: Any, row_index: Optional[int] = None):
        details = {
            "field": field,
            "invalid_value": str(value)[:100],  # Truncate for safety
        }
        if row_index is not None:
            details["row_index"] = row_index
        super().__init__(message, details)


class MappingError(DataIntegrationError):
    """Raised when field mapping fails"""
    
    def __init__(self, message: str, unmapped_fields: List[str], required_fields: List[str]):
        details = {
            "unmapped_fields": unmapped_fields,
            "required_fields": required_fields
        }
        super().__init__(message, details)


class FetchError(DataIntegrationError):
    """Raised when fetching from URL fails"""
    
    def __init__(self, message: str, url: str, status_code: Optional[int] = None):
        details = {"url": url[:200]}  # Truncate URL
        if status_code:
            details["status_code"] = status_code
        super().__init__(message, details)


class TransformError(DataIntegrationError):
    """Raised when data transformation fails"""
    
    def __init__(self, message: str, row_index: int, raw_data: Optional[Dict] = None):
        details = {"row_index": row_index}
        if raw_data:
            # Only include first few fields for debugging
            details["sample_fields"] = list(raw_data.keys())[:5]
        super().__init__(message, details)


class SchedulerError(DataIntegrationError):
    """Raised when scheduler operations fail"""
    
    def __init__(self, message: str, job_id: Optional[str] = None):
        details = {}
        if job_id:
            details["job_id"] = job_id
        super().__init__(message, details)


class RateLimitError(DataIntegrationError):
    """Raised when rate limit is exceeded"""
    
    def __init__(self, message: str, retry_after: Optional[int] = None):
        details = {}
        if retry_after:
            details["retry_after_seconds"] = retry_after
        super().__init__(message, details)
