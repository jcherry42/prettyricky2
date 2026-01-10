"""
Base Parser Interface
Defines contract for all data parsers
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ParseResult:
    """Result of parsing operation"""
    success: bool
    headers: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    errors: List[str]
    warnings: List[str]
    encoding_detected: Optional[str] = None
    
    @property
    def has_data(self) -> bool:
        return len(self.rows) > 0


class BaseParser(ABC):
    """Abstract base class for data parsers"""
    
    MAX_ROWS = 10000  # Safety limit
    MAX_ERRORS = 100
    
    @abstractmethod
    async def parse(self, content: str) -> ParseResult:
        """
        Parse content and return structured data
        
        Args:
            content: Raw file content as string
            
        Returns:
            ParseResult with headers, rows, and error information
        """
        pass
    
    @abstractmethod
    def can_parse(self, content: str) -> Tuple[bool, float]:
        """
        Check if this parser can handle the content
        
        Args:
            content: Raw content to check
            
        Returns:
            Tuple of (can_parse, confidence)
        """
        pass
    
    @staticmethod
    def clean_header(header: str) -> str:
        """Clean and normalize a header name"""
        if not header:
            return ""
        # Remove BOM and whitespace
        cleaned = header.strip().strip('\ufeff')
        # Replace multiple spaces with single
        cleaned = ' '.join(cleaned.split())
        return cleaned
    
    @staticmethod
    def clean_value(value: Any) -> str:
        """Clean a cell value"""
        if value is None:
            return ""
        if isinstance(value, (int, float)):
            return str(value)
        return str(value).strip()
