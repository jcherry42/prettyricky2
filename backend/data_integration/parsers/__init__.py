"""
Parsers Package
Provides unified interface to all data parsers
"""

from .base import BaseParser, ParseResult
from .csv_parser import CSVParser
from .json_parser import JSONParser
from .google_sheets import GoogleSheetsParser

__all__ = [
    'BaseParser',
    'ParseResult',
    'CSVParser',
    'JSONParser',
    'GoogleSheetsParser',
    'get_parser',
    'detect_format',
]


def detect_format(content: str, url: str = None) -> str:
    """
    Detect the format of content
    
    Returns: 'csv', 'json', 'google_sheets', or 'unknown'
    """
    # Check URL first for Google Sheets
    if url and GoogleSheetsParser.is_google_sheets_url(url):
        return 'google_sheets'
    
    content = content.strip()
    
    # Check for JSON
    if content.startswith(('{', '[')):
        return 'json'
    
    # Default to CSV
    return 'csv'


def get_parser(format: str) -> BaseParser:
    """
    Get appropriate parser for format
    
    Args:
        format: 'csv', 'json', or 'google_sheets'
        
    Returns:
        Parser instance
    """
    parsers = {
        'csv': CSVParser,
        'json': JSONParser,
        'google_sheets': GoogleSheetsParser,
    }
    
    parser_class = parsers.get(format, CSVParser)
    return parser_class()
